# 반응형 레이아웃 전환 기획

> 목표: 다양한 폰 해상도 및 뷰포트 크기에서 UI가 화면 전체를 채우도록 레이아웃을 반응형으로 전환한다.

---

## 1. 현황 분석

### 1-1. 컨테이너 구조

```
<body>                     ← 중앙 정렬 (justify-content: center)
  <div class="app">        ← max-width: 430px 고정 ← 핵심 병목
    <div class="page-content">
    <div class="tab-bar">  ← max-width: 430px 동일
```

430px를 초과하는 기기(폴드폰 펼침, 태블릿, 가로 모드)에서는
콘텐츠가 가운데 띠로 고립되고 양 옆이 비어버린다.

### 1-2. 문제 지점 목록

| 파일 | 위치 | 내용 | 영향 |
|---|---|---|---|
| `theme.css:76` | `.app { max-width: 430px }` | 전체 앱 너비 상한 | 모든 화면 |
| `theme.css:132` | `.tab-bar { max-width: 430px }` | 탭바 너비 상한 | 모든 화면 |
| `theme.css:114` | `padding: 12px 16px 68px` | 좌우 여백 16px 고정 | 넓은 화면 여백 부족 |
| `index.html:5` | `maximum-scale=1.0` | 핀치줌 완전 차단 | 접근성 |
| `index.html:38` | `grid-template-columns: 1fr 1fr` | 랜딩 카드 2열 고정 | 태블릿 이상 |
| `Grimoire.js:233` | `slotPx` 절대 px값 | 오발 슬롯 크기 고정 | 화면 넓어도 변화 없음 |
| `Grimoire.js:784` | `.gl-oval-center { width: 120px }` | 중앙 컨트롤 고정 너비 | 오발이 커져도 고정 |
| `Waiting.js:31` | `size = 260` | SVG 원형 고정 260px | 화면 크기와 무관 |

---

## 2. 대응 범위 (지원 화면)

```
┌────────────────────────────────────────────────────────┐
│  Phase 1  │ 세로 폰  │  320px — 480px  │  우선 대응  │
│  Phase 2  │ 세로 폰  │  480px — 768px  │  중간 폰    │
│  Phase 3  │ 가로 폰  │  568px — 926px  │  landscape  │
│  Phase 4  │ 태블릿   │  768px — 1024px │  선택 대응  │
└────────────────────────────────────────────────────────┘
```

Phase 1–2 는 필수. Phase 3(landscape) 은 오발 레이아웃 변형 필요. Phase 4 는 선택.

---

## 3. 전략: CSS 변수 + clamp() + ResizeObserver

### 3-1. 컨테이너 너비 전략

**변경 전**
```css
.app { max-width: 430px; }
```

**변경 후**
```css
.app {
  width: 100%;
  max-width: min(100%, 600px);   /* 태블릿은 600px 상한 */
}
/* 태블릿 이상에서 중앙 카드 형식 유지할 경우 */
@media (min-width: 600px) {
  body { padding: 20px 0; }
  .app { border-radius: 16px; min-height: calc(100vh - 40px); }
}
```

> 폰 전용(320~480px)으로만 지원한다면 max-width 제거 후 width: 100% 만으로 충분.

### 3-2. 폰트 / 간격 — clamp() 적용

고정 rem 대신 `clamp(최솟값, 선형 스케일, 최댓값)` 사용.

```css
/* 예시 */
.landing__title { font-size: clamp(1.2rem, 4vw, 1.6rem); }
.card-title     { font-size: clamp(0.78rem, 2.5vw, 0.92rem); }
.page-content   { padding: 12px clamp(12px, 4vw, 32px) 68px; }
```

### 3-3. 오발(Oval) 슬롯 크기 — ResizeObserver 기반 계산

현재 `slotPx` 는 플레이어 수로만 결정됨.
→ 컨테이너 실제 너비를 측정한 뒤 슬롯 크기를 비율로 결정.

```js
// _renderSeatWheel 내부 변경
const containerW = oval.getBoundingClientRect().width || 300

const BASE_RATIO =
  total <= 6  ? 0.20 :
  total <= 9  ? 0.18 :
  total <= 13 ? 0.16 :
  total <= 16 ? 0.14 : 0.12

const slotPx = Math.round(containerW * BASE_RATIO)
const MIN_SLOT = 32, MAX_SLOT = 72
const clampedSlot = Math.min(MAX_SLOT, Math.max(MIN_SLOT, slotPx))
```

