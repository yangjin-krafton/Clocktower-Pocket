# Clocktower Pocket — UI/UX 설계서 v3

기준 스크립트: **Trouble Brewing**
기술 스택: Vanilla JS · Trystero (WebRTC P2P) · localStorage
배포 방식: **정적 웹앱** (서버 불필요, 오프라인 완전 동작)

---

## 앱 철학

> **Clocktower Pocket은 Blood on the Clocktower 보드게임의 물리적 보조 도구다.**
>
> 서버·계정·인터넷 없이도 완전히 동작한다.
> P2P는 편의 기능(자동 알림·역할 배분)이지, 필수 조건이 아니다.
> 핸드폰만 있으면 물리 게임을 더 쉽고 정확하게 진행할 수 있다.

### 두 가지 사용 모드

| 모드 | 역할 | 핵심 기능 |
|------|------|-----------|
| **호스트 (스토리텔러)** | 게임 진행·관리 | 그리모어 상태판, 밤 순서 진행, 투표 집계 |
| **참가자 (플레이어)** | 게임 참여 | 내 역할 확인, 상황별 규칙 가이드, 메모 |

### P2P 연결 없이도 동작하는 기능

- 호스트: 그리모어 단독 운용 (참가자 P2P 없이 완전한 게임 관리)
- 참가자: 역할 카드·규칙 가이드·메모·캐릭터 사전 (방 참가 없이도 열람)

---

## 1. 로컬 캐시 모델 (localStorage)

```
ctp_user      — 유저 프로필
ctp_rooms     — 최근 방 목록 (최대 5개)
ctp_history   — 게임 기록 (최대 20개)
```

### UserProfile `ctp_user`
```js
{
  id:        string,   // nanoid (기기 고유 식별자)
  name:      string,   // 닉네임 (최대 12자)
  emoji:     string,   // 대표 이모지 (예: "🦇")
  createdAt: number,
  updatedAt: number
}
```

### RecentRooms `ctp_rooms`
```js
[{ code, role: 'host'|'player', playerNames: string[], playedAt }]
```

### GameHistory `ctp_history`
```js
[{
  id, roomCode, role: 'host'|'player',
  myRole: string|null,   // 참가자만
  winner: 'good'|'evil'|null,
  players: string[], rounds: number, playedAt
}]
```

---

## 2. 게임 데이터 모델

### Player
```js
{
  id:           number,              // 좌석 번호 (1~N)
  peerId:       string|null,         // P2P 연결 시에만
  name:         string,
  emoji:        string,
  role:         string,              // role ID
  team:         'good'|'evil',
  status:       'alive'|'dead'|'executed',
  isPoisoned:   boolean,
  isDrunk:      boolean,
  deadVoteUsed: boolean,
  registeredAs: string|null          // 호스트 전용 (Spy/Recluse 왜곡)
}
```

### Role
```js
{
  id:          string,
  name:        string,
  team:        'townsfolk'|'outsider'|'minion'|'demon',
  ability:     string,               // 능력 요약 (1줄)
  abilityFull: string,               // 능력 상세
  firstNight:  boolean,
  otherNights: boolean,
  // 규칙 가이드 데이터 (참가자용)
  guide: {
    whatYouKnow:   string,   // 게임 시작 시 아는 것
    whatYouDo:     string,   // 밤에 하는 행동
    tips:          string[], // 이 역할 플레이 팁
    doNotReveal:   boolean,  // 공개하면 안 되는 역할 여부
    interactsWith: string[], // 상호작용 있는 역할 ID 목록
  }
}
```

### GameState
```js
{
  phase:            'lobby'|'day'|'night',
  round:            number,
  players:          Player[],
  nominations:      [{ nominatorId, targetId, votes: number }],
  executedToday:    number|null,
  nightOrder:       string[],
  currentNightStep: string|null
}
```

---

## 3. 규칙 가이드 시스템 (핵심 설계)

> 참가자가 가장 많이 쓰는 기능.
> **"지금 내가 알아야 할 것"만 골라서 보여준다.**

### 표시 계층 구조

```
전체 규칙 (언제나 열람 가능)
└── 팀 규칙 (내 팀 기준)
    └── 역할 규칙 (내 역할 기준)
        └── 현재 페이즈 가이드 (밤/낮 상황별)
```

### 규칙 가이드 콘텐츠 정의

