/**
 * C-07b RevealEditPanel — 호스트 편집 + 참가자 공개 통합 화면
 *
 * ┌─ 편집 모드 (호스트) ──────────────────────────────────────────┐
 * │  자리 배치 Oval — 탭해서 공개 대상 선택/해제                  │
 * │  메시지 textarea — 공개 문구 수정                             │
 * │  [편집 완료 → 공개] → 공개 모드로 인-플레이스 전환           │
 * └───────────────────────────────────────────────────────────────┘
 * ┌─ 공개 모드 (참가자) ──────────────────────────────────────────┐
 * │  동일한 Oval — 선택 자리만 강조, 역할 아이콘 비표시           │
 * │  공개 메시지 텍스트 블록                                      │
 * │  [호스트] 다음 → 버튼                                        │
 * └───────────────────────────────────────────────────────────────┘
 *
 * @param {Object} data
 *   roleIcon    {string}    역할 아이콘 (emoji or .png)
 *   roleName    {string}    역할명
 *   roleTeam    {string}    진영 ('town'|'outside'|'minion'|'demon'|null)
 *   roleAbility {string}    능력 설명 (선택)
 *   message     {string}    공개 메시지 초기값
 *   players     {Object[]}  초기 선택 번호 [{id}]
 *   allPlayers  {Object[]}  전체 플레이어 (Oval 렌더링용)
 *   hint        {string}    공개 후 안내 (선택)
 *   action      {string}    행동 안내 (선택)
 *   draft       {Object}    { message?, players? } override 초기값
 *   onNext      {Function}  공개 완료 콜백
 */

import { calcOvalLayout, ovalSlotPos } from '../utils/ovalLayout.js'
import { TEAM_BORDER, createSeatOval, createSeatSlot, createRoleIconEl, createSeatNumLabel } from '../utils/SeatWheel.js'
import { ROLES_BY_ID } from '../data/roles-tb.js'

const TEAM_COLORS = {
  town:    { color: 'var(--bl-light)',  shadow: 'rgba(46,74,143,0.5)',   glow: 'rgba(46,74,143,0.15)' },
  outside: { color: 'var(--tl-light)',  shadow: 'rgba(91,179,198,0.5)',  glow: 'rgba(91,179,198,0.12)' },
  minion:  { color: 'var(--rd-light)',  shadow: 'rgba(140,48,48,0.6)',   glow: 'rgba(140,48,48,0.18)' },
  demon:   { color: 'var(--rd-light)',  shadow: 'rgba(110,27,31,0.8)',   glow: 'rgba(110,27,31,0.22)' },
  default: { color: 'var(--gold2)',     shadow: 'rgba(212,168,40,0.4)',  glow: 'rgba(212,168,40,0.1)' },
}

