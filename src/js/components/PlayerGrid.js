/**
 * C-03 PlayerGrid — 플레이어 그리드 / 링
 * @param {Object[]} players
 * @param {Object} opts  { selectable, maxSelect, selectedIds, onSelect, showRole, roleMap, ring }
 *   ring: true  → 타원 링 배치 (5~20인, Grimoire 게임 화면)
 *   ring: false → 기존 CSS 그리드 (선택 패널 등)
 * @returns {HTMLElement}
 */
import { renderPlayerChip } from './PlayerChip.js'

export function renderPlayerGrid(players, opts = {}) {
  const {
    selectable  = false,
    maxSelect   = 1,
    selectedIds = [],
    onSelect    = null,
    showRole    = false,
    roleMap     = {},
    ring        = false,
  } = opts

  const selected = new Set(selectedIds)
  const el = document.createElement('div')

  // ─────────────────────────────────────
  // 링 모드: 타원 절대 위치 배치
  // ─────────────────────────────────────
  if (ring) {
    el.className = 'player-ring'

    const total   = players.length
    const zigzag  = total >= 17
    const compact = total > 12   // 13인 이상은 이름 숨김

    // 슬롯 너비 (chipPx × chipPx 정방형 카드)
    const chipPx =
      total <= 6  ? 62 :
      total <= 9  ? 56 :
      total <= 13 ? 50 :
      total <= 16 ? 44 : 38

    // 타원 반지름 (% — rX: 너비 기준, rY: 높이 기준)
    // 2:3 portrait 컨테이너 기준 — rX: %of width, rY: %of height
    const RX = 43, RY = 43

    function rebuildRing() {
      el.innerHTML = ''

      // 타원 컨테이너
      const oval = document.createElement('div')
      oval.className = 'player-ring__oval'

      players.forEach((player, i) => {
        const isSelected = selected.has(player.id)
        const roleInfo   = roleMap[player.id] || {}

        const angle = (2 * Math.PI * i) / total - Math.PI / 2
        const scale = zigzag ? (i % 2 === 0 ? 1.0 : 0.76) : 1.0
        const x = 50 + RX * scale * Math.cos(angle)
        const y = 50 + RY * scale * Math.sin(angle)

        const chip = renderPlayerChip(player, {
          selectable,
          selected:      isSelected,
          showRole,
          compact,
          roleIcon:      roleInfo.icon      || '',
          roleIconEmoji: roleInfo.iconEmoji || '',
          roleTeam:      roleInfo.team      || null,
          onClick: selectable ? (id) => handleSelect(id) : undefined,
        })

        // 절대 위치로 타원 위에 배치
        chip.style.position  = 'absolute'
        chip.style.left      = `${x.toFixed(2)}%`
        chip.style.top       = `${y.toFixed(2)}%`
        chip.style.transform = `translate(-50%, -50%)${isSelected ? ' scale(1.12)' : ''}`
        chip.style.width     = `${chipPx}px`
        chip.style.zIndex    = isSelected ? '3' : '1'

        oval.appendChild(chip)
      })

      el.appendChild(oval)
    }

    function handleSelect(id) {
      if (selected.has(id)) {
        selected.delete(id)
      } else {
        if (selected.size >= maxSelect) {
          if (maxSelect === 1) selected.clear()
          else return
        }
        selected.add(id)
      }
      rebuildRing()
      if (onSelect) onSelect(Array.from(selected))
    }

    rebuildRing()
    return el
  }

  // ─────────────────────────────────────
  // 그리드 모드: 기존 CSS 그리드
  // ─────────────────────────────────────
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
        if (maxSelect === 1) selected.clear()
        else return
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
/* ── 기존 그리드 모드 ── */
.player-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(68px, 1fr));
  gap: 8px;
  padding: 4px 0;
}

/* ── 링 모드 컨테이너 ── */
.player-ring {
  width: 100%;
  padding: 4px 0;
}
.player-ring__oval {
  position: relative;
  width: 100%;
  aspect-ratio: 2 / 3;   /* portrait — 세로 = 너비의 150% */
  overflow: visible;
}
  `
  document.head.appendChild(style)
}