#### Tier 1 — 역할 카드 (role card)
- 역할 이름 + 팀 색상
- 능력 1줄 요약
- **"내가 아는 것"**: 게임 시작 시 알려준 정보 설명
  - 예) Empath: "당신의 양쪽 이웃 중 악 진영이 몇 명인지 알고 있습니다"
  - 예) Imp: "당신의 미니언이 누구인지 알고 있습니다"

#### Tier 2 — 행동 가이드 (action guide)
- **밤 행동**: "오늘 밤 당신이 할 일"
  - 첫째 밤 여부 / 매 밤 여부
  - 행동 순서 (밤 순서에서 몇 번째)
  - 구체적 행동 설명
- **낮 행동**: 특수 능력 사용 조건 (Slayer, Virgin 등)

#### Tier 3 — 팀 가이드 (team guide)
- **선 팀 (good)**: "악마를 찾아 처형하세요"
  - 투표 방법, 지목 규칙
  - 죽은 뒤에도 투표권 1회 유지
- **악 팀 (evil)**: "생존자가 2~3명이 될 때까지 버티세요"
  - 미니언 → 악마 이름 알고 있음
  - 공개 발언에서 거짓말 가능
  - 선 팀인 척 행동 팁

#### Tier 4 — 전체 규칙 (full rules)
- 게임 흐름 전체 설명
- 밤 순서 원리
- 투표·처형 규칙
- 특수 상황 (동점, 성직자 처형 등)
- 스토리텔러 판정 규칙

### 선택적 표시 로직

```
참가자가 가이드 탭을 열면:
  1. 역할 배정 전 → Tier 4만 (전체 규칙)
  2. 역할 배정 후, 게임 전 → Tier 1 + Tier 3 + Tier 4
  3. 게임 중 (낮) → Tier 1 + Tier 2(낮 행동) + Tier 3 + Tier 4
  4. 게임 중 (밤, 내 역할 행동 없음) → Tier 1 + 대기 메시지 + Tier 4
  5. 게임 중 (밤, 내 역할 행동 있음) → Tier 2(밤 행동) 강조 + 나머지
```

### 악 팀 정보 격리 원칙

- 악 팀 플레이어에게만 팀원 목록 표시 (P2P로 수신 또는 호스트가 직접 보여줌)
- 가이드에서 "Imp는 미니언이 누구인지 압니다" → 내가 Imp이면 실제 이름 표시, 다른 역할이면 설명만
- 전체 규칙(Tier 4)은 팀 무관 동일하게 표시

---

## 4. 공통 컴포넌트

### C-01 `PlayerChip`
`name` `emoji` `status` `isPoisoned` `selectable` `selected`
재사용: Grimoire · SelectPanel · PlayerTracker · EmojiPanel

### C-02 `RoleCard`
`role` `compact: boolean`
compact=false 시 `abilityFull` + `guide.whatYouKnow` 포함

### C-03 `PlayerGrid`
`players[]` `selectable` `maxSelect` `onSelect`

### C-04 `PhaseHeader`
`phase` `round` `aliveCount`

### C-05 `InfoPanel` (호스트 전용)
전체화면. `title` `message` `players[]` `onConfirm`

### C-06 `SelectPanel` (호스트 전용)
전체화면. `title` `players[]` `maxSelect` `onConfirm`

### C-07 `VoteBar`
`targetName` `votes` `threshold` `isLeading`

### C-08 `EmojiPicker` (참가자 전용)
`players[]` `emojis[]` `onSend`

### C-09 `EmojiPopup`
`fromName` `emoji` — 3초 팝업

### C-10 `NightOrderList` (호스트 전용)
`nightOrder[]` `currentStep` `done[]`

### C-11 `LogEntry` (호스트 전용)
`round` `phase` `event` `timestamp`

### C-12 `EmojiSelector`
`options: string[]` `selected` `onSelect` — 프로필 이모지 팔레트

### C-13 `RecentRoomList`
`rooms[]` `onSelect` — 최근 방 빠른 입장

### C-14 `RuleSection` (신규 — 규칙 가이드용)
규칙 가이드 1개 섹션 블록.

| 입력 | 표시 |
|------|------|
| `tier: 1~4` | 색상 레벨 구분 |
| `title` | 섹션 제목 |
| `content: string \| string[]` | 본문 텍스트 또는 bullet |
| `highlight: boolean` | 지금 당장 해야 하는 행동 여부 강조 |
| `badge: string` | "지금 행동" / "낮에만" 등 상태 배지 |

### C-15 `GuideNav` (신규 — 규칙 가이드용)
가이드 내 탭 네비게이션.

