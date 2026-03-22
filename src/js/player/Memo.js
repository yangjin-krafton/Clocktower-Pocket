/**
 * P-06 Memo — 호스트 메모장
 *
 * - reveal-note__card 구조 재사용 (자동 포맷팅 · 폰트 크기 제어)
 * - 게임별 localStorage 저장 (gameKey 단위)
 */
import { renderNoteBody, autoScaleNoteBody } from '../components/NightRevealNote.js'

// NightRevealNote 와 동일한 폰트 배율 키 공유
const _LS_SCALE_KEY = 'rnote_font_scale'
const SCALE_MIN     = 0.5
const SCALE_MAX     = 4.0
const SCALE_STEP    = 0.1

function _loadScale() {
  const v = parseFloat(localStorage.getItem(_LS_SCALE_KEY))
  return (isFinite(v) && v >= SCALE_MIN && v <= SCALE_MAX) ? v : 1.0
}
function _saveScale(v) {
  localStorage.setItem(_LS_SCALE_KEY, String(v))
}

export class Memo {
  /**
   * @param {Object} [opts]
   * @param {string} [opts.gameKey]  게임 식별자 — localStorage 키에 사용
   */
  constructor({ gameKey = 'default' } = {}) {
    this._lsKey    = `ct-host-memo-${gameKey}`
    this._scale    = _loadScale()
    this._editing  = false
    this._scaledFs = '1.4rem'
    this.el        = null
  }

  mount(container) {
    this._container = container

    // page-content 를 flex-column 으로 전환 → memo-screen flex:1 이 높이를 가득 채움
    this._savedOverflow  = container.style.overflowY
    this._savedPadBottom = container.style.paddingBottom
    this._savedDisplay   = container.style.display
    this._savedFlexDir   = container.style.flexDirection
    container.style.overflowY      = 'hidden'
    container.style.paddingBottom  = '0'
    container.style.display        = 'flex'
    container.style.flexDirection  = 'column'

    this.el = document.createElement('div')
    this.el.className = 'memo-screen'
    this._build()
    container.appendChild(this.el)
  }

  unmount() {
    if (this._container) {
      this._container.style.overflowY     = this._savedOverflow  ?? ''
      this._container.style.paddingBottom = this._savedPadBottom ?? ''
      this._container.style.display       = this._savedDisplay   ?? ''
      this._container.style.flexDirection = this._savedFlexDir   ?? ''
    }
    this.el?.remove()
  }

