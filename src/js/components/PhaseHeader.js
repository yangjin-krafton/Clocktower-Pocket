/**
 * C-04 PhaseHeader — 페이즈 헤더 띠
 * @param {Object} state  { phase, round, players }
 * @returns {HTMLElement}
 */
export function renderPhaseHeader(state) {
  const { phase, round, players = [] } = state
  const aliveCount = players.filter(p => p.status === 'alive').length

  const el = document.createElement('div')
  el.className = `phase-header phase-header--${phase}`

  const icon = phase === 'night' ? '🌙' : phase === 'day' ? '🌅' : '🏰'
  const roundText = phase === 'night'
    ? `${round}번째 밤`
    : phase === 'day'
    ? `${round}일째`
    : '대기 중'

  el.innerHTML = `
    <span class="phase-header__icon">${icon}</span>
    <div class="phase-header__text">
      <span class="phase-header__name">${roundText}</span>
      <span class="phase-header__sub">${phase === 'night' ? '밤 진행 중' : phase === 'day' ? '낮 토론 중' : ''}</span>
    </div>
    <div class="phase-header__alive">
      <span class="phase-header__alive-num">${aliveCount}</span>
      <span class="phase-header__alive-lbl">생존</span>
    </div>
  `

  return el
}

if (!document.getElementById('phase-header-style')) {
  const style = document.createElement('style')
  style.id = 'phase-header-style'
  style.textContent = `
.phase-header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  border-radius: 10px;
  margin-bottom: 10px;
  border: 1px solid var(--lead2);
}
.phase-header--night { background: rgba(92,83,137,0.12); border-color: rgba(92,83,137,0.3); }
.phase-header--day   { background: rgba(91,179,198,0.08); border-color: rgba(91,179,198,0.25); }
.phase-header--lobby { background: var(--surface); }
.phase-header__icon { font-size: 1.3rem; flex-shrink: 0; }
.phase-header__text { flex: 1; }
.phase-header__name {
  display: block;
  font-family: 'Noto Serif KR', serif;
  font-size: 0.92rem;
  font-weight: 700;
  color: var(--text);
  line-height: 1.2;
}
.phase-header__sub { font-size: 0.6rem; color: var(--text3); }
.phase-header__alive {
  display: flex;
  flex-direction: column;
  align-items: center;
  flex-shrink: 0;
}
.phase-header__alive-num {
  font-family: 'Noto Serif KR', serif;
  font-size: 1.1rem;
  font-weight: 700;
  color: var(--gold2);
  line-height: 1;
}
.phase-header__alive-lbl { font-size: 0.5rem; color: var(--text4); }
  `
  document.head.appendChild(style)
}
