/**
 * H-03 Grimoire — 메인 상태판
 *
 * phase === 'lobby' : 입장 대기 화면 (참가자 현황 + 설정 + 게임 시작 버튼)
 * phase === 'night' : 밤 진행
 * phase === 'day'   : 낮 진행
 */
import { renderPhaseHeader }    from '../components/PhaseHeader.js'

import { renderNightOrderList } from '../components/NightOrderList.js'
import { renderLogList }        from '../components/LogEntry.js'
import { ROLES_BY_ID, ROLES_TB, PLAYER_COUNTS } from '../data/roles-tb.js'
import { RulesScreen }          from '../components/RulesScreen.js'
import { CharacterDict }        from '../player/CharacterDict.js'
import { formatCode, copyRoomCode, copyRoomLink } from '../room-code.js'
import { calcOvalLayout, ovalSlotPos, drawOvalPieNumbers } from '../utils/ovalLayout.js'
import { TEAM_BORDER, createSeatOval, createSeatSlot, createRoleIconEl, createRoleNameLabel } from '../utils/SeatWheel.js'
import { applySetupSlotMarks } from '../utils/SlotMark.js'

// 패시브 능력을 가진 역할 (게임 시작 시 자동 발동)
const PASSIVE_ABILITY_ROLES = ['baron', 'drunk', 'recluse', 'saint']

// 첫날 밤 능력을 가진 역할
const FIRST_NIGHT_ROLES = ['washerwoman', 'librarian', 'investigator', 'chef', 'empath', 'fortuneteller', 'butler', 'poisoner', 'spy', 'baron']

export class Grimoire {
  /**
   * @param {Object}   opts.engine
   * @param {Function} opts.getLobbyConfig      () => { playerCount, seatRoles[], roomCode }
   * @param {Function} opts.onStartGame
   * @param {Function} opts.onPlayerCountChange (n) => void
   * @param {Function} opts.onSeatRoleAssign    (seatIdx, roleId|null) => void
   * @param {Function} opts.onAutoAssign        () => void
   */
  constructor({
    engine,
    getLobbyConfig,
    onStartGame,
    onStartNight, onStartDay, onNextNightStep, onPlayerAction,
    onPlayerCountChange,
    onSeatRoleAssign,
    onDrunkAsChange,
    onAutoAssign,
    onAddTraveller,
  }) {
    this.engine              = engine
    this.getLobbyConfig      = getLobbyConfig     || (() => ({ playerCount: 7, seatRoles: [], roomCode: null }))
    this.onStartGame         = onStartGame        || null
    this.onStartNight        = onStartNight       || null
    this.onStartDay          = onStartDay         || null
    this.onNextNightStep     = onNextNightStep     || null
    this.onPlayerAction      = onPlayerAction     || null
    this.onPlayerCountChange = onPlayerCountChange|| null
    this.onSeatRoleAssign    = onSeatRoleAssign   || null
    this.onDrunkAsChange     = onDrunkAsChange    || null
    this.onAutoAssign        = onAutoAssign       || null
    this.onAddTraveller      = onAddTraveller     || null
    this.el                       = null
    this._selectedSeat            = null   // 로비에서 선택된 자리 인덱스 (0-based)
    this._playerSectionCollapsed  = false  // 게임 중 플레이어 섹션 접힘 상태
    this._resizeObs               = null   // 화면 크기 변화 감지
  }

  mount(container) {
    this.el = document.createElement('div')
    this.el.className = 'grimoire-screen'
    this._render()
    container.appendChild(this.el)

    // 화면 크기 변화 시 로비 오발 재렌더링
    const appContent = document.getElementById('app-content')
    if (appContent && !this._resizeObs) {
      this._resizeObs = new ResizeObserver(() => {
        if (this.engine.state.phase === 'lobby') this._render()
      })
      this._resizeObs.observe(appContent)
    }
  }

  unmount() {
    this._resizeObs?.disconnect()
    this._resizeObs = null
    this.el?.remove()
  }
  refresh()  { this._render()   }

  // ─────────────────────────────────────
  // 렌더
  // ─────────────────────────────────────

