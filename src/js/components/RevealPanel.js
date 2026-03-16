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
  const { roleIcon, roleName, roleTeam, roleAbility, message, players = [], hint, action, onNext } = data

  const overlay = document.createElement('div')
  overlay.className = 'reveal-overlay'

  const panel = document.createElement('div')
  panel.className = 'reveal-panel'

  const tc = TEAM_COLORS[roleTeam] || TEAM_COLORS.default
  panel.style.background = `radial-gradient(ellipse 90% 60% at 50% 20%, ${tc.glow} 0%, transparent 65%)`

  // ── 상단: 참가자 화면 + 야간 상황 안내 ──
  const topBar = document.createElement('div')
  topBar.className = 'reveal__top-bar'
  topBar.innerHTML = `<span class="reveal__label-chip">👁 참가자 화면</span><span class="reveal__label-night">🌙 밤 — 역할 정보 수령</span>`
  panel.appendChild(topBar)

  // ── 역할 아이콘 (작게) + 역할명 한 줄 ──
  const headerRow = document.createElement('div')
  headerRow.style.cssText = 'display:flex;align-items:center;gap:12px;width:100%;max-width:360px;'

  const iconEl = document.createElement('div')
  if (roleIcon && roleIcon.endsWith('.png')) {
    iconEl.className = 'reveal__icon reveal__icon--token'
    iconEl.style.cssText = 'width:48px;height:48px;flex-shrink:0;'
    iconEl.innerHTML = `
      <img class="reveal__token-bg"   src="./asset/token.png" alt="">
      <img class="reveal__token-icon" src="./asset/icons/${roleIcon}" alt="${roleName}">
    `
  } else {
    iconEl.style.cssText = 'font-size:2rem;flex-shrink:0;'
    iconEl.textContent = roleIcon || '🎴'
  }
  headerRow.appendChild(iconEl)

  const nameEl = document.createElement('div')
  nameEl.className = 'reveal__name'
  nameEl.style.cssText = `font-size:1.4rem;text-align:left;color:${tc.color};text-shadow:0 0 20px ${tc.shadow};`
  nameEl.textContent = roleName
  headerRow.appendChild(nameEl)

  panel.appendChild(headerRow)

  // ── 규칙 설명 (능력 텍스트) ──
  if (roleAbility) {
    const abilityEl = document.createElement('div')
    abilityEl.className = 'reveal__ability'
    abilityEl.textContent = roleAbility
    panel.appendChild(abilityEl)
  }

  // ── 번호 칩 (message 앞에 배치 — 중요 대상을 먼저 인식) ──
  if (players.length > 0) {
    const chipsEl = document.createElement('div')
    chipsEl.className = 'reveal__players'
    players.forEach(p => {
      const chip = document.createElement('div')
      chip.className = 'reveal__num-chip'
      chip.style.borderColor = tc.color
      chip.innerHTML = `
        <span class="reveal__num-val">${p.id}</span>
        <span class="reveal__num-unit">번</span>
      `
      chipsEl.appendChild(chip)
    })
    panel.appendChild(chipsEl)
  }

  // ── 정보 메시지 ──
  if (message) {
    const msgEl = document.createElement('div')
    msgEl.className = 'reveal__msg'
    msgEl.style.borderColor = `color-mix(in srgb, ${tc.color} 30%, transparent)`
    msgEl.textContent = message
    panel.appendChild(msgEl)
  }

  // ── 이후 행동 안내 ──
  const actionText = action || '확인했으면 눈을 감고 손을 내려주세요'
  const actionEl = document.createElement('div')
  actionEl.className = 'reveal__action-card'
  actionEl.innerHTML = `<span class="reveal__action-icon">→</span><span class="reveal__action-text">${actionText}</span>`
  panel.appendChild(actionEl)

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
  inset: 0 0 56px 0;
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
  padding: 16px 24px 20px;
  gap: 14px;
}

/* 상단 바 */
.reveal__top-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  max-width: 360px;
  flex-shrink: 0;
}
.reveal__label-chip {
  font-size: 0.6rem;
  color: var(--text4);
  background: var(--surface2);
  border: 1px solid var(--lead2);
  border-radius: 10px;
  padding: 2px 8px;
  letter-spacing: 0.04em;
}
.reveal__label-night {
  font-size: 0.6rem;
  color: var(--pu-light);
  opacity: 0.8;
  letter-spacing: 0.04em;
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
/* token 오버레이 모드 */
.reveal__icon--token {
  position: relative;
  font-size: 0;
  filter: drop-shadow(0 0 20px rgba(212,168,40,0.4));
}
.reveal__token-bg,
.reveal__token-icon {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
}
.reveal__token-icon { object-fit: contain; }
.reveal__name {
  font-family: 'Noto Serif KR', serif;
  font-size: 2rem;
  font-weight: 700;
  text-align: center;
  line-height: 1.2;
}
/* 규칙 설명 */
.reveal__ability {
  width: 100%;
  max-width: 360px;
  font-size: 0.82rem;
  color: var(--text2);
  line-height: 1.65;
  background: var(--surface);
  border: 1px solid var(--lead2);
  border-radius: 10px;
  padding: 12px 16px;
  word-break: keep-all;
  text-align: center;
}

/* 안내 카드 */
.reveal__hint-card {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  width: 100%;
  max-width: 360px;
  background: var(--surface2);
  border: 1px solid var(--lead2);
  border-radius: 10px;
  padding: 10px 14px;
}
.reveal__hint-icon { font-size: 0.9rem; flex-shrink: 0; margin-top: 1px; }
.reveal__hint-text {
  font-size: 0.75rem;
  color: var(--text2);
  line-height: 1.55;
  word-break: keep-all;
}

/* 번호 칩 */
.reveal__players {
  display: flex;
  justify-content: center;
  gap: 12px;
  flex-wrap: wrap;
}
.reveal__num-chip {
  width: 60px;
  height: 60px;
  border-radius: 50%;
  background: var(--surface);
  border: 2px solid var(--lead2);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 1px;
  box-shadow: 0 0 12px rgba(0,0,0,0.2);
  transition: border-color 0.2s;
}
.reveal__num-val {
  font-size: 1.9rem;
  font-weight: 700;
  color: var(--gold2);
  line-height: 1;
}
.reveal__num-unit {
  font-size: 0.58rem;
  color: var(--text4);
  line-height: 1;
}

/* 메시지 */
.reveal__msg {
  font-size: 1.45rem;
  color: var(--text);
  text-align: center;
  line-height: 1.55;
  background: var(--surface);
  border: 1px solid rgba(92,83,137,0.3);
  border-radius: 16px;
  padding: 18px 22px;
  width: 100%;
  max-width: 340px;
  word-break: keep-all;
  white-space: pre-line;
}

/* 이후 행동 안내 */
.reveal__action-card {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  max-width: 360px;
  background: color-mix(in srgb, var(--pu-base) 10%, var(--surface));
  border: 1px solid color-mix(in srgb, var(--pu-base) 30%, transparent);
  border-radius: 10px;
  padding: 10px 14px;
}
.reveal__action-icon {
  font-size: 0.85rem;
  color: var(--pu-light);
  flex-shrink: 0;
  font-weight: 700;
}
.reveal__action-text {
  font-size: 0.75rem;
  color: var(--pu-light);
  font-weight: 600;
  line-height: 1.45;
  word-break: keep-all;
}

/* 다음 버튼 */
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
