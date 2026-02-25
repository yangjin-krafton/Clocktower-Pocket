/**
 * 호스트 앱 — 진입점
 *
 * 흐름:
 *   진입 → 즉시 방 자동 생성 → Grimoire (lobby phase) + LobbyBanner
 *          → Setup 팝업(게임화면 위에 오버레이)으로 인원·역할 설정
 *          → 설정 확인 → LobbyBanner 인원 수 확정
 *          → 플레이어 착석 (백그라운드)
 *          → 전원 착석 → 역할 배정 → 카운트다운 → Grimoire (night)
 */
import { P2PManager }    from '../p2p.js'
import { engine }        from '../game-engine.js'
import { LobbyBanner }   from '../components/LobbyBanner.js'
import { Setup }         from './Setup.js'
import { Grimoire }      from './Grimoire.js'
import { NightAction }   from './NightAction.js'
import { DayFlow }       from './DayFlow.js'
import { Victory }       from './Victory.js'
import { ROLES_TB, PLAYER_COUNTS } from '../data/roles-tb.js'

const COUNTDOWN_SECONDS  = 5
const DEFAULT_PLAYER_COUNT = 7

export class HostApp {
  constructor() {
    this.p2p            = new P2PManager()
    this.currentScreen  = null
    this.nightAction    = null
    this.doneSteps      = []
    this.container      = document.getElementById('app-content')
    this.bannerSlot     = document.getElementById('lobby-banner')

    this.pendingPlayers     = []
    this.pendingPlayerCount = DEFAULT_PLAYER_COUNT
    this.pendingRoleIds     = []
    this._gameStarting      = false
    this.lobbyBanner        = null
  }

  async init() {
    this._setupP2PHandlers()

    // 연결 중 표시
    this.container.innerHTML = `
      <div style="text-align:center;padding:60px 20px;color:var(--text3)">
        <div style="font-size:2rem;margin-bottom:10px">🏰</div>
        <div>방 생성 중...</div>
      </div>
    `

    const roomCode = P2PManager.generateRoomCode()
    try {
      await this.p2p.createRoom(roomCode)

      // 기본 역할 자동 선택
      this.pendingPlayerCount = DEFAULT_PLAYER_COUNT
      this.pendingRoleIds     = this._autoRoles(DEFAULT_PLAYER_COUNT)

      // ① LobbyBanner 상단 마운트
      this._mountLobbyBanner(roomCode, DEFAULT_PLAYER_COUNT)

      // ② 즉시 Grimoire 진입 (lobby phase)
      this._showGrimoire()

      // ③ 설정 팝업 (게임화면 위 오버레이) — 닫아도 기본값으로 진행됨
      this._showSetupPopup()

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
    const pick = (team, count) =>
      ROLES_TB.filter(r => r.team === team)
               .sort(() => Math.random() - 0.5)
               .slice(0, count)
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
    const overlay = document.createElement('div')
    overlay.className = 'popup-overlay'
    overlay.id = 'setup-popup'

    const box = document.createElement('div')
    box.className  = 'popup-box'
    box.style.cssText = 'max-height:80vh;overflow-y:auto;padding:16px;'

    const header = document.createElement('div')
    header.style.cssText = 'font-family:"Noto Serif KR",serif;font-size:0.95rem;font-weight:700;color:var(--gold2);margin-bottom:12px;'
    header.textContent = '⚙️ 게임 설정'
    box.appendChild(header)

    const setup = new Setup({
      onCreateRoom: (playerCount, roleIds) => {
        this.pendingPlayerCount = playerCount
        this.pendingRoleIds     = roleIds
        if (this.lobbyBanner) this.lobbyBanner.updateTotal(playerCount)
        overlay.remove()
        // 이미 착석 인원이 목표치에 도달했으면 바로 시작
        if (this.pendingPlayers.length >= this.pendingPlayerCount && !this._gameStarting) {
          this._startGameWithCountdown()
        }
      },
    })

    // Setup 버튼 텍스트를 "설정 완료"로 변경
    setup._originalRender = setup._render.bind(setup)
    setup._render = function() {
      this._originalRender()
      const btn = this.el?.querySelector('.btn-gold')
      if (btn) btn.textContent = '✓ 설정 완료'
    }

    setup.mount(box)

    // 배경 클릭 시 기본값으로 닫기
    overlay.addEventListener('click', e => {
      if (e.target === overlay) overlay.remove()
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
  // 화면 전환
  // ─────────────────────────────────────

  _clearScreen() {
    this.currentScreen?.unmount()
    this.currentScreen = null
    this.container.innerHTML = ''
  }

  _showGrimoire() {
    this._clearScreen()
    this.doneSteps = []
    const grimoire = new Grimoire({
      engine,
      onStartNight:    () => this._handleStartNight(),
      onStartDay:      () => this._handleStartDay(),
      onNextNightStep: () => this._handleNextNightStep(),
      onPlayerAction:  (action, id) => this._handlePlayerAction(action, id),
    })
    grimoire.mount(this.container)
    this.currentScreen = grimoire

    engine.on('stateChanged',  () => grimoire.refresh())
    engine.on('nightResolved', ({ deaths }) => this._broadcastDeaths(deaths))
  }

  // ─────────────────────────────────────
  // 게임 시작 (전원 착석 후 자동 호출)
  // ─────────────────────────────────────

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
        // 새 게임: 다시 init 흐름으로
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
      if (!this._gameStarting) {
        this.pendingPlayers = this.pendingPlayers.filter(p => p.peerId !== peerId)
        if (this.lobbyBanner) {
          this.lobbyBanner.updateSeats(
            this.pendingPlayers.map((p, i) => ({ name: p.name, seatNum: i + 1 })),
            this.pendingPlayerCount,
          )
        }
      }
    }

    this.p2p.on('JOIN_REQUEST', (data, peerId) => {
      if (this._gameStarting) return
      if (this.pendingPlayers.find(p => p.peerId === peerId)) return

      const name = data.playerName || `플레이어${this.pendingPlayers.length + 1}`
      this.pendingPlayers.push({ peerId, name })

      this.p2p.sendToPeer(peerId, 'JOIN_RESPONSE', {
        ok:         true,
        roomCode:   this.p2p.roomCode,
        playerName: name,
      })

      const seatedList = this.pendingPlayers.map((p, i) => ({ name: p.name, seatNum: i + 1 }))
      this.p2p.broadcast('SEAT_UPDATE', {
        seated: seatedList,
        total:  this.pendingPlayerCount,
      })

      if (this.lobbyBanner) {
        this.lobbyBanner.updateSeats(seatedList, this.pendingPlayerCount)
      }

      if (this.pendingPlayers.length >= this.pendingPlayerCount) {
        this._startGameWithCountdown()
      }
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
