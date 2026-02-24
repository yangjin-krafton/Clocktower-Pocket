/**
 * C-09 EmojiPopup — 이모지 수신 팝업 (참가자 전용)
 * @param {Object} data  { fromName, emoji, duration }
 * 우상단에 슬라이드인 후 자동 소멸
 */
export function showEmojiPopup(data) {
  const { fromName, emoji, duration = 3000 } = data

  // 컨테이너 (복수 팝업 스택용)
  let container = document.getElementById('emoji-popup-container')
  if (!container) {
    container = document.createElement('div')
    container.id = 'emoji-popup-container'
    document.body.appendChild(container)
  }

  const popup = document.createElement('div')
  popup.className = 'emoji-popup'
  popup.innerHTML = `
    <span class="emoji-popup__emoji">${emoji}</span>
    <div class="emoji-popup__info">
      <div class="emoji-popup__from">${fromName}</div>
      <div class="emoji-popup__label">시그널을 보냈습니다</div>
    </div>
  `

  container.appendChild(popup)

  // 슬라이드인
  requestAnimationFrame(() => {
    popup.classList.add('emoji-popup--visible')
  })

  // 자동 소멸
  setTimeout(() => {
    popup.classList.add('emoji-popup--hiding')
    popup.addEventListener('transitionend', () => popup.remove(), { once: true })
  }, duration)

  return popup
}

if (!document.getElementById('emoji-popup-style')) {
  const style = document.createElement('style')
  style.id = 'emoji-popup-style'
  style.textContent = `
#emoji-popup-container {
  position: fixed;
  top: 60px;
  right: 12px;
  z-index: 300;
  display: flex;
  flex-direction: column;
  gap: 6px;
  pointer-events: none;
}
.emoji-popup {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 14px;
  background: var(--surface);
  border: 1px solid rgba(91,179,198,0.35);
  border-radius: 12px;
  box-shadow: 0 4px 20px rgba(0,0,0,0.5), 0 0 12px rgba(91,179,198,0.15);
  transform: translateX(120%);
  opacity: 0;
  transition: transform 0.3s cubic-bezier(0.34,1.56,0.64,1), opacity 0.3s;
  pointer-events: auto;
}
.emoji-popup--visible {
  transform: translateX(0);
  opacity: 1;
}
.emoji-popup--hiding {
  transform: translateX(120%);
  opacity: 0;
}
.emoji-popup__emoji { font-size: 1.8rem; line-height: 1; }
.emoji-popup__info { display: flex; flex-direction: column; gap: 1px; }
.emoji-popup__from { font-size: 0.75rem; font-weight: 700; color: var(--tl-light); }
.emoji-popup__label { font-size: 0.6rem; color: var(--text3); }
  `
  document.head.appendChild(style)
}