export function mountRevealEditPanel(data) {
  const {
    roleIcon, roleName, roleTeam, roleAbility,
    message, players = [], allPlayers,
    action, onNext,
    draft,
  } = data

  const tc = TEAM_COLORS[roleTeam] || TEAM_COLORS.default

  // 편집 중 선택 상태 (edit 모드 전용)
  const selectedIds = new Set((draft?.players ?? players).map(p => p.id))

  // ── 오버레이 + 패널 뼈대 ──
  const overlay = document.createElement('div')
  overlay.className = 'reveal-overlay panel-overlay reveal-edit-overlay'

  const panel = document.createElement('div')
  panel.className = 'reveal-edit-panel'
  panel.style.background = `radial-gradient(ellipse 100% 50% at 50% 0%, ${tc.glow} 0%, transparent 55%)`

  // ── Oval 치수 사전 계산 (편집/공개 공통) ──
  const total = allPlayers?.length || 0
  const ovalMetrics = total > 0 ? calcOvalLayout(total, 344, true) : null

  // ────────────────────────────────────────────────────────────────
  // 편집 모드
  // ────────────────────────────────────────────────────────────────
  const buildEditMode = () => {
    panel.innerHTML = ''

    // 상단 바
    const topBar = _topBar('✏️ 편집 중', '🌙 밤 — 공개 전')
    panel.appendChild(topBar)

    // 역할 헤더
    panel.appendChild(_roleHeader(roleIcon, roleName, roleAbility, tc))

    // 선택 카운트
    const countEl = document.createElement('div')
    countEl.className = 'reveal-edit__count'
    const updateCount = () => {
      countEl.textContent = selectedIds.size === 0
        ? '자리를 탭해 공개 대상을 선택하세요'
        : `${selectedIds.size}명 선택됨 — 다시 탭하면 해제`
      countEl.style.color = selectedIds.size > 0 ? tc.color : 'var(--text4)'
    }
    updateCount()
    panel.appendChild(countEl)

    // Oval (인터랙티브)
    const ovalSection = document.createElement('div')
    ovalSection.className = 'reveal-edit__oval-section'
    if (total > 0) {
      const { ovalW, ovalH, slotPx, iconPx } = ovalMetrics
      const ovalWrap = document.createElement('div')
      ovalWrap.style.cssText = `position:relative;width:${ovalW}px;height:${ovalH}px;flex-shrink:0;`
      const oval = createSeatOval()

      const buildSlots = () => {
        oval.innerHTML = ''
        allPlayers.forEach((p, i) => {
          const pRole = ROLES_BY_ID[p.role]
          const displayRole = (p.role === 'drunk' && p.drunkAs) ? ROLES_BY_ID[p.drunkAs] : pRole
          const { x, y } = ovalSlotPos(i, total)
          const isSelected = selectedIds.has(p.id)
          const isDead = p.status !== 'alive'

          const slot = createSeatSlot(x, y, slotPx, {
            borderColor: isSelected ? tc.color : (TEAM_BORDER[pRole?.team] || 'var(--lead2)'),
            borderWidth:  isSelected ? 3 : 2,
            isDead,
            background:   isSelected ? `color-mix(in srgb, ${tc.color} 14%, var(--surface))` : undefined,
            boxShadow:    isSelected ? `0 0 14px ${tc.shadow}, 0 0 0 2px color-mix(in srgb, ${tc.color} 40%, transparent)` : undefined,
          })

          // 역할 아이콘 (편집 모드: 호스트만 봄)
          slot.appendChild(createRoleIconEl(displayRole ?? pRole, iconPx))

          // 선택 배지
          if (isSelected) slot.appendChild(_checkBadge(slotPx))

          slot.style.cursor = 'pointer'
          slot.addEventListener('click', () => {
            if (selectedIds.has(p.id)) selectedIds.delete(p.id)
            else selectedIds.add(p.id)
            updateCount()
            buildSlots()
          })

          oval.appendChild(slot)
          oval.appendChild(createSeatNumLabel(x, y, slotPx, p.id, { dimmed: isDead && !isSelected }))
        })
      }
      buildSlots()

      ovalWrap.appendChild(oval)
      ovalSection.appendChild(ovalWrap)
    } else {
      _renderChipFallback(ovalSection, selectedIds, tc, updateCount)
    }
    panel.appendChild(ovalSection)

    // 메시지 textarea
    const msgWrap = document.createElement('div')
    msgWrap.className = 'reveal-edit__msg-wrap'
    const editBadge = document.createElement('span')
    editBadge.className = 'reveal-edit__badge'
    editBadge.textContent = '공개 메시지'
    msgWrap.appendChild(editBadge)
    const textarea = document.createElement('textarea')
    textarea.className = 'reveal-edit__textarea'
    textarea.style.borderColor = `color-mix(in srgb, ${tc.color} 35%, transparent)`
    textarea.value = draft?.message ?? message ?? ''
    textarea.rows = 2
    textarea.placeholder = '공개할 메시지를 입력하세요'
    msgWrap.appendChild(textarea)
    panel.appendChild(msgWrap)

    // 편집 완료 → 공개 버튼
    const confirmBtn = document.createElement('button')
    confirmBtn.className = 'btn btn-primary reveal-edit__reveal-btn'
    confirmBtn.textContent = '편집 완료 → 공개'
    confirmBtn.addEventListener('click', () => {
      buildRevealMode(textarea.value, [...selectedIds])
    })
    panel.appendChild(confirmBtn)
  }

  // ────────────────────────────────────────────────────────────────
  // 공개 모드 (참가자 화면)
  // ────────────────────────────────────────────────────────────────
  const buildRevealMode = (finalMsg, finalIds) => {
    panel.innerHTML = ''
    panel.classList.add('reveal-edit-panel--reveal')

    // 상단 바
    const topBar = _topBar('👁 참가자 화면', '🌙 밤 — 역할 정보 수령')
    panel.appendChild(topBar)

    // 역할 헤더 (아이콘 + 이름)
    panel.appendChild(_roleHeader(roleIcon, roleName, null, tc))  // 능력은 아래 별도 표시

    // 능력 카드
    if (roleAbility) {
      const abilityEl = document.createElement('div')
      abilityEl.className = 'reveal-edit__ability-card'
      abilityEl.textContent = roleAbility
      panel.appendChild(abilityEl)
    }

    // Oval (읽기 전용 — 역할 아이콘 없음)
    const ovalSection = document.createElement('div')
    ovalSection.className = 'reveal-edit__oval-section'
    if (total > 0) {
      const selectedSet = new Set(finalIds)
      const { ovalW, ovalH, slotPx, iconPx } = ovalMetrics
      const ovalWrap = document.createElement('div')
      ovalWrap.style.cssText = `position:relative;width:${ovalW}px;height:${ovalH}px;flex-shrink:0;`
      const oval = createSeatOval()

      allPlayers.forEach((p, i) => {
        const { x, y } = ovalSlotPos(i, total)
        const isSelected = selectedSet.has(p.id)
        const isDead = p.status !== 'alive'

        const slot = createSeatSlot(x, y, slotPx, {
          borderColor: isSelected ? tc.color : 'var(--lead2)',
          borderWidth:  isSelected ? 3 : 1,
          isDead:       isDead && !isSelected,
          background:   isSelected
            ? `color-mix(in srgb, ${tc.color} 18%, var(--surface))`
            : 'var(--surface2)',
          boxShadow:    isSelected
            ? `0 0 18px ${tc.shadow}, 0 0 0 2px color-mix(in srgb, ${tc.color} 45%, transparent)`
            : undefined,
          cursor:       'default',
        })

        // 공개 모드: 역할 아이콘 대신 익명 원형
        const circle = document.createElement('div')
        circle.style.cssText = `
          width:${iconPx}px;height:${iconPx}px;border-radius:50%;
          background:${isSelected
            ? `color-mix(in srgb, ${tc.color} 30%, var(--surface2))`
            : 'var(--surface)'};
          pointer-events:none;flex-shrink:0;
        `
        slot.appendChild(circle)

        if (isSelected) slot.appendChild(_checkBadge(slotPx))

        oval.appendChild(slot)
        oval.appendChild(createSeatNumLabel(x, y, slotPx, p.id, {
          dimmed: !isSelected,
        }))
      })

      ovalWrap.appendChild(oval)
      ovalSection.appendChild(ovalWrap)
    }
    panel.appendChild(ovalSection)

    // 공개 메시지
    if (finalMsg) {
      const msgEl = document.createElement('div')
      msgEl.className = 'reveal-edit__reveal-msg'
      msgEl.style.borderColor = `color-mix(in srgb, ${tc.color} 30%, transparent)`
      msgEl.textContent = finalMsg
      panel.appendChild(msgEl)
    }

    // 행동 안내 카드
    const actionText = action || '확인했으면 눈을 감고 손을 내려주세요'
    const actionCard = document.createElement('div')
    actionCard.className = 'reveal-edit__action-card'
    actionCard.innerHTML = `
      <span class="reveal-edit__action-icon">→</span>
      <span class="reveal-edit__action-text">${actionText}</span>
    `
    panel.appendChild(actionCard)

    // [호스트] 다음 → 버튼
    const nextBtn = document.createElement('button')
    nextBtn.className = 'btn btn-primary reveal-edit__reveal-btn reveal-edit__next-btn'
    nextBtn.textContent = '[ 호스트 ] 다음 →'
    nextBtn.addEventListener('click', () => {
      overlay.remove()
      onNext && onNext()
    })
    panel.appendChild(nextBtn)
  }

  // 편집 모드로 시작
  buildEditMode()

  overlay.appendChild(panel)
  document.body.appendChild(overlay)
  return () => overlay.remove()
}

