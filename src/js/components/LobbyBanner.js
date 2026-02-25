/**
 * C-12 LobbyBanner — 인라인 로비 배너
 *
 * 인게임 화면 최상단에 고정되어 착석 현황을 실시간으로 보여줌.
 * phase=lobby 동안만 표시; GAME_START 수신 시 dismiss().
 *
 * 상태 변화:
 *   대기   → 최소화/확장 토글 (방 코드 + N/M명)
 *   전원착석→ 카운트다운 숫자로 전환
 *   dismiss → fade-out 후 제거
 */
export class LobbyBanner {
  /**
   * @param {Object} opts
   * @param {string} opts.roomCode
   * @param {number} opts.total  목표 인원
   */
  constructor({ roomCode, total }) {
    this.roomCode  = roomCode
    this.total     = total
    this.seats     = []      // { seatNum, name: string|null }
    this.countdown = null    // null = 미표시, 숫자 = 카운트다운 중
    this.expanded  = false
    this.el        = null
    this._timer    = null
  }

  /** @param {HTMLElement} container */
  mount(container) {
    this.el = document.createElement('div')
    this.el.className = 'lobby-banner'
    this._render()
    container.appendChild(this.el)
  }

  unmount() {
    if (this._timer) clearInterval(this._timer)
    this.el?.remove()
    this.el = null
  }

  /**
   * 착석 현황 갱신
   * @param {Array<{name:string, seatNum:number}>} seatedList
   * @param {number} [total]
   */
  updateSeats(seatedList, total) {
    if (total) this.total = total
    // 전체 자리 배열 재구성 (빈 자리는 name=null)
    this.seats = Array.from({ length: this.total }, (_, i) => {
      const found = seatedList.find(s => s.seatNum === i + 1)
      return { seatNum: i + 1, name: found ? found.name : null }
    })
    this._render()
  }

  /**
   * 카운트다운 시작 — 배너 콘텐츠가 숫자로 전환됨
   * @param {number}   seconds
   * @param {Function} [onDone]  0이 되면 호출
   */
  startCountdown(seconds, onDone) {
    if (this._timer) clearInterval(this._timer)
    this.countdown = seconds
    this._render()

    this._timer = setInterval(() => {
      this.countdown--
      if (this.countdown <= 0) {
        clearInterval(this._timer)
        this._timer = null
        this._render()
        if (onDone) onDone()
      } else {
        this._render()
      }
    }, 1000)
  }

  /** 목표 인원 수 변경 (설정 팝업 확인 후 호출) */
  updateTotal(total) {
    this.total = total
    // 현재 착석 데이터 유지하면서 자리 배열 재구성
    const seated = this.seats.filter(s => s.name !== null)
    this.seats = Array.from({ length: total }, (_, i) => {
      return seated[i] || { seatNum: i + 1, name: null }
    })
    this._render()
  }

  /** 게임 시작 시 fade-out 후 자기 제거 */
  dismiss() {
    if (this._timer) clearInterval(this._timer)
    if (!this.el) return
    this.el.classList.add('lobby-banner--dismiss')
    setTimeout(() => this.unmount(), 350)
  }

  // ─── 내부 ───────────────────────────────

  _toggle() {
    this.expanded = !this.expanded
    this._render()
  }

