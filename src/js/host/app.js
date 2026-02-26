/**
 * 호스트 앱 — 진입점 (오프라인 전용)
 *
 * 흐름:
 *   진입 → 즉시 Grimoire (lobby phase)
 *          Grimoire 안에서: 인원/역할 설정 · 게임 시작 버튼
 *          호스트가 "게임 시작" 누르면 → 역할 배정 → 밤 페이즈 시작
 */
import { engine }                          from '../game-engine.js'
import { RulesScreen }                     from '../components/RulesScreen.js'
import { Setup }                           from './Setup.js'
import { Grimoire }                        from './Grimoire.js'
import { NightAction }                     from './NightAction.js'
import { DayFlow }                         from './DayFlow.js'
import { Victory }                         from './Victory.js'
import { ROLES_TB, ROLES_BY_ID, PLAYER_COUNTS } from '../data/roles-tb.js'
import { encodeRoomCode, formatCode }      from '../room-code.js'

const DEFAULT_PLAYER_COUNT = 7

export class HostApp {
  constructor() {
    this.currentScreen  = null
    this.nightAction    = null
    this.doneSteps      = []
    this.container      = document.getElementById('app-content')
    this.tabBar         = document.getElementById('tab-bar')

    this.pendingPlayerCount = DEFAULT_PLAYER_COUNT
    this.pendingRoleIds     = []
    this._gameStarting      = false
    this._grimoire          = null
    this.currentTab         = 'role'
    this._lastRoomCode      = null   // 마지막 생성된 방 코드
  }

  init() {
    this.pendingPlayerCount = DEFAULT_PLAYER_COUNT
    this.pendingRoleIds     = this._autoRoles(DEFAULT_PLAYER_COUNT)
    this._buildTabs()
    this._switchTab('role')
  }

  // ─────────────────────────────────────
  // 기본 역할 자동 선택
  // ─────────────────────────────────────

  _autoRoles(n) {
    const comp = PLAYER_COUNTS[n]
    if (!comp) return []
    const pick = (team, cnt) =>
      ROLES_TB.filter(r => r.team === team)
               .sort(() => Math.random() - 0.5)
               .slice(0, cnt)
               .map(r => r.id)
    return [
      ...pick('townsfolk', comp.townsfolk),
      ...pick('outsider',  comp.outsider),
      ...pick('minion',    comp.minion),
      'imp',
    ]
  }

  // ─────────────────────────────────────
  // 설정 팝업 (Grimoire 위 오버레이)
  // ─────────────────────────────────────

  _showSetupPopup() {
    document.getElementById('setup-popup')?.remove()

    const overlay = document.createElement('div')
    overlay.className = 'popup-overlay'
    overlay.id = 'setup-popup'

    const box = document.createElement('div')
    box.className = 'popup-box'
    box.style.cssText = 'max-height:82vh;overflow-y:auto;padding:14px;'

    const header = document.createElement('div')
    header.style.cssText = 'font-family:"Noto Serif KR",serif;font-size:0.92rem;font-weight:700;color:var(--gold2);margin-bottom:10px;'
    header.textContent = '⚙️ 게임 설정'
    box.appendChild(header)

    const setup = new Setup({
      onCreateRoom: (playerCount, roleIds) => {
        this.pendingPlayerCount = playerCount
        this.pendingRoleIds     = roleIds
        overlay.remove()
        this._grimoire?.refresh()
      },
    })

    const origRender = setup._render.bind(setup)
    setup._render = function () {
      origRender()
      const btn = this.el?.querySelector('.btn-gold')
      if (btn) btn.textContent = '✓ 설정 완료'
    }

    setup.mount(box)

    overlay.addEventListener('click', e => {
      if (e.target === overlay) {
        overlay.remove()
        this._grimoire?.refresh()
      }
    })

    overlay.appendChild(box)
    document.body.appendChild(overlay)
  }

  // ─────────────────────────────────────
  // 탭 시스템
  // ─────────────────────────────────────

