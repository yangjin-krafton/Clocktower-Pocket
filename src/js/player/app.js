/**
 * 참가자 앱 — 진입점
 *
 * 흐름:
 *   Join → 방 접속 → 즉시 게임 탭 전체 진입
 *                   + LobbyBanner 상단 고정 (착석 현황)
 *        → SEAT_UPDATE: LobbyBanner.updateSeats()
 *        → ROLE_ASSIGN: 역할 탭 갱신
 *        → COUNTDOWN:   LobbyBanner.startCountdown()
 *        → GAME_START:  LobbyBanner.dismiss(), 플레이어 목록 확정
 */
import { P2PManager }     from '../p2p.js'
import { LobbyBanner }    from '../components/LobbyBanner.js'
import { Join }           from './Join.js'
import { Waiting }        from './Waiting.js'
import { RoleCardScreen } from './RoleCardScreen.js'
import { PlayerTracker }  from './PlayerTracker.js'
import { EmojiPanel }     from './EmojiPanel.js'
import { Memo }           from './Memo.js'
import { CharacterDict }  from './CharacterDict.js'
import { RulesScreen }    from '../components/RulesScreen.js'

export class PlayerApp {
  constructor() {
    this.p2p         = new P2PManager()
    this.myPlayerId  = null
    this.myRole      = null
    this.myTeam      = null
    this.players     = []
    this.gameState   = null
    this.scriptRoles = null
    this.currentTab  = 'role'
    this.screens     = {}
    this.pendingRulesPage = null  // 규칙 탭으로 전환 시 표시할 초기 페이지

    this.content    = document.getElementById('app-content')
    this.tabBar     = document.getElementById('tab-bar')
    this.bannerSlot = document.getElementById('lobby-banner')

    this.lobbyBanner  = null
    this.waitingScreen = null
  }

  init() {
    this._setupP2PHandlers()
    // 탭바가 이미 표시되어 있으므로 참가자용 탭으로 재구성
    this._buildTabs()
    this._switchTab('role')  // Join 화면 표시
  }

  // ─────────────────────────────────────
  // 화면 전환
  // ─────────────────────────────────────

  _showJoin() {
    this.content.innerHTML = ''
    this._dismissLobbyBanner()
    const screen = new Join({
      onJoin: (name, code) => this._handleJoin(name, code),
    })
    screen.mount(this.content)
  }

  async _handleJoin(name, code) {
    this._playerName = name
    this.content.innerHTML = `<div style="text-align:center;padding:60px 20px;color:var(--text3)">연결 중...</div>`
    try {
      await this.p2p.joinRoom(code, name)
    } catch (e) {
      alert('참가 실패: ' + e.message)
      this._switchTab('role')  // Join 화면으로 돌아감
    }
  }

  /** 방 접속 즉시 탭 + LobbyBanner + 회전판 대기화면 */
  _showGame(roomCode) {
    const code = roomCode || this.p2p.roomCode || '------'
    this._mountLobbyBanner(code)
    this._buildTabs()

    // 역할 없는 상태 → 회전판 대기화면
    this._showWaiting(code)
  }

