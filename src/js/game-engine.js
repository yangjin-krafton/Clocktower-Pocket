/**
 * Clocktower Pocket — 게임 엔진
 * Trouble Brewing 규칙 구현
 */
import {
  ROLES_TB, ROLES_BY_ID, PLAYER_COUNTS, NIGHT_ORDER_FIRST, NIGHT_ORDER_OTHER
} from './data/roles-tb.js'

export class GameEngine {
  constructor() {
    this._listeners = {}
    this.reset()
  }

  reset() {
    /** @type {GameState} */
    this.state = {
      phase: 'lobby',
      round: 0,
      players: [],
      nominations: [],
      executedToday: null,
      nightOrder: [],
      currentNightStep: null,
    }
    this.logs = []
    this.nightActions = []  // { round, roleId, actorId, targetIds, infoSent }
    this.pendingDeaths = [] // 이번 밤 처리할 사망자 id 목록
    this.monkProtect = null // 이번 밤 수도사 보호 대상 id
    this.redHerring = null  // 점술사 레드 헤링 player.id
    this.virginTriggered = false
    this.slayerUsed = false
    this.butlerMasters = {} // { playerId: masterId }
    this.poisonedThisNight = null // 이번 밤 독살자 대상
  }

  // ─────────────────────────────────────
  // 게임 초기화
  // ─────────────────────────────────────

  /**
   * 게임 시작 — 역할 배정
   * @param {string[]} playerNames 좌석 순서 이름 목록
   * @param {string[]} selectedRoleIds 사용할 역할 id 목록
   */
  initGame(playerNames, selectedRoleIds) {
    const n = playerNames.length
    const counts = PLAYER_COUNTS[n]
    if (!counts) throw new Error(`지원하지 않는 인원: ${n}`)

    // 역할 셔플 배정
    const shuffled = [...selectedRoleIds].sort(() => Math.random() - 0.5)

    this.state.players = playerNames.map((name, i) => {
      const roleId = shuffled[i] || 'unknown'
      const role = ROLES_BY_ID[roleId]
      const team = role ? (role.team === 'townsfolk' || role.team === 'outsider' ? 'good' : 'evil') : 'good'
      return {
        id: i + 1,
        peerId: null,
        name,
        role: roleId,
        team,
        status: 'alive',
        isPoisoned: false,
        isDrunk: false,
        deadVoteUsed: false,
        registeredAs: null,
      }
    })

    // 점술사 레드 헤링 고정 선택 (선 플레이어 중 1명)
    const goodPlayers = this.state.players.filter(p => p.team === 'good')
    if (goodPlayers.length > 0) {
      this.redHerring = goodPlayers[Math.floor(Math.random() * goodPlayers.length)].id
    }

    // 술꾼: isDrunk = true 처리
    this.state.players.forEach(p => {
      if (p.role === 'drunk') p.isDrunk = true
    })

    this.state.phase = 'night'
    this.state.round = 0
    this._log('game', `게임 시작. ${n}인. 역할 배정 완료.`)
    this.emit('stateChanged', this.state)
  }

  /**
   * 자동 역할 구성 계산 (인원 수 → 역할 수)
   */
  getComposition(n, selectedRoles) {
    const counts = PLAYER_COUNTS[n]
    if (!counts) return null
    const hasBaron = selectedRoles.includes('baron')
    return {
      townsfolk: counts.townsfolk - (hasBaron ? 2 : 0),
      outsider: counts.outsider + (hasBaron ? 2 : 0),
      minion: counts.minion,
      demon: counts.demon,
    }
  }

  // ─────────────────────────────────────
  // 밤 순서 관리
  // ─────────────────────────────────────

  /**
   * 이번 밤 순서 생성 (존재하는 역할만 필터)
   */
  buildNightOrder() {
    const order = this.state.round === 0 ? NIGHT_ORDER_FIRST : NIGHT_ORDER_OTHER
    const activeRoleIds = new Set(
      this.state.players
        .filter(p => p.status === 'alive')
        .map(p => p.role)
    )

    return order.filter(roleId => {
      if (roleId === 'minion-info' || roleId === 'demon-info') {
        // 항상 첫밤에 포함
        return this.state.round === 0
      }
      if (roleId === 'ravenkeeper') {
        // 이번 밤 사망자 중 까마귀지기가 있을 때만
        return this.pendingDeaths.some(id => {
          const p = this.getPlayer(id)
          return p && p.role === 'ravenkeeper'
        })
      }
      if (roleId === 'undertaker') {
        // 전날 처형자가 있을 때만
        return this.state.executedToday !== null
      }
      return activeRoleIds.has(roleId)
    })
  }

