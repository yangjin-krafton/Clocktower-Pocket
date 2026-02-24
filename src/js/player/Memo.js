/**
 * P-06 Memo — 개인 메모장 (localStorage)
 */
export class Memo {
  constructor() {
    this.el = null
  }

  mount(container) {
    this.el = document.createElement('div')
    this.el.className = 'memo-screen'
    this._render()
    container.appendChild(this.el)
  }

  unmount() { this.el?.remove() }

  _render() {
    const saved = localStorage.getItem('ct-memo') || ''
    this.el.innerHTML = ''

    const label = document.createElement('div')
    label.innerHTML = `
      <div class="section-label" style="margin-bottom:8px">📝 추리 메모</div>
      <div style="font-size:0.65rem;color:var(--text4);margin-bottom:8px">자동 저장됩니다. P2P 전송 없음.</div>
    `
    this.el.appendChild(label)

    const textarea = document.createElement('textarea')
    textarea.className = 'textarea'
    textarea.style.minHeight = '300px'
    textarea.value = saved
    textarea.placeholder = '여기에 추리 메모를 적으세요...\n\n예)\n- 3번 Alice: 점술사 주장, 신뢰 가능\n- 7번 Bob: 임프 의심\n- Chef 결과: 이웃 악 쌍 1개'
    textarea.addEventListener('input', () => {
      localStorage.setItem('ct-memo', textarea.value)
    })
    this.el.appendChild(textarea)

    const clearBtn = document.createElement('button')
    clearBtn.className = 'btn btn-danger mt-8'
    clearBtn.textContent = '🗑 메모 초기화'
    clearBtn.addEventListener('click', () => {
      if (confirm('메모를 초기화할까요?')) {
        textarea.value = ''
        localStorage.removeItem('ct-memo')
      }
    })
    this.el.appendChild(clearBtn)
  }
}
