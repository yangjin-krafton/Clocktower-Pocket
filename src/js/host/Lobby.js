/**
 * H-02 Lobby — 대기실
 * 방 코드 표시 + 참가자 연결 대기 + 게임 시작
 */
export class Lobby {
  constructor({ roomCode, onStartGame, onPlayerNameEdit }) {
    this.roomCode = roomCode
    this.onStartGame = onStartGame
    this.onPlayerNameEdit = onPlayerNameEdit
    this.connectedPlayers = [] // { peerId, name, joinedAt }
    this.playerNames = []       // 좌석 순서 이름 목록 (최종)
    this.el = null
  }

  mount(container) {
    this.el = document.createElement('div')
    this.el.className = 'lobby-screen'
    this._render()
    container.appendChild(this.el)
  }

  unmount() { this.el?.remove() }

  addPlayer(peerId, name) {
    if (!this.connectedPlayers.find(p => p.peerId === peerId)) {
      this.connectedPlayers.push({ peerId, name, joinedAt: Date.now() })
      this._render()
    }
  }

  removePlayer(peerId) {
    this.connectedPlayers = this.connectedPlayers.filter(p => p.peerId !== peerId)
    this._render()
  }

  _render() {
    this.el.innerHTML = ''

    // 방 코드
    const codeSection = document.createElement('div')
    codeSection.className = 'card lobby__code-card'
    codeSection.innerHTML = `
      <div class="section-label">방 코드</div>
      <div class="lobby__code">${this.roomCode}</div>
      <div class="lobby__code-hint">참가자에게 이 코드를 알려주세요</div>
    `
    this.el.appendChild(codeSection)

    // 참가자 목록
    const listSection = document.createElement('div')
    listSection.className = 'card'
    listSection.innerHTML = `<div class="card-title">👥 참가자 (${this.connectedPlayers.length}명 연결됨)</div>`

    if (this.connectedPlayers.length === 0) {
      const empty = document.createElement('div')
      empty.className = 'lobby__empty'
      empty.innerHTML = `
        <div class="lobby__waiting-dot"></div>
        <span>참가자 연결 대기 중...</span>
      `
      listSection.appendChild(empty)
    } else {
      this.connectedPlayers.forEach((p, idx) => {
        const row = document.createElement('div')
        row.className = 'lobby__player-row'

        const seat = document.createElement('span')
        seat.className = 'lobby__seat'
        seat.textContent = idx + 1

        const nameInput = document.createElement('input')
        nameInput.className = 'input lobby__name-input'
        nameInput.value = p.name
        nameInput.maxLength = 12
        nameInput.placeholder = '닉네임'
        nameInput.addEventListener('change', () => {
          p.name = nameInput.value.trim() || p.name
          this.onPlayerNameEdit && this.onPlayerNameEdit(p.peerId, p.name)
        })

        const status = document.createElement('span')
        status.className = 'badge badge-alive'
        status.textContent = '연결됨'

        row.appendChild(seat)
        row.appendChild(nameInput)
        row.appendChild(status)
        listSection.appendChild(row)
      })
    }
    this.el.appendChild(listSection)

    // 시작 버튼
    const canStart = this.connectedPlayers.length >= 5
    const startBtn = document.createElement('button')
    startBtn.className = 'btn btn-gold btn-full'
    startBtn.style.fontSize = '1rem'
    startBtn.style.padding = '16px'
    startBtn.textContent = `🏰 게임 시작 (${this.connectedPlayers.length}명)`
    startBtn.disabled = !canStart
    if (!canStart) {
      startBtn.style.opacity = '0.5'
      const hint = document.createElement('div')
      hint.className = 'text-center text-small text-muted mt-8'
      hint.textContent = `최소 5명 필요 (현재 ${this.connectedPlayers.length}명)`
      this.el.appendChild(hint)
    }
    startBtn.addEventListener('click', () => {
      const names = this.connectedPlayers.map(p => p.name)
      this.onStartGame && this.onStartGame(names, this.connectedPlayers.map(p => p.peerId))
    })
    this.el.appendChild(startBtn)
  }
}

if (!document.getElementById('lobby-style')) {
  const style = document.createElement('style')
  style.id = 'lobby-style'
  style.textContent = `
.lobby-screen { display: flex; flex-direction: column; gap: 10px; }
.lobby__code-card { text-align: center; }
.lobby__code {
  font-family: 'Noto Serif KR', serif;
  font-size: 2.4rem;
  font-weight: 700;
  color: var(--gold2);
  letter-spacing: 0.15em;
  margin: 8px 0;
  text-shadow: 0 0 20px rgba(212,168,40,0.4);
}
.lobby__code-hint { font-size: 0.65rem; color: var(--text4); }
.lobby__empty {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 0;
  color: var(--text3);
  font-size: 0.78rem;
}
.lobby__waiting-dot {
  width: 8px; height: 8px;
  border-radius: 50%;
  background: var(--pu-base);
  animation: dot-pulse 1.2s infinite;
  flex-shrink: 0;
}
.lobby__player-row {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 0;
  border-bottom: 1px solid var(--lead2);
}
.lobby__player-row:last-child { border-bottom: none; }
.lobby__seat {
  width: 30px;
  height: 30px;
  border-radius: 50%;
  background: rgba(212,168,40,0.12);
  border: 1px solid rgba(212,168,40,0.4);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.88rem;
  color: var(--gold2);
  font-weight: 700;
  flex-shrink: 0;
}
.lobby__name-input {
  flex: 1;
  padding: 6px 8px;
  font-size: 0.82rem;
}
  `
  document.head.appendChild(style)
}