  _render() {
    this.el.innerHTML = ''
    const state = this.engine.state

    // ── lobby phase ───────────────────────────────────────────
    if (state.phase === 'lobby') {
      this._renderLobby()
      return
    }

    // ── game phase (night / day) ──────────────────────────────
    const roleMap = {}
    state.players.forEach(p => {
      const role = ROLES_BY_ID[p.role]
      roleMap[p.id] = {
        icon:      role ? role.icon      : '?',
        iconEmoji: role ? role.iconEmoji : null,
        name:      role ? role.name      : p.role,
        team:      role ? role.team      : 'townsfolk',
      }
    })

    this.el.appendChild(renderPhaseHeader(state))

    // 방 코드 공유 카드 (게임 중 참조용)
    const cfg = this.getLobbyConfig()
    if (cfg.roomCode) {
      const codeRow = document.createElement('div')
      codeRow.style.cssText = `
        display:flex;align-items:stretch;gap:6px;margin-bottom:4px;
      `

      // ── 좌: 코드 표시 (넓게) ──
      const codeCard = document.createElement('div')
      codeCard.style.cssText = `
        flex:1;min-width:0;
        display:flex;align-items:center;justify-content:center;
        background:var(--surface2);border:1.5px solid rgba(212,168,40,0.45);
        border-radius:12px;padding:10px 14px;cursor:pointer;gap:10px;
        transition:border-color 0.15s;-webkit-tap-highlight-color:transparent;
      `
      const codeText = document.createElement('div')
      codeText.style.cssText = `
        font-family:monospace;font-size:1.15rem;font-weight:900;
        letter-spacing:0.14em;color:var(--gold2);white-space:nowrap;overflow:hidden;
        text-overflow:ellipsis;
      `
      codeText.textContent = formatCode(cfg.roomCode)

      const codeHint = document.createElement('div')
      codeHint.style.cssText = `
        font-size:0.55rem;color:var(--text4);white-space:nowrap;flex-shrink:0;
      `
      codeHint.textContent = '탭=복사'

      codeCard.appendChild(codeText)
      codeCard.appendChild(codeHint)
      codeCard.addEventListener('click', async () => {
        const copied = await copyRoomCode(cfg.roomCode)
        codeHint.textContent = copied ? '✓ 복사!' : '복사 실패'
        codeCard.style.borderColor = copied ? 'var(--tl-base)' : 'var(--rd-light)'
        setTimeout(() => {
          codeHint.textContent = '탭=복사'
          codeCard.style.borderColor = 'rgba(212,168,40,0.45)'
        }, 1500)
      })

      // ── 우: 링크 버튼 (작게) ──
      const linkBtn = document.createElement('div')
      linkBtn.style.cssText = `
        display:flex;flex-direction:column;align-items:center;justify-content:center;
        background:var(--surface2);border:1.5px solid rgba(212,168,40,0.45);
        border-radius:12px;padding:10px 14px;cursor:pointer;gap:3px;
        transition:border-color 0.15s;-webkit-tap-highlight-color:transparent;flex-shrink:0;
      `
      const linkIcon = document.createElement('div')
      linkIcon.style.cssText = 'font-size:1.1rem;line-height:1;'
      linkIcon.textContent = '🔗'
      const linkHint = document.createElement('div')
      linkHint.style.cssText = 'font-size:0.52rem;color:var(--text4);white-space:nowrap;'
      linkHint.textContent = '링크'

      linkBtn.appendChild(linkIcon)
      linkBtn.appendChild(linkHint)
      linkBtn.addEventListener('click', async () => {
        const copied = await copyRoomLink(cfg.roomCode)
        linkHint.textContent = copied ? '✓ 복사!' : '복사 실패'
        linkBtn.style.borderColor = copied ? 'var(--tl-base)' : 'var(--rd-light)'
        setTimeout(() => {
          linkHint.textContent = '링크'
          linkBtn.style.borderColor = 'rgba(212,168,40,0.45)'
        }, 1500)
      })

      codeRow.appendChild(codeCard)
      codeRow.appendChild(linkBtn)
      this.el.appendChild(codeRow)
    }

    if (state.phase === 'night') {
      const nightCard = document.createElement('div')
      nightCard.className = 'card'
      nightCard.innerHTML = '<div class="card-title">🌙 밤 순서</div>'
      nightCard.appendChild(renderNightOrderList({
        nightOrder:  state.nightOrder,
        currentStep: state.currentNightStep,
        doneSteps:   [],
      }))
      this.el.appendChild(nightCard)
    }


    const btnGrid = document.createElement('div')
    btnGrid.className = 'btn-grid-2'

    if (state.phase === 'night') {
      const nextBtn = document.createElement('button')
      nextBtn.className = 'btn btn-primary btn-grid-full'
      nextBtn.textContent = state.currentNightStep
        ? `▶ 다음 단계 (${{ 'minion-info': '미니언 공개', 'demon-info': '임프 정보' }[state.currentNightStep] || ROLES_BY_ID[state.currentNightStep]?.name || state.currentNightStep})`
        : '▶ 밤 진행 시작'
      nextBtn.addEventListener('click', () => this.onNextNightStep?.())
      btnGrid.appendChild(nextBtn)

      // 현재 단계 액터가 중독/취함 상태이면 경고 칩 표시
      if (state.currentNightStep) {
        const actors = this.engine.getCurrentNightActor()
        const actor  = actors?.[0]
        if (actor?.isPoisoned || actor?.isDrunk) {
          const chip = document.createElement('div')
          chip.className = 'gl-night-warn-chip btn-grid-full'
          const parts = []
          if (actor.isPoisoned) parts.push('☠ 중독')
          if (actor.isDrunk)    parts.push('🍾 취함')
          chip.textContent = `⚠ ${parts.join(' + ')} — 능력 무효화`
          btnGrid.appendChild(chip)
        }
      }

      const toDayBtn = document.createElement('button')
      toDayBtn.className = 'btn btn-grid-full'
      toDayBtn.textContent = '🌅 낮으로 전환'
      toDayBtn.addEventListener('click', () => this.onStartDay?.())
      btnGrid.appendChild(toDayBtn)
    } else {
      const toNightBtn = document.createElement('button')
      toNightBtn.className = 'btn btn-grid-full'
      toNightBtn.textContent = '🌙 밤으로 전환'
      toNightBtn.addEventListener('click', () => this.onStartNight?.())
      btnGrid.appendChild(toNightBtn)
    }
    if (this.onAddTraveller) {
      const travBtn = document.createElement('button')
      travBtn.className = 'btn btn-grid-full btn-traveller'
      travBtn.textContent = '🧳 여행자 추가'
      travBtn.addEventListener('click', () => this.onAddTraveller())
      btnGrid.appendChild(travBtn)
    }

    this.el.appendChild(btnGrid)

    if (this.engine.logs.length > 0) {
      const logCard = document.createElement('div')
      logCard.className = 'card'
      logCard.innerHTML = '<div class="card-title">📜 판정 로그</div>'
      logCard.appendChild(renderLogList([...this.engine.logs].reverse().slice(0, 20)))
      this.el.appendChild(logCard)
    }
  }

