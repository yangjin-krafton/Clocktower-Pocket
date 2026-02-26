/**
 * H-07 Victory — 게임 종료 화면
 */
import { renderPlayerGrid } from '../components/PlayerGrid.js'
import { renderLogList } from '../components/LogEntry.js'
import { ROLES_BY_ID } from '../data/roles-tb.js'

export class Victory {
  constructor({ engine, winner, reason, onNewGame }) {
    this.engine    = engine
    this.winner    = winner  // 'good' | 'evil'
    this.reason    = reason
    this.onNewGame = onNewGame
    this.el        = null
  }

  mount(container) {
    this.el = document.createElement('div')
    this.el.className = 'victory-screen'
    this._render()
    container.appendChild(this.el)
  }

  unmount() { this.el?.remove() }

  _render() {
    this.el.innerHTML = ''
    const state = this.engine.state

    const isGoodWin = this.winner === 'good'
    const reasonText = {
      demon_dead: '데몬이 처형됩니다!',
      saint:      '성자이 처형되었습니다...',
      final_two:  '최종 2인, 악 팀 승리!',
      mayor:      '시장 능력, 선 팀 승리!',
    }[this.reason] || ''

    // ─ 배너 ─
    const banner = document.createElement('div')
    banner.className = `victory__banner victory__banner--${this.winner}`
    banner.innerHTML = `
      <div class="victory__icon">${isGoodWin ? '🏆' : '💀'}</div>
      <div class="victory__team">${isGoodWin ? '선 팀 승리!' : '악 팀 승리!'}</div>
      <div class="victory__reason">${reasonText}</div>
    `
    this.el.appendChild(banner)

    // ─ 전체 역할 공개 ─
    const revealCard = document.createElement('div')
    revealCard.className = 'card'
    revealCard.innerHTML = '<div class="card-title">📖 전체 역할 공개</div>'

    const roleMap = {}
    state.players.forEach(p => {
      const role = ROLES_BY_ID[p.role]
      roleMap[p.id] = {
        icon:      role ? role.icon      : '?',
        iconEmoji: role ? role.iconEmoji : null,
        name:      role ? role.name      : p.role,
        team:      role ? role.team      : 'townsfolk',
      }
    })

    revealCard.appendChild(renderPlayerGrid(state.players, { roleMap, showRole: true }))

    // 역할 목록
    const roleList = document.createElement('div')
    roleList.className = 'victory__role-list'
    state.players.forEach(p => {
      const role = ROLES_BY_ID[p.role]
      const row = document.createElement('div')
      row.className = 'victory__role-row'
      if (role) row.dataset.team = role.team

      const seatSpan = document.createElement('span')
      seatSpan.className = 'victory__role-seat'
      seatSpan.textContent = p.id

      const iconSpan = document.createElement('span')
      iconSpan.className = 'victory__role-icon'
      // PNG 이미지면 img 태그로, 아니면 emoji로 표시
      if (role?.icon && role.icon.endsWith('.png')) {
        const img = document.createElement('img')
        img.src = `./asset/icons/${role.icon}`
        img.alt = role.name
        img.className = 'victory__role-icon-img'
        iconSpan.appendChild(img)
      } else {
        iconSpan.textContent = role?.icon || '?'
      }

      const nameSpan = document.createElement('span')
      nameSpan.className = 'victory__role-name'
      nameSpan.textContent = p.name

      const roleSpan = document.createElement('span')
      roleSpan.className = 'victory__role-role'
      roleSpan.textContent = role?.name || p.role

      const badge = document.createElement('span')
      badge.className = `badge ${p.status === 'alive' ? 'badge-alive' : 'badge-dead'}`
      badge.textContent = p.status === 'alive' ? '생존' : '사망'

      row.appendChild(seatSpan)
      row.appendChild(iconSpan)
      row.appendChild(nameSpan)
      row.appendChild(roleSpan)
      row.appendChild(badge)

      roleList.appendChild(row)
    })
    revealCard.appendChild(roleList)
    this.el.appendChild(revealCard)

    // ─ 판정 로그 ─
    if (this.engine.logs.length > 0) {
      const logCard = document.createElement('div')
      logCard.className = 'card'
      logCard.innerHTML = '<div class="card-title">📜 게임 로그</div>'
      logCard.appendChild(renderLogList(this.engine.logs))
      this.el.appendChild(logCard)
    }

    // ─ 새 게임 버튼 ─
    const newBtn = document.createElement('button')
    newBtn.className = 'btn btn-gold btn-full'
    newBtn.style.padding = '16px'
    newBtn.style.fontSize = '1rem'
    newBtn.textContent = '🔄 새 게임'
    newBtn.addEventListener('click', () => this.onNewGame && this.onNewGame())
    this.el.appendChild(newBtn)
  }
}

if (!document.getElementById('victory-style')) {
  const style = document.createElement('style')
  style.id = 'victory-style'
  style.textContent = `
.victory-screen { display: flex; flex-direction: column; gap: 10px; }
.victory__banner {
  text-align: center;
  padding: 28px 20px;
  border-radius: 14px;
  border: 2px solid;
}
.victory__banner--good {
  background: rgba(91,179,198,0.1);
  border-color: rgba(91,179,198,0.4);
}
.victory__banner--evil {
  background: rgba(110,27,31,0.12);
  border-color: rgba(110,27,31,0.4);
}
.victory__icon { font-size: 3rem; }
.victory__team {
  font-family: 'Noto Serif KR', serif;
  font-size: 1.6rem;
  font-weight: 700;
  margin-top: 8px;
}
.victory__banner--good .victory__team { color: var(--tl-light); }
.victory__banner--evil .victory__team { color: var(--rd-light); }
.victory__reason { font-size: 0.82rem; color: var(--text3); margin-top: 6px; }
.victory__role-list { display: flex; flex-direction: column; gap: 4px; margin-top: 10px; }
.victory__role-row {
  display: flex;
  align-items: center;
  gap: 7px;
  padding: 5px 8px;
  border-radius: 6px;
  background: var(--surface2);
  font-size: 0.75rem;
}
.victory__role-seat {
  width: 18px; text-align: center;
  color: var(--text4); font-size: 0.65rem;
}
.victory__role-icon {
  font-size: 1rem;
  width: 24px;
  height: 24px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}
.victory__role-icon-img {
  width: 100%;
  height: 100%;
  object-fit: contain;
}
.victory__role-name { flex: 1; color: var(--text); font-weight: 600; }
.victory__role-role { color: var(--text3); flex: 1; }
.victory__role-row[data-team="townsfolk"] .victory__role-role { color: var(--bl-light); }
.victory__role-row[data-team="outsider"] .victory__role-role { color: var(--tl-light); }
.victory__role-row[data-team="minion"] .victory__role-role { color: var(--rd-light); }
.victory__role-row[data-team="demon"] .victory__role-role { color: var(--rd-light); font-weight: 600; }
  `
  document.head.appendChild(style)
}