// ── 공용 헬퍼 ────────────────────────────────────────────────────

function _topBar(leftLabel, rightLabel) {
  const bar = document.createElement('div')
  bar.className = 'reveal-edit__top-bar'
  const left = document.createElement('span')
  left.className = 'reveal-edit__editing-badge'
  left.textContent = leftLabel
  const right = document.createElement('span')
  right.className = 'reveal-edit__night-label'
  right.textContent = rightLabel
  bar.appendChild(left)
  bar.appendChild(right)
  return bar
}

function _roleHeader(roleIcon, roleName, roleAbility, tc) {
  const row = document.createElement('div')
  row.className = 'reveal-edit__header'

  const iconEl = document.createElement('div')
  if (roleIcon && roleIcon.endsWith('.png')) {
    iconEl.className = 'reveal__icon reveal__icon--token reveal-edit__role-icon'
    iconEl.innerHTML = `
      <img class="reveal__token-bg"   src="./asset/token.png" alt="">
      <img class="reveal__token-icon" src="./asset/icons/${roleIcon}" alt="${roleName}">
    `
  } else {
    iconEl.className = 'reveal-edit__role-icon-emoji'
    iconEl.textContent = roleIcon || '🎴'
  }
  row.appendChild(iconEl)

  const nameWrap = document.createElement('div')
  nameWrap.className = 'reveal-edit__name-wrap'
  const nameEl = document.createElement('div')
  nameEl.className = 'reveal-edit__role-name'
  nameEl.style.color = tc.color
  nameEl.style.textShadow = `0 0 16px ${tc.shadow}`
  nameEl.textContent = roleName
  nameWrap.appendChild(nameEl)
  if (roleAbility) {
    const ab = document.createElement('div')
    ab.className = 'reveal-edit__ability'
    ab.textContent = roleAbility
    nameWrap.appendChild(ab)
  }
  row.appendChild(nameWrap)
  return row
}