  // ─────────────────────────────────────
  // Lobby phase — 자리 배치 뷰
  // ─────────────────────────────────────

  _renderLobby() {
    const config = this.getLobbyConfig()
    const total  = config.playerCount
    const seats  = Array.from({ length: total }, (_, i) => config.seatRoles?.[i] ?? null)

    this.el.classList.add('grimoire--lobby')

    // 선택된 자리가 범위 밖이면 초기화
    if (this._selectedSeat !== null && this._selectedSeat >= total) {
      this._selectedSeat = null
    }

    // ── 1) 헤더: 인원 선택기 ───────────────────────────────────
    const header = document.createElement('div')
    header.className = 'gl-header'

    const headerLeft = document.createElement('div')
    headerLeft.className = 'gl-header__left'
    headerLeft.innerHTML = `
      <span class="gl-header__title">🏰 게임 준비</span>
      <span class="gl-header__sub">자리를 탭해 역할을 배정하세요</span>
    `

    const countSel = document.createElement('div')
    countSel.className = 'gl-count-sel'

    const decBtn = document.createElement('button')
    decBtn.className = 'gl-count-btn'
    decBtn.textContent = '−'
    decBtn.disabled = total <= 5
    decBtn.addEventListener('click', () => this.onPlayerCountChange?.(total - 1))

    const countLabel = document.createElement('span')
    countLabel.className = 'gl-count-val'
    countLabel.textContent = `${total}인`

    const incBtn = document.createElement('button')
    incBtn.className = 'gl-count-btn'
    incBtn.textContent = '+'
    incBtn.disabled = total >= 20
    incBtn.addEventListener('click', () => this.onPlayerCountChange?.(total + 1))

    countSel.appendChild(decBtn)
    countSel.appendChild(countLabel)
    countSel.appendChild(incBtn)

    header.appendChild(headerLeft)
    header.appendChild(countSel)
    this.el.appendChild(header)

    // ── 2) 원형 자리 배치 휠 ─────────────────────────────────
    this._renderSeatWheel(total, seats)

    // ── 3) 역할 선택 패널 (항상 표시) ──────────────────────
    this._renderRolePanel(seats)

    // ── 4) 구성 상태 + 시작 버튼 ───────────────────────────────
    this._renderLobbyFooter(total, seats)
  }

