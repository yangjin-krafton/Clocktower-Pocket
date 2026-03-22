/**
 * C-07c NightRevealNote — 밤 정보 공개 쪽지
 *
 * display 모드: 자동 포맷 렌더링 (숫자 강조 · 행동 안내 분리)
 * edit   모드: 상단 바 ✏ 버튼 → textarea 편집 → ↩ 완료 버튼
 */
import { ROLES_BY_ID } from '../data/roles-tb.js'

const TEAM_COLORS = {
  town:    { color: 'var(--bl-light)', glow: 'rgba(46,74,143,0.15)' },
  outside: { color: 'var(--tl-light)', glow: 'rgba(91,179,198,0.12)' },
  minion:  { color: 'var(--rd-light)', glow: 'rgba(140,48,48,0.18)' },
  demon:   { color: 'var(--rd-light)', glow: 'rgba(110,27,31,0.22)' },
  default: { color: 'var(--gold2)',    glow: 'rgba(212,168,40,0.1)' },
}

// 폰트 배율 — localStorage 에 저장해 앱 재시작 후에도 유지
const _LS_KEY   = 'rnote_font_scale'
const SCALE_MIN = 0.5
const SCALE_MAX = 4.0
const SCALE_STEP = 0.1
let _globalScale = (() => {
  const v = parseFloat(localStorage.getItem(_LS_KEY))
  return (isFinite(v) && v >= SCALE_MIN && v <= SCALE_MAX) ? v : 1.0
})()

