/**
 * H-01 Setup — 게임 설정 화면
 * 인원 수 + 역할 선택 → 방 생성
 */
import { ROLES_TB, PLAYER_COUNTS } from '../data/roles-tb.js'
import { renderRoleCard } from '../components/RoleCard.js'

export class Setup {
  constructor({ onCreateRoom }) {
    this.onCreateRoom = onCreateRoom
    this.playerCount = 10
    this.selectedRoles = new Set()
    this.el = null
  }

  mount(container) {
    this.el = document.createElement('div')
    this.el.className = 'setup-screen'
    this._render()
    container.appendChild(this.el)
  }

  unmount() {
    this.el?.remove()
  }

  _render() {
    this.el.innerHTML = ''

    // ─ 제목 ─
    const title = document.createElement('div')
    title.className = 'setup__title'
    title.innerHTML = `
      <div class="setup__logo">🏰</div>
      <h1 class="setup__heading">Clocktower Pocket</h1>
      <p class="setup__sub">Trouble Brewing</p>
    `
    this.el.appendChild(title)

    // ─ 인원 수 ─
    const countSection = document.createElement('div')
    countSection.className = 'card'
    countSection.innerHTML = '<div class="card-title">👥 인원 수</div>'

    const countGrid = document.createElement('div')
    countGrid.className = 'setup__count-grid'
    ;[5,6,7,8,9,10,11,12,13,14,15].forEach(n => {
      const btn = document.createElement('button')
      btn.className = 'setup__count-btn' + (n === this.playerCount ? ' setup__count-btn--active' : '')
      btn.textContent = n
      btn.addEventListener('click', () => {
        this.playerCount = n
        this._render()
      })
      countGrid.appendChild(btn)
    })
    countSection.appendChild(countGrid)

    // 역할 구성 표시
    const comp = PLAYER_COUNTS[this.playerCount]
    const compEl = document.createElement('div')
    compEl.className = 'setup__comp'
    compEl.innerHTML = comp
      ? `<span class="badge badge-town">마을 ${comp.townsfolk}</span>
         <span class="badge badge-outside">아웃 ${comp.outsider}</span>
         <span class="badge badge-minion">미니언 ${comp.minion}</span>
         <span class="badge badge-demon">임프 ${comp.demon}</span>`
      : ''
    countSection.appendChild(compEl)
    this.el.appendChild(countSection)

    // ─ 역할 선택 ─
    const roleSection = document.createElement('div')
    roleSection.className = 'card'
    roleSection.innerHTML = `<div class="card-title">🎭 역할 선택 <span class="setup__role-count">${this.selectedRoles.size} 선택</span></div>`

    // 팀별 그룹
    const teams = ['townsfolk','outsider','minion','demon']
    const teamLabel = { townsfolk:'마을 주민', outsider:'아웃사이더', minion:'미니언', demon:'임프' }
    teams.forEach(team => {
      const teamRoles = ROLES_TB.filter(r => r.team === team)
      const groupEl = document.createElement('div')
      groupEl.className = 'setup__role-group'
      groupEl.innerHTML = `<div class="section-label">${teamLabel[team]}</div>`

      teamRoles.forEach(role => {
        const row = document.createElement('div')
        row.className = 'setup__role-row' + (this.selectedRoles.has(role.id) ? ' setup__role-row--selected' : '')
        row.dataset.team = role.team

        const iconSpan = document.createElement('span')
        iconSpan.className = 'setup__role-icon'
        // PNG 이미지면 img 태그로, 아니면 emoji로 표시
        if (role.icon && role.icon.endsWith('.png')) {
          const img = document.createElement('img')
          img.src = `./asset/new/Icon_${role.icon}`
          img.alt = role.name
          img.className = 'setup__role-icon-img'
          iconSpan.appendChild(img)
        } else {
          iconSpan.textContent = role.icon
        }

        const nameSpan = document.createElement('span')
        nameSpan.className = 'setup__role-name'
        nameSpan.textContent = role.name

        const checkSpan = document.createElement('span')
        checkSpan.className = 'setup__role-check'
        checkSpan.textContent = this.selectedRoles.has(role.id) ? '✓' : ''

        row.appendChild(iconSpan)
        row.appendChild(nameSpan)
        row.appendChild(checkSpan)

        row.addEventListener('click', () => {
          if (this.selectedRoles.has(role.id)) {
            this.selectedRoles.delete(role.id)
          } else {
            this.selectedRoles.add(role.id)
          }
          this._render()
        })
        groupEl.appendChild(row)
      })

      roleSection.appendChild(groupEl)
    })

    // 빠른 선택 버튼 (TB 표준)
    const quickBtn = document.createElement('button')
    quickBtn.className = 'btn btn-primary btn-full mt-12'
    quickBtn.textContent = '🎲 표준 역할 자동 선택'
    quickBtn.addEventListener('click', () => {
      this._autoSelectRoles()
      this._render()
    })
    roleSection.appendChild(quickBtn)

    this.el.appendChild(roleSection)

    // ─ 방 생성 버튼 ─
    const valid = this._validate()
    const createBtn = document.createElement('button')
    createBtn.className = 'btn btn-gold btn-full'
    createBtn.style.fontSize = '1rem'
    createBtn.style.padding = '16px'
    createBtn.style.marginTop = '8px'
    createBtn.textContent = '🏰 방 생성하기'
    createBtn.disabled = !valid.ok
    if (!valid.ok) {
      createBtn.style.opacity = '0.5'
      const hint = document.createElement('div')
      hint.className = 'setup__hint'
      hint.textContent = valid.hint
      this.el.appendChild(hint)
    }
    createBtn.addEventListener('click', () => {
      if (valid.ok) this.onCreateRoom(this.playerCount, Array.from(this.selectedRoles))
    })
    this.el.appendChild(createBtn)
  }