  _renderSeatWheel(total, seats) {
    const wrap = document.createElement('div')
    wrap.style.cssText = 'display:flex;justify-content:center;align-items:center;padding:4px 0 2px;width:100%;'

    const oval = createSeatOval()

    // 뷰포트 높이 기준으로 타원 크기 계산 (슬롯 크기 계산용)
    const { slotPx, iconPx } = calcOvalLayout(total, 360, true)

    // Baron이 있는지 확인하고 아웃사이더 수 계산
    const hasBaron = seats.includes('baron')
    const baseOutsiderCount = PLAYER_COUNTS[total]?.outsider || 0
    const requiredOutsiders = hasBaron ? baseOutsiderCount + 2 : baseOutsiderCount
    const currentOutsiders = seats.filter(r => {
      const role = r ? ROLES_BY_ID[r] : null
      return role && role.team === 'outsider'
    }).length

    // drunkAs 정보 미리 가져오기 (루프 바깥)
    const lobbyConfig = this.getLobbyConfig()
    const drunkAsRoleId = lobbyConfig.drunkAsRole

    seats.forEach((roleId, i) => {
      const role       = roleId ? ROLES_BY_ID[roleId] : null
      const isSelected = this._selectedSeat === i
      const isAssigned = !!roleId
      const hasPassiveAbility = roleId && PASSIVE_ABILITY_ROLES.includes(roleId)
      const hasFirstNightAbility = roleId && FIRST_NIGHT_ROLES.includes(roleId)
      const team = role ? role.team : null

      // 12시 방향 시작, 시계 방향
      const { x, y } = ovalSlotPos(i, total)

      const borderColor = isSelected
        ? 'var(--gold2)'
        : (role ? (TEAM_BORDER[role.team] || 'var(--lead2)') : 'var(--lead2)')

      const abilityClasses = []
      if (hasPassiveAbility || hasFirstNightAbility) abilityClasses.push('ability-active-slot')
      if (team && (hasPassiveAbility || hasFirstNightAbility)) abilityClasses.push(`ability-team-${team}`)

      const slot = createSeatSlot(x, y, slotPx, {
        borderColor,
        isSelected,
        isAssigned,
        selectedHighlight: isSelected,
        extraClasses: abilityClasses,
      })

      // 아이콘 — 주정뱅이는 drunkAs 역할 아이콘 + 배지
      const isDrunkWithAs = roleId === 'drunk' && drunkAsRoleId
      const displayRole = isDrunkWithAs ? ROLES_BY_ID[drunkAsRoleId] : role
      slot.appendChild(createRoleIconEl(displayRole ?? role, iconPx, {
        drunkBadge: isDrunkWithAs,
      }))

      // 역할 이름 레이블
      if (role) slot.appendChild(createRoleNameLabel(role, slotPx))

      // 준비 단계 슬롯 마크 (drunk_warn, baron 가이드)
      applySetupSlotMarks(slot, slotPx, {
        isDrunkWarn:       roleId === 'drunk' && !drunkAsRoleId,
        isBaron:           roleId === 'baron',
        hasBaron,
        requiredOutsiders,
        currentOutsiders,
      })

      slot.addEventListener('click', () => {
        this._selectedSeat = (this._selectedSeat === i) ? null : i
        this._render()
      })
      oval.appendChild(slot)
    })

    // 파이 분할 벽 (슬롯 너머까지 연장, 자리번호 미표시 / 미배정 자리 흐리게)
    drawOvalPieNumbers(oval, total, { outerR: 116, showNumbers: false })

    // ── 타원 중앙 조작 UI ────────────────────────────────────
    const { valid, shortMsg, counts, filledCnt } = this._validateSeats(total, seats)

    const center = document.createElement('div')
    center.className = 'gl-oval-center'

    // 인원 + 상태 한 줄
    const statusEl = document.createElement('div')
    statusEl.className = 'gl-oval-center__status' + (valid ? ' gl-oval-center__status--ok' : '')
    statusEl.textContent = `${total}인 · ${shortMsg}`
    center.appendChild(statusEl)

    // 구성 현황 배지 (배정된 역할이 있을 때)
    if (filledCnt > 0) {
      const badgeRow = document.createElement('div')
      badgeRow.className = 'gl-oval-center__badges'
      const BADGE = { townsfolk:['badge-town','마을'], outsider:['badge-outside','아웃'], minion:['badge-minion','미니언'], demon:['badge-minion','임프'] }
      Object.entries(counts).forEach(([team, cnt]) => {
        if (!cnt) return
        const [cls, label] = BADGE[team]
        const b = document.createElement('span')
        b.className = `badge ${cls}`
        b.style.fontSize = '0.55rem'
        b.textContent = `${label}${cnt}`
        badgeRow.appendChild(b)
      })
      center.appendChild(badgeRow)
    }

    // 자동 배정 버튼
    const autoBtn = document.createElement('button')
    autoBtn.className = 'btn gl-oval-center__btn'
    autoBtn.textContent = '🎲 자동 배정'
    autoBtn.addEventListener('click', () => {
      this._selectedSeat = null
      this.onAutoAssign?.()
    })
    center.appendChild(autoBtn)

    // 게임 시작 버튼
    const startBtn = document.createElement('button')
    startBtn.className = 'btn btn-gold gl-oval-center__btn'
    startBtn.disabled = !valid
    if (!valid) startBtn.style.opacity = '0.45'
    startBtn.textContent = valid ? '🏰 게임 시작' : '🏰 미완성'
    startBtn.addEventListener('click', () => this.onStartGame?.())
    center.appendChild(startBtn)

    oval.appendChild(center)

    wrap.appendChild(oval)
    this.el.appendChild(wrap)
  }

