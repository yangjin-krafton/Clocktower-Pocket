/**
 * H-Pre PreGame — 입장 대기 화면
 * 방 생성 직후 즉시 보이는 인게임 스타일 착석 화면
 * 플레이어들이 들어올 때마다 자리가 채워지고, 전원 착석 시 카운트다운
 */
export class PreGame {
  constructor({ roomCode, total }) {
    this.roomCode = roomCode
    this.total    = total
    this.seated   = [] // { name, seatNum }
    this.countdown = null
    this.el        = null
    this._timer    = null
  }

  mount(container) {
    this.el = document.createElement('div')
    this.el.className = 'pregame-screen'
    this._render()
    container.appendChild(this.el)
  }

  unmount() {
    if (this._timer) clearInterval(this._timer)
    this.el?.remove()
  }

  /** 착석 현황 갱신 */
  updateSeats(players) {
    this.seated = players.map((p, i) => ({ name: p.name, seatNum: i + 1 }))
    this._render()
  }

  /** 카운트다운 시작, 0이 되면 onDone 콜백 */
  startCountdown(seconds, onDone) {
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

  _render() {
    if (!this.el) return
    const filled    = this.seated.length
    const total     = this.total
    const allSeated = filled >= total
    const counting  = this.countdown !== null && this.countdown > 0

    const seatItems = Array.from({ length: total }, (_, i) => {
      const p = this.seated[i]
      if (p) {
        return `
          <div class="pregame__seat pregame__seat--filled">
            <span class="pregame__seat-num">${i + 1}</span>
            <span class="pregame__seat-name">${p.name}</span>
          </div>`
      }
      return `
        <div class="pregame__seat pregame__seat--empty">
          <span class="pregame__seat-num">${i + 1}</span>
          <span class="pregame__seat-waiting">–</span>
        </div>`
    }).join('')

    let statusSection = ''
    if (counting) {
      statusSection = `
        <div class="card pregame__countdown-card">
          <div class="pregame__countdown-num">${this.countdown}</div>
          <div class="pregame__countdown-label">초 후 게임 시작</div>
        </div>`
    } else if (allSeated) {
      statusSection = `
        <div class="card pregame__ready-card">
          <div style="font-size:1.6rem">⚔️</div>
          <div style="font-size:0.88rem;color:var(--text2);margin-top:6px">전원 착석 완료 — 게임 준비 중...</div>
        </div>`
    } else {
      statusSection = `
        <div class="pregame__hint">
          참가자들이 입장할 때까지 대기 중입니다
        </div>`
    }

    this.el.innerHTML = `
      <div class="card pregame__code-card">
        <div class="section-label">방 코드</div>
        <div class="pregame__code">${this.roomCode}</div>
        <div class="pregame__progress">
          <span class="pregame__progress-filled">${filled}</span>
          <span class="pregame__progress-sep"> / </span>
          <span>${total}명 입장</span>
        </div>
      </div>

      <div class="card">
        <div class="card-title">🪑 플레이어 착석</div>
        <div class="pregame__seats">${seatItems}</div>
      </div>

      ${statusSection}
    `
  }
}

if (!document.getElementById('pregame-style')) {
  const style = document.createElement('style')
  style.id = 'pregame-style'
  style.textContent = `
.pregame-screen { display: flex; flex-direction: column; gap: 10px; }

.pregame__code-card { text-align: center; }
.pregame__code {
  font-family: 'Noto Serif KR', serif;
  font-size: 2.4rem;
  font-weight: 700;
  color: var(--gold2);
  letter-spacing: 0.15em;
  margin: 8px 0;
  text-shadow: 0 0 20px rgba(212,168,40,0.4);
}
.pregame__progress {
  font-size: 0.75rem;
  color: var(--text3);
}
.pregame__progress-filled {
  font-weight: 700;
  color: var(--tl-light);
  font-size: 1rem;
}

.pregame__seats {
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.pregame__seat {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 4px;
  border-bottom: 1px solid var(--lead2);
  border-radius: 4px;
  transition: background 0.2s;
}
.pregame__seat:last-child { border-bottom: none; }
.pregame__seat--filled { background: rgba(91,179,198,0.06); }
.pregame__seat--empty   { opacity: 0.45; }

.pregame__seat-num {
  width: 22px; height: 22px;
  border-radius: 50%;
  background: var(--lead2);
  display: flex; align-items: center; justify-content: center;
  font-size: 0.65rem; font-weight: 700;
  color: var(--text3);
  flex-shrink: 0;
}
.pregame__seat--filled .pregame__seat-num {
  background: var(--tl-base);
  color: #fff;
}
.pregame__seat-name {
  font-size: 0.88rem;
  color: var(--text);
  font-weight: 600;
}
.pregame__seat-waiting {
  font-size: 0.78rem;
  color: var(--text4);
}

.pregame__hint {
  text-align: center;
  font-size: 0.72rem;
  color: var(--text4);
  padding: 10px 0;
}

.pregame__countdown-card {
  text-align: center;
  padding: 20px;
  background: rgba(212,168,40,0.08);
  border: 1px solid rgba(212,168,40,0.3);
}
.pregame__countdown-num {
  font-family: 'Noto Serif KR', serif;
  font-size: 3rem;
  font-weight: 700;
  color: var(--gold2);
  line-height: 1;
  animation: pregame-pulse 1s ease-in-out infinite;
}
.pregame__countdown-label {
  font-size: 0.8rem;
  color: var(--text3);
  margin-top: 8px;
}
@keyframes pregame-pulse {
  0%, 100% { opacity: 1; transform: scale(1); }
  50%       { opacity: 0.7; transform: scale(0.95); }
}

.pregame__ready-card {
  text-align: center;
  padding: 20px;
  background: rgba(91,179,198,0.08);
  border: 1px solid rgba(91,179,198,0.3);
}
  `
  document.head.appendChild(style)
}