export function mountNightRevealNote(data) {
  const { roleIcon, roleName, roleTeam, message, onNext, onBack } = data
  const tc = TEAM_COLORS[roleTeam] || TEAM_COLORS.default

  const overlay = document.createElement('div')
  overlay.className = 'reveal-note-overlay panel-overlay'

  const panel = document.createElement('div')
  panel.className = 'reveal-note-panel'
  panel.style.background =
    `radial-gradient(ellipse 100% 35% at 50% 0%, ${tc.glow} 0%, transparent 50%)`

  // ── 상단 바 ──────────────────────────────────────────────────
  const topBar = document.createElement('div')
  topBar.className = 'reveal-note__top-bar'

  // 역할 배지
  const roleBadge = document.createElement('div')
  roleBadge.className = 'reveal-note__role-badge'
  if (roleIcon && roleIcon.endsWith('.png')) {
    roleBadge.innerHTML = `
      <div style="position:relative;width:18px;height:18px;flex-shrink:0;">
        <img src="./asset/token.png" style="position:absolute;inset:0;width:100%;height:100%;" alt="">
        <img src="./asset/new/Icon_${roleIcon}" style="position:absolute;inset:0;width:100%;height:100%;object-fit:contain;" alt="">
      </div>
      <span style="color:${tc.color}">${roleName}</span>
    `
  } else {
    roleBadge.innerHTML =
      `<span>${roleIcon || '🎴'}</span><span style="color:${tc.color}">${roleName}</span>`
  }

  // 우측 컨트롤 그룹: [A−][A+] [✏ 수정 / ↩ 완료]
  const topRight = document.createElement('div')
  topRight.className = 'reveal-note__top-right'

  const fontDecBtn = document.createElement('button')
  fontDecBtn.className = 'reveal-note__font-btn'
  fontDecBtn.textContent = 'A−'
  fontDecBtn.setAttribute('aria-label', '글자 작게')

  const fontSlider = document.createElement('input')
  fontSlider.type  = 'range'
  fontSlider.className = 'reveal-note__font-slider'
  fontSlider.min   = String(SCALE_MIN)
  fontSlider.max   = String(SCALE_MAX)
  fontSlider.step  = String(SCALE_STEP)
  fontSlider.value = String(_globalScale)
  fontSlider.setAttribute('aria-label', '글자 크기')

  const fontIncBtn = document.createElement('button')
  fontIncBtn.className = 'reveal-note__font-btn'
  fontIncBtn.textContent = 'A+'
  fontIncBtn.setAttribute('aria-label', '글자 크게')

  const editToggleBtn = document.createElement('button')
  editToggleBtn.className = 'reveal-note__edit-toggle'
  editToggleBtn.innerHTML = '<span class="rn-et-icon">✏</span><span class="rn-et-label">수정</span>'

  topRight.appendChild(fontDecBtn)
  topRight.appendChild(fontSlider)
  topRight.appendChild(fontIncBtn)
  topRight.appendChild(editToggleBtn)

  topBar.appendChild(roleBadge)
  topBar.appendChild(topRight)
  panel.appendChild(topBar)

  // ── 메시지 카드 ──────────────────────────────────────────────
  const card = document.createElement('div')
  card.className = 'reveal-note__card'

  // display 모드
  const bodyEl = document.createElement('div')
  bodyEl.className = 'reveal-note__body'

  // edit 모드
  const textarea = document.createElement('textarea')
  textarea.className = 'reveal-note__textarea'
  textarea.value = message || ''
  textarea.style.display = 'none'

  // ── 폰트 적용 ──
  let _scaledFs = '1.4rem'

  const _applyScale = () => {
    const mainEl = bodyEl.querySelector('.reveal-note__main')
    if (!mainEl) return
    const base   = parseFloat(_scaledFs)
    const scaled = Math.max(0.5, Math.min(8.0, base * _globalScale))
    mainEl.style.fontSize   = `${scaled.toFixed(2)}rem`
    textarea.style.fontSize = `${scaled.toFixed(2)}rem`
    fontSlider.value = String(_globalScale)
    localStorage.setItem(_LS_KEY, String(_globalScale))
  }

  const _refresh = (text) => {
    _renderInto(bodyEl, text, tc.color)
    _autoScale(bodyEl, (fs) => {
      _scaledFs = fs
      _applyScale()
    })
  }
  _refresh(message || '')

  fontDecBtn.addEventListener('click', (e) => {
    e.stopPropagation()
    _globalScale = Math.max(SCALE_MIN, parseFloat((_globalScale - SCALE_STEP).toFixed(2)))
    _applyScale()
  })
  fontIncBtn.addEventListener('click', (e) => {
    e.stopPropagation()
    _globalScale = Math.min(SCALE_MAX, parseFloat((_globalScale + SCALE_STEP).toFixed(2)))
    _applyScale()
  })
  fontSlider.addEventListener('input', (e) => {
    e.stopPropagation()
    _globalScale = parseFloat(fontSlider.value)
    _applyScale()
  })

  // ── edit 모드 진입 / 종료 ──
  let _editing = false

  const _enterEdit = () => {
    if (_editing) return
    _editing = true
    bodyEl.style.display = 'none'
    textarea.style.display = 'block'
    card.classList.add('reveal-note__card--editing')
    editToggleBtn.innerHTML = '<span class="rn-et-icon">↩</span><span class="rn-et-label">완료</span>'
    editToggleBtn.classList.add('reveal-note__edit-toggle--done')
    nextBtn.style.display = 'none'
    textarea.focus()
    textarea.setSelectionRange(textarea.value.length, textarea.value.length)
  }

  const _exitEdit = () => {
    if (!_editing) return
    _editing = false
    _refresh(textarea.value)
    bodyEl.style.display = 'flex'
    textarea.style.display = 'none'
    card.classList.remove('reveal-note__card--editing')
    editToggleBtn.innerHTML = '<span class="rn-et-icon">✏</span><span class="rn-et-label">수정</span>'
    editToggleBtn.classList.remove('reveal-note__edit-toggle--done')
    nextBtn.style.display = ''
  }

  editToggleBtn.addEventListener('click', (e) => {
    e.stopPropagation()
    _editing ? _exitEdit() : _enterEdit()
  })

  // 카드 탭 → edit 진입 (편집 중이 아닐 때)
  card.addEventListener('click', () => { if (!_editing) _enterEdit() })

  // textarea blur → exit (키보드 내리기 등 fallback)
  // pointerdown on editToggleBtn 이 blur 보다 먼저 실행되므로 버튼 클릭은 영향 없음
  textarea.addEventListener('blur', () => {
    // 약간 딜레이: 버튼 pointerdown → blur → click 순서 보장
    setTimeout(() => { if (_editing) _exitEdit() }, 80)
  })
  // 버튼 pointerdown: blur 방지
  editToggleBtn.addEventListener('pointerdown', (e) => { if (_editing) e.preventDefault() })

  card.appendChild(bodyEl)
  card.appendChild(textarea)
  panel.appendChild(card)

  // ── 하단 버튼 행 ────────────────────────────────────────────
  const btnRow = document.createElement('div')
  btnRow.className = 'reveal-note__btn-row'

  if (onBack) {
    const backBtn = document.createElement('button')
    backBtn.className = 'reveal-note__back btn'
    backBtn.textContent = '← 되돌리기'
    backBtn.addEventListener('click', () => {
      overlay.remove()
      onBack()
    })
    btnRow.appendChild(backBtn)
  }

  const nextBtn = document.createElement('button')
  nextBtn.className = 'reveal-note__next btn btn-primary'
  nextBtn.textContent = '[ 호스트 ] 다음 →'
  nextBtn.addEventListener('click', () => {
    overlay.remove()
    onNext?.()
  })
  btnRow.appendChild(nextBtn)
  panel.appendChild(btnRow)

  overlay.appendChild(panel)
  document.body.appendChild(overlay)
  return () => overlay.remove()
}