| 탭 | 내용 |
|----|------|
| 내 역할 | Tier 1 역할 카드 상세 |
| 행동 | Tier 2 현재 페이즈 행동 가이드 |
| 팀 | Tier 3 팀 목표 + 팀원(악팀) |
| 전체 규칙 | Tier 4 게임 전체 규칙 |

---

## 5. 화면 목록

### ── 공통 진입 ──

#### S-00 Profile Setup (최초 1회)
`ctp_user` 없을 때 자동 진입.

```
┌─────────────────────────────┐
│  🏰  Clocktower Pocket      │
│  처음 오셨군요!              │
│                             │
│  대표 이모지를 고르세요      │
│  🦇 🐍 🌙 🔮 🗡️ 🩸 🌹 🕯️   │
│  🦉 🐉 🧙 👁️ ⚔️ 🌑 🌿 🎭   │
│                             │
│  선택됨: [ 🦇 ]             │
│                             │
│  닉네임 ________________    │
│           (최대 12자)       │
│                             │
│       [ 시작하기 ]          │
└─────────────────────────────┘
```

---

#### S-01 Landing (홈)
```
┌─────────────────────────────┐
│  🦇 Alice                ✎  │  ← 내 프로필 (탭 → 프로필 편집)
├─────────────────────────────┤
│  ┌──────────┐ ┌──────────┐  │
│  │  👑      │ │  🎮      │  │
│  │스토리텔러│ │ 참가자   │  │
│  │ 방 만들기│ │방 코드로 │  │
│  └──────────┘ └──────────┘  │
├─────────────────────────────┤
│  📖 규칙 보기               │  ← 로그인·방 참가 없이 규칙 열람
├─────────────────────────────┤
│  최근 방                    │
│  ABC123  host   2일 전      │
│  XYZ789  player 어제        │
└─────────────────────────────┘
```

> "📖 규칙 보기"는 역할 미배정 상태로 Tier 4 전체 규칙 열람.
> 방 참가 없이도 게임 규칙 예습 가능.

---

### ── 호스트 화면 ──

#### H-01 Setup (게임 설정)

```
┌─────────────────────────────┐
│  게임 설정                  │
│                             │
│  인원 수   [ 5 ─────── 15 ] │
│  현재: 8명                  │
│                             │
│  역할 구성 (자동 추천)       │
│  Townsfolk  ████░  5명      │
│  Outsider   ██░░░  1명      │
│  Minion     ██░░░  2명      │
│  Demon      █░░░░  1명      │
│                             │
│  [ 역할 수동 편집 ]          │
│                             │
│       [ 방 만들기 ]         │
└─────────────────────────────┘
```

**기능**:
- 인원 수에 따른 역할 구성 자동 추천 (TB 공식 비율)
- 역할 수동 편집: 역할 카드 목록에서 체크로 선택
- P2P 없이도 완전 동작 (오프라인 단독 진행 가능)

---

#### H-02 Lobby (대기실)

```
┌─────────────────────────────┐
│  방 코드                    │
│  ┌────────────────────┐     │
│  │   A B C - 1 2 3   │     │
│  └────────────────────┘     │
│  [ 복사 ]  [ QR ]  [ 공유 ] │
│                             │
│  참가자 (3 / 8)             │
│  🦇 Alice   ✓               │
│  🌙 Bob     ✓               │
│  🔮 Carol   ✓               │
│  · · · · · (5명 대기 중)    │
│                             │
│  [ 게임 시작 ] ← 8명 필요   │
└─────────────────────────────┘
```

**호스트 단독 모드**: 참가자 없이도 "오프라인 시작" 버튼으로 진행.
→ 각 플레이어 이름만 입력, 역할은 호스트가 직접 알림.

---

#### H-03 Grimoire (메인 상태판)

```
┌─────────────────────────────┐
│  🌙 Night 2    생존 6명     │
├─────────────────────────────┤
│  밤 순서                    │
│  ✓ Poisoner  ★ Monk  □ Imp │
├─────────────────────────────┤
│  [🦇Alice●] [🌙Bob ○] ...  │  ← 탭 → 플레이어 상세
│  [🔮Carol●] [🗡️Dave●] ...  │
├─────────────────────────────┤
│  [다음 역할▶]  [낮으로 ☀️]  │
└─────────────────────────────┘
```

**플레이어 탭 → 상세 팝업**:
- 상태 변경: alive / dead / executed
- isPoisoned / isDrunk 토글
- 역할 확인 (호스트만)

