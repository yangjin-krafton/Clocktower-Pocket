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

import { calcSlotMetrics, ovalSlotPos } from '../utils/ovalLayout.js'
import { createSeatOval, createSeatNumLabel, buildOvalSlots } from '../utils/SeatWheel.js'

/** 능력 텍스트 핵심 용어 염색 */
function highlightAbility(text) {
  if (!text) return ''
  return text
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/(\d+명)/g, '<b style="color:var(--gold2);">$1</b>')
    .replace(/(3표|음수)/g, '<b style="color:var(--gold2);">$1</b>')
    .replace(/(마을 주민)/g, '<b style="color:var(--bl-light);">$1</b>')
    .replace(/(아웃사이더)/g, '<b style="color:var(--tl-light);">$1</b>')
    .replace(/(미니언)/g, '<b style="color:var(--rd-light);">$1</b>')
    .replace(/(임프|악 플레이어)/g, '<b style="color:var(--rd-light);">$1</b>')
    .replace(/(사망|처치|처형|즉사|즉시)/g, '<b style="color:var(--rd-light);">$1</b>')
    .replace(/(보호|면역)/g, '<b style="color:var(--tl-light);">$1</b>')
    .replace(/(투표 토큰|투표권|투표)/g, '<b style="color:var(--gold2);">$1</b>')
}

export function mountOvalSelectPanel(data) {
  const {
    title, roleIcon = '🎯', roleTeam, ability,
    players = [], selfSeatId,
    maxSelect = 1, onConfirm, onBack, backLabel = '← 되돌리기', hostWarning, engine,
  } = data

  let selectedIds = []

  const overlay = document.createElement('div')
  overlay.className = 'oval-sel-overlay panel-overlay'

  const panel = document.createElement('div')
  panel.className = 'oval-sel-panel'

  // ── 헤더 ──
  const hdr = document.createElement('div')
  hdr.className = 'oval-sel__hdr'

  const iconEl = document.createElement('span')
  iconEl.className = 'oval-sel__icon'
  if (roleIcon && roleIcon.endsWith('.webp')) {
    const img = document.createElement('img')
    img.src = `./asset/new/Icon_${roleIcon}`
    img.alt = title
    img.className = 'oval-sel__icon-img'
    iconEl.appendChild(img)
  } else {
    iconEl.textContent = roleIcon
  }

  const titleWrap = document.createElement('div')
  titleWrap.className = 'oval-sel__title-wrap'

  const titleEl = document.createElement('div')
  titleEl.className = 'oval-sel__title panel-role-title'
  titleEl.textContent = title
  if (roleTeam) titleEl.classList.add(`role-name-${roleTeam}`)

  const hintEl = document.createElement('div')
  hintEl.className = 'oval-sel__hint'
  hintEl.textContent = `자리를 탭해 선택하세요 (최대 ${maxSelect}개)`

  titleWrap.appendChild(titleEl)
  if (ability) {
    const abilityEl = document.createElement('div')
    abilityEl.className = 'oval-sel__ability'
    abilityEl.innerHTML = highlightAbility(ability)
    titleWrap.appendChild(abilityEl)
  }
  titleWrap.appendChild(hintEl)
  hdr.appendChild(iconEl)
  hdr.appendChild(titleWrap)
  panel.appendChild(hdr)

  // ── 호스트 경고 배너 ──
  if (hostWarning) {
    const warn = document.createElement('div')
    warn.className = 'oval-sel__host-warn'
    warn.textContent = hostWarning
    panel.appendChild(warn)
  }

  // ── gl-seat-oval + wrap ──
  const wrap = document.createElement('div')
  wrap.className = 'oval-sel__wrap'
  const oval = createSeatOval('width:100%;max-height:100%;aspect-ratio:2/3;margin:0 auto;')

  const total = players.length

  // 컨테이너 너비 기반 슬롯 크기 (CSS oval 너비 = appContent.width - 32px padding)
  const appContent = document.getElementById('app-content')
  const containerW = appContent ? (appContent.getBoundingClientRect().width - 32) : 300
  const { slotPx } = calcSlotMetrics(total, containerW, 40)   // minSlot=40
  const iconPx = Math.round(slotPx * 0.6)

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
    Array.from(oval.children).forEach(c => { if (c !== center) c.remove() })

    buildOvalSlots(oval, players, slotPx, iconPx, {
      engine,
      selfSeatId,
      selectedIds,
      onSlotClick: (p) => {
        if (p.status !== 'alive') return
        const isSelected = selectedIds.includes(p.id)
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
      },
    })

    // 자리 번호 레이블 (host/app.js 와 동일)
    players.forEach((p, i) => {
      const { x, y } = ovalSlotPos(i, total)
      oval.appendChild(createSeatNumLabel(x, y, slotPx, p.id, { dimmed: p.status !== 'alive' }))
    })

    oval.appendChild(center)
  }

  updateCenter()
  buildSlots()

  wrap.appendChild(oval)
  panel.appendChild(wrap)

  // ── 하단 버튼 행 ──
  const btnRow = document.createElement('div')
  btnRow.className = 'oval-sel__btn-row'

  if (onBack) {
    const backBtn = document.createElement('button')
    backBtn.className = 'btn oval-sel__back-btn'
    backBtn.textContent = backLabel
    backBtn.addEventListener('click', () => {
      overlay.remove()
      onBack()
    })
    btnRow.appendChild(backBtn)
  }

  const confirmBtn = document.createElement('button')
  confirmBtn.className = 'btn btn-primary panel-confirm-btn'
  confirmBtn.textContent = '✅ 확인'
  confirmBtn.disabled = true
  confirmBtn.addEventListener('click', () => {
    overlay.remove()
    onConfirm && onConfirm([...selectedIds])
  })
  btnRow.appendChild(confirmBtn)
  panel.appendChild(btnRow)

  overlay.appendChild(panel)
  document.body.appendChild(overlay)

  return () => overlay.remove()
}

