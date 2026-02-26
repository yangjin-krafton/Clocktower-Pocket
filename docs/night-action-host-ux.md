# 밤 행동 호스트 UX — 단계 분리 + 오발 지목 선택 설계

> **목표 A**: 호스트 조작 단계와 참가자 공개 단계를 명확히 분리하여,
> 호스트가 핸드폰을 참가자에게 보여주는 순간을 전용 화면으로 처리한다.
>
> **목표 B**: 참가자가 대상을 지목할 때, 역할을 모르는 상태에서 자리 위치로
> 선택할 수 있도록 SelectPanel을 오발(타원형) 좌석 배치 UI로 리뉴얼한다.
>
> **목표 C**: 게임 중 참가자는 좌석 번호로만 서로를 식별한다.
> **앱 전체(호스트·참가자 화면 모두)** 에서 이름을 제거하고
> 좌석 번호를 크고 명확하게 강조 표시한다.

---

## 0. 핵심 설계 원칙: 앱 전체 = 번호만

**참가자는 자리 번호로만 식별한다. 이름은 앱 어디에도 표시하지 않는다.**

| 화면 유형 | 이름 표시 | 번호 표시 | 역할 아이콘 |
|---|---|---|---|
| **InfoPanel** (호스트 전용) | ❌ 없음 | ✅ **있음** | ✅ 있음 |
| **RevealPanel** (참가자 공개) | ❌ 없음 | ✅ **크게** | ❌ 없음 |
| **OvalSelectPanel** (참가자 지목) | ❌ 없음 | ✅ **크게** | ❌ 없음 |
| **PlayerChip** (공용 칩) | ❌ 없음 | ✅ 있음 | ✅ 있음 |
| **PlayerGrid** (게임 중 링) | ❌ 없음 | ✅ 있음 | ✅ 있음 |
| **Grimoire detail popup** | ❌ 없음 | ✅ 있음 | ✅ 있음 |
| **PreGame / Lobby 리스트** | ❌ 없음 | ✅ 있음 | — |
| **Victory 결과 화면** | ❌ 없음 | ✅ 있음 | ✅ 있음 |
| **PlayerTracker** (참가자 메모) | ❌ 없음 | ✅ 있음 | — |
| **Waiting SVG 휠** | ❌ 없음 | ✅ 있음 | — |

**이유**: 참가자는 현실 테이블에서도 자리 위치로 소통.
앱이 현실 플로우를 방해하지 않도록 번호 체계를 앱 전체에 일관되게 유지.

### 변경 대상 파일 전체 목록

| 파일 | 현재 | 변경 |
|---|---|---|
| `components/PlayerChip.js:88` | `nameEl.textContent = player.name` | `${player.id}번` 으로 교체 또는 이름 요소 제거 |
| `components/SelectPanel.js:111` | `nameDiv.textContent = p.name` | `${p.id}번` |
| `components/InfoPanel.js:70-78` | PlayerChip 통해 이름 노출 | PlayerChip 변경으로 자동 해결 |
| `host/NightAction.js:54,55,74,90,124` | `p.name` 사용 메시지 | `${p.id}번` 대체 |
| `host/Grimoire.js:592` | `${player.name} (${player.id}번)` | `${player.id}번 자리` |
| `host/Lobby.js:73` | 이름 입력 필드 표시 | 번호만 표시 |
| `host/PreGame.js:65` | `${p.name}` | `${p.seatNum}번` |
| `host/app.js:543` | `${player.name} (${player.id}번 자리)` | `${player.id}번 자리` |
| `host/Victory.js:94` | `nameSpan.textContent = p.name` | `${p.id}번` |
| `player/Waiting.js:49,53,65` | SVG 이름 텍스트, 헤더 이름 | 번호로 교체 |
| `player/PlayerTracker.js:54,84` | 트래커 이름, 메모 제목 | 번호로 교체 |

---

## 1. 문제 정의

### 현재 흐름

```
호스트 "▶ 다음 단계" 클릭
  ↓
InfoPanel / SelectPanel 표시
  ↓ (단일 화면, 호스트와 참가자 구분 없음)
"✅ 확인" 클릭 → 다음 스텝
```

### 문제점

| 상황 | 문제 |
|---|---|
| 정보 전달 역할 (공감인, 요리사 등) | 호스트가 결과를 먼저 보고 → 핸드폰을 참가자에게 돌려야 하는데 화면이 그대로 |
| 미니언/데몬 초기 정보 | 보여주는 대상이 다름에도 화면 전환 없음 |
| "✅ 확인" 버튼 | 참가자도 누를 수 있는 위치 — 의도치 않은 진행 위험 |

---

## 2. 새 흐름: 3단계 분리

```
[호스트 단계]  PrivateStep  — 호스트 혼자 보는 정보 (계산 결과, 조작 옵션)
      ↓  "참가자에게 공개 →" 버튼 클릭
[공개 단계]   RevealPanel  — 참가자에게 보여주는 최소 화면 (크고 단순)
      ↓  하단 "[호스트] 다음 →" 탭
[다음 스텝]  processCurrentStep()
```

### 역할 유형별 적용

| 유형 | 호스트 단계 | 공개 단계 | 비고 |
|---|---|---|---|
| `minion-info` | 호스트: 미니언 + 데몬 목록 확인 | 미니언들에게: 데몬 N번 + 블러프 | — |
| `demon-info` | 호스트: 미니언 목록 확인 | 데몬에게: 미니언 N번 + 블러프 | — |
| `spy` | 호스트: 그리모어 전체 확인 | 스파이에게: 전체 목록 | — |
| info 역할 (공감인 등) | 호스트: 계산 결과 확인 | 해당 역할 플레이어에게: 결과값만 | — |
| select 역할 (수도사 등) | 없음 (SelectPanel 이 곧 공개 단계) | SelectPanel = 참가자가 직접 탭 | 기존 유지 |
| 점쟁이 결과 | 없음 (SelectPanel 에서 선택) | 결과 InfoPanel → 공개 단계 추가 | — |

---

## 3. RevealPanel 컴포넌트 설계

### 화면 구성 (Wireframe)

