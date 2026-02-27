# 호스트 히스토리 내비게이션 시스템 설계

> **목표**: 호스트가 게임 진행 중 언제든 이전 단계를 되돌아보고,
> 현재 상태로 즉시 복귀할 수 있는 히스토리 타임라인 UI를 제공한다.
>
> **핵심 원칙**: 브라우저 주소창처럼 항상 화면 상단에 존재하며,
> 핸드폰 한 손 조작에 최적화된 좌우 스크롤 탭 형태로 동작한다.

---

## 0. 문제 정의

### 현재 상태

```
게임 시작 → 밤1 → 낮1 → 투표 → 처형 → 밤2 → …
                                              ↑ 현재 위치
```

- 진행은 **앞으로만** 가능 (forward-only)
- 이전 라운드에서 누가 어떤 정보를 받았는지, 누가 지목당했는지 확인 불가
- 호스트가 "아까 공감인에게 뭐라고 했더라?" 기억에 의존
- 잘못된 조작 시 되돌릴 방법 없음

### 필요한 기능

| 상황 | 요구 |
|---|---|
| "밤1에 공감인에게 뭐라고 알려줬지?" | 과거 단계 **열람** |
| "방금 투표 결과 다시 보여줘" | 직전 단계 **되돌아가기** |
| "아, 확인했으니 다시 현재로" | 최신 상태 **즉시 복귀** |
| "독살자가 누굴 찍었더라?" | 특정 행동 **검색/점프** |
| "잘못 클릭했어, 한 단계 뒤로" | 조작 **실행취소(Undo)** |

---

## 1. 히스토리 데이터 모델

### HistoryEntry

게임에서 발생하는 모든 유의미한 행동을 하나의 엔트리로 기록한다.

```js
{
  id: number,              // 자동 증가 시퀀스
  timestamp: number,       // Date.now()
  phase: 'night'|'day',   // 게임 페이즈
  round: number,           // 라운드 번호 (0 = 첫밤)

  // 단계 식별
  type: 'phase-start'     // 밤/낮 시작
      | 'night-action'    // 밤 능력 처리
      | 'night-resolve'   // 밤 결과 확정 (사망 등)
      | 'nomination'      // 지명
      | 'vote'            // 투표 진행
      | 'execution'       // 처형 확정
      | 'death'           // 사망 처리
      | 'ability-use',    // 기타 능력 사용

  // 상세 정보
  actor: number|null,      // 행동 주체 좌석번호 (null = 시스템)
  roleId: string|null,     // 역할 ID (night-action 시)
  target: number[]|null,   // 대상 좌석번호 배열
  result: any,             // 행동 결과 (선택지, 숫자, boolean 등)
  label: string,           // 타임라인 표시용 짧은 텍스트

  // Undo 지원
  snapshot: object|null,   // 이 행동 직전의 engine.state 스냅샷 (선택적)
  undoable: boolean,       // 되돌리기 가능 여부
}
```

### HistoryEntry.label 예시

| type | label 예시 |
|---|---|
| `phase-start` | `"🌙 밤 1"`, `"☀️ 낮 2"` |
| `night-action` | `"독살자 → 3번"`, `"공감인: 1"` |
| `night-resolve` | `"밤 결과: 5번 사망"` |
| `nomination` | `"2번 → 7번 지명"` |
| `vote` | `"투표: 찬성 4 / 반대 3"` |
| `execution` | `"7번 처형"` |
| `death` | `"5번 사망 (임프 공격)"` |

---

## 2. HistoryManager 모듈

```
src/js/host/HistoryManager.js
```

### 책임

- 히스토리 엔트리 **기록** (push)
- 엔트리 목록 **조회** (getAll, getByRound, getByType)
- 현재 **커서 위치** 관리 (viewing vs latest)
- **Undo** 실행 (snapshot 복원)
- 타임라인 UI에 데이터 제공

### 인터페이스

