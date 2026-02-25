/**
 * C-02 RoleCard — 역할 카드
 * @param {Object} role  { id, name, team, ability, icon }
 * @param {Object} opts  { compact }
 * @returns {HTMLElement}
 */
export function renderRoleCard(role, opts = {}) {
  const { compact = false } = opts

  const teamLabel = { townsfolk: '마을 주민', outsider: '아웃사이더', minion: '미니언', demon: '데몬' }
  const teamBadgeClass = { townsfolk: 'badge-town', outsider: 'badge-outside', minion: 'badge-minion', demon: 'badge-demon' }
  const gemClass = { townsfolk: 'gem-town', outsider: 'gem-outside', minion: 'gem-minion', demon: 'gem-demon' }
  const borderColor = {
    townsfolk: 'rgba(46,74,143,0.35)',
    outsider:  'rgba(91,179,198,0.35)',
    minion:    'rgba(110,27,31,0.4)',
    demon:     'rgba(110,27,31,0.55)',
  }

  const el = document.createElement('div')
  el.className = 'role-card' + (compact ? ' role-card--compact' : '')
  el.style.borderColor = borderColor[role.team] || 'var(--lead2)'

  // 헤더 행
  const header = document.createElement('div')
  header.className = 'role-card__header'

  const gem = document.createElement('div')
  gem.className = `role-card__gem gem ${gemClass[role.team] || 'gem-town'}`

  // PNG 이미지면 img 태그로, 아니면 emoji로 표시
  if (role.icon && role.icon.endsWith('.png')) {
    const img = document.createElement('img')
    img.src = `./asset/icons/${role.icon}`
    img.alt = role.name
    img.className = 'role-card__gem-img'
    gem.appendChild(img)
  } else {
    gem.textContent = role.icon || '?'
  }

  const meta = document.createElement('div')
  meta.className = 'role-card__meta'

  const nameEl = document.createElement('div')
  nameEl.className = 'role-card__name'
  nameEl.textContent = role.name

  const badge = document.createElement('span')
  badge.className = `badge ${teamBadgeClass[role.team] || 'badge-town'}`
  badge.textContent = teamLabel[role.team] || role.team

  meta.appendChild(nameEl)
  meta.appendChild(badge)

  header.appendChild(gem)
  header.appendChild(meta)
  el.appendChild(header)

  // 능력 설명 (compact=false)
  if (!compact && role.ability) {
    const abilityEl = document.createElement('div')
    abilityEl.className = 'role-card__ability'
    abilityEl.textContent = role.ability
    el.appendChild(abilityEl)
  }

  return el
}

if (!document.getElementById('role-card-style')) {
  const style = document.createElement('style')
  style.id = 'role-card-style'
  style.textContent = `
.role-card {
  background: var(--surface);
  border: 1px solid var(--lead2);
  border-radius: 10px;
  padding: 12px;
  margin-bottom: 8px;
}
.role-card__header {
  display: flex;
  align-items: center;
  gap: 10px;
}
.role-card__gem {
  width: 44px;
  height: 44px;
  border-radius: 50% !important;
  flex-shrink: 0;
  font-size: 1.3rem;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
}
.role-card__gem-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}
.role-card__meta {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.role-card__name {
  font-family: 'Noto Serif KR', serif;
  font-size: 0.95rem;
  font-weight: 700;
  color: var(--text);
}
.role-card__ability {
  margin-top: 10px;
  padding: 8px 10px;
  background: var(--surface2);
  border-radius: 6px;
  font-size: 0.75rem;
  color: var(--text2);
  line-height: 1.6;
  border: 1px solid var(--lead2);
}
.role-card--compact { padding: 8px 10px; }
.role-card--compact .role-card__gem { width: 34px; height: 34px; font-size: 1rem; }
.role-card--compact .role-card__name { font-size: 0.82rem; }
  `
  document.head.appendChild(style)
}