```
┌──────────────────────────────────────┐
│  👁 참가자 화면           [작은 힌트] │  ← 12px, text4 색상 (거의 안 보임)
│─────────────────────────────────────│
│                                      │
│                                      │
│              [역할 아이콘]            │
│               5rem / 80px            │
│                                      │
│           [역할 이름 2rem]            │  ← 진영 색상 적용
│                                      │
│   ┌──────────────────────────────┐   │
│   │                              │   │
│   │     [정보 메시지 1.6rem]      │   │  ← 큰 글씨, 중앙 정렬
│   │                              │   │
│   └──────────────────────────────┘   │
│                                      │
│   [관련 플레이어 칩 — 번호만 크게]    │  ← 이름 없음
│                                      │
│                                      │
│                                      │
│  ┌──────────────────────────────┐    │
│  │   [호스트] 다음 →             │    │  ← 하단 고정, 작지 않지만 참가자용 아님
│  └──────────────────────────────┘    │
└──────────────────────────────────────┘
```

### 핵심 설계 원칙

1. **정보 요소만** — 역할명, 아이콘, 정보 메시지, 관련 플레이어만 표시
2. **글씨 크게** — 메시지 `1.6rem` (기존 InfoPanel 대비 +0.45rem)
3. **배경 어둡게** — `--bg` 단색 + 팀 색상 glow (radial-gradient)
4. **"다음" 버튼 하단 고정** — `[호스트] 다음 →` 레이블로 호스트 전용임을 표시
5. **조작 요소 제거** — 닫기 버튼, 뒤로가기 없음. 오직 "다음" 하나
6. **플레이어 칩 = 번호만** — 이름 제거, 역할 아이콘 제거. 번호 크게 강조

### 컴포넌트 인터페이스

```js
/**
 * RevealPanel — 참가자 공개 전용 화면
 * @param {Object} data
 *   roleIcon   {string}    역할 아이콘 (emoji or PNG)
 *   roleName   {string}    역할명
 *   roleTeam   {string}    진영 ('town'|'outside'|'minion'|'demon'|null)
 *   message    {string}    참가자에게 보여줄 정보 텍스트
 *   players    {Object[]}  관련 플레이어 — { id } 만 사용 (번호만 표시, 이름 없음)
 *   onNext     {Function}  "[호스트] 다음 →" 버튼 콜백
 */
mountRevealPanel(data) → unmountFn
```

---

## 4. InfoPanel 수정 — "공개" 버튼 추가

현재 InfoPanel 확인 버튼: `✅ 확인` → 즉시 다음 스텝

### 변경

```
[현재]
  ┌─────────────────────────┐
  │       ✅ 확인            │  → 다음 스텝
  └─────────────────────────┘

[변경 후]
  ┌─────────────────────────┐
  │   👁 참가자에게 공개 →   │  → RevealPanel 열림
  └─────────────────────────┘
  (선택적) 작은 링크: "공개 없이 넘기기" → 바로 다음 스텝
```

### 데이터 흐름

```js
mountInfoPanel({
  title, roleIcon, message, players,
  revealData: {           // NEW — RevealPanel 에 넘길 데이터
    roleIcon, roleName, roleTeam, message, players
  },
  onConfirm               // RevealPanel → "다음" → 호출
})
```

`revealData` 가 없으면 기존처럼 `✅ 확인` 버튼만 표시 (하위 호환).

---

## 5. SelectPanel — 변경 없음

SelectPanel 은 이미 참가자가 직접 조작하는 공개 화면이므로 변경 불필요.

단, 호스트가 SelectPanel 을 열기 **직전**에 별도의 안내 화면이 필요한 경우:
```
[추후 고려] "수도사가 눈 뜹니다" 안내 RevealPanel (message 없이 아이콘+역할명만)
            → "공개 →" → SelectPanel 오픈
```
현재 범위에선 제외.

---

## 6. RevealPanel 플레이어 칩 — 번호만

참가자 공개 화면에서는 이름·역할 아이콘을 모두 제거하고 **자리 번호만** 크게 표시.

```
[변경 전 — 기존 PlayerChip]     [변경 후 — 모든 화면 통일]
┌──────────────┐                ┌────────┐
│ 🔮 점쟁이   │                │        │
│ 이름: 김철수 │       →        │   3    │  ← 번호만, 크게
│ 자리: 3번    │                │   번   │
└──────────────┘                └────────┘
  (호스트/참가자 무관)             (호스트/참가자 모두 동일)
```

> **호스트 화면도 동일** — InfoPanel·Grimoire·Victory 등 모든 칩이 번호만 표시.
> "이름: 김철수" 형태는 앱 어디에도 남지 않는다.

칩 스타일:
- 번호(숫자): `1.8rem`, bold, `--gold2` 색상
- "번" 텍스트: `0.72rem`, `--text3`
- 배경: `--surface`, 테두리: `--lead2`, border-radius: 50% (원형)
- 크기: 56×56px 고정

이유:
1. 이름보다 번호가 현실 좌석 배치와 직결
2. 번호를 크게 표시해야 화면을 잠깐 보는 상황에서도 즉시 파악
3. 호스트/참가자 화면 일관성 — 동일한 식별 체계

---

## 7. 역할별 공개 내용 정의

| 역할 | 공개 대상 | 메시지 (번호 기반) | 칩 표시 |
|---|---|---|---|
| minion-info | 미니언 전원 | `데몬: 3번 / 동료: 1번, 2번 / 블러프: …` | 번호 칩 |
| demon-info | 데몬 | `미니언: 1번, 2번 / 블러프: …` | 번호 칩 |
| spy | 스파이 | `1번: [역할] (선/악) …` (번호 + 역할만) | 없음 |
| empath | 공감인 | `양옆 악 플레이어: N명` | 없음 |
| chef | 요리사 | `이웃한 악 쌍: N쌍` | 없음 |
| undertaker | 장의사 | `처형: 3번 → [역할명]` | 번호 칩 1개 |
| washerwoman | 세탁부 | `이 중 한 명이 [역할]` | 번호 칩 2개 |
| librarian | 사서 | `이 중 한 명이 아웃사이더` | 번호 칩 2개 |
| investigator | 조사관 | `이 중 한 명이 미니언` | 번호 칩 2개 |
| fortuneteller | 점쟁이 | `✅ 예 / ❌ 아니오` | 번호 칩 2개 |

> **공통 원칙**: 모든 RevealPanel 메시지/칩에서 이름 제거, `N번` 표기 사용

---

## 8. 구현 명세

### 8-1. 신규 파일: `src/js/components/RevealPanel.js`

