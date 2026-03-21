/**
 * C-07c NightRevealNote — 밤 정보 공개 쪽지
 *
 * display 모드: 자동 포맷 렌더링 (숫자 강조 · 행동 안내 분리)
 * edit   모드: 탭 → textarea 편집, 포커스 아웃 → 다시 렌더링
 */
import { ROLES_BY_ID } from '../data/roles-tb.js'

const TEAM_COLORS = {
  town:    { color: 'var(--bl-light)', glow: 'rgba(46,74,143,0.15)' },
  outside: { color: 'var(--tl-light)', glow: 'rgba(91,179,198,0.12)' },
  minion:  { color: 'var(--rd-light)', glow: 'rgba(140,48,48,0.18)' },
  demon:   { color: 'var(--rd-light)', glow: 'rgba(110,27,31,0.22)' },
  default: { color: 'var(--gold2)',    glow: 'rgba(212,168,40,0.1)' },
}

export function mountNightRevealNote(data) {
  const { roleIcon, roleName, roleTeam, message, onNext } = data
  const tc = TEAM_COLORS[roleTeam] || TEAM_COLORS.default

  const overlay = document.createElement('div')
  overlay.className = 'reveal-note-overlay panel-overlay'

  const panel = document.createElement('div')
  panel.className = 'reveal-note-panel'
  panel.style.background =
    `radial-gradient(ellipse 100% 35% at 50% 0%, ${tc.glow} 0%, transparent 50%)`

  // ── 상단 바 ──
  const topBar = document.createElement('div')
  topBar.className = 'reveal-note__top-bar'

  const roleBadge = document.createElement('div')
  roleBadge.className = 'reveal-note__role-badge'
  if (roleIcon && roleIcon.endsWith('.png')) {
    roleBadge.innerHTML = `
      <div style="position:relative;width:18px;height:18px;flex-shrink:0;">
        <img src="./asset/token.png" style="position:absolute;inset:0;width:100%;height:100%;" alt="">
        <img src="./asset/icons/${roleIcon}" style="position:absolute;inset:0;width:100%;height:100%;object-fit:contain;" alt="">
      </div>
      <span style="color:${tc.color}">${roleName}</span>
    `
  } else {
    roleBadge.innerHTML =
      `<span>${roleIcon || '🎴'}</span><span style="color:${tc.color}">${roleName}</span>`
  }

  const editHint = document.createElement('span')
  editHint.className = 'reveal-note__edit-hint'
  editHint.textContent = '탭하여 수정'

  topBar.appendChild(roleBadge)
  topBar.appendChild(editHint)
  panel.appendChild(topBar)

  // ── 메시지 카드 ──
  const card = document.createElement('div')
  card.className = 'reveal-note__card'

  // display 모드: 렌더링된 body
  const bodyEl = document.createElement('div')
  bodyEl.className = 'reveal-note__body'

  // edit 모드: textarea (기본 숨김)
  const textarea = document.createElement('textarea')
  textarea.className = 'reveal-note__textarea'
  textarea.value = message || ''
  textarea.style.display = 'none'

  // 렌더 + 자동 스케일 (display 모드)
  let _scaledFs = '1.4rem'
  const _refresh = (text) => {
    _renderInto(bodyEl, text, tc.color)
    _autoScale(bodyEl, (fs) => {
      _scaledFs = fs
      textarea.style.fontSize = fs
    })
  }
  _refresh(message || '')

  // 카드 탭 → edit 모드
  card.addEventListener('click', () => {
    if (textarea.style.display !== 'none') return
    bodyEl.style.display = 'none'
    textarea.style.display = 'block'
    textarea.style.fontSize = _scaledFs
    card.classList.add('reveal-note__card--editing')
    editHint.textContent = '수정 중'
    textarea.focus()
    textarea.setSelectionRange(textarea.value.length, textarea.value.length)
  })

  // textarea blur → display 모드 (재렌더링 + 재스케일)
  textarea.addEventListener('blur', () => {
    _refresh(textarea.value)
    bodyEl.style.display = 'flex'
    textarea.style.display = 'none'
    card.classList.remove('reveal-note__card--editing')
    editHint.textContent = '탭하여 수정'
  })

  card.appendChild(bodyEl)
  card.appendChild(textarea)
  panel.appendChild(card)

  // ── 다음 버튼 ──
  const nextBtn = document.createElement('button')
  nextBtn.className = 'reveal-note__next btn btn-primary'
  nextBtn.textContent = '[ 호스트 ] 다음 →'
  nextBtn.addEventListener('click', () => {
    overlay.remove()
    onNext?.()
  })
  panel.appendChild(nextBtn)

  overlay.appendChild(panel)
  document.body.appendChild(overlay)
  return () => overlay.remove()
}