---

#### H-04 Night Action

**H-04a 정보 전달** (Empath·FT·Undertaker 등)
→ `InfoPanel` 전체화면. 계산된 정보 + 관련 플레이어 칩.
→ 화면을 해당 참가자에게 직접 보여줌.

**H-04b 대상 선택** (Poisoner·Monk·Imp 등)
→ `SelectPanel` 전체화면. 참가자가 직접 대상 탭.

---

#### H-05 Night Result — 화면 없음
Grimoire 내부 자동 계산 (Monk vs Imp 충돌·사망·로그).

---

#### H-06 Day Flow (낮 진행)

```
┌─────────────────────────────┐
│  ☀️ Day 2      생존 6명     │
├─────────────────────────────┤
│  [🦇Alice●] [🌙Bob ○] ...  │  ← 탭 → 지목 등록
├─────────────────────────────┤
│  지목: Bob                  │
│  VoteBar: 3표 / 필요 4표    │
│  [+1] [-1]  [처형 확정]     │
├─────────────────────────────┤
│  특수 능력                  │
│  [Slayer] [Virgin] [Saint]  │
├─────────────────────────────┤
│  [다음 밤 🌙]               │
└─────────────────────────────┘
```

---

#### H-07 Victory

```
┌─────────────────────────────┐
│  🏆 선 팀 승리!             │
│  악마 처형으로 게임 종료    │
│                             │
│  전체 역할 공개             │
│  🦇Alice — Empath (선)      │
│  🌙Bob   — Imp    (악) 💀   │
│  ...                        │
│                             │
│  [새 게임]  [홈으로]        │
└─────────────────────────────┘
```

결과 → `ctp_history` 저장.

---

#### H-08 Storyteller Guide (신규 — 호스트 전용 가이드)
호스트 탭 바 고정 메뉴.

| 섹션 | 내용 |
|------|------|
| 밤 순서 | 각 역할 처리 방법 + 예외 상황 |
| 역할별 판정 | 역할마다 어떻게 정보 계산하는지 |
| 특수 상황 | 처형 동점, Scarlet Woman 승계, Butler 투표 등 |
| 승리 조건 | Good·Evil 승리 조건 상세 |

---

### ── 참가자 화면 ──

#### P-01 Join (방 참가)

```
┌─────────────────────────────┐
│  🦇 Alice 로 참가합니다     │  ← 프로필 자동 사용
│                             │
│  방 코드                    │
│  [ A B C 1 2 3 ]            │
│                             │
│  [   🚪 참가하기   ]        │
│                             │
│  ──── 또는 ────             │
│  [ 📖 규칙만 보기 ]         │  ← 방 없이 가이드 열람
└─────────────────────────────┘
```

---

#### P-02 Waiting (대기)

```
┌─────────────────────────────┐
│  ABC123 방에 접속됨 ✓       │
│                             │
│  스토리텔러가 게임을        │
│  시작할 때까지 기다리세요   │
│                             │
│  참가자 4명 연결됨          │
│                             │
│  [ 📖 규칙 미리 보기 ]      │  ← 대기 중 가이드 열람
└─────────────────────────────┘
```

---

#### P-03 ~ P-07 게임 중 탭 화면

탭 바 구성:

| 탭 | 화면 | 우선순위 |
|----|------|----------|
| 🎭 역할 | P-03 Role Card | 기본 탭 |
| 📋 가이드 | P-08 Rule Guide | **핵심** |
| 👥 플레이어 | P-04 Player Tracker | |
| 💬 시그널 | P-05 Emoji Panel | |
| 📝 메모 | P-06 Memo | |
| 📖 사전 | P-07 Character Dict | |

---

#### P-03 Role Card

```
┌─────────────────────────────┐
│  당신의 역할                │
│                             │
│  ╔═══════════════════╗      │
│  ║  🔮  Empath       ║      │
│  ║  Townsfolk        ║      │
│  ╠═══════════════════╣      │
│  ║ 매 밤, 당신의 양쪽 이웃  ║ │
│  ║ 중 악 진영이 몇 명인지  ║ │
│  ║ 알게 됩니다.            ║ │
│  ╚═══════════════════╝      │
│                             │
│  [ 📋 행동 가이드 보기 ]    │
└─────────────────────────────┘
```

---

#### P-08 Rule Guide (핵심 신규 화면)

`GuideNav` 탭 + `RuleSection` 블록 조합.

