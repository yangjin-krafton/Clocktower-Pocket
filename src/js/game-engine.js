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
      bluffs: null,
    }
    this.logs = []
    this.nightActions = []  // { round, roleId, actorId, targetIds, infoSent }
    this.pendingDeaths = [] // 이번 밤 처리할 사망자 id 목록
    this.monkProtect = null // 이번 밤 수도사 보호 대상 id
    this.redHerring = null  // 점쟁이 레드 헤링 player.id
    this.virginTriggered = false
    this.slayerUsed = false
    this.butlerMasters = {} // { playerId: masterId }
    this.poisonedThisNight    = null  // 이번 밤 독약꾼 대상
    this.undertakerTarget     = null  // 장의사용: 이번 밤 직전 처형된 플레이어 id
    this.mayorBounceTarget    = null  // 시장 튕김 대상 (호스트가 선택)
    this.impSuccessionPending  = false // 임프 승계 발생 → 다음 밤 imp-succession 스텝 주입
    this.impSelfKillResolved   = false // NightAction에서 즉시 처리 → _resolveNight 재처리 방어
  }

  // ─────────────────────────────────────
  // 게임 초기화
  // ─────────────────────────────────────

  /**
   * 게임 시작 — 역할 배정
   * @param {string[]} playerNames    좌석 순서 이름 목록
   * @param {string[]} selectedRoleIds 사용할 역할 id 목록
   * @param {{ preAssigned?: boolean, redHerringId?: number }} [opts]
   *   preAssigned=true  → selectedRoleIds 가 이미 자리 순서로 배정됨 (셔플 안 함)
   *   redHerringId      → 점쟁이 레드헤링 플레이어 ID (1-based), 지정하면 랜덤 선택 안 함
   */
  initGame(playerNames, selectedRoleIds, opts = {}) {
    const n = playerNames.length
    const counts = PLAYER_COUNTS[n]
    if (!counts) throw new Error(`지원하지 않는 인원: ${n}`)

    // 역할 배정 (사전배정 or 셔플)
    const assigned = opts.preAssigned
      ? [...selectedRoleIds]
      : [...selectedRoleIds].sort(() => Math.random() - 0.5)

    this.state.players = playerNames.map((name, i) => {
      const roleId = assigned[i] || 'unknown'
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
        drunkAs: null,
        deadVoteUsed: false,
        registeredAs: null,
      }
    })

    // 점쟁이 레드 헤링
    if (opts.redHerringId) {
      this.redHerring = opts.redHerringId
    } else {
      const goodPlayers = this.state.players.filter(p => p.team === 'good')
      if (goodPlayers.length > 0) {
        this.redHerring = goodPlayers[Math.floor(Math.random() * goodPlayers.length)].id
      }
    }

    // 주정뱅이: isDrunk = true 처리 + drunkAs 설정
    this.state.players.forEach(p => {
      if (p.role === 'drunk') {
        p.isDrunk = true
        if (opts.drunkAs) p.drunkAs = opts.drunkAs
      }
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
    const order = this.state.round === 1 ? NIGHT_ORDER_FIRST : NIGHT_ORDER_OTHER
    const activeRoleIds = new Set(
      this.state.players
        .filter(p => p.status === 'alive')
        .map(p => p.role)
    )
    // 주정뱅이가 믿는 역할도 밤 순서에 포함
    this.state.players.forEach(p => {
      if (p.role === 'drunk' && p.drunkAs && p.status === 'alive') {
        activeRoleIds.add(p.drunkAs)
      }
    })

    return order.filter(roleId => {
      if (roleId === 'minion-info' || roleId === 'demon-info') {
        // 첫 밤(round === 1)에만 포함
        return this.state.round === 1
      }
      if (roleId === 'ravenkeeper') {
        // 밤 시작 시점에는 항상 제외 — 임프 행동 기록(recordNightAction) 시 동적 삽입
        return false
      }
      if (roleId === 'undertaker') {
        // 이번 밤 직전 처형자가 있을 때만
        return this.undertakerTarget !== null
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
    this.undertakerTarget = this.state.executedToday  // 장의사용: 밤 시작 전 저장
    this.state.executedToday = null
    this.monkProtect       = null
    this.poisonedThisNight = null
    this.mayorBounceTarget = null
    this.pendingDeaths     = []

    // 이전 밤 독 초기화 (독약꾼 능력: 1밤만 지속)
    this.state.players.forEach(p => { p.isPoisoned = false })

    const order = this.buildNightOrder()

    // 임프 승계 발생 시 → 첫 스텝으로 imp-succession 삽입
    if (this.impSuccessionPending) {
      order.unshift('imp-succession')
      this.impSuccessionPending = false
    }

    this.state.nightOrder = order
    this.state.currentNightStep = order[0] || null

    const STEP_KO = { 'minion-info': '미니언 공개', 'demon-info': '임프 정보' }
    const orderKo = order.map(id => STEP_KO[id] || ROLES_BY_ID[id]?.name || id)
    this._log('night', `밤 ${this.state.round} 시작. 순서: ${orderKo.join(', ')}`)
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
    // 독약꾼 적용은 recordNightAction에서 즉시 처리됨 (밤 순서 반영)

    // 임프 킬 처리
    const impKillAction = this.nightActions
      .filter(a => a.round === this.state.round && a.roleId === 'imp')
      .pop()

    if (impKillAction && impKillAction.targetIds.length > 0) {
      const targetId = impKillAction.targetIds[0]
      const target = this.getPlayer(targetId)
      if (target && target.status === 'alive') {
        if (targetId === impKillAction.actorId) {
          // Imp self-kill → 즉시 처리된 경우 재처리 방어
          if (this.impSelfKillResolved) {
            this.impSelfKillResolved = false
          } else {
            this._handleImpSelfKill(impKillAction.actorId)
          }
        } else if (this.monkProtect === targetId) {
          // 수도사 보호
          this._log('night', `수도사가 ${target.name}을(를) 보호했습니다.`)
        } else if (target.role === 'soldier' && !target.isPoisoned) {
          // 군인 면역
          this._log('night', `군인 ${target.name}은(는) 임프 공격에 면역입니다.`)
        } else if (target.role === 'mayor' && !target.isPoisoned && !target.isDrunk) {
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

    if (this._tryScarletWomanSuccession()) return

    // 일반 승계: 살아있는 미니언 중 무작위
    const minions = this.state.players.filter(
      p => p.status === 'alive' && ['poisoner','spy','scarletwoman','baron'].includes(p.role)
    )
    if (minions.length > 0) {
      const newImp = minions[Math.floor(Math.random() * minions.length)]
      newImp.role = 'imp'
      newImp.team = 'evil'
      newImp.needsBluffAssignment   = true  // imp-succession 에서 블러프 재배정
      this.impSuccessionPending     = true  // 다음 밤 imp-succession 스텝 주입
      this._log('night', `${newImp.name}이(가) 새 임프로 승계됩니다!`)
      this.emit('impSucceeded', { playerId: newImp.id })
    }
  }

  /**
   * 임프 자결 즉시 처리 (NightAction에서 호출).
   * - 임프를 즉시 사망 처리
   * - SW 승계 시도 → 성공 시 { type:'sw' }
   * - 실패 시 살아있는 미니언 목록 반환 → NightAction이 선택 UI 제공
   * @returns {{ type:'sw'|'choose'|'none', minions:object[] }}
   */
  killImpSelf(impId) {
    const imp = this.getPlayer(impId)
    if (imp) {
      imp.status = 'dead'
      this._log('night', `${imp.name}(임프)이 자결했습니다.`)
    }
    this.impSelfKillResolved = true  // _resolveNight 재처리 방지

    if (this._tryScarletWomanSuccession()) {
      this.emit('stateChanged', this.state)
      return { type: 'sw', minions: [] }
    }

    const minions = this.state.players.filter(
      p => p.status === 'alive' && ['poisoner','spy','scarletwoman','baron'].includes(p.role)
    )
    this.emit('stateChanged', this.state)
    return { type: minions.length === 0 ? 'none' : 'choose', minions }
  }

  /**
   * 미니언 → 임프 승계 적용 (NightAction 선택 후 호출).
   */
  applyMinionSuccession(minionId) {
    const newImp = this.getPlayer(minionId)
    if (!newImp) return
    newImp.successionFromRole = newImp.role  // 슬롯 마크용 이전 역할 저장
    newImp.role = 'imp'
    newImp.team = 'evil'
    newImp.needsBluffAssignment = true
    this.impSuccessionPending = true
    this._log('night', `${newImp.name}이(가) 새 임프로 선택되었습니다!`)
    this.emit('impSucceeded', { playerId: newImp.id })
    this.emit('stateChanged', this.state)
  }

  /**
   * 진홍의 여인 승계 시도.
   * 임프 사망 직후 호출 — 사망 후 생존자 4명 이상(= 죽기 전 5명 이상)이면 승계.
   * @returns {boolean} 승계 성공 여부
   */
  _tryScarletWomanSuccession() {
    const aliveAfter = this.state.players.filter(p => p.status === 'alive').length
    // 규칙: "임프 포함 5명 이상 생존 시" = 임프 사망 후 4명 이상
    if (aliveAfter >= 4) {
      const sw = this.state.players.find(p => p.role === 'scarletwoman' && p.status === 'alive')
      if (sw) {
        sw.role = 'imp'
        sw.team = 'evil'
        sw.successionFromRole = 'scarletwoman'  // 슬롯 마크(둥둥 모션) + 정보 패널용
        this.impSuccessionPending = true  // 다음 밤 imp-succession 스텝 주입
        this._log('event', `${sw.name}(진홍의 여인)이 새 임프로 승계됩니다!`)
        this.emit('scarletWomanSucceeded', { playerId: sw.id })
        return true
      }
    }
    return false
  }

  /** 시장 튕김 대상 호스트 결정 기록 */
  recordMayorBounce(targetId) {
    this.mayorBounceTarget = targetId
  }

  _handleMayorBounce(_impId, _mayorId) {
    const targetId = this.mayorBounceTarget
    const bounced  = targetId ? this.getPlayer(targetId) : null
    if (!bounced || bounced.status !== 'alive') {
      this._log('night', '시장 튕김: 유효한 대상 없음, 아무도 사망하지 않습니다.')
      return
    }
    // 군인에게 튕기면 면역 — 아무도 안 죽음
    if (bounced.role === 'soldier' && !bounced.isPoisoned && !bounced.isDrunk) {
      this._log('night', `시장 능력: 임프 공격이 군인 ${bounced.name}에게 튕겼지만 군인 면역으로 아무도 사망하지 않습니다.`)
      return
    }
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
        // 처녀 지목 처형은 그날의 공식 처형으로 처리 (추가 처형 불가)
        const killed = this.getPlayer(nominatorId)
        if (killed) killed.status = 'executed'
        this.state.executedToday = nominatorId
        this.emit('stateChanged', this.state)
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

    // 임프 처형 → 진홍의 여인 승계 체크 (승계 시 checkWinCondition 에서 임프 생존 감지)
    if (p.role === 'imp') this._tryScarletWomanSuccession()

    this.emit('stateChanged', this.state)
    return this.checkWinCondition()
  }

  /**
   * 처단자 선언
   * @returns {{ hit: boolean }}
   */
  slayerDeclare(actorId, targetId) {
    if (this.slayerUsed) return { hit: false, alreadyUsed: true }
    const actor = this.getPlayer(actorId)
    const target = this.getPlayer(targetId)
    if (!actor || !target) return { hit: false }

    this.slayerUsed = true
    this._log('day', `${actor.name}(처단자)이 ${target.name}을(를) 지목합니다.`)

    const isActualDemon = target.role === 'imp'
    if (isActualDemon && !actor.isPoisoned && !actor.isDrunk) {
      this.killPlayer(targetId, 'slayer')
      this._log('day', `임프 적중! ${target.name} 즉시 사망.`)
      // 처단자로 임프 사망 → 진홍의 여인 승계 체크
      this._tryScarletWomanSuccession()
      this.emit('stateChanged', this.state)
      return { hit: true, ...this.checkWinCondition() }
    } else {
      this._log('day', `처단자 빗나감.`)
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
    const CAUSE_KO = { executed: '처형', manual: '수동', virgin: '처녀 능력', slayer: '처단자', night: '밤 사망' }
    this._log('event', `${p.name} 사망 (원인: ${CAUSE_KO[cause] || cause})`)
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
      // 즉시 중독 적용 (이후 밤 행동에 영향)
      const poisonTarget = this.getPlayer(targetIds[0])
      if (poisonTarget) poisonTarget.isPoisoned = true
    }
    if (roleId === 'monk' && targetIds.length > 0) {
      this.monkProtect = targetIds[0]
    }
    if (roleId === 'butler' && targetIds.length > 0) {
      this.butlerMasters[actorId] = targetIds[0]
    }

    // 임프가 까마귀 사육사를 지목했을 때: 즉시 nightOrder에 삽입
    // (pendingDeaths는 _resolveNight에서 채워지므로 buildNightOrder로는 감지 불가)
    if (roleId === 'imp' && targetIds.length > 0 && targetIds[0] !== actorId) {
      const impTarget = this.getPlayer(targetIds[0])
      if (impTarget && impTarget.status === 'alive' && this.monkProtect !== impTarget.id) {
        const order = this.state.nightOrder
        const impIdx = order.indexOf('imp')

        // 까마귀 사육사가 사망 예정이면 nightOrder에 삽입
        if (
          impTarget.role === 'ravenkeeper' &&
          !order.includes('ravenkeeper')
        ) {
          order.splice(impIdx + 1, 0, 'ravenkeeper')
        }

        // 시장 튕김: 호스트가 튕길 대상을 선택하도록 스텝 삽입
        if (
          impTarget.role === 'mayor' &&
          !impTarget.isPoisoned && !impTarget.isDrunk &&
          !order.includes('mayor-bounce')
        ) {
          order.splice(impIdx + 1, 0, 'mayor-bounce')
        }
      }
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
    // 독/취함 시 오정보 가능 (이야기꾼 재량 → 앱은 정보 제공, 조작은 호스트가)
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
    if (!this.undertakerTarget) return null
    const p = this.getPlayer(this.undertakerTarget)
    return p ? { playerId: p.id, roleId: p.role } : null
  }

  // ─────────────────────────────────────
  // 승리 조건
  // ─────────────────────────────────────

  checkWinCondition() {
    const alive = this.state.players.filter(p => p.status === 'alive')
    const demon = alive.find(p => p.role === 'imp')

    // 임프 사망 → 선 승리 (Scarlet Woman 처리 후)
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
    const actors = this.state.players.filter(p => p.role === step && p.status === 'alive')
    // 주정뱅이가 이 역할을 믿고 있으면 함께 포함
    const drunkActors = this.state.players.filter(p =>
      p.role === 'drunk' && p.drunkAs === step && p.status === 'alive'
    )
    return [...actors, ...drunkActors]
  }

  /** 블러프 후보 풀 (게임에 없는 townsfolk/outsider) */
  getBluffPool() {
    const usedRoles = new Set(this.state.players.map(p => p.role))
    return ROLES_TB.filter(r =>
      !usedRoles.has(r.id) &&
      (r.team === 'townsfolk' || r.team === 'outsider')
    )
  }

  /** 호스트가 선택한 블러프 3개를 state에 저장 */
  setBluffs(roles) {
    this.state.bluffs = roles
  }

  /** 저장된 블러프 반환 (미설정이면 빈 배열) */
  getBluffs() {
    return this.state.bluffs || []
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
  // 직렬화 / 복원
  // ─────────────────────────────────────

  /**
   * 전체 게임 상태를 JSON-safe 객체로 직렬화
   */
  serialize() {
    return {
      state:            JSON.parse(JSON.stringify(this.state)),
      logs:             JSON.parse(JSON.stringify(this.logs)),
      nightActions:     JSON.parse(JSON.stringify(this.nightActions)),
      pendingDeaths:    [...this.pendingDeaths],
      monkProtect:      this.monkProtect,
      redHerring:       this.redHerring,
      virginTriggered:  this.virginTriggered,
      slayerUsed:       this.slayerUsed,
      butlerMasters:    { ...this.butlerMasters },
      poisonedThisNight: this.poisonedThisNight,
      undertakerTarget:  this.undertakerTarget,
      mayorBounceTarget:    this.mayorBounceTarget,
      impSuccessionPending: this.impSuccessionPending,
      impSelfKillResolved:  this.impSelfKillResolved,
    }
  }

  /**
   * 직렬화된 데이터로부터 게임 상태 복원
   */
  restore(data) {
    if (!data || !data.state) return
    this.state             = JSON.parse(JSON.stringify(data.state))
    this.logs              = data.logs || []
    this.nightActions      = data.nightActions || []
    this.pendingDeaths     = data.pendingDeaths || []
    this.monkProtect       = data.monkProtect ?? null
    this.redHerring        = data.redHerring ?? null
    this.virginTriggered   = data.virginTriggered ?? false
    this.slayerUsed        = data.slayerUsed ?? false
    this.butlerMasters     = data.butlerMasters || {}
    this.poisonedThisNight = data.poisonedThisNight ?? null
    this.undertakerTarget  = data.undertakerTarget  ?? null
    this.mayorBounceTarget    = data.mayorBounceTarget    ?? null
  this.impSuccessionPending = data.impSuccessionPending ?? false
  this.impSelfKillResolved  = data.impSelfKillResolved  ?? false
    this.emit('stateChanged', this.state)
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