  /**
   * 밤 시작
   */
  startNight() {
    this.state.round += 1
    this.state.phase = 'night'
    this.state.nominations = []
    this.state.executedToday = null
    this.monkProtect = null
    this.poisonedThisNight = null
    this.pendingDeaths = []

    // 이전 밤 독 초기화 (독살자 능력: 1밤만 지속)
    this.state.players.forEach(p => { p.isPoisoned = false })

    const order = this.buildNightOrder()
    this.state.nightOrder = order
    this.state.currentNightStep = order[0] || null

    this._log('night', `밤 ${this.state.round} 시작. 순서: ${order.join(', ')}`)
    this.emit('stateChanged', this.state)
  }

  /**
   * 현재 밤 단계 완료 → 다음 단계로
   */
  nextNightStep() {
    const idx = this.state.nightOrder.indexOf(this.state.currentNightStep)
    const next = this.state.nightOrder[idx + 1] || null
    this.state.currentNightStep = next

    if (next === null) {
      // 밤 종료 → 결과 처리
      this._resolveNight()
    }

    this.emit('stateChanged', this.state)
    return next
  }

  /**
   * 밤 결과 처리 (내부)
   */
  _resolveNight() {
    // 독살자 적용
    if (this.poisonedThisNight !== null) {
      const p = this.getPlayer(this.poisonedThisNight)
      if (p) p.isPoisoned = true
    }

    // 임프 킬 처리
    const impKillAction = this.nightActions
      .filter(a => a.round === this.state.round && a.roleId === 'imp')
      .pop()

    if (impKillAction && impKillAction.targetIds.length > 0) {
      const targetId = impKillAction.targetIds[0]
      const target = this.getPlayer(targetId)
      if (target && target.status === 'alive') {
        const impPlayer = this.getPlayer(impKillAction.actorId)

        if (targetId === impKillAction.actorId) {
          // Imp self-kill → 승계
          this._handleImpSelfKill(impKillAction.actorId)
        } else if (this.monkProtect === targetId) {
          // 수도사 보호
          this._log('night', `수도사가 ${target.name}을(를) 보호했습니다.`)
        } else if (target.role === 'soldier' && !target.isPoisoned) {
          // 병사 면역
          this._log('night', `병사 ${target.name}은(는) 데몬 공격에 면역입니다.`)
        } else if (target.role === 'mayor' && !target.isPoisoned) {
          // 시장 튕김 — 살아있는 다른 플레이어로 튕김
          this._handleMayorBounce(impKillAction.actorId, targetId)
        } else {
          this.pendingDeaths.push(targetId)
          this._log('night', `${target.name} 이 밤 사망 예정.`)
        }
      }
    }

    this._log('night', `밤 ${this.state.round} 종료.`)
    this.emit('nightResolved', { deaths: this.pendingDeaths })
  }

  _handleImpSelfKill(impId) {
    const imp = this.getPlayer(impId)
    if (imp) {
      imp.status = 'dead'
      this._log('night', `${imp.name}(임프)이 자결했습니다.`)
    }

    // Scarlet Woman 승계 조건: 생존자 5명 이상
    const aliveCount = this.state.players.filter(p => p.status === 'alive').length
    if (aliveCount >= 5) {
      const sw = this.state.players.find(p => p.role === 'scarletwoman' && p.status === 'alive')
      if (sw) {
        sw.role = 'imp'
        sw.team = 'evil'
        this._log('night', `${sw.name}(스칼렛 우먼)이 새 임프로 승계됩니다!`)
        this.emit('scarletWomanSucceeded', { playerId: sw.id })
        return
      }
    }

    // 일반 승계: 살아있는 미니언 중 무작위
    const minions = this.state.players.filter(
      p => p.status === 'alive' && ['poisoner','spy','scarletwoman','baron'].includes(p.role)
    )
    if (minions.length > 0) {
      const newImp = minions[Math.floor(Math.random() * minions.length)]
      newImp.role = 'imp'
      newImp.team = 'evil'
      this._log('night', `${newImp.name}이(가) 새 임프로 승계됩니다!`)
      this.emit('impSucceeded', { playerId: newImp.id })
    }
  }

