/**
 * SlotMark.js — 자리 슬롯 상태 마크 시스템
 *
 * 슬롯 8방향 포지션 체계로 여러 마크를 동시에 겹치지 않게 표시합니다.
 * 나중에 캐릭터가 추가될 때 MARK_DEFS에만 추가하면 됩니다.
 *
 *   [TL] [TC] [TR]
 *   [ML]  ○  [MR]
 *   [BL] [BC] [BR]
 *
 * 포지션 배정:
 *   TL — 보호 (수도승)       TC — 밤 사망       TR — 낮 처형 / 나이트 선택
 *   ML — 남작 (ok/err)      MR — (예약)
 *   BL — 중독               BC — 주정뱅이 경고   BR — 취함 상태
 *
 * 사용처: Grimoire.js, host/app.js, NightAction.js
 */

// ── 8방향 포지션 CSS ─────────────────────────────────────────
const POS = {
  TL: 'top:-5px;left:-5px',
  TC: 'top:-5px;left:50%;transform:translateX(-50%)',
  TR: 'top:-5px;right:-5px',
  ML: 'top:50%;left:-5px;transform:translateY(-50%)',
  MR: 'top:50%;right:-5px;transform:translateY(-50%)',
  BL: 'bottom:-5px;left:-5px',
  BC: 'bottom:-5px;left:50%;transform:translateX(-50%)',
  BR: 'bottom:-5px;right:-5px',
}

// ── 마크 정의 레지스트리 ─────────────────────────────────────
/**
 * pos   — 포지션 키 (POS 맵 참조)
 * icon  — 배지 내 이모지/문자
 * bg    — 배지 배경색
 * color — 텍스트 색 (기본 #fff)
 * glow  — box-shadow 글로우 색 (선택)
 * fw    — font-weight (선택)
 */
export const MARK_DEFS = {
  // ── 보호 (좌상) ──────────────────────────────────────────
  protected:   { pos: 'TL', icon: '🛡', bg: '#0e7490', glow: 'rgba(14,116,144,0.5)'  },

  // ── 사망 종류 (상단 중·우) ───────────────────────────────
  dead_night:  { pos: 'TC', icon: '💀', bg: '#374151'                                  },
  dead_exec:   { pos: 'TR', icon: '⚔',  bg: '#b91c1c', glow: 'rgba(185,28,28,0.5)'   },

  // ── UI 선택 (우상 — NightAction) ─────────────────────────
  check:       { pos: 'TR', icon: '✓',  bg: 'var(--gold2)', color: '#000', fw: '700'  },

  // ── 상태 이상 (좌하·우하) ────────────────────────────────
  poison:      { pos: 'BL', icon: '☠',  bg: '#16a34a', glow: 'rgba(22,163,74,0.6)'   },
  // drunk / drunk_warn 은 pill 전용 — 아래 createPillBadge 사용
}

// ── 배지 크기 ────────────────────────────────────────────────
function badgeSz(slotPx) {
  return Math.max(14, Math.round(slotPx * 0.24))
}

// ── 공용 Pill 배지 팩토리 ────────────────────────────────────
/**
 * @param {HTMLElement} slot
 * @param {number}      slotPx
 * @param {object}      opts
 * @param {string}      opts.pos       - POS 키
 * @param {string}      opts.text      - 표시할 텍스트
 * @param {string}      opts.bg        - 배경색
 * @param {string}      opts.cls       - slot-mark--XXX 클래스명
 * @param {string}      [opts.glow]    - 글로우 색
 * @param {boolean}     [opts.pulse]   - 펄스 애니메이션 여부
 */
function createPillBadge(slot, slotPx, { pos, text, bg, cls, glow = '', pulse = false }) {
  const h    = badgeSz(slotPx)
  const fsPx = Math.max(8, Math.round(h * 0.62))

  const el = document.createElement('div')
  el.className = `slot-mark slot-mark--${cls}`
  el.style.cssText = `
    position:absolute;${POS[pos]};
    height:${h}px;padding:0 ${Math.round(h * 0.3)}px;min-width:${h}px;
    border-radius:${Math.round(h / 2)}px;
    background:${bg};
    display:flex;align-items:center;justify-content:center;
    font-size:${fsPx}px;line-height:1;font-weight:700;
    color:#fff;white-space:nowrap;
    border:1px solid var(--surface);z-index:3;pointer-events:none;
    ${glow  ? `box-shadow:0 0 6px ${glow};`                        : ''}
    ${pulse ? 'animation:drunk-pulse 1.5s ease-in-out infinite;'   : ''}
  `
  el.textContent = text
  slot.appendChild(el)
  return el
}

// ── 카운트 필 (남작 X/Y) ─────────────────────────────────────
function addCountMark(slot, slotPx, pos, current, required) {
  const isOk = current >= required
  return createPillBadge(slot, slotPx, {
    pos,
    text:  `${current}/${required}`,
    bg:    isOk ? '#0e7490' : '#b45309',
    glow:  isOk ? 'rgba(14,116,144,0.55)' : 'rgba(180,83,9,0.55)',
    cls:   'baron',
  })
}

// ── 취함 상태 필 (게임 중 isDrunk) ───────────────────────────
/**
 * 게임 중 isDrunk 상태 — 슬롯 우하단 pill "취함"
 */