```js
class HistoryManager {
  constructor(engine) {}

  // ── 기록 ──
  push(entry)                    // 새 엔트리 추가, 커서를 최신으로 이동

  // ── 조회 ──
  getAll()                       // 전체 히스토리 배열
  getByRound(round)              // 특정 라운드 엔트리만
  getByPhase(phase)              // night/day 필터
  getCurrent()                   // 현재 커서가 가리키는 엔트리
  getLatest()                    // 가장 최근 엔트리

  // ── 네비게이션 ──
  goTo(entryId)                  // 특정 엔트리로 커서 이동 (열람 모드)
  goBack()                       // 커서를 하나 이전으로
  goForward()                    // 커서를 하나 다음으로
  goToLatest()                   // 최신 상태로 복귀
  isViewingHistory()             // 현재 과거를 보고 있는지 여부

  // ── Undo ──
  undo()                         // 마지막 undoable 엔트리 되돌리기
  canUndo()                      // undo 가능 여부

  // ── 이벤트 ──
  on('push', callback)           // 새 엔트리 추가 시
  on('navigate', callback)       // 커서 이동 시
  on('undo', callback)           // undo 실행 시
}
```

### engine 연동

```js
// game-engine.js 의 주요 액션마다 히스토리 기록을 호출
// HistoryManager는 engine 이벤트를 구독하여 자동 기록

engine.on('phaseChanged', ({ phase, round }) => {
  history.push({
    type: 'phase-start',
    phase, round,
    label: phase === 'night' ? `🌙 밤 ${round}` : `☀️ 낮 ${round}`
  })
})

engine.on('nightActionRecorded', ({ roleId, actor, target, result }) => {
  history.push({
    type: 'night-action',
    phase: 'night', round: engine.state.round,
    actor, roleId, target, result,
    label: formatNightActionLabel(roleId, target, result),
    snapshot: deepClone(engine.state),
    undoable: true
  })
})

// ... nomination, vote, execution, death 등 동일 패턴
```

---

## 3. 타임라인 바 UI (HistoryBar)

### 위치 & 레이아웃

```
┌──────────────────────────────────────────────┐
│ [← ] HistoryBar (좌우 스크롤)          [NOW ▶]│  ← 항상 화면 최상단
├──────────────────────────────────────────────┤
│                                              │
│            기존 게임 콘텐츠 영역               │
│          (Grimoire / DayFlow / etc.)         │
│                                              │
└──────────────────────────────────────────────┘
```

- **위치**: 화면 최상단, 탭 바 바로 아래 (sticky)
- **높이**: 44px (터치 최소 높이)
- **배경**: 반투명 다크 (`rgba(0,0,0,0.85)`)
- **항상 표시**: 게임 시작 후 모든 화면에서 노출 (lobby 제외)

### 타임라인 칩 구조

```
 ← [🌙밤1] [독살자→3] [공감인:1] [☀️낮1] [2→7지명] [투표4:3] [7번처형] [🌙밤2] [임프→5] ●NOW →
    ────────────────────────────────────────────────────────────────────────────────────
    ◀ 좌우 스크롤 (터치 스와이프 / 드래그)                           자동 스크롤 →▶
```

각 칩은 `HistoryEntry` 하나에 대응한다.

### 칩 디자인

```
┌─────────────┐
│ 🌙 밤 1     │  ← phase-start: 라운드 구분 칩 (강조색, 약간 큰 크기)
└─────────────┘

┌─────────────┐
│ 독살자 → 3  │  ← night-action: 행동 칩 (기본 크기)
└─────────────┘

┌─────────────┐
│ ● NOW       │  ← 현재 위치 표시 칩 (항상 가장 오른쪽, 발광 효과)
└─────────────┘
```

| 칩 종류 | 배경색 | 텍스트 | 크기 |
|---|---|---|---|
| **phase-start (밤)** | `#1a1a4e` (진한 남색) | 흰색 | 넓음 (패딩 12px 16px) |
| **phase-start (낮)** | `#4e3a1a` (진한 황색) | 흰색 | 넓음 |
| **night-action** | `#2a2a3e` (어두운 보라) | `#c0c0ff` | 기본 (패딩 8px 12px) |
| **nomination** | `#3e2a2a` (어두운 적색) | `#ffc0c0` | 기본 |
| **vote** | `#2a3e2a` (어두운 녹색) | `#c0ffc0` | 기본 |
| **execution/death** | `#4e1a1a` (진한 적색) | 흰색, bold | 기본 |
| **NOW 마커** | `#00cc66` (밝은 녹색) | 흰색 | 기본, 맥동 애니메이션 |

