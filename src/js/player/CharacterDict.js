/**
 * P-07 CharacterDict — 캐릭터 사전
 * 이번 스크립트 전체 역할 설명 (정적 데이터)
 */
import { ROLES_TB } from '../data/roles-tb.js'
import { renderRoleCard } from '../components/RoleCard.js'

export class CharacterDict {
  constructor({ scriptRoles = null, onRoleClick = null }) {
    // scriptRoles: 이번 게임에 포함된 역할 id 목록 (null이면 전체)
    this.scriptRoles = scriptRoles
    this.onRoleClick = onRoleClick
    this.el = null
    this.filter = 'all'
  }

  mount(container) {
    this.el = document.createElement('div')
    this.el.className = 'dict-screen'
    this._render()
    container.appendChild(this.el)
  }

  unmount() { this.el?.remove() }

  _render() {
    this.el.innerHTML = ''

    const teams = ['townsfolk','outsider','minion','demon']
    const teamLabel = { townsfolk:'마을 주민', outsider:'아웃사이더', minion:'미니언', demon:'데몬' }

    // 필터 탭
    const filterRow = document.createElement('div')
    filterRow.className = 'dict__filter'
    ;['all', ...teams].forEach(key => {
      const btn = document.createElement('button')
      btn.className = 'dict__filter-btn' + (this.filter === key ? ' dict__filter-btn--active' : '')
      btn.textContent = key === 'all' ? '전체' : teamLabel[key]
      btn.addEventListener('click', () => { this.filter = key; this._render() })
      filterRow.appendChild(btn)
    })
    this.el.appendChild(filterRow)

    // 역할 목록
    let roles = ROLES_TB
    if (this.scriptRoles) {
      roles = roles.filter(r => this.scriptRoles.includes(r.id))
    }
    if (this.filter !== 'all') {
      roles = roles.filter(r => r.team === this.filter)
    }

    if (roles.length === 0) {
      const empty = document.createElement('div')
      empty.className = 'text-center text-muted'
      empty.style.padding = '24px'
      empty.textContent = '역할 없음'
      this.el.appendChild(empty)
      return
    }

    roles.forEach(role => {
      const card = renderRoleCard(role, { compact: false })

      // 클릭 이벤트 추가
      if (this.onRoleClick) {
        card.classList.add('role-card--clickable')
        card.addEventListener('click', () => {
          this.onRoleClick(role.id)
        })
      }

      this.el.appendChild(card)
    })
  }
}

if (!document.getElementById('dict-style')) {
  const style = document.createElement('style')
  style.id = 'dict-style'
  style.textContent = `
.dict-screen { display: flex; flex-direction: column; gap: 6px; }
.dict__filter {
  display: flex;
  gap: 5px;
  flex-wrap: wrap;
  margin-bottom: 4px;
}
.dict__filter-btn {
  padding: 5px 10px;
  border-radius: 16px;
  border: 1px solid var(--lead2);
  background: var(--surface);
  color: var(--text3);
  font-size: 0.68rem;
  cursor: pointer;
  transition: all 0.15s;
}
.dict__filter-btn--active {
  background: rgba(122,111,183,0.2);
  border-color: var(--pu-base);
  color: var(--text);
}
.role-card--clickable {
  cursor: pointer;
  transition: transform 0.15s, box-shadow 0.15s;
}
.role-card--clickable:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0,0,0,0.2);
}
.role-card--clickable:active {
  transform: translateY(0);
  box-shadow: 0 2px 6px rgba(0,0,0,0.15);
}
  `
  document.head.appendChild(style)
}
