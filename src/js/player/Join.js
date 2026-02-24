/**
 * P-01 Join — 방 참가 화면
 */
export class Join {
  constructor({ onJoin }) {
    this.onJoin = onJoin
    this.el = null
  }

  mount(container) {
    this.el = document.createElement('div')
    this.el.className = 'join-screen'
    this._render()
    container.appendChild(this.el)
  }

  unmount() { this.el?.remove() }

  _render() {
    // URL에서 코드 자동 감지
    const urlCode = new URLSearchParams(location.search).get('code') || ''

    this.el.innerHTML = `
      <div class="join__logo">🏰</div>
      <h1 class="join__title">Clocktower Pocket</h1>
      <p class="join__sub">참가자로 입장</p>

      <div class="card join__form">
        ${urlCode ? `<div class="join__code-notice">🔗 방 코드 자동 입력됨: <b>${urlCode}</b></div>` : ''}

        <div class="join__field">
          <div class="section-label">닉네임</div>
          <input id="join-name" class="input" type="text" placeholder="이름을 입력하세요" maxlength="12" value="">
        </div>

        <div class="join__field">
          <div class="section-label">방 코드</div>
          <input id="join-code" class="input" type="text" placeholder="6자리 코드" maxlength="6"
            value="${urlCode}" style="text-transform:uppercase;letter-spacing:0.15em;font-size:1.1rem;text-align:center">
        </div>

        <button id="join-btn" class="btn btn-primary btn-full" style="padding:14px;font-size:0.95rem;margin-top:8px;">
          🚪 참가하기
        </button>
      </div>
    `

    const nameInput = this.el.querySelector('#join-name')
    const codeInput = this.el.querySelector('#join-code')
    const joinBtn   = this.el.querySelector('#join-btn')

    // 코드 대문자 강제
    codeInput.addEventListener('input', () => {
      codeInput.value = codeInput.value.toUpperCase()
    })

    // Enter 키 지원
    const tryJoin = () => {
      const name = nameInput.value.trim()
      const code = codeInput.value.trim().toUpperCase()
      if (!name) { nameInput.focus(); return }
      if (code.length !== 6) { codeInput.focus(); return }
      this.onJoin && this.onJoin(name, code)
    }

    nameInput.addEventListener('keydown', e => e.key === 'Enter' && tryJoin())
    codeInput.addEventListener('keydown', e => e.key === 'Enter' && tryJoin())
    joinBtn.addEventListener('click', tryJoin)

    // 자동 포커스
    setTimeout(() => (urlCode ? nameInput : nameInput).focus(), 100)
  }
}

if (!document.getElementById('join-style')) {
  const style = document.createElement('style')
  style.id = 'join-style'
  style.textContent = `
.join-screen {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 40px 20px 24px;
  gap: 8px;
}
.join__logo { font-size: 3rem; }
.join__title {
  font-family: 'Noto Serif KR', serif;
  font-size: 1.4rem;
  font-weight: 700;
  color: var(--gold2);
  text-shadow: 0 0 20px rgba(212,168,40,0.3);
}
.join__sub { font-size: 0.72rem; color: var(--text3); }
.join__form { width: 100%; margin-top: 16px; }
.join__field { margin-bottom: 12px; }
.join__code-notice {
  background: rgba(91,179,198,0.1);
  border: 1px solid rgba(91,179,198,0.3);
  border-radius: 6px;
  padding: 8px 10px;
  font-size: 0.72rem;
  color: var(--tl-light);
  margin-bottom: 12px;
}
  `
  document.head.appendChild(style)
}
