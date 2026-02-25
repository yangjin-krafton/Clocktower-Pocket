# Clocktower Pocket — UI/UX 모듈 설계서

기준 스크립트: **Trouble Brewing**
기술 스택: Vanilla JS + Trystero P2P (기존 `src/js/p2p.js` 활용)

---

## 핵심 설계 철학

> **대기(Waiting)는 화면이 아니라 게임 화면 안의 상태(phase)다.**

기존 설계의 문제:
- 호스트 → `Lobby` 화면에서 멈춤. 인원이 차야만 Grimoire로 이동.
- 참가자 → `Waiting` 화면에서 멈춤. 호스트가 시작해야만 탭이 열림.
- 결과: 인원이 다 모일 때까지 **모두 아무것도 못 하고 기다림**.

새 설계의 목표:
- 호스트는 방 생성 즉시 Grimoire 진입. 빈 자리는 인원이 들어올수록 채워짐.
- 참가자는 방 참가 즉시 모든 탭 진입. 역할 탭은 배정 전까지 대기 상태 표시.
- **대기 시간 동안 캐릭터 사전, 메모, 시그널 등을 미리 사용 가능.**
- 매칭(P2P 연결 + 착석)은 백그라운드에서 진행.
- 전원 착석 → 자동으로 역할 배정 → 카운트다운 → 게임 시작.

```
설계 원칙:
  컴포넌트는 데이터만 받아서 렌더링한다.
  화면(Screen)은 컴포넌트를 조립한 것이다.
  같은 컴포넌트가 호스트/참가자 앱 양쪽에서 재사용된다.
  lobby 는 별도 화면이 아닌 game phase 중 하나다.
```

---

## 1. 데이터 모델

### Player
```js
{
  id: number,          // 좌석 번호 (1~N)
  peerId: string,      // Trystero 피어 ID
  name: string,        // 닉네임
  role: string,        // 역할 ID (예: "imp", "washerwoman")
  team: 'good'|'evil', // 실제 정렬
  status: 'alive'|'dead'|'executed',
  isPoisoned: boolean,
  isDrunk: boolean,
  deadVoteUsed: boolean,
  // 호스트만 알고 있는 필드 (참가자에게 비공개)
  registeredAs: string|null  // Spy/Recluse 등록 왜곡용
}
```

### Role
```js
{
  id: string,
  name: string,
  team: 'townsfolk'|'outsider'|'minion'|'demon',
  ability: string,     // 능력 설명 텍스트
  firstNight: boolean, // 첫밤 행동 여부
  otherNights: boolean // 이후 밤 행동 여부
}
```

### GameState
```js
{
  phase: 'lobby'|'night'|'day',
  // lobby  = 방 생성 후 ~ 전원 착석 전. 인게임 화면은 이미 열려 있음.
  // night  = 첫 번째 밤부터 게임 진행
  // day    = 낮 진행
  round: number,
  players: Player[],      // lobby 중에는 착석 완료된 플레이어만 포함
  nominations: [{ nominatorId, targetId, votes: number }],
  executedToday: number|null,
  nightOrder: string[],
  currentNightStep: string|null,
}
```

### LobbyState (phase==='lobby' 동안 추가 상태)
```js
{
  seatedCount: number,   // 현재 착석 인원
  totalCount: number,    // 목표 인원 (Setup에서 설정)
  seats: [               // 자리 배열
    { seatNum: number, name: string|null }
    // name이 null이면 아직 비어 있는 자리
  ]
}
```

### NightAction (호스트 내부)
```js
{
  round: number,
  roleId: string,
  actorId: number,
  targetIds: number[],
  infoSent: any
}
```

---

## 2. 공통 컴포넌트 (재사용 모듈)

> 각 컴포넌트는 `render(data) → HTMLElement` 함수 형태로 구현.

### C-01 `PlayerChip`
플레이어 1명을 나타내는 가장 작은 단위.

| 입력 데이터 | 표시 내용 |
|------------|----------|
| `player.id` | 좌석 번호 |
| `player.name` | 닉네임 |
| `player.status` | alive → 일반 / dead → 흐림+취소선 / executed → 빨간 테두리 |
| `player.isPoisoned` | 독 아이콘 |
| `selectable: boolean` | 선택 가능 여부 |
| `selected: boolean` | 선택됨 강조 |

재사용 위치: Grimoire, SelectPanel, PlayerTracker, EmojiPanel 전부

---

### C-02 `RoleCard`
역할 1개의 정보 카드.