**탭 1 — 내 역할**
```
┌─────────────────────────────┐
│  🎭 내 역할: Empath         │
│  Townsfolk · 선 팀          │
├─────────────────────────────┤
│  📌 내가 아는 것            │
│  게임 시작 시, 양쪽 이웃 중 │
│  악 진영 수를 알게 됩니다.  │
│  (현재 알고 있는 수: 호스트 │
│   화면을 통해 확인)         │
├─────────────────────────────┤
│  ⚠️ 중독·취함 상태일 때    │
│  받은 정보가 틀릴 수 있음   │
└─────────────────────────────┘
```

**탭 2 — 행동** (페이즈 연동)
```
┌─────────────────────────────┐
│  🌙 Night 2 — 지금 내 행동 │  ← 현재 밤이면 강조 표시
│                             │
│  ★ 오늘 밤 당신이 깨어납니다│
│                             │
│  스토리텔러가 손가락으로    │
│  현재 이웃 중 악 진영 수를  │
│  보여줍니다.                │
│                             │
│  눈을 감고 잠드세요.        │
├─────────────────────────────┤
│  ☀️ 낮에 할 수 있는 것     │
│  • 받은 정보 공유 가능      │
│  • 구체적 숫자까지 말해도 됨│
│  • 거짓말 하면 안 됨 (선팀) │
└─────────────────────────────┘
```

**탭 3 — 팀** (팀에 따라 다른 내용)

*선 팀 버전*
```
┌─────────────────────────────┐
│  🔵 선 팀 목표              │
│  악마를 찾아 낮에 처형하세요│
├─────────────────────────────┤
│  투표 & 지목 규칙           │
│  • 지목은 하루 1회만 가능   │
│  • 처형엔 생존자 과반 필요  │
│  • 죽어도 투표권 1회 남음   │
├─────────────────────────────┤
│  팁                         │
│  • 능력 정보를 공유하세요   │
│  • 일관성 없는 주장에 주목  │
│  • 악마는 선 팀인 척합니다  │
└─────────────────────────────┘
```

*악 팀 버전 (Imp 예시)*
```
┌─────────────────────────────┐
│  🔴 악 팀 목표              │
│  생존자가 2명이 될 때까지   │
│  버티세요                   │
├─────────────────────────────┤
│  당신의 팀원                │
│  🌙 Bob — Poisoner (미니언) │
│  🎩 Dave — Scarlet Woman    │
├─────────────────────────────┤
│  밤 행동                    │
│  • 매 밤 죽일 대상 1명 선택 │
│  • 자신을 선택하면 미니언으 │
│    로 악마 승계              │
├─────────────────────────────┤
│  낮 전략                    │
│  • 선 팀인 척 정보 제공 OK  │
│  • 과도한 침묵은 의심받음   │
│  • 미니언이 방어해 줄 것임  │
└─────────────────────────────┘
```

**탭 4 — 전체 규칙**
```
┌─────────────────────────────┐
│  📖 전체 규칙               │
│                             │
│  ▶ 게임 개요                │
│  ▶ 게임 흐름                │
│    · 첫째 밤 순서           │
│    · 이후 밤 순서           │
│    · 낮 진행                │
│    · 투표와 처형            │
│  ▶ 특수 상황                │
│    · 처형 동점              │
│    · 사망 효과              │
│    · Butler 투표 제한       │
│  ▶ 승리 조건                │
│    · 선 팀 승리             │
│    · 악 팀 승리             │
│    · 게임 종료 타이밍       │
│  ▶ Trouble Brewing 역할 목록│
└─────────────────────────────┘
```

---

#### P-04 Player Tracker

```
┌─────────────────────────────┐
│  ☀️ Day 2    생존 6명       │
├─────────────────────────────┤
│  [🦇Alice●] 주장: FT        │
│  [🌙Bob  ○] 의심: Imp ★    │
│  [🔮Carol●] 메모 없음  [+]  │
└─────────────────────────────┘
```

각 플레이어 탭 → 편집 슬라이드업:
- 주장 역할 기록 (자유 텍스트)
- 의심 레벨 (없음 / 약간 / 강함)
- 사망 마킹 (참고용)

---

#### P-05 Emoji Panel (시그널)

수신 대상 선택 + `EmojiPicker`. 수신 시 `EmojiPopup` 3초 표시.

---

#### P-06 Memo (메모장)

자유 텍스트. localStorage 자동 저장. 방·역할별로 분리 저장.

---

