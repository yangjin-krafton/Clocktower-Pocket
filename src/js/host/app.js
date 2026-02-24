/**
 * 호스트 앱 — 진입점
 * 화면 라우팅 + P2P 연결 관리 + GameEngine 연동
 */
import { P2PManager } from '../p2p.js'
import { engine } from '../game-engine.js'
import { Setup }    from './Setup.js'
import { Lobby }    from './Lobby.js'
import { Grimoire } from './Grimoire.js'
import { NightAction } from './NightAction.js'
import { DayFlow }  from './DayFlow.js'
import { Victory }  from './Victory.js'

class HostApp {
  constructor() {
    this.p2p = new P2PManager()
    this.currentScreen = null
    this.lobby = null
    this.nightAction = null
    this.doneSteps = []
    this.container = document.getElementById('app-content')
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
      this._showLobby(roomCode, playerCount, roleIds)
    } catch (e) {
      alert('방 생성 실패: ' + e.message)
    }
  }

  _showLobby(roomCode, playerCount, roleIds) {
    this._clearScreen()
    this.pendingPlayerCount = playerCount
    this.pendingRoleIds     = roleIds

    const lobby = new Lobby({
      roomCode,
      onStartGame: (names, peerIds) => this._handleStartGame(names, peerIds),
      onPlayerNameEdit: (peerId, name) => {
        const p = this.p2p.peers.get(peerId)
        if (p) p.name = name
      },
    })
    lobby.mount(this.container)
    this.lobby = lobby
    this.currentScreen = lobby
  }

  _handleStartGame(names, peerIds) {
    engine.reset()
    engine.initGame(names, this.pendingRoleIds)

    // 각 플레이어 peerId 연결
    engine.state.players.forEach((p, idx) => {
      if (peerIds[idx]) p.peerId = peerIds[idx]
    })

    // 역할 P2P 전송
    engine.state.players.forEach(p => {
      if (p.peerId) {
        this.p2p.sendToPeer(p.peerId, 'ROLE_ASSIGN', {
          playerId: p.id,
          role: p.role,
          team: p.team,
        })
      }
    })

    // GAME_START 브로드캐스트
    this.p2p.broadcast('GAME_START', {
      players: engine.state.players.map(p => ({ id: p.id, name: p.name })),
      script: 'trouble-brewing',
    })

    // 첫 밤 시작
    engine.startNight()
    this._showGrimoire()
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

    // 엔진 이벤트 구독
    engine.on('stateChanged', () => grimoire.refresh())
    engine.on('nightResolved', ({ deaths }) => {
      this._broadcastDeaths(deaths)
    })
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
      // 밤 순서 완료 → 낮으로
      this._handleStartDay()
      return
    }

    // NightAction 처리
    if (!this.nightAction) {
      this.nightAction = new NightAction({
        engine,
        onStepDone: (roleId, targetIds) => {
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

    // GAME_END 브로드캐스트
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
        this._showSetup()
      },
    })
    victory.mount(this.container)
    this.currentScreen = victory
  }

  _handlePlayerAction(action, actorId) {
    if (action === 'slayer') {
      // DayFlow에서 처리
    }
  }

  // ─────────────────────────────────────
  // P2P 핸들러
  // ─────────────────────────────────────

  _setupP2PHandlers() {
    this.p2p.onPeerJoined = (peerId) => {
      console.log('[Host] Peer joined:', peerId)
    }

    this.p2p.onPeerLeft = (peerId) => {
      if (this.lobby) this.lobby.removePlayer(peerId)
    }

    this.p2p.on('JOIN_REQUEST', (data, peerId) => {
      const name = data.playerName || `플레이어${this.p2p.peers.size}`
      if (this.lobby) this.lobby.addPlayer(peerId, name)

      this.p2p.sendToPeer(peerId, 'JOIN_RESPONSE', {
        ok: true,
        roomCode: this.p2p.roomCode,
        playerName: name,
      })
    })

    this.p2p.on('EMOJI', (data, fromPeerId) => {
      // 이모지 중계: 지정 수신자에게 전달
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

// 앱 초기화
const app = new HostApp()
app.init()