  /** 자리 배정 유효성 검사 — 결과 반환 */
  _validateSeats(total, seats) {
    const counts    = { townsfolk: 0, outsider: 0, minion: 0, demon: 0 }
    const filledCnt = seats.filter(Boolean).length
    seats.forEach(r => {
      const role = r ? ROLES_BY_ID[r] : null
      if (role) counts[role.team] = (counts[role.team] || 0) + 1
    })
    const comp     = PLAYER_COUNTS[total]
    const hasBaron = seats.includes('baron')
    let valid = false, msg = '', shortMsg = ''

    if (filledCnt < total) {
      msg = shortMsg = `${filledCnt}/${total} 배정`
    } else if (comp) {
      const needTown = comp.townsfolk - (hasBaron ? 2 : 0)
      const needOut  = comp.outsider  + (hasBaron ? 2 : 0)
      if (counts.demon < 1)                 { msg = '임프 1개 필요';                          shortMsg = '임프 필요' }
      else if (counts.minion < comp.minion) { msg = `미니언 ${comp.minion}개 필요`;          shortMsg = `미니언 부족` }
      else if (counts.townsfolk < needTown) { msg = `마을주민 ${needTown}개 필요`;           shortMsg = `마을 부족` }
      else if (counts.outsider  < needOut)  { msg = `아웃사이더 ${needOut}개 필요`;          shortMsg = `아웃 부족` }
      else                                  { valid = true; msg = `✓ ${total}인 완성`;        shortMsg = `✓ 완성` }
    } else {
      if (filledCnt === total) { valid = true; msg = shortMsg = `✓ ${total}인 완성` }
    }
    // 주정뱅이가 있으면 drunkAsRole 필수
    if (valid && seats.includes('drunk')) {
      const config = this.getLobbyConfig()
      if (!config.drunkAsRole) {
        valid = false
        msg = '아래에서 주정뱅이가 믿는 역할을 선택하세요'
        shortMsg = '🍾 선택 필요 ↓'
      }
    }
    return { valid, msg, shortMsg, counts, filledCnt }
  }

