/**
 * DemonBluffAdvisor — 임프 블러프 3개 세트 제안 모듈 (순수 로직)
 *
 * UI에 의존하지 않는 독립 모듈.
 * 게임 상태를 분석해 도전적 / 기본 / 초보자 세 가지 블러프 세트와 추천 이유를 반환.
 *
 * 사용:
 *   const advisor = new DemonBluffAdvisor()
 *   const { analysis, options } = advisor.advise({ pool, players })
 */

export class DemonBluffAdvisor {

  /**
   * @param {Object} input
   *   pool     {Object[]}  getBluffPool() — 게임에 없는 선 역할 배열
   *   players  {Object[]}  engine.state.players 전체
   * @returns {{ analysis, options }}
   */
  advise({ pool, players }) {
    const analysis = this._analyzeState(players, pool)
    const options  = this._buildOptions(pool, analysis)
    return { analysis, options }
  }

  // ─── 게임 상태 분석 ────────────────────────────────────────────

  _analyzeState(players, pool) {
    const alive      = players.filter(p => p.status === 'alive')
    const goodCount  = alive.filter(p => ['townsfolk','outsider'].includes(p.team)).length
    const evilCount  = alive.filter(p => ['demon','minion'].includes(p.team)).length
    const balance    = goodCount / (evilCount || 1)

    // 게임 내 위협적인 정보형 역할 수 (임프 입장)
    const threatRoles = ['fortuneteller','empath','washerwoman','investigator','librarian','undertaker']
    const threatCount = alive.filter(p => threatRoles.includes(p.role)).length

    // 블러프 풀 중 정보형 / 행동 없는 역할 비율
    const infoPool    = pool.filter(r => r.nightType === 'info' || r.firstNight || r.otherNights)
    const passivePool = pool.filter(r => !r.firstNight && !r.otherNights)

    const balanceTag = balance > 2.2 ? '선팀 우세' : balance < 1.4 ? '악팀 우세' : '균형'
    const risk       = balance < 1.4 ? 'high' : balance < 2.0 ? 'mid' : 'low'

    return {
      goodCount,
      evilCount,
      balanceTag,
      balance,
      riskLabel:    risk === 'high' ? '높음' : risk === 'mid' ? '중간' : '낮음',
      threatCount,
      infoPoolSize:    infoPool.length,
      passivePoolSize: passivePool.length,
      recommended: this._getRecommended(balance, threatCount),
    }
  }

  _getRecommended(balance, threatCount) {
    if (threatCount >= 3) return 'aggressive'  // 정보형 많음 → 사칭으로 혼란
    if (balance < 1.4)   return 'aggressive'   // 악팀 우세 → 더 적극적으로
    if (balance > 2.2)   return 'beginner'     // 선팀 너무 많음 → 쉬운 블러프
    return 'standard'
  }

  // ─── 선택지 빌드 ────────────────────────────────────────────────

  _buildOptions(pool, analysis) {
    const aggressive = this._pickAggressive(pool)
    const standard   = this._pickStandard(pool)
    const beginner   = this._pickBeginner(pool)

    const stateDesc =
      analysis.balanceTag === '악팀 우세'
        ? `악팀 우세 (선${analysis.goodCount} vs 악${analysis.evilCount}) — 적극적 사칭 고려`
        : analysis.balanceTag === '선팀 우세'
        ? `선팀 우세 (선${analysis.goodCount} vs 악${analysis.evilCount}) — 쉬운 유지 권장`
        : `균형 (선${analysis.goodCount} vs 악${analysis.evilCount})`

    return [
      {
        id:          'aggressive',
        icon:        '🔴',
        label:       '도전적',
        roles:       aggressive,
        impact:      '정보형 역할 사칭 → 선팀 추리를 혼란시키지만, 유지하기 어려움.',
        stateReason: analysis.threatCount >= 3
          ? `게임 내 정보형 역할 ${analysis.threatCount}개 — 역정보로 상쇄 고려`
          : stateDesc,
        recommended: analysis.recommended === 'aggressive',
      },
      {
        id:          'standard',
        icon:        '⚪',
        label:       '기본',
        roles:       standard,
        impact:      '정보형+수동 혼합 → 자연스러운 블러프, 유지 난이도 보통.',
        stateReason: stateDesc,
        recommended: analysis.recommended === 'standard',
      },
      {
        id:          'beginner',
        icon:        '🟢',
        label:       '초보자',
        roles:       beginner,
        impact:      '밤 행동 없는 역할 위주 → 유지하기 쉬움, 덜 의심받음.',
        stateReason: analysis.balanceTag === '선팀 우세'
          ? `선팀 우세 — 조용한 블러프로 관심 분산`
          : stateDesc,
        recommended: analysis.recommended === 'beginner',
      },
      {
        id:          'custom',
        icon:        '✏️',
        label:       '직접 선택',
        roles:       [],
        impact:      '호스트가 직접 3개를 고릅니다.',
        stateReason: '',
        recommended: false,
      },
    ]
  }

  // ─── 역할 세트 선택 전략 ─────────────────────────────────────────

  /** 도전적: 정보형 역할(firstNight/otherNights) 우선 */
  _pickAggressive(pool) {
    const infoRoles    = pool.filter(r => r.nightType === 'info' || r.firstNight || r.otherNights)
    const nonInfoRoles = pool.filter(r => !r.firstNight && !r.otherNights)
    return this._fillTo3(infoRoles, nonInfoRoles, pool)
  }

  /** 기본: 정보형 1~2개 + 수동 1~2개 혼합 */
  _pickStandard(pool) {
    const infoRoles    = this._shuffle(pool.filter(r => r.nightType === 'info' || r.firstNight || r.otherNights))
    const passiveRoles = this._shuffle(pool.filter(r => !r.firstNight && !r.otherNights))
    // 정보형 1개 + 수동 2개 조합 시도
    const picked = []
    if (infoRoles[0])    picked.push(infoRoles[0])
    if (passiveRoles[0]) picked.push(passiveRoles[0])
    if (passiveRoles[1]) picked.push(passiveRoles[1])
    return this._fillTo3(picked, [], pool)
  }

  /** 초보자: 밤 행동 없는 수동 역할 우선 */
  _pickBeginner(pool) {
    const passiveRoles = pool.filter(r => !r.firstNight && !r.otherNights)
    const infoRoles    = pool.filter(r => r.firstNight || r.otherNights)
    return this._fillTo3(passiveRoles, infoRoles, pool)
  }

  /** preferred에서 먼저 채우고, 부족하면 fallback → pool 순으로 채움 */
  _fillTo3(preferred, fallback, pool) {
    const result = []
    const used   = new Set()

    for (const src of [preferred, fallback, pool]) {
      for (const r of this._shuffle(src)) {
        if (result.length >= 3) break
        if (!used.has(r.id)) {
          result.push(r)
          used.add(r.id)
        }
      }
      if (result.length >= 3) break
    }

    return result
  }

  _shuffle(arr) {
    return [...arr].sort(() => Math.random() - 0.5)
  }
}
