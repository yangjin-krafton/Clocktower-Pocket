/**
 * 참가자 앱 — 진입점
 * 탭 라우팅 + P2P 연결 관리
 *
 * 흐름:
 *   Join → 방 접속 → 즉시 게임 탭 화면 진입 (매칭은 백그라운드)
 *       → ROLE_ASSIGN 수신: 역할 카드 업데이트
 *       → COUNTDOWN 수신: 카운트다운 오버레이
 *       → GAME_START 수신: 플레이어 목록 갱신
 */
import { P2PManager }       from '../p2p.js'
import { Join }             from './Join.js'
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
    this.currentTab   = 'role'
    this.screens      = {}
    this.seatInfo     = null // { seated: number, total: number }

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

  /** 방 접속 즉시 게임 탭 화면 진입 */
  _showGame() {
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

    this.tabBar.querySelectorAll('.tab-item').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.tab === tabId)
    })

    let screen
    switch (tabId) {
      case 'role':
        screen = new RoleCardScreen({
          roleId:   this.myRole,
          team:     this.myTeam,
          seatInfo: this.seatInfo,
        })
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
    this.p2p.broadcast('EMOJI', { fromId: this.myPlayerId, targetId, emoji })
  }

  // ─────────────────────────────────────
  // 카운트다운 오버레이
  // ─────────────────────────────────────

  _showCountdown(seconds) {
    document.getElementById('player-countdown')?.remove()

    const overlay = document.createElement('div')
    overlay.id = 'player-countdown'
    overlay.className = 'player-countdown'
    overlay.innerHTML = `
      <div class="player-countdown__box">
        <div class="player-countdown__num">${seconds}</div>
        <div class="player-countdown__label">초 후 게임 시작</div>
      </div>
    `
    document.body.appendChild(overlay)

    let remaining = seconds
    const timer = setInterval(() => {
      remaining--
      if (remaining <= 0) {
        clearInterval(timer)
        overlay.remove()
      } else {
        overlay.querySelector('.player-countdown__num').textContent = remaining
      }
    }, 1000)
  }

  // ─────────────────────────────────────
  // P2P 핸들러
  // ─────────────────────────────────────

  _setupP2PHandlers() {
    // 방 접속 즉시 게임 화면 진입
    this.p2p.onRoomJoined = () => {
      this._showGame()
    }

    this.p2p.onPeerJoined = (peerId) => {
      console.log('[Player] Peer joined:', peerId)
    }

    this.p2p.on('JOIN_RESPONSE', (data) => {
      if (data.ok) {
        this._playerName = data.playerName || this._playerName
      }
    })

    // 착석 현황 업데이트 (역할 탭 대기 화면 갱신)
    this.p2p.on('SEAT_UPDATE', (data) => {
      this.seatInfo = { seated: data.seated?.length ?? 0, total: data.total }
      if (this.currentTab === 'role' && !this.myRole) {
        this._switchTab('role')
      }
    })

    // 역할 배정
    this.p2p.on('ROLE_ASSIGN', (data) => {
      this.myPlayerId = data.playerId
      this.myRole     = data.role
      this.myTeam     = data.team
      // 역할 탭이 열려 있으면 즉시 갱신
      if (this.currentTab === 'role') {
        this._switchTab('role')
      }
    })

    // 카운트다운 — 플레이어 목록도 미리 수신
    this.p2p.on('COUNTDOWN', (data) => {
      if (data.players) this.players = data.players
      this._showCountdown(data.seconds || 5)
      // 역할 탭 갱신 (역할이 이미 배정됐을 경우)
      if (this.currentTab === 'role') {
        this._switchTab('role')
      }
    })

    // 게임 시작 — 플레이어 목록 최종 갱신
    this.p2p.on('GAME_START', (data) => {
      this.players     = data.players || []
      this.scriptRoles = null
      // 이미 화면에 있으므로 현재 탭만 갱신
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