컨테이너 크기가 변하면 ResizeObserver 로 재렌더링:
```js
this._resizeObs = new ResizeObserver(() => this._renderSeatWheel(total, seats))
this._resizeObs.observe(wrap)
```
언마운트 시 `this._resizeObs?.disconnect()` 정리 필요.

### 3-4. 오발 중앙 컨트롤 — % 기반 너비

```css
/* 변경 전 */
.gl-oval-center { width: 120px; }

/* 변경 후 */
.gl-oval-center { width: clamp(100px, 28%, 160px); }
```

### 3-5. Waiting.js SVG — viewBox + 반응형

```js
// 변경 전: 고정 260px
const size = 260
<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">

// 변경 후: viewBox 고정, CSS로 크기 제어
const size = 260   // 내부 좌표계만 유지
<svg class="waiting__wheel" viewBox="0 0 ${size} ${size}">
```

```css
/* 변경 전 */
.waiting__wheel { display: block; }

/* 변경 후 */
.waiting__wheel {
  display: block;
  width: min(80vw, 260px);   /* 화면 80% 이하, 최대 260px */
  height: auto;
}
```

### 3-6. 랜딩 카드 그리드 — 반응형 컬럼

```css
/* 변경 전 */
.landing__cards { grid-template-columns: 1fr 1fr; }

/* 변경 후 */
.landing__cards {
  grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
}
```

### 3-7. Landscape 모드 처리

가로 모드에서 오발을 세로가 아닌 가로 타원(landscape oval)으로 전환:

```css
@media (orientation: landscape) and (max-height: 500px) {
  .gl-seat-oval {
    aspect-ratio: 3 / 2;   /* 가로형으로 전환 */
  }
  .page-content {
    padding-bottom: 56px;  /* 탭바 높이 유지 */
  }
}
```

Grimoire.js 에서 오발 반지름 RX/RY 도 landscape 여부에 따라 분기:
```js
const isLandscape = window.innerWidth > window.innerHeight
const RX = isLandscape ? 43 : 43
const RY = isLandscape ? 43 : 43   // landscape oval 에서는 RX > RY
```

---

## 4. 파일별 변경 명세

### 4-1. `src/css/theme.css`

| 셀렉터 | 변경 전 | 변경 후 | 비고 |
|---|---|---|---|
| `.app` | `max-width: 430px` | `max-width: min(100%, 600px)` | 태블릿 지원 여부에 따라 조정 |
| `.tab-bar` | `max-width: 430px` | `.app` 와 동일 값으로 통일 | CSS 변수로 관리 권장 |
| `.page-content` | `padding: 12px 16px 68px` | `padding: 12px clamp(12px, 4vw, 32px) 68px` | |
| `:root` | — | `--app-max-width: 430px` CSS 변수 추가 | 한 곳에서 관리 |

추가 미디어쿼리 블록:
```css
@media (min-width: 600px) {
  body { align-items: center; padding: 20px 0; }
  .app { border-radius: 16px; min-height: calc(100vh - 40px); }
}
@media (orientation: landscape) and (max-height: 500px) {
  .gl-seat-oval { aspect-ratio: 3 / 2; }
  .page-content { padding-bottom: 56px; }
}
```

### 4-2. `src/index.html`

**viewport meta 수정**
```html
<!-- 변경 전 -->
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">

<!-- 변경 후 -->
<meta name="viewport" content="width=device-width, initial-scale=1.0">
```
> `maximum-scale=1.0` 제거 — 접근성 지침(WCAG 1.4.4) 위반 방지.
> 앱 레벨에서 터치 이벤트 제어가 필요한 경우 JS `touchmove preventDefault` 로 대체.

**랜딩 카드 그리드**
```css
/* 변경 전 */
.landing__cards { grid-template-columns: 1fr 1fr; }

/* 변경 후 */
.landing__cards {
  grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
}
```