  _autoSelectRoles() {
    const comp = PLAYER_COUNTS[this.playerCount]
    if (!comp) return
    this.selectedRoles.clear()
    const byTeam = team => ROLES_TB.filter(r => r.team === team).sort(() => Math.random() - 0.5)
    byTeam('townsfolk').slice(0, comp.townsfolk).forEach(r => this.selectedRoles.add(r.id))
    byTeam('outsider').slice(0, comp.outsider).forEach(r => this.selectedRoles.add(r.id))
    byTeam('minion').slice(0, comp.minion).forEach(r => this.selectedRoles.add(r.id))
    this.selectedRoles.add('imp')
  }

  _validate() {
    const comp = PLAYER_COUNTS[this.playerCount]
    if (!comp) return { ok: false, hint: '지원하지 않는 인원입니다.' }
    const counts = { townsfolk:0, outsider:0, minion:0, demon:0 }
    this.selectedRoles.forEach(id => {
      const r = ROLES_TB.find(r => r.id === id)
      if (r) counts[r.team] = (counts[r.team] || 0) + 1
    })
    const hasBaron = this.selectedRoles.has('baron')
    const needTown = comp.townsfolk - (hasBaron ? 2 : 0)
    const needOut  = comp.outsider  + (hasBaron ? 2 : 0)
    if (counts.demon !== 1) return { ok: false, hint: '임프(임프) 1개를 선택하세요.' }
    if (counts.minion < comp.minion) return { ok: false, hint: `미니언 ${comp.minion}개가 필요합니다. (현재 ${counts.minion})` }
    if (counts.townsfolk < needTown) return { ok: false, hint: `마을 주민 ${needTown}개가 필요합니다. (현재 ${counts.townsfolk})` }
    if (counts.outsider < needOut) return { ok: false, hint: `아웃사이더 ${needOut}개가 필요합니다. (현재 ${counts.outsider})` }
    return { ok: true }
  }
}

if (!document.getElementById('setup-style')) {
  const style = document.createElement('style')
  style.id = 'setup-style'
  style.textContent = `
.setup-screen { display: flex; flex-direction: column; gap: 10px; padding-bottom: 24px; }
.setup__title { text-align: center; padding: 24px 0 8px; }
.setup__logo { font-size: 2.8rem; }
.setup__heading {
  font-family: 'Noto Serif KR', serif;
  font-size: 1.3rem;
  font-weight: 700;
  color: var(--gold2);
  margin-top: 6px;
}
.setup__sub { font-size: 0.72rem; color: var(--text3); margin-top: 2px; }
.setup__count-grid {
  display: grid;
  grid-template-columns: repeat(6, 1fr);
  gap: 5px;
  margin-bottom: 10px;
}
.setup__count-btn {
  padding: 8px 4px;
  border-radius: 6px;
  border: 1px solid var(--lead2);
  background: var(--surface2);
  color: var(--text3);
  font-size: 0.82rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.15s;
}
.setup__count-btn--active {
  background: rgba(122,111,183,0.25);
  border-color: var(--pu-base);
  color: var(--text);
}
.setup__comp { display: flex; gap: 5px; flex-wrap: wrap; }
.setup__role-count { font-size: 0.65rem; color: var(--text3); font-weight: 400; margin-left: 6px; }
.setup__role-group { margin-bottom: 10px; }
.setup__role-row {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 10px;
  border-radius: 6px;
  border: 1px solid transparent;
  cursor: pointer;
  transition: all 0.12s;
  margin-bottom: 2px;
}
.setup__role-row:hover { background: var(--surface2); }
.setup__role-row--selected { background: rgba(91,179,198,0.08); border-color: rgba(91,179,198,0.3); }
.setup__role-icon {
  font-size: 1.1rem;
  flex-shrink: 0;
  width: 28px;
  height: 28px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}
.setup__role-icon-img {
  width: 100%;
  height: 100%;
  object-fit: contain;
}
.setup__role-name { flex: 1; font-size: 0.78rem; color: var(--text2); }
.setup__role-row[data-team="townsfolk"] .setup__role-name { color: var(--bl-light); }
.setup__role-row[data-team="outsider"] .setup__role-name { color: var(--tl-light); }
.setup__role-row[data-team="minion"] .setup__role-name { color: var(--rd-light); }
.setup__role-row[data-team="demon"] .setup__role-name { color: var(--rd-light); font-weight: 600; }
.setup__role-check { font-size: 0.82rem; color: var(--tl-base); font-weight: 700; min-width: 14px; text-align: right; }
.setup__hint { text-align: center; font-size: 0.68rem; color: var(--rd-light); padding: 4px; }
  `
  document.head.appendChild(style)
}
