/**
 * C-11 LogEntry — 판정 로그 1줄
 * @param {Object} entry  { round, phase, event, timestamp }
 * @returns {HTMLElement}
 */
export function renderLogEntry(entry) {
  const { round, phase, event, timestamp } = entry

  const colorMap = {
    night: 'var(--pu-light)',
    day:   'var(--tl-base)',
    game:  'var(--gold2)',
    event: 'var(--rd-light)',
  }
  const phaseLabel = { night: '밤', day: '낮', game: '게임', event: '이벤트' }

  const el = document.createElement('div')
  el.className = 'log-entry'

  el.innerHTML = `
    <span class="log-entry__phase" style="color:${colorMap[phase] || 'var(--text3)'}">${phaseLabel[phase] || phase}</span>
    <span class="log-entry__round">${round > 0 ? `${round}회` : ''}</span>
    <span class="log-entry__event">${event}</span>
    <span class="log-entry__time">${timestamp || ''}</span>
  `

  return el
}

/**
 * 로그 목록 컨테이너 (스크롤)
 */
export function renderLogList(entries) {
  const el = document.createElement('div')
  el.className = 'log-list'
  entries.forEach(e => el.appendChild(renderLogEntry(e)))
  return el
}

if (!document.getElementById('log-entry-style')) {
  const style = document.createElement('style')
  style.id = 'log-entry-style'
  style.textContent = `
.log-list {
  display: flex;
  flex-direction: column;
  gap: 2px;
  max-height: 180px;
  overflow-y: auto;
  padding: 4px 0;
}
.log-list::-webkit-scrollbar { width: 3px; }
.log-list::-webkit-scrollbar-thumb { background: var(--lead2); }
.log-entry {
  display: flex;
  align-items: baseline;
  gap: 5px;
  padding: 3px 6px;
  border-radius: 4px;
  font-size: 0.68rem;
  line-height: 1.4;
  background: var(--surface2);
}
.log-entry__phase {
  font-size: 0.58rem;
  font-weight: 700;
  flex-shrink: 0;
  text-transform: uppercase;
}
.log-entry__round {
  font-size: 0.56rem;
  color: var(--text4);
  flex-shrink: 0;
  min-width: 18px;
}
.log-entry__event { flex: 1; color: var(--text2); }
.log-entry__time { font-size: 0.55rem; color: var(--text4); flex-shrink: 0; }
  `
  document.head.appendChild(style)
}