### 칩 상태

```css
/* 기본 상태 */
.history-chip { opacity: 0.7; }

/* 현재 커서가 가리키는 칩 */
.history-chip.--active {
  opacity: 1;
  outline: 2px solid #fff;
  transform: scale(1.05);
}

/* 미래 칩 (커서가 과거에 있을 때) */
.history-chip.--future { opacity: 0.3; }
```

### 좌우 네비게이션 버튼

```
[← ]  왼쪽 끝 버튼 (이전 단계)
[NOW ▶]  오른쪽 끝 버튼 (최신으로 복귀)
```

- `[← ]`: 커서를 한 칸 이전으로 이동 (길게 누르면 연속 이동)
- `[NOW ▶]`: 즉시 최신 상태로 복귀 + 스크롤도 오른쪽 끝으로
- **NOW 버튼은 히스토리 열람 중일 때만 강조** (평소엔 dim)

---

## 4. 히스토리 열람 모드 (History Viewing Mode)

### 모드 전환

```
[일반 모드]  ←→  [열람 모드]
```

| | 일반 모드 | 열람 모드 |
|---|---|---|
| **트리거** | 기본 상태 | 타임라인 칩 탭 / ← 버튼 |
| **게임 콘텐츠** | 현재 진행 상태 | 과거 스냅샷 (읽기 전용) |
| **타임라인 바** | NOW 칩 활성 | 선택한 칩 활성 |
| **화면 표시** | 정상 | 상단에 "과거 열람 중" 배너 |
| **게임 조작** | 가능 | **비활성** (터치 차단) |
| **복귀 방법** | — | NOW 버튼 / 스와이프 오른쪽 끝 |

### 열람 모드 진입 시 표시

```
┌──────────────────────────────────────────────┐
│ [← ] [🌙밤1] [독살자→3] [●공감인:1] …  [NOW ▶]│
├──────────────────────────────────────────────┤
│  ⚠️ 밤 1 — 공감인 행동 열람 중  [현재로 돌아가기 →] │  ← 열람 배너
├──────────────────────────────────────────────┤
│                                              │
│   (해당 시점의 InfoPanel / RevealPanel 등     │
│    읽기전용 재현)                              │
│                                              │
└──────────────────────────────────────────────┘
```

### 열람 모드에서 표시할 내용

각 `HistoryEntry.type` 별로 열람 시 재현하는 화면:

| type | 열람 화면 |
|---|---|
| `phase-start` | 해당 라운드 시작 시점의 Grimoire 상태 (생존/사망 현황) |
| `night-action` | 해당 역할의 InfoPanel 또는 OvalSelectPanel 결과 (읽기전용) |
| `night-resolve` | 밤 결과 요약 (사망자, 상태변화) |
| `nomination` | 지명자 → 피지명자 표시 |
| `vote` | 투표 결과 (찬성/반대 수, 투표자 목록) |
| `execution` | 처형 결과 |
| `death` | 사망 정보 + 역할 공개 여부 |

---

## 5. 제스처 & 터치 인터랙션

### 타임라인 바 조작

| 제스처 | 동작 |
|---|---|
| **칩 탭** | 해당 엔트리로 이동 (열람 모드 진입) |
| **좌우 스와이프** (타임라인 바 위) | 타임라인 스크롤 (커서 변경 없음) |
| **← 버튼 탭** | 이전 엔트리로 커서 이동 |
| **← 버튼 길게 누름** | 연속 이전 이동 (200ms 간격) |
| **NOW 버튼 탭** | 최신 상태로 즉시 복귀 |
| **NOW 버튼 더블탭** | 최신 + 열람 모드 해제 |

### 콘텐츠 영역 제스처 (열람 모드 시)

