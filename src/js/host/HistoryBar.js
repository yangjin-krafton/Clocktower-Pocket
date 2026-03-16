/**
 * HistoryBar — 타임라인 바 UI 컴포넌트
 *
 * 화면 상단에 sticky로 고정되며 좌우 스크롤 칩으로 게임 진행 이력을 표시.
 * HistoryManager의 push/navigate 이벤트를 구독하여 자동 갱신.
 */

const CHIP_COLORS = {
  'phase-start-night': { bg: 'var(--bl-dark)',  color: '#fff' },
  'phase-start-day':   { bg: '#4e3a1a',         color: 'var(--gold2)' },
  'night-action':      { bg: 'var(--surface2)',  color: 'var(--pu-light)' },
  'night-resolve':     { bg: 'var(--surface2)',  color: 'var(--text3)' },
  'nomination':        { bg: '#3e2a2a',          color: 'var(--rd-light)' },
  'vote':              { bg: '#2a3e2a',          color: '#c0ffc0' },
  'execution':         { bg: 'var(--rd-dark)',   color: '#fff' },
  'death':             { bg: 'var(--rd-dark)',   color: '#fff' },
}

export class HistoryBar {
  constructor(manager) {
    this._manager = manager
    this.el = null
    this._track = null
    this._nowBtn = null
    this._chipMap = new Map()  // entryId → chipEl

    this._build()
    this._injectStyles()

    manager.on('push', (entry) => this._onPush(entry))
    manager.on('navigate', () => this._updateActiveStates())
    manager.on('reset', () => this._onReset())
  }

  show() { if (this.el) this.el.style.display = 'flex' }
  hide() { if (this.el) this.el.style.display = 'none' }

  _build() {
    this.el = document.createElement('div')
    this.el.className = 'hbar'
    this.el.style.display = 'none'  // 게임 시작 전 숨김

    // ← 버튼
    const backBtn = document.createElement('button')
    backBtn.className = 'hbar__nav-btn'
    backBtn.textContent = '‹'
    backBtn.setAttribute('aria-label', '이전 단계')
    backBtn.addEventListener('click', () => this._manager.goBack())
    this.el.appendChild(backBtn)

    // 스크롤 트랙
    this._track = document.createElement('div')
    this._track.className = 'hbar__track'
    this.el.appendChild(this._track)

    // NOW 버튼
    this._nowBtn = document.createElement('button')
    this._nowBtn.className = 'hbar__now-btn hbar__now-btn--dim'
    this._nowBtn.textContent = '현재'
    this._nowBtn.setAttribute('aria-label', '현재 상태로 복귀')
    this._nowBtn.addEventListener('click', () => this._manager.goToLatest())
    this.el.appendChild(this._nowBtn)
  }

  _onPush(entry) {
    const chip = this._createChip(entry)
    this._track.appendChild(chip)
    this._chipMap.set(entry.id, chip)
    this._updateActiveStates()
    // 자동 스크롤
    requestAnimationFrame(() => {
      this._track.scrollTo({ left: this._track.scrollWidth, behavior: 'smooth' })
    })
  }

  _onReset() {
    this._track.innerHTML = ''
    this._chipMap.clear()
    this.hide()
  }

  _createChip(entry) {
    const chip = document.createElement('button')

    // 칩 타입 결정
    let chipType = entry.type
    if (entry.type === 'phase-start') {
      chipType = entry.phase === 'night' ? 'phase-start-night' : 'phase-start-day'
    }

    chip.className = `hbar__chip hbar__chip--${chipType}`
    chip.dataset.entryId = entry.id
    chip.textContent = entry.label
    chip.setAttribute('aria-label', this._getAriaLabel(entry))

    // 칩 색상 적용
    const colors = CHIP_COLORS[chipType]
    if (colors) {
      chip.style.background = colors.bg
      chip.style.color = colors.color
    }

    chip.addEventListener('click', () => this._manager.goTo(entry.id))
    return chip
  }

  _updateActiveStates() {
    const curIdx = this._manager.getCursorIndex()
    const isViewing = this._manager.isViewingHistory()
    const entries = this._manager.getAll()

    entries.forEach((entry, idx) => {
      const chip = this._chipMap.get(entry.id)
      if (!chip) return
      chip.classList.toggle('hbar__chip--active', idx === curIdx)
      chip.classList.toggle('hbar__chip--future', isViewing && idx > curIdx)
    })

    // NOW 버튼 상태
    this._nowBtn.classList.toggle('hbar__now-btn--dim', !isViewing)
    this._nowBtn.classList.toggle('hbar__now-btn--glow', isViewing)

    // 활성 칩으로 스크롤
    if (isViewing && entries[curIdx]) {
      const chip = this._chipMap.get(entries[curIdx].id)
      if (chip) {
        chip.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' })
      }
    }
  }

  _getAriaLabel(entry) {
    const phaseKo = entry.phase === 'night' ? '밤' : '낮'
    switch (entry.type) {
      case 'phase-start':
        return `${phaseKo} ${entry.round}라운드 시작`
      case 'night-action':
        return `${phaseKo} ${entry.round}라운드, ${entry.label}`
      default:
        return entry.label
    }
  }

