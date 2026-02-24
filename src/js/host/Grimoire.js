/**
 * H-03 Grimoire — 메인 상태판
 * 전체 플레이어 상태 + 밤/낮 전환
 */
import { renderPhaseHeader } from '../components/PhaseHeader.js'
import { renderPlayerGrid } from '../components/PlayerGrid.js'
import { renderNightOrderList } from '../components/NightOrderList.js'
import { renderLogList } from '../components/LogEntry.js'
import { ROLES_BY_ID } from '../data/roles-tb.js'

export class Grimoire {
  constructor({ engine, onStartNight, onStartDay, onNextNightStep, onPlayerAction }) {
    this.engine = engine
    this.onStartNight = onStartNight
    this.onStartDay   = onStartDay
    this.onNextNightStep = onNextNightStep
    this.onPlayerAction  = onPlayerAction
    this.el = null
    this.selectedPlayer = null
  }

  mount(container) {
    this.el = document.createElement('div')
    this.el.className = 'grimoire-screen'
    this._render()
    container.appendChild(this.el)
  }

  unmount() { this.el?.remove() }

  refresh() { this._render() }

  _render() {
    this.el.innerHTML = ''
    const state = this.engine.state

    // 역할 아이콘 맵
    const roleMap = {}
    state.players.forEach(p => {
      const role = ROLES_BY_ID[p.role]
      roleMap[p.id] = { icon: role ? role.icon : '?', name: role ? role.name : p.role }
    })

    // ─ PhaseHeader ─
    this.el.appendChild(renderPhaseHeader(state))

    // ─ 밤 순서 (밤에만) ─
    if (state.phase === 'night') {
      const nightCard = document.createElement('div')
      nightCard.className = 'card'
      nightCard.innerHTML = '<div class="card-title">🌙 밤 순서</div>'
      nightCard.appendChild(renderNightOrderList({
        nightOrder: state.nightOrder,
        currentStep: state.currentNightStep,
        doneSteps: [],
      }))
      this.el.appendChild(nightCard)
    }

    // ─ PlayerGrid ─
    const gridCard = document.createElement('div')
    gridCard.className = 'card'
    gridCard.innerHTML = '<div class="card-title">👥 플레이어</div>'
    gridCard.appendChild(renderPlayerGrid(state.players, {
      selectable: true,
      maxSelect: 1,
      roleMap,
      onSelect: (ids) => {
        if (ids.length > 0) this._showPlayerDetail(ids[0])
      }
    }))
    this.el.appendChild(gridCard)

    // ─ 액션 버튼 ─
    const btnGrid = document.createElement('div')
    btnGrid.className = 'btn-grid-2'

    if (state.phase === 'night') {
      const nextBtn = document.createElement('button')
      nextBtn.className = 'btn btn-primary btn-grid-full'
      nextBtn.textContent = state.currentNightStep
        ? `▶ 다음 단계 (${ROLES_BY_ID[state.currentNightStep]?.name || state.currentNightStep})`
        : '▶ 밤 진행 시작'
      nextBtn.addEventListener('click', () => this.onNextNightStep && this.onNextNightStep())
      btnGrid.appendChild(nextBtn)

      const toDayBtn = document.createElement('button')
      toDayBtn.className = 'btn btn-grid-full'
      toDayBtn.textContent = '🌅 낮으로 전환'
      toDayBtn.addEventListener('click', () => this.onStartDay && this.onStartDay())
      btnGrid.appendChild(toDayBtn)
    } else {
      const toNightBtn = document.createElement('button')
      toNightBtn.className = 'btn btn-grid-full'
      toNightBtn.textContent = '🌙 밤으로 전환'
      toNightBtn.addEventListener('click', () => this.onStartNight && this.onStartNight())
      btnGrid.appendChild(toNightBtn)
    }
    this.el.appendChild(btnGrid)

    // ─ 로그 ─
    if (this.engine.logs.length > 0) {
      const logCard = document.createElement('div')
      logCard.className = 'card'
      logCard.innerHTML = '<div class="card-title">📜 판정 로그</div>'
      logCard.appendChild(renderLogList([...this.engine.logs].reverse().slice(0, 20)))
      this.el.appendChild(logCard)
    }
  }

  _showPlayerDetail(playerId) {
    const player = this.engine.getPlayer(playerId)
    if (!player) return
    const role = ROLES_BY_ID[player.role]

    // 팝업 오버레이
    const overlay = document.createElement('div')
    overlay.className = 'popup-overlay'

    const box = document.createElement('div')
    box.className = 'popup-box'

    box.innerHTML = `
      <div style="display:flex;align-items:center;gap:10px;margin-bottom:12px;">
        <span style="font-size:1.8rem">${role?.icon || '?'}</span>
        <div>
          <div style="font-family:'Noto Serif KR',serif;font-size:1rem;font-weight:700;color:var(--text)">${player.name} (${player.id}번)</div>
          <div style="font-size:0.72rem;color:var(--text3)">${role?.name || player.role}</div>
        </div>
      </div>
    `

    // 상태 수정 버튼들
    const btns = [
      { label: '💀 사망 처리', action: () => { this.engine.killPlayer(player.id, 'manual'); this.refresh(); overlay.remove() } },
      { label: '☠ 중독 토글', action: () => { player.isPoisoned = !player.isPoisoned; this.refresh(); overlay.remove() } },
      { label: '🍾 취함 토글', action: () => { player.isDrunk = !player.isDrunk; this.refresh(); overlay.remove() } },
    ]

    if (player.role === 'slayer') {
      btns.push({ label: '🗡 학살자 선언', action: () => { overlay.remove(); this.onPlayerAction && this.onPlayerAction('slayer', player.id) } })
    }

    const btnGrid = document.createElement('div')
    btnGrid.className = 'btn-grid-2'
    btnGrid.style.marginBottom = '10px'
    btns.forEach(({ label, action }) => {
      const btn = document.createElement('button')
      btn.className = 'btn btn-danger'
      btn.textContent = label
      btn.addEventListener('click', action)
      btnGrid.appendChild(btn)
    })
    box.appendChild(btnGrid)

    const closeBtn = document.createElement('button')
    closeBtn.className = 'btn btn-full'
    closeBtn.textContent = '닫기'
    closeBtn.addEventListener('click', () => overlay.remove())
    box.appendChild(closeBtn)

    overlay.appendChild(box)
    overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove() })
    document.body.appendChild(overlay)
  }
}