function addDrunkStatePill(slot, slotPx) {
  return createPillBadge(slot, slotPx, {
    pos:  'BR',
    text: '취함',
    bg:   '#7c3aed',
    glow: 'rgba(124,58,237,0.55)',
    cls:  'drunk',
  })
}

// ── 취함 경고 필 (준비: drunkAs 미선택) ──────────────────────
/**
 * 주정뱅이 역할이지만 drunkAs 미선택 — 슬롯 하단 중앙 pill "🍾?", 펄스
 */
function addDrunkWarnPill(slot, slotPx) {
  return createPillBadge(slot, slotPx, {
    pos:   'BC',
    text:  '🍾?',
    bg:    '#d97706',
    glow:  'rgba(217,119,6,0.55)',
    cls:   'drunk_warn',
    pulse: true,
  })
}

// ── 단일 마크 추가 ───────────────────────────────────────────
/**
 * 슬롯에 마크 배지를 하나 추가합니다.
 *
 * @param {HTMLElement} slot
 * @param {number}      slotPx
 * @param {string}      markType  - MARK_DEFS 키
 * @param {object}      [customDef] - MARK_DEFS에 없는 커스텀 마크
 * @returns {HTMLElement|null}
 */
export function addSlotMark(slot, slotPx, markType, customDef) {
  const def = customDef ?? MARK_DEFS[markType]
  if (!def) return null

  const sz       = badgeSz(slotPx)
  const posCSS   = POS[def.pos] ?? POS.TR
  const glowCSS  = def.glow ? `box-shadow:0 0 6px ${def.glow};` : ''
  const colorCSS = `color:${def.color ?? '#fff'};`
  const fwCSS    = def.fw ? `font-weight:${def.fw};` : ''

  const el = document.createElement('div')
  el.className = `slot-mark slot-mark--${markType}`
  el.style.cssText = `
    position:absolute;${posCSS};
    width:${sz}px;height:${sz}px;
    border-radius:50%;background:${def.bg};
    display:flex;align-items:center;justify-content:center;
    font-size:${Math.round(sz * 0.62)}px;line-height:1;
    border:1px solid var(--surface);z-index:3;
    pointer-events:none;
    ${colorCSS}${fwCSS}${glowCSS}
  `
  el.textContent = def.icon
  slot.appendChild(el)
  return el
}

// ── 기존 마크 제거 ───────────────────────────────────────────
/**
 * @param {HTMLElement} slot
 * @param {string}      [markType] - 생략 시 모든 .slot-mark 제거
 */
export function removeSlotMark(slot, markType) {
  const sel = markType ? `.slot-mark--${markType}` : '.slot-mark'
  slot.querySelectorAll(sel).forEach(el => el.remove())
}

// ── 게임 상태 마크 일괄 적용 ─────────────────────────────────
/**
 * @param {HTMLElement} slot
 * @param {number}      slotPx
 * @param {object}      states
 * @param {boolean}     [states.isPoisoned]      - ☠ 중독         (BL)
 * @param {boolean}     [states.isDrunk]         - 🍾 취함 상태    (BR)
 * @param {boolean}     [states.isProtected]     - 🛡 수도승 보호  (TL)
 * @param {boolean}     [states.isDeadNight]     - 💀 밤 사망      (TC)
 * @param {boolean}     [states.isDeadExec]      - ⚔ 낮 처형      (TR)
 * @param {boolean}     [states.isSelectedCheck] - ✓ 나이트 선택   (TR)
 */
export function applySlotStateMarks(slot, slotPx, {
  isPoisoned      = false,
  isDrunk         = false,
  isProtected     = false,
  isDeadNight     = false,
  isDeadExec      = false,
  isSelectedCheck = false,
} = {}) {
  if (isPoisoned)      addSlotMark(slot, slotPx, 'poison')
  if (isDrunk)         addDrunkStatePill(slot, slotPx)
  if (isProtected)     addSlotMark(slot, slotPx, 'protected')
  if (isDeadNight)     addSlotMark(slot, slotPx, 'dead_night')
  if (isDeadExec)      addSlotMark(slot, slotPx, 'dead_exec')
  if (isSelectedCheck) addSlotMark(slot, slotPx, 'check')
}

// ── 준비 단계 마크 일괄 적용 ─────────────────────────────────
/**
 * @param {HTMLElement} slot
 * @param {number}      slotPx
 * @param {object}      opts
 * @param {boolean}     [opts.isDrunkWarn]       - ❗ 주정뱅이 drunkAs 미선택  (BC)
 * @param {boolean}     [opts.isBaron]           - 남작 슬롯 여부
 * @param {boolean}     [opts.hasBaron]          - 편성에 남작 존재 여부
 * @param {number}      [opts.requiredOutsiders] - 필요 아웃사이더 수
 * @param {number}      [opts.currentOutsiders]  - 현재 아웃사이더 수
 */
export function applySetupSlotMarks(slot, slotPx, {
  isDrunkWarn       = false,
  isBaron           = false,
  hasBaron          = false,
  requiredOutsiders = 0,
  currentOutsiders  = 0,
} = {}) {
  if (isDrunkWarn) addDrunkWarnPill(slot, slotPx)
  if (isBaron && hasBaron) {
    addCountMark(slot, slotPx, 'ML', currentOutsiders, requiredOutsiders)
  }
}