| 입력 데이터 | 표시 내용 |
|------------|----------|
| `role.name` | 역할 이름 |
| `role.team` | 팀 색상 (townsfolk=파랑, outsider=청록, minion=주황, demon=빨강) |
| `role.ability` | 능력 설명 |
| `compact: boolean` | true면 이름+팀만, false면 능력 설명 포함 |

재사용 위치: 참가자 역할 카드 화면, 캐릭터 사전, 호스트 야간 행동 패널

---

### C-03 `PlayerGrid`
PlayerChip 목록을 그리드로 배치.

| 입력 데이터 | 동작 |
|------------|------|
| `players[]` | 좌석 순서대로 렌더링 |
| `selectable: boolean` | 선택 모드 활성화 |
| `maxSelect: number` | 최대 선택 수 (1 or 2) |
| `onSelect: fn(ids[])` | 선택 완료 콜백 |

재사용 위치: 호스트 Grimoire, 호스트 SelectPanel, 참가자 PlayerTracker

---

### C-04 `PhaseHeader`
현재 게임 페이즈 표시 띠.

| 입력 데이터 | 표시 내용 |
|------------|----------|
| `phase` | lobby → "입장 대기 중" / day / night |
| `round` | N일째 / N번째 밤 / lobby 중에는 "N/M명" |
| `aliveCount` | 생존자 수 (lobby 중에는 표시 안 함) |

재사용 위치: 호스트 Grimoire 상단, 참가자 PlayerTracker 상단

---

### C-05 `InfoPanel` (호스트 전용)
밤에 참가자에게 화면을 돌려서 보여주는 전체화면 패널.

| 입력 데이터 | 표시 내용 |
|------------|----------|
| `title` | 역할 이름 (예: "Empath") |
| `message` | 전달 정보 텍스트 (예: "이웃 중 악 1명") |
| `players[]` | 관련 플레이어 PlayerChip 표시 |
| `onConfirm: fn()` | 확인 버튼 → 호스트 복귀 |

---

### C-06 `SelectPanel` (호스트 전용)
밤에 참가자가 호스트 화면에서 대상을 직접 탭하는 패널.

| 입력 데이터 | 동작 |
|------------|------|
| `title` | 역할 이름 + "대상을 선택하세요" |
| `players[]` | 선택 가능한 PlayerGrid |
| `maxSelect` | 최대 선택 수 |
| `onConfirm: fn(ids[])` | 선택 완료 콜백 → 호스트 내부 기록 |

---

### C-07 `VoteBar`
현재 지목자의 투표 집계 시각화.

| 입력 데이터 | 표시 내용 |
|------------|----------|
| `targetName` | 지목된 플레이어 이름 |
| `votes` | 현재 투표 수 |
| `threshold` | 처형 문턱값 (생존자 과반) |
| `isLeading` | 현재 최다 득표 여부 |

---

### C-08 `EmojiPicker` (참가자 전용)
특정 참가자에게 이모지 시그널 전송.

| 입력 데이터 | 동작 |
|------------|------|
| `players[]` | 수신 대상 선택 목록 (전체 포함) |
| `emojis[]` | 보낼 수 있는 이모지 목록 |
| `onSend: fn(targetId, emoji)` | 전송 콜백 → p2p `EMOJI` 메시지 |

---

### C-09 `EmojiPopup` (참가자 전용)
이모지 수신 시 화면에 잠깐 표시되는 팝업.

| 입력 데이터 | 표시 내용 |
|------------|----------|
| `fromName` | 보낸 사람 이름 |
| `emoji` | 이모지 문자 |
| `duration` | 표시 시간 (기본 3초) |

---

### C-10 `NightOrderList` (호스트 전용)
남은 밤 순서를 리스트로 표시.

| 입력 데이터 | 표시 내용 |
|------------|----------|
| `nightOrder[]` | 전체 순서 |
| `currentStep` | 현재 처리 중 (강조) |
| `done[]` | 완료된 역할 (흐림 처리) |

---

### C-11 `LogEntry` (호스트 전용)
판정 로그 1줄.

| 입력 데이터 | 표시 내용 |
|------------|----------|
| `round` | 라운드 |
| `phase` | day/night |
| `event` | 이벤트 설명 텍스트 |
| `timestamp` | 시각 |

---

### C-12 `LobbyBanner` (신규)
인게임 화면 상단에 붙어 있는 **인라인 대기 배너**.
별도 화면 전환 없이 게임 화면 안에서 착석 상황을 보여줌.

