# Clocktower Pocket — UI/UX 모듈 설계서

기준 스크립트: **Trouble Brewing**
기술 스택: Vanilla JS + Trystero P2P (기존 `src/js/p2p.js` 활용)

---

## 설계 원칙

> 컴포넌트는 **데이터만 받아서 렌더링**한다.
> 화면(Screen)은 **컴포넌트를 조립**한 것이다.
> 같은 컴포넌트가 호스트/참가자 앱 양쪽에서 재사용된다.

```
데이터 모델 → 컴포넌트(Module) → 화면(Screen)
```

---

## 1. 데이터 모델

화면을 조립하기 전에 흐르는 데이터 구조.

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
  phase: 'lobby'|'day'|'night',
  round: number,          // 1부터 시작
  players: Player[],
  nominations: [          // 당일 지목 목록
    { nominatorId, targetId, votes: number }
  ],
  executedToday: number|null,   // 오늘 처형된 player.id
  nightOrder: string[],         // 남은 밤 순서 (role id 배열)
  currentNightStep: string|null // 현재 처리 중인 role id
}
```

### NightAction (호스트 내부)
```js
{
  round: number,
  roleId: string,
  actorId: number,     // 행동한 player.id
  targetIds: number[], // 선택한 대상들
  infoSent: any        // 전달한 정보 스냅샷
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
| `selectable: boolean` | 선택 가능 여부 (탭 가능한 상태) |
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
| `phase` | Day / Night 아이콘 + 텍스트 |
| `round` | N일째 / N번째 밤 |
| `aliveCount` | 생존자 수 |

재사용 위치: 호스트 모든 화면 상단, 참가자 PlayerTracker 상단

---

### C-05 `InfoPanel` (호스트 전용)
밤에 참가자에게 화면을 돌려서 보여주는 전체화면 패널.

| 입력 데이터 | 표시 내용 |
|------------|----------|
| `title` | 역할 이름 (예: "Empath") |
| `message` | 전달 정보 텍스트 (예: "이웃 중 악 1명") |
| `players[]` | 관련 플레이어 PlayerChip 표시 (Washerwoman 등) |
| `onConfirm: fn()` | 확인 버튼 → 호스트 복귀 |

> 큰 글씨, 어두운 배경. 참가자가 읽기 쉽게. 확인 누르면 호스트 화면으로 복귀.

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

## 3. 호스트 화면 목록

### H-01 Setup (게임 설정)
**조립**: 입력 폼
**기능**: 스크립트 선택(현재 TB 고정), 인원 수 설정, 방 생성 버튼
**전환**: 완료 → H-02

---

### H-02 Lobby (대기실)
**조립**: `RoomCodeDisplay` + `PlayerGrid(selectable=false)` + 시작 버튼
**기능**: 방 코드 표시, 참가자 연결 확인, 인원 충족 시 시작 가능
**전환**: 시작 버튼 → H-03

---

### H-03 Grimoire (메인 상태판)
**조립**: `PhaseHeader` + `PlayerGrid` + 액션 버튼 그룹 + `NightOrderList`(밤만) + `LogEntry` 목록
**기능**: 전체 플레이어 상태 한눈에 확인, 페이즈 전환, 상태 수동 수정
**전환**: 밤 시작 → H-04 / 낮 시작 → H-06

```
┌─────────────────────────────┐
│  PhaseHeader (Night 2)      │
├─────────────────────────────┤
│  NightOrderList             │
│  ✓ Poisoner  ← current Monk │
│  □ Imp  □ Empath ...        │
├─────────────────────────────┤
│  PlayerGrid                 │
│  [1 Alice ●] [2 Bob ○] ...  │
├─────────────────────────────┤
│  [다음 역할] [낮으로]        │
└─────────────────────────────┘
```

---

### H-04 Night Action (밤 역할 처리)
한 역할씩 순서대로 처리. 아래 두 패널 중 해당 역할에 맞게 조립.

#### H-04a 정보 전달 역할 (Empath, FT, Undertaker 등)
**조립**: `InfoPanel` (전체화면)
**기능**: 계산된 정보 텍스트 + 관련 PlayerChip 표시 → 참가자에게 화면 돌려 보여줌
**전환**: 확인 → H-03 (다음 순서로)

#### H-04b 선택 역할 (Poisoner, Monk, Imp 등)
**조립**: `SelectPanel` (전체화면)
**기능**: 참가자가 대상 탭 → 확인 → 호스트 내부 기록
**전환**: 확인 → H-03 (다음 순서로)

---

### H-05 Night Result (밤 결과 처리) — 내부 처리
**화면 없음.** Grimoire에서 자동 계산.
- Monk vs Imp 충돌 판정
- 사망자 확정
- Scarlet Woman 승계 체크
- 로그 기록

---

### H-06 Day Flow (낮 진행)
**조립**: `PhaseHeader` + `PlayerGrid` + `VoteBar` + 처형 확정 버튼
**기능**: 지목 등록(이름 탭), 투표 수 입력, 처형 처리, 특수 능력 트리거(Virgin·Slayer·Saint)
**전환**: 밤으로 → H-04 / 승리 조건 충족 → H-07

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

---

### H-07 Victory (게임 종료)
**조립**: 결과 배너 + `PlayerGrid(전체 역할 공개)`
**기능**: 선/악 승리 선언, 전체 역할 공개, 로그 요약
**전환**: 새 게임 → H-01

---

## 4. 참가자 화면 목록

### P-01 Join (방 참가)
**조립**: 닉네임 입력 + 방 코드 입력 + 참가 버튼
**기능**: URL 파라미터 `?code=` 자동 감지 (기존 구현 유지)
**전환**: 참가 완료 → P-02

---

### P-02 Waiting (대기)
**조립**: 방 코드 표시 + 연결 상태 배지 + 참가자 수
**기능**: 호스트가 게임 시작할 때까지 대기
**전환**: `PHASE_CHANGE` 수신 → P-03

---

### P-03 Role Card (내 역할 카드)
**조립**: `RoleCard(compact=false)` + 탭 네비게이션
**기능**: 본인 역할 이름·팀·능력 상시 확인. 낮 동안 탭으로 언제든 열람.
**탭 이동**: PlayerTracker / Memo / RoleCard / 캐릭터사전

---

### P-04 Player Tracker (플레이어 추적)
**조립**: `PhaseHeader` + `PlayerGrid` + 플레이어별 주석 입력
**기능**:
- 각 플레이어 칩 탭 → 상세 편집 열림
- 주장 역할 기록 (예: "자신이 Fortune Teller라고 함")
- 의심 기록 (예: "Imp 의심")
- 생존/사망 상태 표기 (참고용. 정본은 호스트)

```
┌─────────────────────────────┐
│  PhaseHeader (Day 2)  생존7 │
├─────────────────────────────┤
│  [1 Alice ●] 주장: FT       │
│  [2 Bob ○]   의심: Imp ★    │
│  [3 Carol ●] 메모 없음      │
│  ...                        │
└─────────────────────────────┘
```

---

### P-05 Emoji Panel (이모지 시그널)
**조립**: `PlayerGrid(수신 대상 선택)` + `EmojiPicker`
**기능**:
1. 수신 대상 선택 (특정 1명 or 전체)
2. 이모지 탭 → p2p `EMOJI` 전송
3. 수신 시 `EmojiPopup` 3초 표시

---

### P-06 Memo (메모장)
**조립**: 자유 텍스트 입력 영역
**기능**: 개인 추리 메모. 로컬 저장(localStorage). P2P 전송 없음.

---

### P-07 Character Dict (캐릭터 사전)
**조립**: `RoleCard(compact=false)` 목록
**기능**: 이번 스크립트 전체 역할 설명 참고. 정적 데이터.

---

## 5. 화면 전환 흐름

### 호스트 흐름
```
H-01 Setup
  → H-02 Lobby (방 생성)
    → H-03 Grimoire (게임 시작)
      → H-04 Night Action (밤 시작할 때마다)
        → H-03 Grimoire (각 역할 처리 완료)
      → H-06 Day Flow (낮 시작할 때마다)
        → H-03 Grimoire (낮 종료)
      → H-07 Victory (승리 조건 충족)
```

### 참가자 흐름
```
P-01 Join
  → P-02 Waiting
    → P-03 Role Card (게임 시작 수신)
      ↔ P-04 Player Tracker (탭 이동)
      ↔ P-05 Emoji Panel    (탭 이동)
      ↔ P-06 Memo           (탭 이동)
      ↔ P-07 Character Dict (탭 이동)
    → (게임 종료 수신) 역할 공개 화면
```

---

## 6. P2P 메시지 타입 정의

기존 `p2p.js` `messageTypeMap`에 추가할 타입.

| 논리 타입 | 단축 (12B↓) | 방향 | 페이로드 |
|-----------|-------------|------|----------|
| `GAME_START` | `GAME_ST` | Host→All | `{ players[], script }` |
| `PHASE_CHANGE` | `PHASE` | Host→All | `{ phase, round }` |
| `ROLE_ASSIGN` | `ROLE_ASSIGN` | Host→1 | `{ role, team }` |
| `NIGHT_INFO` | `NIGHT_INFO` | Host→1 | `{ title, message, players[] }` |
| `PLAYER_DIED` | `DIED` | Host→All | `{ playerId, cause }` |
| `VOTE_UPDATE` | `VOTE_UPD` | Host→All | `{ targetId, votes, threshold }` |
| `GAME_END` | `GAME_END` | Host→All | `{ winner, roles[] }` |
| `EMOJI` | `EMOJI` | Player→Player | `{ fromId, emoji }` |

---

## 7. 파일 구조 (목표)

```
src/
├── index.html          # 메인 (Host/Player 선택)
├── host.html           # 호스트 앱 진입점
├── player.html         # 참가자 앱 진입점
├── js/
│   ├── p2p.js          # P2P 통신 (기존)
│   ├── data/
│   │   └── roles-tb.js # Trouble Brewing 역할 정적 데이터
│   ├── components/     # 컴포넌트 (C-01 ~ C-11)
│   │   ├── PlayerChip.js
│   │   ├── RoleCard.js
│   │   ├── PlayerGrid.js
│   │   ├── PhaseHeader.js
│   │   ├── InfoPanel.js
│   │   ├── SelectPanel.js
│   │   ├── VoteBar.js
│   │   ├── EmojiPicker.js
│   │   ├── EmojiPopup.js
│   │   ├── NightOrderList.js
│   │   └── LogEntry.js
│   ├── host/           # 호스트 화면 (H-01 ~ H-07)
│   │   ├── Setup.js
│   │   ├── Lobby.js
│   │   ├── Grimoire.js
│   │   ├── NightAction.js
│   │   ├── DayFlow.js
│   │   └── Victory.js
│   └── player/         # 참가자 화면 (P-01 ~ P-07)
│       ├── Join.js
│       ├── Waiting.js
│       ├── RoleCard.js
│       ├── PlayerTracker.js
│       ├── EmojiPanel.js
│       ├── Memo.js
│       └── CharacterDict.js
└── asset/
    └── favicon.svg
```
