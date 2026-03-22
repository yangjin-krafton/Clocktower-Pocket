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

// ── 8방향 포지션 CSS (슬롯 크기 비례) ───────────────────────
/** 배지 오버행: 슬롯 크기의 9%, 최소 3px 최대 8px */
function posOff(slotPx) {
  return Math.min(8, Math.max(3, Math.round(slotPx * 0.09)))
}

function posFor(slotPx) {
  const o = posOff(slotPx)
  return {
    TL: `top:-${o}px;left:-${o}px`,
    TC: `top:-${o}px;left:50%;transform:translateX(-50%)`,
    TR: `top:-${o}px;right:-${o}px`,
    ML: `top:50%;left:-${o}px;transform:translateY(-50%)`,
    MR: `top:50%;right:-${o}px;transform:translateY(-50%)`,
    BL: `bottom:-${o}px;left:-${o}px`,
    BC: `bottom:-${o}px;left:50%;transform:translateX(-50%)`,
    BR: `bottom:-${o}px;right:-${o}px`,
  }
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
 * @param {string}      opts.pos        - POS 키
 * @param {string}      [opts.text]     - 표시할 텍스트 (imgSrc와 택일)
 * @param {string}      [opts.imgSrc]   - 이미지 경로 — 지정 시 원형 아이콘 배지
 * @param {string}      opts.bg         - 배경색
 * @param {string}      opts.cls        - slot-mark--XXX 클래스명
 * @param {string}      [opts.glow]     - 글로우 색
 * @param {boolean}     [opts.pulse]    - 펄스 애니메이션 여부
 * @param {number}      [opts.scale]    - 배지 크기 배율 (기본 1)
 */
function createPillBadge(slot, slotPx, { pos, text = '', imgSrc = '', bg, cls, glow = '', pulse = false, scale = 1 }) {
  const h    = Math.round(badgeSz(slotPx) * scale)
  const fsPx = Math.max(8, Math.round(h * 0.62))

  // imgSrc 있으면 원형, 없으면 pill
  const isImg    = !!imgSrc
  const widthCSS = isImg ? `width:${h}px;` : `padding:0 ${Math.round(h * 0.3)}px;min-width:${h}px;`
  const radCSS   = `border-radius:${Math.round(h / 2)}px;`

  const el = document.createElement('div')
  el.className = `slot-mark slot-mark--${cls}`
  el.style.cssText = `
    position:absolute;${posFor(slotPx)[pos]};
    height:${h}px;${widthCSS}${radCSS}
    background:${bg};
    display:flex;align-items:center;justify-content:center;
    font-size:${fsPx}px;line-height:1;font-weight:700;
    color:#fff;white-space:nowrap;overflow:hidden;
    border:1px solid var(--surface);z-index:3;pointer-events:none;
    ${glow  ? `box-shadow:0 0 6px ${glow};`                        : ''}
    ${pulse ? 'animation:drunk-pulse 1.5s ease-in-out infinite;'   : ''}
  `

  if (isImg) {
    const img = document.createElement('img')
    img.src = imgSrc
    img.style.cssText = `width:80%;height:80%;object-fit:contain;`
    el.appendChild(img)
  } else {
    el.textContent = text
  }

  slot.appendChild(el)
  return el
}

// ── 남작 Pip 도트 (아웃사이더 충족 현황) ─────────────────────
/**
 * 슬롯 바로 아래 중앙에 required 개수만큼 점 표시.
 * 채운 점(●) = 현재 배정된 아웃사이더, 빈 점(○) = 미충족.
 * 미충족 상태의 빈 점은 pip-blink 애니메이션으로 깜빡입니다.
 */
function addBaronPips(slot, slotPx, current, required) {
  const dotSz   = Math.max(5, Math.round(slotPx * 0.11))
  const gap     = Math.round(dotSz * 0.6)
  const off     = posOff(slotPx)
  const isOk    = current >= required
  const borderW = Math.max(1, Math.round(dotSz * 0.2))

  const wrap = document.createElement('div')
  wrap.className = 'slot-mark slot-mark--baron'
  wrap.style.cssText = `
    position:absolute;
    bottom:-${off + dotSz + 3}px;
    left:50%;transform:translateX(-50%);
    display:flex;align-items:center;gap:${gap}px;
    pointer-events:none;z-index:3;
  `

  for (let i = 0; i < required; i++) {
    const filled = i < current
    const dot = document.createElement('div')
    dot.style.cssText = `
      width:${dotSz}px;height:${dotSz}px;flex-shrink:0;
      border-radius:50%;
      background:${filled ? 'var(--tl-light)' : 'transparent'};
      border:${borderW}px solid var(--tl-light);
      opacity:${filled ? '1' : '0.4'};
      ${filled ? 'box-shadow:0 0 4px rgba(91,179,198,0.7);' : ''}
      ${!filled && !isOk ? 'animation:pip-blink 1.2s ease-in-out infinite;' : ''}
    `
    wrap.appendChild(dot)
  }

  if (!isOk) slot.classList.add('gl-seat-slot--baron-warn')

  slot.appendChild(wrap)
  return wrap
}

// ── 취함 상태 아이콘 (게임 중 isDrunk) ───────────────────────
/**
 * 게임 중 isDrunk 상태 — 슬롯 우하단 원형 아이콘 배지
 */
function addDrunkStatePill(slot, slotPx) {
  return createPillBadge(slot, slotPx, {
    pos:    'BR',
    imgSrc: './asset/new/Icon_drunk.png',
    bg:     '#241c11',
    glow:   'rgba(37, 39, 44, 0.55)',
    cls:    'drunk',
    scale:  3,
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

// ── 중독 이펙트 (바닥 글로우 그라데이션 + 버블 파티클) ──────────
/**
 * 슬롯 하단에 녹색 독 글로우 그라데이션을 깔고,
 * 버블 파티클이 아래에서 위로 천천히 흘러올라가는 효과.
 * ☠ 배지(BL)도 함께 추가.
 */
function addPoisonEffect(slot, slotPx) {
  // ① 바닥 글로우 그라데이션
  const glow = document.createElement('div')
  glow.className = 'slot-mark slot-mark--poison-glow'
  glow.style.cssText = `
    position:absolute;inset:0;
    border-radius:inherit;
    background:linear-gradient(to top,
      rgba(22,163,74,0.55) 0%,
      rgba(22,163,74,0.20) 45%,
      transparent 72%);
    pointer-events:none;z-index:2;
  `
  slot.appendChild(glow)

  // ② 버블 파티클 5개
  for (let i = 0; i < 5; i++) {
    const sz      = Math.max(3, Math.round(slotPx * (0.07 + Math.random() * 0.07)))
    const leftPct = (12 + Math.random() * 68).toFixed(1)
    const delay   = (Math.random() * 3).toFixed(2)
    const dur     = (2.6 + Math.random() * 2.4).toFixed(2)
    const travel  = Math.round(slotPx * 1.35)

    const b = document.createElement('div')
    b.className = 'slot-mark slot-mark--poison-bubble'
    b.style.cssText = `
      position:absolute;
      bottom:3px;
      left:${leftPct}%;
      width:${sz}px;height:${sz}px;
      border-radius:50%;
      background:radial-gradient(circle at 35% 35%,rgba(134,239,172,0.95),rgba(22,163,74,0.55));
      box-shadow:0 0 ${Math.round(sz * 0.9)}px rgba(74,222,128,0.75);
      opacity:0;
      pointer-events:none;z-index:3;
      --pt:${travel}px;
      animation:poison-bubble ${dur}s ease-in ${delay}s infinite;
    `
    slot.appendChild(b)
  }
}

// ── 사망 / 처형 dim 오버레이 ─────────────────────────────────
/**
 * 밤 사망 — 어두운 빨간 dim / 낮 처형 — 블랙 dim
 * 배지 없이 슬롯 전체를 반투명 색으로 덮음
 * @param {HTMLElement} slot
 * @param {'night'|'exec'} type
 */
function addDeadEffect(slot, type) {
  const overlay = document.createElement('div')
  overlay.className = `slot-mark slot-mark--dead-${type}`
  overlay.style.cssText = `
    position:absolute;inset:0;
    border-radius:inherit;
    background:${type === 'exec'
      ? 'rgba(0,0,0,0.58)'
      : 'rgba(110,12,12,0.52)'};
    pointer-events:none;z-index:2;
  `
  slot.appendChild(overlay)
}

// ── 수도사 보호 이펙트 ───────────────────────────────────────
/**
 * TL 배지(🛡) + 슬롯 전체 방패 반투명 페이드 루프 오버레이.
 */
function addProtectedEffect(slot, slotPx) {
  // 슬롯 전체를 덮는 soldier.png 반투명 페이드 루프 오버레이
  const overlay = document.createElement('div')
  overlay.className = 'slot-mark slot-mark--protected-overlay'
  const imgPx = Math.round(slotPx * 0.72)
  overlay.style.cssText = `
    position:absolute;inset:0;
    border-radius:inherit;
    display:flex;align-items:center;justify-content:center;
    background:rgba(14,116,144,0.08);
    pointer-events:none;z-index:2;
    animation:shield-fade 2.4s ease-in-out infinite;
  `
  const img = document.createElement('img')
  img.src = './asset/new/Icon_soldier.png'
  img.style.cssText = `width:${imgPx}px;height:${imgPx}px;object-fit:contain;`
  overlay.appendChild(img)
  slot.appendChild(overlay)

  // 테두리 글로우 펄스
  slot.style.animation = 'shield-border 2.4s ease-in-out infinite'
}

// ── 집사 주인 프레임 태그 (슬롯 상단) ───────────────────────
/**
 * 집사 슬롯 상단 중앙에 왕관 + 주인 번호를 프레임 태그로 부착.
 * 슬롯 상단 테두리를 가로지르는 배너 형태.
 */
function addButlerMasterPill(slot, slotPx, masterId) {
  const h      = Math.max(16, Math.round(slotPx * 0.32))
  const fsPx   = Math.max(9,  Math.round(h * 0.58))
  const crPx   = Math.max(8,  Math.round(h * 0.52))
  const radius = Math.round(h * 0.45)

  const el = document.createElement('div')
  el.className = 'slot-mark slot-mark--butler_master'
  el.style.cssText = `
    position:absolute;
    top:-${Math.round(h * 0.52)}px;
    left:50%;
    transform:translateX(-50%);
    height:${h}px;
    padding:0 ${Math.round(h * 0.4)}px;
    border-radius:${radius}px;
    background:linear-gradient(135deg,#3b2460,#5b3a8e);
    border:1.5px solid rgba(167,139,250,0.7);
    box-shadow:0 0 8px rgba(139,92,246,0.6), 0 2px 4px rgba(0,0,0,0.4);
    display:flex;align-items:center;justify-content:center;
    gap:${Math.round(h * 0.18)}px;
    white-space:nowrap;
    pointer-events:none;
    z-index:4;
  `
  el.innerHTML = `
    <span style="font-size:${crPx}px;font-weight:600;color:#c4b5fd;line-height:1;letter-spacing:0.02em">주인</span>
    <span style="font-size:${fsPx}px;font-weight:700;color:#e9d5ff;line-height:1;letter-spacing:0.03em">${masterId}</span>
  `
  slot.appendChild(el)
  return el
}

// ── 임프 승계 모션 (공용) ───────────────────────────────────
/**
 * 슬롯 위에 이전 역할 아이콘이 둥둥 떠오르는 모션.
 * 임프 승계가 발생한 슬롯에 부착 (진홍의 여인, 독약꾼, 스파이 등 모든 케이스 공통).
 * @param {string} fromRoleIcon  이전 역할 icon 파일명 (예: 'scarletwoman.png')
 */
function addImpSuccessionFloat(slot, slotPx) {
  const iconPx = Math.round(slotPx * 0.72)

  const el = document.createElement('div')
  el.className = 'slot-mark slot-mark--imp-succession-float'
  el.style.cssText = `
    position:absolute;
    top:-${Math.round(iconPx * 0.72)}px;
    left:50%;
    width:${iconPx}px;height:${iconPx}px;
    pointer-events:none;z-index:5;
    filter:drop-shadow(0 0 8px rgba(220,38,38,0.85));
    animation:sw-imp-float 2.2s ease-in-out infinite;
  `
  // 슬롯은 이전 역할을 그대로 표시 — 떠있는 아이콘은 새로 얻은 임프 역할
  const img = document.createElement('img')
  img.src = './asset/new/Icon_imp.png'
  img.style.cssText = 'width:100%;height:100%;object-fit:contain;opacity:0.92;'
  el.appendChild(img)
  slot.appendChild(el)

  // 슬롯 테두리 붉은 펄스
  slot.style.animation = 'sw-imp-border 2.2s ease-in-out infinite'
  return el
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
  const POS      = posFor(slotPx)
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
  // baron 마크 제거 시 경고 클래스도 함께 정리
  if (!markType || markType === 'baron') {
    slot.classList.remove('gl-seat-slot--baron-warn')
  }
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
 * @param {number|null} [states.butlerMasterId]  - 👑 집사 주인 번호 (MR)
 */
export function applySlotStateMarks(slot, slotPx, {
  isPoisoned        = false,
  isDrunk           = false,
  isProtected       = false,
  isDeadNight       = false,
  isDeadExec        = false,
  isSelectedCheck   = false,
  butlerMasterId    = null,
  isImpSuccession = false,       // 임프 승계 슬롯 — imp 아이콘 둥둥 모션
} = {}) {
  if (isPoisoned)               addPoisonEffect(slot, slotPx)
  if (isDrunk)                  addDrunkStatePill(slot, slotPx)
  if (isProtected)              addProtectedEffect(slot, slotPx)
  if (isDeadNight)              addDeadEffect(slot, 'night')
  if (isDeadExec)               addDeadEffect(slot, 'exec')
  if (isSelectedCheck)          addSlotMark(slot, slotPx, 'check')
  if (butlerMasterId != null)   addButlerMasterPill(slot, slotPx, butlerMasterId)
  if (isImpSuccession)          addImpSuccessionFloat(slot, slotPx)
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
    addBaronPips(slot, slotPx, currentOutsiders, requiredOutsiders)
  }
}

// ── 키프레임 주입 ────────────────────────────────────────────
if (!document.getElementById('slot-mark-anim-style')) {
  const s = document.createElement('style')
  s.id = 'slot-mark-anim-style'
  s.textContent = `
@keyframes poison-bubble {
  0%   { transform:translateY(0)            scale(1.0); opacity:0;    }
  12%  { opacity:0.85; }
  80%  { opacity:0.30; }
  100% { transform:translateY(calc(var(--pt, 70px) * -1)) scale(0.35); opacity:0; }
}
@keyframes shield-fade {
  0%,100% { opacity:0;    }
  45%,55% { opacity:0.55; }
}
@keyframes shield-border {
  0%,100% { box-shadow:0 0 0 2px rgba(14,116,144,0.25), 0 0  8px rgba(14,116,144,0.15); }
  50%     { box-shadow:0 0 0 2px rgba(14,116,144,0.70), 0 0 18px rgba(14,116,144,0.45); }
}
@keyframes sw-imp-float {
  0%,100% { transform:translateX(-50%) translateY(0px);   opacity:0.80; }
  50%     { transform:translateX(-50%) translateY(-9px);  opacity:1.00; }
}
@keyframes sw-imp-border {
  0%,100% { box-shadow:0 0 0 2px rgba(220,38,38,0.20), 0 0  8px rgba(220,38,38,0.12); }
  50%     { box-shadow:0 0 0 2px rgba(220,38,38,0.75), 0 0 18px rgba(220,38,38,0.45); }
}
  `
  document.head.appendChild(s)
}