| 입력 데이터 | 표시 내용 |
|------------|----------|
| `seats[]` | 전체 자리 목록 `{ seatNum, name\|null }` |
| `totalCount` | 목표 인원 수 |
| `roomCode` | 방 코드 (참가자에게 공유용) |
| `countdown\|null` | 카운트다운 숫자. null이면 미표시. |

- **상단 고정 배너**: 게임 화면 콘텐츠 위에 작게 붙음. 축소/확장 토글 가능.
- 빈 자리는 회색 슬롯. 착석하면 이름이 채워지면서 하이라이트.
- 전원 착석 → 카운트다운 숫자로 전환.
- 카운트다운 0 → 배너 사라짐. 게임 진행.

```
┌─────────────────────────────────────────┐
│  🏰 ABCD12  · 3/7명 입장 중  [▼ 펼치기] │   ← 최소화 상태
└─────────────────────────────────────────┘

┌─────────────────────────────────────────┐
│  방 코드: ABCD12  ·  3 / 7명 입장       │
│  [1 Alice] [2 Bob] [3 Carol] [4 –] [5 –]│
│  [6 –]    [7 –]                         │
└─────────────────────────────────────────┘

// 전원 착석 후
┌─────────────────────────────────────────┐
│  ⚔️ 전원 착석 완료  ·  게임 시작까지  5  │   ← 카운트다운
└─────────────────────────────────────────┘
```

재사용 위치: 호스트 Grimoire 상단, 참가자 모든 탭 상단

---

## 3. 호스트 화면 목록

> **H-02 Lobby는 제거됨.**
> 방 생성 즉시 H-03 Grimoire 진입. 대기 상태는 LobbyBanner가 인라인 처리.

### H-01 Setup (게임 설정)
**조립**: 입력 폼
**기능**: 스크립트 선택(현재 TB 고정), 인원 수 설정, 방 생성 버튼
**전환**: 방 생성 완료 → **즉시 H-03** (phase: lobby)

---

### H-03 Grimoire (메인 상태판) ← 방 생성 직후부터 진입
**조립**: `LobbyBanner`(phase=lobby일 때) + `PhaseHeader` + `PlayerGrid` + 액션 버튼 그룹 + `NightOrderList`(밤만) + `LogEntry` 목록

**lobby phase 동작**:
- `LobbyBanner` 상단 고정: 방 코드 + 착석 현황 실시간 표시
- PlayerGrid: 착석한 플레이어만 표시 (빈 자리는 "–" 슬롯)
- 액션 버튼: **모두 활성** (호스트가 미리 탐색 가능)
- 전원 착석 → 자동으로 역할 배정 + 카운트다운 진행

**game phase 동작** (기존과 동일):
- `LobbyBanner` 사라짐
- 전체 플레이어 상태 확인, 페이즈 전환, 상태 수동 수정

```
┌──────────────────────────────────┐
│  🏰 ABCD12 · 4/7명 입장  [▼]    │  ← LobbyBanner (lobby phase)
├──────────────────────────────────┤
│  PhaseHeader (대기 중)           │
├──────────────────────────────────┤
│  PlayerGrid                      │
│  [1 Alice ●] [2 Bob ●] [3 –] …  │
├──────────────────────────────────┤
│  [밤 진행 시작]  [낮으로 전환]   │  ← 버튼 활성 (탐색 가능)
└──────────────────────────────────┘
```

**전환**: phase 자동 변경(night) → LobbyBanner 제거 → Grimoire 유지
**전환**: 밤 시작 → H-04 / 낮 시작 → H-06 / 승리 → H-07

---

### H-04 Night Action (밤 역할 처리)
한 역할씩 순서대로 처리. 아래 두 패널 중 해당 역할에 맞게 조립.

#### H-04a 정보 전달 역할 (Empath, FT, Undertaker 등)
**조립**: `InfoPanel` (전체화면)
**전환**: 확인 → H-03

#### H-04b 선택 역할 (Poisoner, Monk, Imp 등)
**조립**: `SelectPanel` (전체화면)
**전환**: 확인 → H-03

---

### H-05 Night Result — 내부 처리
**화면 없음.** Grimoire에서 자동 계산.
- Monk vs Imp 충돌 판정
- 사망자 확정
- Scarlet Woman 승계 체크
- 로그 기록

---

### H-06 Day Flow (낮 진행)
**조립**: `PhaseHeader` + `PlayerGrid` + `VoteBar` + 처형 확정 버튼

```
┌─────────────────────────────┐
│  PhaseHeader (Day 2)        │
├─────────────────────────────┤
│  PlayerGrid (지목 탭 가능)  │
├─────────────────────────────┤
│  VoteBar                    │
│  Bob: 4표 / 필요 5표        │
├─────────────────────────────┤
│  [처형 확정] [다음 밤]       │
└─────────────────────────────┘
```