  // ── 전체 빌드 (최초 1회) ─────────────────────────────────────
  _build() {
    this.el.innerHTML = ''

    // ── 상단 바 ──
    const topBar = document.createElement('div')
    topBar.className = 'reveal-note__top-bar'
    topBar.style.flexShrink = '0'

    const badge = document.createElement('div')
    badge.className = 'reveal-note__role-badge'
    badge.innerHTML = `<span>📝</span><span>메모</span>`

    const topRight = document.createElement('div')
    topRight.className = 'reveal-note__top-right'

    const fontDecBtn = document.createElement('button')
    fontDecBtn.className = 'reveal-note__font-btn'
    fontDecBtn.textContent = 'A−'

    const fontSlider = document.createElement('input')
    fontSlider.type      = 'range'
    fontSlider.className = 'reveal-note__font-slider'
    fontSlider.min       = String(SCALE_MIN)
    fontSlider.max       = String(SCALE_MAX)
    fontSlider.step      = String(SCALE_STEP)
    fontSlider.value     = String(this._scale)

    const fontIncBtn = document.createElement('button')
    fontIncBtn.className = 'reveal-note__font-btn'
    fontIncBtn.textContent = 'A+'

    const editToggle = document.createElement('button')
    editToggle.className = 'reveal-note__edit-toggle'
    editToggle.innerHTML = '<span class="rn-et-icon">✏</span><span class="rn-et-label">수정</span>'

    topRight.appendChild(fontDecBtn)
    topRight.appendChild(fontSlider)
    topRight.appendChild(fontIncBtn)
    topRight.appendChild(editToggle)
    topBar.appendChild(badge)
    topBar.appendChild(topRight)
    this.el.appendChild(topBar)

    // ── 카드 ──
    const card = document.createElement('div')
    card.className = 'reveal-note__card memo-card'
    card.style.cursor = 'pointer'

    const bodyEl = document.createElement('div')
    bodyEl.className = 'reveal-note__body'

    const textarea = document.createElement('textarea')
    textarea.className = 'reveal-note__textarea'
    textarea.value     = localStorage.getItem(this._lsKey) || ''
    textarea.placeholder = '메모를 입력하세요...\n\n예)\n3번: 점쟁이 주장, 신뢰\n7번: 임프 의심 → 처형 유도'
    textarea.style.display = 'none'

    card.appendChild(bodyEl)
    card.appendChild(textarea)
    this.el.appendChild(card)

    // ── 폰트 적용 ──
    const applyScale = () => {
      const mainEl = bodyEl.querySelector('.reveal-note__main')
      if (!mainEl) return
      const scaled = Math.max(0.5, Math.min(8.0, parseFloat(this._scaledFs) * this._scale))
      mainEl.style.fontSize   = `${scaled.toFixed(2)}rem`
      textarea.style.fontSize = `${scaled.toFixed(2)}rem`
      fontSlider.value = String(this._scale)
      _saveScale(this._scale)
    }

    const refresh = () => {
      renderNoteBody(bodyEl, textarea.value, 'var(--text)')
      autoScaleNoteBody(bodyEl, (fs) => {
        this._scaledFs = fs
        applyScale()
      })
    }
    refresh()

    // 폰트 컨트롤
    fontDecBtn.addEventListener('click', (e) => {
      e.stopPropagation()
      this._scale = Math.max(SCALE_MIN, parseFloat((this._scale - SCALE_STEP).toFixed(2)))
      applyScale()
    })
    fontIncBtn.addEventListener('click', (e) => {
      e.stopPropagation()
      this._scale = Math.min(SCALE_MAX, parseFloat((this._scale + SCALE_STEP).toFixed(2)))
      applyScale()
    })
    fontSlider.addEventListener('input', (e) => {
      e.stopPropagation()
      this._scale = parseFloat(fontSlider.value)
      applyScale()
    })

    // 편집 진입
    const enterEdit = () => {
      if (this._editing) return
      this._editing = true
      bodyEl.style.display = 'none'
      textarea.style.display = 'block'
      card.classList.add('reveal-note__card--editing')
      editToggle.innerHTML = '<span class="rn-et-icon">↩</span><span class="rn-et-label">완료</span>'
      editToggle.classList.add('reveal-note__edit-toggle--done')
      textarea.focus()
      textarea.setSelectionRange(textarea.value.length, textarea.value.length)
    }

    // 편집 종료
    const exitEdit = () => {
      if (!this._editing) return
      this._editing = false
      localStorage.setItem(this._lsKey, textarea.value)
      refresh()
      bodyEl.style.display = 'flex'
      textarea.style.display = 'none'
      card.classList.remove('reveal-note__card--editing')
      editToggle.innerHTML = '<span class="rn-et-icon">✏</span><span class="rn-et-label">수정</span>'
      editToggle.classList.remove('reveal-note__edit-toggle--done')
    }

    editToggle.addEventListener('click', (e) => {
      e.stopPropagation()
      this._editing ? exitEdit() : enterEdit()
    })
    card.addEventListener('click', () => { if (!this._editing) enterEdit() })

    // 입력 중 실시간 자동 저장
    textarea.addEventListener('input', () => {
      localStorage.setItem(this._lsKey, textarea.value)
    })

    // blur fallback
    textarea.addEventListener('blur', () => {
      setTimeout(() => { if (this._editing) exitEdit() }, 80)
    })
    editToggle.addEventListener('pointerdown', (e) => { if (this._editing) e.preventDefault() })

    // ── 하단: 초기화 버튼 ──
    const clearBtn = document.createElement('button')
    clearBtn.className = 'btn btn-danger btn-full mt-8'
    clearBtn.textContent = '🗑 메모 초기화'
    clearBtn.style.flexShrink = '0'
    clearBtn.addEventListener('click', () => {
      if (confirm('메모를 초기화할까요?')) {
        textarea.value = ''
        localStorage.removeItem(this._lsKey)
        if (this._editing) exitEdit()
        else refresh()
      }
    })
    this.el.appendChild(clearBtn)
  }
}

// ── CSS ──────────────────────────────────────────────────────────
if (!document.getElementById('memo-screen-style')) {
  const style = document.createElement('style')
  style.id = 'memo-screen-style'
  style.textContent = `
.memo-screen {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  gap: 10px;
  box-sizing: border-box;
  padding-bottom: 8px;
}
.memo-card {
  flex: 1;
  min-height: 0;
}
  `
  document.head.appendChild(style)
}
