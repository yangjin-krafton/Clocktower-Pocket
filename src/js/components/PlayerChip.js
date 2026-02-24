/**
 * C-01 PlayerChip — 플레이어 1명 칩
 * @param {Object} player  { id, name, role, team, status, isPoisoned, isDrunk }
 * @param {Object} opts    { selectable, selected, onClick, showRole, compact, roleIcon }
 * @returns {HTMLElement}
 */
export function renderPlayerChip(player, opts = {}) {
  const { selectable = false, selected = false, onClick, showRole = false, compact = false, roleIcon = '' } = opts

  const el = document.createElement('div')
  el.className = 'player-chip' +
    (compact ? ' player-chip--compact' : '') +
    (selectable ? ' player-chip--selectable' : '') +
    (selected ? ' player-chip--selected' : '') +
    (player.status !== 'alive' ? ' player-chip--dead' : '') +
    (player.status === 'executed' ? ' player-chip--executed' : '')

  // 팀/상태 보석 색상
  const gemClass = player.status !== 'alive'
    ? 'gem-dead'
    : (player.team === 'good'
        ? (player.role === 'outsider' || ['butler','drunk','recluse','saint'].includes(player.role) ? 'gem-outside' : 'gem-town')
        : (player.role === 'imp' ? 'gem-demon' : 'gem-minion'))

  // 좌석 번호 뱃지
  const seatEl = document.createElement('div')
  seatEl.className = 'player-chip__seat'
  seatEl.textContent = player.id

  // 보석 (아이콘 포함)
  const gemEl = document.createElement('div')
  gemEl.className = `player-chip__gem gem ${gemClass}`
  if (compact) {
    gemEl.style.width = '36px'
    gemEl.style.height = '36px'
    gemEl.style.fontSize = '1rem'
  } else {
    gemEl.style.width = '44px'
    gemEl.style.height = '44px'
    gemEl.style.fontSize = '1.2rem'
  }
  gemEl.textContent = roleIcon || '?'

  // 독 뱃지
  if (player.isPoisoned) {
    const badge = document.createElement('div')
    badge.className = 'player-chip__badge player-chip__badge--poison'
    badge.textContent = '☠'
    gemEl.appendChild(badge)
  }

  // 취함 뱃지
  if (player.isDrunk) {
    const badge = document.createElement('div')
    badge.className = 'player-chip__badge player-chip__badge--drunk'
    badge.textContent = '🍾'
    gemEl.appendChild(badge)
  }

  // 이름
  const nameEl = document.createElement('div')
  nameEl.className = 'player-chip__name'
  if (player.status !== 'alive') nameEl.style.textDecoration = 'line-through'
  nameEl.textContent = player.name

  // 역할명 (옵션)
  let roleEl = null
  if (showRole && player.role) {
    roleEl = document.createElement('div')
    roleEl.className = 'player-chip__role'
    roleEl.textContent = player.role
  }

  el.appendChild(seatEl)
  el.appendChild(gemEl)
  if (!compact) el.appendChild(nameEl)
  if (roleEl) el.appendChild(roleEl)

  if (selectable && onClick) {
    el.addEventListener('click', () => onClick(player.id))
  }

  return el
}

// ── 인라인 스타일 주입 (1회만) ──
if (!document.getElementById('player-chip-style')) {
  const style = document.createElement('style')
  style.id = 'player-chip-style'
  style.textContent = `
.player-chip {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 3px;
  position: relative;
  cursor: default;
  user-select: none;
}
.player-chip--selectable { cursor: pointer; }
.player-chip--selectable:active { transform: scale(0.93); }
.player-chip--selected .player-chip__gem {
  border-color: var(--gold) !important;
  box-shadow: 0 0 14px rgba(212,168,40,0.7), 0 0 24px rgba(91,179,198,0.35) !important;
}
.player-chip--dead { opacity: 0.45; }
.player-chip--executed .player-chip__gem {
  border-color: var(--rd-light) !important;
  box-shadow: 0 0 8px rgba(110,27,31,0.6) !important;
}
.player-chip__seat {
  position: absolute;
  top: -4px;
  left: 50%;
  transform: translateX(-50%);
  font-size: 0.5rem;
  font-weight: 700;
  color: var(--text4);
  background: var(--lead);
  border-radius: 4px;
  padding: 0 3px;
  z-index: 1;
  line-height: 1.4;
}
.player-chip__gem {
  border-radius: 50% !important;
  border: 2px solid var(--lead) !important;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  transition: box-shadow 0.2s, border-color 0.2s;
  line-height: 1;
}
.player-chip__badge {
  position: absolute;
  top: -3px;
  right: -3px;
  width: 14px;
  height: 14px;
  border-radius: 50%;
  border: 2px solid var(--bg);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.5rem;
  line-height: 1;
}
.player-chip__badge--poison { background: #16a34a; }
.player-chip__badge--drunk  { background: #7c3aed; }
.player-chip__name {
  font-size: 0.6rem;
  color: var(--text2);
  text-align: center;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 52px;
  line-height: 1.2;
}
.player-chip--compact .player-chip__name { display: none; }
.player-chip__role {
  font-size: 0.5rem;
  color: var(--text3);
  text-align: center;
  white-space: nowrap;
}
  `
  document.head.appendChild(style)
}