**전환**: 밤으로 → H-04 / 승리 조건 충족 → H-07

---

### H-07 Victory (게임 종료)
**조립**: 결과 배너 + `PlayerGrid(전체 역할 공개)`
**전환**: 새 게임 → H-01

---

## 4. 참가자 화면 목록

> **P-02 Waiting은 제거됨.**
> 방 참가 즉시 P-03~P-07 탭 진입. 대기 상태는 각 탭 안에서 인라인 처리.

### P-01 Join (방 참가)
**조립**: 닉네임 입력 + 방 코드 입력 + 참가 버튼
**기능**: URL 파라미터 `?code=` 자동 감지
**전환**: 방 접속 완료 → **즉시 P 탭 화면 전체 진입** (phase: lobby)

---

### P-03 내 역할 탭 ← 방 참가 직후부터 탭 열림

**lobby phase 상태**:
- 역할 미배정 → `LobbyBanner` + "역할 배정 대기 중" 인라인 메시지
- 착석 현황 (`seatedCount / totalCount명 입장`) 실시간 표시
- 캐릭터 사전, 메모 탭으로 이동해서 **미리 게임 준비 가능**

**game phase 상태** (기존과 동일):
- `LobbyBanner` 사라짐
- `RoleCard(compact=false)` + 팀 배너 + 밤 행동 팁

```
// lobby phase — 역할 탭
┌──────────────────────────────────┐
│  🏰 ABCD12 · 4/7명 입장  [▼]    │  ← LobbyBanner
├──────────────────────────────────┤
│                                  │
│         🏰                       │
│    역할 배정 대기 중              │
│    · · ·                         │
│    4 / 7명 입장                  │
│                                  │
│  ※ 아래 탭에서 캐릭터 사전을    │
│     미리 확인할 수 있습니다      │
└──────────────────────────────────┘

// game phase — 역할 탭
┌──────────────────────────────────┐
│  [내 역할]                        │
│  ┌──────────────────────────┐    │
│  │  🔮 Fortune Teller       │    │
│  │  Townsfolk               │    │
│  │  능력: ...               │    │
│  └──────────────────────────┘    │
│  🕊️ 선 팀 (Good)                  │
└──────────────────────────────────┘
```

---

### P-04 Player Tracker (플레이어 추적)

**lobby phase 상태**:
- `LobbyBanner` 상단 고정
- 착석한 플레이어 목록 표시 (비어 있으면 "아직 아무도 없음")
- 주석 입력 기능은 **착석 후 바로 사용 가능**

**game phase 상태** (기존과 동일):
- `PhaseHeader` + `PlayerGrid` + 플레이어별 주석

---

### P-05 Emoji Panel (이모지 시그널)

**lobby phase 상태**:
- `LobbyBanner` 상단 고정
- 착석한 플레이어에게는 이미 이모지 전송 가능
- 수신 대상 목록이 비어 있으면 "아직 아무도 없음" 표시

---

### P-06 Memo (메모장)
**lobby / game phase 구분 없음**: 항상 완전 활성.
개인 추리 메모. 로컬 저장(localStorage). P2P 전송 없음.

---

### P-07 Character Dict (캐릭터 사전)
**lobby / game phase 구분 없음**: 항상 완전 활성.
이번 스크립트 전체 역할 설명 참고. **대기 중에 미리 읽기 최적.**

---

## 5. 화면 전환 흐름

### 호스트 흐름
```
H-01 Setup
  → H-03 Grimoire [phase: lobby]  ← 방 생성 즉시
      (백그라운드: P2P 연결 + 플레이어 착석)
      (전원 착석 → 역할 자동 배정 → COUNTDOWN 5초)
  → H-03 Grimoire [phase: night]  ← 카운트다운 종료 후 자동 전환
      → H-04 Night Action (밤 시작할 때마다)
        → H-03 Grimoire (각 역할 처리 완료)
      → H-06 Day Flow (낮 시작할 때마다)
        → H-03 Grimoire (낮 종료)
      → H-07 Victory (승리 조건 충족)
```

### 참가자 흐름
```
P-01 Join
  → P 탭 전체 [phase: lobby]  ← 방 참가 즉시 (모든 탭 활성)
      역할 탭: 대기 상태 인라인 표시
      캐릭터 사전 / 메모: 바로 사용 가능
      이모지: 착석 인원 범위 내에서 사용 가능
      (백그라운드: ROLE_ASSIGN 대기)
  → P 탭 전체 [phase: game]   ← GAME_START 수신 후 자동 전환
      역할 탭: 역할 카드 표시
      플레이어 탭: 전원 목록 표시
      이모지: 전원 대상 사용 가능
  → 게임 종료 화면 (GAME_END 수신)
```

