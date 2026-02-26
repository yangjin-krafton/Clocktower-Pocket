/**
 * 호스트 앱 — 진입점 (오프라인 전용)
 *
 * 흐름:
 *   진입 → 즉시 Grimoire (lobby phase)
 *          Grimoire 안에서: 인원/역할 설정 · 게임 시작 버튼
 *          호스트가 "게임 시작" 누르면 → 역할 배정 → 밤 페이즈 시작
 */
import { engine }        from '../game-engine.js'
import { RulesScreen }   from '../components/RulesScreen.js'
import { Setup }         from './Setup.js'
import { Grimoire }      from './Grimoire.js'
import { NightAction }   from './NightAction.js'
import { DayFlow }       from './DayFlow.js'
import { Victory }       from './Victory.js'
import { ROLES_TB, PLAYER_COUNTS } from '../data/roles-tb.js'

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
    this._gameStarting = true

    const names = Array.from(
      { length: this.pendingPlayerCount },
      (_, i) => `플레이어${i + 1}`
    )

    engine.reset()
    engine.initGame(names, this.pendingRoleIds)
    engine.startNight()

    this.currentTab = 'role'
    this.tabBar.querySelectorAll('.tab-item').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.tab === 'role')
    })
    this._showGrimoire()
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
