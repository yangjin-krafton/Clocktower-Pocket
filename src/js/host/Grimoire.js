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
import { CharacterDict }        from '../player/CharacterDict.js'

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

    const TEAM_LABEL = { townsfolk: '마을 주민', outsider: '아웃사이더', minion: '미니언', demon: '데몬' }

    // ── 1) 상단 헤더: 매칭 상태 + 설정 버튼 ──────────────────
    const header = document.createElement('div')
    header.className = 'gl-header'

    const headerLeft = document.createElement('div')
    headerLeft.className = 'gl-header__left'
    headerLeft.innerHTML = `
      <span class="gl-header__title">🏰 게임 준비</span>
      <span class="gl-header__sub">${count > 0 ? `${count}명 입장됨` : '참가자 연결 대기 중...'}</span>
    `

    const settingsBtn = document.createElement('button')
    settingsBtn.className = 'btn gl-header__settings'
    settingsBtn.innerHTML = `⚙️ 설정<span style="display:block;font-size:0.55rem;color:var(--text4)">${total}인 · ${config.roleCount}개</span>`
    settingsBtn.addEventListener('click', () => this.onOpenSettings?.())

    header.appendChild(headerLeft)
    header.appendChild(settingsBtn)
    this.el.appendChild(header)

    // ── 2) 참가자 칩 ─────────────────────────────────────────
    const participantsRow = document.createElement('div')
    participantsRow.className = 'gl-participants'

    if (count === 0) {
      participantsRow.innerHTML = `<span class="lobby-wait-dot"></span><span style="color:var(--text4);font-size:0.75rem;margin-left:6px">대기 중...</span>`
    } else {
      players.forEach(p => {
        const chip = document.createElement('span')
        chip.className = 'grimoire-lobby-chip'
        chip.textContent = p.name
        participantsRow.appendChild(chip)
      })
    }
    this.el.appendChild(participantsRow)

    // ── 3) 역할 토큰 그리드 ───────────────────────────────────
    if (config.roleIds && config.roleIds.length > 0) {
      const rolesByTeam = { townsfolk: [], outsider: [], minion: [], demon: [] }
      config.roleIds.forEach(id => {
        const role = ROLES_BY_ID[id]
        if (role && rolesByTeam[role.team]) rolesByTeam[role.team].push(role)
      })

      ;['townsfolk', 'outsider', 'minion', 'demon'].forEach(team => {
        const teamRoles = rolesByTeam[team]
        if (teamRoles.length === 0) return

        const section = document.createElement('div')
        section.className = 'dict__section'

        const heading = document.createElement('div')
        heading.className = `dict__section-title dict__section-title--${team}`
        heading.textContent = TEAM_LABEL[team]
        section.appendChild(heading)

        const grid = document.createElement('div')
        grid.className = 'dict__grid'

        teamRoles.forEach(role => {
          const btn = document.createElement('button')
          btn.className = `dict__token dict__token--${role.team}`

          const iconDiv = document.createElement('div')
          iconDiv.className = 'dict__token-icon'
          if (role.icon?.endsWith('.png')) {
            const img = document.createElement('img')
            img.src = `./asset/icons/${role.icon}`
            img.alt = role.name
            iconDiv.appendChild(img)
          } else {
            iconDiv.textContent = role.iconEmoji || role.icon || '?'
          }

          const nameDiv = document.createElement('div')
          nameDiv.className = 'dict__token-name'
          nameDiv.textContent = role.name

          btn.appendChild(iconDiv)
          btn.appendChild(nameDiv)
          btn.addEventListener('click', () => this._showRoleModal(role))
          grid.appendChild(btn)
        })

        section.appendChild(grid)
        this.el.appendChild(section)
      })
    } else {
      const empty = document.createElement('div')
      empty.className = 'gl-empty'
      empty.innerHTML = `<div style="font-size:1.8rem;margin-bottom:10px">⚙️</div><div>설정에서 역할을 구성해주세요</div>`
      this.el.appendChild(empty)
    }

    // ── 4) 시작 버튼 ─────────────────────────────────────────
    const startBtn = document.createElement('button')
    startBtn.className = 'btn btn-gold gl-start-btn'
    startBtn.textContent = count > 0 ? `🏰 게임 시작 (${count}명)` : '🏰 게임 시작'
    startBtn.disabled = count === 0
    if (count === 0) startBtn.style.opacity = '0.45'
    startBtn.addEventListener('click', () => this.onStartGame?.())
    this.el.appendChild(startBtn)

    if (count > 0 && count < 5) {
      const hint = document.createElement('div')
      hint.style.cssText = 'text-align:center;font-size:0.65rem;color:var(--text4);margin-top:4px;'
      hint.textContent = `※ 정식 게임은 5명 이상 권장 · ${count}명으로도 시작 가능`
      this.el.appendChild(hint)
    }
  }

  // ─────────────────────────────────────
  // 역할 상세 모달 (로비용, CharacterDict 모달 재사용)
  // ─────────────────────────────────────

  _showRoleModal(role) {
    const helper = new CharacterDict({ scriptRoles: null })
    helper._openModal(role)
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
/* ── 로비 컨테이너 ── */
.grimoire--lobby {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

/* ── 상단 헤더 ── */
.gl-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 2px 6px;
  border-bottom: 1px solid var(--lead2);
  margin-bottom: 4px;
}
.gl-header__left {
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.gl-header__title {
  font-family: 'Noto Serif KR', serif;
  font-size: 0.92rem;
  font-weight: 700;
  color: var(--gold2);
}
.gl-header__sub {
  font-size: 0.68rem;
  color: var(--text3);
}
.gl-header__settings {
  padding: 7px 12px;
  font-size: 0.72rem;
  text-align: center;
}

/* ── 참가자 칩 행 ── */
.gl-participants {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  align-items: center;
  min-height: 28px;
  padding: 2px 0 6px;
}
.grimoire-lobby-chip {
  background: rgba(91, 179, 198, 0.12);
  border: 1px solid rgba(91, 179, 198, 0.35);
  border-radius: 20px;
  padding: 4px 12px;
  font-size: 0.75rem;
  color: var(--tl-light);
  font-weight: 600;
  white-space: nowrap;
}

/* ── 역할 없을 때 빈 화면 ── */
.gl-empty {
  text-align: center;
  padding: 48px 20px;
  color: var(--text4);
  font-size: 0.82rem;
}

/* ── 시작 버튼 ── */
.gl-start-btn {
  width: 100%;
  padding: 14px;
  margin-top: 8px;
  font-size: 0.92rem;
}

/* ── 대기 점 ── */
.lobby-wait-dot {
  display: inline-block;
  width: 7px; height: 7px;
  border-radius: 50%;
  background: var(--pu-base);
  animation: dot-pulse 1.2s infinite;
  flex-shrink: 0;
}
  `
  document.head.appendChild(style)
}