  _showWaiting(roomCode) {
    this.content.innerHTML = ''
    const code = roomCode || this.p2p.roomCode || '------'
    this.waitingScreen = new Waiting({ roomCode: code, playerName: this._playerName || '' })
    this.waitingScreen.mount(this.content)
    this.currentTab = 'role'
    this.tabBar.querySelectorAll('.tab-item').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.tab === 'role')
    })
  }

  _mountLobbyBanner(roomCode) {
    this._dismissLobbyBanner()
    this.lobbyBanner = new LobbyBanner({ roomCode, total: 1 })
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
      { id: 'role',    icon: '🎭', label: '내 역할' },
      { id: 'tracker', icon: '👥', label: '플레이어' },
      { id: 'emoji',   icon: '💬', label: '시그널' },
      { id: 'memo',    icon: '📝', label: '메모' },
      { id: 'dict',    icon: '📖', label: '사전' },
      { id: 'rules',   icon: '📜', label: '규칙' },
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

  navigateToRoleDetail(roleId) {
    this.pendingRulesPage = `${roleId}.md`
    this._switchTab('rules')
  }

  _switchTab(tabId) {
    this.currentTab = tabId
    this.content.innerHTML = ''
    this.tabBar.querySelectorAll('.tab-item').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.tab === tabId)
    })

    // 게임 참가 전에는 role과 rules만 접근 가능
    if (!this.myPlayerId && tabId !== 'role' && tabId !== 'rules' && tabId !== 'dict') {
      this.content.innerHTML = `
        <div style="text-align:center;padding:60px 20px;color:var(--text3)">
          <div style="font-size:2rem;margin-bottom:12px">🔒</div>
          <div>게임 참가 후 이용 가능합니다</div>
        </div>
      `
      return
    }

    let screen
    switch (tabId) {
      case 'role':
        // 역할이 없으면 Join 화면 표시
        if (!this.myRole) {
          this._showJoin()
          return
        }
        screen = new RoleCardScreen({ roleId: this.myRole, team: this.myTeam })
        break
      case 'tracker':
        screen = new PlayerTracker({ players: this.players, gameState: this.gameState })
        this.screens.tracker = screen
        break
      case 'emoji':
        screen = new EmojiPanel({
          players:    this.players,
          myPlayerId: this.myPlayerId,
          onSend:     (targetId, emoji) => this._sendEmoji(targetId, emoji),
        })
        this.screens.emoji = screen
        break
      case 'memo':
        screen = new Memo()
        break
      case 'dict':
        screen = new CharacterDict({
          scriptRoles: this.scriptRoles,
          onRoleClick: (roleId) => this.navigateToRoleDetail(roleId)
        })
        break
      case 'rules':
        const initialPage = this.pendingRulesPage || 'index.md'
        this.pendingRulesPage = null  // 초기화
        screen = new RulesScreen({ initialPage })
        break
    }
    if (screen) screen.mount(this.content)
  }

  _sendEmoji(targetId, emoji) {
    this.p2p.broadcast('EMOJI', { fromId: this.myPlayerId, targetId, emoji })
  }

  // ─────────────────────────────────────
  // P2P 핸들러
  // ─────────────────────────────────────

  _setupP2PHandlers() {
    // 방 접속 즉시 게임 탭 + LobbyBanner
    this.p2p.onRoomJoined = (roomCode) => {
      this._showGame(roomCode)
    }

    this.p2p.onPeerJoined = (peerId) => {
      console.log('[Player] Peer joined:', peerId)
    }

    this.p2p.on('JOIN_RESPONSE', (data) => {
      if (data.ok) {
        this._playerName = data.playerName || this._playerName
        // 방 코드 확인 후 배너 업데이트 (혹시 roomCode 가 달라진 경우)
      }
    })

    // 착석 현황 갱신 → LobbyBanner + 회전판
    this.p2p.on('SEAT_UPDATE', (data) => {
      if (this.lobbyBanner) {
        this.lobbyBanner.updateSeats(data.seated || [], data.total)
      }
      if (this.waitingScreen) {
        this.waitingScreen.updateSeats(data.seated || [], data.total)
      }
    })

    // 역할 배정
    this.p2p.on('ROLE_ASSIGN', (data) => {
      this.myPlayerId    = data.playerId
      this.myRole        = data.role
      this.myTeam        = data.team
      this.waitingScreen = null
      if (this.currentTab === 'role') {
        this._switchTab('role')
      }
    })

    // 카운트다운 → LobbyBanner에 표시
    this.p2p.on('COUNTDOWN', (data) => {
      if (data.players) this.players = data.players
      if (this.lobbyBanner) {
        this.lobbyBanner.startCountdown(data.seconds || 5)
      }
      // 역할 탭이 열려 있으면 역할 카드 갱신 (ROLE_ASSIGN 이미 수신 후)
      if (this.currentTab === 'role') {
        this._switchTab('role')
      }
    })

    // 게임 시작 → LobbyBanner 제거 + 플레이어 목록 확정
    this.p2p.on('GAME_START', (data) => {
      this.players     = data.players || []
      this.scriptRoles = null
      this._dismissLobbyBanner()
      this._switchTab(this.currentTab)
    })

    this.p2p.on('PHASE_CHANGE', (data) => {
      this.gameState = { ...this.gameState, ...data }
      if (this.screens.tracker) {
        this.screens.tracker.updateGameState(this.gameState)
      }
    })

    this.p2p.on('PLAYER_DIED', (data) => {
      const player = this.players.find(p => p.id === data.playerId)
      if (player) player.status = 'dead'
      if (this.screens.tracker) this.screens.tracker.updatePlayers(this.players)
      if (this.screens.emoji)   this.screens.emoji.updatePlayers(this.players)
    })

    this.p2p.on('EMOJI', (data) => {
      const fromPlayer = this.players.find(p => p.id === data.fromId)
      const fromName   = fromPlayer ? fromPlayer.name : '누군가'
      if (data.targetId === 'all' || data.targetId === this.myPlayerId) {
        if (this.screens.emoji) {
          this.screens.emoji.receiveEmoji(fromName, data.emoji)
        } else {
          import('../components/EmojiPopup.js').then(m => {
            m.showEmojiPopup({ fromName, emoji: data.emoji })
          })
        }
      }
    })

    this.p2p.on('GAME_END', (data) => {
      this._showGameEnd(data.winner, data.reason)
    })
  }

  _showGameEnd(winner, reason) {
    this._dismissLobbyBanner()
    this.currentTab = 'role'
    this.tabBar.querySelectorAll('.tab-item').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.tab === 'role')
    })
    this.content.innerHTML = ''

    const el = document.createElement('div')
    el.style.cssText = 'text-align:center;padding:60px 20px;'
    const isGood = winner === 'good'
    el.innerHTML = `
      <div style="font-size:3rem">${isGood ? '🏆' : '💀'}</div>
      <div style="font-family:'Noto Serif KR',serif;font-size:1.5rem;font-weight:700;
        color:${isGood ? 'var(--tl-light)' : 'var(--rd-light)'};margin-top:12px">
        ${isGood ? '선 팀 승리!' : '악 팀 승리!'}
      </div>
      <div style="font-size:0.82rem;color:var(--text3);margin-top:8px">호스트 화면을 참고하세요</div>
    `
    this.content.appendChild(el)
  }
}