  _renderRolePanel(seats) {
    const si          = this._selectedSeat
    const currentRole = si !== null ? (seats[si] ?? null) : null
    const usedByOther = new Set(seats.filter((r, i) => r && (si === null || i !== si)))

    const panel = document.createElement('div')
    panel.className = 'card gl-role-panel'

    // 패널 헤더
    const ph = document.createElement('div')
    ph.style.cssText = 'display:flex;align-items:center;justify-content:space-between;margin-bottom:10px;'

    const pt = document.createElement('div')
    pt.className = 'card-title'
    pt.style.marginBottom = '0'
    pt.textContent = si !== null ? `자리 ${si + 1} 역할 선택` : '역할 선택'

    const clearBtn = document.createElement('button')
    clearBtn.style.cssText = `font-size:0.68rem;color:var(--text4);background:none;border:none;cursor:pointer;padding:2px 8px;${si === null ? 'visibility:hidden;' : ''}`
    clearBtn.textContent = '비우기'
    clearBtn.addEventListener('click', () => {
      if (si !== null) this.onSeatRoleAssign?.(si, null)
    })

    ph.appendChild(pt)
    ph.appendChild(clearBtn)
    panel.appendChild(ph)

    // 자리 미선택 시 안내 메시지
    if (si === null) {
      const hint = document.createElement('div')
      hint.style.cssText = 'font-size:0.65rem;color:var(--text4);text-align:center;margin-bottom:8px;padding:4px 0;'
      hint.textContent = '위 자리를 먼저 선택하세요'
      panel.appendChild(hint)
    }

    // 2행 가로 스크롤 그리드 컨테이너
    const scrollContainer = document.createElement('div')
    scrollContainer.className = 'gl-role-scroll' + (si === null ? ' gl-role-scroll--disabled' : '')

    const grid = document.createElement('div')
    grid.className = 'gl-role-grid'

    // 모든 역할을 진영 순서대로 배치
    const allRoles = [
      ...ROLES_TB.filter(r => r.team === 'townsfolk'),
      ...ROLES_TB.filter(r => r.team === 'outsider'),
      ...ROLES_TB.filter(r => r.team === 'minion'),
      ...ROLES_TB.filter(r => r.team === 'demon'),
    ]

    allRoles.forEach(role => {
      const isCurrent = role.id === currentRole
      const isUsed    = usedByOther.has(role.id)
      const usedSeat  = isUsed ? seats.findIndex((r, i) => r === role.id && i !== si) + 1 : 0

      const btn = document.createElement('button')
      btn.className = `dict__token dict__token--${role.team}`
        + (isCurrent ? ' dict__token--on' : (isUsed ? ' dict__token--used' : ''))

      const iconDiv = document.createElement('div')
      iconDiv.className = 'dict__token-icon'
      if (role.icon?.endsWith('.png')) {
        const img = document.createElement('img')
        img.src = `./asset/new/Icon_${role.icon}`
        img.alt = role.name
        iconDiv.appendChild(img)
      } else {
        iconDiv.textContent = role.iconEmoji || '?'
      }

      const nameDiv = document.createElement('div')
      nameDiv.className = 'dict__token-name'
      nameDiv.textContent = role.name
      if (isUsed) {
        const usedTag = document.createElement('div')
        usedTag.style.cssText = 'font-size:0.52rem;color:var(--text4);margin-top:1px;'
        usedTag.textContent = `자리${usedSeat}`
        nameDiv.appendChild(usedTag)
      }

      btn.appendChild(iconDiv)
      btn.appendChild(nameDiv)
      btn.addEventListener('click', () => {
        if (si !== null) {
          this.onSeatRoleAssign?.(si, isCurrent ? null : role.id)
        }
      })
      grid.appendChild(btn)
    })

    scrollContainer.appendChild(grid)
    panel.appendChild(scrollContainer)

    // ── 주정뱅이 "믿는 역할" 선택 패널 ──
    const hasDrunk = seats.includes('drunk')
    if (hasDrunk) {
      const config = this.getLobbyConfig()
      const drunkAs = config.drunkAsRole
      const usedRoleIds = new Set(seats.filter(Boolean))

      const drunkPanel = document.createElement('div')
      drunkPanel.style.cssText = drunkAs
        ? 'margin-top:10px;padding-top:10px;border-top:1px solid var(--lead2);'
        : 'margin-top:10px;padding:10px;border-radius:10px;border:2px solid rgba(124,58,237,0.5);background:rgba(124,58,237,0.08);animation:drunk-pulse 1.5s infinite;'

      const dpHeader = document.createElement('div')
      dpHeader.style.cssText = 'display:flex;align-items:center;gap:6px;margin-bottom:8px;'
      dpHeader.innerHTML = `
        <span style="font-size:0.82rem;">🍾</span>
        <span style="font-size:0.75rem;font-weight:700;color:${drunkAs ? 'var(--text2)' : '#a78bfa'};">주정뱅이가 믿는 역할</span>
        ${drunkAs
          ? `<span style="font-size:0.68rem;color:var(--tl-light);margin-left:auto;">✓ ${ROLES_BY_ID[drunkAs]?.name || ''}</span>`
          : '<span style="font-size:0.65rem;color:var(--rd-light);margin-left:auto;">⬇ 아래에서 선택하세요</span>'}
      `
      drunkPanel.appendChild(dpHeader)

      const dpScroll = document.createElement('div')
      dpScroll.className = 'gl-role-scroll'
      const dpGrid = document.createElement('div')
      dpGrid.style.cssText = 'display:flex;gap:6px;padding:0 4px;width:fit-content;'

      const townsfolk = ROLES_TB.filter(r => r.team === 'townsfolk')
      townsfolk.forEach(role => {
        const isSelected = drunkAs === role.id
        const isInGame = usedRoleIds.has(role.id) && role.id !== 'drunk'

        const btn = document.createElement('button')
        btn.className = `dict__token dict__token--townsfolk`
          + (isSelected ? ' dict__token--on' : '')
          + (isInGame && !isSelected ? ' dict__token--used' : '')
        btn.style.cssText = 'min-width:64px;'

        const iconDiv = document.createElement('div')
        iconDiv.className = 'dict__token-icon'
        if (role.icon?.endsWith('.png')) {
          const img = document.createElement('img')
          img.src = `./asset/new/Icon_${role.icon}`
          img.alt = role.name
          iconDiv.appendChild(img)
        } else {
          iconDiv.textContent = role.iconEmoji || '?'
        }

        const nameDiv = document.createElement('div')
        nameDiv.className = 'dict__token-name'
        nameDiv.textContent = role.name
        if (isInGame && !isSelected) {
          const tag = document.createElement('div')
          tag.style.cssText = 'font-size:0.48rem;color:var(--text4);margin-top:1px;'
          tag.textContent = '게임 중'
          nameDiv.appendChild(tag)
        }

        btn.appendChild(iconDiv)
        btn.appendChild(nameDiv)
        btn.addEventListener('click', () => {
          this.onDrunkAsChange?.(isSelected ? null : role.id)
        })
        dpGrid.appendChild(btn)
      })

      dpScroll.appendChild(dpGrid)
      drunkPanel.appendChild(dpScroll)
      panel.appendChild(drunkPanel)
    }

    this.el.appendChild(panel)
  }

  _renderLobbyFooter(total, seats) {
    // 자리 선택 중일 때는 역할 패널이 이미 표시되므로 footer 최소화
    if (this._selectedSeat !== null) return

    const { msg, valid } = this._validateSeats(total, seats)

    // 상세 상태 텍스트 (중앙 패널 보조)
    if (!valid) {
      const status = document.createElement('div')
      status.className = 'gl-role-status'
      status.style.textAlign = 'center'
      status.textContent = msg
      this.el.appendChild(status)
    }
  }

  // ─────────────────────────────────────
  // 역할 상세 모달 (로비용, CharacterDict 모달 재사용)
  // ─────────────────────────────────────

  _showRoleModal(role) {
    const helper = new CharacterDict({ scriptRoles: null })
    helper._openModal(role)
  }

  // ─────────────────────────────────────
  // 규칙 팝업
  // ─────────────────────────────────────

