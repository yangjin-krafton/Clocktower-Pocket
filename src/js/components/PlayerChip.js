/**
 * C-01 PlayerChip — 플레이어 역할 토큰 카드
 *
 * dict__token 카드 디자인 기반:
 *   - 둥근 직사각형 카드, 진영별 테두리 색
 *   - 원형 아이콘 영역 (dict__token-icon)
 *   - 이름 / 역할명 텍스트
 *   - 선택·사망·독·취함 상태 표시
 *
 * @param {Object} player  { id, name, role, team, status, isPoisoned, isDrunk }
 * @param {Object} opts    { selectable, selected, onClick, showRole, compact, roleIcon, roleIconEmoji, roleTeam }
 * @returns {HTMLElement}
 */
export function renderPlayerChip(player, opts = {}) {
  const {
    selectable    = false,
    selected      = false,
    onClick,
    showRole      = false,
    compact       = false,
    roleIcon      = '',
    roleIconEmoji = '',
    roleTeam      = null,   // townsfolk | outsider | minion | demon
  } = opts

  // 진영 → dict__token 팀 클래스 결정
  const tokenTeam = roleTeam || _inferTeam(player)

  const dead     = player.status !== 'alive'
  const executed = player.status === 'executed'

  const el = document.createElement('div')
  el.className = 'player-chip'
    + ` dict__token dict__token--${tokenTeam}`
    + (selectable      ? ' player-chip--selectable' : '')
    + (selected        ? ' player-chip--selected'   : '')
    + (dead            ? ' player-chip--dead'        : '')
    + (executed        ? ' player-chip--executed'    : '')
    + (player.isPoisoned ? ' player-chip--poisoned'  : '')
  el.dataset.id = player.id

  // ── 자리 번호 배지 (카드 우상단) ─────────────────────────
  const seatEl = document.createElement('div')
  seatEl.className = 'player-chip__seat'
  seatEl.textContent = player.id
  el.appendChild(seatEl)

  // ── 아이콘 영역 (dict__token-icon, 원형) ─────────────────
  const iconWrap = document.createElement('div')
  iconWrap.className = 'dict__token-icon player-chip__icon-wrap'

  if (roleIcon && roleIcon.endsWith('.png')) {
    const img = document.createElement('img')
    img.src = `./asset/new/Icon_${roleIcon}`
    img.alt = `${player.id}번`
    iconWrap.appendChild(img)
  } else if (roleIconEmoji) {
    iconWrap.textContent = roleIconEmoji
  } else if (roleIcon && roleIcon !== '?') {
    iconWrap.textContent = roleIcon
  } else if (dead) {
    iconWrap.textContent = '💀'
  } else {
    iconWrap.innerHTML = '<span style="color:var(--text4);font-size:1rem;">?</span>'
  }

  // 독 뱃지 + 파티클
  if (player.isPoisoned) {
    const badge = document.createElement('div')
    badge.className = 'player-chip__badge player-chip__badge--poison'
    badge.textContent = '☠'
    iconWrap.appendChild(badge)

    // 파티클 (7개, 위치·딜레이 분산)
    const PARTICLES = [
      { left: '18%', delay: '0s',    dur: '1.6s', color: '#4ade80' },
      { left: '50%', delay: '0.3s',  dur: '1.3s', color: '#a855f7' },
      { left: '78%', delay: '0.6s',  dur: '1.8s', color: '#4ade80' },
      { left: '32%', delay: '0.9s',  dur: '1.4s', color: '#a855f7' },
      { left: '64%', delay: '0.2s',  dur: '1.7s', color: '#86efac' },
      { left: '10%', delay: '1.1s',  dur: '1.5s', color: '#c084fc' },
      { left: '88%', delay: '0.7s',  dur: '1.2s', color: '#4ade80' },
    ]
    PARTICLES.forEach(p => {
      const particle = document.createElement('span')
      particle.className = 'poison-particle'
      particle.style.cssText = `left:${p.left};animation-delay:${p.delay};animation-duration:${p.dur};background:${p.color};`
      el.appendChild(particle)
    })
  }
  // 취함 뱃지
  if (player.isDrunk) {
    const badge = document.createElement('div')
    badge.className = 'player-chip__badge player-chip__badge--drunk'
    badge.textContent = '🍾'
    iconWrap.appendChild(badge)
  }

  el.appendChild(iconWrap)

  // 이름 표시 제거 — 자리번호는 player-chip__seat 뱃지로 표시됨

  // ── 역할명 (옵션) ─────────────────────────────────────────
  if (showRole && player.role && !compact) {
    const roleEl = document.createElement('div')
    roleEl.className = 'player-chip__role'
    roleEl.textContent = player.role
    el.appendChild(roleEl)
  }

  if (selectable && onClick) {
    el.addEventListener('click', () => onClick(player.id))
  }

  return el
}

