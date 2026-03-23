/**
 * ScheduleCalendar — 2주 일정 조율 캘린더
 * 랜딩 페이지에 임베드되어 파티 참가 가능 날짜를 조율한다.
 */
import { fetchSchedule, registerDates } from '../partyApi.js'

const DAY_NAMES = ['월', '화', '수', '목', '금', '토', '일']
const NAME_KEY  = 'ctp_party_name'
const DATES_KEY = 'ctp_party_dates'

export class ScheduleCalendar {
  constructor() {
    this.el = null
    this._entries = []          // {name, date}[]
    this._selected = new Set()  // 선택된 날짜 Set<'YYYY-MM-DD'>
    this._loading = false
    this._error = null
    this._submitting = false
    this._weekDates = []        // 2주치 날짜 배열
    this._detailDate = null     // 상세보기 중인 날짜
    this._name = localStorage.getItem(NAME_KEY) || ''
    this._dirty = false         // 선택이 변경되었는지 추적
    this._computeWeekDates()
    this._loadCachedDates()
    this._injectStyles()
  }

  mount(container) {
    this.el = document.createElement('div')
    this.el.className = 'sch-cal'
    container.appendChild(this.el)
    this._render()
    this._fetchData()
  }

  unmount() {
    this.el?.remove()
  }

  /* ── 날짜 계산 ── */

  _computeWeekDates() {
    const today = new Date()
    const day = today.getDay()
    const diff = day === 0 ? -6 : 1 - day
    const monday = new Date(today)
    monday.setDate(today.getDate() + diff)
    monday.setHours(0, 0, 0, 0)

    this._weekDates = []
    for (let i = 0; i < 14; i++) {
      const d = new Date(monday)
      d.setDate(monday.getDate() + i)
      this._weekDates.push(this._fmt(d))
    }
    this._today = this._fmt(today)
  }

  _fmt(d) {
    const y = d.getFullYear()
    const m = String(d.getMonth() + 1).padStart(2, '0')
    const dd = String(d.getDate()).padStart(2, '0')
    return `${y}-${m}-${dd}`
  }

  _dayNum(dateStr) {
    return parseInt(dateStr.split('-')[2], 10)
  }

  _monthDay(dateStr) {
    const [, m, d] = dateStr.split('-')
    return `${parseInt(m)}/${parseInt(d)}`
  }

  /* ── 로컬 캐시 ── */

  _loadCachedDates() {
    try {
      const raw = localStorage.getItem(DATES_KEY)
      if (raw) {
        const dates = JSON.parse(raw)
        const weekSet = new Set(this._weekDates)
        dates.forEach(d => { if (weekSet.has(d)) this._selected.add(d) })
      }
    } catch {}
  }

  _saveCachedDates() {
    localStorage.setItem(DATES_KEY, JSON.stringify([...this._selected].sort()))
  }

  /* ── 데이터 ── */

  async _fetchData() {
    this._loading = true
    this._error = null
    this._render()
    try {
      const start = this._weekDates[0]
      const end = this._weekDates[13]
      this._entries = await fetchSchedule(start, end)
      // 서버에서 본인 이름으로 등록된 날짜를 _selected에 반영
      this._syncMyDatesFromServer()
    } catch (e) {
      this._error = e.message
      this._entries = []
    }
    this._loading = false
    this._dirty = false
    this._render()
  }

  /** 서버 데이터에서 본인 이름의 등록 날짜를 _selected에 동기화 */
  _syncMyDatesFromServer() {
    const myName = this._name.trim()
    if (!myName) return
    const serverDates = new Set()
    for (const e of this._entries) {
      if (e.name === myName) serverDates.add(e.date)
    }
    // 서버 데이터가 있으면 그걸로 대체 (최신 상태)
    if (serverDates.size > 0) {
      this._selected = serverDates
      this._saveCachedDates()
    }
  }

  _getCountByDate(dateStr) {
    const names = new Set()
    for (const e of this._entries) {
      if (e.date === dateStr) names.add(e.name)
    }
    return names.size
  }