  _showRulesPopup() {
    document.getElementById('rules-popup')?.remove()

    const overlay = document.createElement('div')
    overlay.className = 'popup-overlay'
    overlay.id = 'rules-popup'
    overlay.style.alignItems = 'flex-start'
    overlay.style.padding = '12px'

    const box = document.createElement('div')
    box.className = 'popup-box'
    box.style.cssText = 'max-height:88vh;overflow-y:auto;padding:16px;margin-top:8px;'

    const header = document.createElement('div')
    header.style.cssText = 'display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;'
    header.innerHTML = `
      <span style="font-family:'Noto Serif KR',serif;font-size:0.92rem;font-weight:700;color:var(--gold2)">📜 게임 규칙</span>
      <button id="rules-close-btn" class="btn" style="padding:4px 10px;font-size:0.72rem;">닫기</button>
    `
    box.appendChild(header)

    const rules = new RulesScreen()
    rules.mount(box)

    overlay.appendChild(box)
    overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove() })
    box.querySelector('#rules-close-btn').addEventListener('click', () => overlay.remove())
    document.body.appendChild(overlay)
  }

  // ─────────────────────────────────────
  // 플레이어 상세 팝업 (game phase)
  // ─────────────────────────────────────

  _showPlayerDetail(playerId) {
    const player = this.engine.getPlayer(playerId)
    if (!player) return
    const role = ROLES_BY_ID[player.role]

    const overlay = document.createElement('div')
    overlay.className = 'popup-overlay'

    const box = document.createElement('div')
    box.className = 'popup-box'

    const headerDiv = document.createElement('div')
    headerDiv.style.cssText = 'display:flex;align-items:center;gap:10px;margin-bottom:12px;'

    const iconSpan = document.createElement('span')
    iconSpan.style.fontSize = '1.8rem'
    // PNG 이미지면 img 태그로, 아니면 emoji로 표시
    if (role?.icon && role.icon.endsWith('.png')) {
      const img = document.createElement('img')
      img.src = `./asset/new/Icon_${role.icon}`
      img.alt = role.name
      img.style.cssText = 'width:50px;height:50px;object-fit:contain;'
      iconSpan.appendChild(img)
    } else {
      iconSpan.textContent = role?.icon || '?'
    }

    const infoDiv = document.createElement('div')
    infoDiv.innerHTML = `
      <div style="font-family:'Noto Serif KR',serif;font-size:1rem;font-weight:700;color:var(--text)">${player.id}번 자리</div>
      <div style="font-size:0.72rem;color:var(--text3)">${role?.name || player.role}</div>
    `

    headerDiv.appendChild(iconSpan)
    headerDiv.appendChild(infoDiv)
    box.appendChild(headerDiv)

    const btns = [
      { label: '💀 사망 처리', action: () => { this.engine.killPlayer(player.id, 'manual'); this.refresh(); overlay.remove() } },
      { label: '☠ 중독 토글', action: () => { player.isPoisoned = !player.isPoisoned; this.refresh(); overlay.remove() } },
      { label: '🍾 취함 토글', action: () => { player.isDrunk = !player.isDrunk; this.refresh(); overlay.remove() } },
    ]

    if (player.role === 'slayer') {
      btns.push({ label: '🗡 처단자 선언', action: () => { overlay.remove(); this.onPlayerAction?.('slayer', player.id) } })
    }

    const btnGrid2 = document.createElement('div')
    btnGrid2.className = 'btn-grid-2'
    btnGrid2.style.marginBottom = '10px'
    btns.forEach(({ label, action }) => {
      const btn = document.createElement('button')
      btn.className = 'btn btn-danger'
      btn.textContent = label
      btn.addEventListener('click', action)
      btnGrid2.appendChild(btn)
    })
    box.appendChild(btnGrid2)

    const closeBtn = document.createElement('button')
    closeBtn.className = 'btn btn-full'
    closeBtn.textContent = '닫기'
    closeBtn.addEventListener('click', () => overlay.remove())
    box.appendChild(closeBtn)

    overlay.appendChild(box)
    overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove() })
    document.body.appendChild(overlay)
  }
}