  _buildTabs() {
    this.tabBar.innerHTML = ''
    const tabs = [
      { id: 'role',  icon: '🎭', label: '그리모아' },
      { id: 'memo',  icon: '📝', label: '메모' },
      { id: 'dict',  icon: '📖', label: '사전' },
      { id: 'rules', icon: '📜', label: '규칙' },
    ]
    tabs.forEach(tab => {
      const btn = document.createElement('button')
      btn.className = 'tab-item' + (tab.id === this.currentTab ? ' active' : '')
      btn.dataset.tab = tab.id
      btn.innerHTML = `<span class="tab-icon">${tab.icon}</span><span class="tab-label">${tab.label}</span>`
      btn.addEventListener('click', () => window.switchTab(tab.id))
      this.tabBar.appendChild(btn)
    })
  }

  _switchTab(tabId) {
    this.currentTab = tabId
    this.tabBar.querySelectorAll('.tab-item').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.tab === tabId)
    })

    this._clearScreen()

    if (tabId === 'role') {
      const phase = engine.state?.phase || 'lobby'
      if (phase === 'lobby' || phase === 'night') {
        this._showGrimoire()
      } else if (phase === 'day') {
        this._showDayFlow()
      } else {
        this._showGrimoire()
      }
    } else if (tabId === 'rules') {
      const initialPage = this._pendingRulesPage || 'index.md'
      this._pendingRulesPage = null
      const rulesScreen = new RulesScreen({ initialPage })
      rulesScreen.mount(this.container)
      this.currentScreen = rulesScreen
    } else if (tabId === 'memo') {
      import('../player/Memo.js').then(({ Memo }) => {
        const memo = new Memo()
        memo.mount(this.container)
        this.currentScreen = memo
      })
    } else if (tabId === 'dict') {
      import('../player/CharacterDict.js').then(({ CharacterDict }) => {
        const scriptRoles = this.pendingRoleIds.length > 0 ? this.pendingRoleIds : null
        const dict = new CharacterDict({
          scriptRoles,
          onRoleClick: (roleId) => {
            this._pendingRulesPage = `${roleId}.md`
            this._switchTab('rules')
          },
        })
        dict.mount(this.container)
        this.currentScreen = dict
      })
    }
  }

  // ─────────────────────────────────────
  // 화면 전환
  // ─────────────────────────────────────

  _clearScreen() {
    this.currentScreen?.unmount()
    this.currentScreen = null
    this._grimoire     = null
    this.container.innerHTML = ''
  }

  _showGrimoire() {
    this._clearScreen()
    this.doneSteps = []

    const grimoire = new Grimoire({
      engine,
      getLobbyPlayers: () => Array.from(
        { length: this.pendingPlayerCount },
        (_, i) => ({ name: `플레이어${i + 1}` })
      ),
      getLobbyConfig:  () => ({
        playerCount: this.pendingPlayerCount,
        roleCount:   this.pendingRoleIds.length,
        roleIds:     this.pendingRoleIds,
        roomCode:    this._lastRoomCode,
      }),
      onStartGame:          () => this._handleManualStart(),
      onOpenSettings:       () => this._showSetupPopup(),
      onStartNight:         () => this._handleStartNight(),
      onStartDay:           () => this._handleStartDay(),
      onNextNightStep:      () => this._handleNextNightStep(),
      onPlayerAction:       (action, id) => this._handlePlayerAction(action, id),
      onPlayerCountChange:  (n) => {
        this.pendingPlayerCount = Math.max(5, Math.min(15, n))
        this._grimoire?.refresh()
      },
      onRoleToggle: (roleId) => {
        const idx = this.pendingRoleIds.indexOf(roleId)
        if (idx === -1) this.pendingRoleIds.push(roleId)
        else            this.pendingRoleIds.splice(idx, 1)
        this._grimoire?.refresh()
      },
    })

    grimoire.mount(this.container)
    this.currentScreen = grimoire
    this._grimoire     = grimoire

    engine.on('stateChanged', () => grimoire.refresh())
  }

  // ─────────────────────────────────────
  // 게임 시작
  // ─────────────────────────────────────

  _handleManualStart() {
    if (this._gameStarting) return

    // 역할 셔플 (코드 생성 전에 미리 확정)
    const shuffled = [...this.pendingRoleIds].sort(() => Math.random() - 0.5)

    // 레드헤링 계산 (선 팀 플레이어 중 1명)
    const tempPlayers = shuffled.map((roleId, i) => {
      const role = ROLES_BY_ID[roleId]
      const team = role ? (role.team === 'townsfolk' || role.team === 'outsider' ? 'good' : 'evil') : 'good'
      return { id: i + 1, team }
    })
    const goodPlayers = tempPlayers.filter(p => p.team === 'good')
    const redHerringId = goodPlayers.length > 0
      ? goodPlayers[Math.floor(Math.random() * goodPlayers.length)].id
      : 0

    // 방 코드 생성
    const code = encodeRoomCode(this.pendingPlayerCount, shuffled, redHerringId)
    this._lastRoomCode = code

    // 코드 팝업 표시 → 닫으면 게임 시작
    this._showCodePopup(code, shuffled, () => {
      this._gameStarting = true
      const names = Array.from({ length: this.pendingPlayerCount }, (_, i) => `플레이어${i + 1}`)
      engine.reset()
      engine.initGame(names, shuffled, { preAssigned: true, redHerringId })
      engine.startNight()

      this.currentTab = 'role'
      this.tabBar.querySelectorAll('.tab-item').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.tab === 'role')
      })
      this._showGrimoire()
    })
  }

  _showCodePopup(code, assignedRoles, onStart) {
    document.getElementById('code-popup')?.remove()

    const overlay = document.createElement('div')
    overlay.className = 'popup-overlay'
    overlay.id = 'code-popup'

    const box = document.createElement('div')
    box.className = 'popup-box'
    box.style.cssText = 'max-height:88vh;overflow-y:auto;padding:20px 16px;'

    // 제목
    const title = document.createElement('div')
    title.style.cssText = 'font-family:"Noto Serif KR",serif;font-size:1rem;font-weight:700;color:var(--gold2);margin-bottom:16px;text-align:center;'
    title.textContent = '🏰 방 코드가 생성되었습니다'
    box.appendChild(title)

    // 방 코드 표시
    const codeDisplay = document.createElement('div')
    codeDisplay.style.cssText = `
      background:var(--surface2);border:2px solid var(--gold2);border-radius:10px;
      padding:14px 10px;text-align:center;margin-bottom:16px;cursor:pointer;
    `
    const formatted = formatCode(code)
    codeDisplay.innerHTML = `
      <div style="font-size:1.6rem;font-weight:900;letter-spacing:0.2em;color:var(--gold2);font-family:monospace">${formatted}</div>
      <div style="font-size:0.65rem;color:var(--text4);margin-top:6px;">탭하여 복사</div>
    `
    codeDisplay.addEventListener('click', () => {
      navigator.clipboard?.writeText(code).catch(() => {})
      codeDisplay.querySelector('div:last-child').textContent = '✓ 복사됨!'
      setTimeout(() => { codeDisplay.querySelector('div:last-child').textContent = '탭하여 복사' }, 1500)
    })
    box.appendChild(codeDisplay)

    // 자리별 역할 목록
    const listTitle = document.createElement('div')
    listTitle.style.cssText = 'font-size:0.75rem;color:var(--text3);margin-bottom:8px;font-weight:600;'
    listTitle.textContent = '자리별 역할 배정 (호스트 전용)'
    box.appendChild(listTitle)

    const list = document.createElement('div')
    list.style.cssText = 'display:flex;flex-direction:column;gap:4px;margin-bottom:20px;'
    assignedRoles.forEach((roleId, i) => {
      const role = ROLES_BY_ID[roleId]
      const teamColor = {
        townsfolk: 'var(--bl-light)', outsider: 'var(--tl-light)',
        minion: 'var(--rd-light)', demon: 'var(--rd-light)',
      }[role?.team] || 'var(--text2)'

      const row = document.createElement('div')
      row.style.cssText = 'display:flex;align-items:center;gap:10px;padding:6px 10px;background:var(--surface2);border-radius:6px;'

      const seatBadge = document.createElement('span')
      seatBadge.style.cssText = 'font-size:0.7rem;background:var(--lead2);color:var(--text3);border-radius:4px;padding:2px 7px;min-width:36px;text-align:center;'
      seatBadge.textContent = `자리 ${i + 1}`

      const iconSpan = document.createElement('span')
      iconSpan.style.cssText = 'width:22px;height:22px;display:inline-flex;align-items:center;justify-content:center;flex-shrink:0;'
      if (role?.icon?.endsWith('.png')) {
        const img = document.createElement('img')
        img.src = `./asset/icons/${role.icon}`
        img.style.cssText = 'width:100%;height:100%;object-fit:contain;'
        iconSpan.appendChild(img)
      } else {
        iconSpan.textContent = role?.iconEmoji || '?'
      }

      const nameSpan = document.createElement('span')
      nameSpan.style.cssText = `font-size:0.82rem;font-weight:600;color:${teamColor};`
      nameSpan.textContent = role?.name || roleId

      row.appendChild(seatBadge)
      row.appendChild(iconSpan)
      row.appendChild(nameSpan)
      list.appendChild(row)
    })
    box.appendChild(list)

    // 안내 문구
    const hint = document.createElement('div')
    hint.style.cssText = 'font-size:0.68rem;color:var(--text4);text-align:center;margin-bottom:16px;line-height:1.6;'
    hint.textContent = '참가자에게 방 코드와 자리 번호를 알려주세요.\n참가자는 앱에서 코드 + 자리 번호로 자신의 역할을 확인합니다.'
    hint.style.whiteSpace = 'pre-line'
    box.appendChild(hint)

    // 게임 시작 버튼
    const startBtn = document.createElement('button')
    startBtn.className = 'btn btn-gold btn-full'
    startBtn.style.cssText = 'padding:14px;font-size:0.95rem;'
    startBtn.textContent = '▶ 게임 시작 (스토리텔러 화면)'
    startBtn.addEventListener('click', () => {
      overlay.remove()
      onStart()
    })
    box.appendChild(startBtn)

    overlay.appendChild(box)
    document.body.appendChild(overlay)
  }

  _handleStartNight() {
    engine.startNight()
    this.doneSteps = []
    this.currentTab = 'role'
    this.tabBar.querySelectorAll('.tab-item').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.tab === 'role')
    })
    this._showGrimoire()
  }

  _handleStartDay() {
    engine.startDay()
    const winCheck = engine.checkWinCondition()
    if (winCheck.gameOver) {
      this._showVictory(winCheck.winner, winCheck.reason)
      return
    }
    this.currentTab = 'role'
    this.tabBar.querySelectorAll('.tab-item').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.tab === 'role')
    })
    this._showDayFlow()
  }

  _handleNextNightStep() {
    const step = engine.state.currentNightStep
    if (!step) {
      this._handleStartDay()
      return
    }
    if (!this.nightAction) {
      this.nightAction = new NightAction({
        engine,
        onStepDone: (roleId) => {
          this.doneSteps.push(roleId)
          engine.nextNightStep()
          const next = engine.state.currentNightStep
          if (next) {
            this.nightAction.processCurrentStep()
          } else {
            this.nightAction = null
            this._handleStartDay()
          }
        },
      })
    }
    this.nightAction.processCurrentStep()
  }

  _showDayFlow() {
    this._clearScreen()
    const dayFlow = new DayFlow({
      engine,
      onStartNight: () => this._handleStartNight(),
      onGameOver:   (winner, reason) => this._showVictory(winner, reason),
    })
    dayFlow.mount(this.container)
    this.currentScreen = dayFlow
    engine.on('stateChanged', () => dayFlow.refresh())
  }

  _showVictory(winner, reason) {
    this._clearScreen()
    this.currentTab = 'role'
    this.tabBar.querySelectorAll('.tab-item').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.tab === 'role')
    })
    const victory = new Victory({
      engine,
      winner,
      reason,
      onNewGame: () => {
        engine.reset()
        this._gameStarting  = false
        this.pendingRoleIds = this._autoRoles(this.pendingPlayerCount)
        this._switchTab('role')
      },
    })
    victory.mount(this.container)
    this.currentScreen = victory
  }

  _handlePlayerAction(action, actorId) {}
}
