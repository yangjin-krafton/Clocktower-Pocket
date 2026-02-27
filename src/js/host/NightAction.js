/**
 * H-04 NightAction — 밤 역할 처리
 * 역할별로 InfoPanel 또는 SelectPanel을 렌더링
 */
import { mountInfoPanel }          from '../components/InfoPanel.js'
import { mountOvalSelectPanel }     from '../components/OvalSelectPanel.js'
import { mountHostDecisionPanel }   from '../components/HostDecisionPanel.js'
import { mountSpyModeSelector, mountSpyGrimoirePanel } from '../components/SpyGrimoirePanel.js'
import { NightAdvisor }             from './NightAdvisor.js'
import { ROLES_BY_ID } from '../data/roles-tb.js'

export class NightAction {
  constructor({ engine, onStepDone }) {
    this.engine     = engine
    this.onStepDone = onStepDone
    this._unmount   = null
    this._advisor   = new NightAdvisor()
  }

  /**
   * 현재 nightStep을 처리 (InfoPanel or SelectPanel 마운트)
   */
  processCurrentStep() {
    const step = this.engine.state.currentNightStep
    if (!step) { this.onStepDone && this.onStepDone(step, []); return }

    const type = this.engine.getCurrentNightType()
    const actors = this.engine.getCurrentNightActor()

    if (step === 'minion-info') {
      this._showMinionInfo(actors)
    } else if (step === 'demon-info') {
      this._showDemonInfo(actors)
    } else if (step === 'spy') {
      this._showSpyInfo(actors)
    } else if (type === 'info') {
      this._showRoleInfo(step, actors)
    } else if (type === 'select') {
      this._showRoleSelect(step, actors)
    } else {
      this.onStepDone && this.onStepDone(step, [])
    }
  }

  _done(step, targetIds = []) {
    this._unmount && this._unmount()
    this._unmount = null
    this.onStepDone && this.onStepDone(step, targetIds)
  }

  // 번호 포맷 헬퍼
  _toNum(p) { return `${p.id}번` }

  // ── 미니언 공개 ──
  _showMinionInfo(minions) {
    if (!minions || minions.length === 0) { this._done('minion-info'); return }
    const demonPlayers = this.engine.state.players.filter(p => p.role === 'imp')
    const bluffs = this.engine.getBluffs()
    const bluffText = bluffs.map(r => `${r.iconEmoji || r.icon} ${r.name}`).join(', ')

    const minionNums = minions.map(p => `${this._toNum(p)}(${ROLES_BY_ID[p.role]?.name})`).join(', ')
    const demonNums  = demonPlayers.map(p => this._toNum(p)).join(', ') || '?'

    const minionMsg = `미니언: ${minionNums}\n임프: ${demonNums}\n블러프: ${bluffText || '없음'}`
    this._unmount = mountInfoPanel({
      title:    '미니언 공개',
      roleIcon: '🎭',
      message:  minionMsg,
      players:  [...minions, ...demonPlayers],
      revealData: {
        roleIcon: '🎭',
        roleName: '미니언 공개',
        roleTeam: 'minion',
        message:  `임프: ${demonNums}\n블러프: ${bluffText || '없음'}`,
        players:  minions.map(p => ({ id: p.id })),
      },
      onConfirm: () => this._done('minion-info'),
    })
  }

  // ── 임프 정보 ──
  _showDemonInfo(demons) {
    if (!demons || demons.length === 0) { this._done('demon-info'); return }
    const minions = this.engine.state.players.filter(p =>
      ['poisoner','spy','scarletwoman','baron'].includes(p.role)
    )
    const bluffs = this.engine.getBluffs()
    const bluffText = bluffs.map(r => `${r.iconEmoji || r.icon} ${r.name}`).join(', ')
    const minionNums = minions.map(p => `${this._toNum(p)}(${ROLES_BY_ID[p.role]?.name})`).join(', ') || '없음'

    const demonMsg = `미니언: ${minionNums}\n블러프 3개: ${bluffText}`
    this._unmount = mountInfoPanel({
      title:    '임프 정보',
      roleIcon: '👿',
      message:  demonMsg,
      players:  minions,
      revealData: {
        roleIcon: '👿',
        roleName: '임프 정보',
        roleTeam: 'demon',
        message:  `미니언: ${minions.map(p => this._toNum(p)).join(', ') || '없음'}\n블러프: ${bluffText}`,
        players:  minions.map(p => ({ id: p.id })),
      },
      onConfirm: () => this._done('demon-info'),
    })
  }

  // ── 스파이 (그리모어 열람) ──
  _showSpyInfo(spies) {
    if (!spies || spies.length === 0) { this._done('spy'); return }
    const allPlayers = this.engine.state.players

    // ① 호스트가 공개 방식 선택 (모두/반/셔플)
    this._unmount = mountSpyModeSelector({
      players: allPlayers,
      onSelected: (mode) => {
        // ② 선택된 방식으로 오발 그리모어 공개
        this._unmount = mountSpyGrimoirePanel({
          players: allPlayers,
          mode,
          onNext: () => this._done('spy'),
        })
      },
    })
  }

