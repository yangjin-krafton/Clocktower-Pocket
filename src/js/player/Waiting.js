/**
 * P-02 Waiting — 대기 화면 (회전판 착석 현황)
 */
export class Waiting {
  constructor({ roomCode, playerName, mySeatId }) {
    this.roomCode    = roomCode
    this.playerName  = playerName  // 내부 식별용으로만 유지 (화면 미표시)
    this.mySeatId    = mySeatId || null
    this.seated      = []
    this.total       = 1
    this.el          = null
  }

  mount(container) {
    this.el = document.createElement('div')
    this.el.className = 'waiting-screen'
    this._render()
    container.appendChild(this.el)
  }

  unmount() { this.el?.remove() }

  updateSeats(seated, total) {
    this.seated = seated || []
    this.total  = total  || 1
    if (this.el) this._render()
  }

  _render() {
    const seated = this.seated
    const total  = this.total
    const size   = 260
    const cx     = size / 2
    const cy     = size / 2
    const r      = 100

    const seats = Array.from({ length: total }, (_, i) => {
      const seatNum = i + 1
      const angle = (i / total) * 2 * Math.PI - Math.PI / 2
      const x = cx + r * Math.cos(angle)
      const y = cy + r * Math.sin(angle)
      const player = seated[i] || null
      // mySeatId 우선, 없으면 이름으로 fallback
      const isMe = this.mySeatId
        ? seatNum === this.mySeatId
        : player?.name === this.playerName
      return { x, y, player, isMe, seatNum }
    })

    const svgSeats = seats.map(({ x, y, player, isMe, seatNum }) => {
      if (player) {
        const fill   = isMe ? '#d4a828' : '#5a3e8a'
        const stroke = isMe ? '#f0d060' : '#9b7ec8'
        return `
          <circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="18" fill="${fill}" stroke="${stroke}" stroke-width="2"/>
          <text x="${x.toFixed(1)}" y="${(y + 6).toFixed(1)}" text-anchor="middle"
            font-size="13" font-weight="700" fill="${isMe ? '#f0cc60' : '#fff'}" font-family="sans-serif">${seatNum}</text>
        `
      } else {
        return `
          <circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="16"
            fill="rgba(255,255,255,0.04)" stroke="rgba(255,255,255,0.15)" stroke-width="1.5" stroke-dasharray="4 3"/>
        `
      }
    }).join('')

    this.el.innerHTML = `
      <div class="waiting__header">
        <div class="waiting__room">방 코드: <span class="waiting__code">${this.roomCode}</span></div>
      </div>

      <svg class="waiting__wheel" viewBox="0 0 ${size} ${size}">
        <circle cx="${cx}" cy="${cy}" r="${r}" fill="none"
          stroke="rgba(255,255,255,0.06)" stroke-width="1"/>
        ${svgSeats}
      </svg>

      <div class="waiting__status">
        <div class="waiting__dot-row">
          <div class="waiting__dot"></div>
          <div class="waiting__dot" style="animation-delay:0.2s"></div>
          <div class="waiting__dot" style="animation-delay:0.4s"></div>
        </div>
        <div class="waiting__msg">호스트가 게임을 시작할 때까지 대기 중...</div>
        <div class="waiting__count">${seated.length} / ${total} 명 착석</div>
      </div>
    `
  }
}

if (!document.getElementById('waiting-style')) {
  const style = document.createElement('style')
  style.id = 'waiting-style'
  style.textContent = `
.waiting-screen {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 32px 20px 24px;
  gap: 16px;
}
.waiting__header { text-align: center; }
.waiting__name {
  font-family: 'Noto Serif KR', serif;
  font-size: 1.2rem;
  font-weight: 700;
  color: var(--text);
}
.waiting__room { font-size: 0.72rem; color: var(--text3); margin-top: 4px; }
.waiting__code { color: var(--gold2); font-weight: 700; letter-spacing: 0.1em; }
.waiting__wheel {
  display: block;
  width: min(80vw, 260px);
  height: auto;
  aspect-ratio: 1;
}
.waiting__status { text-align: center; }
.waiting__dot-row { display: flex; justify-content: center; gap: 8px; margin-bottom: 10px; }
.waiting__dot {
  width: 8px; height: 8px;
  border-radius: 50%;
  background: var(--pu-base);
  animation: dot-pulse 1.2s infinite;
}
.waiting__msg   { font-size: 0.82rem; color: var(--text2); }
.waiting__count { font-size: 0.7rem;  color: var(--text4); margin-top: 4px; }
  `
  document.head.appendChild(style)
}
