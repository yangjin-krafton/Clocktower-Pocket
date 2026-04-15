/**
 * SeatWheel.js — 타원형 자리 배치 DOM 빌더 공용 모듈
 *
 * CSS: css/seat-slot.css
 * 위치 계산: utils/ovalLayout.js
 *
 * 사용처: Grimoire.js, host/app.js, NightAction.js, player/app.js
 */

import { ROLES_BY_ID }                      from '../data/roles-tb.js'
import { ovalSlotPos, drawOvalPieNumbers }   from './ovalLayout.js'
import { applySlotStateMarks }               from './SlotMark.js'

// ── 팀별 테두리 색 ──────────────────────────────────────────
export const TEAM_BORDER = {
  townsfolk:  'rgba(46,74,143,0.65)',
  outsider:   'rgba(91,179,198,0.65)',
  minion:     'rgba(140,40,50,0.65)',
  demon:      'rgba(160,30,40,0.9)',
  traveller:  'rgba(122,111,183,0.7)',
}

// ── 팀별 텍스트 색 (역할 이름 레이블용) ────────────────────
export const TEAM_NAME_COLOR = {
  townsfolk:  'var(--bl-light)',
  outsider:   'var(--tl-light)',
  minion:     'var(--rd-light)',
  demon:      'var(--rd-light)',
  traveller:  'var(--pu-light)',
}

// ── 타원 컨테이너 ────────────────────────────────────────────
/**
 * gl-seat-oval 컨테이너 div 생성
 * @param {string} [styleOverride] - CSS 클래스 위에 덮어쓸 inline style
 */
export function createSeatOval(styleOverride = '') {
  const oval = document.createElement('div')
  oval.className = 'gl-seat-oval'
  oval.style.cssText = 'position:relative;overflow:visible;' + styleOverride
  return oval
}

// ── 자리 슬롯 ────────────────────────────────────────────────
/**
 * gl-seat-slot 기반 슬롯 div 생성
 *
 * @param {number} x            - left %
 * @param {number} y            - top %
 * @param {number} slotPx       - 슬롯 한 변 크기 (px)
 * @param {object} opts
 * @param {string}   [opts.borderColor='var(--lead2)']
 * @param {number}   [opts.borderWidth]        - 기본 6px 대신 지정 (px)
 * @param {string}   [opts.borderStyle]        - 'solid' | 'dashed' 등
 * @param {boolean}  [opts.isSelected]         - gl-seat-slot--selected 클래스
 * @param {boolean}  [opts.isAssigned]         - true=--assigned / false=--empty
 * @param {boolean}  [opts.isDead]             - opacity + grayscale
 * @param {string}   [opts.cursor]             - 기본 'pointer' 대신 지정
 * @param {string}   [opts.background]         - 배경색 override
 * @param {string}   [opts.boxShadow]          - box-shadow override
 * @param {boolean}  [opts.selectedHighlight]  - 선택 시 금색 글로우
 * @param {string[]} [opts.extraClasses]       - 추가 CSS 클래스
 */
export function createSeatSlot(x, y, slotPx, {
  borderColor      = 'var(--lead2)',
  borderWidth,
  borderStyle,
  isSelected       = false,
  isAssigned,
  isDead           = false,
  cursor,
  background,
  boxShadow,
  selectedHighlight = false,
  extraClasses      = [],
} = {}) {
  const slot = document.createElement('div')

  const classes = ['gl-seat-slot']
  if (isSelected)        classes.push('gl-seat-slot--selected')
  if (isAssigned === true)  classes.push('gl-seat-slot--assigned')
  if (isAssigned === false) classes.push('gl-seat-slot--empty')
  classes.push(...extraClasses)
  slot.className = classes.join(' ')

  const transform = isSelected
    ? 'translate(-50%,-50%) scale(1.18)'
    : 'translate(-50%,-50%)'

  const styles = [
    'position:absolute',
    `transform:${transform}`,
    `left:${x.toFixed(2)}%`,
    `top:${y.toFixed(2)}%`,
    `width:${slotPx}px`,
    `height:${slotPx}px`,
    `border-color:${borderColor}`,
    'flex-direction:column',
    'gap:1px',
  ]
  if (borderWidth)        styles.push(`border-width:${borderWidth}px`)
  if (borderStyle)        styles.push(`border-style:${borderStyle}`)
  if (cursor)             styles.push(`cursor:${cursor}`)
  if (background)         styles.push(`background:${background}`)
  if (boxShadow)          styles.push(`box-shadow:${boxShadow}`)
  if (isDead)             styles.push('opacity:0.38', 'filter:grayscale(0.65)')
  if (selectedHighlight)  styles.push(
    'box-shadow:0 0 0 2px rgba(212,168,40,0.35),0 0 12px rgba(212,168,40,0.4)',
    'background:rgba(212,168,40,0.08)',
  )

  slot.style.cssText = styles.join(';')
  return slot
}

