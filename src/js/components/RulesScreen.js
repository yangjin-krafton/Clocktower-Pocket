/**
 * RulesScreen — 규칙서 화면
 *
 * src/docs/rules.md 파일을 fetch하여 렌더링합니다.
 * 하드코딩 없이 MD 문서를 직접 서빙하는 구조입니다.
 *
 * 사용:
 *   const screen = new RulesScreen()
 *   screen.mount(container)
 */
export class RulesScreen {
  constructor() {
    this.el = null
  }

  mount(container) {
    this.el = document.createElement('div')
    this.el.className = 'rules-screen'
    this._render()
    container.appendChild(this.el)
  }

  unmount() { this.el?.remove() }

  async _render() {
    // 로딩 표시
    this.el.innerHTML = `
      <div class="rules-loading">
        <div class="rules-loading__dot"></div>
        <span>규칙서 불러오는 중...</span>
      </div>
    `

    try {
      // 앱 루트 기준 상대경로로 fetch
      const resp = await fetch('./docs/rules.md')
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`)
      const text = await resp.text()
      this._renderMarkdown(text)
    } catch (e) {
      this.el.innerHTML = `
        <div class="rules-error">
          <div style="font-size:1.4rem;margin-bottom:8px">⚠️</div>
          <div>규칙서를 불러올 수 없습니다.</div>
          <div style="font-size:0.68rem;color:var(--text4);margin-top:4px">${e.message}</div>
        </div>
      `
    }
  }

  // ─── 마크다운 파서 ─────────────────────────────────────────

  _renderMarkdown(text) {
    this.el.innerHTML = ''

    const lines  = text.split('\n')
    const result = []
    let i = 0

    while (i < lines.length) {
      const line = lines[i]

      // 가로선
      if (/^---+$/.test(line.trim())) {
        result.push('<hr class="rules-hr">')
        i++
        continue
      }
      // H1
      if (line.startsWith('# ')) {
        result.push(`<h1 class="rules-h1">${this._inline(line.slice(2))}</h1>`)
        i++
        continue
      }
      // H2
      if (line.startsWith('## ')) {
        result.push(`<h2 class="rules-h2">${this._inline(line.slice(3))}</h2>`)
        i++
        continue
      }
      // H3
      if (line.startsWith('### ')) {
        result.push(`<h3 class="rules-h3">${this._inline(line.slice(4))}</h3>`)
        i++
        continue
      }
      // 리스트 블록 수집
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
        i++
        continue
      }
      // 일반 단락
      result.push(`<p class="rules-p">${this._inline(line)}</p>`)
      i++
    }

    this.el.innerHTML = result.join('')
  }

  /** 인라인 마크다운 처리: **bold**, `code` */
  _inline(text) {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/`(.+?)`/g, '<code class="rules-code">$1</code>')
  }
}

// ── 스타일 ────────────────────────────────────────────────────

if (!document.getElementById('rules-screen-style')) {
  const style = document.createElement('style')
  style.id = 'rules-screen-style'
  style.textContent = `
.rules-screen {
  padding: 4px 0 24px;
  color: var(--text);
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
.rules-h2 {
  font-family: 'Noto Serif KR', serif;
  font-size: 1rem;
  font-weight: 700;
  color: var(--tl-light);
  padding: 14px 0 4px;
}
.rules-h3 {
  font-size: 0.88rem;
  font-weight: 700;
  color: var(--pu-light);
  padding: 10px 0 2px;
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

/* 인라인 */
.rules-screen strong { color: var(--text); font-weight: 700; }
.rules-code {
  background: var(--surface2);
  border: 1px solid var(--lead2);
  border-radius: 3px;
  padding: 1px 5px;
  font-size: 0.78rem;
  color: var(--tl-light);
}

/* 여백 */
.rules-spacer { height: 4px; }
  `
  document.head.appendChild(style)
}