### 자동 게임 시작 시퀀스 (백그라운드)
```
[Host]  모든 플레이어 착석 감지
         → engine.initGame() 실행
         → 각 플레이어에게 ROLE_ASSIGN 개별 전송
         → COUNTDOWN { seconds: 5, players[] } 브로드캐스트
         → 5초 후 GAME_START 브로드캐스트 + engine.startNight()

[Client]  ROLE_ASSIGN 수신 → 역할 탭 즉시 갱신
           COUNTDOWN 수신  → LobbyBanner에 카운트다운 표시
           GAME_START 수신 → LobbyBanner 제거, 게임 본격 시작
```

---

## 6. P2P 메시지 타입 정의

| 논리 타입 | 단축 (12B↓) | 방향 | 페이로드 |
|-----------|-------------|------|----------|
| `GAME_START` | `GAME_ST` | Host→All | `{ players[], script }` |
| `PHASE_CHANGE` | `PHASE` | Host→All | `{ phase, round }` |
| `ROLE_ASSIGN` | `ROLE_ASSIGN` | Host→1 | `{ playerId, role, team }` |
| `NIGHT_INFO` | `NIGHT_INF` | Host→1 | `{ title, message, players[] }` |
| `PLAYER_DIED` | `DIED` | Host→All | `{ playerId, cause }` |
| `VOTE_UPDATE` | `VOTE_UPD` | Host→All | `{ targetId, votes, threshold }` |
| `GAME_END` | `GAME_END` | Host→All | `{ winner, roles[] }` |
| `EMOJI` | `EMOJI` | Player↔Player | `{ fromId, targetId, emoji }` |
| `SEAT_UPDATE` | `SEAT_UPD` | Host→All | `{ seated[{name,seatNum}], total }` |
| `COUNTDOWN` | `CDWN` | Host→All | `{ seconds, players[] }` |

---

## 7. 파일 구조

```
src/
├── index.html
├── js/
│   ├── app.js           # 랜딩 (Host/Player 선택)
│   ├── p2p.js           # P2P 통신
│   ├── game-engine.js   # 게임 규칙 엔진
│   ├── data/
│   │   └── roles-tb.js
│   ├── components/
│   │   ├── PlayerChip.js
│   │   ├── RoleCard.js
│   │   ├── PlayerGrid.js
│   │   ├── PhaseHeader.js
│   │   ├── LobbyBanner.js   ← 신규 (C-12)
│   │   ├── InfoPanel.js
│   │   ├── SelectPanel.js
│   │   ├── VoteBar.js
│   │   ├── EmojiPicker.js
│   │   ├── EmojiPopup.js
│   │   ├── NightOrderList.js
│   │   └── LogEntry.js
│   ├── host/
│   │   ├── app.js
│   │   ├── Setup.js
│   │   ├── Grimoire.js      ← lobby phase 인라인 처리 포함
│   │   ├── NightAction.js
│   │   ├── DayFlow.js
│   │   └── Victory.js
│   │   (Lobby.js 제거)
│   └── player/
│       ├── app.js
│       ├── Join.js
│       ├── RoleCardScreen.js ← lobby 대기 상태 인라인 포함
│       ├── PlayerTracker.js
│       ├── EmojiPanel.js
│       ├── Memo.js
│       └── CharacterDict.js
│       (Waiting.js 제거)
└── css/
    └── theme.css
```

---

## 8. Lobby Phase UX 규칙

1. **LobbyBanner는 항상 최상단 고정** — 스크롤해도 따라옴
2. **배너는 축소/확장 토글 가능** — 방 코드만 보이는 최소화 상태 제공
3. **게임 버튼은 모두 활성** — lobby 중 눌러도 아무 일도 안 일어나지 않고, 호스트/참가자가 미리 UX 탐색 가능 (단, 게임 진행 로직은 GAME_START 이후부터만 실제 동작)
4. **착석 순서 = 좌석 번호** — JOIN_REQUEST 도착 순서대로 1번부터 배정
5. **카운트다운은 LobbyBanner 안에서 숫자로 표시** — 전체 화면 덮는 오버레이 없이 배너만 업데이트됨
6. **GAME_START 수신 → LobbyBanner 즉시 사라짐** — 화면 전환 없이 인게임 상태로 자연스럽게 전환