// ── 자동 폰트 스케일 ───────────────────────────────────────────

/**
 * bodyEl 안의 .reveal-note__main 폰트 크기를 이진 탐색으로 결정.
 * 가용 높이에 꽉 차면서 넘치지 않는 최대 크기를 찾는다.
 * @param {HTMLElement} bodyEl
 * @param {Function}    onScaled  (finalFontSize: string) → void
 */
function _autoScale(bodyEl, onScaled) {
  requestAnimationFrame(() => {
    const mainEl = bodyEl.querySelector('.reveal-note__main')
    if (!mainEl) return

    const bodyH = bodyEl.clientHeight
    if (bodyH === 0) {
      // 아직 레이아웃 미완성 — 한 프레임 더 기다림
      requestAnimationFrame(() => _autoScale(bodyEl, onScaled))
      return
    }

    // 고정 요소(구분선 + 행동 안내)의 실제 높이 합산
    const fixedH = [...bodyEl.children]
      .filter(el => el !== mainEl)
      .reduce((sum, el) => {
        const s = getComputedStyle(el)
        return sum + el.offsetHeight
          + (parseFloat(s.marginTop)    || 0)
          + (parseFloat(s.marginBottom) || 0)
      }, 0)

    const targetH = bodyH - fixedH - 4   // 4px 여유

    if (targetH < 20) return

    const MIN = 0.85   // rem — 너무 작아지지 않도록
    const MAX = 6.0    // rem — 최대 크기 제한

    const containerW = mainEl.clientWidth
    const paraEls    = [...mainEl.querySelectorAll('.reveal-note__para')]

    // 이진 탐색: 세로(높이) + 가로(줄바꿈 없음) 둘 다 만족하는 최대 fontSize
    mainEl.style.flex   = 'none'
    mainEl.style.height = 'auto'

    let lo = MIN, hi = MAX
    for (let i = 0; i < 16; i++) {
      const mid = (lo + hi) / 2
      mainEl.style.fontSize = `${mid}rem`

      // ① 세로 제약: 전체 높이가 가용 공간 이하
      const heightOk = mainEl.scrollHeight <= targetH

      // ② 가로 제약: nowrap 적용 후 가장 넓은 줄이 컨테이너 너비 이하
      //    (= <br> 으로 나뉜 각 줄이 자연 너비에서 넘치지 않음)
      paraEls.forEach(p => { p.style.whiteSpace = 'nowrap' })
      const widthOk = mainEl.scrollWidth <= containerW
      paraEls.forEach(p => { p.style.whiteSpace = '' })

      if (heightOk && widthOk) lo = mid
      else                     hi = mid
    }

    // 복원 후 최종 크기 적용
    mainEl.style.flex   = ''
    mainEl.style.height = ''
    const fs = `${lo.toFixed(2)}rem`
    mainEl.style.fontSize = fs
    onScaled?.(fs)
  })
}

// ── 메시지 렌더러 ─────────────────────────────────────────────

