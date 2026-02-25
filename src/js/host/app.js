/**
 * 호스트 앱 — 진입점
 *
 * 흐름:
 *   진입 → 방 자동 생성 → 즉시 Grimoire (lobby phase) + LobbyBanner
 *          Grimoire 안에서: 참가자 현황 확인 · 설정 변경 · 게임 시작 버튼
 *          플레이어는 자유롭게 입퇴장 (아무 제한 없음)
 *          호스트가 "게임 시작" 누르면 → 역할 배정 → 카운트다운 → 정식 시작
 */
import { P2PManager }    from '../p2p.js'
import { engine }        from '../game-engine.js'
import { LobbyBanner }   from '../components/LobbyBanner.js'
import { RulesScreen }   from '../components/RulesScreen.js'
import { Setup }         from './Setup.js'
import { Grimoire }      from './Grimoire.js'
import { NightAction }   from './NightAction.js'
import { DayFlow }       from './DayFlow.js'
import { Victory }       from './Victory.js'
import { ROLES_TB, PLAYER_COUNTS } from '../data/roles-tb.js'

const COUNTDOWN_SECONDS    = 5
const DEFAULT_PLAYER_COUNT = 7

export class HostApp {
  constructor() {
    this.p2p            = new P2PManager()
    this.currentScreen  = null
    this.nightAction    = null
    this.doneSteps      = []
    this.container      = document.getElementById('app-content')
    this.bannerSlot     = document.getElementById('lobby-banner')
    this.tabBar         = document.getElementById('tab-bar')

    this.pendingPlayers     = []  // { peerId, name }  — 현재 방 안에 있는 사람
    this.pendingPlayerCount = DEFAULT_PLAYER_COUNT
    this.pendingRoleIds     = []
    this._gameStarting      = false
    this.lobbyBanner        = null
    this._grimoire          = null  // lobby refresh 용 참조
    this.currentTab         = 'role'
  }

