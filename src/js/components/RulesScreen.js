/**
 * RulesScreen — 규칙서 화면 (멀티페이지)
 *
 * src/rules/*.md 파일들을 fetch하여 렌더링합니다.
 * [링크 텍스트](page.md) 형식으로 페이지 간 이동을 지원합니다.
 *
 * 사용:
 *   const screen = new RulesScreen()
 *   screen.mount(container)
 */
// 캐릭터 이름 → 진영 매핑
const ROLE_TEAM_MAP = {
  // Townsfolk
  '세탁부': 'town', '사서': 'town', '조사관': 'town', '요리사': 'town',
  '공감인': 'town', '점쟁이': 'town', '장의사': 'town', '수도사': 'town',
  '까마귀 사육사': 'town', '처녀': 'town', '처단자': 'town', '군인': 'town', '시장': 'town',
  // Outsider
  '집사': 'outside', '주정뱅이': 'outside', '은둔자': 'outside', '성자': 'outside',
  // Minion
  '독약꾼': 'minion', '스파이': 'minion', '진홍의 여인': 'minion', '남작': 'minion',
  // Demon
  '임프': 'demon'
}

export class RulesScreen {
  constructor({ initialPage = 'index.md' } = {}) {
    this.el = null
    this._history = []          // 방문 이력 (뒤로가기용)
    this._currentPage = null
    this._initialPage = initialPage
    this._touchStartX = 0       // 스와이프 감지용
    this._touchStartY = 0
  }

  mount(container) {
    this.el = document.createElement('div')
    this.el.className = 'rules-screen'
    container.appendChild(this.el)
    this._setupSwipeGesture()

    // 초기 페이지가 index.md가 아니면 index.md를 히스토리에 추가 (뒤로가기 지원)
    if (this._initialPage !== 'index.md') {
      this._history.push('index.md')
    }

    this._navigate(this._initialPage)
  }

  unmount() { this.el?.remove() }

  // ─── 내비게이션 ────────────────────────────────────────────

  _navigate(page) {
    if (this._currentPage && this._currentPage !== page) {
      this._history.push(this._currentPage)
    }
    this._currentPage = page
    this._load(page)
  }

  _goBack() {
    const prev = this._history.pop()
    if (prev) {
      this._currentPage = prev
      this._load(prev)
    }
  }

  _setupSwipeGesture() {
    this.el.addEventListener('touchstart', e => {
      this._touchStartX = e.touches[0].clientX
      this._touchStartY = e.touches[0].clientY
    }, { passive: true })

    this.el.addEventListener('touchend', e => {
      if (!e.changedTouches[0]) return

      const touchEndX = e.changedTouches[0].clientX
      const touchEndY = e.changedTouches[0].clientY
      const deltaX = touchEndX - this._touchStartX
      const deltaY = touchEndY - this._touchStartY

      // 가로 스와이프가 세로보다 크고, 오른쪽으로 충분히 스와이프한 경우
      if (Math.abs(deltaX) > Math.abs(deltaY) && deltaX > 80) {
        if (this._history.length > 0) {
          this._goBack()
        }
      }
    }, { passive: true })
  }

  // ─── 로드 & 렌더 ───────────────────────────────────────────

