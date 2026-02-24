/**
 * P-03 RoleCardScreen — 내 역할 카드
 */
import { renderRoleCard } from '../components/RoleCard.js'
import { ROLES_BY_ID } from '../data/roles-tb.js'

export class RoleCardScreen {
  constructor({ roleId, team }) {
    this.roleId = roleId
    this.team   = team
    this.el     = null
  }

  mount(container) {
    this.el = document.createElement('div')
    this.el.className = 'rolecard-screen'
    this._render()
    container.appendChild(this.el)
  }

  unmount() { this.el?.remove() }

  _render() {
    this.el.innerHTML = ''
    const role = ROLES_BY_ID[this.roleId]
    if (!role) {
      this.el.innerHTML = '<div class="text-center text-muted" style="padding:40px">역할 정보 없음</div>'
      return
    }

    const title = document.createElement('div')
    title.className = 'rolecard-screen__title'
    title.textContent = '내 역할'
    this.el.appendChild(title)

    this.el.appendChild(renderRoleCard(role, { compact: false }))

    // 팀 정렬 배너
    const teamBanner = document.createElement('div')
    teamBanner.className = `rolecard-screen__team rolecard-screen__team--${this.team}`
    teamBanner.textContent = this.team === 'good' ? '🕊️ 선 팀 (Good)' : '😈 악 팀 (Evil)'
    this.el.appendChild(teamBanner)

    // 능력 팁
    if (role.firstNight || role.otherNights) {
      const nightTip = document.createElement('div')
      nightTip.className = 'card rolecard-screen__night-tip'
      const nights = []
      if (role.firstNight)  nights.push('첫째 밤')
      if (role.otherNights) nights.push('매 밤')
      nightTip.innerHTML = `
        <div class="section-label">🌙 밤 행동</div>
        <div style="font-size:0.78rem;color:var(--text2)">${nights.join(', ')}에 활성화됩니다</div>
      `
      this.el.appendChild(nightTip)
    }
  }
}

if (!document.getElementById('rolecard-screen-style')) {
  const style = document.createElement('style')
  style.id = 'rolecard-screen-style'
  style.textContent = `
.rolecard-screen { display: flex; flex-direction: column; gap: 10px; }
.rolecard-screen__title {
  font-size: 0.62rem;
  font-weight: 700;
  color: var(--text4);
  letter-spacing: 0.08em;
  text-transform: uppercase;
  text-align: center;
  padding-top: 4px;
}
.rolecard-screen__team {
  text-align: center;
  padding: 10px;
  border-radius: 8px;
  font-size: 0.85rem;
  font-weight: 700;
  border: 1px solid;
}
.rolecard-screen__team--good {
  background: rgba(91,179,198,0.1);
  border-color: rgba(91,179,198,0.3);
  color: var(--tl-light);
}
.rolecard-screen__team--evil {
  background: rgba(110,27,31,0.12);
  border-color: rgba(110,27,31,0.4);
  color: var(--rd-light);
}
  `
  document.head.appendChild(style)
}
