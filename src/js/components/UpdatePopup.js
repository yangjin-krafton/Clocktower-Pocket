/**
 * UpdatePopup — 업데이트 일지 팝업
 * 새 버전이 있으면 랜딩 페이지에서 자동으로 표시한다.
 * localStorage에 마지막으로 확인한 버전을 저장하여 중복 표시 방지.
 */

const SEEN_KEY = 'ctp_update_seen'
const SEEN_TIME_KEY = 'ctp_update_seen_at'
const CURRENT_VERSION = 'v0.2'
const RESHOW_INTERVAL_MS = 24 * 60 * 60 * 1000 // 1일

export class UpdatePopup {
  constructor() {
    this.el = null
    this._injectStyles()
  }

  /** 아직 확인하지 않은 업데이트가 있으면 팝업을 표시한다 */
  async show(container) {
    const seen = localStorage.getItem(SEEN_KEY)
    const seenAt = parseInt(localStorage.getItem(SEEN_TIME_KEY) || '0', 10)
    // 같은 버전을 확인한 지 1일 이내면 표시하지 않음
    if (seen === CURRENT_VERSION && (Date.now() - seenAt) < RESHOW_INTERVAL_MS) return

    try {
      const res = await fetch(`updates/${CURRENT_VERSION}.md`)
      if (!res.ok) return
      const md = await res.text()
      this._renderPopup(container, md)
    } catch {
      // 네트워크 오류 시 무시
    }
  }

  _renderPopup(container, md) {
    this.el = document.createElement('div')
    this.el.className = 'upd-overlay'
    this.el.innerHTML = `
      <div class="upd-popup">
        <div class="upd-popup__body">${this._parseMd(md)}</div>
        <button class="upd-popup__close" data-action="close">확인</button>
      </div>
    `
    container.appendChild(this.el)

    // 배경 클릭으로 닫기
    this.el.addEventListener('click', (e) => {
      if (e.target === this.el) this._close()
    })
    // 확인 버튼
    this.el.querySelector('[data-action="close"]').addEventListener('click', () => {
      this._close()
    })

    // 등장 애니메이션
    requestAnimationFrame(() => this.el.classList.add('upd-overlay--visible'))
  }

  _close() {
    localStorage.setItem(SEEN_KEY, CURRENT_VERSION)
    localStorage.setItem(SEEN_TIME_KEY, String(Date.now()))
    this.el.classList.remove('upd-overlay--visible')
    setTimeout(() => this.el?.remove(), 200)
  }

  /** 간단한 마크다운 파서 (h1, h2, ul, bold, p) */
  _parseMd(text) {
    const lines = text.split('\n')
    const result = []
    let i = 0

    while (i < lines.length) {
      const line = lines[i]

      if (line.startsWith('# ')) {
        result.push(`<h1 class="upd-h1">${this._inline(line.slice(2))}</h1>`)
        i++; continue
      }
      if (line.startsWith('## ')) {
        result.push(`<h2 class="upd-h2">${this._inline(line.slice(3))}</h2>`)
        i++; continue
      }
      if (line.startsWith('- ')) {
        const items = []
        while (i < lines.length && lines[i].startsWith('- ')) {
          items.push(`<li>${this._inline(lines[i].slice(2))}</li>`)
          i++
        }
        result.push(`<ul class="upd-ul">${items.join('')}</ul>`)
        continue
      }
      if (line.trim() === '') {
        i++; continue
      }
      result.push(`<p class="upd-p">${this._inline(line)}</p>`)
      i++
    }
    return result.join('')
  }

  _inline(text) {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/`(.+?)`/g, '<code class="upd-code">$1</code>')
  }

  _injectStyles() {
    if (document.getElementById('upd-popup-style')) return
    const style = document.createElement('style')
    style.id = 'upd-popup-style'
    style.textContent = `
      .upd-overlay {
        position: fixed;
        inset: 0;
        background: rgba(0, 0, 0, 0.7);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 500;
        padding: 24px;
        opacity: 0;
        transition: opacity 0.2s;
      }

      .upd-overlay--visible {
        opacity: 1;
      }

      .upd-popup {
        background: var(--surface);
        border: 1px solid var(--lead2);
        border-radius: var(--radius-lg);
        max-width: 480px;
        width: 100%;
        max-height: 75vh;
        display: flex;
        flex-direction: column;
        overflow: hidden;
        box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5);
      }

      .upd-popup__body {
        padding: 24px 20px 16px;
        overflow-y: auto;
        flex: 1;
        -webkit-overflow-scrolling: touch;
      }

      .upd-h1 {
        font-family: 'Noto Serif KR', serif;
        font-size: 1.2rem;
        font-weight: 700;
        color: var(--gold2);
        margin-bottom: 16px;
        text-align: center;
      }

      .upd-h2 {
        font-family: 'Noto Serif KR', serif;
        font-size: 0.92rem;
        font-weight: 700;
        color: var(--tl-light);
        margin: 14px 0 6px;
        padding-bottom: 4px;
        border-bottom: 1px solid var(--lead2);
      }

      .upd-ul {
        list-style: none;
        padding: 0;
        margin: 0 0 4px;
      }

      .upd-ul li {
        font-size: 0.8rem;
        color: var(--text2);
        padding: 3px 0 3px 14px;
        position: relative;
        line-height: 1.5;
      }

      .upd-ul li::before {
        content: '·';
        position: absolute;
        left: 2px;
        color: var(--text4);
        font-weight: 700;
      }

      .upd-p {
        font-size: 0.8rem;
        color: var(--text2);
        line-height: 1.5;
        margin: 4px 0;
      }

      .upd-code {
        background: var(--surface2);
        padding: 1px 5px;
        border-radius: 3px;
        font-size: 0.75rem;
        color: var(--pu-light);
      }

      .upd-popup__close {
        background: var(--tl-dark);
        color: var(--tl-light);
        border: none;
        border-top: 1px solid var(--lead2);
        padding: 14px;
        font-size: 0.9rem;
        font-family: 'Noto Sans KR', sans-serif;
        font-weight: 500;
        cursor: pointer;
        transition: background 0.15s;
        width: 100%;
      }

      .upd-popup__close:active {
        background: var(--tl-base);
      }
    `
    document.head.appendChild(style)
  }
}
