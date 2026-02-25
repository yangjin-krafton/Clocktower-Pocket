/**
 * 참가자 앱 — 진입점
 * 탭 라우팅 + P2P 연결 관리
 */
import { P2PManager }       from '../p2p.js'
import { Join }             from './Join.js'
import { Waiting }          from './Waiting.js'
import { RoleCardScreen }   from './RoleCardScreen.js'
import { PlayerTracker }    from './PlayerTracker.js'
import { EmojiPanel }       from './EmojiPanel.js'
import { Memo }             from './Memo.js'
import { CharacterDict }    from './CharacterDict.js'

export class PlayerApp {
  constructor() {
    this.p2p          = new P2PManager()
    this.myPlayerId   = null
    this.myRole       = null
    this.myTeam       = null
    this.players      = []
    this.gameState    = null
    this.scriptRoles  = null
    this.gameStarted  = false
    this.currentTab   = 'role'
    this.screens      = {}

    this.content   = document.getElementById('app-content')
    this.tabBar    = document.getElementById('tab-bar')
  }

  init() {
    this._setupP2PHandlers()
    this._showJoin()
  }

  // ─────────────────────────────────────
  // 화면 전환
  // ─────────────────────────────────────

  _showJoin() {
    this.content.innerHTML = ''
    this.tabBar.style.display = 'none'
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
      this._showJoin()
    }
  }

  _showWaiting() {
    this.content.innerHTML = ''
    this.tabBar.style.display = 'none'
    const waiting = new Waiting({
      roomCode:   this.p2p.roomCode,
      playerName: this._playerName,
    })
    waiting.mount(this.content)
    this.screens.waiting = waiting
  }

  _showGame() {
    this.gameStarted = true
    this.tabBar.style.display = 'flex'
    this._buildTabs()
    this._switchTab('role')
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
    this.content.innerHTML = ''

    // 탭 활성 상태 업데이트
    this.tabBar.querySelectorAll('.tab-item').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.tab === tabId)
    })

    let screen
    switch (tabId) {
      case 'role':
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
        screen = new CharacterDict({ scriptRoles: this.scriptRoles })
        break
    }

    if (screen) screen.mount(this.content)
  }

  _sendEmoji(targetId, emoji) {
    const fromId = this.myPlayerId
    this.p2p.broadcast('EMOJI', { fromId, targetId, emoji })
  }

  // ─────────────────────────────────────
  // P2P 핸들러
  // ─────────────────────────────────────

  _setupP2PHandlers() {
    this.p2p.onRoomJoined = () => {
      this._showWaiting()
    }

    this.p2p.onPeerJoined = (peerId) => {
      console.log('[Player] Peer joined:', peerId)
      if (this.screens.waiting) {
        this.screens.waiting.setPlayerCount(this.p2p.peers.size + 1)
      }
    }

    this.p2p.on('JOIN_RESPONSE', (data) => {
      if (data.ok) {
        this._playerName = data.playerName || this._playerName
      }
    })

    this.p2p.on('ROLE_ASSIGN', (data) => {
      this.myPlayerId = data.playerId
      this.myRole     = data.role
      this.myTeam     = data.team
    })

    this.p2p.on('GAME_START', (data) => {
      this.players     = data.players || []
      this.scriptRoles = null // 전체 TB 사전 표시
      this._showGame()
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
      if (this.screens.tracker) {
        this.screens.tracker.updatePlayers(this.players)
      }
      if (this.screens.emoji) {
        this.screens.emoji.updatePlayers(this.players)
      }
    })

    this.p2p.on('EMOJI', (data) => {
      const fromPlayer = this.players.find(p => p.id === data.fromId)
      const fromName   = fromPlayer ? fromPlayer.name : '누군가'
      // 내 플레이어 ID가 수신자이거나 전체 브로드캐스트면 팝업 표시
      if (data.targetId === 'all' || data.targetId === this.myPlayerId) {
        if (this.screens.emoji) {
          this.screens.emoji.receiveEmoji(fromName, data.emoji)
        } else {
          // 다른 탭에 있어도 팝업 표시
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
    this.tabBar.style.display = 'none'
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