| 제스처 | 동작 |
|---|---|
| **왼쪽 가장자리에서 오른쪽 스와이프** | 이전 엔트리 |
| **오른쪽 가장자리에서 왼쪽 스와이프** | 다음 엔트리 |
| **아래로 스와이프** (화면 상단에서) | 열람 모드 해제, 현재로 복귀 |
| **일반 탭** | 차단 (읽기전용 표시) |

### 핸드폰 한 손 조작 최적화

```
                     ┌─────────────┐
                     │  HistoryBar │  ← 엄지 닿는 상단
                     │─────────────│
                     │             │
                     │   콘텐츠    │
                     │             │
                     │─────────────│
                     │  기존 탭 바  │  ← 엄지 닿는 하단
                     └─────────────┘
```

- HistoryBar 높이 44px: iOS/Android 터치 최소 영역 충족
- 칩 최소 너비 60px: 오탭 방지
- 칩 간 간격 6px: 분리감 유지하면서 밀집
- 스크롤 관성(momentum): 네이티브 `-webkit-overflow-scrolling: touch`

---

## 6. Undo 시스템

### 원칙

- **Undo는 가장 최근 undoable 엔트리만 대상**
- Undo 실행 시 해당 엔트리의 `snapshot`으로 `engine.state`를 복원
- Undo된 엔트리는 히스토리에서 **제거되지 않고** `undone: true` 표시
- 연속 Undo 가능 (스택 방식)

### Undo 가능한 행동

| type | undoable | 이유 |
|---|---|---|
| `night-action` | ✅ | 호스트가 잘못된 선택지를 고른 경우 |
| `nomination` | ✅ | 잘못된 사람을 지명한 경우 |
| `vote` | ✅ | 투표 수 잘못 입력 |
| `execution` | ⚠️ 조건부 | 처형 후 다음 단계 진행 전까지만 |
| `phase-start` | ❌ | 페이즈 시작은 되돌릴 수 없음 |
| `death` (밤 사망) | ❌ | 밤 결과 확정 후에는 불가 |

### Undo UI

```
┌──────────────────────────────────────────────┐
│ [← ] … [독살자→3] [●NOW]              [NOW ▶]│
├──────────────────────────────────────────────┤
│                                              │
│          현재 게임 화면                       │
│                                              │
│                         ┌──────────────────┐ │
│                         │  ↩️ 되돌리기     │ │  ← FAB (Floating Action Button)
│                         │  독살자 → 3번    │ │     마지막 undoable 행동 표시
│                         └──────────────────┘ │
└──────────────────────────────────────────────┘
```

- **FAB 위치**: 화면 우하단 (엄지 접근성)
- **표시 조건**: `canUndo() === true` 일 때만 노출
- **탭**: 확인 다이얼로그 → Undo 실행
- **자동 숨김**: 3초 후 반투명으로 축소 (탭하면 다시 확장)

### Undo 확인 다이얼로그

```
┌─────────────────────────────┐
│  되돌리기 확인               │
│                             │
│  "독살자 → 3번" 행동을       │
│  취소하시겠습니까?           │
│                             │
│  ⚠️ 게임 상태가 해당 행동    │
│  이전으로 복원됩니다.        │
│                             │
│  [취소]          [되돌리기]  │
└─────────────────────────────┘
```

---

## 7. 컴포넌트 구조

### 새 파일

```
src/js/host/HistoryManager.js    — 히스토리 데이터 관리 모듈
src/js/host/HistoryBar.js        — 타임라인 바 UI 컴포넌트
src/js/host/HistoryViewer.js     — 열람 모드 콘텐츠 렌더러
src/css/history.css              — 히스토리 전용 스타일
```

### 컴포넌트 관계

```
host/app.js
  ├── HistoryBar          (항상 상단에 마운트)
  │     └── HistoryManager 구독 → 칩 렌더링
  │
  ├── [기존 게임 콘텐츠]
  │     ├── Grimoire
  │     ├── NightAction
  │     └── DayFlow
  │
  └── HistoryViewer       (열람 모드 시 콘텐츠 위에 오버레이)
        ├── 읽기전용 InfoPanel
        ├── 읽기전용 OvalSelectPanel
        └── 읽기전용 Grimoire 스냅샷
```