if (!document.getElementById('grimoire-lobby-style')) {
  const style = document.createElement('style')
  style.id = 'grimoire-lobby-style'
  style.textContent = `
/* ── 로비 컨테이너 ── */
.grimoire--lobby {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

/* ── 밤 단계 경고 칩 ── */
.gl-night-warn-chip {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 8px 12px;
  border-radius: 10px;
  background: rgba(220, 38, 38, 0.12);
  border: 1.5px solid rgba(220, 38, 38, 0.5);
  color: #fca5a5;
  font-size: 0.8rem;
  font-weight: 700;
  letter-spacing: 0.02em;
  box-shadow: 0 0 10px rgba(220, 38, 38, 0.2);
  animation: gl-warn-pulse 1.8s ease-in-out infinite;
}
@keyframes gl-warn-pulse {
  0%, 100% { box-shadow: 0 0 10px rgba(220,38,38,0.2); }
  50%       { box-shadow: 0 0 20px rgba(220,38,38,0.5); border-color: rgba(220,38,38,0.8); }
}

/* ── 상단 헤더 ── */
.gl-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 2px 6px;
  border-bottom: 1px solid var(--lead2);
  margin-bottom: 4px;
}
.gl-header__left {
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.gl-header__title {
  font-family: 'Noto Serif KR', serif;
  font-size: 0.92rem;
  font-weight: 700;
  color: var(--gold2);
}
.gl-header__sub {
  font-size: 0.68rem;
  color: var(--text3);
}

/* ── 인원 선택기 ── */
.gl-count-sel {
  display: flex;
  align-items: center;
  gap: 8px;
}
.gl-count-btn {
  width: 30px;
  height: 30px;
  border-radius: 50%;
  border: 1px solid var(--lead2);
  background: var(--surface2);
  color: var(--text);
  font-size: 1.1rem;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  line-height: 1;
  transition: background 0.12s;
}
.gl-count-btn:disabled { opacity: 0.3; cursor: default; }
.gl-count-btn:not(:disabled):active { background: var(--surface3, var(--lead2)); }
.gl-count-val {
  font-family: 'Noto Serif KR', serif;
  font-size: 0.92rem;
  font-weight: 700;
  color: var(--gold2);
  min-width: 30px;
  text-align: center;
}

/* ── 역할 선택 상태 표시 ── */
.gl-role-status {
  font-size: 0.68rem;
  color: var(--text4);
  text-align: center;
  padding: 3px 0 2px;
}
.gl-role-status--ok {
  color: var(--tl-light);
}

/* ── 역할 토큰 선택 상태 ── */
.dict__token--on {
  opacity: 1;
}
.dict__token--off {
  opacity: 0.22;
  filter: grayscale(0.5);
}
.dict__token--used {
  opacity: 0.38;
  filter: grayscale(0.6);
}

/* .gl-seat-oval / .gl-seat-slot / .gl-seat-num → css/seat-slot.css */

.gl-role-panel {
  margin-top: 4px;
}

/* ── 2행 가로 스크롤 그리드 ── */
.gl-role-scroll {
  overflow-x: auto;
  overflow-y: hidden;
  -webkit-overflow-scrolling: touch;
  padding: 4px 0 8px;
  margin: 0 -4px;
}
.gl-role-scroll::-webkit-scrollbar {
  height: 6px;
}
.gl-role-scroll::-webkit-scrollbar-track {
  background: var(--surface2);
  border-radius: 3px;
}
.gl-role-scroll::-webkit-scrollbar-thumb {
  background: var(--lead2);
  border-radius: 3px;
}
.gl-role-scroll--disabled {
  opacity: 0.4;
  pointer-events: none;
}

.gl-role-grid {
  display: grid;
  grid-template-rows: repeat(2, 1fr);
  grid-auto-flow: column;
  grid-auto-columns: 76px;
  gap: 6px;
  padding: 0 4px;
  width: fit-content;
}

/* ── 타원 중앙 조작 패널 ── */
.gl-oval-center {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 7px;
  z-index: 5;
  pointer-events: none;
  width: clamp(100px, 28%, 160px);
}
.gl-oval-center > * { pointer-events: auto; }

.gl-oval-center__status {
  font-size: 0.62rem;
  color: var(--text4);
  text-align: center;
  white-space: nowrap;
  line-height: 1.3;
}
.gl-oval-center__status--ok { color: var(--tl-light); }

.gl-oval-center__badges {
  display: flex;
  flex-wrap: wrap;
  gap: 3px;
  justify-content: center;
}

.gl-oval-center__btn {
  width: 100%;
  font-size: 0.72rem;
  padding: 8px 6px;
  white-space: nowrap;
  border-radius: 8px;
}

/* ── 참가자 칩 행 ── */
.gl-participants {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  align-items: center;
  min-height: 28px;
  padding: 2px 0 6px;
}
.grimoire-lobby-chip {
  background: rgba(91, 179, 198, 0.12);
  border: 1px solid rgba(91, 179, 198, 0.35);
  border-radius: 20px;
  padding: 4px 12px;
  font-size: 0.75rem;
  color: var(--tl-light);
  font-weight: 600;
  white-space: nowrap;
}

/* ── 역할 없을 때 빈 화면 ── */
.gl-empty {
  text-align: center;
  padding: 48px 20px;
  color: var(--text4);
  font-size: 0.82rem;
}

/* ── 시작 버튼 ── */
.gl-start-btn {
  width: 100%;
  padding: 14px;
  margin-top: 8px;
  font-size: 0.92rem;
}

/* ── 주정뱅이 드렁크As 패널 펄스 ── */
@keyframes drunk-pulse {
  0%, 100% { border-color: rgba(124,58,237,0.5); }
  50% { border-color: rgba(124,58,237,0.9); box-shadow: 0 0 12px rgba(124,58,237,0.25); }
}

/* ── 대기 점 ── */
.lobby-wait-dot {
  display: inline-block;
  width: 7px; height: 7px;
  border-radius: 50%;
  background: var(--pu-base);
  animation: dot-pulse 1.2s infinite;
  flex-shrink: 0;
}
  `
  document.head.appendChild(style)
}
