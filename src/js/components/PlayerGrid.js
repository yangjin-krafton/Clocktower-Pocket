/**
 * C-03 PlayerGrid — 플레이어 그리드
 * @param {Object[]} players
 * @param {Object} opts  { selectable, maxSelect, selectedIds, onSelect, showRole, roleMap }
 * @returns {HTMLElement}
 */
import { renderPlayerChip } from './PlayerChip.js'

export function renderPlayerGrid(players, opts = {}) {
  const {
    selectable = false,
    maxSelect = 1,
    selectedIds = [],
    onSelect = null,
    showRole = false,
    roleMap = {},   // { playerId: { icon, iconEmoji, name, team } }
  } = opts

  const selected = new Set(selectedIds)

  const el = document.createElement('div')
  el.className = 'player-grid'

  function rebuild() {
    el.innerHTML = ''
    players.forEach(player => {
      const isSelected = selected.has(player.id)
      const roleInfo   = roleMap[player.id] || {}

      const chip = renderPlayerChip(player, {
        selectable,
        selected:      isSelected,
        showRole,
        roleIcon:      roleInfo.icon      || '',
        roleIconEmoji: roleInfo.iconEmoji || '',
        roleTeam:      roleInfo.team      || null,
        onClick: selectable ? (id) => handleSelect(id) : undefined,
      })
      el.appendChild(chip)
    })
  }

  function handleSelect(id) {
    if (selected.has(id)) {
      selected.delete(id)
    } else {
      if (selected.size >= maxSelect) {
        if (maxSelect === 1) {
          selected.clear()
        } else {
          return // 최대 선택 수 초과
        }
      }
      selected.add(id)
    }
    rebuild()
    if (onSelect) onSelect(Array.from(selected))
  }

  rebuild()
  return el
}

if (!document.getElementById('player-grid-style')) {
  const style = document.createElement('style')
  style.id = 'player-grid-style'
  style.textContent = `
.player-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(68px, 1fr));
  gap: 8px;
  padding: 4px 0;
}
  `
  document.head.appendChild(style)
}
