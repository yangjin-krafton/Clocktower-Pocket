/**
 * C-10 SpyGrimoirePanel — 스파이 전용 그리모어 시각화 패널
 *
 * 호스트가 오발 미리보기에서 공개 방식을 실시간 설정하고 스파이에게 공개한다.
 *
 * 하단 컨트롤 4가지:
 *   모두 공개  — 모든 자리 역할 공개
 *   부분 공개  — 누를 때마다 30~70% 무작위 공개 (재랜덤)
 *   자리번호   — 누를 때마다 자리 번호 표시/숨김 토글
 *   상태표시   — 누를 때마다 SlotMark(사망·중독·보호 등) 표시/숨김 토글
 *
 * 사용:
 *   mountSpyGrimoirePanel({ players, engine, onNext })
 */
import { ROLES_BY_ID } from '../data/roles-tb.js'
import { calcOvalLayout, ovalSlotPos, drawOvalPieNumbers } from '../utils/ovalLayout.js'
import {
  TEAM_BORDER,
  createSeatOval, createSeatSlot,
  createRoleIconEl, createRoleNameLabel,
} from '../utils/SeatWheel.js'
import { applySlotStateMarks } from '../utils/SlotMark.js'

// ── 유틸 ─────────────────────────────────────────────────
function shuffle(arr) {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

// ────────────────────────────────────────────────────────
// 통합 스파이 그리모어 패널 (호스트 미리보기 + 설정)
// ────────────────────────────────────────────────────────
export function mountSpyGrimoirePanel({ players, engine, hostWarning, onReveal, onNext }) {
  const total = players.length

  // ── 상태 ──
  let slots      = _buildAllSlots(players)  // 초기: 모두 공개
  let showNums   = true
  let showStatus = false
  let activeMode = 'all'   // 'all' | 'partial'

  // ── 오버레이 ──
  const overlay = document.createElement('div')
  overlay.className = 'spy-grim-overlay'

  const panel = document.createElement('div')
  panel.className = 'spy-grim-panel'

  // 상단 레이블 (호스트 전용 안내)
  const topLabel = document.createElement('div')
  topLabel.className = 'spy-grim__label'
  topLabel.textContent = '🔒 호스트 전용 · 미리보기'
  panel.appendChild(topLabel)

  // 중독 / 취함 경고 배너
  if (hostWarning) {
    const warn = document.createElement('div')
    warn.className = 'oval-sel__host-warn'
    warn.textContent = hostWarning
    panel.appendChild(warn)
  }

  // 오발 래퍼
  const wrap = document.createElement('div')
  wrap.className = 'spy-grim__wrap'

  // reservedH=260: 레이블+컨트롤+버튼+여백
  const { slotPx, iconPx } = calcOvalLayout(total, 260, true)
  const oval = createSeatOval('width:min(100%,calc((100svh - 260px) * 2 / 3));')

  wrap.appendChild(oval)
  panel.appendChild(wrap)

  // ── 컨트롤 행 ──
  const ctrlRow = document.createElement('div')
  ctrlRow.className = 'spy-grim__ctrl-row'

  const btnReveal = _makeCtrlBtn('🔍', '공개 범위')
  const btnNums   = _makeCtrlBtn('🔢', '자리번호')
  const btnStatus = _makeCtrlBtn('🎭', '상태표시')

  ctrlRow.append(btnReveal, btnNums, btnStatus)
  panel.appendChild(ctrlRow)

  // ── 공개 버튼 (호스트 → 스파이 화면 전환) ──
  const nextBtn = document.createElement('button')
  nextBtn.className = 'spy-grim__next btn btn-primary'
  nextBtn.textContent = '[ 스파이에게 공개 ] →'
  nextBtn.addEventListener('click', () => _showSpyView())
  panel.appendChild(nextBtn)

  overlay.appendChild(panel)
  document.body.appendChild(overlay)

  // ── 초기 렌더 ──
  _syncCtrlBtns()
  _renderOval()

  // ── 호스트 설정 → 스파이 공개 화면 전환 ──
  function _showSpyView() {
    // 기존 호스트 오버레이 제거
    overlay.remove()

    // 플레이어 테마로 전환
    onReveal?.()

    // reveal-note 테마 오버레이 생성
    const pOverlay = document.createElement('div')
    pOverlay.className = 'reveal-note-overlay panel-overlay'

    const pPanel = document.createElement('div')
    pPanel.className = 'reveal-note-panel'

    // 상단 레이블
    const label = document.createElement('div')
    label.className = 'spy-grim__label'
    label.textContent = '👁 스파이 전용 화면'
    pPanel.appendChild(label)

    // 오발 래퍼 이전 (기존 렌더 결과 재사용)
    pPanel.appendChild(wrap)

    // 행동 안내
    const actionBar = document.createElement('div')
    actionBar.className = 'spy-grim__action'
    actionBar.innerHTML =
      `<span class="spy-grim__action-arrow">→</span>` +
      `<span>기억하고, 눈을 감으세요.</span>`
    pPanel.appendChild(actionBar)

    // 다음 버튼
    const confirmBtn = document.createElement('button')
    confirmBtn.className = 'reveal-note__next btn btn-primary'
    confirmBtn.textContent = '[ 호스트 ] 다음 →'
    confirmBtn.addEventListener('click', () => { pOverlay.remove(); onNext?.() })
    pPanel.appendChild(confirmBtn)

    pOverlay.appendChild(pPanel)
    document.body.appendChild(pOverlay)
  }

  // ── 컨트롤 이벤트 ──
  btnReveal.addEventListener('click', () => {
    if (activeMode === 'all') {
      slots = _buildPartialSlots(players)
      activeMode = 'partial'
    } else {
      slots = _buildAllSlots(players)
      activeMode = 'all'
    }
    _syncCtrlBtns()
    _renderOval()
  })

  btnNums.addEventListener('click', () => {
    showNums = !showNums
    _syncCtrlBtns()
    _renderOval()
  })

  btnStatus.addEventListener('click', () => {
    showStatus = !showStatus
    _syncCtrlBtns()
    _renderOval()
  })

  return () => overlay.remove()

  // ── 오발 재렌더 ──
  function _renderOval() {
    oval.innerHTML = ''
    slots.forEach((slot, i) => {
      const { x, y } = ovalSlotPos(i, total)
      const role     = slot.revealed && slot.role ? ROLES_BY_ID[slot.role] : null

      // 상태표시 켜짐 시: 주정뱅이 drunkAs 아이콘 + 모션 배지 처리
      const p             = (showStatus && slot.revealed) ? players.find(pp => pp.id === slot.id) : null
      const isDrunkWithAs = !!(p?.role === 'drunk' && p.drunkAs)
      const displayRole   = isDrunkWithAs ? ROLES_BY_ID[p.drunkAs] : role

      const borderColor = role ? (TEAM_BORDER[role.team] || 'var(--lead2)') : 'var(--lead2)'

      const slotEl = createSeatSlot(x, y, slotPx, {
        borderColor,
        borderWidth: 2,
        isAssigned:  slot.revealed,
        cursor:      'default',
      })

      // drunkBadge: 상태표시 켜짐 + drunkAs 배정된 주정뱅이 → 회전 페이드 모션 표시
      slotEl.appendChild(createRoleIconEl(displayRole, iconPx, {
        fallbackEmoji: '?',
        drunkBadge:    isDrunkWithAs,
      }))
      if (slot.revealed && displayRole) slotEl.appendChild(createRoleNameLabel(displayRole, slotPx))

      if (showStatus && p && slot.revealed) {
        applySlotStateMarks(slotEl, slotPx, {
          isPoisoned:     p.isPoisoned,
          isDrunk:        p.isDrunk && !isDrunkWithAs,
          isProtected:    p.id === engine?.monkProtect,
          isDeadNight:    p.status === 'dead',
          isDeadExec:     p.status === 'executed',
          butlerMasterId: engine?.butlerMasters?.[p.id] ?? null,
        })
      }

      oval.appendChild(slotEl)
    })

    // 파이 분할 벽 (슬롯 너머까지 연장, 자리번호 미표시 / 미공개 슬롯 흐리게)
    drawOvalPieNumbers(oval, total, {
      outerR: 116, showNumbers: false,
      slices: slots.map(slot => slot.revealed ? {} : { opacity: 0.2 }),
    })
  }

  // ── 컨트롤 버튼 활성 상태 동기화 ──
  function _syncCtrlBtns() {
    // 공개 범위: 아이콘으로 현재 모드 표시, 부분 공개 시 활성 강조
    btnReveal.querySelector('.spy-grim__ctrl-icon').textContent = activeMode === 'all' ? '🔍' : '👁'
    btnReveal.classList.toggle('spy-grim__ctrl-btn--active', activeMode === 'partial')
    btnNums.classList.toggle('spy-grim__ctrl-btn--active',   showNums)
    btnStatus.classList.toggle('spy-grim__ctrl-btn--active', showStatus)
  }
}

// ────────────────────────────────────────────────────────
// 내부: 슬롯 데이터 생성
// ────────────────────────────────────────────────────────
function _buildAllSlots(players) {
  return players.map(p => ({ id: p.id, role: p.role, revealed: true }))
}

function _buildPartialSlots(players) {
  const total = players.length
  // 30~70% 무작위 공개
  const min   = Math.max(1, Math.floor(total * 0.30))
  const max   = Math.min(total - 1, Math.ceil(total * 0.70))
  const count = min + Math.floor(Math.random() * (max - min + 1))
  const revealedIdx = new Set(shuffle([...Array(total).keys()]).slice(0, count))
  return players.map((p, i) => ({ id: p.id, role: p.role, revealed: revealedIdx.has(i) }))
}

// ────────────────────────────────────────────────────────
// 내부: 컨트롤 버튼 생성
// ────────────────────────────────────────────────────────
function _makeCtrlBtn(icon, label) {
  const btn = document.createElement('button')
  btn.className = 'spy-grim__ctrl-btn'
  btn.innerHTML = `<span class="spy-grim__ctrl-icon">${icon}</span><span>${label}</span>`
  return btn
}

// ────────────────────────────────────────────────────────
// 스타일 주입
// ────────────────────────────────────────────────────────
if (!document.getElementById('spy-grimoire-style')) {
  const style = document.createElement('style')
  style.id = 'spy-grimoire-style'
  style.textContent = `

/* ── 그리모어 공개 화면 ── */
.spy-grim-overlay {
  position: fixed; inset: 0 0 56px 0;
  background: var(--bg);
  z-index: 210;
  display: flex; align-items: stretch;
}
.spy-grim-panel {
  width: 100%; max-width: var(--app-max-width);
  margin: 0 auto;
  display: flex; flex-direction: column;
  padding: 10px 16px 14px; gap: 8px;
  background: radial-gradient(ellipse 80% 50% at 50% 15%, rgba(92,83,137,0.12) 0%, transparent 60%);
}
.spy-grim__label {
  font-size: 0.62rem; color: var(--text4);
  text-align: center; letter-spacing: 0.05em;
}

.spy-grim__wrap {
  flex: 1; min-height: 0;
  display: flex; align-items: center; justify-content: center;
  overflow: hidden;
}
/* .gl-seat-oval / .gl-seat-slot / .gl-seat-num → css/seat-slot.css */

/* ── 컨트롤 행 ── */
.spy-grim__ctrl-row {
  display: flex; gap: 8px;
  flex-shrink: 0;
}
.spy-grim__ctrl-btn {
  flex: 1;
  display: flex; flex-direction: column; align-items: center; gap: 3px;
  padding: 9px 4px 8px;
  background: var(--surface); border: 2px solid var(--lead2);
  border-radius: 10px;
  font-size: 0.68rem; font-weight: 600; color: var(--text3);
  cursor: pointer; transition: border-color 0.15s, background 0.15s, color 0.15s;
  -webkit-tap-highlight-color: transparent;
}
.spy-grim__ctrl-btn:active { transform: scale(0.95); }
.spy-grim__ctrl-icon { font-size: 1.2rem; line-height: 1; }
.spy-grim__ctrl-btn--active {
  border-color: var(--gold2);
  background: rgba(212,168,40,0.08);
  color: var(--gold2);
}

/* ── 행동 안내 ── */
.spy-grim__action {
  flex-shrink: 0;
  display: flex;
  align-items: flex-start;
  gap: 8px;
  padding: 10px 14px;
  border-top: 1px solid var(--lead2);
}
.spy-grim__action-arrow {
  font-size: 0.9rem;
  color: var(--text4);
  flex-shrink: 0;
  margin-top: 1px;
}
.spy-grim__action span:last-child {
  font-size: clamp(0.9rem, 2.8vw, 1.1rem);
  color: var(--text3);
  line-height: 1.6;
  word-break: keep-all;
}

/* ── 다음 버튼 ── */
.spy-grim__next {
  flex-shrink: 0;
  padding: 14px; font-size: 0.9rem; font-weight: 700;
  border-radius: 10px; min-height: 52px;
  opacity: 0.65;
}
.spy-grim__next:hover { opacity: 1; }
  `
  document.head.appendChild(style)
}
