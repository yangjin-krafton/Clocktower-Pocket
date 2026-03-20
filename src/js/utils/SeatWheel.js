/**
 * SeatWheel.js — 타원형 자리 배치 DOM 빌더 공용 모듈
 *
 * CSS: css/seat-slot.css
 * 위치 계산: utils/ovalLayout.js
 *
 * 사용처: Grimoire.js, host/app.js, NightAction.js, player/app.js
 */

// ── 팀별 테두리 색 ──────────────────────────────────────────
export const TEAM_BORDER = {
  townsfolk: 'rgba(46,74,143,0.65)',
  outsider:  'rgba(91,179,198,0.65)',
  minion:    'rgba(140,40,50,0.65)',
  demon:     'rgba(160,30,40,0.9)',
}

// ── 팀별 텍스트 색 (역할 이름 레이블용) ────────────────────
export const TEAM_NAME_COLOR = {
  townsfolk: 'var(--bl-light)',
  outsider:  'var(--tl-light)',
  minion:    'var(--rd-light)',
  demon:     'var(--rd-light)',
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
 * @param {boolean}     [opts.drunkBadge]    - 🍾 배지 표시
 * @param {boolean}     [opts.warnBadge]     - ❗ 배지 표시 (drunkAs 미선택)
 * @param {string}      [opts.fallbackEmoji] - 역할 없을 때 대체 문자 (기본 '+')
 */
export function createRoleIconEl(role, iconPx, {
  drunkBadge    = false,
  warnBadge     = false,
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
  if (role?.icon?.endsWith('.png')) {
    const img = document.createElement('img')
    img.src = `./asset/icons/${role.icon}`
    img.style.cssText = 'width:100%;height:100%;object-fit:contain;'
    iconEl.appendChild(img)
  } else if (role) {
    iconEl.textContent = role.iconEmoji || '?'
  } else {
    iconEl.innerHTML = `<span style="color:var(--text4);font-size:${Math.round(iconPx * 0.5)}px">${fallbackEmoji}</span>`
  }
  iconWrap.appendChild(iconEl)

  if (drunkBadge) {
    const badge = document.createElement('div')
    badge.style.cssText = `
      position:absolute;top:-4px;right:-4px;
      width:${Math.round(iconPx * 0.4)}px;height:${Math.round(iconPx * 0.4)}px;
      border-radius:50%;background:#7c3aed;
      display:flex;align-items:center;justify-content:center;
      font-size:${Math.round(iconPx * 0.24)}px;line-height:1;
      border:1px solid var(--surface);z-index:2;
    `
    badge.textContent = '🍾'
    iconWrap.appendChild(badge)
  } else if (warnBadge) {
    const wb = document.createElement('div')
    wb.style.cssText = `
      position:absolute;top:-4px;right:-4px;
      width:${Math.round(iconPx * 0.4)}px;height:${Math.round(iconPx * 0.4)}px;
      border-radius:50%;background:var(--rd-light);
      display:flex;align-items:center;justify-content:center;
      font-size:${Math.round(iconPx * 0.22)}px;line-height:1;
      border:1px solid var(--surface);z-index:2;
      animation:drunk-pulse 1.5s infinite;
    `
    wb.textContent = '❗'
    iconWrap.appendChild(wb)
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