// ── 자동 폰트 스케일 ───────────────────────────────────────────

function _autoScale(bodyEl, onScaled) {
  requestAnimationFrame(() => {
    const mainEl = bodyEl.querySelector('.reveal-note__main')
    if (!mainEl) return

    const bodyH = bodyEl.clientHeight
    if (bodyH === 0) {
      requestAnimationFrame(() => _autoScale(bodyEl, onScaled))
      return
    }

    const fixedH = [...bodyEl.children]
      .filter(el => el !== mainEl)
      .reduce((sum, el) => {
        const s = getComputedStyle(el)
        return sum + el.offsetHeight
          + (parseFloat(s.marginTop)    || 0)
          + (parseFloat(s.marginBottom) || 0)
      }, 0)

    const targetH = bodyH - fixedH - 4
    if (targetH < 20) return

    const MIN = 0.85
    const MAX = 6.0
    const containerW = mainEl.clientWidth
    const paraEls    = [...mainEl.querySelectorAll('.reveal-note__para')]

    mainEl.style.flex   = 'none'
    mainEl.style.height = 'auto'

    let lo = MIN, hi = MAX
    for (let i = 0; i < 16; i++) {
      const mid = (lo + hi) / 2
      mainEl.style.fontSize = `${mid}rem`
      const heightOk = mainEl.scrollHeight <= targetH
      paraEls.forEach(p => { p.style.whiteSpace = 'nowrap' })
      const widthOk = mainEl.scrollWidth <= containerW
      paraEls.forEach(p => { p.style.whiteSpace = '' })
      if (heightOk && widthOk) lo = mid
      else                     hi = mid
    }

    mainEl.style.flex   = ''
    mainEl.style.height = ''
    const fs = `${lo.toFixed(2)}rem`
    mainEl.style.fontSize = fs
    onScaled?.(fs)
  })
}

// ── 메시지 렌더러 ─────────────────────────────────────────────

function _renderInto(container, text, teamColor) {
  container.innerHTML = ''
  if (!text.trim()) return

  const paras     = text.split('\n\n')
  const lastPara  = paras[paras.length - 1]
  const hasAction = /눈을 감으세요/.test(lastPara)

  const contentParas = hasAction ? paras.slice(0, -1) : paras
  const actionPara   = hasAction ? lastPara : null

  const main = document.createElement('div')
  main.className = 'reveal-note__main'
  main.style.fontFamily = "'Noto Serif KR', serif"
  main.style.color = teamColor || 'var(--text)'

  contentParas.forEach(para => {
    const el = document.createElement('div')
    el.className = 'reveal-note__para'
    el.innerHTML = para.split('\n').map(_markup).join('<br>')
    main.appendChild(el)
  })
  container.appendChild(main)

  if (actionPara) {
    const hr = document.createElement('div')
    hr.className = 'reveal-note__divider'
    container.appendChild(hr)
    const el = document.createElement('div')
    el.className = 'reveal-note__action'
    el.innerHTML =
      `<span class="reveal-note__action-arrow">→</span>` +
      `<span>${_markup(actionPara)}</span>`
    container.appendChild(el)
  }
}

const _MARKUP_RULES = [
  { re: /(\d+번)(?!째)/g,              cls: 'reveal-note__num'   },
  { re: /\d+\s*[명쌍개]/g, render(m) {
      const n = m.match(/\d+/)[0]
      const u = m.match(/[명쌍개]/)[0]
      return `<b class="reveal-note__count"><span class="reveal-note__count-n">${n}</span><span class="reveal-note__count-u">${u}</span></b>`
    },
  },
  { re: /(예)(?=[,.\s\n]|$)/gm,       cls: 'reveal-note__yes'   },
  { re: /(아니오)/g,                   cls: 'reveal-note__no'    },
]

