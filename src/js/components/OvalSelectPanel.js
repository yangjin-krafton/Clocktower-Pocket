/**
 * C-08 OvalSelectPanel — 오발 좌석 배치 대상 선택 패널
 *
 * 참가자가 대상을 지목할 때 실제 테이블 좌석 배치와 동일한 오발 링으로 선택.
 * - 본인 자리(selfSeatId)가 항상 하단 중앙(6시)에 위치
 * - 번호만 표시 (이름/역할 아이콘 없음)
 *
 * @param {Object} data
 *   title       {string}    역할명
 *   roleIcon    {string}    역할 아이콘
 *   roleTeam    {string}    진영 색상용
 *   players     {Object[]}  전체 플레이어 배열 { id, status }
 *   selfSeatId  {number}    본인 자리번호 (6시 배치)
 *   maxSelect   {number}    최대 선택 수 (기본 1)
 *   onConfirm   {Function}  onConfirm(selectedIds[])
 */

import { calcSlotMetrics, ovalSlotPos, ovalSelfRotOffset } from '../utils/ovalLayout.js'

const TEAM_TITLE_COLOR = {
  town:    'var(--bl-light)',
  outside: 'var(--tl-light)',
  minion:  'var(--rd-light)',
  demon:   'var(--rd-light)',
}

export function mountOvalSelectPanel(data) {
  const {
    title, roleIcon = '🎯', roleTeam,
    players = [], selfSeatId,
    maxSelect = 1, onConfirm,
  } = data

  let selectedIds = []

  const overlay = document.createElement('div')
  overlay.className = 'oval-sel-overlay'

  const panel = document.createElement('div')
  panel.className = 'oval-sel-panel'

  // ── 헤더 ──
  const hdr = document.createElement('div')
  hdr.className = 'oval-sel__hdr'

  const iconEl = document.createElement('span')
  iconEl.className = 'oval-sel__icon'
  if (roleIcon && roleIcon.endsWith('.png')) {
    const img = document.createElement('img')
    img.src = `./asset/icons/${roleIcon}`
    img.alt = title
    img.className = 'oval-sel__icon-img'
    iconEl.appendChild(img)
  } else {
    iconEl.textContent = roleIcon
  }

  const titleWrap = document.createElement('div')
  titleWrap.className = 'oval-sel__title-wrap'

  const titleEl = document.createElement('div')
  titleEl.className = 'oval-sel__title'
  titleEl.textContent = title
  if (roleTeam && TEAM_TITLE_COLOR[roleTeam]) {
    titleEl.style.color = TEAM_TITLE_COLOR[roleTeam]
  }

  const hintEl = document.createElement('div')
  hintEl.className = 'oval-sel__hint'
  hintEl.textContent = '자리를 탭해 선택하세요'

  titleWrap.appendChild(titleEl)
  titleWrap.appendChild(hintEl)
  hdr.appendChild(iconEl)
  hdr.appendChild(titleWrap)
  panel.appendChild(hdr)

  // ── 오발 래퍼 ──
  const wrap = document.createElement('div')
  wrap.className = 'oval-sel__wrap'

  const oval = document.createElement('div')
  oval.className = 'oval-sel__oval'

  // 오발 좌표 계산 — selfSeatId 를 6시(하단 중앙)에 배치
  const total     = players.length
  const rotOffset = ovalSelfRotOffset(selfSeatId, total)

  // 컨테이너 너비 기반 슬롯 크기 (CSS oval 너비 = appContent.width - 32px padding)
  const appContent = document.getElementById('app-content')
  const containerW = appContent ? (appContent.getBoundingClientRect().width - 32) : 300
  const { slotPx } = calcSlotMetrics(total, containerW, 40)   // minSlot=40

  // 중앙 카운터
  const center = document.createElement('div')
  center.className = 'oval-sel__center'

  function updateCenter() {
    if (selectedIds.length === 0) {
      center.innerHTML = `<div class="oval-sel__cnt-label">선택하세요</div><div class="oval-sel__cnt-num">0 / ${maxSelect}</div>`
    } else {
      center.innerHTML = `<div class="oval-sel__cnt-check">✓ ${selectedIds.map(id => id + '번').join(', ')}</div><div class="oval-sel__cnt-num">${selectedIds.length} / ${maxSelect}</div>`
    }
  }

  function buildSlots() {
    // 기존 슬롯 제거 (center 제외)
    Array.from(oval.children).forEach(c => { if (c !== center) c.remove() })

    players.forEach((p, i) => {
      const { x, y } = ovalSlotPos(i, total, rotOffset)

      const isSelf     = p.id === selfSeatId
      const isDead     = p.status !== 'alive'
      const isSelected = selectedIds.includes(p.id)
      const canSelect  = !isSelf && !isDead

      const slot = document.createElement('div')
      slot.className = 'oval-sel__slot'
        + (isSelf     ? ' oval-sel__slot--self'     : '')
        + (isSelected ? ' oval-sel__slot--selected' : '')
        + (isDead     ? ' oval-sel__slot--dead'     : '')

      slot.style.cssText = `
        left:${x.toFixed(2)}%;
        top:${y.toFixed(2)}%;
        width:${slotPx}px;
        height:${slotPx}px;
      `

      const topLabel   = isSelf ? '나' : (isSelected ? '✓' : '')
      const numFontPx  = Math.max(16, Math.round(slotPx * 0.42))
      const topFontPx  = Math.max(8,  Math.round(slotPx * 0.14))
      const unitFontPx = Math.max(8,  Math.round(slotPx * 0.16))
      slot.innerHTML = `
        <span class="oval-sel__slot-top" style="font-size:${topFontPx}px">${topLabel}</span>
        <span class="oval-sel__slot-num" style="font-size:${numFontPx}px">${p.id}</span>
        <span class="oval-sel__slot-unit" style="font-size:${unitFontPx}px">번</span>
      `

      if (canSelect) {
        slot.addEventListener('click', () => {
          if (isSelected) {
            selectedIds = selectedIds.filter(id => id !== p.id)
          } else {
            if (selectedIds.length >= maxSelect) {
              if (maxSelect === 1) selectedIds = []
              else return
            }
            selectedIds.push(p.id)
          }
          buildSlots()
          updateCenter()
          confirmBtn.disabled = selectedIds.length === 0
        })
      }

      oval.appendChild(slot)
    })

    oval.appendChild(center)
  }

  updateCenter()
  buildSlots()
  wrap.appendChild(oval)
  panel.appendChild(wrap)

  // ── 확인 버튼 ──
  const confirmBtn = document.createElement('button')
  confirmBtn.className = 'oval-sel__confirm btn btn-primary'
  confirmBtn.textContent = '✅ 확인'
  confirmBtn.disabled = true
  confirmBtn.addEventListener('click', () => {
    overlay.remove()
    onConfirm && onConfirm([...selectedIds])
  })
  panel.appendChild(confirmBtn)

  overlay.appendChild(panel)
  document.body.appendChild(overlay)

  return () => overlay.remove()
}