function _inferTeam(player) {
  const outsiderRoles = new Set(['butler','drunk','recluse','saint'])
  if (player.role === 'imp')                      return 'demon'
  if (player.team === 'evil')                     return 'minion'
  if (outsiderRoles.has(player.role))             return 'outsider'
  return 'townsfolk'
}

// ── 인라인 스타일 (1회 주입) ──────────────────────────────
if (!document.getElementById('player-chip-style')) {
  const style = document.createElement('style')
  style.id = 'player-chip-style'
  style.textContent = `
/* dict__token 기반 PlayerChip — 자체 fallback 포함 */
.player-chip {
  position: relative;
  cursor: default;
  user-select: none;
  -webkit-tap-highlight-color: transparent;
  /* dict__token base (CharacterDict 없이도 동작) */
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  background: var(--surface);
  border: 1.5px solid transparent;
  border-radius: 10px;
  padding: 8px 4px 6px;
  transition: transform 0.12s, box-shadow 0.12s;
}

/* 아이콘 래퍼 (dict__token-icon fallback 포함) */
.player-chip__icon-wrap {
  position: relative;
  width: 44px;
  height: 44px;
  border-radius: 50%;
  overflow: visible;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.3rem;
  background: var(--surface2);
  flex-shrink: 0;
}
.player-chip__icon-wrap img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  border-radius: 50%;
  overflow: hidden;
}

/* 상태 뱃지 */
.player-chip__badge {
  position: absolute;
  top: -4px;
  right: -4px;
  width: 15px;
  height: 15px;
  border-radius: 50%;
  border: 1.5px solid var(--bg);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.48rem;
  line-height: 1;
  z-index: 2;
}
.player-chip__badge--poison { background: #16a34a; }
.player-chip__badge--drunk  { background: #7c3aed; }

/* 자리 번호 (우상단) */
.player-chip__seat {
  position: absolute;
  top: 2px;
  right: 4px;
  font-size: 0.72rem;
  font-weight: 700;
  color: var(--gold2);
  line-height: 1;
}

/* 이름 */
.player-chip__name {
  font-size: 0.6rem;
  color: var(--text2);
  text-align: center;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 60px;
  line-height: 1.2;
}

/* 역할명 */
.player-chip__role {
  font-size: 0.5rem;
  color: var(--text3);
  text-align: center;
  white-space: nowrap;
}

/* 선택 가능 */
.player-chip--selectable { cursor: pointer; }
.player-chip--selectable:active { transform: scale(0.91); background: var(--surface2); }

/* 선택됨 */
.player-chip--selected {
  border-color: var(--gold2) !important;
  box-shadow: 0 0 0 2px rgba(212,168,40,0.35), 0 0 14px rgba(212,168,40,0.4) !important;
  background: rgba(212,168,40,0.07) !important;
}

/* 사망 */
.player-chip--dead {
  opacity: 0.42;
  filter: grayscale(0.55);
}

/* 처형 */
.player-chip--executed {
  border-color: var(--rd-light) !important;
  box-shadow: 0 0 8px rgba(110,27,31,0.5) !important;
}

/* 독 상태 — 테두리 글로우 */
.player-chip--poisoned {
  border-color: #16a34a !important;
  box-shadow: 0 0 10px rgba(22,163,74,0.55), 0 0 20px rgba(22,163,74,0.2) !important;
  overflow: visible;
}

/* 독 파티클 */
@keyframes poison-particle {
  0%   { transform: translateX(-50%) translateY(0)     scale(1);   opacity: 0.9; }
  60%  { opacity: 0.7; }
  100% { transform: translateX(-50%) translateY(-28px) scale(0.2); opacity: 0; }
}
.poison-particle {
  position: absolute;
  bottom: 4px;
  width: 4px;
  height: 4px;
  border-radius: 50%;
  pointer-events: none;
  animation: poison-particle linear infinite;
  z-index: 10;
}
  `
  document.head.appendChild(style)
}
