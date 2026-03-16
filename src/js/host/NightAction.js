/**
 * H-04 NightAction — 밤 역할 처리
 * 역할별로 InfoPanel 또는 SelectPanel을 렌더링
 */
import { mountInfoPanel }          from '../components/InfoPanel.js'
import { mountOvalSelectPanel }     from '../components/OvalSelectPanel.js'
import { mountHostDecisionPanel }   from '../components/HostDecisionPanel.js'
import { mountSpyModeSelector, mountSpyGrimoirePanel } from '../components/SpyGrimoirePanel.js'
import { mountBluffSelectPanel }    from '../components/BluffSelectPanel.js'
import { mountDemonBluffPanel }     from '../components/DemonBluffPanel.js'
import { NightAdvisor }             from './NightAdvisor.js'
import { DemonBluffAdvisor }        from './DemonBluffAdvisor.js'
import { ROLES_BY_ID } from '../data/roles-tb.js'
import { ThemeManager } from '../ThemeManager.js'

export class NightAction {
  constructor({ engine, onStepDone }) {
    this.engine        = engine
    this.onStepDone    = onStepDone
    this._unmount      = null
    this._advisor      = new NightAdvisor()
    this._bluffAdvisor = new DemonBluffAdvisor()
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
    this._overlayEl = null
    this.onStepDone && this.onStepDone(step, targetIds)
  }

  /** mount 함수 호출 후 오버레이 요소 추적 */
  _trackOverlay(mountFn) {
    const before = document.body.lastElementChild
    const unmount = mountFn()
    const after = document.body.lastElementChild
    this._overlayEl = (after !== before) ? after : null
    return unmount
  }

  /** 오버레이 숨기기 (탭 전환 시) */
  hideOverlay() {
    if (this._overlayEl) this._overlayEl.style.display = 'none'
  }

  /** 오버레이 다시 보이기 (role 탭 복귀 시) */
  showOverlay() {
    if (this._overlayEl) this._overlayEl.style.display = ''
  }

  // 번호 포맷 헬퍼
  _toNum(p) { return `${p.id}번` }

  // ── 미니언 공개 ──
  _showMinionInfo(minions) {
    if (!minions || minions.length === 0) { this._done('minion-info'); return }
    const demonPlayers = this.engine.state.players.filter(p => p.role === 'imp')
    const minionNums = minions.map(p => `${this._toNum(p)}(${ROLES_BY_ID[p.role]?.name})`).join(', ')
    const demonNums  = demonPlayers.map(p => this._toNum(p)).join(', ') || '?'

    // 블러프는 demon-info에서 선택되므로 미니언 공개 시점엔 표시 안 함
    this._unmount = this._trackOverlay(() => mountInfoPanel({
      title:    '미니언 공개',
      roleIcon: 'minion.png',
      message:  `미니언: ${minionNums}\n임프: ${demonNums}`,
      players:  [...minions, ...demonPlayers],
      revealData: {
        roleIcon: 'minion.png',
        roleName: '미니언 공개',
        roleTeam: 'minion',
        message:  `임프: ${demonNums}\n동료 미니언: ${minions.map(p => this._toNum(p)).join(', ') || '없음'}`,
        players:  [...minions, ...demonPlayers].map(p => ({ id: p.id })),
        hint:     '당신의 동료들이 공개됩니다 — 함께하는 미니언 자리번호와 임프 자리번호를 확인하세요. 낮에는 서로 모르는 척 행동해야 합니다.',
        action:   '번호를 모두 기억한 뒤 눈을 감고 손을 내려주세요.',
      },
      onConfirm: () => this._done('minion-info'),
    }))
  }

