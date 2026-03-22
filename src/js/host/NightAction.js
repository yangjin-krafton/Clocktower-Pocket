/**
 * H-04 NightAction — 밤 역할 처리
 * 역할별로 InfoPanel 또는 SelectPanel을 렌더링
 */
import { mountNightRevealNote }     from '../components/NightRevealNote.js'
import { mountOvalSelectPanel }     from '../components/OvalSelectPanel.js'
import { loadNightMessages, getTemplate, fillTemplate } from '../data/NightMessages.js'
import { mountSpyGrimoirePanel } from '../components/SpyGrimoirePanel.js'
import { mountBluffSelectPanel }    from '../components/BluffSelectPanel.js'
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
    loadNightMessages()  // 밤 시작 전에 미리 로드
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
    } else if (step === 'mayor-bounce') {
      this._showMayorBounce()
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

  // 중독 / 취함 경고 (호스트 전용 패널용)
  _hostWarning(actor) {
    const p = actor?.isPoisoned, d = actor?.isDrunk
    if (p && d) return '☠ 중독 + 🍾 취함 — 능력 무효화'
    if (p)      return '☠ 중독됨 — 능력이 무효화됩니다'
    if (d)      return '🍾 취함 — 능력이 무효화됩니다'
    return null
  }

  // ── 미니언 공개 ──
  _showMinionInfo(minions) {
    if (!minions || minions.length === 0) { this._done('minion-info'); return }
    const demonPlayers = this.engine.state.players.filter(p => p.role === 'imp')
    const minionLines = minions.map(p => `${this._toNum(p)} (${ROLES_BY_ID[p.role]?.name})`).join('\n')
    const demonNums   = demonPlayers.map(p => this._toNum(p)).join(', ') || '?'

    const minionTmpl = getTemplate('minion-reveal')
    const minionMsg = minionTmpl
      ? fillTemplate(minionTmpl, { 임프번호: demonNums, 미니언목록: minionLines })
      : `임프: ${demonNums}\n\n동료:\n${minionLines}\n\n번호를 모두 기억한 뒤 눈을 감으세요.`

    ThemeManager.pushTemp('player')
    this._unmount = this._trackOverlay(() => mountNightRevealNote({
      roleIcon: 'minion.png',
      roleName: '미니언 공개',
      roleTeam: 'minion',
      message:  minionMsg,
      onBack:   () => { ThemeManager.popTemp(); this._showMinionInfo(minions) },
      onNext:   () => { ThemeManager.popTemp(); this._done('minion-info') },
    }))
  }

  // ── 임프 정보 ──
  _showDemonInfo(demons) {
    if (!demons || demons.length === 0) { this._done('demon-info'); return }

    // 이미 블러프가 선택돼 있으면 선택 단계 스킵 (재진입 방어)
    if (this.engine.getBluffs().length === 3) {
      this._showDemonInfoPanel()
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
        this._showDemonInfoPanel()
      },
    }))
  }

  _showDemonInfoPanel() {
    const minions = this.engine.state.players.filter(p =>
      ['poisoner','spy','scarletwoman','baron'].includes(p.role)
    )
    const bluffs = this.engine.getBluffs()
    const bluffLines  = bluffs.map(r => r.name).join('\n')
    const minionLines = minions.length > 0
      ? minions.map(p => `${this._toNum(p)} (${ROLES_BY_ID[p.role]?.name})`).join('\n')
      : '없음'

    const demonTmpl = getTemplate('demon-reveal')
    const demonMsg = demonTmpl
      ? fillTemplate(demonTmpl, { 미니언목록: minionLines, 블러프목록: bluffLines })
      : `미니언:\n${minionLines}\n\n블러프:\n${bluffLines}\n\n모두 기억한 뒤 눈을 감으세요.`

    ThemeManager.pushTemp('player')
    this._unmount = this._trackOverlay(() => mountNightRevealNote({
      roleIcon: 'imp.png',
      roleName: '임프 정보',
      roleTeam: 'demon',
      message:  demonMsg,
      onBack:   () => { ThemeManager.popTemp(); this._showDemonInfoPanel() },
      onNext:   () => { ThemeManager.popTemp(); this._done('demon-info') },
    }))
  }

  // ── 스파이 (그리모어 열람) ──
  _showSpyInfo(spies) {
    if (!spies || spies.length === 0) { this._done('spy'); return }
    const allPlayers = this.engine.state.players

    const spyActor = spies[0]
    this._unmount = this._trackOverlay(() => mountSpyGrimoirePanel({
      players:     allPlayers,
      engine:      this.engine,
      hostWarning: this._hostWarning(spyActor),
      onReveal:    () => ThemeManager.pushTemp('player'),
      onBack:      () => { this._unmount = null },
      onNext:      () => { ThemeManager.popTemp(); this._done('spy') },
    }))
  }

  // ── 시장 튕김 대상 선택 ──
  _showMayorBounce() {
    const state      = this.engine.state
    const mayorId    = state.nightOrder && (() => {
      const impAction = this.engine.nightActions
        .filter(a => a.round === state.round && a.roleId === 'imp').pop()
      return impAction?.targetIds?.[0] ?? null
    })()
    const impAction  = this.engine.nightActions
      .filter(a => a.round === state.round && a.roleId === 'imp').pop()
    const impId      = impAction?.actorId ?? null

    // 시장·임프 제외 생존자 = 튕김 후보
    const candidates = state.players.filter(
      p => p.status === 'alive' && p.id !== mayorId && p.id !== impId
    )

    this._unmount = this._trackOverlay(() => mountOvalSelectPanel({
      title:      '시장 튕김',
      roleIcon:   'mayor.png',
      roleTeam:   'town',
      ability:    '임프 공격이 시장을 노렸습니다. 공격이 튕길 대상을 선택하세요.\n군인을 선택하면 아무도 사망하지 않습니다.',
      players:    candidates,
      selfSeatId: null,
      maxSelect:  1,
      hostWarning: null,
      engine:     this.engine,
      onConfirm: (ids) => {
        this.engine.recordMayorBounce(ids[0] ?? null)
        this._done('mayor-bounce', ids)
      },
    }))
  }

  // ── 정보 전달 역할 ──
  _showRoleInfo(roleId, actors) {
    if (!actors || actors.length === 0) { this._done(roleId); return }
    const actor = actors[0]

    // 자리 2개 선택 후 정보 공개가 필요한 역할
    if (['washerwoman', 'librarian', 'investigator'].includes(roleId)) {
      this._showRoleInfoWithSeatSelect(roleId, actor)
      return
    }

    const role = ROLES_BY_ID[roleId]
    const affected    = actor.isPoisoned || actor.isDrunk
    const realAccurate = affected
      ? this._calcFalseValue(roleId)
      : this._calcAccurateValue(roleId, actor)
    this.engine.recordNightAction(roleId, actor.id, [], String(realAccurate))

    ThemeManager.pushTemp('player')
    this._unmount = this._trackOverlay(() => mountNightRevealNote({
      roleIcon: role?.icon || '?',
      roleName: role?.name || roleId,
      roleTeam: role?.team || null,
      message:  this._generateInfoMessage(roleId, realAccurate),
      onBack:   () => { ThemeManager.popTemp(); this._showRoleInfo(roleId, actors) },
      onNext:   () => { ThemeManager.popTemp(); this._done(roleId) },
    }))
  }

  // ── 자리 선택 → 정보 공개 (세탁부 / 사서 / 조사관) ──
  _showRoleInfoWithSeatSelect(roleId, actor) {
    const role = ROLES_BY_ID[roleId]

    // OvalSelectPanel 은 호스트 테마 유지
    this._unmount = this._trackOverlay(() => mountOvalSelectPanel({
      title:       role?.name || roleId,
      roleIcon:    role?.icon || '?',
      roleTeam:    role?.team || null,
      ability:     role?.ability || '',
      players:     this.engine.state.players,
      selfSeatId:  actor.id,
      maxSelect:   2,
      hostWarning: this._hostWarning(actor),
      engine:      this.engine,
      onBack:      () => { this._unmount = null },
      onConfirm: (ids) => {
        const affected = actor.isPoisoned || actor.isDrunk
        const value = affected
          ? this._calcFalseValue(roleId, ids)
          : this._calcValueFromSelectedSeats(roleId, ids)
        this.engine.recordNightAction(roleId, actor.id, ids, String(value))

        // NightRevealNote 직전에 플레이어 테마 전환
        ThemeManager.pushTemp('player')
        this._unmount = this._trackOverlay(() => mountNightRevealNote({
          roleIcon: role?.icon || '?',
          roleName: role?.name || roleId,
          roleTeam: role?.team || null,
          message:  this._generateInfoMessage(roleId, value),
          onBack:   () => { ThemeManager.popTemp(); this._showRoleInfoWithSeatSelect(roleId, actor) },
          onNext:   () => { ThemeManager.popTemp(); this._done(roleId) },
        }))
      },
    }))
  }

  /** 선택된 2자리 기반으로 공개 값 계산 */
  _calcValueFromSelectedSeats(roleId, ids) {
    const selected = ids.map(id => this.engine.getPlayer(id)).filter(Boolean)
    switch (roleId) {
      case 'washerwoman': {
        const tfRoles = ['washerwoman','librarian','investigator','chef','empath','fortuneteller',
          'undertaker','monk','ravenkeeper','virgin','slayer','soldier','mayor']
        const target = selected.find(p => tfRoles.includes(p.role))
        if (!target) return null
        return { roleId: target.role, players: selected }
      }
      case 'librarian': {
        const target = selected.find(p => ['butler','drunk','recluse','saint'].includes(p.role))
        if (!target) return { roleId: null, players: selected, noOutsider: true }
        return { roleId: target.role, players: selected }
      }
      case 'investigator': {
        const target = selected.find(p => ['poisoner','spy','scarletwoman','baron'].includes(p.role))
        if (!target) return null
        return { roleId: target.role, players: selected }
      }
      default: return null
    }
  }

  /** 정보 역할 메시지 생성 (MD 템플릿 우선, 없으면 하드코딩 폴백) */
  _generateInfoMessage(roleId, value) {
    switch (roleId) {
      case 'empath': {
        const tmpl = getTemplate('empath')
        return tmpl
          ? fillTemplate(tmpl, { N: value ?? 0 })
          : `양옆으로 악 플레이어가 ${value ?? 0}명 있습니다.\n\n확인했으면 눈을 감으세요.`
      }
      case 'chef': {
        const tmpl = getTemplate('chef')
        return tmpl
          ? fillTemplate(tmpl, { N: value ?? 0 })
          : `이웃한 악 플레이어 쌍이 ${value ?? 0}쌍 있습니다.\n\n확인했으면 눈을 감으세요.`
      }
      case 'undertaker': {
        if (!value) {
          const tmpl = getTemplate('undertaker-no-execution')
          return tmpl ?? '어젯밤 아무도 처형되지 않았습니다.\n\n눈을 감으세요.'
        }
        const r = ROLES_BY_ID[value.roleId]
        const tmpl = getTemplate('undertaker')
        return tmpl
          ? fillTemplate(tmpl, { 역할명: r?.name || value.roleId })
          : `어젯밤 처형된 플레이어는 ${r?.name || value.roleId}이었습니다.\n\n확인했으면 눈을 감으세요.`
      }
      case 'washerwoman':
      case 'librarian':
      case 'investigator': {
        if (!value) return getTemplate(roleId) ?? '확인했으면 눈을 감으세요.'
        if (value.noOutsider) {
          const tmpl = getTemplate('librarian-no-outsider')
          return tmpl ?? '이 마을에는 아웃사이더가 없습니다.\n\n확인했으면 눈을 감으세요.'
        }
        const r = ROLES_BY_ID[value.roleId]
        const players = value.players || []
        const [A, B] = players.map(p => p.id)
        const tmpl = getTemplate(roleId)
        return tmpl
          ? fillTemplate(tmpl, { A: A ?? '?', B: B ?? '?', 역할명: r?.name || value.roleId })
          : `${A ?? '?'}번, ${B ?? '?'}번 중 한 명이 ${r?.name || value.roleId}입니다.\n\n확인했으면 눈을 감으세요.`
      }
      default: return '확인했으면 눈을 감으세요.'
    }
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
        if (!outsiders.length) return { roleId: null, players: [], noOutsider: true }
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

  // ── 선택 역할 ──
  _showRoleSelect(roleId, actors) {
    if (!actors || actors.length === 0) { this._done(roleId); return }
    const actor = actors[0]
    const role = ROLES_BY_ID[roleId]

    // 선택 가능 대상 필터 (사망/처형 슬롯은 오발에 유지, 클릭만 불가)
    let selectablePlayers = this.engine.state.players
    if (roleId === 'monk') {
      selectablePlayers = selectablePlayers.filter(p => p.id !== actor.id)
    }

    // OvalSelectPanel 은 호스트 테마 유지
    this._unmount = this._trackOverlay(() => mountOvalSelectPanel({
      title:       role?.name || roleId,
      roleIcon:    role?.icon || '?',
      roleTeam:    role?.team || null,
      ability:     role?.ability || '',
      players:     selectablePlayers,
      selfSeatId:  actor.id,
      maxSelect:   role?.maxSelect || 1,
      hostWarning: this._hostWarning(actor),
      engine:      this.engine,
      onBack:      () => { this._unmount = null },
      onConfirm: (ids) => {
        this.engine.recordNightAction(roleId, actor.id, ids)

        const msg = this._generateSelectMessage(roleId, actor, ids)
        if (msg) {
          // NightRevealNote 직전에 플레이어 테마 전환
          ThemeManager.pushTemp('player')
          this._unmount = this._trackOverlay(() => mountNightRevealNote({
            roleIcon: role?.icon || '?',
            roleName: role?.name || roleId,
            roleTeam: role?.team || null,
            message:  msg,
            onBack:   () => { ThemeManager.popTemp(); this._showRoleSelect(roleId, actors) },
            onNext:   () => { ThemeManager.popTemp(); this._done(roleId, ids) },
          }))
        } else {
          this._done(roleId, ids)
        }
      }
    }))
  }

  /** 선택 역할 메시지 생성 (공개 필요 없으면 null) */
  _generateSelectMessage(roleId, actor, ids) {
    switch (roleId) {
      case 'fortuneteller': {
        if (ids.length !== 2) return null
        const affected = actor.isPoisoned || actor.isDrunk
        const result = affected
          ? Math.random() < 0.5
          : this.engine.calcFortuneTellerInfo(actor.id, ids)
        const key = result ? 'fortuneteller-yes' : 'fortuneteller-no'
        const tmpl = getTemplate(key)
        if (tmpl) return tmpl
        return result
          ? '예, 그 중 한 명은 임프입니다.\n\n확인했으면 눈을 감으세요.'
          : '아니오, 임프가 없습니다.\n\n눈을 감으세요.'
      }
      case 'monk': {
        const tmpl = getTemplate('monk')
        return tmpl
          ? fillTemplate(tmpl, { X: ids[0] })
          : `오늘 밤 ${ids[0]}번을 보호합니다.\n\n확인했으면 눈을 감으세요.`
      }
      case 'butler': {
        const tmpl = getTemplate('butler')
        return tmpl
          ? fillTemplate(tmpl, { X: ids[0] })
          : `오늘 밤 ${ids[0]}번이 당신의 주인입니다.\n\n확인했으면 눈을 감으세요.`
      }
      case 'ravenkeeper': {
        if (!ids[0]) return null
        const affected = actor.isPoisoned || actor.isDrunk
        const target = this.engine.getPlayer(ids[0])
        const trueRoleId = (target?.role === 'drunk' && target?.drunkAs) ? target.drunkAs : target?.role
        const allRoleIds = Object.keys(ROLES_BY_ID)
        const displayRoleId = affected
          ? allRoleIds[Math.floor(Math.random() * allRoleIds.length)]
          : trueRoleId
        const displayRole = ROLES_BY_ID[displayRoleId]
        const tmpl = getTemplate('ravenkeeper')
        return tmpl
          ? fillTemplate(tmpl, { X: ids[0], 역할명: displayRole?.name || displayRoleId || '?' })
          : `${ids[0]}번의 역할은 ${displayRole?.name || displayRoleId || '?'}입니다.\n\n확인했으면 눈을 감으세요.`
      }
      default: return null  // poisoner, imp 등 — 공개 불필요
    }
  }

  /** 중독/취함 상태 오정보 값 생성 */
  _calcFalseValue(roleId, selectedIds = []) {
    const pick = arr => arr[Math.floor(Math.random() * arr.length)]
    const sel  = selectedIds.map(id => this.engine.getPlayer(id)).filter(Boolean)
    switch (roleId) {
      case 'empath':     return Math.floor(Math.random() * 3)
      case 'chef':       return Math.floor(Math.random() * 4)
      case 'undertaker': return { roleId: pick(Object.keys(ROLES_BY_ID)) }
      case 'washerwoman':
        return { roleId: pick(['washerwoman','librarian','investigator','chef','empath',
          'fortuneteller','undertaker','monk','ravenkeeper','virgin','slayer','soldier','mayor']), players: sel }
      case 'librarian':
        return { roleId: pick(['butler','drunk','recluse','saint']), players: sel }
      case 'investigator':
        return { roleId: pick(['poisoner','spy','scarletwoman','baron']), players: sel }
      default: return null
    }
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
