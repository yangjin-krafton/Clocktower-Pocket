/**
 * C-07 VoteBar — 투표 집계 바
 * @param {Object} data  { targetName, votes, threshold, isLeading }
 * @returns {HTMLElement}
 */
export function renderVoteBar(data) {
  const { targetName, votes, threshold, isLeading = false } = data
  const pct = threshold > 0 ? Math.min(100, (votes / threshold) * 100) : 0
  const reached = votes >= threshold

  const el = document.createElement('div')
  el.className = 'vote-bar' + (isLeading ? ' vote-bar--leading' : '')

  el.innerHTML = `
    <div class="vote-bar__header">
      <span class="vote-bar__name">${targetName}</span>
      <span class="vote-bar__count ${reached ? 'vote-bar__count--reached' : ''}">${votes} / ${threshold}</span>
      ${isLeading ? '<span class="vote-bar__lead-badge">최다 득표</span>' : ''}
    </div>
    <div class="vote-bar__track">
      <div class="vote-bar__fill ${reached ? 'vote-bar__fill--reached' : ''}" style="width:${pct}%"></div>
      <div class="vote-bar__threshold-line" style="left:100%"></div>
    </div>
    <div class="vote-bar__label">${reached ? '✅ 처형 가능' : `${threshold - votes}표 더 필요`}</div>
  `

  return el
}

if (!document.getElementById('vote-bar-style')) {
  const style = document.createElement('style')
  style.id = 'vote-bar-style'
  style.textContent = `
.vote-bar {
  background: var(--surface);
  border: 1px solid var(--lead2);
  border-radius: 10px;
  padding: 10px 12px;
  margin-bottom: 8px;
}
.vote-bar--leading { border-color: rgba(212,168,40,0.4); }
.vote-bar__header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 6px;
}
.vote-bar__name {
  flex: 1;
  font-family: 'Noto Serif KR', serif;
  font-size: 0.88rem;
  font-weight: 700;
  color: var(--text);
}
.vote-bar__count { font-size: 0.82rem; color: var(--text3); font-weight: 600; }
.vote-bar__count--reached { color: var(--tl-light); }
.vote-bar__lead-badge {
  font-size: 0.58rem;
  padding: 2px 6px;
  border-radius: 8px;
  background: rgba(212,168,40,0.15);
  color: var(--gold2);
  border: 1px solid rgba(212,168,40,0.3);
}
.vote-bar__track {
  height: 8px;
  background: var(--lead2);
  border-radius: 4px;
  overflow: hidden;
  position: relative;
}
.vote-bar__fill {
  height: 100%;
  background: var(--pu-base);
  border-radius: 4px;
  transition: width 0.3s ease;
}
.vote-bar__fill--reached { background: var(--tl-base); }
.vote-bar__threshold-line {
  position: absolute;
  top: 0; bottom: 0;
  width: 2px;
  background: var(--gold);
  transform: translateX(-50%);
}
.vote-bar__label {
  margin-top: 4px;
  font-size: 0.62rem;
  color: var(--text4);
}
  `
  document.head.appendChild(style)
}