### HistoryBar 내부 구조

```js
class HistoryBar {
  constructor(historyManager) {}

  render() {
    return `
      <div class="history-bar">
        <button class="history-bar__back">←</button>
        <div class="history-bar__track">
          <!-- 칩들이 좌우 스크롤 -->
          ${entries.map(e => this._renderChip(e)).join('')}
          <div class="history-bar__now-marker">● NOW</div>
        </div>
        <button class="history-bar__now-btn">NOW ▶</button>
      </div>
    `
  }

  _renderChip(entry) {
    const isActive = entry.id === this._manager.getCurrent().id
    const isFuture = entry.id > this._manager.getCurrent().id
    return `
      <button class="history-chip
        history-chip--${entry.type}
        ${isActive ? '--active' : ''}
        ${isFuture ? '--future' : ''}
        ${entry.undone ? '--undone' : ''}"
        data-entry-id="${entry.id}">
        ${entry.label}
      </button>
    `
  }

  // 새 엔트리 추가 시 자동 스크롤
  _scrollToLatest() {
    this._track.scrollTo({
      left: this._track.scrollWidth,
      behavior: 'smooth'
    })
  }
}
```

---

## 8. CSS 레이아웃

### history.css 핵심 규칙

```css
/* ── 타임라인 바 ── */
.history-bar {
  position: sticky;
  top: 0;
  z-index: 100;
  display: flex;
  align-items: center;
  height: 44px;
  background: rgba(0, 0, 0, 0.85);
  backdrop-filter: blur(8px);
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  padding: 0 4px;
  gap: 4px;
}

/* ── 스크롤 트랙 ── */
.history-bar__track {
  flex: 1;
  display: flex;
  align-items: center;
  gap: 6px;
  overflow-x: auto;
  overflow-y: hidden;
  scroll-behavior: smooth;
  -webkit-overflow-scrolling: touch;
  scrollbar-width: none;            /* Firefox */
  padding: 4px 0;
}
.history-bar__track::-webkit-scrollbar { display: none; }

/* ── 칩 공통 ── */
.history-chip {
  flex-shrink: 0;
  min-width: 60px;
  height: 32px;
  padding: 4px 12px;
  border: none;
  border-radius: 16px;
  font-size: 13px;
  font-weight: 500;
  white-space: nowrap;
  cursor: pointer;
  transition: opacity 0.2s, transform 0.15s, outline-color 0.2s;
  opacity: 0.7;
}

.history-chip.--active {
  opacity: 1;
  outline: 2px solid #fff;
  transform: scale(1.05);
}

.history-chip.--future { opacity: 0.3; }
.history-chip.--undone {
  opacity: 0.3;
  text-decoration: line-through;
}

/* ── 칩 종류별 색상 ── */
.history-chip--phase-start-night { background: #1a1a4e; color: #fff; }
.history-chip--phase-start-day   { background: #4e3a1a; color: #fff; }
.history-chip--night-action      { background: #2a2a3e; color: #c0c0ff; }
.history-chip--nomination        { background: #3e2a2a; color: #ffc0c0; }
.history-chip--vote              { background: #2a3e2a; color: #c0ffc0; }
.history-chip--execution,
.history-chip--death             { background: #4e1a1a; color: #fff; font-weight: 700; }

/* ── NOW 마커 ── */
.history-bar__now-marker {
  flex-shrink: 0;
  padding: 4px 10px;
  border-radius: 16px;
  background: #00cc66;
  color: #fff;
  font-size: 12px;
  font-weight: 700;
  animation: pulse-now 2s ease-in-out infinite;
}

@keyframes pulse-now {
  0%, 100% { box-shadow: 0 0 0 0 rgba(0, 204, 102, 0.4); }
  50%      { box-shadow: 0 0 0 6px rgba(0, 204, 102, 0); }
}

/* ── 좌우 버튼 ── */
.history-bar__back,
.history-bar__now-btn {
  flex-shrink: 0;
  width: 44px;
  height: 36px;
  border: none;
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.1);
  color: #fff;
  font-size: 14px;
  font-weight: 700;
  cursor: pointer;
}

.history-bar__now-btn {
  width: auto;
  padding: 0 12px;
  font-size: 12px;
}

/* 열람 모드 아닐 때 NOW 버튼 dim */
.history-bar__now-btn.--dim { opacity: 0.4; }

/* ── 열람 모드 배너 ── */
.history-viewing-banner {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 16px;
  background: rgba(255, 165, 0, 0.15);
  border-bottom: 1px solid rgba(255, 165, 0, 0.3);
  color: #ffaa00;
  font-size: 13px;
  font-weight: 600;
}

.history-viewing-banner__back-btn {
  padding: 4px 12px;
  border: 1px solid #ffaa00;
  border-radius: 12px;
  background: transparent;
  color: #ffaa00;
  font-size: 12px;
  cursor: pointer;
}

/* ── Undo FAB ── */
.history-undo-fab {
  position: fixed;
  bottom: 80px;  /* 탭 바 위 */
  right: 16px;
  z-index: 90;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 16px;
  border: none;
  border-radius: 24px;
  background: #333;
  color: #fff;
  font-size: 13px;
  box-shadow: 0 4px 12px rgba(0,0,0,0.4);
  cursor: pointer;
  transition: opacity 0.3s, transform 0.3s;
}

.history-undo-fab.--collapsed {
  opacity: 0.4;
  transform: scale(0.85);
}
```

