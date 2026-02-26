/**
 * C-07 RevealPanel — 참가자 공개 전용 화면
 *
 * 호스트가 참가자에게 핸드폰을 보여줄 때 사용.
 * - 역할명, 아이콘, 정보 메시지, 번호 칩만 표시 (이름/역할 아이콘 없음)
 * - "[호스트] 다음 →" 버튼 하단 고정
 * - z-index: 210 (InfoPanel 위)
 *
 * @param {Object} data
 *   roleIcon  {string}    역할 아이콘 (emoji or PNG 파일명)
 *   roleName  {string}    역할명 (역할 타이틀)
 *   roleTeam  {string}    진영 ('town'|'outside'|'minion'|'demon'|null)
 *   message   {string}    참가자에게 보여줄 정보 텍스트
 *   players   {Object[]}  번호 칩으로 표시할 플레이어 — { id } 만 사용
 *   onNext    {Function}  "[호스트] 다음 →" 버튼 콜백
 */

const TEAM_COLORS = {
  town:    { color: 'var(--bl-light)',  shadow: 'rgba(46,74,143,0.5)',   glow: 'rgba(46,74,143,0.15)' },
  outside: { color: 'var(--tl-light)',  shadow: 'rgba(91,179,198,0.5)',  glow: 'rgba(91,179,198,0.12)' },
  minion:  { color: 'var(--rd-light)',  shadow: 'rgba(140,48,48,0.6)',   glow: 'rgba(140,48,48,0.18)' },
  demon:   { color: 'var(--rd-light)',  shadow: 'rgba(110,27,31,0.8)',   glow: 'rgba(110,27,31,0.22)' },
  default: { color: 'var(--gold2)',     shadow: 'rgba(212,168,40,0.4)',  glow: 'rgba(212,168,40,0.1)' },
}

export function mountRevealPanel(data) {
  const { roleIcon, roleName, roleTeam, message, players = [], onNext } = data

  const overlay = document.createElement('div')
  overlay.className = 'reveal-overlay'

  const panel = document.createElement('div')
  panel.className = 'reveal-panel'

  const tc = TEAM_COLORS[roleTeam] || TEAM_COLORS.default
  panel.style.background = `radial-gradient(ellipse 90% 60% at 50% 20%, ${tc.glow} 0%, transparent 65%)`

  // ── 상단 힌트 라벨 (호스트용, 거의 안 보임) ──
  const label = document.createElement('div')
  label.className = 'reveal__label'
  label.textContent = '👁 참가자 화면'
  panel.appendChild(label)

  // ── 역할 아이콘 ──
  const iconEl = document.createElement('div')
  iconEl.className = 'reveal__icon'
  if (roleIcon && roleIcon.endsWith('.png')) {
    const img = document.createElement('img')
    img.src = `./asset/icons/${roleIcon}`
    img.alt = roleName
    img.className = 'reveal__icon-img'
    iconEl.appendChild(img)
  } else {
    iconEl.textContent = roleIcon || '🎴'
  }
  panel.appendChild(iconEl)

  // ── 역할명 ──
  const nameEl = document.createElement('div')
  nameEl.className = 'reveal__name'
  nameEl.textContent = roleName
  nameEl.style.color      = tc.color
  nameEl.style.textShadow = `0 0 20px ${tc.shadow}`
  panel.appendChild(nameEl)

  // ── 정보 메시지 ──
  if (message) {
    const msgEl = document.createElement('div')
    msgEl.className = 'reveal__msg'
    msgEl.textContent = message
    panel.appendChild(msgEl)
  }

  // ── 번호 칩 (이름 없음, 번호만) ──
  if (players.length > 0) {
    const chipsEl = document.createElement('div')
    chipsEl.className = 'reveal__players'
    players.forEach(p => {
      const chip = document.createElement('div')
      chip.className = 'reveal__num-chip'
      chip.innerHTML = `
        <span class="reveal__num-val">${p.id}</span>
        <span class="reveal__num-unit">번</span>
      `
      chipsEl.appendChild(chip)
    })
    panel.appendChild(chipsEl)
  }

  // ── [호스트] 다음 버튼 ──
  const nextBtn = document.createElement('button')
  nextBtn.className = 'reveal__next btn btn-primary'
  nextBtn.textContent = '[ 호스트 ] 다음 →'
  nextBtn.addEventListener('click', () => {
    overlay.remove()
    onNext && onNext()
  })
  panel.appendChild(nextBtn)

  overlay.appendChild(panel)
  document.body.appendChild(overlay)

  return () => overlay.remove()
}

if (!document.getElementById('reveal-panel-style')) {
  const style = document.createElement('style')
  style.id = 'reveal-panel-style'
  style.textContent = `
.reveal-overlay {
  position: fixed;
  inset: 0;
  background: var(--bg);
  z-index: 210;
  display: flex;
  align-items: stretch;
}
.reveal-panel {
  width: 100%;
  max-width: var(--app-max-width);
  margin: 0 auto;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 32px 24px 24px;
  gap: 20px;
}
.reveal__label {
  position: absolute;
  top: 12px;
  left: 50%;
  transform: translateX(-50%);
  font-size: 0.62rem;
  color: var(--text4);
  letter-spacing: 0.05em;
  white-space: nowrap;
  pointer-events: none;
}
.reveal__icon {
  font-size: 5rem;
  line-height: 1;
  width: 80px;
  height: 80px;
  display: flex;
  align-items: center;
  justify-content: center;
  filter: drop-shadow(0 0 20px rgba(212,168,40,0.5));
}
.reveal__icon-img {
  width: 100%;
  height: 100%;
  object-fit: contain;
  filter: drop-shadow(0 0 16px rgba(212,168,40,0.5));
}
.reveal__name {
  font-family: 'Noto Serif KR', serif;
  font-size: 2rem;
  font-weight: 700;
  text-align: center;
  line-height: 1.2;
}
.reveal__msg {
  font-size: 1.6rem;
  color: var(--text);
  text-align: center;
  line-height: 1.5;
  background: var(--surface);
  border: 1px solid rgba(92,83,137,0.3);
  border-radius: 16px;
  padding: 20px 24px;
  width: 100%;
  max-width: 340px;
  word-break: keep-all;
  white-space: pre-line;
}
.reveal__players {
  display: flex;
  justify-content: center;
  gap: 12px;
  flex-wrap: wrap;
}
.reveal__num-chip {
  width: 56px;
  height: 56px;
  border-radius: 50%;
  background: var(--surface);
  border: 2px solid var(--lead2);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 1px;
}
.reveal__num-val {
  font-size: 1.8rem;
  font-weight: 700;
  color: var(--gold2);
  line-height: 1;
}
.reveal__num-unit {
  font-size: 0.58rem;
  color: var(--text4);
  line-height: 1;
}
.reveal__next {
  width: 100%;
  max-width: 300px;
  padding: 16px;
  font-size: 0.9rem;
  font-weight: 700;
  border-radius: 12px;
  min-height: 56px;
  opacity: 0.65;
}
.reveal__next:hover { opacity: 1; }
  `
  document.head.appendChild(style)
}
