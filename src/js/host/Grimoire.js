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
import { RulesScreen }          from '../components/RulesScreen.js'

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
  // 실제 인게임 레이아웃을 ghost로 뒤에 깔고
  // 게임 준비 패널을 위에 덮는 방식
  // ─────────────────────────────────────

  _renderLobby() {
    const players = this.getLobbyPlayers()
    const config  = this.getLobbyConfig()
    const count   = players.length
    const total   = config.playerCount

    this.el.classList.add('grimoire--lobby')

    // ── Ghost: 실제 인게임 레이아웃 (흐릿하게 뒤에) ─────────
    const ghost = document.createElement('div')
    ghost.className = 'grimoire-ghost'

    // Ghost PhaseHeader (Night 1 형태)
    ghost.appendChild(renderPhaseHeader({ phase: 'night', round: 1, players: [] }))

    // Ghost PlayerGrid (N개 빈 자리)
    const ghostCard = document.createElement('div')
    ghostCard.className = 'card'
    ghostCard.innerHTML = '<div class="card-title">👥 플레이어</div>'
    const ghostPlayers = Array.from({ length: Math.max(total, 5) }, (_, i) => ({
      id: i + 1, name: `${i + 1}`, status: 'alive', isPoisoned: false, isDrunk: false,
    }))
    ghostCard.appendChild(renderPlayerGrid(ghostPlayers, { selectable: false }))
    ghost.appendChild(ghostCard)

    // Ghost 버튼
    const ghostBtns = document.createElement('div')
    ghostBtns.className = 'btn-grid-2'
    ghostBtns.innerHTML = `
      <button class="btn btn-primary btn-grid-full" disabled>▶ 밤 진행 시작</button>
      <button class="btn btn-grid-full" disabled>🌅 낮으로 전환</button>
    `
    ghost.appendChild(ghostBtns)
    this.el.appendChild(ghost)

    // ── Lobby 패널: 게임 준비 단계 (위에 덮음) ──────────────
    const panel = document.createElement('div')
    panel.className = 'grimoire-lobby-panel'

    // 1) 매칭 상태 바 (PhaseHeader 위치)
    const statusBar = document.createElement('div')
    statusBar.className = 'phase-header phase-header--lobby grimoire-lobby-status'
    statusBar.innerHTML = `
      <span class="phase-header__icon">🏰</span>
      <div class="phase-header__text">
        <span class="phase-header__name">매칭 대기 중</span>
        <span class="phase-header__sub">
          ${count > 0 ? `${count}명 입장됨` : '참가자 연결 대기 중...'}
        </span>
      </div>
      <div class="phase-header__alive">
        <span class="phase-header__alive-num" style="color:var(--tl-light)">${count}</span>
        <span class="phase-header__alive-lbl">입장</span>
      </div>
    `
    panel.appendChild(statusBar)

    // 2) 현재 참가자 (PlayerGrid 위치)
    const participantsCard = document.createElement('div')
    participantsCard.className = 'card grimoire-lobby-card'
    participantsCard.innerHTML = '<div class="card-title">👥 현재 참가자</div>'

    if (count === 0) {
      const empty = document.createElement('div')
      empty.style.cssText = 'color:var(--text4);font-size:0.78rem;padding:10px 0 4px;display:flex;align-items:center;gap:8px;'
      empty.innerHTML = `<span class="lobby-wait-dot"></span> 참가자 연결 대기 중...`
      participantsCard.appendChild(empty)
    } else {
      const chips = document.createElement('div')
      chips.style.cssText = 'display:flex;flex-wrap:wrap;gap:7px;padding:6px 0 2px;'
      players.forEach(p => {
        const chip = document.createElement('span')
        chip.className = 'grimoire-lobby-chip'
        chip.textContent = p.name
        chips.appendChild(chip)
      })
      participantsCard.appendChild(chips)
    }
    panel.appendChild(participantsCard)

    // 3) 액션 버튼 (밤 진행 / 낮 전환 버튼 위치)
    const btnGrid = document.createElement('div')
    btnGrid.className = 'btn-grid-2'

    const startBtn = document.createElement('button')
    startBtn.className = 'btn btn-gold btn-grid-full'
    startBtn.style.padding = '13px'
    startBtn.textContent = count > 0 ? `🏰 게임 시작 (${count}명)` : '🏰 게임 시작'
    startBtn.disabled = count === 0
    if (count === 0) startBtn.style.opacity = '0.45'
    startBtn.addEventListener('click', () => this.onStartGame?.())
    btnGrid.appendChild(startBtn)

    const settingsBtn = document.createElement('button')
    settingsBtn.className = 'btn'
    settingsBtn.innerHTML = `⚙️ 설정<span style="display:block;font-size:0.58rem;color:var(--text4)">${total}인 · ${config.roleCount}개</span>`
    settingsBtn.addEventListener('click', () => this.onOpenSettings?.())
    btnGrid.appendChild(settingsBtn)

    panel.appendChild(btnGrid)

    if (count > 0 && count < 5) {
      const hint = document.createElement('div')
      hint.style.cssText = 'text-align:center;font-size:0.65rem;color:var(--text4);'
      hint.textContent = `※ 정식 게임은 5명 이상 권장 · ${count}명으로도 시작 가능`
      panel.appendChild(hint)
    }

    // 4) 규칙서 (로그 위치)
    const rulesCard = document.createElement('div')
    rulesCard.className = 'card grimoire-lobby-card'
    rulesCard.innerHTML = `
      <div class="card-title">📜 규칙서</div>
      <div style="font-size:0.72rem;color:var(--text3);margin-bottom:8px;">
        게임 진행 방법과 역할 판정 기준을 확인하세요
      </div>
    `
    const rulesBtn2 = document.createElement('button')
    rulesBtn2.className = 'btn btn-full'
    rulesBtn2.textContent = '규칙 보기'
    rulesBtn2.addEventListener('click', () => this._showRulesPopup())
    rulesCard.appendChild(rulesBtn2)
    panel.appendChild(rulesCard)

    this.el.appendChild(panel)
  }

  // ─────────────────────────────────────
  // 규칙 팝업
  // ─────────────────────────────────────

  _showRulesPopup() {
    document.getElementById('rules-popup')?.remove()

    const overlay = document.createElement('div')
    overlay.className = 'popup-overlay'
    overlay.id = 'rules-popup'
    overlay.style.alignItems = 'flex-start'
    overlay.style.padding = '12px'

    const box = document.createElement('div')
    box.className = 'popup-box'
    box.style.cssText = 'max-height:88vh;overflow-y:auto;padding:16px;margin-top:8px;'

    const header = document.createElement('div')
    header.style.cssText = 'display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;'
    header.innerHTML = `
      <span style="font-family:'Noto Serif KR',serif;font-size:0.92rem;font-weight:700;color:var(--gold2)">📜 게임 규칙</span>
      <button id="rules-close-btn" class="btn" style="padding:4px 10px;font-size:0.72rem;">닫기</button>
    `
    box.appendChild(header)

    const rules = new RulesScreen()
    rules.mount(box)

    overlay.appendChild(box)
    overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove() })
    box.querySelector('#rules-close-btn').addEventListener('click', () => overlay.remove())
    document.body.appendChild(overlay)
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

    const headerDiv = document.createElement('div')
    headerDiv.style.cssText = 'display:flex;align-items:center;gap:10px;margin-bottom:12px;'

    const iconSpan = document.createElement('span')
    iconSpan.style.fontSize = '1.8rem'
    // PNG 이미지면 img 태그로, 아니면 emoji로 표시
    if (role?.icon && role.icon.endsWith('.png')) {
      const img = document.createElement('img')
      img.src = `./asset/icons/${role.icon}`
      img.alt = role.name
      img.style.cssText = 'width:50px;height:50px;object-fit:contain;'
      iconSpan.appendChild(img)
    } else {
      iconSpan.textContent = role?.icon || '?'
    }

    const infoDiv = document.createElement('div')
    infoDiv.innerHTML = `
      <div style="font-family:'Noto Serif KR',serif;font-size:1rem;font-weight:700;color:var(--text)">${player.name} (${player.id}번)</div>
      <div style="font-size:0.72rem;color:var(--text3)">${role?.name || player.role}</div>
    `

    headerDiv.appendChild(iconSpan)
    headerDiv.appendChild(infoDiv)
    box.appendChild(headerDiv)

    const btns = [
      { label: '💀 사망 처리', action: () => { this.engine.killPlayer(player.id, 'manual'); this.refresh(); overlay.remove() } },
      { label: '☠ 중독 토글', action: () => { player.isPoisoned = !player.isPoisoned; this.refresh(); overlay.remove() } },
      { label: '🍾 취함 토글', action: () => { player.isDrunk = !player.isDrunk; this.refresh(); overlay.remove() } },
    ]

    if (player.role === 'slayer') {
      btns.push({ label: '🗡 처단자 선언', action: () => { overlay.remove(); this.onPlayerAction?.('slayer', player.id) } })
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
/* ── Lobby 모드 컨테이너 ── */
.grimoire--lobby {
  position: relative;
}

/* ── Ghost: 실제 인게임 레이아웃 (뒤에 희미하게) ── */
.grimoire-ghost {
  position: absolute;
  inset: 0;
  opacity: 0.08;
  filter: blur(1.5px);
  pointer-events: none;
  user-select: none;
  overflow: hidden;
}

/* ── Lobby 패널: 게임 준비 단계 (위에 덮음) ── */
.grimoire-lobby-panel {
  position: relative;
  z-index: 1;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

/* 매칭 상태 바 */
.grimoire-lobby-status {
  background: rgba(11, 10, 24, 0.75);
  backdrop-filter: blur(6px);
  border-color: rgba(122, 111, 183, 0.3);
}

/* 로비 카드 */
.grimoire-lobby-card {
  background: rgba(20, 18, 42, 0.9);
  backdrop-filter: blur(4px);
}

/* 현재 참가자 칩 */
.grimoire-lobby-chip {
  background: rgba(91, 179, 198, 0.12);
  border: 1px solid rgba(91, 179, 198, 0.35);
  border-radius: 20px;
  padding: 4px 12px;
  font-size: 0.78rem;
  color: var(--tl-light);
  font-weight: 600;
  white-space: nowrap;
}

/* 대기 점 */
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