  _injectStyles() {
    if (document.getElementById('hbar-style')) return
    const style = document.createElement('style')
    style.id = 'hbar-style'
    style.textContent = `
/* ── History Bar ── */
.hbar {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  height: 44px;
  background: rgba(10, 9, 24, 0.92);
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
  border-bottom: 1px solid var(--lead2);
  padding: 0 4px;
  gap: 4px;
  z-index: 40;
}

/* ── 스크롤 트랙 ── */
.hbar__track {
  flex: 1;
  display: flex;
  align-items: center;
  gap: 6px;
  overflow-x: auto;
  overflow-y: hidden;
  -webkit-overflow-scrolling: touch;
  scrollbar-width: none;
  padding: 4px 0;
}
.hbar__track::-webkit-scrollbar { display: none; }

/* ── 칩 공통 ── */
.hbar__chip {
  flex-shrink: 0;
  min-width: 48px;
  height: 30px;
  padding: 2px 10px;
  border: none;
  border-radius: 15px;
  font-family: 'Noto Sans KR', sans-serif;
  font-size: 0.65rem;
  font-weight: 600;
  white-space: nowrap;
  cursor: pointer;
  opacity: 0.7;
  transition: opacity 0.2s, transform 0.15s, outline-color 0.2s;
  outline: 2px solid transparent;
}
.hbar__chip:active { transform: scale(0.95); }

/* 활성 칩 */
.hbar__chip--active {
  opacity: 1;
  outline: 2px solid var(--gold2);
  transform: scale(1.05);
}

/* 미래 칩 (열람 모드에서 커서 이후) */
.hbar__chip--future { opacity: 0.25; }

/* 페이즈 칩 약간 강조 */
.hbar__chip--phase-start-night,
.hbar__chip--phase-start-day {
  font-weight: 700;
  min-width: 56px;
}

/* 처형/사망 칩 강조 */
.hbar__chip--execution,
.hbar__chip--death { font-weight: 700; }

/* ── 좌우 네비게이션 버튼 ── */
.hbar__nav-btn {
  flex-shrink: 0;
  width: 32px;
  height: 32px;
  border: none;
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.06);
  color: var(--text3);
  font-size: 1.1rem;
  font-weight: 700;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background 0.15s;
}
.hbar__nav-btn:active { background: rgba(255, 255, 255, 0.12); }

/* ── NOW 버튼 ── */
.hbar__now-btn {
  flex-shrink: 0;
  height: 30px;
  padding: 0 10px;
  border: none;
  border-radius: 15px;
  font-family: 'Noto Sans KR', sans-serif;
  font-size: 0.6rem;
  font-weight: 700;
  cursor: pointer;
  transition: all 0.2s;
}

.hbar__now-btn--dim {
  background: rgba(91, 179, 198, 0.15);
  color: var(--tl-dark);
  opacity: 0.5;
}

.hbar__now-btn--glow {
  background: var(--tl-base);
  color: #fff;
  opacity: 1;
  animation: hbar-pulse 2s ease-in-out infinite;
}

@keyframes hbar-pulse {
  0%, 100% { box-shadow: 0 0 0 0 rgba(91, 179, 198, 0.4); }
  50%      { box-shadow: 0 0 0 5px rgba(91, 179, 198, 0); }
}

/* ── 열람 모드 배너 ── */
.hbar-viewing-banner {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 14px;
  background: rgba(212, 168, 40, 0.1);
  border-bottom: 1px solid rgba(212, 168, 40, 0.25);
  font-size: 0.72rem;
  color: var(--gold2);
  font-weight: 600;
  gap: 8px;
}
.hbar-viewing-banner__text {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.hbar-viewing-banner__back {
  flex-shrink: 0;
  padding: 4px 12px;
  border: 1px solid var(--gold);
  border-radius: 12px;
  background: transparent;
  color: var(--gold2);
  font-family: 'Noto Sans KR', sans-serif;
  font-size: 0.62rem;
  font-weight: 600;
  cursor: pointer;
  white-space: nowrap;
}
.hbar-viewing-banner__back:active { opacity: 0.7; }

/* ── 열람 오버레이 ── */
.hbar-viewer-overlay {
  position: absolute;
  inset: 0;
  background: rgba(10, 9, 24, 0.95);
  z-index: 30;
  display: flex;
  flex-direction: column;
  overflow-y: auto;
  -webkit-overflow-scrolling: touch;
  padding: 0 0 68px;
}
.hbar-viewer-card {
  margin: 16px;
  padding: 16px;
  background: var(--surface);
  border: 1px solid var(--lead2);
  border-radius: var(--radius-md);
}
.hbar-viewer-card__type {
  font-size: 0.6rem;
  font-weight: 600;
  color: var(--text4);
  text-transform: uppercase;
  letter-spacing: 0.06em;
  margin-bottom: 4px;
}
.hbar-viewer-card__label {
  font-family: 'Noto Serif KR', serif;
  font-size: 1rem;
  font-weight: 700;
  color: var(--text);
  margin-bottom: 8px;
}
.hbar-viewer-card__detail {
  font-size: 0.78rem;
  color: var(--text2);
  line-height: 1.6;
  white-space: pre-line;
}
`
    document.head.appendChild(style)
  }
}