  _render() {
    if (!this.el) return

    const seated = this.seats.filter(s => s.name !== null).length
    const total  = this.total

    // ── 카운트다운 상태 ──────────────────────
    if (this.countdown !== null) {
      this.el.innerHTML = `
        <div class="lobby-banner__cdrow">
          <span class="lobby-banner__cdlabel">⚔️ 전원 착석 완료 · 게임 시작까지</span>
          <span class="lobby-banner__cdnum">${this.countdown}</span>
        </div>
      `
      return
    }

    // ── 자리 칩 ─────────────────────────────
    const seatChips = this.seats.map(s => {
      if (s.name) {
        return `<span class="lobby-banner__chip lobby-banner__chip--filled">${s.name}</span>`
      }
      return `<span class="lobby-banner__chip lobby-banner__chip--empty">${s.seatNum}</span>`
    }).join('')

    // ── 확장 상태 ────────────────────────────
    if (this.expanded) {
      this.el.innerHTML = `
        <div class="lobby-banner__bar">
          <span class="lobby-banner__code">🏰 ${this.roomCode}</span>
          <span class="lobby-banner__count"><b>${seated}</b> / ${total}명 입장</span>
          <button class="lobby-banner__btn" data-toggle>▲</button>
        </div>
        <div class="lobby-banner__chips">${seatChips}</div>
      `
    } else {
      // ── 최소화 상태 ──────────────────────────
      this.el.innerHTML = `
        <div class="lobby-banner__bar">
          <span class="lobby-banner__code">🏰 ${this.roomCode}</span>
          <span class="lobby-banner__count"><b>${seated}</b> / ${total}명 입장</span>
          <button class="lobby-banner__btn" data-toggle>▼</button>
        </div>
      `
    }

    this.el.querySelector('[data-toggle]')
      ?.addEventListener('click', () => this._toggle())
  }
}

// ── 스타일 ────────────────────────────────────────────────

if (!document.getElementById('lobby-banner-style')) {
  const style = document.createElement('style')
  style.id = 'lobby-banner-style'
  style.textContent = `
.lobby-banner {
  background: var(--surface);
  border-bottom: 1px solid var(--lead2);
  overflow: hidden;
  transition: opacity 0.35s ease, max-height 0.35s ease;
  position: sticky;
  top: 0;
  z-index: 40;
}
.lobby-banner--dismiss {
  opacity: 0;
  max-height: 0 !important;
}

/* ── 기본 바 ── */
.lobby-banner__bar {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 7px 14px;
}
.lobby-banner__code {
  font-family: 'Noto Serif KR', serif;
  font-size: 0.82rem;
  font-weight: 700;
  color: var(--gold2);
  letter-spacing: 0.08em;
  flex-shrink: 0;
}
.lobby-banner__count {
  flex: 1;
  font-size: 0.72rem;
  color: var(--text3);
}
.lobby-banner__count b {
  color: var(--tl-light);
  font-size: 0.9rem;
}
.lobby-banner__btn {
  background: none;
  border: none;
  color: var(--text4);
  font-size: 0.65rem;
  cursor: pointer;
  padding: 2px 6px;
  border-radius: 4px;
  flex-shrink: 0;
}
.lobby-banner__btn:hover { background: var(--lead2); }

/* ── 확장 자리 칩 ── */
.lobby-banner__chips {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  padding: 6px 14px 10px;
}
.lobby-banner__chip {
  display: inline-block;
  padding: 3px 8px;
  border-radius: 12px;
  font-size: 0.72rem;
  font-weight: 600;
  white-space: nowrap;
  max-width: 72px;
  overflow: hidden;
  text-overflow: ellipsis;
}
.lobby-banner__chip--filled {
  background: rgba(91,179,198,0.15);
  border: 1px solid rgba(91,179,198,0.4);
  color: var(--tl-light);
}
.lobby-banner__chip--empty {
  background: var(--lead2);
  border: 1px dashed var(--lead2);
  color: var(--text4);
}

/* ── 카운트다운 ── */
.lobby-banner__cdrow {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  padding: 8px 14px;
  background: rgba(212,168,40,0.08);
  border-bottom: 1px solid rgba(212,168,40,0.25);
}
.lobby-banner__cdlabel {
  font-size: 0.78rem;
  color: var(--text2);
}
.lobby-banner__cdnum {
  font-family: 'Noto Serif KR', serif;
  font-size: 1.6rem;
  font-weight: 700;
  color: var(--gold2);
  line-height: 1;
  min-width: 1.6rem;
  text-align: center;
  animation: cdwn-pulse 1s ease-in-out infinite;
}
@keyframes cdwn-pulse {
  0%, 100% { opacity: 1; }
  50%       { opacity: 0.6; }
}
  `
  document.head.appendChild(style)
}