  _getNamesByDate(dateStr) {
    const names = new Set()
    for (const e of this._entries) {
      if (e.date === dateStr) names.add(e.name)
    }
    return [...names]
  }

  /* ── 등록 ── */

  async _handleRegister() {
    const name = this._name.trim()
    if (!name) { alert('이름을 입력해주세요'); return }

    this._submitting = true
    this._render()
    try {
      await registerDates({
        name,
        dates: [...this._selected].sort(),
        rangeStart: this._weekDates[0],
        rangeEnd: this._weekDates[13],
      })
      localStorage.setItem(NAME_KEY, name)
      this._saveCachedDates()
      this._dirty = false
      await this._fetchData()
    } catch (e) {
      alert('등록 실패: ' + e.message)
    }
    this._submitting = false
    this._render()
  }

  /* ── 렌더링 ── */

  _render() {
    if (!this.el) return

    const isPast = (dateStr) => dateStr < this._today

    let html = `<div class="sch-cal__header">
      <span class="sch-cal__title">📅 일정 조율</span>
    </div>`

    // 요일 헤더
    html += '<div class="sch-cal__grid">'
    html += '<div class="sch-cal__row sch-cal__row--header">'
    DAY_NAMES.forEach((name, i) => {
      const cls = i >= 5 ? ' sch-cal__day-name--weekend' : ''
      html += `<div class="sch-cal__day-name${cls}">${name}</div>`
    })
    html += '</div>'

    // 주차 렌더링
    for (let week = 0; week < 2; week++) {
      const weekLabel = week === 0 ? '이번 주' : '다음 주'
      html += `<div class="sch-cal__week-label">${weekLabel}</div>`
      html += '<div class="sch-cal__row">'
      for (let d = 0; d < 7; d++) {
        const dateStr = this._weekDates[week * 7 + d]
        const count = this._getCountByDate(dateStr)
        const isToday = dateStr === this._today
        const past = isPast(dateStr)
        const selected = this._selected.has(dateStr)
        const dayIdx = (week * 7 + d) % 7

        let cls = 'sch-cal__cell'
        if (isToday) cls += ' sch-cal__cell--today'
        if (past) cls += ' sch-cal__cell--past'
        if (selected) cls += ' sch-cal__cell--selected'
        if (dayIdx >= 5) cls += ' sch-cal__cell--weekend'
        if (count > 0) cls += ' sch-cal__cell--has-entries'

        html += `<div class="${cls}" data-date="${dateStr}">
          <span class="sch-cal__cell-day">${this._dayNum(dateStr)}</span>
          ${count > 0 ? `<span class="sch-cal__cell-count">${count}명</span>` : ''}
        </div>`
      }
      html += '</div>'
    }
    html += '</div>'

    // 참가자 상세 (날짜 클릭 시)
    if (this._detailDate) {
      const names = this._getNamesByDate(this._detailDate)
      html += `<div class="sch-cal__detail">
        <div class="sch-cal__detail-header">
          <span>${this._monthDay(this._detailDate)} 참가 가능</span>
          <button class="sch-cal__detail-close" data-action="close-detail">✕</button>
        </div>
        ${names.length > 0
          ? `<div class="sch-cal__detail-names">${names.map(n => `<span class="sch-cal__name-chip">${this._escHtml(n)}</span>`).join('')}</div>`
          : '<div class="sch-cal__detail-empty">아직 등록된 참가자가 없습니다</div>'}
      </div>`
    }

    // 등록 폼
    const hasChanges = this._dirty
    html += `<div class="sch-cal__form">
      <input type="text" class="sch-cal__name-input" placeholder="이름 입력"
             value="${this._escHtml(this._name)}" data-action="name" />
      <div class="sch-cal__form-row">
        <span class="sch-cal__form-hint">${this._selected.size > 0
          ? '선택: ' + [...this._selected].sort().map(d => this._monthDay(d)).join(', ')
          : '위 캘린더에서 날짜를 탭하세요'}</span>
        <button class="sch-cal__submit ${this._submitting ? 'sch-cal__submit--loading' : ''} ${hasChanges ? 'sch-cal__submit--dirty' : ''}"
                data-action="register" ${this._submitting ? 'disabled' : ''}>
          ${this._submitting ? '등록 중...' : hasChanges ? '변경 저장' : '등록'}
        </button>
      </div>
    </div>`

    // 로딩/에러
    if (this._loading) {
      html += '<div class="sch-cal__status">불러오는 중...</div>'
    } else if (this._error) {
      html += `<div class="sch-cal__status sch-cal__status--error">
        ${this._escHtml(this._error)}
        <button class="sch-cal__retry" data-action="retry">다시 시도</button>
      </div>`
    }

    this.el.innerHTML = html
    this._bindEvents()
  }

