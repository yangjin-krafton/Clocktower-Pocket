/**
 * BluffSelectPanel — 호스트가 임프 블러프 3개를 선택하는 패널
 *
 * @param {Object} data
 *   pool       {Object[]}  선택 가능한 역할 배열 (ROLES_TB 형식)
 *   onConfirm  {Function}  onConfirm(selectedRoles[]) — 3개 선택 후 호출
 */
export function mountBluffSelectPanel({ pool = [], drunkAsRoleId = null, onConfirm }) {
  let selected = []

  const overlay = document.createElement('div')
  overlay.className = 'bluff-sel-overlay'

  const panel = document.createElement('div')
  panel.className = 'bluff-sel-panel'

  // ── 헤더 ──
  const hdr = document.createElement('div')
  hdr.className = 'bluff-sel__hdr'
  hdr.innerHTML = `
    <div class="bluff-sel__hdr-icon">
      <img class="bluff-sel__token-bg"   src="./asset/token.png" alt="">
      <img class="bluff-sel__token-icon-hdr" src="./asset/icons/imp.png" alt="임프">
    </div>
    <div class="bluff-sel__hdr-text">
      <div class="bluff-sel__title">블러프 3개 선택</div>
      <div class="bluff-sel__subtitle">임프에게 전달할 역할을 3개 고르세요</div>
    </div>
  `
  panel.appendChild(hdr)

  // ── 카운터 ──
  const counter = document.createElement('div')
  counter.className = 'bluff-sel__counter'
  function updateCounter() {
    counter.textContent = `${selected.length} / 3 선택됨`
    counter.dataset.full = selected.length === 3 ? '1' : '0'
  }
  updateCounter()
  panel.appendChild(counter)

  // ── 역할 그리드 ──
  const grid = document.createElement('div')
  grid.className = 'bluff-sel__grid'

  function buildGrid() {
    grid.innerHTML = ''
    pool.forEach(role => {
      const isSelected = selected.some(r => r.id === role.id)
      const teamClass  = role.team === 'outsider' ? 'bluff-sel__card--outside' : 'bluff-sel__card--town'

      const card = document.createElement('div')
      card.className = `bluff-sel__card ${teamClass}${isSelected ? ' bluff-sel__card--selected' : ''}`
      const isDrunkAs = drunkAsRoleId && role.id === drunkAsRoleId
      card.innerHTML = `
        <div class="bluff-sel__card-token">
          <img class="bluff-sel__token-bg" src="./asset/token.png" alt="">
          <img class="bluff-sel__token-icon" src="./asset/icons/${role.icon}" alt="${role.name}" loading="lazy">
          ${isSelected ? '<div class="bluff-sel__check">✓</div>' : ''}
        </div>
        <div class="bluff-sel__card-name">${role.name}</div>
        ${isDrunkAs ? '<div class="bluff-sel__drunk-tag">🍾 주정뱅이</div>' : ''}
      `
      card.addEventListener('click', () => {
        if (isSelected) {
          selected = selected.filter(r => r.id !== role.id)
        } else {
          if (selected.length >= 3) return
          selected.push(role)
        }
        buildGrid()
        updateCounter()
        confirmBtn.disabled = selected.length !== 3
      })
      grid.appendChild(card)
    })
  }

  buildGrid()
  panel.appendChild(grid)

  // ── 확인 버튼 ──
  const confirmBtn = document.createElement('button')
  confirmBtn.className = 'bluff-sel__confirm btn btn-primary'
  confirmBtn.textContent = '다음 →'
  confirmBtn.disabled = true
  confirmBtn.addEventListener('click', () => {
    overlay.remove()
    onConfirm && onConfirm([...selected])
  })
  panel.appendChild(confirmBtn)

  overlay.appendChild(panel)
  document.body.appendChild(overlay)

  return () => overlay.remove()
}

// ── 스타일 ────────────────────────────────────────────────────