if (!document.getElementById('oval-select-panel-style')) {
  const style = document.createElement('style')
  style.id = 'oval-select-panel-style'
  style.textContent = `
/* .panel-overlay (theme.css): position fixed, inset, bg, z-index, display flex */
.oval-sel-overlay { align-items: stretch; }
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
.oval-sel__host-warn {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 14px;
  border-radius: 10px;
  background: rgba(220, 38, 38, 0.12);
  border: 1.5px solid rgba(220, 38, 38, 0.45);
  font-size: 0.78rem;
  font-weight: 700;
  color: #fca5a5;
  letter-spacing: 0.02em;
  box-shadow: 0 0 10px rgba(220, 38, 38, 0.18);
  animation: warn-pulse 1.8s ease-in-out infinite;
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
/* .panel-role-title (theme.css): 진영별 색상 공통 처리 */
.oval-sel__title {
  font-family: 'Noto Serif KR', serif;
  font-size: 1.2rem;
  font-weight: 700;
}
.oval-sel__ability {
  font-size: 0.72rem;
  color: var(--text2);
  margin-top: 4px;
  line-height: 1.5;
}
.oval-sel__hint { font-size: 0.68rem; color: var(--text4); margin-top: 3px; }

.oval-sel__wrap {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 0;
  overflow: hidden;
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

/* 하단 버튼 행 */
.oval-sel__btn-row {
  display: flex;
  gap: 8px;
  flex-shrink: 0;
  width: 100%;
}
.oval-sel__btn-row .panel-confirm-btn { flex: 1; }
.oval-sel__back-btn {
  flex-shrink: 0;
  padding: 12px 16px;
  font-size: 0.82rem;
  font-weight: 600;
  border-radius: 10px;
  background: var(--surface2);
  border: 1.5px solid var(--lead2);
  color: var(--text3);
  white-space: nowrap;
  opacity: 0.75;
}
.oval-sel__back-btn:hover,
.oval-sel__back-btn:active { opacity: 1; border-color: var(--text3); color: var(--text); }

/* .panel-confirm-btn (theme.css): 확인 버튼 공통 스타일 */
  `
  document.head.appendChild(style)
}