  // ── 임프 정보 ──
  _showDemonInfo(demons) {
    if (!demons || demons.length === 0) { this._done('demon-info'); return }

    // 이미 블러프가 선택돼 있으면 선택 단계 스킵 (재진입 방어)
    if (this.engine.getBluffs().length === 3) {
      this._showDemonInfoPanel(demons)
      return
    }

    // 바로 직접 선택 — BluffSelectPanel
    const pool = this.engine.getBluffPool()
    const drunkPlayer = this.engine.state.players.find(p => p.role === 'drunk' && p.drunkAs)
    const drunkAsRoleId = drunkPlayer?.drunkAs || null

    this._unmount = this._trackOverlay(() => mountBluffSelectPanel({
      pool,
      drunkAsRoleId,
      onConfirm: (selectedBluffs) => {
        this.engine.setBluffs(selectedBluffs)
        this._showDemonInfoPanel(demons)
      },
    }))
  }

  _showDemonInfoPanel(demons) {
    const minions = this.engine.state.players.filter(p =>
      ['poisoner','spy','scarletwoman','baron'].includes(p.role)
    )
    const bluffs = this.engine.getBluffs()
    const bluffText = bluffs.map(r => r.name).join(', ')
    const minionNums = minions.map(p => `${this._toNum(p)}(${ROLES_BY_ID[p.role]?.name})`).join(', ') || '없음'

    this._unmount = this._trackOverlay(() => mountInfoPanel({
      title:    '임프 정보',
      roleIcon: 'imp.png',
      message:  `미니언: ${minionNums}\n블러프 3개: ${bluffText}`,
      players:  minions,
      revealData: {
        roleIcon: 'imp.png',
        roleName: '임프 정보',
        roleTeam: 'demon',
        message:  `미니언: ${minions.map(p => this._toNum(p)).join(', ') || '없음'}\n블러프: ${bluffText}`,
        players:  minions.map(p => ({ id: p.id })),
        hint:     '당신은 악 팀 임프입니다 — 미니언 자리번호와, 들키지 않고 사칭할 수 있는 선 역할 3개를 알려줍니다. 블러프 역할 중 하나인 척 행동하면 선 팀이 당신을 찾기 어렵습니다.',
        action:   '미니언 번호와 블러프 역할 3개를 모두 기억한 뒤 눈을 감고 손을 내려주세요.',
      },
      onConfirm: () => this._done('demon-info'),
    }))
  }

  // ── 스파이 (그리모어 열람) ──
  _showSpyInfo(spies) {
    if (!spies || spies.length === 0) { this._done('spy'); return }
    const allPlayers = this.engine.state.players

    // ① 호스트가 공개 방식 선택 (모두/반/셔플)
    this._unmount = this._trackOverlay(() => mountSpyModeSelector({
      players: allPlayers,
      onSelected: (mode) => {
        // ② 선택된 방식으로 오발 그리모어 공개 (참가자 화면)
        ThemeManager.pushTemp('player')
        this._unmount = this._trackOverlay(() => mountSpyGrimoirePanel({
          players: allPlayers,
          mode,
          onNext: () => { ThemeManager.popTemp(); this._done('spy') },
        }))
      },
    }))
  }