  _bindEvents() {
    // 날짜 셀 클릭
    this.el.querySelectorAll('.sch-cal__cell').forEach(cell => {
      cell.addEventListener('click', () => {
        const dateStr = cell.dataset.date
        if (dateStr < this._today) return

        if (this._selected.has(dateStr)) {
          this._selected.delete(dateStr)
        } else {
          this._selected.add(dateStr)
        }
        this._dirty = true
        this._saveCachedDates()
        this._detailDate = dateStr
        this._render()
      })
    })

    // 이름 입력
    const nameInput = this.el.querySelector('[data-action="name"]')
    nameInput?.addEventListener('input', (e) => {
      this._name = e.target.value
    })
    nameInput?.addEventListener('blur', () => {
      if (this._name.trim()) localStorage.setItem(NAME_KEY, this._name.trim())
    })

    // 등록 버튼
    this.el.querySelector('[data-action="register"]')?.addEventListener('click', () => {
      this._handleRegister()
    })

    // 상세 닫기
    this.el.querySelector('[data-action="close-detail"]')?.addEventListener('click', () => {
      this._detailDate = null
      this._render()
    })

    // 재시도
    this.el.querySelector('[data-action="retry"]')?.addEventListener('click', () => {
      this._fetchData()
    })
  }

  _escHtml(str) {
    return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
  }

  /* ── 스타일 ── */