```
역할
  - mountRevealPanel(data) 함수 export
  - 전체화면 오버레이 (z-index: 210 — InfoPanel 위)
  - 데이터: roleIcon, roleName, roleTeam, message, players, onNext

스타일 (임베드)
  .reveal-overlay   position:fixed, inset:0, bg:--bg, z-index:210
  .reveal-panel     flex-col, align-center, justify-center, h:100%, gap:24px
  .reveal__label    상단 힌트 "👁 참가자 화면" 0.68rem text4
  .reveal__icon     5rem, drop-shadow gold glow
  .reveal__name     2rem serif, 진영 색상
  .reveal__msg      1.6rem, center, surface bg, border-radius:16px, padding:20px 24px
  .reveal__players  flex, gap:12px, center, 번호 원형 칩 (56px, 1.8rem)
  .reveal__next     하단 고정, "[ 호스트 ] 다음 →", btn-primary, min-height:56px
```

### 8-2. `NightAction.js` 수정

각 `mountInfoPanel()` 호출에 `revealData` 추가:

```js
// 예: _showMinionInfo
this._unmount = mountInfoPanel({
  title: '미니언 공개',
  roleIcon: '🎭',
  message: `...`,
  players: [...],
  revealData: {                          // ← 추가
    roleIcon: '🎭',
    roleName: '미니언 공개',
    roleTeam: 'minion',
    // 메시지: 이름 대신 번호 사용
    message: `데몬: ${demonPlayers.map(p=>`${p.id}번`).join(', ')}\n블러프: ${bluffText}`,
    players: minions.map(p => ({ id: p.id })),   // id(번호)만, 이름 제외
  },
  onConfirm: () => this._done('minion-info'),
})
```

### 8-3. `InfoPanel.js` 수정

```js
// revealData 있으면 "참가자에게 공개 →" 버튼, 없으면 "✅ 확인"
if (data.revealData) {
  confirmBtn.textContent = '👁 참가자에게 공개 →'
  confirmBtn.addEventListener('click', () => {
    overlay.remove()
    mountRevealPanel({
      ...data.revealData,
      onNext: () => data.onConfirm?.()
    })
  })
} else {
  confirmBtn.textContent = '✅ 확인'
  confirmBtn.addEventListener('click', () => {
    overlay.remove()
    data.onConfirm?.()
  })
}
```

---

## 9. 구현 순서

```
Step 1  RevealPanel.js 신규 작성
        - mountRevealPanel(data) 구현
        - 스타일 임베드
        - 플레이어 칩: 번호만 표시 (이름 없음)

Step 2  InfoPanel.js 수정
        - revealData 파라미터 처리
        - 확인 버튼 분기 로직

Step 3  NightAction.js 수정
        - 각 mountInfoPanel() 호출에 revealData 추가
        - 역할: minion-info, demon-info, spy, info 역할 전체, fortuneteller 결과

Step 4  OvalSelectPanel.js 신규 작성 (섹션 11 참조)
        - 오발 좌석 배치 렌더링
        - 자리번호만 표시 (이름 없음, 역할 아이콘 없음)
        - 선택 상태, 선택 불가 상태, 본인 슬롯 강조

Step 5  SelectPanel.js → OvalSelectPanel 교체 (NightAction.js)
        - mountSelectPanel → mountOvalSelectPanel

Step 6  검증
        - 각 역할 스텝 진행 → InfoPanel → RevealPanel → 다음 스텝 연결 확인
        - revealData 없는 InfoPanel 호출 — 기존 동작 유지 확인
        - OvalSelectPanel 선택 → 확인 → 기존 onConfirm 콜백 유지
```

---

## 10. 검증 체크리스트

- [ ] 미니언/데몬 초기 정보 — InfoPanel → RevealPanel → 다음 스텝 순서 정상
- [ ] 공감인/요리사 — 숫자 정보 크게 표시
- [ ] RevealPanel 칩 — 번호만(원형), 이름/역할 없음 확인
- [ ] RevealPanel 메시지 — "N번" 표기 사용 (이름 없음) 확인
- [ ] 세탁부/사서/조사관 — 칩에 번호만 표시, 역할 정보 숨김 확인
- [ ] 점쟁이 결과 — "예/아니오" 후 RevealPanel, 이후 다음 스텝
- [ ] revealData 없는 호출 (기존 코드) — `✅ 확인` 버튼 그대로
- [ ] RevealPanel z-index(210) — InfoPanel(200) 위에 렌더링
- [ ] 뒤로가기/닫기 없음 — "다음" 버튼만으로만 진행 가능
- [ ] OvalSelectPanel — 플레이어 수 5~20명 레이아웃 정상
- [ ] OvalSelectPanel — 자리번호만 크게 표시, 이름/아이콘 없음
- [ ] OvalSelectPanel — selfSeatId 슬롯이 항상 하단 중앙(6시)에 위치
- [ ] OvalSelectPanel — selfSeatId=1 ~ N 각각 회전 정상 (특히 첫번째/마지막 자리)
- [ ] OvalSelectPanel — 본인 슬롯: "나" 레이블 표시, gold border, 클릭 불가
- [ ] OvalSelectPanel — maxSelect=1 (수도사), maxSelect=2 (점쟁이) 동작
- [ ] OvalSelectPanel — 사망자 선택 불가 (fortuneteller 제외) dim 처리

---

## 11. OvalSelectPanel — 오발 지목 선택 UI 리뉴얼

### 11-1. 배경: 현재 SelectPanel의 문제

```
현재 SelectPanel (그리드)
┌────────────────────────────────────────┐
│ [역할아이콘] 수도사    대상을 선택하세요│
│────────────────────────────────────────│
│ 선택: 0 / 1                            │
│ ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐  │
│ │ 🔮  │ │  ?   │ │  ?   │ │  ?   │  │  ← 역할 아이콘이 보임
│ │ 김철수│ │ 이영희│ │ 박민준│ │ 정수아│  │     (참가자는 모름)
│ │ 1번  │ │ 2번  │ │ 3번  │ │ 4번  │  │
│ └──────┘ └──────┘ └──────┘ └──────┘  │
└────────────────────────────────────────┘
```

**문제**: 역할 아이콘이 보여 신분 노출 위험 / 그리드는 실제 자리 배치와 무관

---

### 11-2. 새 설계: OvalSelectPanel

#### 예시 — 8인, 본인이 3번 자리인 경우

```
┌──────────────────────────────────────────────┐
│  [역할아이콘 2.2rem]  수도사                  │
│  대상을 탭해 선택하세요                       │
│──────────────────────────────────────────────│
│                                              │
│              ⑦                              │  ← 맞은편 (7번)
│         ⑥       ①                          │
│                                              │
│       ⑤             ②                      │
│                                              │
│         ④       [선택: 0/1]                  │
│                                              │
│              ③  ← 나 (3번, 하단 중앙)       │  ← 본인 자리 강조
│──────────────────────────────────────────────│
│       [ ✅ 확인 (비활성 → 선택 후 활성) ]    │
└──────────────────────────────────────────────┘
```

