# 밤 행동 호스트 UX — 단계 분리 + 오발 지목 선택 설계

> **목표 A**: 호스트 조작 단계와 참가자 공개 단계를 명확히 분리하여,
> 호스트가 핸드폰을 참가자에게 보여주는 순간을 전용 화면으로 처리한다.
>
> **목표 B**: 참가자가 대상을 지목할 때, 역할을 모르는 상태에서 자리 위치로
> 선택할 수 있도록 SelectPanel을 오발(타원형) 좌석 배치 UI로 리뉴얼한다.

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
| `minion-info` | 호스트: 미니언 + 데몬 목록 확인 | 미니언들에게: 데몬이름 + 블러프 | — |
| `demon-info` | 호스트: 미니언 목록 확인 | 데몬에게: 미니언이름 + 블러프 | — |
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
│   [관련 플레이어 칩 — 이름만 크게]    │
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
6. **플레이어 칩 간소화** — 이름 + 번호만 (역할 정보 숨김)

### 컴포넌트 인터페이스

```js
/**
 * RevealPanel — 참가자 공개 전용 화면
 * @param {Object} data
 *   roleIcon   {string}    역할 아이콘 (emoji or PNG)
 *   roleName   {string}    역할명
 *   roleTeam   {string}    진영 ('town'|'outside'|'minion'|'demon'|null)
 *   message    {string}    참가자에게 보여줄 정보 텍스트
 *   players    {Object[]}  관련 플레이어 (이름+번호만 표시)
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

## 6. RevealPanel 플레이어 칩 — 간소화

InfoPanel 의 플레이어 칩은 역할 아이콘 + 역할명 + 이름을 모두 표시.
RevealPanel 에서는 **이름 + 자리번호만** 표시 (역할 정보 숨김).

```
[InfoPanel 칩]          [RevealPanel 칩]
┌──────────────┐        ┌──────────┐
│ 🔮 점쟁이   │        │          │
│ 이름: 김철수 │   →    │  김철수  │
│ 자리: 3번    │        │  3번     │
└──────────────┘        └──────────┘
```

이유: 선택 대상 플레이어가 다른 참가자인 경우, 해당 참가자의 역할이 화면에 노출되면 안 됨.

---

## 7. 역할별 공개 내용 정의

| 역할 | 공개 대상 | 표시 내용 |
|---|---|---|
| minion-info | 미니언 전원 | 데몬 이름, 동료 미니언 이름(들), 블러프 역할 3개 |
| demon-info | 데몬 | 미니언 이름(들), 블러프 역할 3개 |
| spy | 스파이 | 전체 플레이어 이름 + 역할명 + 진영 목록 |
| empath | 공감인 | "양옆 악 플레이어: N명" |
| chef | 요리사 | "이웃한 악 쌍: N쌍" |
| undertaker | 장의사 | "어젯밤 처형: [이름] → [역할]" + 플레이어 칩 |
| washerwoman | 세탁부 | "이 중 한 명이 [역할]" + 2명 칩 (이름만) |
| librarian | 사서 | "이 중 한 명이 아웃사이더" + 2명 칩 (이름만) |
| investigator | 조사관 | "이 중 한 명이 미니언" + 2명 칩 (이름만) |
| fortuneteller | 점쟁이 | "✅ 예 / ❌ 아니오" + 선택한 2명 칩 (이름만) |

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
  .reveal__players  flex, gap:12px, center, 이름+번호 칩만
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
    message: `데몬: ${demonName}\n블러프: ${bluffText}`,
    players: minions.map(p => ({ id: p.id, name: p.name })),  // 이름만
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
        - 플레이어 칩: 이름+번호만 표시

Step 2  InfoPanel.js 수정
        - revealData 파라미터 처리
        - 확인 버튼 분기 로직

Step 3  NightAction.js 수정
        - 각 mountInfoPanel() 호출에 revealData 추가
        - 역할: minion-info, demon-info, spy, info 역할 전체, fortuneteller 결과

Step 4  OvalSelectPanel.js 신규 작성 (섹션 11 참조)
        - 오발 좌석 배치 렌더링
        - 자리번호 + 이름 표시 (역할 아이콘 없음)
        - 선택 상태, 선택 불가 상태

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
- [ ] 세탁부/사서/조사관 — 플레이어 칩에 역할 정보 숨김 확인
- [ ] 점쟁이 결과 — "예/아니오" 후 RevealPanel, 이후 다음 스텝
- [ ] revealData 없는 호출 (기존 코드) — `✅ 확인` 버튼 그대로
- [ ] RevealPanel z-index(210) — InfoPanel(200) 위에 렌더링
- [ ] 뒤로가기/닫기 없음 — "다음" 버튼만으로만 진행 가능
- [ ] OvalSelectPanel — 플레이어 수 5~20명 레이아웃 정상
- [ ] OvalSelectPanel — 자리번호/이름 표시, 역할 아이콘 없음
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

```
┌──────────────────────────────────────────────┐
│  [역할아이콘 2.2rem]  수도사                  │
│  대상을 탭해 선택하세요                       │
│──────────────────────────────────────────────│
│                                              │
│         오발 좌석 배치 (aspect-ratio 2:3)    │
│                                              │
│              ② 이영희                        │
│         ①              ③                   │
│      김철수                박민준            │
│    ⑦                             ④          │
│    오수연                         정수아     │
│         ⑥              ⑤                   │
│         최지우       한동우                  │
│                                              │
│              [중앙 선택 카운터]               │
│              선택: 0 / 1                     │
│                                              │
│──────────────────────────────────────────────│
│       [ ✅ 확인 (비활성 → 선택 후 활성) ]    │
└──────────────────────────────────────────────┘
```

**핵심**: 오발 좌석 배치가 실제 물리적 테이블 배치와 동일
→ 참가자가 상대방을 자리 위치로 직관적으로 지목

---

### 11-3. 슬롯 설계

```
슬롯 상태별 표시

