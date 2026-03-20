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
 * 각 항목:
 *   pos   — 포지션 키 (POS 맵 참조)
 *   icon  — 배지 내 표시할 문자/이모지
 *   bg    — 배지 배경색
 *   color — 텍스트 색 (기본 #fff)
 *   glow  — box-shadow 글로우 색 (선택)
 *   fw    — font-weight (선택)
 */
export const MARK_DEFS = {
  // ── 상태 이상 (좌하·우하) ──
  poison:      { pos: 'BL', icon: '☠',  bg: '#16a34a', glow: 'rgba(22,163,74,0.6)'  },
  drunk:       { pos: 'BR', icon: '🍾', bg: '#7c3aed'                                 },

  // ── 보호 효과 (좌상) ──
  protected:   { pos: 'TL', icon: '🛡', bg: '#0e7490', glow: 'rgba(14,116,144,0.5)' },

  // ── 사망 종류 (상단 중·우) ──
  dead_night:  { pos: 'TC', icon: '💀', bg: '#374151'                                 },
  dead_exec:   { pos: 'TR', icon: '⚔',  bg: '#b91c1c', glow: 'rgba(185,28,28,0.5)'  },

  // ── UI 인터랙션 (우상 — NightAction 선택) ──
  check:       { pos: 'TR', icon: '✓',  bg: 'var(--gold2)', color: '#000', fw: '700' },
}

// ── 배지 크기 계산 ───────────────────────────────────────────
function badgeSz(slotPx) {
  return Math.max(14, Math.round(slotPx * 0.24))
}

// ── 단일 마크 추가 ───────────────────────────────────────────
/**
 * 슬롯에 마크 배지를 하나 추가합니다.
 *
 * @param {HTMLElement} slot
 * @param {number}      slotPx
 * @param {string}      markType - MARK_DEFS 키 (또는 customDef 사용 시 임의 키)
 * @param {object}      [customDef] - MARK_DEFS에 없는 커스텀 마크 정의
 * @returns {HTMLElement|null}
 */
export function addSlotMark(slot, slotPx, markType, customDef) {
  const def = customDef ?? MARK_DEFS[markType]
  if (!def) return null

  const sz = badgeSz(slotPx)
  const el = document.createElement('div')
  el.className = `slot-mark slot-mark--${markType}`

  const posCSS  = POS[def.pos] ?? POS.TR
  const glowCSS = def.glow ? `box-shadow:0 0 6px ${def.glow};` : ''
  const colorCSS = `color:${def.color ?? '#fff'};`
  const fwCSS    = def.fw ? `font-weight:${def.fw};` : ''

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
 * 슬롯에서 특정 마크(또는 전체 마크)를 제거합니다.
 *
 * @param {HTMLElement} slot
 * @param {string}      [markType] - 생략 시 모든 .slot-mark 제거
 */
export function removeSlotMark(slot, markType) {
  const sel = markType ? `.slot-mark--${markType}` : '.slot-mark'
  slot.querySelectorAll(sel).forEach(el => el.remove())
}

// ── 상태 일괄 적용 ───────────────────────────────────────────
/**
 * 게임 상태 객체를 받아 해당하는 마크를 한 번에 적용합니다.
 *
 * @param {HTMLElement} slot
 * @param {number}      slotPx
 * @param {object}      states
 * @param {boolean}     [states.isPoisoned]      - ☠ 중독  (BL)
 * @param {boolean}     [states.isDrunk]         - 🍾 취함  (BR)
 * @param {boolean}     [states.isProtected]     - 🛡 수도승 보호  (TL)
 * @param {boolean}     [states.isDeadNight]     - 💀 밤 사망  (TC)
 * @param {boolean}     [states.isDeadExec]      - ⚔ 낮 처형  (TR)
 * @param {boolean}     [states.isSelectedCheck] - ✓ 나이트 선택  (TR)
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
  if (isDrunk)         addSlotMark(slot, slotPx, 'drunk')
  if (isProtected)     addSlotMark(slot, slotPx, 'protected')
  if (isDeadNight)     addSlotMark(slot, slotPx, 'dead_night')
  if (isDeadExec)      addSlotMark(slot, slotPx, 'dead_exec')
  if (isSelectedCheck) addSlotMark(slot, slotPx, 'check')
}

// ── 남작 아웃사이더 가이드 (re-export) ────────────────────────
export { addBaronOutsiderGuide } from '../components/BaronOutsiderGuide.js'
