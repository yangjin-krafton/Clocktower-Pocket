/**
 * H-05 NightAdvisor — 밤 행동 정보 선택 조언 모듈 (순수 로직)
 *
 * UI에 의존하지 않는 독립 모듈.
 * engine 인스턴스를 직접 참조하지 않고 구조화된 `field` 데이터만 받아 처리.
 *
 * 사용법:
 *   const advisor = new NightAdvisor()
 *   const result  = advisor.advise({ roleId, actorId, field, accurate })
 */
import { ROLES_BY_ID } from '../data/roles-tb.js'

export class NightAdvisor {

  /**
   * 메인 진입점
   * @param {Object} input
   *   roleId   {string}   행동 역할 ID
   *   actorId  {number}   행동 참가자 자리번호
   *   field    {Object}   { players, round, phase, logs }
   *   accurate {any}      engine이 계산한 정확한 정보값
   * @returns {{ analysis, recommended, options }}
   */
  advise(input) {
    const { roleId, actorId, field, accurate } = input
    const analysis    = this._analyzeState(field, actorId)
    const recommended = this._getRecommended(analysis)
    const options     = this._buildOptions(roleId, accurate, analysis, recommended)
    return { analysis, recommended, options }
  }

  // ─────────────────────────────────────────
  // 게임 상태 분석
  // ─────────────────────────────────────────

  _analyzeState(field, actorId) {
    const alive     = field.players.filter(p => p.status === 'alive')
    const goodCount = alive.filter(p => p.team === 'good').length
    const evilCount = alive.filter(p => p.team === 'evil').length
    const balance   = goodCount / (evilCount || 1)

    // 이 참가자가 이번 게임에서 받은 정보 횟수
    const infoCount = (field.logs || []).filter(
      l => l.actorId === actorId && l.type === 'night'
    ).length

    const risk = evilCount >= goodCount        ? 'high'
               : evilCount >= goodCount * 0.6  ? 'mid'
               : 'low'

    return {
      balance,
      balanceTag: balance > 2.5 ? '선팀 우세' : balance < 1.2 ? '악팀 우세' : '균형',
      infoCount,
      risk,
      riskLabel:  risk === 'high' ? '높음' : risk === 'mid' ? '중간' : '낮음',
      goodCount,
      evilCount,
    }
  }

  _getRecommended(analysis) {
    if (analysis.balance < 1.2)  return 'good'     // 악팀 우세 → 선팀 도움
    if (analysis.balance > 2.5)  return 'evil'     // 선팀 과다 → 악팀 도움
    if (analysis.infoCount >= 2) return 'neutral'  // 정보 많음 → 중립
    return 'good'
  }

  // ─────────────────────────────────────────
  // 선택지 생성
  // ─────────────────────────────────────────

  _buildOptions(roleId, accurate, analysis, recommended) {
    const neutralVal  = this._calcNeutral(roleId, accurate, analysis)
    const evilVal     = this._calcEvilMisinfo(roleId, accurate)

    const stateDesc = analysis.balanceTag === '악팀 우세'
      ? '악팀 우세 — 선팀 도움 권장'
      : analysis.balanceTag === '선팀 우세'
      ? '선팀 우세 — 오정보 고려 가능'
      : '균형 — 중립 또는 선팀 도움 권장'

    return [
      {
        id:          'good',
        icon:        '🔵',
        label:       '선팀 도움',
        preview:     this._formatPreview(roleId, accurate),
        impact:      '정확한 정보. 선팀 플레이어가 올바른 추리 가능.',
        stateReason: stateDesc,
        recommended: recommended === 'good',
        revealData:  this._buildRevealData(roleId, accurate),
      },
      {
        id:          'neutral',
        icon:        '⚪',
        label:       '중립',
        preview:     this._formatPreview(roleId, neutralVal),
        impact:      '애매한 정보. 게임 텐션 유지.',
        stateReason: analysis.infoCount >= 2 ? `이미 ${analysis.infoCount}회 정보 수령 — 중립 고려` : stateDesc,
        recommended: recommended === 'neutral',
        revealData:  this._buildRevealData(roleId, neutralVal),
      },
      {
        id:          'evil',
        icon:        '🔴',
        label:       '악팀 도움',
        preview:     this._formatPreview(roleId, evilVal),
        impact:      '⚠️ 오정보. 선팀 추리를 방해. 악팀 생존에 유리.',
        stateReason: analysis.balanceTag === '선팀 우세' ? '선팀 과다 유리 — 밸런싱 고려' : '주의: 현재 상황에서 비권장',
        recommended: recommended === 'evil',
        revealData:  this._buildRevealData(roleId, evilVal),
      },
      {
        id:          'custom',
        icon:        '✏️',
        label:       '직접 선택',
        preview:     '호스트가 직접 결정',
        impact:      '재량에 따라 자유롭게 설정.',
        stateReason: '',
        recommended: false,
        revealData:  null,   // 직접선택 UI에서 별도 처리
        customType:  this._getCustomType(roleId),
      },
    ]
  }

  // ─────────────────────────────────────────
  // 역할별 값 계산
  // ─────────────────────────────────────────