  _handleMayorBounce(impId, mayorId) {
    const alive = this.state.players.filter(
      p => p.status === 'alive' && p.id !== mayorId && p.id !== impId
    )
    if (alive.length === 0) return
    const bounced = alive[Math.floor(Math.random() * alive.length)]
    this.pendingDeaths.push(bounced.id)
    this._log('night', `시장 능력: 임프 공격이 ${bounced.name}에게 튕겼습니다.`)
  }

  /**
   * 밤 사망자 공개 처리 (낮 시작 시 호출)
   */
  revealNightDeaths() {
    this.pendingDeaths.forEach(id => {
      const p = this.getPlayer(id)
      if (p && p.status === 'alive') {
        p.status = 'dead'
        this._log('day', `${p.name} 밤 사망.`)
      }
    })
    this.pendingDeaths = []
    this.emit('stateChanged', this.state)
  }

  // ─────────────────────────────────────
  // 낮 진행
  // ─────────────────────────────────────

  startDay() {
    this.state.phase = 'day'
    this.revealNightDeaths()
    this._log('day', `낮 ${this.state.round} 시작.`)
    this.emit('stateChanged', this.state)
    this.checkWinCondition()
  }

  /**
   * 지목 등록
   * @returns {{ virginTriggered: boolean }}
   */
  nominate(nominatorId, targetId) {
    const nominator = this.getPlayer(nominatorId)
    const target = this.getPlayer(targetId)
    if (!nominator || !target) return {}

    const nomination = { nominatorId, targetId, votes: 0 }
    this.state.nominations.push(nomination)
    this._log('day', `${nominator.name}이(가) ${target.name}을(를) 지목했습니다.`)

    // Virgin 트리거 체크
    if (
      target.role === 'virgin' && !this.virginTriggered &&
      !target.isPoisoned && !target.isDrunk
    ) {
      const nominatorRole = ROLES_BY_ID[nominator.role]
      if (nominatorRole && nominatorRole.team === 'townsfolk') {
        this.virginTriggered = true
        this._log('day', `처녀 능력 발동! ${nominator.name}이(가) 즉시 처형됩니다.`)
        this.killPlayer(nominatorId, 'virgin')
        this.emit('virginTriggered', { nominatorId })
        return { virginTriggered: true }
      }
    }

    this.emit('stateChanged', this.state)
    return { virginTriggered: false }
  }

  /**
   * 투표 수 업데이트
   */
  updateVotes(nominationIndex, votes) {
    if (this.state.nominations[nominationIndex]) {
      this.state.nominations[nominationIndex].votes = votes
      this.emit('stateChanged', this.state)
    }
  }

  /**
   * 처형 문턱값 계산 (생존자 과반수)
   */
  getExecutionThreshold() {
    const alive = this.state.players.filter(p => p.status === 'alive').length
    return Math.ceil(alive / 2)
  }

  /**
   * 처형 확정
   * @returns {{ gameOver: boolean, winner: string|null }}
   */
  execute(playerId) {
    const p = this.getPlayer(playerId)
    if (!p) return {}

    p.status = 'executed'
    this.state.executedToday = playerId
    this._log('day', `${p.name}이(가) 처형됩니다.`)

    // Saint 체크: 성인 처형 → 선 패배
    if (p.role === 'saint' && !p.isPoisoned && !p.isDrunk) {
      this._log('day', `성인이 처형됨! 선 팀 즉시 패배.`)
      this.emit('stateChanged', this.state)
      return { gameOver: true, winner: 'evil', reason: 'saint' }
    }

    this.emit('stateChanged', this.state)
    return this.checkWinCondition()
  }