  // ── 정보 전달 역할 ──
  _showRoleInfo(roleId, actors) {
    if (!actors || actors.length === 0) { this._done(roleId); return }
    const actor     = actors[0]
    const role      = ROLES_BY_ID[roleId]
    const isPoisoned = actor.isPoisoned || actor.isDrunk

    // 정확한 값 계산 (중독이면 랜덤)
    const accurate = isPoisoned
      ? this._calcPoisonedValue(roleId)
      : this._calcAccurateValue(roleId, actor)

    this.engine.recordNightAction(roleId, actor.id, [], String(accurate))

    // ① NightAdvisor로 4가지 선택지 생성
    const adviseResult = this._advisor.advise({
      roleId,
      actorId: actor.id,
      field: {
        players: this.engine.state.players,
        round:   this.engine.state.round || 1,
        phase:   'night',
        logs:    this.engine.logs || [],
      },
      accurate,
    })

    // ② HostDecisionPanel 표시 (호스트 전용)
    this._unmount = mountHostDecisionPanel({
      roleId,
      actorSeatId: actor.id,
      analysis:    adviseResult.analysis,
      options:     adviseResult.options,
      onDecide: (chosen) => {
        // 직접선택이고 revealData가 없으면 기본 InfoPanel만 표시
        const finalRevealData = chosen.revealData || null
        const finalMessage    = chosen.preview || String(accurate)

        this._unmount = mountInfoPanel({
          title:      role?.name || roleId,
          roleIcon:   role?.icon || '?',
          message:    finalMessage,
          players:    [],
          revealData: finalRevealData,
          onConfirm:  () => this._done(roleId),
        })
      },
    })
  }

  /** 역할별 정확한 정보값 계산 */
  _calcAccurateValue(roleId, actor) {
    switch (roleId) {
      case 'empath':     return this.engine.calcEmpathInfo(actor.id)
      case 'chef':       return this.engine.calcChefInfo()
      case 'undertaker': return this.engine.calcUndertakerInfo()
      case 'washerwoman': {
        const target = this._pickRandomTownsfolk()
        if (!target) return null
        const decoy = this._pickDecoy(target.playerId)
        return { roleId: target.roleId, players: [target.player, decoy].filter(Boolean) }
      }
      case 'librarian': {
        const outsiders = this.engine.state.players.filter(
          p => ['butler','drunk','recluse','saint'].includes(p.role) && p.status === 'alive'
        )
        if (!outsiders.length) return null
        const target = outsiders[Math.floor(Math.random() * outsiders.length)]
        const decoy  = this._pickDecoy(target.id)
        return { roleId: target.role, players: [target, decoy].filter(Boolean) }
      }
      case 'investigator': {
        const minions = this.engine.state.players.filter(
          p => ['poisoner','spy','scarletwoman','baron'].includes(p.role) && p.status === 'alive'
        )
        if (!minions.length) return null
        const target = minions[Math.floor(Math.random() * minions.length)]
        const decoy  = this._pickDecoy(target.id)
        return { roleId: target.role, players: [target, decoy].filter(Boolean) }
      }
      default: return `${ROLES_BY_ID[roleId]?.name || roleId} 정보 전달`
    }
  }

  /** 중독/취함 시 랜덤 값 */
  _calcPoisonedValue(roleId) {
    switch (roleId) {
      case 'empath':     return Math.floor(Math.random() * 3)
      case 'chef':       return Math.floor(Math.random() * 5)
      case 'undertaker': return null   // 취함이면 정보 없음으로 처리
      default:           return null
    }
  }

  // ── 선택 역할 ──
  _showRoleSelect(roleId, actors) {
    if (!actors || actors.length === 0) { this._done(roleId); return }
    const actor = actors[0]
    const role = ROLES_BY_ID[roleId]

    // 선택 가능 대상 필터
    let selectablePlayers = this.engine.state.players.filter(p => p.status === 'alive')
    if (roleId === 'monk') {
      selectablePlayers = selectablePlayers.filter(p => p.id !== actor.id)
    }
    if (roleId === 'fortuneteller') {
      selectablePlayers = this.engine.state.players // 사망자도 포함
    }

    this._unmount = mountOvalSelectPanel({
      title:      role?.name || roleId,
      roleIcon:   role?.icon || '?',
      roleTeam:   role?.team || null,
      players:    selectablePlayers,
      selfSeatId: actor.id,
      maxSelect:  role?.maxSelect || 1,
      onConfirm: (ids) => {
        this.engine.recordNightAction(roleId, actor.id, ids)

        // Fortune Teller: 정보 계산 후 RevealPanel 포함 InfoPanel 표시
        if (roleId === 'fortuneteller' && ids.length === 2) {
          const result = this.engine.calcFortuneTellerInfo(actor.id, ids)
          const msg    = result ? '✅ 예, 그 중 한 명은 임프입니다' : '❌ 아니오, 임프가 없습니다'
          mountInfoPanel({
            title:    '점쟁이 결과',
            roleIcon: '🔮',
            message:  msg,
            players:  ids.map(id => this.engine.getPlayer(id)).filter(Boolean),
            revealData: {
              roleIcon: '🔮',
              roleName: '점쟁이 결과',
              roleTeam: 'town',
              message:  msg,
              players:  ids.map(id => ({ id })),
            },
            onConfirm: () => this._done(roleId, ids),
          })
        } else {
          this._done(roleId, ids)
        }
      }
    })
  }

  _pickRandomTownsfolk() {
    const townsfolk = this.engine.state.players.filter(p =>
      ['washerwoman','librarian','investigator','chef','empath','fortuneteller',
       'undertaker','monk','ravenkeeper','virgin','slayer','soldier','mayor'].includes(p.role)
      && p.status === 'alive'
    )
    if (townsfolk.length === 0) return null
    const t = townsfolk[Math.floor(Math.random() * townsfolk.length)]
    return { playerId: t.id, player: t, roleId: t.role }
  }

  _pickDecoy(excludeId) {
    const others = this.engine.state.players.filter(p => p.id !== excludeId && p.status === 'alive')
    if (others.length === 0) return null
    return others[Math.floor(Math.random() * others.length)]
  }
}