#### P-07 Character Dict (캐릭터 사전)

`RoleCard(compact=false)` 전체 목록. 팀별 필터. 검색.

---

## 6. 화면 전환 흐름

```
앱 진입
  ├── ctp_user 없음 ──→ S-00 Profile Setup
  │                           ↓ 저장
  └── ctp_user 있음 ──→ S-01 Landing
                              │
              ┌───────────────┼───────────────┐
              ↓               ↓               ↓
          호스트 선택      참가자 선택     규칙 보기
              │               │               ↓
           H-01 Setup      P-01 Join      Tier 4 전체 규칙
              ↓               ↓
           H-02 Lobby      P-02 Waiting
              ↓               ↓ GAME_START
           H-03 Grimoire   탭 화면 (P-03~08)
              ↓  ↕              ↕
           H-04 Night     P-08 Rule Guide
           H-06 Day          (Tier 1~4 선택 표시)
              ↓               ↓ GAME_END
           H-07 Victory   결과 화면
              ↓               ↓
           S-01 Landing   S-01 Landing
```

---

## 7. P2P 메시지 타입

| 타입 | 방향 | 페이로드 |
|------|------|----------|
| `JOIN_REQUEST` | Player→Host | `{ playerName, emoji }` |
| `JOIN_RESPONSE` | Host→Player | `{ ok, roomCode, playerName }` |
| `GAME_START` | Host→All | `{ players[], script }` |
| `PHASE_CHANGE` | Host→All | `{ phase, round }` |
| `ROLE_ASSIGN` | Host→1 | `{ playerId, role, team, teamInfo }` |
| `NIGHT_INFO` | Host→1 | `{ title, message, players[] }` |
| `PLAYER_DIED` | Host→All | `{ playerId, cause }` |
| `VOTE_UPDATE` | Host→All | `{ targetId, votes, threshold }` |
| `GAME_END` | Host→All | `{ winner, reason, roles[] }` |
| `EMOJI` | Player↔Player | `{ fromId, targetId, emoji }` |

> P2P 없이 오프라인 모드에서는 호스트가 직접 화면을 보여주는 방식으로 동일 정보 전달.

---

## 8. 파일 구조

```
src/
├── index.html
├── css/
│   └── theme.css
├── js/
│   ├── app.js                    # 진입점: 프로필 확인 → Landing
│   ├── store.js                  # localStorage 헬퍼
│   ├── p2p.js
│   ├── game-engine.js
│   ├── data/
│   │   ├── roles-tb.js           # 역할 정적 데이터 (guide 필드 포함)
│   │   └── rules-tb.js           # 전체 규칙 텍스트 (신규)
│   ├── components/
│   │   ├── PlayerChip.js         # C-01
│   │   ├── RoleCard.js           # C-02
│   │   ├── PlayerGrid.js         # C-03
│   │   ├── PhaseHeader.js        # C-04
│   │   ├── InfoPanel.js          # C-05
│   │   ├── SelectPanel.js        # C-06
│   │   ├── VoteBar.js            # C-07
│   │   ├── EmojiPicker.js        # C-08
│   │   ├── EmojiPopup.js         # C-09
│   │   ├── NightOrderList.js     # C-10
│   │   ├── LogEntry.js           # C-11
│   │   ├── EmojiSelector.js      # C-12
│   │   ├── RecentRoomList.js     # C-13
│   │   ├── RuleSection.js        # C-14 신규
│   │   └── GuideNav.js           # C-15 신규
│   ├── screens/
│   │   ├── ProfileSetup.js       # S-00
│   │   └── Landing.js            # S-01
│   ├── host/
│   │   ├── app.js
│   │   ├── Setup.js              # H-01
│   │   ├── Lobby.js              # H-02
│   │   ├── Grimoire.js           # H-03
│   │   ├── NightAction.js        # H-04
│   │   ├── DayFlow.js            # H-06
│   │   ├── Victory.js            # H-07
│   │   └── StorytelllerGuide.js  # H-08 신규
│   └── player/
│       ├── app.js
│       ├── Join.js               # P-01
│       ├── Waiting.js            # P-02
│       ├── RoleCardScreen.js     # P-03
│       ├── RuleGuide.js          # P-08 신규 (핵심)
│       ├── PlayerTracker.js      # P-04
│       ├── EmojiPanel.js         # P-05
│       ├── Memo.js               # P-06
│       └── CharacterDict.js      # P-07
└── asset/
    └── favicon.svg
```