  /**
   * 학살자 선언
   * @returns {{ hit: boolean }}
   */
  slayerDeclare(actorId, targetId) {
    if (this.slayerUsed) return { hit: false, alreadyUsed: true }
    const actor = this.getPlayer(actorId)
    const target = this.getPlayer(targetId)
    if (!actor || !target) return { hit: false }

    this.slayerUsed = true
    this._log('day', `${actor.name}(학살자)이 ${target.name}을(를) 지목합니다.`)

    const isActualDemon = target.role === 'imp'
    if (isActualDemon && !actor.isPoisoned && !actor.isDrunk) {
      this.killPlayer(targetId, 'slayer')
      this._log('day', `데몬 적중! ${target.name} 즉시 사망.`)
      this.emit('stateChanged', this.state)
      return { hit: true, ...this.checkWinCondition() }
    } else {
      this._log('day', `학살자 빗나감.`)
      this.emit('stateChanged', this.state)
      return { hit: false }
    }
  }

  // ─────────────────────────────────────
  // 상태 관리
  // ─────────────────────────────────────

  killPlayer(playerId, cause) {
    const p = this.getPlayer(playerId)
    if (!p || p.status !== 'alive') return
    p.status = cause === 'executed' ? 'executed' : 'dead'
    this._log('event', `${p.name} 사망 (원인: ${cause})`)
    this.emit('playerDied', { playerId, cause })
  }

  /**
   * 밤 액션 기록
   */
  recordNightAction(roleId, actorId, targetIds, infoSent = null) {
    this.nightActions.push({
      round: this.state.round,
      roleId,
      actorId,
      targetIds,
      infoSent,
    })

    // 특수 처리
    if (roleId === 'poisoner' && targetIds.length > 0) {
      this.poisonedThisNight = targetIds[0]
    }
    if (roleId === 'monk' && targetIds.length > 0) {
      this.monkProtect = targetIds[0]
    }
    if (roleId === 'butler' && targetIds.length > 0) {
      this.butlerMasters[actorId] = targetIds[0]
    }
  }

  // ─────────────────────────────────────
  // 정보 계산
  // ─────────────────────────────────────

  /**
   * Empath 정보 계산 (이웃 좌석 기준, 생존 여부와 무관)
   */
  calcEmpathInfo(playerId) {
    const players = this.state.players
    const idx = players.findIndex(p => p.id === playerId)
    if (idx === -1) return 0
    const n = players.length
    const left = players[(idx - 1 + n) % n]
    const right = players[(idx + 1) % n]
    // 독/취함 시 오정보 가능 (스토리텔러 재량 → 앱은 정보 제공, 조작은 호스트가)
    let count = 0
    if (left.team === 'evil' || (left.role === 'recluse' && left.registeredAs === 'evil')) count++
    if (right.team === 'evil' || (right.role === 'recluse' && right.registeredAs === 'evil')) count++
    return count
  }

  /**
   * Chef 정보 계산 (이웃 악 쌍 수)
   */
  calcChefInfo() {
    const players = this.state.players
    const n = players.length
    let pairs = 0
    for (let i = 0; i < n; i++) {
      const curr = players[i]
      const next = players[(i + 1) % n]
      const currEvil = curr.team === 'evil'
      const nextEvil = next.team === 'evil'
      if (currEvil && nextEvil) pairs++
    }
    return pairs
  }

  /**
   * Fortune Teller 정보 계산
   * @param {number[]} targetIds 선택한 2명
   */
  calcFortuneTellerInfo(actorId, targetIds) {
    const actor = this.getPlayer(actorId)
    // 취함/독 시 오정보 (앱은 정보 표시, 호스트가 조정 가능)
    if (actor && (actor.isPoisoned || actor.isDrunk)) {
      return Math.random() < 0.5 // 무작위 오정보
    }
    return targetIds.some(id => {
      const p = this.getPlayer(id)
      if (!p) return false
      if (p.role === 'imp') return true
      if (p.id === this.redHerring) return true
      // Recluse: 등록 왜곡
      if (p.role === 'recluse' && p.registeredAs === 'demon') return true
      // Spy: 선 등록
      if (p.role === 'spy' && p.registeredAs === 'good') return false
      return false
    })
  }

  /**
   * Washerwoman 정보 계산: 해당 townsfolk인 플레이어 + 다른 1명 제시
   */
  calcWasherwomanInfo(roleId) {
    const correct = this.state.players.filter(p => p.role === roleId && p.status === 'alive')
    const wrong = this.state.players.filter(p => p.role !== roleId && p.status === 'alive')
    if (correct.length === 0 || wrong.length === 0) return null
    const c = correct[Math.floor(Math.random() * correct.length)]
    const w = wrong[Math.floor(Math.random() * wrong.length)]
    return { players: shuffle([c.id, w.id]), roleId }
  }