  _injectStyles() {
    if (document.getElementById('sch-cal-style')) return
    const style = document.createElement('style')
    style.id = 'sch-cal-style'
    style.textContent = `
      .sch-cal {
        background: var(--surface);
        border-radius: var(--radius-lg);
        padding: 16px;
        margin-bottom: 20px;
        border: 1px solid var(--lead2);
      }

      .sch-cal__header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        margin-bottom: 12px;
      }

      .sch-cal__title {
        font-family: 'Noto Serif KR', serif;
        font-size: 1.05rem;
        font-weight: 700;
        color: var(--text);
      }

      /* 그리드 */
      .sch-cal__grid {
        margin-bottom: 12px;
      }

      .sch-cal__row {
        display: grid;
        grid-template-columns: repeat(7, 1fr);
        gap: 4px;
      }

      .sch-cal__row--header {
        margin-bottom: 4px;
      }

      .sch-cal__day-name {
        text-align: center;
        font-size: 0.7rem;
        color: var(--text3);
        padding: 2px 0;
      }

      .sch-cal__day-name--weekend {
        color: var(--rd-light);
      }

      .sch-cal__week-label {
        font-size: 0.68rem;
        color: var(--text4);
        margin: 6px 0 4px 2px;
      }

      /* 날짜 셀 */
      .sch-cal__cell {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        padding: 6px 2px;
        border-radius: var(--radius-sm);
        background: var(--surface2);
        cursor: pointer;
        transition: background 0.15s, transform 0.1s;
        min-height: 48px;
        gap: 2px;
        user-select: none;
        -webkit-user-select: none;
      }

      .sch-cal__cell:active {
        transform: scale(0.95);
      }

      .sch-cal__cell--past {
        opacity: 0.35;
        cursor: default;
      }

      .sch-cal__cell--past:active {
        transform: none;
      }

      .sch-cal__cell--today {
        border: 1.5px solid var(--tl-base);
      }

      .sch-cal__cell--selected {
        background: var(--tl-dark);
        border: 1.5px solid var(--tl-base);
      }

      .sch-cal__cell--weekend {
        background: rgba(140, 48, 48, 0.15);
      }

      .sch-cal__cell--weekend.sch-cal__cell--selected {
        background: var(--tl-dark);
      }

      .sch-cal__cell--has-entries .sch-cal__cell-count {
        color: var(--gold2);
      }

      .sch-cal__cell-day {
        font-size: 0.82rem;
        font-weight: 500;
        color: var(--text);
        line-height: 1;
      }

      .sch-cal__cell--selected .sch-cal__cell-day {
        color: var(--tl-light);
      }

      .sch-cal__cell-count {
        font-size: 0.6rem;
        color: var(--text4);
        line-height: 1;
      }

      /* 상세 팝업 */
      .sch-cal__detail {
        background: var(--surface2);
        border: 1px solid var(--lead2);
        border-radius: var(--radius-md);
        padding: 10px 12px;
        margin-bottom: 12px;
      }

      .sch-cal__detail-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        font-size: 0.82rem;
        font-weight: 500;
        color: var(--text2);
        margin-bottom: 8px;
      }

      .sch-cal__detail-close {
        background: none;
        border: none;
        color: var(--text4);
        cursor: pointer;
        font-size: 0.9rem;
        padding: 2px 4px;
      }

      .sch-cal__detail-names {
        display: flex;
        flex-wrap: wrap;
        gap: 6px;
      }

      .sch-cal__name-chip {
        background: var(--pu-dark);
        color: var(--pu-light);
        padding: 3px 10px;
        border-radius: 12px;
        font-size: 0.75rem;
      }

      .sch-cal__detail-empty {
        font-size: 0.78rem;
        color: var(--text4);
      }

      /* 등록 폼 */
      .sch-cal__form {
        display: flex;
        flex-direction: column;
        gap: 8px;
      }

      .sch-cal__name-input {
        background: var(--surface2);
        border: 1px solid var(--lead2);
        border-radius: var(--radius-sm);
        padding: 8px 12px;
        font-size: 0.85rem;
        color: var(--text);
        font-family: 'Noto Sans KR', sans-serif;
        outline: none;
        transition: border-color 0.15s;
      }

      .sch-cal__name-input:focus {
        border-color: var(--tl-dark);
      }

      .sch-cal__name-input::placeholder {
        color: var(--text4);
      }

      .sch-cal__form-row {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 12px;
      }

      .sch-cal__form-hint {
        font-size: 0.72rem;
        color: var(--text4);
        flex: 1;
        min-width: 0;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      .sch-cal__submit {
        background: var(--tl-dark);
        color: var(--tl-light);
        border: 1px solid var(--tl-base);
        border-radius: var(--radius-sm);
        padding: 7px 20px;
        font-size: 0.82rem;
        font-family: 'Noto Sans KR', sans-serif;
        font-weight: 500;
        cursor: pointer;
        transition: background 0.15s, opacity 0.15s;
        white-space: nowrap;
      }

      .sch-cal__submit:active {
        background: var(--tl-base);
      }

      .sch-cal__submit--loading {
        opacity: 0.6;
        cursor: default;
      }

      .sch-cal__submit--dirty {
        background: var(--gold);
        border-color: var(--gold2);
        color: #1a1a1a;
      }

      /* 상태 */
      .sch-cal__status {
        text-align: center;
        font-size: 0.75rem;
        color: var(--text4);
        padding: 8px 0 0;
      }

      .sch-cal__status--error {
        color: var(--rd-light);
      }

      .sch-cal__retry {
        background: none;
        border: 1px solid var(--rd-light);
        color: var(--rd-light);
        border-radius: var(--radius-sm);
        padding: 4px 12px;
        font-size: 0.72rem;
        cursor: pointer;
        margin-left: 8px;
        font-family: 'Noto Sans KR', sans-serif;
      }
    `
    document.head.appendChild(style)
  }
}