if (!document.getElementById('oval-select-panel-style')) {
  const style = document.createElement('style')
  style.id = 'oval-select-panel-style'
  style.textContent = `
.oval-sel-overlay {
  position: fixed;
  inset: 0;
  background: var(--bg);
  z-index: 200;
  display: flex;
  align-items: stretch;
}
.oval-sel-panel {
  width: 100%;
  max-width: var(--app-max-width);
  margin: 0 auto;
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 20px 16px;
}
.oval-sel__hdr {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-shrink: 0;
}
.oval-sel__icon {
  font-size: 2.2rem;
  width: 48px;
  height: 48px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}
.oval-sel__icon-img {
  width: 100%;
  height: 100%;
  object-fit: contain;
}
.oval-sel__title-wrap { flex: 1; }
.oval-sel__title {
  font-family: 'Noto Serif KR', serif;
  font-size: 1.2rem;
  font-weight: 700;
  color: var(--gold2);
}
.oval-sel__hint { font-size: 0.72rem; color: var(--text3); margin-top: 2px; }

.oval-sel__wrap {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 0;
  overflow: hidden;
}
.oval-sel__oval {
  position: relative;
  /* max-height: 100% → flex 부모 높이에 맞게 제한 */
  /* aspect-ratio가 max-height 제약 시 width를 자동 축소 */
  width: 100%;
  max-height: 100%;
  aspect-ratio: 2 / 3;
  margin: 0 auto;
}

/* 슬롯 공통 */
.oval-sel__slot {
  position: absolute;
  transform: translate(-50%, -50%);
  border-radius: 10px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0;
  cursor: pointer;
  border: 2px solid var(--lead2);
  background: var(--surface);
  transition: transform 0.12s, box-shadow 0.12s, border-color 0.12s;
  -webkit-tap-highlight-color: transparent;
  user-select: none;
}
.oval-sel__slot:active { transform: translate(-50%, -50%) scale(0.88) !important; }

/* 선택됨 */
.oval-sel__slot--selected {
  border-color: var(--gold) !important;
  background: rgba(212,168,40,0.1) !important;
  box-shadow: 0 0 0 2px rgba(212,168,40,0.3), 0 0 12px rgba(212,168,40,0.35);
}
/* 본인 */
.oval-sel__slot--self {
  border-color: var(--gold2) !important;
  background: rgba(212,168,40,0.05) !important;
  cursor: default;
}
/* 사망 */
.oval-sel__slot--dead {
  opacity: 0.3;
  cursor: default;
}

.oval-sel__slot-top {
  font-size: 0.58rem;
  color: var(--gold);
  line-height: 1;
  min-height: 0.7rem;
}
.oval-sel__slot-num {
  font-size: 1.6rem;
  font-weight: 700;
  color: var(--gold2);
  line-height: 1;
}
.oval-sel__slot-unit {
  font-size: 0.6rem;
  color: var(--text4);
  line-height: 1;
}

/* 중앙 카운터 */
.oval-sel__center {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  pointer-events: none;
  z-index: 5;
}
.oval-sel__cnt-label { font-size: 0.68rem; color: var(--text4); }
.oval-sel__cnt-check { font-size: 0.72rem; color: var(--gold2); font-weight: 600; }
.oval-sel__cnt-num   { font-size: 0.62rem; color: var(--tl-base); }

/* 확인 버튼 */
.oval-sel__confirm {
  flex-shrink: 0;
  padding: 14px;
  font-size: 0.9rem;
  font-weight: 700;
  border-radius: 10px;
  min-height: 52px;
}
.oval-sel__confirm:disabled { opacity: 0.4; cursor: default; }
  `
  document.head.appendChild(style)
}
