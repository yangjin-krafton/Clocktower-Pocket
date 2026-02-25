/**
 * H-03 Grimoire — 메인 상태판
 *
 * phase === 'lobby' : 입장 대기 화면 (참가자 현황 + 설정 + 게임 시작 버튼)
 * phase === 'night' : 밤 진행
 * phase === 'day'   : 낮 진행
 */
import { renderPhaseHeader }    from '../components/PhaseHeader.js'
import { renderPlayerGrid }     from '../components/PlayerGrid.js'
import { renderNightOrderList } from '../components/NightOrderList.js'
import { renderLogList }        from '../components/LogEntry.js'
import { ROLES_BY_ID }          from '../data/roles-tb.js'

export class Grimoire {
  /**
   * @param {Object} opts
   * @param {Object}   opts.engine
   * @param {Function} [opts.getLobbyPlayers]  () => [{peerId, name}]
   * @param {Function} [opts.getLobbyConfig]   () => {playerCount, roleCount}
   * @param {Function} [opts.onStartGame]      () => void  ← 호스트 시작 버튼
   * @param {Function} [opts.onOpenSettings]   () => void  ← 설정 변경 팝업
   * @param {Function} [opts.onStartNight]
   * @param {Function} [opts.onStartDay]
   * @param {Function} [opts.onNextNightStep]
   * @param {Function} [opts.onPlayerAction]
   */
  constructor({
    engine,
    getLobbyPlayers, getLobbyConfig,
    onStartGame, onOpenSettings,
    onStartNight, onStartDay, onNextNightStep, onPlayerAction,
  }) {
    this.engine           = engine
    this.getLobbyPlayers  = getLobbyPlayers  || (() => [])
    this.getLobbyConfig   = getLobbyConfig   || (() => ({ playerCount: 7, roleCount: 0 }))
    this.onStartGame      = onStartGame      || null
    this.onOpenSettings   = onOpenSettings   || null
    this.onStartNight     = onStartNight     || null
    this.onStartDay       = onStartDay       || null
    this.onNextNightStep  = onNextNightStep  || null
    this.onPlayerAction   = onPlayerAction   || null
    this.el               = null
  }

  mount(container) {
    this.el = document.createElement('div')
    this.el.className = 'grimoire-screen'
    this._render()
    container.appendChild(this.el)
  }

  unmount() { this.el?.remove() }
  refresh()  { this._render()   }

  // ─────────────────────────────────────
  // 렌더
  // ─────────────────────────────────────

  _render() {
    this.el.innerHTML = ''
    const state = this.engine.state

    // ── lobby phase ───────────────────────────────────────────
    if (state.phase === 'lobby') {
      this._renderLobby()
      return
    }

    // ── game phase (night / day) ──────────────────────────────
    const roleMap = {}
    state.players.forEach(p => {
      const role = ROLES_BY_ID[p.role]
      roleMap[p.id] = { icon: role ? role.icon : '?', name: role ? role.name : p.role }
    })

    this.el.appendChild(renderPhaseHeader(state))

    if (state.phase === 'night') {
      const nightCard = document.createElement('div')
      nightCard.className = 'card'
      nightCard.innerHTML = '<div class="card-title">🌙 밤 순서</div>'
      nightCard.appendChild(renderNightOrderList({
        nightOrder:  state.nightOrder,
        currentStep: state.currentNightStep,
        doneSteps:   [],
      }))
      this.el.appendChild(nightCard)
    }

    const gridCard = document.createElement('div')
    gridCard.className = 'card'
    gridCard.innerHTML = '<div class="card-title">👥 플레이어</div>'
    gridCard.appendChild(renderPlayerGrid(state.players, {
      selectable: true,
      maxSelect: 1,
      roleMap,
      onSelect: (ids) => { if (ids.length > 0) this._showPlayerDetail(ids[0]) },
    }))
    this.el.appendChild(gridCard)

    const btnGrid = document.createElement('div')
    btnGrid.className = 'btn-grid-2'

    if (state.phase === 'night') {
      const nextBtn = document.createElement('button')
      nextBtn.className = 'btn btn-primary btn-grid-full'
      nextBtn.textContent = state.currentNightStep
        ? `▶ 다음 단계 (${ROLES_BY_ID[state.currentNightStep]?.name || state.currentNightStep})`
        : '▶ 밤 진행 시작'
      nextBtn.addEventListener('click', () => this.onNextNightStep?.())
      btnGrid.appendChild(nextBtn)

      const toDayBtn = document.createElement('button')
      toDayBtn.className = 'btn btn-grid-full'
      toDayBtn.textContent = '🌅 낮으로 전환'
      toDayBtn.addEventListener('click', () => this.onStartDay?.())
      btnGrid.appendChild(toDayBtn)
    } else {
      const toNightBtn = document.createElement('button')
      toNightBtn.className = 'btn btn-grid-full'
      toNightBtn.textContent = '🌙 밤으로 전환'
      toNightBtn.addEventListener('click', () => this.onStartNight?.())
      btnGrid.appendChild(toNightBtn)
    }
    this.el.appendChild(btnGrid)

    if (this.engine.logs.length > 0) {
      const logCard = document.createElement('div')
      logCard.className = 'card'
      logCard.innerHTML = '<div class="card-title">📜 판정 로그</div>'
      logCard.appendChild(renderLogList([...this.engine.logs].reverse().slice(0, 20)))
      this.el.appendChild(logCard)
    }
  }