  // ── 정보 전달 역할 ──
  _showRoleInfo(roleId, actors) {
    if (!actors || actors.length === 0) { this._done(roleId); return }
    const actor     = actors[0]
    const role      = ROLES_BY_ID[roleId]
    const isPoisoned = actor.isPoisoned || actor.isDrunk

    // 항상 정확한 값 계산 (호스트 참고용)
    const realAccurate = this._calcAccurateValue(roleId, actor)

    this.engine.recordNightAction(roleId, actor.id, [], String(realAccurate))

    // 직접 선택 옵션
    const customType = ['empath','chef'].includes(roleId) ? 'number'
      : ['washerwoman','librarian','investigator','undertaker'].includes(roleId) ? 'player-pick'
      : 'number'

    const options = [{
      id:          'custom',
      icon:        '✏️',
      label:       '직접 선택',
      preview:     '호스트가 직접 결정',
      impact:      '',
      stateReason: '',
      recommended: false,
      revealData:  null,
      customType,
    }]

    this._unmount = this._trackOverlay(() => mountHostDecisionPanel({
      roleId,
      actorSeatId: actor.id,
      roleName:    role?.name || roleId,
      roleIcon:    role?.icon || '?',
      roleIconEmoji: role?.iconEmoji || '',
      roleTeam:    role?.team || null,
      roleAbility: role?.ability || '',
      accurateValue: realAccurate,
      isPoisoned,
      analysis:    { goodCount: 0, evilCount: 0, balanceTag: '', infoCount: 0, riskLabel: '' },
      options,
      players:     this.engine.state.players,
      onDecide: (chosen) => {
        const finalRevealData = chosen.revealData || null
        const finalMessage    = chosen.preview || String(realAccurate)

        this._unmount = this._trackOverlay(() => mountInfoPanel({
          title:      role?.name || roleId,
          roleIcon:   role?.icon || '?',
          message:    finalMessage,
          players:    [],
          revealData: finalRevealData,
          onConfirm:  () => this._done(roleId),
        }))
      },
    }))
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
      case 'undertaker': return null
      case 'washerwoman': {
        const alive = this.engine.state.players.filter(p => p.status === 'alive')
        if (alive.length < 2) return null
        const tfIds = ['washerwoman','librarian','investigator','chef','empath','fortuneteller',
          'undertaker','monk','ravenkeeper','virgin','slayer','soldier','mayor']
        const randomRoleId = tfIds[Math.floor(Math.random() * tfIds.length)]
        const shuffled = [...alive].sort(() => Math.random() - 0.5)
        return { roleId: randomRoleId, players: [shuffled[0], shuffled[1]] }
      }
      case 'librarian': {
        const alive = this.engine.state.players.filter(p => p.status === 'alive')
        if (alive.length < 2) return null
        const outIds = ['butler','drunk','recluse','saint']
        const randomRoleId = outIds[Math.floor(Math.random() * outIds.length)]
        const shuffled = [...alive].sort(() => Math.random() - 0.5)
        return { roleId: randomRoleId, players: [shuffled[0], shuffled[1]] }
      }
      case 'investigator': {
        const alive = this.engine.state.players.filter(p => p.status === 'alive')
        if (alive.length < 2) return null
        const minIds = ['poisoner','spy','scarletwoman','baron']
        const randomRoleId = minIds[Math.floor(Math.random() * minIds.length)]
        const shuffled = [...alive].sort(() => Math.random() - 0.5)
        return { roleId: randomRoleId, players: [shuffled[0], shuffled[1]] }
      }
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

    ThemeManager.pushTemp('player')  // 참가자 지목 화면 → 참가자 테마
    this._unmount = this._trackOverlay(() => mountOvalSelectPanel({
      title:      role?.name || roleId,
      roleIcon:   role?.icon || '?',
      roleTeam:   role?.team || null,
      ability:    role?.ability || '',
      players:    selectablePlayers,
      selfSeatId: actor.id,
      maxSelect:  role?.maxSelect || 1,
      onConfirm: (ids) => {
        ThemeManager.popTemp()  // 호스트 테마 복원
        this.engine.recordNightAction(roleId, actor.id, ids)

        // Fortune Teller: 정보 계산 후 RevealPanel 포함 InfoPanel 표시
        if (roleId === 'fortuneteller' && ids.length === 2) {
          const result = this.engine.calcFortuneTellerInfo(actor.id, ids)
          const msg    = result ? '✅ 예, 그 중 한 명은 임프입니다' : '❌ 아니오, 임프가 없습니다'
          mountInfoPanel({
            title:    '점쟁이 결과',
            roleIcon: 'fortuneteller.png',
            message:  msg,
            players:  ids.map(id => this.engine.getPlayer(id)).filter(Boolean),
            revealData: {
              roleIcon: 'fortuneteller.png',
              roleName: '점쟁이 결과',
              roleTeam: 'town',
              message:  msg,
              players:  ids.map(id => ({ id })),
              hint:     '당신 능력이 발동됐습니다 — 방금 지목한 두 자리 중 임프가 있는지 알려줍니다. 예/아니오를 기억해 낮에 추리에 활용하세요.',
              action:   '결과를 기억한 뒤 눈을 감고 손을 내려주세요.',
            },
            onConfirm: () => this._done(roleId, ids),
          })
        } else {
          this._done(roleId, ids)
        }
      }
    }))
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