---

## 9. 통합 포인트 (기존 코드 변경)

### host/app.js

```diff
+ import { HistoryManager } from './HistoryManager.js'
+ import { HistoryBar } from './HistoryBar.js'

  class HostApp {
    constructor() {
+     this._history = new HistoryManager(this._engine)
+     this._historyBar = new HistoryBar(this._history)
      // ...
    }

    _buildLayout() {
+     // 탭 바 바로 아래, 콘텐츠 위에 HistoryBar 삽입
+     this._container.prepend(this._historyBar.el)
      // ...
    }

+   // 열람 모드 ↔ 일반 모드 전환
+   _onHistoryNavigate(entry) {
+     if (this._history.isViewingHistory()) {
+       this._showHistoryViewer(entry)
+     } else {
+       this._hideHistoryViewer()
+     }
+   }
  }
```

### host/NightAction.js

```diff
  // 각 행동 완료 시 히스토리 기록 추가
  _completeAction(roleId, actor, target, result) {
    // 기존: engine에 결과 기록
    this._engine.recordNightAction(roleId, actor, target, result)

+   // 히스토리에도 기록
+   this._history.push({
+     type: 'night-action',
+     phase: 'night',
+     round: this._engine.state.round,
+     actor, roleId, target, result,
+     label: formatNightActionLabel(roleId, target, result),
+     snapshot: deepClone(this._engine.state),
+     undoable: true
+   })
  }
```

### host/DayFlow.js

```diff
  // 지명, 투표, 처형 각 단계마다 히스토리 기록
+ _recordNomination(nominator, target) { ... }
+ _recordVote(target, yesCount, noCount) { ... }
+ _recordExecution(target) { ... }
```

### game-engine.js

```diff
+ // Undo 지원을 위한 상태 복원 메서드
+ restoreState(snapshot) {
+   this.state = deepClone(snapshot)
+   this.emit('stateChanged', this.state)
+ }
```

---

## 10. 라운드 구분 & 접기

### 긴 게임에서의 가독성

게임이 길어지면 칩이 수십 개가 되어 스크롤이 길어진다.
라운드 단위로 **접기(collapse)** 기능을 제공한다.

```
접힌 상태:
[🌙밤1 ···] [☀️낮1 ···] [🌙밤2 ···] [☀️낮2]  [독살자→3] [●NOW]

펼친 상태 (밤1 탭):
[🌙밤1] [독살자→3] [공감인:1] [요리사:2] [☀️낮1 ···] [🌙밤2 ···] ...
```

- **이전 라운드**: 자동으로 접힘 (탭하면 펼침)
- **현재 라운드**: 항상 펼침
- **접힌 칩 표시**: 라운드 레이블 + `···` (점 3개)