  async _load(page) {
    this.el.innerHTML = `
      <div class="rules-loading">
        <div class="rules-loading__dot"></div>
        <span>불러오는 중...</span>
      </div>
    `
    try {
      const resp = await fetch(`./rules/${page}`)
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`)
      const text = await resp.text()
      this._render(text)
    } catch (e) {
      this.el.innerHTML = `
        <div class="rules-error">
          <div style="font-size:1.4rem;margin-bottom:8px">⚠️</div>
          <div>페이지를 불러올 수 없습니다.</div>
          <div style="font-size:0.68rem;color:var(--text4);margin-top:4px">${e.message}</div>
        </div>
      `
    }
  }

  _render(text) {
    this.el.innerHTML = ''

    // 뒤로가기 버튼 (상단)
    if (this._history.length > 0) {
      const backTop = document.createElement('button')
      backTop.className = 'rules-back-btn'
      backTop.textContent = '← 뒤로'
      backTop.addEventListener('click', () => this._goBack())
      this.el.appendChild(backTop)
    }

    // 마크다운 본문
    const body = document.createElement('div')
    body.className = 'rules-body'
    body.innerHTML = this._parseMarkdown(text)
    this.el.appendChild(body)

    // 뒤로가기 버튼 (하단)
    if (this._history.length > 0) {
      const backBottom = document.createElement('button')
      backBottom.className = 'rules-back-btn rules-back-btn--bottom'
      backBottom.textContent = '← 뒤로'
      backBottom.addEventListener('click', () => this._goBack())
      this.el.appendChild(backBottom)
    }

    // 링크 이벤트 위임
    body.addEventListener('click', e => {
      const link = e.target.closest('[data-rules-page]')
      if (link) {
        e.preventDefault()
        this._navigate(link.dataset.rulesPage)
        this.el.scrollTop = 0
      }
    })
  }

  // ─── 마크다운 파서 ─────────────────────────────────────────

  _parseMarkdown(text) {
    const lines  = text.split('\n')
    const result = []
    let i = 0

    while (i < lines.length) {
      const line = lines[i]

      // 가로선
      if (/^---+$/.test(line.trim())) {
        result.push('<hr class="rules-hr">')
        i++; continue
      }
      // H1
      if (line.startsWith('# ')) {
        result.push(`<h1 class="rules-h1">${this._inline(line.slice(2))}</h1>`)
        i++; continue
      }
      // H2
      if (line.startsWith('## ')) {
        result.push(`<h2 class="rules-h2">${this._inline(line.slice(3))}</h2>`)
        i++; continue
      }
      // H4 (H3보다 먼저 체크)
      if (line.startsWith('#### ')) {
        result.push(`<h4 class="rules-h4">${this._inline(line.slice(5))}</h4>`)
        i++; continue
      }
      // H3
      if (line.startsWith('### ')) {
        result.push(`<h3 class="rules-h3">${this._inline(line.slice(4))}</h3>`)
        i++; continue
      }
      // 테이블 (| 로 시작하는 줄 연속 수집)
      if (line.startsWith('|')) {
        const rows = []
        while (i < lines.length && lines[i].startsWith('|')) {
          rows.push(lines[i])
          i++
        }
        const table = this._parseTable(rows)
        console.log('[RulesScreen] 테이블 감지:', rows.length, '행')
        result.push(table)
        continue
      }
      // 리스트 블록
      if (line.startsWith('- ')) {
        const items = []
        while (i < lines.length && lines[i].startsWith('- ')) {
          items.push(`<li>${this._inline(lines[i].slice(2))}</li>`)
          i++
        }
        result.push(`<ul class="rules-ul">${items.join('')}</ul>`)
        continue
      }
      // 빈 줄
      if (line.trim() === '') {
        result.push('<div class="rules-spacer"></div>')
        i++; continue
      }
      // 일반 단락
      result.push(`<p class="rules-p">${this._inline(line)}</p>`)
      i++
    }

    return result.join('')
  }

  /** 테이블 파서: | 로 구분된 행을 HTML table로 변환 */
  _parseTable(rows) {
    if (rows.length === 0) return ''

    const cells = rows.map(r =>
      r.split('|').slice(1, -1).map(c => c.trim())
    )

    const head = cells[0]
    // 두 번째 행이 구분선(---) 이면 제거
    const body = (cells[1] && cells[1].every(c => /^-+$/.test(c)))
      ? cells.slice(2)
      : cells.slice(1)

    const th = head.map(c => `<th>${this._inline(c)}</th>`).join('')
    const tr = body.map(row =>
      `<tr>${row.map(c => `<td>${this._inline(c)}</td>`).join('')}</tr>`
    ).join('')

    return `<table class="rules-table"><thead><tr>${th}</tr></thead><tbody>${tr}</tbody></table>`
  }

  /** 인라인 마크다운: ![alt](img), [text](*.md), **bold**, `code` */
  _inline(text) {
    // HTML 이스케이프 먼저
    let s = text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')

    // 캐릭터 이름 색상 적용 (이미지 처리 전에)
    Object.keys(ROLE_TEAM_MAP).forEach(roleName => {
      const team = ROLE_TEAM_MAP[roleName]
      const regex = new RegExp(`\\*\\*${roleName}\\*\\*`, 'g')
      s = s.replace(regex, `**<span class="role-name-${team}">${roleName}</span>**`)
    })

    // ![alt](src) → 인라인 이미지 (링크보다 먼저 처리)
    // MD 파일은 src/rules/ 에 있으므로, ../asset/ 형태 경로를 앱 루트 기준으로 보정
    s = s.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, (_, alt, src) => {
      // ../asset/... → asset/... (MD는 src/rules/ 위치, 앱 루트는 src/)
      const resolved = src.replace(/^(?:\.\.\/)+/, '')

      // 역할 아이콘: token.png 배경 위에 아이콘 오버레이
      if (/\/icons\//.test(resolved)) {
        return `<span class="rules-token-wrap" title="${alt}">`
          + `<img class="rules-token-bg" src="asset/token.png" alt="">`
          + `<img class="rules-token-icon" src="${resolved}" alt="${alt}" loading="lazy">`
          + `</span>`
      }

      // 에디션 배지 / 상태 토큰
      const cls = /\/editions\//.test(resolved) ? 'rules-icon rules-icon--badge'
                : /\/(life|death|vote|reminder|shroud|token)\.png/.test(resolved) ? 'rules-icon rules-icon--token'
                : 'rules-icon'
      return `<img class="${cls}" src="${resolved}" alt="${alt}" loading="lazy">`
    })

    // [text](page.md) → 인앱 링크
    s = s.replace(/\[([^\]]+)\]\(([^)]+\.md)\)/g, (_, label, page) =>
      `<a class="rules-link" data-rules-page="${page}">${label}</a>`
    )

    // **bold**
    s = s.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')

    // `code`
    s = s.replace(/`(.+?)`/g, '<code class="rules-code">$1</code>')

    return s
  }
}

// ── 스타일 ────────────────────────────────────────────────────

if (!document.getElementById('rules-screen-style')) {
  const style = document.createElement('style')
  style.id = 'rules-screen-style'
  style.textContent = `
.rules-screen {
  display: flex;
  flex-direction: column;
  overflow-y: auto;
  color: var(--text);
}

/* 뒤로가기 버튼 */
.rules-back-btn {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  background: none;
  border: 1px solid var(--lead2);
  border-radius: 6px;
  color: var(--tl-light);
  font-size: 0.78rem;
  padding: 4px 10px;
  margin: 6px 0 10px;
  cursor: pointer;
  transition: background 0.15s;
  flex-shrink: 0;
}
.rules-back-btn:hover { background: var(--surface2); }
.rules-back-btn:active { background: var(--surface3); }

/* 하단 뒤로가기 버튼 */
.rules-back-btn--bottom {
  margin: 20px auto 12px;
  display: flex;
  width: fit-content;
  padding: 8px 20px;
  font-size: 0.85rem;
  background: var(--surface2);
  border-color: var(--lead2);
}
.rules-back-btn--bottom:hover {
  background: var(--surface3);
  border-color: var(--tl-light);
}

.rules-body {
  padding: 4px 0 24px;
}

/* 로딩 */
.rules-loading {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 40px 20px;
  color: var(--text3);
  font-size: 0.82rem;
}
.rules-loading__dot {
  width: 10px; height: 10px;
  border-radius: 50%;
  background: var(--pu-base);
  animation: dot-pulse 1.2s infinite;
  flex-shrink: 0;
}
.rules-error {
  text-align: center;
  padding: 40px 20px;
  color: var(--text3);
  font-size: 0.82rem;
}

/* ── 역할 토큰 (token.png 배경 + 아이콘 오버레이) ── */
.rules-token-wrap {
  position: relative;
  display: inline-block;
  width: 30px;
  height: 30px;
  vertical-align: -8px;
  margin-right: 4px;
  flex-shrink: 0;
}
.rules-h1 .rules-token-wrap { width: 42px; height: 42px; vertical-align: -12px; margin-right: 7px; }
.rules-h2 .rules-token-wrap { width: 36px; height: 36px; vertical-align: -10px; margin-right: 6px; }
.rules-h3 .rules-token-wrap { width: 33px; height: 33px; vertical-align: -8px;  margin-right: 5px; }

.rules-token-bg,
.rules-token-icon {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  display: block;
}
.rules-token-icon { object-fit: contain; }

/* ── 에디션 배지 / 상태 토큰 ─────────────────── */
.rules-icon {
  display: inline-block;
  width: 30px;
  height: 30px;
  vertical-align: -8px;
  object-fit: cover;
  flex-shrink: 0;
  margin-right: 4px;
}
.rules-h1 .rules-icon { width: 42px; height: 42px; vertical-align: -12px; margin-right: 7px; }
.rules-h2 .rules-icon { width: 36px; height: 36px; vertical-align: -10px; margin-right: 6px; }
.rules-h3 .rules-icon { width: 33px; height: 33px; vertical-align: -8px;  margin-right: 5px; }

/* 에디션 배지 (정사각형 PNG) */
.rules-icon--badge           { border-radius: 5px; box-shadow: 0 1px 5px rgba(0,0,0,0.6); }
.rules-h1 .rules-icon--badge { border-radius: 6px; }

/* 상태 토큰 (life / death / vote / reminder / shroud) – 투명 배경 */
.rules-icon--token {
  box-shadow: none;
  filter: drop-shadow(0 1px 3px rgba(0,0,0,0.6));
}

/* 헤더 */
.rules-h1 {
  font-family: 'Noto Serif KR', serif;
  font-size: 1.2rem;
  font-weight: 700;
  color: var(--gold2);
  padding: 12px 0 6px;
  border-bottom: 1px solid var(--lead2);
  margin-bottom: 4px;
}
.rules-h1 .role-name-town { color: var(--bl-light); }
.rules-h1 .role-name-outside { color: var(--tl-light); }
.rules-h1 .role-name-minion { color: var(--rd-light); }
.rules-h1 .role-name-demon { color: var(--rd-light); }
.rules-h2 {
  font-family: 'Noto Serif KR', serif;
  font-size: 1rem;
  font-weight: 700;
  color: var(--tl-light);
  padding: 14px 0 4px;
}
.rules-h2 .role-name-town { color: var(--bl-light); }
.rules-h2 .role-name-outside { color: var(--tl-light); }
.rules-h2 .role-name-minion { color: var(--rd-light); }
.rules-h2 .role-name-demon { color: var(--rd-light); }
.rules-h3 {
  font-size: 0.88rem;
  font-weight: 700;
  color: var(--pu-light);
  padding: 10px 0 2px;
}
.rules-h4 {
  font-size: 0.82rem;
  font-weight: 700;
  color: var(--text2);
  padding: 8px 0 2px;
}

/* 가로선 */
.rules-hr {
  border: none;
  border-top: 1px solid var(--lead2);
  margin: 6px 0;
}

/* 단락 */
.rules-p {
  font-size: 0.82rem;
  color: var(--text2);
  line-height: 1.7;
  margin: 3px 0;
}

/* 리스트 */
.rules-ul {
  margin: 4px 0 4px 4px;
  padding-left: 16px;
}
.rules-ul li {
  font-size: 0.82rem;
  color: var(--text2);
  line-height: 1.65;
  margin-bottom: 2px;
}
.rules-ul li::marker {
  color: var(--pu-base);
}

/* 인라인 링크 */
.rules-link {
  color: var(--tl-light);
  text-decoration: underline;
  text-decoration-color: color-mix(in srgb, var(--tl-light) 40%, transparent);
  text-underline-offset: 2px;
  cursor: pointer;
  font-weight: 500;
}
.rules-link:hover {
  color: var(--tl-base);
  text-decoration-color: var(--tl-base);
}

/* 인라인 */
.rules-body strong { color: var(--text); font-weight: 700; }
.role-name-town { color: var(--bl-light) !important; }
.role-name-outside { color: var(--tl-light) !important; }
.role-name-minion { color: var(--rd-light) !important; }
.role-name-demon { color: var(--rd-light) !important; font-weight: 800 !important; text-shadow: 0 0 8px rgba(110,27,31,0.6); }
.rules-code {
  background: var(--surface2);
  border: 1px solid var(--lead2);
  border-radius: 3px;
  padding: 1px 5px;
  font-size: 0.78rem;
  color: var(--tl-light);
}

/* 테이블 */
.rules-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.78rem;
  margin: 12px 0;
  background: var(--surface);
  border: 1px solid var(--lead2);
  border-radius: 8px;
  overflow: hidden;
}
.rules-table th {
  text-align: center;
  color: var(--text);
  font-weight: 600;
  padding: 10px 6px;
  background: var(--surface2);
  border-bottom: 2px solid var(--lead2);
  vertical-align: middle;
  font-size: 0.7rem;
  line-height: 1.4;
  word-break: keep-all;
  min-width: 60px;
}
.rules-table th:first-child {
  text-align: left;
  padding-left: 12px;
}
.rules-table th img,
.rules-table td img {
  display: inline-block;
  vertical-align: middle;
  width: 16px;
  height: 16px;
  object-fit: contain;
  margin-right: 3px;
  margin-bottom: 1px;
}
.rules-table td {
  color: var(--text2);
  padding: 8px 6px;
  text-align: center;
  border-bottom: 1px solid color-mix(in srgb, var(--lead2) 50%, transparent);
  vertical-align: middle;
}
.rules-table tr:last-child td { border-bottom: none; }
.rules-table td:first-child {
  text-align: left;
  font-weight: 600;
  color: var(--text);
  padding-left: 12px;
}

/* 여백 */
.rules-spacer { height: 4px; }
  `
  document.head.appendChild(style)
}