if (!document.getElementById('bluff-select-panel-style')) {
  const style = document.createElement('style')
  style.id = 'bluff-select-panel-style'
  style.textContent = `
.bluff-sel-overlay {
  position: fixed;
  inset: 0 0 56px 0;
  background: var(--bg);
  z-index: 200;
  display: flex;
  align-items: stretch;
}
.bluff-sel-panel {
  width: 100%;
  max-width: var(--app-max-width);
  margin: 0 auto;
  display: flex;
  flex-direction: column;
  padding: 20px 16px 16px;
  gap: 10px;
  overflow: hidden;
}

/* 헤더 */
.bluff-sel__hdr {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-shrink: 0;
}
.bluff-sel__hdr-icon {
  position: relative;
  width: 48px;
  height: 48px;
  flex-shrink: 0;
}
.bluff-sel__token-bg,
.bluff-sel__token-icon-hdr {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
}
.bluff-sel__token-icon-hdr { object-fit: contain; }
.bluff-sel__title {
  font-family: 'Noto Serif KR', serif;
  font-size: 1.2rem;
  font-weight: 700;
  color: var(--rd-light);
}
.bluff-sel__subtitle {
  font-size: 0.72rem;
  color: var(--text3);
  margin-top: 2px;
}

/* 카운터 */
.bluff-sel__counter {
  text-align: center;
  font-size: 0.78rem;
  font-weight: 600;
  color: var(--text3);
  padding: 6px 0;
  border-radius: 8px;
  background: var(--surface2);
  flex-shrink: 0;
  transition: color 0.2s, background 0.2s;
}
.bluff-sel__counter[data-full="1"] {
  color: var(--gold2);
  background: color-mix(in srgb, var(--gold) 15%, var(--surface2));
}

/* 그리드 */
.bluff-sel__grid {
  flex: 1;
  overflow-y: auto;
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 8px;
  align-content: start;
  padding-bottom: 4px;
}

/* 역할 카드 */
.bluff-sel__card {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 5px;
  padding: 8px 4px;
  border-radius: 10px;
  border: 2px solid var(--lead2);
  background: var(--surface);
  cursor: pointer;
  transition: border-color 0.12s, background 0.12s, transform 0.1s;
  -webkit-tap-highlight-color: transparent;
  user-select: none;
}
.bluff-sel__card:active { transform: scale(0.93); }
.bluff-sel__card--selected {
  border-color: var(--gold) !important;
  background: color-mix(in srgb, var(--gold) 12%, var(--surface)) !important;
  box-shadow: 0 0 10px rgba(212,168,40,0.35);
}

/* 토큰 래퍼 */
.bluff-sel__card-token {
  position: relative;
  width: 44px;
  height: 44px;
  flex-shrink: 0;
}
.bluff-sel__token-bg,
.bluff-sel__token-icon {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
}
.bluff-sel__token-icon { object-fit: contain; }

/* 체크 뱃지 */
.bluff-sel__check {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.3rem;
  color: var(--gold2);
  font-weight: 800;
  background: rgba(0,0,0,0.45);
  border-radius: 50%;
}

/* 역할명 */
.bluff-sel__card-name {
  font-size: 0.68rem;
  font-weight: 600;
  color: var(--text2);
  text-align: center;
  line-height: 1.2;
  word-break: keep-all;
}
.bluff-sel__card--town    .bluff-sel__card-name { color: var(--bl-light); }
.bluff-sel__card--outside .bluff-sel__card-name { color: var(--tl-light); }
.bluff-sel__card--selected .bluff-sel__card-name { color: var(--gold2) !important; }

/* 주정뱅이 표시 태그 */
.bluff-sel__drunk-tag {
  font-size: 0.52rem;
  font-weight: 600;
  color: #a78bfa;
  background: rgba(124,58,237,0.15);
  border: 1px solid rgba(124,58,237,0.3);
  border-radius: 4px;
  padding: 1px 5px;
  margin-top: 1px;
}

/* 확인 버튼 */
.bluff-sel__confirm {
  flex-shrink: 0;
  padding: 14px;
  font-size: 0.9rem;
  font-weight: 700;
  border-radius: 10px;
  min-height: 52px;
}
.bluff-sel__confirm:disabled { opacity: 0.4; cursor: default; }
  `
  document.head.appendChild(style)
}
