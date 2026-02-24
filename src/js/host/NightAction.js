/**
 * H-04 NightAction — 밤 역할 처리
 * 역할별로 InfoPanel 또는 SelectPanel을 렌더링
 */
import { mountInfoPanel } from '../components/InfoPanel.js'
import { mountSelectPanel } from '../components/SelectPanel.js'
import { ROLES_BY_ID } from '../data/roles-tb.js'

export class NightAction {
  constructor({ engine, onStepDone }) {
    this.engine = engine
    this.onStepDone = onStepDone
    this._unmount = null
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

  // ── 미니언 공개 ──
  _showMinionInfo(minions) {
    if (!minions || minions.length === 0) { this._done('minion-info'); return }
    const demonPlayers = this.engine.state.players.filter(p => p.role === 'imp')
    const bluffs = this.engine.getBluffs()
    const bluffText = bluffs.map(r => `${r.icon} ${r.name}`).join(', ')

    const minionNames = minions.map(p => `${p.name}(${ROLES_BY_ID[p.role]?.name})`).join(', ')
    const demonName = demonPlayers.map(p => p.name).join(', ') || '?'

    this._unmount = mountInfoPanel({
      title: '미니언 공개',
      roleIcon: '🎭',
      message: `미니언: ${minionNames}\n데몬: ${demonName}\n블러프: ${bluffText || '없음'}`,
      players: [...minions, ...demonPlayers],
      onConfirm: () => this._done('minion-info'),
    })
  }

  // ── 데몬 정보 ──
  _showDemonInfo(demons) {
    if (!demons || demons.length === 0) { this._done('demon-info'); return }
    const minions = this.engine.state.players.filter(p =>
      ['poisoner','spy','scarletwoman','baron'].includes(p.role)
    )
    const bluffs = this.engine.getBluffs()
    const bluffText = bluffs.map(r => `${r.icon} ${r.name}`).join(', ')
    const minionText = minions.map(p => `${p.name}(${ROLES_BY_ID[p.role]?.name})`).join(', ') || '없음'

    this._unmount = mountInfoPanel({
      title: '데몬 정보',
      roleIcon: '👿',
      message: `미니언: ${minionText}\n블러프 3개: ${bluffText}`,
      players: minions,
      onConfirm: () => this._done('demon-info'),
    })
  }

  // ── 스파이 (그리모어 열람) ──
  _showSpyInfo(spies) {
    if (!spies || spies.length === 0) { this._done('spy'); return }
    const allInfo = this.engine.state.players.map(p => {
      const role = ROLES_BY_ID[p.role]
      return `${p.id}. ${p.name}: ${role?.icon || '?'} ${role?.name || p.role} (${p.team === 'good' ? '선' : '악'})`
    }).join('\n')

    this._unmount = mountInfoPanel({
      title: '스파이 — 그리모어',
      roleIcon: '🕵️',
      message: allInfo,
      players: [],
      onConfirm: () => this._done('spy'),
    })
  }

  // ── 정보 전달 역할 ──
  _showRoleInfo(roleId, actors) {
    if (!actors || actors.length === 0) { this._done(roleId); return }
    const actor = actors[0]
    const role = ROLES_BY_ID[roleId]
    const isPoisoned = actor.isPoisoned || actor.isDrunk

    let message = ''
    let relatedPlayers = []

    if (roleId === 'empath') {
      const count = isPoisoned ? Math.floor(Math.random() * 3) : this.engine.calcEmpathInfo(actor.id)
      message = `양옆 이웃 중 악 플레이어: ${count}명`
    } else if (roleId === 'chef') {
      const count = isPoisoned ? Math.floor(Math.random() * 5) : this.engine.calcChefInfo()
      message = `이웃한 악 플레이어 쌍: ${count}쌍`
    } else if (roleId === 'undertaker') {
      const info = this.engine.calcUndertakerInfo()
      if (!info) { message = '어젯밤 처형자 없음' }
      else {
        const r = ROLES_BY_ID[info.roleId]
        const p = this.engine.getPlayer(info.playerId)
        message = `어젯밤 처형: ${p?.name || '?'} → ${r?.icon || ''} ${r?.name || info.roleId}`
        if (p) relatedPlayers = [p]
      }
    } else if (roleId === 'washerwoman') {
      const target = this._pickRandomTownsfolk()
      if (target) {
        const decoy = this._pickDecoy(target.playerId)
        const r = ROLES_BY_ID[target.roleId]
        message = `다음 중 한 명이 ${r?.icon || ''} ${r?.name || target.roleId}입니다`
        relatedPlayers = [target.player, decoy].filter(Boolean)
      } else message = '정보 없음'
    } else if (roleId === 'librarian') {
      const outsiders = this.engine.state.players.filter(p => ['butler','drunk','recluse','saint'].includes(p.role) && p.status === 'alive')
      if (outsiders.length === 0) { message = '이번 게임에 아웃사이더 없음' }
      else {
        const target = outsiders[Math.floor(Math.random() * outsiders.length)]
        const decoy = this._pickDecoy(target.id)
        const r = ROLES_BY_ID[target.role]
        message = `다음 중 한 명이 ${r?.icon || ''} ${r?.name || target.role}입니다`
        relatedPlayers = [target, decoy].filter(Boolean)
      }
    } else if (roleId === 'investigator') {
      const minions = this.engine.state.players.filter(p =>
        ['poisoner','spy','scarletwoman','baron'].includes(p.role) && p.status === 'alive'
      )
      if (minions.length === 0) { message = '미니언 정보 없음' }
      else {
        const target = minions[Math.floor(Math.random() * minions.length)]
        const decoy = this._pickDecoy(target.id)
        const r = ROLES_BY_ID[target.role]
        message = `다음 중 한 명이 ${r?.icon || ''} ${r?.name || target.role}입니다`
        relatedPlayers = [target, decoy].filter(Boolean)
      }
    } else {
      message = `${role?.name || roleId} 정보 전달`
    }

    this.engine.recordNightAction(roleId, actor.id, [], message)

    this._unmount = mountInfoPanel({
      title: role?.name || roleId,
      roleIcon: role?.icon || '?',
      message: isPoisoned ? `(중독/취함) ${message}` : message,
      players: relatedPlayers,
      onConfirm: () => this._done(roleId),
    })
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

    this._unmount = mountSelectPanel({
      title: role?.name || roleId,
      roleIcon: role?.icon || '?',
      players: selectablePlayers,
      maxSelect: role?.maxSelect || 1,
      onConfirm: (ids) => {
        this.engine.recordNightAction(roleId, actor.id, ids)

        // Fortune Teller: 정보 계산 후 InfoPanel 표시
        if (roleId === 'fortuneteller' && ids.length === 2) {
          const result = this.engine.calcFortuneTellerInfo(actor.id, ids)
          const p1 = this.engine.getPlayer(ids[0])
          const p2 = this.engine.getPlayer(ids[1])
          const r = ROLES_BY_ID[role.id]
          mountInfoPanel({
            title: '점술사 결과',
            roleIcon: '🔮',
            message: result ? '✅ 예, 그 중 한 명은 데몬입니다' : '❌ 아니오, 데몬이 없습니다',
            players: [p1, p2].filter(Boolean),
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
