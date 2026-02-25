/**
 * 개발용 콘솔 명령어
 * P2P 없이 혼자 호스트 또는 참가자 모드를 즉시 시작할 수 있습니다.
 *
 * 사용법 (브라우저 콘솔):
 *   dev.host()                          → 기본 5인 게임으로 호스트 시작
 *   dev.host(['앨리스','밥','찰리'])     → 이름 지정
 *   dev.host(['앨리스','밥'], ['imp','fortuneteller'])  → 이름 + 역할 지정
 *
 *   dev.player()                        → imp 역할로 참가자 시작
 *   dev.player('fortuneteller')         → 특정 역할로 참가자 시작
 *   dev.player('monk', '홍길동')        → 역할 + 내 이름 지정
 */

import { ROLES_TB, ROLES_BY_ID, PLAYER_COUNTS } from './data/roles-tb.js'

// ─── P2P Mock ────────────────────────────────────────────────────────────────

function createMockP2P() {
  return {
    roomCode: 'DEV000',
    isHost: false,
    peers: new Map(),
    messageHandlers: new Map(),
    onPeerJoined: null,
    onPeerLeft: null,
    onRoomCreated: null,
    onRoomJoined: null,
    onConnectionError: null,

    async createRoom(code) {
      this.roomCode = code || 'DEV000'
      this.isHost = true
      console.log('[DEV P2P] createRoom:', this.roomCode)
    },
    async joinRoom(code, name) {
      this.roomCode = code
      console.log('[DEV P2P] joinRoom:', code, name)
    },
    broadcast(type, data) {
      console.log('[DEV P2P] broadcast:', type, data)
    },
    sendToPeer(peerId, type, data) {
      console.log('[DEV P2P] sendToPeer:', peerId, type, data)
    },
    on(type, handler) {
      this.messageHandlers.set(type, handler)
    },
  }
}

// ─── 역할 유틸 ────────────────────────────────────────────────────────────────

function getTeam(roleId) {
  const role = ROLES_BY_ID[roleId]
  if (!role) return 'good'
  return (role.team === 'townsfolk' || role.team === 'outsider') ? 'good' : 'evil'
}

function pickDefaultRoles(n) {
  // 인원 수에 맞는 기본 TB 역할 선택 (앞에서부터)
  const counts = PLAYER_COUNTS[n]
  if (!counts) throw new Error(`지원하지 않는 인원: ${n}`)

  const townsfolk = ROLES_TB.filter(r => r.team === 'townsfolk')
  const outsiders  = ROLES_TB.filter(r => r.team === 'outsider')
  const minions    = ROLES_TB.filter(r => r.team === 'minion')
  const demons     = ROLES_TB.filter(r => r.team === 'demon')

  return [
    ...townsfolk.slice(0, counts.townsfolk),
    ...outsiders.slice(0, counts.outsider),
    ...minions.slice(0, counts.minion),
    ...demons.slice(0, counts.demon),
  ].map(r => r.id)
}

// ─── dev.host ────────────────────────────────────────────────────────────────

async function devHost(
  playerNames = ['앨리스', '밥', '찰리', '다이애나', '이반'],
  roleIds = null
) {
  const badge = document.getElementById('app-badge')
  badge.textContent = '👑 호스트 [DEV]'
  badge.className = 'app-header__badge badge--host'
  badge.style.display = ''

  const { HostApp }  = await import('./host/app.js')
  const { engine }   = await import('./game-engine.js')

  const n = playerNames.length
  const selectedRoles = roleIds || pickDefaultRoles(n)

  // HostApp 생성 후 P2P를 mock으로 교체
  const app = new HostApp()
  Object.assign(app.p2p, createMockP2P())

  app._setupP2PHandlers()

  // Setup / Lobby 화면 건너뛰고 바로 게임 시작
  app.pendingPlayerCount = n
  app.pendingRoleIds     = selectedRoles

  engine.reset()
  engine.initGame(playerNames, selectedRoles)

  // peerId는 없으므로 null 유지 (P2P 전송 시 mock가 처리)
  engine.startNight()
  app._showGrimoire()

  console.groupCollapsed('[DEV] 호스트 모드 시작 ─ 플레이어 목록')
  engine.state.players.forEach(p => {
    const role = ROLES_BY_ID[p.role]
    console.log(`  ${p.id}. ${p.name}  →  ${role?.name || p.role} (${p.team})`)
  })
  console.groupEnd()
  console.log('[DEV] dev.host() 완료 — 그리모어 화면으로 이동했습니다.')
}

// ─── dev.player ──────────────────────────────────────────────────────────────

async function devPlayer(roleId = 'imp', myName = '나') {
  const badge = document.getElementById('app-badge')
  badge.textContent = '🎮 참가자 [DEV]'
  badge.className = 'app-header__badge badge--player'
  badge.style.display = ''

  const { PlayerApp } = await import('./player/app.js')

  const role = ROLES_BY_ID[roleId]
  if (!role) {
    console.warn('[DEV] 알 수 없는 역할:', roleId)
    console.warn('[DEV] 사용 가능한 역할:', ROLES_TB.map(r => r.id).join(', '))
    return
  }

  const app = new PlayerApp()
  Object.assign(app.p2p, createMockP2P())

  // 플레이어 정보 주입
  app._playerName  = myName
  app.myPlayerId   = 1
  app.myRole       = roleId
  app.myTeam       = getTeam(roleId)
  app.players      = [
    { id: 1, name: myName,      status: 'alive' },
    { id: 2, name: '플레이어2', status: 'alive' },
    { id: 3, name: '플레이어3', status: 'alive' },
    { id: 4, name: '플레이어4', status: 'alive' },
    { id: 5, name: '플레이어5', status: 'alive' },
  ]
  app.gameState    = { phase: 'night', round: 1 }
  app.scriptRoles  = null // 전체 TB 사전 표시

  app._showGame()

  console.log(`[DEV] 참가자 모드 시작 — 역할: ${role.name} (${app.myTeam})`)
  console.log('[DEV] dev.player() 완료 — 게임 화면으로 이동했습니다.')
}

// ─── 전역 등록 ────────────────────────────────────────────────────────────────

window.dev = {
  host: devHost,
  player: devPlayer,

  /** 사용 가능한 역할 목록 출력 */
  roles() {
    console.group('[DEV] Trouble Brewing 역할 목록')
    const groups = { townsfolk: '마을 주민', outsider: '아웃사이더', minion: '미니언', demon: '데몬' }
    for (const [team, label] of Object.entries(groups)) {
      const list = ROLES_TB.filter(r => r.team === team)
      console.log(`[${label}]`, list.map(r => `${r.id}(${r.name})`).join(', '))
    }
    console.groupEnd()
  },
}

console.log(
  '%c[DEV] 개발 콘솔 활성화',
  'background:#2a1a0e;color:#d4a828;font-weight:bold;padding:2px 6px;border-radius:3px'
)
console.log('[DEV] dev.host()           → 호스트(스토리텔러) 모드 즉시 시작')
console.log('[DEV] dev.player()         → 참가자 모드 즉시 시작 (기본: imp)')
console.log('[DEV] dev.player("monk")   → 특정 역할로 참가자 시작')
console.log('[DEV] dev.roles()          → 사용 가능한 역할 목록')