### 접기 규칙

| 조건 | 상태 |
|---|---|
| 현재 라운드 | 항상 펼침 |
| 직전 라운드 | 펼침 (최근 참조 빈도 높음) |
| 2라운드 이전 | 자동 접힘 |
| 사용자가 탭한 라운드 | 수동 펼침 (다른 곳 탭하면 다시 접힘) |

---

## 11. 접근성 & 성능

### 접근성

- 칩에 `aria-label` 제공 (예: `"밤 1라운드, 독살자가 3번 좌석을 선택"`)
- 키보드 화살표 좌/우로 칩 간 이동 (외부 키보드 연결 시)
- 열람 모드 배너에 `role="alert"` 설정

### 성능

- 칩 DOM 재사용: 새 엔트리 추가 시 전체 리렌더 하지 않고 `appendChild`
- 스냅샷 저장: 모든 엔트리가 아닌 **undoable 엔트리만** 스냅샷 보관
- 스냅샷 메모리 제한: 최대 20개, 오래된 것부터 `snapshot = null` 처리
- `IntersectionObserver`로 뷰포트 밖 칩은 렌더 스킵 (가상화)

---

## 12. 전체 플로우 시나리오

### 시나리오 A: 일반 진행

```
1. 게임 시작 → [🌙밤0] 칩 생성
2. 독살자 행동 완료 → [독살자→3] 칩 추가, 자동 스크롤
3. 공감인 행동 완료 → [공감인:1] 칩 추가
4. 밤 종료, 낮 시작 → [☀️낮1] 칩 추가
5. 지명 → [2→7지명] 칩 추가
6. 투표 → [투표4:3] 칩 추가
7. 처형 → [7번처형] 칩 추가
   → 타임라인: [🌙밤0][독살자→3][공감인:1][☀️낮1][2→7지명][투표4:3][7번처형][●NOW]
```

### 시나리오 B: 과거 열람

```
1. 현재: 밤2 진행 중
2. 호스트가 [공감인:1] 칩 탭
3. → 열람 모드 진입
4. → 화면: "밤 1 — 공감인 행동 열람 중" 배너 + 읽기전용 InfoPanel
5. → 게임 조작 버튼 비활성
6. 호스트가 [NOW ▶] 탭
7. → 열람 모드 해제, 밤2 현재 화면으로 복귀
```

### 시나리오 C: Undo

```
1. 밤2, 독살자가 3번을 선택 → [독살자→3] 칩 추가
2. 호스트: "아, 5번이었는데!" → Undo FAB 탭
3. → 확인 다이얼로그: "독살자 → 3번 취소?"
4. → [되돌리기] 탭
5. → engine.state가 독살자 행동 전으로 복원
6. → [독살자→3] 칩에 취소선, 독살자 선택 화면 다시 표시
7. → 독살자가 5번 선택 → [독살자→5] 칩 추가
```

---

## 13. 구현 우선순위

### Phase 1: 기본 히스토리 (MVP)

- [ ] `HistoryManager` — push, getAll, getCurrent, navigate
- [ ] `HistoryBar` — 칩 렌더링, 좌우 스크롤, NOW 마커
- [ ] engine 이벤트 연동 — phase-start, night-action 자동 기록
- [ ] host/app.js 통합 — HistoryBar 마운트

### Phase 2: 열람 모드

- [ ] `HistoryViewer` — 읽기전용 콘텐츠 렌더링
- [ ] 열람 모드 배너 + 게임 조작 차단
- [ ] 칩 탭 → 열람 진입, NOW → 복귀

### Phase 3: Undo 시스템

- [ ] 스냅샷 저장 로직
- [ ] `engine.restoreState()` 구현
- [ ] Undo FAB + 확인 다이얼로그
- [ ] undone 칩 표시 (취소선)

### Phase 4: 라운드 접기 & 최적화

- [ ] 라운드별 collapse/expand
- [ ] 칩 가상화 (IntersectionObserver)
- [ ] 스냅샷 메모리 관리 (최대 20개)
- [ ] 접근성 (aria-label, 키보드 네비게이션)