**랜딩 폰트 clamp**
```css
.landing__logo  { font-size: clamp(2.4rem, 7vw, 3.2rem); }
.landing__title { font-size: clamp(1.2rem, 4vw, 1.6rem); }
.landing__sub   { font-size: clamp(0.68rem, 2vw, 0.82rem); }
```

### 4-3. `src/js/host/Grimoire.js`

#### `_renderSeatWheel` 메서드 (line 225~)

**slotPx 계산 변경**
```js
// 변경 전 — 플레이어 수 기반 절대 px
const slotPx =
  total <= 6  ? 60 :
  total <= 9  ? 54 :
  total <= 13 ? 48 :
  total <= 16 ? 42 : 36

// 변경 후 — 컨테이너 너비 기반 비율
const containerW = oval.getBoundingClientRect().width || 300
const baseRatio =
  total <= 6  ? 0.20 :
  total <= 9  ? 0.18 :
  total <= 13 ? 0.16 :
  total <= 16 ? 0.14 : 0.12
const slotPx = Math.min(72, Math.max(32, Math.round(containerW * baseRatio)))
```

**ResizeObserver 추가 (mount / unmount)**
```js
// mount 시
if (!this._resizeObs) {
  this._resizeObs = new ResizeObserver(() => {
    if (this._phase === 'lobby') this._renderLobby()
  })
  this._resizeObs.observe(document.getElementById('app-content'))
}

// unmount 시
this._resizeObs?.disconnect()
this._resizeObs = null
```

**`.gl-oval-center` 너비**
```css
/* CSS 변경 — grimoire-lobby-style 블록 내 */
.gl-oval-center { width: clamp(100px, 28%, 160px); }
```

### 4-4. `src/js/player/Waiting.js`

**SVG 크기 — viewBox 유지, CSS 제어**
```js
// 변경 전
<svg class="waiting__wheel" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">

// 변경 후 — width/height 속성 제거, CSS가 크기 결정
<svg class="waiting__wheel" viewBox="0 0 ${size} ${size}">
```

**스타일 변경**
```css
/* 변경 전 */
.waiting__wheel { display: block; }

/* 변경 후 */
.waiting__wheel {
  display: block;
  width: min(80vw, 260px);
  height: auto;
  aspect-ratio: 1;
}
```

---

## 5. 구현 순서

```
Step 1  theme.css
        - CSS 변수 --app-max-width 추가
        - .app / .tab-bar max-width 변경
        - .page-content padding clamp 적용
        - landscape / 600px+ 미디어쿼리 블록 추가

Step 2  index.html
        - viewport maximum-scale 제거
        - 랜딩 카드 그리드 auto-fit 전환
        - 랜딩 폰트 clamp 적용

Step 3  Waiting.js
        - SVG width/height 속성 제거 → CSS 크기 제어
        - waiting__wheel 스타일 업데이트

Step 4  Grimoire.js
        - slotPx 컨테이너 너비 기반으로 변경
        - ResizeObserver mount/unmount 추가
        - .gl-oval-center width clamp 적용
```

---

## 6. 검증 체크리스트

- [ ] iPhone SE (375px) 세로 — 오발 슬롯 잘림 없음
- [ ] iPhone 14 Pro Max (430px) 세로 — 기존과 동일
- [ ] Samsung Galaxy S24 (412px) 세로 — 전체 너비 활용
- [ ] iPhone 14 Pro (393px) 가로 (844×390) — landscape 오발 전환
- [ ] iPad Mini (768px) 세로 — 600px 상한 적용, 중앙 정렬
- [ ] Waiting SVG — 화면 80% 이하 스케일링 확인
- [ ] ResizeObserver — 오발 마운트/언마운트 시 메모리 누수 없음

---

## 7. 미결 사항

| # | 항목 | 결정 필요 |
|---|---|---|
| 1 | 태블릿 지원 여부 | Phase 4 포함 시 max-width 600px → 768px 검토 |
| 2 | Landscape 오발 RX/RY 비율 | 가로형 타원 테스트 후 최적값 결정 |
| 3 | `user-scalable=no` 완전 제거 여부 | 게임 중 실수 줌 방지 필요성 논의 |
| 4 | 폰트 clamp 적용 범위 | 모든 컴포넌트 vs theme.css 공용 클래스만 |