  // ─────────────────────────────────────
  // Lobby phase 전용 렌더
  // ─────────────────────────────────────

  _renderLobby() {
    const players = this.getLobbyPlayers()
    const config  = this.getLobbyConfig()
    const count   = players.length

    // ── PhaseHeader ─────────────────────
    this.el.appendChild(renderPhaseHeader({
      phase: 'lobby',
      round: 0,
      players: [],
    }))

    // ── 현재 참가자 ──────────────────────
    const playerCard = document.createElement('div')
    playerCard.className = 'card'

    const playerTitle = document.createElement('div')
    playerTitle.className = 'card-title'
    playerTitle.textContent = `👥 현재 참가자 · ${count}명 입장 중`
    playerCard.appendChild(playerTitle)

    if (count === 0) {
      const empty = document.createElement('div')
      empty.style.cssText = 'color:var(--text4);font-size:0.78rem;padding:10px 0 4px;display:flex;align-items:center;gap:8px;'
      empty.innerHTML = `<span class="lobby-wait-dot"></span> 참가자 연결 대기 중...`
      playerCard.appendChild(empty)
    } else {
      const chips = document.createElement('div')
      chips.style.cssText = 'display:flex;flex-wrap:wrap;gap:7px;padding:6px 0 2px;'
      players.forEach(p => {
        const chip = document.createElement('span')
        chip.style.cssText = `
          background: rgba(91,179,198,0.12);
          border: 1px solid rgba(91,179,198,0.35);
          border-radius: 20px;
          padding: 4px 12px;
          font-size: 0.78rem;
          color: var(--tl-light);
          font-weight: 600;
        `
        chip.textContent = p.name
        chips.appendChild(chip)
      })
      playerCard.appendChild(chips)
    }
    this.el.appendChild(playerCard)

    // ── 게임 설정 ────────────────────────
    const configCard = document.createElement('div')
    configCard.className = 'card'

    const configTitle = document.createElement('div')
    configTitle.className = 'card-title'
    configTitle.textContent = '⚙️ 게임 설정'
    configCard.appendChild(configTitle)

    const configInfo = document.createElement('div')
    configInfo.style.cssText = 'font-size:0.78rem;color:var(--text3);margin-bottom:8px;'
    configInfo.textContent = `인원 ${config.playerCount}인 · 역할 ${config.roleCount}개 선택됨`
    configCard.appendChild(configInfo)

    const settingsBtn = document.createElement('button')
    settingsBtn.className = 'btn btn-full'
    settingsBtn.textContent = '✏️ 인원 · 역할 설정 변경'
    settingsBtn.addEventListener('click', () => this.onOpenSettings?.())
    configCard.appendChild(settingsBtn)
    this.el.appendChild(configCard)

    // ── 게임 시작 버튼 ───────────────────
    const startBtn = document.createElement('button')
    startBtn.className = 'btn btn-gold btn-full'
    startBtn.style.cssText = 'font-size:1rem;padding:15px;margin-top:4px;'
    startBtn.textContent = count > 0
      ? `🏰 게임 시작 (${count}명)`
      : '🏰 게임 시작'
    startBtn.disabled = count === 0
    if (count === 0) startBtn.style.opacity = '0.45'
    startBtn.addEventListener('click', () => this.onStartGame?.())
    this.el.appendChild(startBtn)

    if (count > 0 && count < 5) {
      const hint = document.createElement('div')
      hint.style.cssText = 'text-align:center;font-size:0.65rem;color:var(--text4);padding:4px 0 8px;'
      hint.textContent = `※ 정식 게임은 5명 이상 권장 (${count}명으로도 시작 가능)`
      this.el.appendChild(hint)
    }
  }

  // ─────────────────────────────────────
  // 플레이어 상세 팝업 (game phase)
  // ─────────────────────────────────────

  _showPlayerDetail(playerId) {
    const player = this.engine.getPlayer(playerId)
    if (!player) return
    const role = ROLES_BY_ID[player.role]

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

    const btns = [
      { label: '💀 사망 처리', action: () => { this.engine.killPlayer(player.id, 'manual'); this.refresh(); overlay.remove() } },
      { label: '☠ 중독 토글', action: () => { player.isPoisoned = !player.isPoisoned; this.refresh(); overlay.remove() } },
      { label: '🍾 취함 토글', action: () => { player.isDrunk = !player.isDrunk; this.refresh(); overlay.remove() } },
    ]

    if (player.role === 'slayer') {
      btns.push({ label: '🗡 학살자 선언', action: () => { overlay.remove(); this.onPlayerAction?.('slayer', player.id) } })
    }

    const btnGrid2 = document.createElement('div')
    btnGrid2.className = 'btn-grid-2'
    btnGrid2.style.marginBottom = '10px'
    btns.forEach(({ label, action }) => {
      const btn = document.createElement('button')
      btn.className = 'btn btn-danger'
      btn.textContent = label
      btn.addEventListener('click', action)
      btnGrid2.appendChild(btn)
    })
    box.appendChild(btnGrid2)

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

if (!document.getElementById('grimoire-lobby-style')) {
  const style = document.createElement('style')
  style.id = 'grimoire-lobby-style'
  style.textContent = `
.lobby-wait-dot {
  display: inline-block;
  width: 8px; height: 8px;
  border-radius: 50%;
  background: var(--pu-base);
  animation: dot-pulse 1.2s infinite;
  flex-shrink: 0;
}
  `
  document.head.appendChild(style)
}
