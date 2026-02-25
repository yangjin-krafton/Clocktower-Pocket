/**
 * C-10 NightOrderList — 밤 순서 목록
 * @param {Object} data  { nightOrder, currentStep, doneSteps }
 * @param {Function} onStepClick  optional
 * @returns {HTMLElement}
 */
import { ROLES_BY_ID } from '../data/roles-tb.js'

const SPECIAL_STEPS = {
  'minion-info': { name: '미니언 공개', icon: '🎭' },
  'demon-info':  { name: '데몬 정보',   icon: '👿' },
}

export function renderNightOrderList(data, onStepClick = null) {
  const { nightOrder = [], currentStep = null, doneSteps = [] } = data
  const done = new Set(doneSteps)

  const el = document.createElement('div')
  el.className = 'night-order'

  if (nightOrder.length === 0) {
    el.innerHTML = '<div class="night-order__empty">밤 순서 없음</div>'
    return el
  }

  nightOrder.forEach((stepId, idx) => {
    const special = SPECIAL_STEPS[stepId]
    const role = ROLES_BY_ID[stepId]
    const name = special ? special.name : (role ? role.name : stepId)
    const icon = special ? special.icon : (role ? role.icon : '?')

    const isCurrent = stepId === currentStep
    const isDone = done.has(stepId)

    const item = document.createElement('div')
    item.className = 'night-order__item' +
      (isCurrent ? ' night-order__item--current' : '') +
      (isDone ? ' night-order__item--done' : '')

    const numSpan = document.createElement('span')
    numSpan.className = 'night-order__num'
    numSpan.textContent = idx + 1

    const iconSpan = document.createElement('span')
    iconSpan.className = 'night-order__icon'
    // PNG 이미지면 img 태그로, 아니면 emoji로 표시
    if (icon && icon.endsWith('.png')) {
      const img = document.createElement('img')
      img.src = `./asset/icons/${icon}`
      img.alt = name
      img.className = 'night-order__icon-img'
      iconSpan.appendChild(img)
    } else {
      iconSpan.textContent = icon
    }

    const nameSpan = document.createElement('span')
    nameSpan.className = 'night-order__name'
    nameSpan.textContent = name

    item.appendChild(numSpan)
    item.appendChild(iconSpan)
    item.appendChild(nameSpan)

    if (isDone) {
      const check = document.createElement('span')
      check.className = 'night-order__check'
      check.textContent = '✓'
      item.appendChild(check)
    }

    if (isCurrent) {
      const dot = document.createElement('span')
      dot.className = 'night-order__cur-dot'
      item.appendChild(dot)
    }

    if (onStepClick) {
      item.style.cursor = 'pointer'
      item.addEventListener('click', () => onStepClick(stepId))
    }

    el.appendChild(item)
  })

  return el
}

if (!document.getElementById('night-order-style')) {
  const style = document.createElement('style')
  style.id = 'night-order-style'
  style.textContent = `
.night-order { display: flex; flex-direction: column; gap: 2px; }
.night-order__empty { font-size: 0.72rem; color: var(--text4); padding: 8px; text-align: center; }
.night-order__item {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 10px;
  border-radius: 6px;
  background: var(--surface);
  border: 1px solid transparent;
  transition: all 0.2s;
}
.night-order__item--current {
  background: rgba(212,168,40,0.1);
  border-color: rgba(212,168,40,0.35);
}
.night-order__item--done {
  opacity: 0.4;
}
.night-order__num {
  font-size: 0.58rem;
  color: var(--text4);
  min-width: 14px;
  text-align: center;
}
.night-order__icon {
  font-size: 0.9rem;
  width: 20px;
  height: 20px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}
.night-order__icon-img {
  width: 100%;
  height: 100%;
  object-fit: contain;
}
.night-order__name {
  flex: 1;
  font-size: 0.75rem;
  color: var(--text2);
}
.night-order__item--current .night-order__name { color: var(--gold2); font-weight: 600; }
.night-order__check { font-size: 0.72rem; color: var(--tl-base); }
.night-order__cur-dot {
  width: 6px; height: 6px;
  border-radius: 50%;
  background: var(--gold);
  box-shadow: 0 0 5px var(--gold);
  animation: dot-pulse 1.2s infinite;
  flex-shrink: 0;
}
@keyframes dot-pulse {
  0%,100% { opacity: 1; } 50% { opacity: 0.3; }
}
  `
  document.head.appendChild(style)
}