  /**
   * Undertaker 정보: 전날 처형자 역할
   */
  calcUndertakerInfo() {
    if (!this.state.executedToday) return null
    const p = this.getPlayer(this.state.executedToday)
    return p ? { playerId: p.id, roleId: p.role } : null
  }

  // ─────────────────────────────────────
  // 승리 조건
  // ─────────────────────────────────────

  checkWinCondition() {
    const alive = this.state.players.filter(p => p.status === 'alive')
    const demon = alive.find(p => p.role === 'imp')

    // 데몬 사망 → 선 승리 (Scarlet Woman 처리 후)
    if (!demon) {
      return { gameOver: true, winner: 'good', reason: 'demon_dead' }
    }

    // 최종 2인 이하 → 악 승리
    if (alive.length <= 2) {
      return { gameOver: true, winner: 'evil', reason: 'final_two' }
    }

    // Mayor 3인 조건: 처형 없이 낮이 끝나고 생존자 3명
    if (
      alive.length === 3 &&
      this.state.phase === 'day' &&
      this.state.executedToday === null &&
      alive.find(p => p.role === 'mayor' && !p.isPoisoned && !p.isDrunk)
    ) {
      return { gameOver: true, winner: 'good', reason: 'mayor' }
    }

    return { gameOver: false }
  }

  // ─────────────────────────────────────
  // 유틸
  // ─────────────────────────────────────

  getPlayer(id) {
    return this.state.players.find(p => p.id === id) || null
  }

  getPlayerByPeerId(peerId) {
    return this.state.players.find(p => p.peerId === peerId) || null
  }

  getAlivePlayers() {
    return this.state.players.filter(p => p.status === 'alive')
  }

  getCurrentNightRole() {
    const step = this.state.currentNightStep
    if (!step) return null
    if (step === 'minion-info' || step === 'demon-info') return step
    return ROLES_BY_ID[step] || null
  }

  /** 현재 단계의 nightType (select/info/null) */
  getCurrentNightType() {
    const step = this.state.currentNightStep
    if (!step) return null
    if (step === 'minion-info') return 'info'
    if (step === 'demon-info') return 'info'
    const role = ROLES_BY_ID[step]
    return role ? role.nightType : null
  }

  /** 현재 밤 단계 처리 대상 플레이어 */
  getCurrentNightActor() {
    const step = this.state.currentNightStep
    if (!step) return null
    if (step === 'minion-info') {
      return this.state.players.filter(p =>
        ['poisoner','spy','scarletwoman','baron'].includes(p.role)
      )
    }
    if (step === 'demon-info') {
      return this.state.players.filter(p => p.role === 'imp')
    }
    return this.state.players.filter(p => p.role === step && p.status === 'alive')
  }

  /**
   * 데몬 블러프 3개 생성 (게임에 없는 townsfolk/outsider 역할)
   */
  getBluffs() {
    const usedRoles = new Set(this.state.players.map(p => p.role))
    const pool = ROLES_TB.filter(r =>
      !usedRoles.has(r.id) &&
      (r.team === 'townsfolk' || r.team === 'outsider')
    )
    const shuffled = [...pool].sort(() => Math.random() - 0.5)
    return shuffled.slice(0, 3)
  }

  _log(phase, event) {
    const entry = {
      round: this.state.round,
      phase,
      event,
      timestamp: new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
    }
    this.logs.push(entry)
    this.emit('log', entry)
  }

  // ─────────────────────────────────────
  // 이벤트 에미터
  // ─────────────────────────────────────

  on(event, handler) {
    if (!this._listeners[event]) this._listeners[event] = []
    this._listeners[event].push(handler)
  }

  off(event, handler) {
    if (!this._listeners[event]) return
    this._listeners[event] = this._listeners[event].filter(h => h !== handler)
  }

  emit(event, data) {
    ;(this._listeners[event] || []).forEach(h => h(data))
  }
}

function shuffle(arr) {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

export const engine = new GameEngine()