**핵심 1**: 본인 자리가 항상 하단 중앙 → 왼쪽/오른쪽/맞은편 즉각 파악
**핵심 2**: 오발이 참가자별로 회전 → 각자 자신 기준의 좌석 배치를 봄
**핵심 3**: 본인 슬롯은 별도 강조 (선택 불가, gold border + "나" 레이블)

---

### 11-3. 슬롯 설계

```
슬롯 상태별 표시 (번호만, 이름 없음)

[기본 / 선택 가능]        [선택됨]              [선택 불가 / 사망]
┌────────────┐           ┌────────────┐        ┌────────────┐
│            │           │     ✓      │        │            │
│     2      │     →     │     2      │        │     2      │  (opacity 0.3)
│    번      │           │    번      │        │    번      │  (dim, 클릭불가)
└────────────┘           └────────────┘        └────────────┘
 border: lead2            border: gold           border: lead2
 bg: surface              bg: gold rgba(0.1)     bg: surface2
                          box-shadow: gold glow
```

슬롯 상태 4종:

```
[기본]         [선택됨]       [사망/불가]    [본인 자리]
┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐
│          │  │    ✓     │  │          │  │   나     │  ← "나" 레이블
│    2     │  │    2     │  │    2     │  │    3     │  ← 항상 하단
│   번     │  │   번     │  │   번     │  │   번     │
└──────────┘  └──────────┘  └──────────┘  └──────────┘
border:lead2  border:gold   opacity:0.3   border:gold2
bg:surface    bg:gold 0.1   bg:surface2   bg:gold 0.05
              gold glow     클릭 불가     클릭 불가
```

슬롯 내부 구성:
- **"나" 레이블** — 본인 슬롯만, 상단 중앙, 0.58rem, `--gold` (선택 체크와 같은 위치)
- **선택 체크** — 선택 시에만, 상단 중앙, 0.7rem, gold
- **자리 번호(숫자)** — 중앙, **1.6rem bold**, `--gold2` 색상 (크게 강조)
- **"번" 텍스트** — 숫자 아래, 0.6rem, `--text4`
- 이름 **없음** / 역할 아이콘 **없음**

슬롯 크기: Grimoire 오발과 동일한 비율 계산 사용
```js
// 컨테이너 너비 기반 (app-content 실측)
const containerW = appContent.getBoundingClientRect().width - 32
const baseRatio = total <= 6 ? 0.20 : total <= 9 ? 0.18 : total <= 13 ? 0.16 : total <= 16 ? 0.14 : 0.12
const slotPx = Math.min(72, Math.max(36, Math.round(containerW * baseRatio)))
```

---

### 11-4. 중앙 패널

오발 중앙(`.oval-select__center`)에 선택 카운터와 안내 텍스트 배치:

```
[선택 전]              [선택 후]
  선택하세요              ✓ 3번
  0 / 1                  1 / 1
```

---

### 11-5. 컴포넌트 인터페이스

```js
/**
 * OvalSelectPanel — 오발 좌석 배치 대상 선택 패널
 * @param {Object} data
 *   title       {string}    역할명
 *   roleIcon    {string}    역할 아이콘
 *   roleTeam    {string}    진영 (색상 적용)
 *   players     {Object[]}  전체 플레이어 배열 (id, status 만 사용)
 *                           id = 자리번호(1-based), 배열 순서 = 자리 순서
 *   selfSeatId  {number}    현재 참가자의 자리번호 (1-based)
 *                           이 자리가 오발 하단 중앙(6시)에 위치
 *   maxSelect   {number}    최대 선택 수 (기본 1)
 *   onConfirm   {Function}  onConfirm(selectedIds[]) — 자리번호 배열
 */
mountOvalSelectPanel(data) → unmountFn
```

---

### 11-6. 오발 좌표 계산 — 참가자 기준 회전

#### 회전 원리

```
Grimoire 오발 (고정, 1번=12시)     OvalSelectPanel (회전, 본인=6시)

        ① (12시)                           ⑦ (12시 ← 1번과 다름)
    ⑧       ②                         ⑥       ①
  ⑦           ③                     ⑤           ②
    ⑥       ④                         ④       [중앙]
        ⑤ (6시)                            ③ ← 본인 (항상 6시)

  1번이 12시에 고정               selfSeatId(=3번)이 6시에 고정
```

#### 수식

```
목표: selfSeatId 를 6시(+π/2) 에 배치

selfIdx = selfSeatId - 1   (0-based 인덱스)

rotationOffset = π/2 − (2π × selfIdx / total)

각 슬롯 i 의 각도:
  angle(i) = (2π × i / total) + rotationOffset
           = 2π × (i − selfIdx) / total + π/2
```

#### 구현 코드

```js
const total     = players.length
const selfIdx   = selfSeatId - 1                              // 0-based
const RX = 43, RY = 43                                        // % of container

// 참가자 본인이 6시(하단 중앙)에 오도록 오프셋 계산
const rotOffset = Math.PI / 2 - (2 * Math.PI * selfIdx / total)

players.forEach((p, i) => {
  const angle = (2 * Math.PI * i) / total + rotOffset
  const x = 50 + RX * Math.cos(angle)   // % of width
  const y = 50 + RY * Math.sin(angle)   // % of height

  slot.style.left = `${x.toFixed(2)}%`
  slot.style.top  = `${y.toFixed(2)}%`
})
```

#### 검증 예시 — 8인, selfSeatId = 3

```
selfIdx = 2,  rotOffset = π/2 − (2π × 2/8) = π/2 − π/2 = 0

i=0 (1번): angle = 0       → (100%, 50%) 오른쪽
i=1 (2번): angle = π/4     → 우하
i=2 (3번): angle = π/2     → (50%, 100%) 하단 중앙 ✅ = 본인
i=3 (4번): angle = 3π/4    → 좌하
i=4 (5번): angle = π       → (0%, 50%) 왼쪽
...
i=6 (7번): angle = 3π/2    → (50%, 0%) 상단 = 맞은편 ✅
```

오발 컨테이너: `position: relative; width: 100%; aspect-ratio: 2/3`
슬롯: `position: absolute; transform: translate(-50%, -50%)`

> **Grimoire 오발과의 차이**: Grimoire는 `rotOffset = -π/2` 고정(1번=12시).
> OvalSelectPanel은 selfSeatId에 따라 rotOffset이 달라짐.

---

### 11-7. 화면 레이아웃 전체 구조