function _checkBadge(slotPx) {
  const badge = document.createElement('div')
  const sz = Math.max(16, Math.round(slotPx * 0.3))
  badge.style.cssText = `
    position:absolute;top:-6px;right:-6px;
    width:${sz}px;height:${sz}px;border-radius:50%;
    background:var(--gold2);border:1px solid var(--surface);
    display:flex;align-items:center;justify-content:center;
    font-size:${Math.max(9, Math.round(sz * 0.55))}px;
    color:#000;font-weight:700;z-index:2;
  `
  badge.textContent = '✓'
  return badge
}

function _renderChipFallback(container, selectedIds, tc, onUpdate) {
  const wrap = document.createElement('div')
  wrap.className = 'reveal-edit__chips-fallback'
  const chipsRow = document.createElement('div')
  chipsRow.className = 'reveal__players reveal-edit__chips-row'
  const renderChips = () => {
    chipsRow.innerHTML = ''
    ;[...selectedIds].forEach(id => {
      const chip = document.createElement('div')
      chip.className = 'reveal__num-chip reveal-edit__chip'
      chip.style.cssText = `position:relative;border-color:${tc.color};`
      chip.innerHTML = `<span class="reveal__num-val">${id}</span><span class="reveal__num-unit">번</span>`
      const del = document.createElement('button')
      del.className = 'reveal-edit__chip-del'
      del.textContent = '×'
      del.addEventListener('click', () => { selectedIds.delete(id); renderChips(); onUpdate() })
      chip.appendChild(del)
      chipsRow.appendChild(chip)
    })
  }
  renderChips()
  wrap.appendChild(chipsRow)
  const addRow = document.createElement('div')
  addRow.className = 'reveal-edit__add-row'
  const numInput = document.createElement('input')
  numInput.type = 'number'; numInput.min = 1; numInput.max = 20
  numInput.placeholder = '번호'; numInput.className = 'reveal-edit__num-input'
  const addBtn = document.createElement('button')
  addBtn.className = 'reveal-edit__add-btn'; addBtn.textContent = '+ 추가'
  const doAdd = () => {
    const v = parseInt(numInput.value, 10)
    if (!isNaN(v) && v > 0) { selectedIds.add(v); numInput.value = ''; renderChips(); onUpdate() }
  }
  addBtn.addEventListener('click', doAdd)
  numInput.addEventListener('keydown', e => { if (e.key === 'Enter') doAdd() })
  addRow.appendChild(numInput); addRow.appendChild(addBtn)
  wrap.appendChild(addRow)
  container.appendChild(wrap)
}