/**
 * text 를 파싱해 bodyEl 안을 채운다.
 * - \n\n  → 문단 구분
 * - \n    → 줄 바꿈
 * - 마지막 문단에 "눈을 감으세요" → 행동 안내 스타일
 * - 숫자번 패턴 → 금색 강조
 */
function _renderInto(container, text, teamColor) {
  container.innerHTML = ''
  if (!text.trim()) return

  const paras     = text.split('\n\n')
  const lastPara  = paras[paras.length - 1]
  const hasAction = /눈을 감으세요/.test(lastPara)

  const contentParas = hasAction ? paras.slice(0, -1) : paras
  const actionPara   = hasAction ? lastPara : null

  // 본문 — flex:1 으로 카드 공간 채움, 수직 중앙
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

  // 행동 안내 — 항상 하단
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

/**
 * 자동 컬러 파싱 규칙 — 추가하려면 이 배열에만 넣으면 됨
 * cls 는 string | (matchedText) => string 모두 허용
 * 순서 중요: 더 구체적인 패턴을 앞에 배치
 */
const _MARKUP_RULES = [
  // 자리번호: 3번, 5번  (번째 제외)
  { re: /(\d+번)(?!째)/g,              cls: 'reveal-note__num'   },
  // 카운트: 2명, 3쌍, 0개 — 숫자 크게 + 단위 작게 + 칩 배경
  { re: /\d+\s*[명쌍개]/g, render(m) {
      const n = m.match(/\d+/)[0]
      const u = m.match(/[명쌍개]/)[0]
      return `<b class="reveal-note__count"><span class="reveal-note__count-n">${n}</span><span class="reveal-note__count-u">${u}</span></b>`
    },
  },
  // 긍정 답변
  { re: /(예)(?=[,.\s\n]|$)/gm,       cls: 'reveal-note__yes'   },
  // 부정 답변
  { re: /(아니오)/g,                   cls: 'reveal-note__no'    },
]

// 역할 이름 → 진영 CSS 클래스 매핑 (모듈 로드 시 한 번만 빌드)
;(() => {
  const nameToClass = {}
  const names = []
  for (const role of Object.values(ROLES_BY_ID)) {
    if (!role.name || !role.team) continue
    nameToClass[role.name] = `reveal-note__role--${role.team}`
    names.push(role.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
  }
  if (!names.length) return
  // 긴 이름 우선 매칭 (부분 포함 방지)
  names.sort((a, b) => b.length - a.length)
  _MARKUP_RULES.push({
    re:  new RegExp(`(${names.join('|')})`, 'g'),
    cls: (name) => nameToClass[name] || 'reveal-note__role--default',
  })
})()

/** HTML 이스케이프 후 규칙 배열 기반 자동 파싱 */
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

/* 상단 바 */
.reveal-note__top-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-shrink: 0;
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
}
.reveal-note__edit-hint {
  font-size: 0.58rem;
  color: var(--text4);
  letter-spacing: 0.04em;
  transition: color 0.15s;
}

/* 메시지 카드 */
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
/* 본문 래퍼 — JS 가 fontSize 를 동적 계산해 여기에 설정 */
.reveal-note__main {
  flex: 1;
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: 0.4em;            /* 폰트 크기에 비례한 단락 간격 */
  font-size: 1.4rem;     /* JS 오버라이드 전 기본값 */
}
.reveal-note__para {
  margin: 0;
  font-size: 1em;        /* .reveal-note__main 에서 상속 */
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
/* 역할 이름 — 진영별 */
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

/* 행동 안내 — 하단 고정 */
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

/* textarea (edit 모드) — font-size 는 JS 가 _scaledFs 로 설정 */
.reveal-note__textarea {
  flex: 1;
  width: 100%;
  box-sizing: border-box;
  resize: none;
  font-family: 'Noto Sans KR', sans-serif;
  font-size: 1.4rem;     /* JS 오버라이드 전 기본값 */
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

/* 다음 버튼 */
.reveal-note__next {
  flex-shrink: 0;
  width: 100%;
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
