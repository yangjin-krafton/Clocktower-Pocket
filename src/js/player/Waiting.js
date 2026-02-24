/**
 * P-02 Waiting — 대기 화면
 * 호스트가 게임 시작할 때까지 대기
 */
export class Waiting {
  constructor({ roomCode, playerName }) {
    this.roomCode   = roomCode
    this.playerName = playerName
    this.playerCount = 1
    this.el = null
  }

  mount(container) {
    this.el = document.createElement('div')
    this.el.className = 'waiting-screen'
    this._render()
    container.appendChild(this.el)
  }

  unmount() { this.el?.remove() }

  setPlayerCount(n) {
    this.playerCount = n
    this._render()
  }

  _render() {
    this.el.innerHTML = `
      <div class="waiting__logo">🏰</div>
      <div class="waiting__name">${this.playerName}</div>
      <div class="waiting__room">방 코드: <span class="waiting__code">${this.roomCode}</span></div>

      <div class="card waiting__card">
        <div class="waiting__dot-row">
          <div class="waiting__dot"></div>
          <div class="waiting__dot" style="animation-delay:0.2s"></div>
          <div class="waiting__dot" style="animation-delay:0.4s"></div>
        </div>
        <div class="waiting__status">호스트가 게임을 시작할 때까지 대기 중...</div>
        <div class="waiting__count">현재 ${this.playerCount}명 연결됨</div>
      </div>

      <div class="waiting__hint">눈을 감고 대기해주세요<br>게임이 시작되면 안내드립니다</div>
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
  padding: 48px 20px;
  gap: 10px;
}
.waiting__logo { font-size: 2.8rem; }
.waiting__name {
  font-family: 'Noto Serif KR', serif;
  font-size: 1.3rem;
  font-weight: 700;
  color: var(--text);
}
.waiting__room { font-size: 0.72rem; color: var(--text3); }
.waiting__code { color: var(--gold2); font-weight: 700; letter-spacing: 0.1em; }
.waiting__card {
  width: 100%;
  text-align: center;
  padding: 20px;
  margin-top: 10px;
}
.waiting__dot-row { display: flex; justify-content: center; gap: 8px; margin-bottom: 14px; }
.waiting__dot {
  width: 10px; height: 10px;
  border-radius: 50%;
  background: var(--pu-base);
  animation: dot-pulse 1.2s infinite;
}
.waiting__status { font-size: 0.82rem; color: var(--text2); }
.waiting__count { font-size: 0.65rem; color: var(--text4); margin-top: 6px; }
.waiting__hint {
  font-size: 0.68rem;
  color: var(--text4);
  text-align: center;
  line-height: 1.6;
  margin-top: 8px;
}
  `
  document.head.appendChild(style)
}