  /** 중립값 (정확값에서 ±1 또는 인접) */
  _calcNeutral(roleId, accurate, analysis) {
    switch (roleId) {
      case 'empath':
      case 'chef': {
        const n = typeof accurate === 'number' ? accurate : 0
        // 범위 내에서 ±1, 확률적으로 방향 결정
        const delta = Math.random() < 0.5 ? 1 : -1
        return Math.max(0, n + delta)
      }
      case 'undertaker':
        if (!accurate) return null
        // 같은 플레이어, 다른 역할로 표시
        return { ...accurate, roleId: this._pickRandomRole(accurate.roleId) }
      case 'washerwoman':
      case 'librarian':
      case 'investigator':
        if (!accurate) return null
        // 올바른 역할, 한 명은 다른 사람으로 교체
        return { ...accurate, decoySwapped: true }
      case 'spy':
        // 일부 역할 '?' 처리
        return { ...accurate, masked: true }
      default:
        return accurate
    }
  }

  /** 악팀 도움값 (오정보) */
  _calcEvilMisinfo(roleId, accurate) {
    switch (roleId) {
      case 'empath': {
        const n = typeof accurate === 'number' ? accurate : 0
        return n === 0 ? 1 : 0   // 0이면 1로, 아니면 0으로
      }
      case 'chef': {
        const n = typeof accurate === 'number' ? accurate : 0
        return n === 0 ? 2 : 0   // 완전히 다른 값
      }
      case 'undertaker':
        if (!accurate) return null
        return { ...accurate, roleId: this._pickRandomRole(accurate.roleId) }
      case 'washerwoman':
      case 'librarian':
      case 'investigator':
        if (!accurate) return null
        return { ...accurate, fullyWrong: true }
      case 'spy':
        return { ...accurate, swapped: true }
      default:
        return accurate
    }
  }

  /** 역할별 미리보기 텍스트 */
  _formatPreview(roleId, value) {
    if (value === null || value === undefined) return '정보 없음'
    switch (roleId) {
      case 'empath':
        return `양옆 악 플레이어: ${value}명`
      case 'chef':
        return `이웃한 악 쌍: ${value}쌍`
      case 'undertaker': {
        if (!value) return '어젯밤 처형자 없음'
        const r = ROLES_BY_ID[value.roleId]
        return `처형: ${value.playerId}번 → ${r?.name || value.roleId}`
      }
      case 'washerwoman':
      case 'librarian':
      case 'investigator': {
        if (!value) return '정보 없음'
        const r = ROLES_BY_ID[value.roleId]
        const pNums = (value.players || []).map(p => `${p.id}번`).join(', ')
        return `이 중 한 명: ${r?.name || value.roleId} (${pNums})`
      }
      case 'spy':
        return '그리모어 전체 열람'
      default:
        return String(value)
    }
  }

  /** RevealData 빌드 (RevealPanel 에 전달할 구조) */
  _buildRevealData(roleId, value) {
    if (value === null || value === undefined) return null
    const role = ROLES_BY_ID[roleId]

    switch (roleId) {
      case 'empath':
        return {
          roleIcon: role?.icon || '?',
          roleName: role?.name || roleId,
          roleTeam: role?.team || null,
          message:  `양옆 악 플레이어: ${value}명`,
          players:  [],
        }
      case 'chef':
        return {
          roleIcon: role?.icon || '?',
          roleName: role?.name || roleId,
          roleTeam: role?.team || null,
          message:  `이웃한 악 쌍: ${value}쌍`,
          players:  [],
        }
      case 'undertaker': {
        if (!value) return {
          roleIcon: role?.icon || '?', roleName: role?.name || roleId,
          roleTeam: role?.team || null, message: '어젯밤 처형자 없음', players: [],
        }
        const r = ROLES_BY_ID[value.roleId]
        return {
          roleIcon: role?.icon || '?',
          roleName: role?.name || roleId,
          roleTeam: role?.team || null,
          message:  `처형: ${value.playerId}번 → ${r?.iconEmoji || r?.icon || ''} ${r?.name || value.roleId}`,
          players:  [{ id: value.playerId }],
        }
      }
      case 'washerwoman':
      case 'librarian':
      case 'investigator': {
        if (!value) return null
        const r = ROLES_BY_ID[value.roleId]
        const label = roleId === 'washerwoman' ? '마을 사람' : roleId === 'librarian' ? '아웃사이더' : '미니언'
        return {
          roleIcon: role?.icon || '?',
          roleName: role?.name || roleId,
          roleTeam: role?.team || null,
          message:  `이 중 한 명이 ${r?.iconEmoji || r?.icon || ''} ${r?.name || label}입니다`,
          players:  (value.players || []).map(p => ({ id: p.id })),
        }
      }
      case 'spy':
        return {
          roleIcon: role?.icon || '?',
          roleName: '스파이 — 그리모어',
          roleTeam: 'minion',
          message:  typeof value === 'string' ? value : '그리모어 열람',
          players:  [],
        }
      default:
        return {
          roleIcon: role?.icon || '?',
          roleName: role?.name || roleId,
          roleTeam: role?.team || null,
          message:  String(value),
          players:  [],
        }
    }
  }

  /** 직접선택 UI 타입 */
  _getCustomType(roleId) {
    if (['empath','chef'].includes(roleId)) return 'number'
    if (['washerwoman','librarian','investigator','undertaker'].includes(roleId)) return 'player-pick'
    if (roleId === 'spy') return 'text'
    return 'number'
  }

  /** 랜덤 역할 선택 (현재 역할 제외) */
  _pickRandomRole(excludeRoleId) {
    const pool = Object.keys(ROLES_BY_ID).filter(id => id !== excludeRoleId)
    return pool[Math.floor(Math.random() * pool.length)] || excludeRoleId
  }
}