```
.oval-select-overlay    position:fixed, inset:0, bg:--bg, z-index:200
  .oval-select-panel    flex-col, h:100%, gap:10px, padding:20px 16px
    .oval-select__hdr   flex, align-center, gap:10px (아이콘 + 역할명 + 힌트)
    .oval-select__wrap  flex-center, flex:1 (오발 컨테이너를 감싸는 영역)
      .oval-select__oval    position:relative, width:100%, aspect-ratio:2/3
        .oval-select__slot  (각 플레이어, absolute 위치)
        .oval-select__center (중앙 카운터)
    .oval-select__confirm   btn-primary, 하단 고정, disabled until selected
```

---

### 11-8. NightAction.js — `selfSeatId` 전달

`_showRoleSelect` 에서 `actor.id` (역할 행동자의 자리번호)를 `selfSeatId`로 전달:

```js
_showRoleSelect(roleId, actors) {
  const actor = actors[0]
  // ...
  this._unmount = mountOvalSelectPanel({
    title:      role?.name || roleId,
    roleIcon:   role?.icon || '?',
    roleTeam:   role?.team || null,
    players:    selectablePlayers,
    selfSeatId: actor.id,           // ← 역할 수행자 자리번호 → 오발 하단 배치
    maxSelect:  role?.maxSelect || 1,
    onConfirm:  (ids) => { ... }
  })
}
```

### 11-9. SelectPanel 교체 범위

| 변경 위치 | 내용 |
|---|---|
| `NightAction.js` | `mountSelectPanel` import 제거, `mountOvalSelectPanel` import 추가 후 호출 교체 |
| `SelectPanel.js` | **변경 없음** — 다른 곳에서 사용 가능성 대비 유지 |
| `OvalSelectPanel.js` | **신규 작성** (섹션 11 전체 명세 기반) |

---

### 11-9. 번호 강조 공통 원칙 — RevealPanel · OvalSelectPanel 통일

두 컴포넌트 모두 동일한 번호 칩 스타일 공유:

```
┌──────────┐
│    3     │  ← 1.6~1.8rem bold, --gold2
│    번    │  ← 0.6rem, --text4
└──────────┘
  56×56px, border-radius: 50%
```

```js
// 두 컴포넌트에 전달하는 player 객체
{ id: p.id }   // id(번호)만 — name, role, status 불필요
```

**NightAction.js 메시지 포맷 규칙**:
```js
// 이름 대신 번호 사용
const toNum = (p) => `${p.id}번`

// 예시
`데몬: ${demonPlayers.map(toNum).join(', ')}`
`미니언: ${minions.map(toNum).join(', ')}`
`처형: ${toNum(target)} → ${roleName}`
`이 중 한 명: ${relatedPlayers.map(toNum).join(', ')}`
```

---

## 13. HostDecisionPanel — 밤 행동 정보 선택 화면 (호스트 전용)

> **목표**: 호스트가 참가자를 깨우기 전에, 어떤 정보를 줄지 전략적으로 결정할 수 있도록
> 4가지 밸런싱 선택지와 상세 설명을 제공한다. 참가자에게는 결정 과정이 노출되지 않는다.

---

### 13-1. 전체 밤 행동 흐름 (변경 후)

```
[기존 흐름]
  processCurrentStep()
    → InfoPanel (자동 계산 결과)
    → "👁 공개 →" → RevealPanel → "다음 →" → 완료

[새 흐름]
  processCurrentStep()
    → HostDecisionPanel   ← 신규 (호스트만 봄)
        4가지 선택지 + 게임 상태 분석
        호스트 선택
    → InfoPanel (선택된 내용으로 재구성)
    → "👁 공개 →" → RevealPanel → "다음 →" → 완료
```

**HostDecisionPanel은 항상 InfoPanel 앞에 삽입.**
RevealPanel에는 호스트 결정 내용만 전달 — 결정 과정은 절대 노출 없음.

---

### 13-2. 게임 상태 분석 — 3가지 지표

시스템이 현재 게임 상태를 분석해 각 선택지의 추천 여부를 판단하는 근거:

| 지표 | 계산 방법 | 의미 |
|---|---|---|
| **밸런스** | 생존 선팀 수 / 생존 악팀 수 비율 | 선팀이 압도적이면 악팀 도움 추천, 반대면 선팀 도움 추천 |
| **정보량** | 이 역할이 지금까지 받은 정확한 정보 횟수 | 많이 받았으면 중립/악팀 도움 고려 |
| **위험도** | 이 참가자가 내일 처형될 가능성 (호스트 추정) | 위험하면 정확한 정보로 보호 고려 |

---

### 13-3. 4가지 선택지 정의

#### 공통 구조

```
┌──────────────────────────────────────────────┐
│ [추천 뱃지]  선팀 도움                        │  ← 시스템 추천 시 gold border
│──────────────────────────────────────────────│
│ 📋 제공 정보                                  │
│   "양옆 악 플레이어: 1명"                     │  ← 실제로 보여줄 내용 미리보기
│                                              │
│ 💡 게임 영향                                  │
│   공감인이 정확한 정보로 추리 가능.            │  ← 이 선택이 게임에 미치는 영향
│   현재 선팀이 불리한 상황이므로 추천.          │  ← 현재 게임 상태와의 연관
└──────────────────────────────────────────────┘
```

#### 선택지 1: 선팀 도움 (正確)

- **아이콘**: 🔵
- **제공 정보**: 게임 규칙대로 정확하게 계산된 값
- **게임 영향**: 선팀 플레이어가 올바른 추리 가능. 악팀에 불리.
- **추천 조건**: 선팀 생존자 수가 적거나, 게임이 악팀 우세일 때

#### 선택지 2: 중립 (Neutral)

- **아이콘**: ⚪
- **제공 정보**: 정확한 값에서 ±1 범위의 임의값 (또는 양쪽 모두 가능한 정보)
- **게임 영향**: 참가자 추리가 어려워짐. 게임 텐션 유지.
- **추천 조건**: 밸런스가 비슷하거나, 해당 역할이 이미 정확한 정보를 많이 받았을 때

#### 선택지 3: 악팀 도움 (오정보)

- **아이콘**: 🔴
- **제공 정보**: 실제와 다르지만 플레이 가능한 잘못된 값
- **게임 영향**: 선팀 플레이어가 잘못된 추리. 악팀 생존에 유리.
- **추천 조건**: 선팀이 과도하게 유리하거나, 게임이 너무 빨리 끝날 것 같을 때
- **⚠️ 경고 표시**: 오정보 제공임을 호스트에게 명확히 강조

#### 선택지 4: 직접 선택 (Custom)