[기본 / 선택 가능]        [선택됨]              [선택 불가 / 사망]
┌────────────┐           ┌────────────┐        ┌────────────┐
│            │           │  ✓ 선택됨  │        │            │
│    이름    │     →     │    이름    │        │    이름    │  (opacity 0.3)
│   (2번)   │           │   (2번)   │        │   (2번)   │  (dim, 클릭불가)
└────────────┘           └────────────┘        └────────────┘
 border: lead2            border: gold           border: lead2
 bg: surface              bg: gold rgba(0.1)     bg: surface2
                          box-shadow: gold glow
```

슬롯 내부 구성:
- **자리 번호** — 상단, 0.62rem, text4 (작게)
- **이름** — 중앙, 0.82rem bold, text (크게)
- 역할 아이콘 **없음**

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
  선택하세요              ✓ 김철수
  0 / 1                  1 / 1
```

---

### 11-5. 컴포넌트 인터페이스

```js
/**
 * OvalSelectPanel — 오발 좌석 배치 대상 선택 패널
 * @param {Object} data
 *   title      {string}    역할명
 *   roleIcon   {string}    역할 아이콘
 *   roleTeam   {string}    진영 (색상 적용)
 *   players    {Object[]}  전체 플레이어 배열 (id, name, status 포함)
 *                          id = 자리번호(1-based), name = 이름
 *   maxSelect  {number}    최대 선택 수 (기본 1)
 *   onConfirm  {Function}  onConfirm(selectedIds[]) — 자리번호 배열
 */
mountOvalSelectPanel(data) → unmountFn
```

---

### 11-6. 오발 좌표 계산 (Grimoire와 동일한 알고리즘)

```js
// 12시 방향 시작, 시계방향
// players[0] = 1번 자리 (12시 위치)
const total = players.length
const RX = 43, RY = 43  // % of container (aspect-ratio 2:3)

players.forEach((p, i) => {
  const angle = (2 * Math.PI * i) / total - Math.PI / 2
  const x = 50 + RX * Math.cos(angle)   // % of width
  const y = 50 + RY * Math.sin(angle)   // % of height
  slot.style.left = `${x.toFixed(2)}%`
  slot.style.top  = `${y.toFixed(2)}%`
})
```

오발 컨테이너: `position: relative; width: 100%; aspect-ratio: 2/3`
슬롯: `position: absolute; transform: translate(-50%, -50%)`

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

### 11-8. SelectPanel 교체 범위

| 변경 위치 | 내용 |
|---|---|
| `NightAction.js` | `mountSelectPanel` → `mountOvalSelectPanel` import/호출 교체 |
| `SelectPanel.js` | 그대로 유지 (다른 곳에서 사용 가능성 대비) |
| `OvalSelectPanel.js` | 신규 작성 |

---

### 11-9. RevealPanel 플레이어 칩 연계

RevealPanel 에서 관련 플레이어를 표시할 때도
이름 + 자리번호만 표시하는 원칙을 동일하게 적용.

```js
// RevealPanel players 칩: 이름 + 번호만
{ id: p.id, name: p.name }   // role, status 제외
```