// ── 역할 아이콘 ──────────────────────────────────────────────
/**
 * 역할 아이콘 wrap div 생성 (원형 아이콘 + 선택적 배지)
 *
 * @param {object|null} role           - 표시할 역할 객체 (displayRole)
 * @param {number}      iconPx
 * @param {object}      opts
 * @param {boolean}     [opts.drunkBadge]    - 🍾 pill 배지 표시 (drunkAs 배정된 주정뱅이)
 * @param {string}      [opts.fallbackEmoji] - 역할 없을 때 대체 문자 (기본 '+')
 */
export function createRoleIconEl(role, iconPx, {
  drunkBadge    = false,
  fallbackEmoji = '+',
} = {}) {
  const iconWrap = document.createElement('div')
  iconWrap.style.cssText = `position:relative;width:${iconPx}px;height:${iconPx}px;flex-shrink:0;pointer-events:none;`

  const iconEl = document.createElement('div')
  iconEl.style.cssText = `
    width:${iconPx}px;height:${iconPx}px;
    border-radius:50%;background:var(--surface2);
    display:flex;align-items:center;justify-content:center;
    font-size:${Math.round(iconPx * 0.58)}px;
    overflow:hidden;flex-shrink:0;
  `
  if (role?.icon?.endsWith('.webp')) {
    const img = document.createElement('img')
    img.src = `./asset/new/Icon_${role.icon}`
    img.style.cssText = 'width:100%;height:100%;object-fit:contain;'
    iconEl.appendChild(img)
  } else if (role) {
    iconEl.textContent = role.iconEmoji || '?'
  } else {
    iconEl.innerHTML = `<span style="color:var(--text4);font-size:${Math.round(iconPx * 0.5)}px">${fallbackEmoji}</span>`
  }
  iconWrap.appendChild(iconEl)

  if (drunkBadge) {
    // iconWrap 전체가 천천히 360° 회전
    iconWrap.style.animation = 'drunk-rotate 9s linear infinite'

    // ① 역할 아이콘: absolute 로 겹쳐 놓고 fade-in/out
    iconEl.style.cssText += ';position:absolute;top:0;left:0;animation:drunk-fade 6s ease-in-out infinite'

    // ② drunk.webp: half-cycle(-3s) 오프셋으로 교대 페이드
    const drunkEl = document.createElement('div')
    drunkEl.style.cssText = `
      position:absolute;top:0;left:0;
      width:${iconPx}px;height:${iconPx}px;
      border-radius:50%;background:var(--surface2);overflow:hidden;
      display:flex;align-items:center;justify-content:center;
      animation:drunk-fade 6s ease-in-out infinite;animation-delay:-3s;
    `
    const drunkImg = document.createElement('img')
    drunkImg.src = './asset/new/Icon_drunk.webp'
    drunkImg.style.cssText = 'width:85%;height:85%;object-fit:contain;'
    drunkEl.appendChild(drunkImg)
    iconWrap.appendChild(drunkEl)
  }

  return iconWrap
}

// ── 자리 번호 레이블 ─────────────────────────────────────────
/**
 * 자리 번호 레이블 (슬롯-중심 사이 위치)
 *
 * @param {number}          x       - 슬롯 left %
 * @param {number}          y       - 슬롯 top %
 * @param {number}          slotPx
 * @param {string|number}   text    - 표시할 번호
 * @param {object}          opts
 * @param {boolean}         [opts.dimmed] - 흐리게 (미배정 자리)
 */
export function createSeatNumLabel(x, y, slotPx, text, { dimmed = false } = {}) {
  const labelX = 50 + (x - 50) * 0.55
  const labelY = 50 + (y - 50) * 0.55
  const labelFontPx = Math.max(20, Math.round(slotPx * 0.55))

  const label = document.createElement('div')
  label.style.cssText = `
    position:absolute;left:${labelX.toFixed(2)}%;top:${labelY.toFixed(2)}%;
    transform:translate(-50%,-50%);
    font-size:${labelFontPx}px;font-weight:700;
    color:${dimmed ? 'rgba(212,168,40,0.3)' : 'var(--gold2)'};
    pointer-events:none;text-shadow:0 1px 3px rgba(0,0,0,0.5);
    z-index:1;
  `
  label.textContent = text
  return label
}