- **아이콘**: ✏️
- **제공 정보**: 호스트가 직접 입력 또는 선택
- **게임 영향**: 호스트 재량
- **추천 조건**: 항상 표시 (기본 선택지)
- **UI**: 숫자 입력(info 역할) 또는 플레이어 번호 선택(select 역할)

---

### 13-4. 역할별 선택지 상세

#### info 역할 — 숫자형 (empath, chef, undertaker)

| 선택지 | empath 예시 (실제값=1) | chef 예시 (실제값=2) |
|---|---|---|
| 선팀 도움 | "악 플레이어: 1명" (정확) | "이웃한 악 쌍: 2쌍" (정확) |
| 중립 | "악 플레이어: 0명" 또는 "2명" (±1) | "이웃한 악 쌍: 1쌍" 또는 "3쌍" |
| 악팀 도움 | "악 플레이어: 0명" (오해 유도) | "이웃한 악 쌍: 0쌍" |
| 직접 선택 | 0~5 숫자 직접 입력 | 0~5 숫자 직접 입력 |

#### info 역할 — 지목형 (washerwoman, librarian, investigator)

| 선택지 | 내용 |
|---|---|
| 선팀 도움 | 올바른 역할 + 올바른 2명 표시 |
| 중립 | 올바른 역할 + 한 명은 다른 사람으로 교체 |
| 악팀 도움 | 잘못된 역할 또는 전혀 다른 2명 표시 |
| 직접 선택 | 역할 + 2명 번호 직접 선택 |

#### 특수 역할 (undertaker, spy)

- undertaker: "어젯밤 처형" 정보 → 선팀 도움=정확, 악팀 도움=다른 역할 표시
- spy: 선팀 도움=정확한 그리모어, 중립=일부 가림, 악팀 도움=한두 명 역할 교체 표시

---

### 13-5. HostDecisionPanel 화면 설계 (Wireframe)

```
┌──────────────────────────────────────────────┐
│ 🔒 호스트 전용                               │  ← 작은 라벨
│──────────────────────────────────────────────│
│                                              │
│  [역할 아이콘 2rem]  공감인  (3번 자리)       │  ← 역할 + 대상 번호
│                                              │
│  📊 현재 게임 상태                            │
│  ┌──────────────────────────────────────┐   │
│  │ 밸런스  선팀 4명 vs 악팀 2명  [선팀 ↑] │   │
│  │ 정보량  이 역할 정보 2회 수령           │   │
│  │ 위험도  낮음                           │   │
│  └──────────────────────────────────────┘   │
│                                              │
│  어떤 정보를 제공하시겠습니까?                │
│                                              │
│  ┌──────────────────────────────────────┐   │
│  │ ★ 추천  🔵 선팀 도움                  │   │  ← gold border (추천)
│  │  "악 플레이어: 1명"                   │   │
│  │  선팀 불리 → 정확한 정보 제공 권장     │   │
│  └──────────────────────────────────────┘   │
│                                              │
│  ┌──────────────────────────────────────┐   │
│  │ ⚪ 중립                               │   │
│  │  "악 플레이어: 0명"                   │   │
│  │  게임 텐션 유지. 이미 정보 다수 보유  │   │
│  └──────────────────────────────────────┘   │
│                                              │
│  ┌──────────────────────────────────────┐   │
│  │ ⚠️ 🔴 악팀 도움                      │   │  ← 경고 색상
│  │  "악 플레이어: 2명"                   │   │
│  │  선팀 과다 유리 시 고려               │   │
│  └──────────────────────────────────────┘   │
│                                              │
│  ┌──────────────────────────────────────┐   │
│  │ ✏️ 직접 선택                          │   │
│  │  [  0  ] [  1  ] [  2  ] [  3  ]    │   │  ← 숫자 버튼
│  └──────────────────────────────────────┘   │
│                                              │
│  [ ▶ 결정 → 참가자 깨우기 ]                 │  ← 선택 후 활성
└──────────────────────────────────────────────┘
```

---

### 13-6. 컴포넌트 인터페이스

```js
/**
 * HostDecisionPanel — 밤 행동 정보 선택 (호스트 전용)
 * @param {Object} data
 *   roleId       {string}    역할 ID
 *   actorSeatId  {number}    행동 참가자 자리번호
 *   gameState    {Object}    engine.state (밸런스 분석용)
 *   options      {Object[]}  4가지 선택지 배열
 *   onDecide     {Function}  onDecide(chosenOption) — 결정 후 콜백
 */

// option 객체 구조
{
  id:          'good' | 'neutral' | 'evil' | 'custom',
  icon:        '🔵' | '⚪' | '🔴' | '✏️',
  label:       '선팀 도움' | '중립' | '악팀 도움' | '직접 선택',
  preview:     string,        // 실제 보여줄 정보 미리보기 텍스트
  impact:      string,        // 게임 영향 설명
  recommended: boolean,       // 시스템 추천 여부
  revealData:  Object,        // 이 선택지 선택 시 RevealPanel에 전달할 데이터
}
```

---

### 13-7. 아키텍처: NightAdvisor 별도 모듈

> **설계 결정**: 게임 상태 분석 및 선택지 생성 로직은 `NightAdvisor.js` 독립 모듈로 분리.
> `NightAction.js`는 NightAdvisor를 호출할 뿐, 내부 로직을 포함하지 않는다.

```
NightAction.js          NightAdvisor.js               HostDecisionPanel.js
─────────────           ────────────────              ────────────────────
_showRoleInfo()   →    advise(input)         →       mountHostDecisionPanel()
                        ├─ analyzeState()              (UI 렌더링만 담당)
                        ├─ buildOptions()
                        ├─ calcNeutral()
                        ├─ calcEvilMisinfo()
                        └─ getRecommended()
```

---

### 13-8. NightAdvisor.js — 입력 / 출력 명세

#### 입력 (`AdviseInput`)

```js
/**
 * NightAdvisor.advise(input) 에 전달하는 구조화된 게임 상태
 */
const input = {
  roleId:     string,      // 행동 역할 ID (e.g. 'empath')
  actorId:    number,      // 행동 참가자 자리번호

  // 게임 필드 상태 (engine.state 에서 추출해서 전달)
  field: {
    players: [             // 전체 플레이어 배열
      { id, team, status, role, isPoisoned, isDrunk }
    ],
    round:   number,       // 현재 라운드
    phase:   string,       // 'night'
    logs:    Array,        // 누적 night action 로그
  },

  // 역할별 계산 결과 (engine 에서 미리 계산해서 전달)
  accurate: any,           // 정확한 정보값 (empath면 숫자, washerwoman이면 {roleId, players})
}
```

