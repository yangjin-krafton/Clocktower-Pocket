/**
 * C-08 EmojiPicker — 이모지 시그널 전송 패널 (참가자 전용)
 * @param {Object[]} players   수신 대상 목록 (전체 포함)
 * @param {Object[]} emojis    [{ emoji, label }]
 * @param {Function} onSend    (targetId|'all', emoji) => void
 * @param {number}   myId      내 player id (수신자 목록에서 제외)
 * @returns {HTMLElement}
 */
export function renderEmojiPicker(players, emojis, onSend, myId) {
  let selectedTarget = 'all'

  const el = document.createElement('div')
  el.className = 'emoji-picker'

  // ─ 수신 대상 섹션 ─
  const recipientSection = document.createElement('div')
  recipientSection.className = 'emoji-picker__section'
  recipientSection.innerHTML = '<div class="emoji-picker__label">받을 사람</div>'

  const recipientRow = document.createElement('div')
  recipientRow.className = 'emoji-picker__recipients'

  // "전체" 옵션
  const allBtn = makeRecipient('all', '👥', '전체', true)
  recipientRow.appendChild(allBtn)

  // 각 플레이어 (본인 제외)
  const others = players.filter(p => p.id !== myId && p.status === 'alive')
  others.forEach(p => {
    recipientRow.appendChild(makeRecipient(p.id, p.icon || '👤', `${p.id}번`, false))
  })

  recipientSection.appendChild(recipientRow)
  el.appendChild(recipientSection)

  // ─ 이모지 그리드 ─
  const emojiSection = document.createElement('div')
  emojiSection.className = 'emoji-picker__section'
  emojiSection.innerHTML = '<div class="emoji-picker__label">보낼 시그널</div>'

  const emojiGrid = document.createElement('div')
  emojiGrid.className = 'emoji-picker__grid'

  emojis.forEach(({ emoji, label }) => {
    const btn = document.createElement('button')
    btn.className = 'emoji-picker__emoji-btn'
    btn.innerHTML = `<span class="emoji-picker__emoji">${emoji}</span><span class="emoji-picker__emoji-lbl">${label}</span>`
    btn.addEventListener('click', () => {
      onSend && onSend(selectedTarget, emoji)
      showSentFeedback(btn)
    })
    emojiGrid.appendChild(btn)
  })

  emojiSection.appendChild(emojiGrid)
  el.appendChild(emojiSection)

  // 전송 피드백
  function showSentFeedback(btn) {
    const fb = document.createElement('div')
    fb.className = 'emoji-picker__feedback'
    fb.textContent = '전송됨!'
    btn.appendChild(fb)
    setTimeout(() => fb.remove(), 1000)
  }

  // 수신자 버튼 생성
  function makeRecipient(id, icon, name, isInitialActive) {
    const btn = document.createElement('button')
    btn.className = 'emoji-picker__recipient' + (isInitialActive ? ' emoji-picker__recipient--active' : '')
    btn.innerHTML = `<span>${icon}</span><span class="emoji-picker__recipient-name">${name}</span>`
    btn.addEventListener('click', () => {
      selectedTarget = id
      recipientRow.querySelectorAll('.emoji-picker__recipient').forEach(b => b.classList.remove('emoji-picker__recipient--active'))
      btn.classList.add('emoji-picker__recipient--active')
    })
    return btn
  }

  return el
}

if (!document.getElementById('emoji-picker-style')) {
  const style = document.createElement('style')
  style.id = 'emoji-picker-style'
  style.textContent = `
.emoji-picker { display: flex; flex-direction: column; gap: 16px; }
.emoji-picker__section {}
.emoji-picker__label {
  font-size: 0.62rem;
  font-weight: 700;
  color: var(--text4);
  letter-spacing: 0.06em;
  text-transform: uppercase;
  margin-bottom: 8px;
}
.emoji-picker__recipients {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
}
.emoji-picker__recipient {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  padding: 6px 10px;
  border-radius: 8px;
  border: 1px solid var(--lead2);
  background: var(--surface);
  cursor: pointer;
  color: var(--text2);
  font-size: 1rem;
  transition: all 0.15s;
  min-width: 52px;
}
.emoji-picker__recipient--active {
  border-color: var(--tl-base);
  background: rgba(91,179,198,0.12);
  color: var(--tl-light);
}
.emoji-picker__recipient-name { font-size: 0.58rem; color: inherit; }
.emoji-picker__grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 6px;
}
.emoji-picker__emoji-btn {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 3px;
  padding: 10px 4px;
  border-radius: 8px;
  border: 1px solid var(--lead2);
  background: var(--surface);
  cursor: pointer;
  transition: all 0.15s;
  position: relative;
  -webkit-tap-highlight-color: transparent;
}
.emoji-picker__emoji-btn:active { transform: scale(0.9); background: var(--surface2); }
.emoji-picker__emoji { font-size: 1.4rem; line-height: 1; }
.emoji-picker__emoji-lbl { font-size: 0.52rem; color: var(--text3); }
.emoji-picker__feedback {
  position: absolute;
  top: -20px; left: 50%;
  transform: translateX(-50%);
  background: var(--tl-dark);
  color: white;
  font-size: 0.6rem;
  padding: 2px 6px;
  border-radius: 6px;
  white-space: nowrap;
  pointer-events: none;
  animation: fade-up 1s forwards;
}
@keyframes fade-up {
  0%   { opacity: 1; transform: translateX(-50%) translateY(0); }
  100% { opacity: 0; transform: translateX(-50%) translateY(-10px); }
}
  `
  document.head.appendChild(style)
}