  async init() {
    this._setupP2PHandlers()

    this.container.innerHTML = `
      <div style="text-align:center;padding:60px 20px;color:var(--text3)">
        <div style="font-size:2rem;margin-bottom:10px">🏰</div>
        <div>방 생성 중...</div>
      </div>
    `

    const roomCode = P2PManager.generateRoomCode()
    try {
      await this.p2p.createRoom(roomCode)

      // 기본 설정
      this.pendingPlayerCount = DEFAULT_PLAYER_COUNT
      this.pendingRoleIds     = this._autoRoles(DEFAULT_PLAYER_COUNT)

      // ① LobbyBanner 상단 마운트
      this._mountLobbyBanner(roomCode, DEFAULT_PLAYER_COUNT)

      // ② 탭바 표시 및 초기화
      this.tabBar.style.display = 'flex'
      this._buildTabs()
      this._switchTab('role')

    } catch (e) {
      alert('방 생성 실패: ' + e.message)
    }
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
        if (this.lobbyBanner) this.lobbyBanner.updateTotal(playerCount)
        overlay.remove()
        // Grimoire lobby 갱신
        this._grimoire?.refresh()
      },
    })

    // "방 생성하기" → "설정 완료"로 버튼 텍스트 변경
    const origRender = setup._render.bind(setup)
    setup._render = function () {
      origRender()
      const btn = this.el?.querySelector('.btn-gold')
      if (btn) btn.textContent = '✓ 설정 완료'
    }

    setup.mount(box)

    // 배경 클릭 → 기본값 유지하고 닫기
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
  // LobbyBanner 관리
  // ─────────────────────────────────────

  _mountLobbyBanner(roomCode, total) {
    this._dismissLobbyBanner()
    this.lobbyBanner = new LobbyBanner({ roomCode, total })
    this.lobbyBanner.mount(this.bannerSlot)
  }

  _dismissLobbyBanner() {
    if (this.lobbyBanner) {
      this.lobbyBanner.dismiss()
      this.lobbyBanner = null
    }
  }

  // ─────────────────────────────────────
  // 탭 시스템
  // ─────────────────────────────────────

  _buildTabs() {
    this.tabBar.innerHTML = ''
    const tabs = [
      { id: 'role',  icon: '🎭', label: '그리모아' },
      { id: 'rules', icon: '📜', label: '규칙' },
    ]
    tabs.forEach(tab => {
      const btn = document.createElement('button')
      btn.className = 'tab-item' + (tab.id === this.currentTab ? ' active' : '')
      btn.dataset.tab = tab.id
      btn.innerHTML = `<span class="tab-icon">${tab.icon}</span><span class="tab-label">${tab.label}</span>`
      btn.addEventListener('click', () => this._switchTab(tab.id))
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
      // 현재 게임 상태에 따라 적절한 화면 표시
      const phase = engine.state.phase
      if (phase === 'lobby' || phase === 'night') {
        this._showGrimoire()
      } else if (phase === 'day') {
        this._showDayFlow()
      } else if (phase === 'victory') {
        // Victory 화면은 별도 처리
        this._showGrimoire()
      }
    } else if (tabId === 'rules') {
      const rulesScreen = new RulesScreen()
      rulesScreen.mount(this.container)
      this.currentScreen = rulesScreen
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
      getLobbyPlayers: () => this.pendingPlayers,
      getLobbyConfig:  () => ({
        playerCount: this.pendingPlayerCount,
        roleCount:   this.pendingRoleIds.length,
      }),
      onStartGame:    () => this._handleManualStart(),
      onOpenSettings: () => this._showSetupPopup(),
      onStartNight:   () => this._handleStartNight(),
      onStartDay:     () => this._handleStartDay(),
      onNextNightStep:() => this._handleNextNightStep(),
      onPlayerAction: (action, id) => this._handlePlayerAction(action, id),
    })

    grimoire.mount(this.container)
    this.currentScreen = grimoire
    this._grimoire     = grimoire

    engine.on('stateChanged',  () => grimoire.refresh())
    engine.on('nightResolved', ({ deaths }) => this._broadcastDeaths(deaths))
  }

  // ─────────────────────────────────────
  // 게임 시작 — 호스트가 수동으로 버튼 클릭
  // ─────────────────────────────────────

  _handleManualStart() {
    if (this._gameStarting) return
    if (this.pendingPlayers.length === 0) return

    const actualCount = this.pendingPlayers.length

    // 역할 수가 실제 인원과 다르면 자동 재선택
    if (this.pendingRoleIds.length !== actualCount) {
      this.pendingRoleIds = this._autoRoles(actualCount)
    }

    this._startGameWithCountdown()
  }

  _startGameWithCountdown() {
    if (this._gameStarting) return
    this._gameStarting = true

    const names   = this.pendingPlayers.map(p => p.name)
    const peerIds = this.pendingPlayers.map(p => p.peerId)

    engine.reset()
    engine.initGame(names, this.pendingRoleIds)

    engine.state.players.forEach((p, idx) => {
      if (peerIds[idx]) p.peerId = peerIds[idx]
    })

    // 역할 개별 전송
    engine.state.players.forEach(p => {
      if (p.peerId) {
        this.p2p.sendToPeer(p.peerId, 'ROLE_ASSIGN', {
          playerId: p.id,
          role:     p.role,
          team:     p.team,
        })
      }
    })

    const playerList = engine.state.players.map(p => ({ id: p.id, name: p.name }))

    this.p2p.broadcast('COUNTDOWN', {
      seconds: COUNTDOWN_SECONDS,
      players: playerList,
    })

    if (this.lobbyBanner) {
      this.lobbyBanner.startCountdown(COUNTDOWN_SECONDS, () => {
        this._dismissLobbyBanner()
        engine.startNight()
        // 탭을 'role'로 유지
        this.currentTab = 'role'
        this.tabBar.querySelectorAll('.tab-item').forEach(btn => {
          btn.classList.toggle('active', btn.dataset.tab === 'role')
        })
        this._showGrimoire()
      })
    }

    setTimeout(() => {
      this.p2p.broadcast('GAME_START', {
        players: playerList,
        script:  'trouble-brewing',
      })
    }, COUNTDOWN_SECONDS * 1000)
  }

  _handleStartNight() {
    engine.startNight()
    this.doneSteps = []
    this._broadcastPhase()
    // 탭을 'role'로 유지
    this.currentTab = 'role'
    this.tabBar.querySelectorAll('.tab-item').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.tab === 'role')
    })
    this._showGrimoire()
  }

  _handleStartDay() {
    engine.startDay()
    this._broadcastPhase()
    const winCheck = engine.checkWinCondition()
    if (winCheck.gameOver) {
      this._showVictory(winCheck.winner, winCheck.reason)
      return
    }
    // 탭을 'role'로 유지
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
    // 탭을 'role'로 유지
    this.currentTab = 'role'
    this.tabBar.querySelectorAll('.tab-item').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.tab === 'role')
    })
    this.p2p.broadcast('GAME_END', {
      winner,
      reason,
      roles: engine.state.players.map(p => ({ id: p.id, role: p.role })),
    })
    const victory = new Victory({
      engine,
      winner,
      reason,
      onNewGame: () => {
        engine.reset()
        this.pendingPlayers = []
        this._gameStarting  = false
        this.init()
      },
    })
    victory.mount(this.container)
    this.currentScreen = victory
  }

  _handlePlayerAction(action, actorId) {}

  // ─────────────────────────────────────
  // P2P 핸들러
  // ─────────────────────────────────────

  _setupP2PHandlers() {
    this.p2p.onPeerJoined = (peerId) => {
      console.log('[Host] Peer joined:', peerId)
    }

    this.p2p.onPeerLeft = (peerId) => {
      // 게임 시작 전: 퇴장 처리
      if (!this._gameStarting) {
        this.pendingPlayers = this.pendingPlayers.filter(p => p.peerId !== peerId)
        const seatedList = this.pendingPlayers.map((p, i) => ({ name: p.name, seatNum: i + 1 }))
        if (this.lobbyBanner) {
          this.lobbyBanner.updateSeats(seatedList, this.pendingPlayerCount)
        }
        this.p2p.broadcast('SEAT_UPDATE', {
          seated: seatedList,
          total:  this.pendingPlayerCount,
        })
        // Grimoire 참가자 목록 갱신
        this._grimoire?.refresh()
      }
    }

    this.p2p.on('JOIN_REQUEST', (data, peerId) => {
      if (this._gameStarting) return
      if (this.pendingPlayers.find(p => p.peerId === peerId)) return

      const name = data.playerName || `플레이어${this.pendingPlayers.length + 1}`
      this.pendingPlayers.push({ peerId, name })

      // JOIN_RESPONSE
      this.p2p.sendToPeer(peerId, 'JOIN_RESPONSE', {
        ok:         true,
        roomCode:   this.p2p.roomCode,
        playerName: name,
      })

      // 착석 현황 전체 브로드캐스트
      const seatedList = this.pendingPlayers.map((p, i) => ({ name: p.name, seatNum: i + 1 }))
      this.p2p.broadcast('SEAT_UPDATE', {
        seated: seatedList,
        total:  this.pendingPlayerCount,
      })

      // LobbyBanner + Grimoire 갱신
      if (this.lobbyBanner) {
        this.lobbyBanner.updateSeats(seatedList, this.pendingPlayerCount)
      }
      this._grimoire?.refresh()
    })

    this.p2p.on('EMOJI', (data) => {
      const { targetId } = data
      if (targetId === 'all') {
        this.p2p.broadcast('EMOJI', data)
      } else {
        const target = engine.getPlayer(targetId)
        if (target?.peerId) this.p2p.sendToPeer(target.peerId, 'EMOJI', data)
      }
    })
  }

  _broadcastPhase() {
    this.p2p.broadcast('PHASE_CHANGE', {
      phase: engine.state.phase,
      round: engine.state.round,
    })
  }

  _broadcastDeaths(deathIds) {
    deathIds.forEach(id => {
      this.p2p.broadcast('PLAYER_DIED', { playerId: id, cause: 'night' })
    })
  }
}