#### 출력 (`AdviseResult`)

```js
/**
 * NightAdvisor.advise() 반환값
 */
{
  analysis: {
    balance:    number,    // 선/악 생존 비율 (선팀/악팀)
    balanceTag: string,    // '선팀 우세' | '균형' | '악팀 우세'
    infoCount:  number,    // 이 역할의 이번 게임 정보 수령 횟수
    risk:       string,    // 'low' | 'mid' | 'high'
    riskLabel:  string,    // '낮음' | '중간' | '높음'
    goodCount:  number,
    evilCount:  number,
  },
  recommended: string,     // 'good' | 'neutral' | 'evil' | 'custom'
  options: [
    {
      id:          'good' | 'neutral' | 'evil' | 'custom',
      icon:        string,
      label:       string,
      preview:     string,   // 실제 보여줄 정보 미리보기
      impact:      string,   // 게임 영향 설명
      stateReason: string,   // 현재 게임 상태와 연관된 이유
      recommended: boolean,
      revealData:  Object | null,   // 직접선택은 null
    }
  ]
}
```

---

### 13-9. NightAdvisor.js 내부 로직

```js
/**
 * NightAdvisor — 밤 행동 정보 선택 조언 모듈
 * NightAction.js에서 분리된 독립 모듈
 */
export class NightAdvisor {

  /**
   * 메인 진입점 — 구조화된 게임 상태를 받아 4가지 선택지 반환
   */
  advise(input) {
    const analysis = this._analyzeState(input.field, input.actorId)
    const recommended = this._getRecommended(analysis)
    const options = this._buildOptions(input.roleId, input.accurate, analysis, recommended)
    return { analysis, recommended, options }
  }

  /** 게임 필드 상태 분석 */
  _analyzeState(field, actorId) {
    const alive     = field.players.filter(p => p.status === 'alive')
    const goodCount = alive.filter(p => p.team === 'good').length
    const evilCount = alive.filter(p => p.team === 'evil').length
    const balance   = goodCount / (evilCount || 1)

    const infoCount = field.logs.filter(
      l => l.actorId === actorId && l.type === 'night'
    ).length

    const risk = evilCount >= goodCount        ? 'high'
               : evilCount >= goodCount * 0.6  ? 'mid'
               : 'low'

    return {
      balance,
      balanceTag: balance > 2.5 ? '선팀 우세' : balance < 1.2 ? '악팀 우세' : '균형',
      infoCount,
      risk,
      riskLabel:  risk === 'high' ? '높음' : risk === 'mid' ? '중간' : '낮음',
      goodCount,
      evilCount,
    }
  }

  /** 추천 선택지 결정 */
  _getRecommended(analysis) {
    if (analysis.balance < 1.2)   return 'good'    // 악팀 우세 → 선팀 도움
    if (analysis.balance > 2.5)   return 'evil'    // 선팀 과다 → 악팀 도움
    if (analysis.infoCount >= 2)  return 'neutral' // 정보 많음 → 중립
    return 'good'
  }

  /** 4가지 선택지 생성 (역할별 값 계산 포함) */
  _buildOptions(roleId, accurate, analysis, recommended) { ... }

  /** 중립값 계산 (역할 유형별) */
  _calcNeutral(roleId, accurate) { ... }

  /** 악팀 도움값 계산 (역할 유형별) */
  _calcEvilMisinfo(roleId, accurate) { ... }

  /** 역할별 미리보기 텍스트 생성 */
  _formatPreview(roleId, value) { ... }

  /** RevealData 생성 */
  _buildRevealData(roleId, value) { ... }
}
```

---

### 13-10. NightAction.js — NightAdvisor 호출 방식

```js
import { NightAdvisor } from './NightAdvisor.js'
import { mountHostDecisionPanel } from '../components/HostDecisionPanel.js'

// NightAction 생성 시 advisor 인스턴스 보유
constructor({ engine, onStepDone }) {
  ...
  this._advisor = new NightAdvisor()
}

// _showRoleInfo 변경
_showRoleInfo(roleId, actors) {
  const actor    = actors[0]
  const accurate = this.engine.calcRoleInfo(roleId, actor.id)   // 정확한 값 계산

  // ① NightAdvisor에 구조화된 상태 전달
  const adviseResult = this._advisor.advise({
    roleId,
    actorId: actor.id,
    field: {
      players: this.engine.state.players,
      round:   this.engine.state.round,
      phase:   'night',
      logs:    this.engine.logs,
    },
    accurate,
  })

  // ② HostDecisionPanel 열기 (UI만 담당)
  this._unmount = mountHostDecisionPanel({
    roleId,
    actorSeatId: actor.id,
    analysis:    adviseResult.analysis,
    options:     adviseResult.options,
    onDecide: (chosen) => {
      // ③ 선택 후 InfoPanel → RevealPanel 진행
      mountInfoPanel({
        title:      ROLES_BY_ID[roleId]?.name || roleId,
        roleIcon:   ROLES_BY_ID[roleId]?.icon || '?',
        message:    chosen.preview,
        players:    [],
        revealData: chosen.revealData,
        onConfirm:  () => this._done(roleId),
      })
    }
  })
}
```

---

### 13-11. 신규 파일 목록

| 파일 | 역할 | 의존성 |
|---|---|---|
| `src/js/host/NightAdvisor.js` | 게임 상태 분석 + 선택지 생성 (로직 전담) | 없음 (순수 로직) |
| `src/js/components/HostDecisionPanel.js` | 4가지 선택지 UI 패널 (렌더링 전담) | NightAdvisor 결과를 받아 표시 |
| `src/js/host/NightAction.js` | NightAdvisor 호출 + HostDecisionPanel 연결 | 위 두 파일 import |

> **NightAdvisor.js는 UI에 의존하지 않는 순수 로직 모듈.**
> 테스트 용이성을 위해 engine 인스턴스를 직접 참조하지 않고 필요한 데이터만 `field`로 받음.

---

### 13-12. 구현 순서

```
Step A  NightAdvisor.js 신규 작성
        - advise(input) 메인 메서드
        - _analyzeState(), _getRecommended()
        - _buildOptions(), _calcNeutral(), _calcEvilMisinfo()
        - _formatPreview(), _buildRevealData()
        - 역할별 분기 (empath/chef/undertaker/washerwoman/librarian/investigator/spy)

Step B  HostDecisionPanel.js 신규 작성
        - 게임 상태 요약 카드 (3지표)
        - 4가지 선택지 카드 (추천 gold border, 악팀 ⚠️ 경고)
        - 직접선택 UI (숫자 입력 or 플레이어 번호)
        - "▶ 결정 → 참가자 깨우기" 버튼

Step C  NightAction.js — NightAdvisor 연결
        - import NightAdvisor, mountHostDecisionPanel
        - _showRoleInfo() 앞에 advisor 호출 + panel 삽입
```