;(() => {
  const nameToClass = {}
  const names = []
  for (const role of Object.values(ROLES_BY_ID)) {
    if (!role.name || !role.team) continue
    nameToClass[role.name] = `reveal-note__role--${role.team}`
    names.push(role.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
  }
  if (!names.length) return
  names.sort((a, b) => b.length - a.length)
  _MARKUP_RULES.push({
    re:  new RegExp(`(${names.join('|')})`, 'g'),
    cls: (name) => nameToClass[name] || 'reveal-note__role--default',
  })
})()

function _markup(text) {
  let s = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
  for (const rule of _MARKUP_RULES) {
    if (rule.render) {
      s = s.replace(rule.re, (m) => rule.render(m))
    } else {
      s = s.replace(rule.re, (_, g) =>
        `<b class="${typeof rule.cls === 'function' ? rule.cls(g) : rule.cls}">${g}</b>`)
    }
  }
  return s
}

// ── CSS ──────────────────────────────────────────────────────────
if (!document.getElementById('reveal-note-style')) {
  const style = document.createElement('style')
  style.id = 'reveal-note-style'
  style.textContent = `
.reveal-note-overlay {
  z-index: 210;
  align-items: stretch;
}
.reveal-note-panel {
  width: 100%;
  max-width: var(--app-max-width);
  margin: 0 auto;
  display: flex;
  flex-direction: column;
  height: 100%;
  box-sizing: border-box;
  padding: 12px 18px 16px;
  gap: 10px;
}

/* ── 상단 바 ── */
.reveal-note__top-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-shrink: 0;
  gap: 8px;
}
.reveal-note__role-badge {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 0.7rem;
  color: var(--text3);
  background: var(--surface2);
  border: 1px solid var(--lead2);
  border-radius: 20px;
  padding: 3px 10px 3px 6px;
  flex-shrink: 1;
  min-width: 0;
  overflow: hidden;
}

/* 우측 컨트롤 묶음 */
.reveal-note__top-right {
  display: flex;
  align-items: center;
  gap: 4px;
  flex-shrink: 0;
}

/* 폰트 슬라이더 */
.reveal-note__font-slider {
  -webkit-appearance: none;
  appearance: none;
  width: 80px;
  height: 4px;
  border-radius: 2px;
  background: var(--lead2);
  outline: none;
  cursor: pointer;
  flex-shrink: 0;
  align-self: center;
}
.reveal-note__font-slider::-webkit-slider-thumb {
  -webkit-appearance: none;
  appearance: none;
  width: 18px;
  height: 18px;
  border-radius: 50%;
  background: var(--gold2);
  border: 2px solid var(--surface);
  box-shadow: 0 0 4px rgba(212,168,40,0.4);
  cursor: pointer;
}
.reveal-note__font-slider::-moz-range-thumb {
  width: 18px;
  height: 18px;
  border-radius: 50%;
  background: var(--gold2);
  border: 2px solid var(--surface);
  cursor: pointer;
}

/* A− / A+ 폰트 버튼 */
.reveal-note__font-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 28px;
  padding: 0 7px;
  border-radius: 8px;
  border: 1px solid var(--lead2);
  background: var(--surface2);
  color: var(--text3);
  font-size: 0.68rem;
  font-weight: 700;
  letter-spacing: 0.02em;
  cursor: pointer;
  user-select: none;
  -webkit-tap-highlight-color: transparent;
  transition: background 0.12s, color 0.12s;
}
.reveal-note__font-btn:active {
  background: var(--lead2);
  color: var(--text);
}

/* ✏ 수정 / ↩ 완료 토글 버튼 */
.reveal-note__edit-toggle {
  display: flex;
  align-items: center;
  gap: 4px;
  height: 28px;
  padding: 0 10px;
  border-radius: 8px;
  border: 1px solid var(--lead2);
  background: var(--surface2);
  color: var(--text3);
  font-size: 0.68rem;
  font-weight: 700;
  cursor: pointer;
  user-select: none;
  -webkit-tap-highlight-color: transparent;
  transition: background 0.15s, color 0.15s, border-color 0.15s;
}
.reveal-note__edit-toggle .rn-et-icon {
  font-size: 0.75rem;
  line-height: 1;
}
.reveal-note__edit-toggle .rn-et-label {
  letter-spacing: 0.02em;
}
/* 완료 상태 — 골드 강조 */
.reveal-note__edit-toggle--done {
  background: rgba(212,168,40,0.14);
  border-color: var(--gold2);
  color: var(--gold2);
  box-shadow: 0 0 0 2px rgba(212,168,40,0.12);
}
.reveal-note__edit-toggle--done:active {
  background: rgba(212,168,40,0.28);
}

/* ── 메시지 카드 ── */
.reveal-note__card {
  flex: 1;
  min-height: 0;
  background: var(--surface);
  border: 1.5px solid var(--lead2);
  border-radius: 20px;
  padding: 28px 30px 24px;
  display: flex;
  flex-direction: column;
  cursor: pointer;
  overflow: hidden;
  transition: border-color 0.15s, box-shadow 0.15s;
}
.reveal-note__card--editing {
  border-color: var(--gold2);
  box-shadow: 0 0 0 3px rgba(212,168,40,0.1);
  cursor: text;
}

/* display body */
.reveal-note__body {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow-y: auto;
}
.reveal-note__main {
  flex: 1;
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: 0.4em;
  font-size: 1.4rem;
}
.reveal-note__para {
  margin: 0;
  font-size: 1em;
  line-height: 1.7;
  color: var(--text);
  word-break: break-word;
  overflow-wrap: break-word;
}

/* 자동 파싱 강조 */
.reveal-note__num {
  color: var(--gold2);
  font-weight: 700;
  font-style: normal;
}
.reveal-note__count {
  display: inline-flex;
  align-items: baseline;
  gap: 2px;
  background: rgba(91, 179, 198, 0.12);
  border: 1px solid rgba(91, 179, 198, 0.32);
  border-radius: 5px;
  padding: 0 5px 1px;
  font-style: normal;
  vertical-align: baseline;
}
.reveal-note__count-n {
  font-size: 1.2em;
  font-weight: 900;
  color: var(--tl-light);
  line-height: 1;
}
.reveal-note__count-u {
  font-size: 0.72em;
  font-weight: 600;
  color: var(--tl-light);
  opacity: 0.75;
  line-height: 1;
}
.reveal-note__yes {
  color: #4ade80;
  font-weight: 700;
  font-style: normal;
}
.reveal-note__no {
  color: #f87171;
  font-weight: 700;
  font-style: normal;
}
.reveal-note__role--townsfolk { color: var(--bl-light);  font-weight: 700; font-style: normal; }
.reveal-note__role--outsider  { color: var(--tl-light);  font-weight: 700; font-style: normal; }
.reveal-note__role--minion    { color: var(--rd-light);  font-weight: 700; font-style: normal; }
.reveal-note__role--demon     { color: #e05555;          font-weight: 700; font-style: normal; }
.reveal-note__role--default   { color: var(--gold2);     font-weight: 700; font-style: normal; }

/* 구분선 */
.reveal-note__divider {
  height: 1px;
  background: var(--lead2);
  margin: 0 0 14px;
  flex-shrink: 0;
}

/* 행동 안내 */
.reveal-note__action {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  flex-shrink: 0;
}
.reveal-note__action-arrow {
  font-size: 0.9rem;
  color: var(--text4);
  flex-shrink: 0;
  margin-top: 2px;
}
.reveal-note__action span:last-child {
  font-size: clamp(0.9rem, 2.8vw, 1.1rem);
  color: var(--text3);
  line-height: 1.6;
  word-break: keep-all;
}

/* textarea (edit 모드) */
.reveal-note__textarea {
  flex: 1;
  width: 100%;
  box-sizing: border-box;
  resize: none;
  font-family: 'Noto Sans KR', sans-serif;
  font-size: 1.4rem;
  line-height: 1.7;
  color: var(--text);
  background: transparent;
  border: none;
  outline: none;
  word-break: break-word;
  overflow-wrap: break-word;
  white-space: pre-wrap;
  min-height: 0;
  padding: 0;
}

/* 호스트 경고 배너 */
.reveal-note__host-warn {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 9px 14px;
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
@keyframes warn-pulse {
  0%, 100% { box-shadow: 0 0 10px rgba(220,38,38,0.18); }
  50%       { box-shadow: 0 0 18px rgba(220,38,38,0.45); }
}

/* 하단 버튼 행 */
.reveal-note__btn-row {
  display: flex;
  gap: 8px;
  flex-shrink: 0;
}

/* 되돌리기 버튼 */
.reveal-note__back {
  flex-shrink: 0;
  padding: 15px 18px;
  font-size: 0.82rem;
  font-weight: 600;
  border-radius: 12px;
  min-height: 52px;
  background: var(--surface2);
  border: 1.5px solid var(--lead2);
  color: var(--text3);
  opacity: 0.75;
  white-space: nowrap;
}
.reveal-note__back:hover,
.reveal-note__back:active {
  opacity: 1;
  border-color: var(--text3);
  color: var(--text);
}

/* 다음 버튼 */
.reveal-note__next {
  flex: 1;
  padding: 15px;
  font-size: 0.9rem;
  font-weight: 700;
  border-radius: 12px;
  min-height: 52px;
  opacity: 0.65;
}
.reveal-note__next:hover,
.reveal-note__next:active { opacity: 1; }
  `
  document.head.appendChild(style)
}
