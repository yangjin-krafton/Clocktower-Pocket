/**
 * 호스트 앱 — 진입점
 *
 * 흐름:
 *   Setup → 방 생성 → 즉시 Grimoire (phase: lobby)
 *                        + LobbyBanner 상단 고정
 *         → 플레이어 착석 (백그라운드 JOIN_REQUEST)
 *         → 전원 착석 → 역할 배정 → LobbyBanner 카운트다운
 *         → 카운트다운 완료 → Grimoire (phase: night) + LobbyBanner dismiss
 */
import { P2PManager }    from '../p2p.js'
import { engine }        from '../game-engine.js'
import { LobbyBanner }   from '../components/LobbyBanner.js'
import { Setup }         from './Setup.js'
import { Grimoire }      from './Grimoire.js'
import { NightAction }   from './NightAction.js'
import { DayFlow }       from './DayFlow.js'
import { Victory }       from './Victory.js'

const COUNTDOWN_SECONDS = 5

export class HostApp {
  constructor() {
    this.p2p            = new P2PManager()
    this.currentScreen  = null
    this.nightAction    = null
    this.doneSteps      = []
    this.container      = document.getElementById('app-content')
    this.bannerSlot     = document.getElementById('lobby-banner')

    // 매칭 상태
    this.pendingPlayers     = []  // { peerId, name }
    this.pendingPlayerCount = 0
    this.pendingRoleIds     = []
    this._gameStarting      = false

    // LobbyBanner 인스턴스 (lobby phase 동안만 활성)
    this.lobbyBanner = null
  }

  async init() {
    this._setupP2PHandlers()
    this._showSetup()
  }

  // ─────────────────────────────────────
  // 화면 전환
  // ─────────────────────────────────────

  _clearScreen() {
    this.currentScreen?.unmount()
    this.currentScreen = null
    this.container.innerHTML = ''
  }

  _showSetup() {
    this._clearScreen()
    this._dismissLobbyBanner()
    const screen = new Setup({
      onCreateRoom: (playerCount, roleIds) => this._handleCreateRoom(playerCount, roleIds),
    })
    screen.mount(this.container)
    this.currentScreen = screen
  }

  async _handleCreateRoom(playerCount, roleIds) {
    const roomCode = P2PManager.generateRoomCode()
    try {
      await this.p2p.createRoom(roomCode)
      this.pendingPlayerCount = playerCount
      this.pendingRoleIds     = roleIds
      this.pendingPlayers     = []
      this._gameStarting      = false

      // ① LobbyBanner 상단에 마운트
      this._mountLobbyBanner(roomCode, playerCount)

      // ② 즉시 Grimoire 진입 (engine 은 lobby phase 상태)
      this._showGrimoire()
    } catch (e) {
      alert('방 생성 실패: ' + e.message)
    }
  }

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
  // 게임 시작 (전원 착석 후 자동 호출)
  // ─────────────────────────────────────

  _startGameWithCountdown() {
    if (this._gameStarting) return
    this._gameStarting = true

    const names   = this.pendingPlayers.map(p => p.name)
    const peerIds = this.pendingPlayers.map(p => p.peerId)

    // 엔진 초기화 + 역할 배정
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

    // 카운트다운 브로드캐스트 (플레이어 목록 포함)
    this.p2p.broadcast('COUNTDOWN', {
      seconds: COUNTDOWN_SECONDS,
      players: playerList,
    })

    // LobbyBanner 카운트다운 표시
    if (this.lobbyBanner) {
      this.lobbyBanner.startCountdown(COUNTDOWN_SECONDS, () => {
        // 카운트다운 완료 → 인게임 전환
        this._dismissLobbyBanner()
        engine.startNight()
        this._showGrimoire()
      })
    }

    // 카운트다운 후 GAME_START 브로드캐스트
    setTimeout(() => {
      this.p2p.broadcast('GAME_START', {
        players: playerList,
        script:  'trouble-brewing',
      })
    }, COUNTDOWN_SECONDS * 1000)
  }

  // ─────────────────────────────────────
  // Grimoire
  // ─────────────────────────────────────

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
        this._showSetup()
      },
    })
    victory.mount(this.container)
    this.currentScreen = victory
  }

  _handlePlayerAction(action, actorId) {
    // DayFlow에서 처리
  }

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

      // JOIN_RESPONSE
      this.p2p.sendToPeer(peerId, 'JOIN_RESPONSE', {
        ok: true,
        roomCode:   this.p2p.roomCode,
        playerName: name,
      })

      // 전원 착석 현황 브로드캐스트
      const seatedList = this.pendingPlayers.map((p, i) => ({ name: p.name, seatNum: i + 1 }))
      this.p2p.broadcast('SEAT_UPDATE', {
        seated: seatedList,
        total:  this.pendingPlayerCount,
      })

      // LobbyBanner 갱신
      if (this.lobbyBanner) {
        this.lobbyBanner.updateSeats(seatedList, this.pendingPlayerCount)
      }

      // 전원 착석 → 게임 시작
      if (this.pendingPlayers.length >= this.pendingPlayerCount) {
        this._startGameWithCountdown()
      }
    })

    this.p2p.on('EMOJI', (data) => {
      const { targetId, emoji, fromId } = data
      if (targetId === 'all') {
        this.p2p.broadcast('EMOJI', data)
      } else {
        const targetPlayer = engine.getPlayer(targetId)
        if (targetPlayer?.peerId) {
          this.p2p.sendToPeer(targetPlayer.peerId, 'EMOJI', data)
        }
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