// ── 역할 이름 레이블 (슬롯 내부 하단) ───────────────────────
/**
 * @param {object} role
 * @param {number} slotPx
 */
export function createRoleNameLabel(role, slotPx) {
  const nameEl = document.createElement('div')
  const nameFontPx = Math.max(7, Math.round(slotPx * 0.15))
  nameEl.style.cssText = `
    font-size:${nameFontPx}px;font-weight:600;line-height:1.1;
    color:${TEAM_NAME_COLOR[role.team] || 'var(--text2)'};text-align:center;
    max-width:${slotPx - 4}px;overflow:hidden;
    white-space:nowrap;text-overflow:ellipsis;
    pointer-events:none;flex-shrink:0;
  `
  nameEl.textContent = role.name
  return nameEl
}

// ── 오발 슬롯 공통 렌더링 ────────────────────────────────────
/**
 * Grimoire(host/app.js)와 OvalSelectPanel이 공유하는 슬롯 빌더.
 * 역할 아이콘·이름·상태 마크를 공통 처리하고,
 * 선택 기능은 onSlotClick 콜백으로 위임한다.
 *
 * @param {HTMLElement} oval
 * @param {Object[]}    players
 * @param {number}      slotPx
 * @param {number}      iconPx
 * @param {object}      opts
 * @param {object|null}   [opts.engine]        - 게임 엔진 (상태 마크용)
 * @param {number}        [opts.rotOffset=0]   - ovalSelfRotOffset 결과
 * @param {number|null}   [opts.selfSeatId]    - 나 배지 표시 기준
 * @param {number[]}      [opts.selectedIds]   - 선택된 id 목록
 * @param {Function|null} [opts.onSlotClick]   - (player) => void
 */
export function buildOvalSlots(oval, players, slotPx, iconPx, {
  engine = null, rotOffset = -Math.PI / 2, selfSeatId = null,
  selectedIds = [], onSlotClick = null,
  drawPie = true,   // false: 파이 배경 건너뜀 (containerFill 사용 시)
} = {}) {
  const total       = players.length
  const monkPoisoned = !!(engine?.state?.players?.find(mp => mp.role === 'monk')?.isPoisoned)
  players.forEach((p, i) => {
    const { x, y }     = ovalSlotPos(i, total, rotOffset)
    const role          = ROLES_BY_ID[p.role]
    const isDead        = p.status !== 'alive'
    const isSelf        = p.id === selfSeatId
    const isSelected    = selectedIds.includes(p.id)
    const isDrunkWithAs = p.role === 'drunk' && !!p.drunkAs
    const isSuccession  = !!p.successionFromRole

    // 표시 역할 우선순위: 주정뱅이 drunkAs > 임프 승계 이전 역할 > 현재 역할
    const displayRole = isDrunkWithAs  ? ROLES_BY_ID[p.drunkAs]
                      : isSuccession   ? ROLES_BY_ID[p.successionFromRole]
                      : role

    const borderColor = isSelected
      ? 'var(--gold)'
      : isSelf
        ? 'var(--gold2)'
        : (TEAM_BORDER[role?.team] || 'var(--lead2)')   // 테두리는 현재 역할(임프) 기준

    const slot = createSeatSlot(x, y, slotPx, {
      borderColor,
      isDead,
      isSelected,
      selectedHighlight: isSelected,
      cursor: onSlotClick && !isSelf ? 'pointer' : 'default',
    })

    slot.appendChild(createRoleIconEl(displayRole ?? role, iconPx, { drunkBadge: isDrunkWithAs }))
    if (displayRole ?? role) slot.appendChild(createRoleNameLabel(displayRole ?? role, slotPx))

    applySlotStateMarks(slot, slotPx, {
      isPoisoned:      p.isPoisoned,
      isDrunk:         p.isDrunk && !isDrunkWithAs,
      isProtected:     engine ? p.id === engine.monkProtect && !monkPoisoned : false,
      isDeadNight:     p.status === 'dead',
      isDeadExec:      p.status === 'executed',
      isSelectedCheck: isSelected,
      butlerMasterId:  engine?.butlerMasters?.[p.id] ?? null,
      isImpSuccession: isSuccession,
    })

    if (onSlotClick && !isSelf) {
      slot.addEventListener('click', () => onSlotClick(p))
    }

    oval.appendChild(slot)
  })

  // 파이 분할 벽 (슬롯 너머까지 연장, 자리번호 미표시)
  if (drawPie) drawOvalPieNumbers(oval, total, { rotOffset, outerR: 116, showNumbers: false })
}