---

### 13-13. 검증 체크리스트

- [ ] NightAdvisor — 입력값 `field` 만으로 engine 없이 동작 확인
- [ ] NightAdvisor — balance < 1.2 → 'good' 추천, > 2.5 → 'evil' 추천
- [ ] NightAdvisor — empath/chef/undertaker/washerwoman 각 역할 올바른 값 계산
- [ ] HostDecisionPanel — 추천 선택지 gold border 표시
- [ ] HostDecisionPanel — 악팀 도움 ⚠️ 경고 표시
- [ ] HostDecisionPanel — 직접선택 → 값 입력 후 결정 버튼 활성
- [ ] HostDecisionPanel → InfoPanel → RevealPanel 플로우 완전 연결
- [ ] RevealPanel에 결정 과정(HostDecisionPanel 내용) 절대 노출 없음

---

## 12. 이름 전면 제거 — 앱 전체 코드 변경 명세

### 12-1. 변경 원칙

```
모든 화면에서 player.name 표시 금지
→ player.id + '번'  으로 대체
→ 이름 입력/수정 UI 제거 또는 숨김
```

### 12-2. 파일별 변경 상세

#### `components/PlayerChip.js`
```js
// 변경 전 (line 88)
nameEl.textContent = player.name

// 변경 후 — 이름 요소 자체 제거
// compact 분기 블록(line 84-90) 전체 삭제
// → 카드에 번호(이미 player-chip__seat 으로 표시됨)만 남음

// 변경 전 (line 54) — img alt
img.alt = player.name

// 변경 후
img.alt = `${player.id}번`
```

#### `host/NightAction.js`
```js
// 변경 전
const minionNames = minions.map(p => `${p.name}(${ROLES_BY_ID[p.role]?.name})`).join(', ')
const demonName   = demonPlayers.map(p => p.name).join(', ')
const minionText  = minions.map(p => `${p.name}(${ROLES_BY_ID[p.role]?.name})`).join(', ')
// spy 라인: `${p.id}. ${p.name}: ...`
// undertaker: `처형: ${p?.name || '?'} → ...`

// 변경 후 (toNum 헬퍼 사용)
const toNum = p => `${p.id}번`
const minionNames = minions.map(p => `${toNum(p)}(${ROLES_BY_ID[p.role]?.name})`).join(', ')
const demonName   = demonPlayers.map(toNum).join(', ')
const minionText  = minions.map(p => `${toNum(p)}(${ROLES_BY_ID[p.role]?.name})`).join(', ')
// spy: `${p.id}번: ${role?.iconEmoji} ${role?.name} (선/악)`
// undertaker: `처형: ${toNum(p)} → ...`
```

#### `host/Grimoire.js` (detail popup, line 592)
```js
// 변경 전
`${player.name} (${player.id}번)`

// 변경 후
`${player.id}번 자리`
```

#### `host/PreGame.js` (line 65)
```js
// 변경 전
<span class="pregame__seat-name">${p.name}</span>

// 변경 후 — name 요소 제거, 번호로 충분 (seat-num 이미 표시)
// → pregame__seat-name span 제거
// → pregame__seat-num 크기 업 또는 "입장" 텍스트 추가
```

#### `host/app.js` (detail popup, line 543)
```js
// 변경 전
`${player.name} (${player.id}번 자리)`

// 변경 후
`${player.id}번 자리`
```

#### `host/Victory.js` (line 94)
```js
// 변경 전
nameSpan.textContent = p.name

// 변경 후
nameSpan.textContent = `${p.id}번`
```

#### `player/Waiting.js` (line 49, 53, 65)
```js
// 변경 전 — SVG 이름 텍스트
const short = player.name.length > 4 ? player.name.slice(0, 4) + '…' : player.name
<text ...>${short}</text>

// 변경 후 — 번호 표시
<text ...>${player.id}번</text>   // short 변수 불필요

// 변경 전 — 헤더
<div class="waiting__name">${this.playerName}</div>

// 변경 후 — 이름 헤더 제거 또는 "내 자리" 텍스트로 대체
// (this.playerName 대신 this.mySeatId 를 받아야 함)
```

> **Waiting.js 추가 고려**: 현재 `isMe = player?.name === this.playerName` 로 본인 자리를 판별.
> 이름 제거 시 `isMe = player?.id === this.mySeatId` 로 변경 필요.
> Waiting 컴포넌트에 `mySeatId` 파라미터 추가.

#### `player/PlayerTracker.js` (line 54, 66, 84)
```js
// 변경 전
<span class="tracker__name">${p.name}</span>
this._openEdit(p.id, p.name)
<div class="tracker__edit-title">${playerName} 메모</div>

// 변경 후
<span class="tracker__name">${p.id}번</span>
this._openEdit(p.id)
<div class="tracker__edit-title">${playerId}번 메모</div>
```

### 12-3. Lobby.js — 이름 입력 처리

`Lobby.js` 는 참가자가 join 시 보내는 이름을 받아 표시 + 수정하는 기능을 가짐.
이름 입력 자체를 제거하면 Join 화면에서도 이름 필드가 불필요해짐.

**옵션 A** — 이름 입력 유지, 내부용으로만 사용 (표시 안 함):
- player 객체 내 `name` 필드는 유지 (서버 전송용)
- 단, 화면에서는 절대 렌더링 안 함

**옵션 B** — 이름 필드 자체 제거:
- Join 화면에서 이름 입력 폼 제거
- player 는 seat 번호로만 식별

> 현재 설계 범위에서는 **옵션 A** 권장:
> 이름 데이터는 내부 유지, 화면 렌더링에서만 번호로 대체

### 12-4. 구현 순서

```
Step 1  PlayerChip.js — name 블록 제거 (가장 파급 범위 큼)
Step 2  NightAction.js — toNum 헬퍼 추가, 모든 p.name 대체
Step 3  Grimoire.js — detail popup 한 줄
Step 4  PreGame.js — seat-name span 제거
Step 5  Victory.js — nameSpan → 번호
Step 6  host/app.js — popup 제목
Step 7  Waiting.js — mySeatId 파라미터화, SVG/헤더 번호로
Step 8  PlayerTracker.js — name → id번
```