// ── CSS ──────────────────────────────────────────────────────────
if (!document.getElementById('reveal-edit-panel-style')) {
  const style = document.createElement('style')
  style.id = 'reveal-edit-panel-style'
  style.textContent = `
/* 오버레이 */
.reveal-edit-overlay {
  z-index: 210;
  align-items: stretch;
}

/* 패널 기본 (전체 화면 flex column) */
.reveal-edit-panel {
  width: 100%;
  max-width: var(--app-max-width);
  margin: 0 auto;
  display: flex;
  flex-direction: column;
  height: 100%;
  box-sizing: border-box;
  padding: 12px 20px 16px;
  gap: 8px;
  overflow: hidden;
}

/* 공개 모드 전환 페이드 */
.reveal-edit-panel--reveal {
  animation: rep-fade-in 0.25s ease;
}
@keyframes rep-fade-in {
  from { opacity: 0.4; transform: scale(0.98); }
  to   { opacity: 1;   transform: scale(1); }
}

/* ── 상단 바 ── */
.reveal-edit__top-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-shrink: 0;
}
.reveal-edit__editing-badge {
  font-size: 0.62rem;
  padding: 2px 9px;
  border-radius: 10px;
  letter-spacing: 0.04em;
  background: color-mix(in srgb, var(--gold2) 12%, var(--surface2));
  border: 1px solid color-mix(in srgb, var(--gold2) 35%, transparent);
  color: var(--gold2);
}
.reveal-edit__night-label {
  font-size: 0.6rem;
  color: var(--pu-light);
  opacity: 0.8;
  letter-spacing: 0.04em;
}

/* ── 역할 헤더 ── */
.reveal-edit__header {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-shrink: 0;
}
.reveal-edit__role-icon {
  width: 44px !important;
  height: 44px !important;
  flex-shrink: 0;
}
.reveal-edit__role-icon-emoji {
  font-size: 1.8rem;
  flex-shrink: 0;
  line-height: 1;
}
.reveal-edit__name-wrap {
  display: flex;
  flex-direction: column;
  gap: 3px;
  min-width: 0;
}
.reveal-edit__role-name {
  font-family: 'Noto Serif KR', serif;
  font-size: 1.25rem;
  font-weight: 700;
  line-height: 1.2;
}
.reveal-edit__ability {
  font-size: 0.68rem;
  color: var(--text3);
  line-height: 1.45;
  word-break: keep-all;
  overflow: hidden;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
}

/* 공개 모드 능력 카드 */
.reveal-edit__ability-card {
  width: 100%;
  font-size: 0.82rem;
  color: var(--text2);
  line-height: 1.65;
  background: var(--surface);
  border: 1px solid var(--lead2);
  border-radius: 10px;
  padding: 10px 16px;
  word-break: keep-all;
  text-align: center;
  flex-shrink: 0;
}

/* ── 선택 카운트 ── */
.reveal-edit__count {
  font-size: 0.7rem;
  text-align: center;
  flex-shrink: 0;
  letter-spacing: 0.02em;
  min-height: 18px;
}

/* ── Oval 섹션 ── */
.reveal-edit__oval-section {
  flex: 1;
  min-height: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
}

/* ── 편집 메시지 textarea ── */
.reveal-edit__msg-wrap {
  position: relative;
  flex-shrink: 0;
}
.reveal-edit__badge {
  position: absolute;
  top: -10px;
  left: 14px;
  font-size: 0.58rem;
  color: var(--gold2);
  background: var(--surface);
  padding: 1px 8px;
  border: 1px solid color-mix(in srgb, var(--gold2) 35%, transparent);
  border-radius: 8px;
  z-index: 1;
  letter-spacing: 0.04em;
}
.reveal-edit__textarea {
  width: 100%;
  box-sizing: border-box;
  resize: none;
  font-family: inherit;
  font-size: 1.1rem;
  line-height: 1.55;
  color: var(--text);
  background: var(--surface);
  border: 1px solid rgba(92,83,137,0.3);
  border-radius: 14px;
  padding: 12px 16px;
  word-break: keep-all;
  white-space: pre-line;
  display: block;
  outline: none;
}
.reveal-edit__textarea:focus {
  border-color: var(--gold2) !important;
  box-shadow: 0 0 0 3px rgba(212,168,40,0.12);
}
.reveal-edit__textarea::placeholder { color: var(--text4); font-size: 0.9rem; }

/* ── 공개 모드 메시지 블록 ── */
.reveal-edit__reveal-msg {
  font-size: 1.35rem;
  color: var(--text);
  text-align: center;
  line-height: 1.55;
  background: var(--surface);
  border: 1px solid rgba(92,83,137,0.3);
  border-radius: 16px;
  padding: 16px 20px;
  width: 100%;
  box-sizing: border-box;
  word-break: keep-all;
  white-space: pre-line;
  flex-shrink: 0;
}

/* ── 공개 모드 행동 안내 카드 ── */
.reveal-edit__action-card {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  background: color-mix(in srgb, var(--pu-base) 10%, var(--surface));
  border: 1px solid color-mix(in srgb, var(--pu-base) 30%, transparent);
  border-radius: 10px;
  padding: 10px 14px;
  box-sizing: border-box;
  flex-shrink: 0;
}
.reveal-edit__action-icon {
  font-size: 0.85rem;
  color: var(--pu-light);
  flex-shrink: 0;
  font-weight: 700;
}
.reveal-edit__action-text {
  font-size: 0.75rem;
  color: var(--pu-light);
  font-weight: 600;
  line-height: 1.45;
  word-break: keep-all;
}

/* ── 버튼 (편집 완료 / 다음) ── */
.reveal-edit__reveal-btn {
  flex-shrink: 0;
  width: 100%;
  padding: 15px;
  font-size: 0.9rem;
  font-weight: 700;
  border-radius: 12px;
  min-height: 52px;
}
.reveal-edit__next-btn {
  opacity: 0.65;
}
.reveal-edit__next-btn:hover { opacity: 1; }

/* ── chip fallback ── */
.reveal-edit__chips-fallback {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
}
.reveal-edit__chip {
  position: relative;
}
.reveal-edit__chip-del {
  position: absolute;
  top: -7px; right: -7px;
  width: 20px; height: 20px;
  border-radius: 50%;
  background: var(--rd-base, #8c3030);
  color: #fff;
  font-size: 13px;
  display: flex; align-items: center; justify-content: center;
  border: none; cursor: pointer; padding: 0; font-weight: 700; z-index: 1;
}
.reveal-edit__chip-del:hover { background: var(--rd-light, #c04040); }
.reveal-edit__add-row {
  display: flex; gap: 8px; align-items: center;
}
.reveal-edit__num-input {
  width: 72px; padding: 7px 10px; border-radius: 8px;
  border: 1px solid var(--lead2); background: var(--surface);
  color: var(--text); font-size: 0.9rem; text-align: center;
}
.reveal-edit__num-input:focus { outline: none; border-color: var(--gold2); }
.reveal-edit__add-btn {
  padding: 7px 16px; font-size: 0.8rem; border-radius: 8px;
  background: var(--surface2); border: 1px solid var(--lead2);
  color: var(--text2); cursor: pointer;
}
.reveal-edit__add-btn:hover { color: var(--text); border-color: var(--gold2); }
  `
  document.head.appendChild(style)
}
