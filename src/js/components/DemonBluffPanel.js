/**
 * DemonBluffPanel — 임프 블러프 세트 결정 화면 (호스트 전용)
 *
 * DemonBluffAdvisor가 제안한 3가지 전략 + 직접 선택을 표시.
 * 호스트가 선택 → onDecide(roles) 또는 onDecide(null) for 직접선택
 *
 * @param {Object} data
 *   analysis  {Object}    DemonBluffAdvisor.advise() 분석 결과
 *   options   {Object[]}  4가지 선택지 (도전적/기본/초보자/직접)
 *   onDecide  {Function}  onDecide(roles|null)
 *                           roles: 선택된 role 배열 (3개)
 *                           null:  직접 선택 모드
 */
export function mountDemonBluffPanel({ analysis, options, onDecide }) {
  const overlay = document.createElement('div')
  overlay.className = 'dbp-overlay'

  const panel = document.createElement('div')
  panel.className = 'dbp-panel'

  // ── 호스트 전용 라벨 ──
  const lockLabel = document.createElement('div')
  lockLabel.className = 'dbp__lock-label'
  lockLabel.textContent = '🔒 호스트 전용'
  panel.appendChild(lockLabel)

  // ── 헤더 ──
  const hdr = document.createElement('div')
  hdr.className = 'dbp__hdr'
  hdr.innerHTML = `
    <span class="dbp__hdr-icon">👿</span>
    <div>
      <div class="dbp__hdr-title">임프 블러프 전략</div>
      <div class="dbp__hdr-sub">임프에게 전달할 블러프 세트를 선택하세요</div>
    </div>
  `
  panel.appendChild(hdr)

  // ── 게임 상태 카드 ──
  const stateCard = document.createElement('div')
  stateCard.className = 'dbp__state-card'
  const balanceClass = analysis.balanceTag === '선팀 우세' ? 'good'
                     : analysis.balanceTag === '악팀 우세' ? 'evil' : 'neutral'
  stateCard.innerHTML = `
    <div class="dbp__state-title">📊 현재 게임 상태</div>
    <div class="dbp__state-row">
      <span class="dbp__state-key">밸런스</span>
      <span class="dbp__state-val">선팀 ${analysis.goodCount}명 vs 악팀 ${analysis.evilCount}명</span>
      <span class="dbp__state-tag dbp__state-tag--${balanceClass}">${analysis.balanceTag}</span>
    </div>
    <div class="dbp__state-row">
      <span class="dbp__state-key">위험도</span>
      <span class="dbp__state-val">${analysis.riskLabel}</span>
    </div>
    <div class="dbp__state-row">
      <span class="dbp__state-key">정보역할</span>
      <span class="dbp__state-val">게임 내 정보형 ${analysis.threatCount}개 활성</span>
    </div>
  `
  panel.appendChild(stateCard)

  // ── 질문 ──
  const question = document.createElement('div')
  question.className = 'dbp__question'
  question.textContent = '어떤 블러프 세트를 제공하시겠습니까?'
  panel.appendChild(question)

  // ── 선택지 카드들 ──
  let selectedOption = null
  const cardEls = []

  options.forEach(opt => {
    const card = document.createElement('div')
    card.className = 'dbp__option'
      + (opt.recommended ? ' dbp__option--recommended' : '')
      + (opt.id === 'aggressive' ? ' dbp__option--aggressive' : '')

    // 상단 행: 아이콘 + 라벨 + 추천 뱃지
    const topRow = document.createElement('div')
    topRow.className = 'dbp__option-top'
    topRow.innerHTML = `
      ${opt.recommended ? '<span class="dbp__rec-badge">★ 추천</span>' : ''}
      <span class="dbp__option-icon">${opt.icon}</span>
      <span class="dbp__option-label">${opt.label}</span>
    `
    card.appendChild(topRow)

    // 역할 토큰 미리보기 (직접선택 제외)
    if (opt.id !== 'custom' && opt.roles.length > 0) {
      const tokensRow = document.createElement('div')
      tokensRow.className = 'dbp__tokens-row'
      opt.roles.forEach(role => {
        const wrap = document.createElement('div')
        wrap.className = 'dbp__token-wrap'
        wrap.title = role.name
        wrap.innerHTML = `
          <img class="dbp__token-bg"   src="./asset/token.png" alt="">
          <img class="dbp__token-icon" src="./asset/icons/${role.icon}" alt="${role.name}" loading="lazy">
        `
        const nameEl = document.createElement('div')
        nameEl.className = 'dbp__token-name'
        nameEl.textContent = role.name

        const item = document.createElement('div')
        item.className = 'dbp__token-item'
        item.appendChild(wrap)
        item.appendChild(nameEl)
        tokensRow.appendChild(item)
      })
      card.appendChild(tokensRow)
    }

    // 영향 설명
    const impactRow = document.createElement('div')
    impactRow.className = 'dbp__option-impact'
    impactRow.textContent = opt.impact
    card.appendChild(impactRow)

    // 상황 이유
    if (opt.stateReason) {
      const reasonRow = document.createElement('div')
      reasonRow.className = 'dbp__option-reason'
      reasonRow.textContent = opt.stateReason
      card.appendChild(reasonRow)
    }

    card.addEventListener('click', () => {
      cardEls.forEach(c => c.classList.remove('dbp__option--active'))
      card.classList.add('dbp__option--active')
      selectedOption = opt
      decideBtn.disabled = false
    })

    panel.appendChild(card)
    cardEls.push(card)
  })

  // ── 결정 버튼 ──
  const decideBtn = document.createElement('button')
  decideBtn.className = 'dbp__decide-btn btn btn-gold'
  decideBtn.textContent = '▶ 결정 → 다음 단계'
  decideBtn.disabled = true
  decideBtn.addEventListener('click', () => {
    if (!selectedOption) return
    overlay.remove()
    if (selectedOption.id === 'custom') {
      onDecide && onDecide(null)   // 직접선택 → BluffSelectPanel로 넘김
    } else {
      onDecide && onDecide(selectedOption.roles)
    }
  })
  panel.appendChild(decideBtn)

  overlay.appendChild(panel)
  document.body.appendChild(overlay)

  return () => overlay.remove()
}

// ── 스타일 ────────────────────────────────────────────────────────

if (!document.getElementById('demon-bluff-panel-style')) {
  const style = document.createElement('style')
  style.id = 'demon-bluff-panel-style'
  style.textContent = `
.dbp-overlay {
  position: fixed;
  inset: 0;
  background: var(--bg);
  z-index: 215;
  display: flex;
  align-items: stretch;
  overflow-y: auto;
}
.dbp-panel {
  width: 100%;
  max-width: var(--app-max-width);
  margin: 0 auto;
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 16px 16px 28px;
}

/* 잠금 라벨 */
.dbp__lock-label {
  font-size: 0.62rem;
  color: var(--text4);
  text-align: center;
  letter-spacing: 0.06em;
  padding: 4px 0;
}

/* 헤더 */
.dbp__hdr {
  display: flex;
  align-items: center;
  gap: 12px;
}
.dbp__hdr-icon {
  font-size: 2rem;
  width: 44px;
  height: 44px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}
.dbp__hdr-title {
  font-family: 'Noto Serif KR', serif;
  font-size: 1.1rem;
  font-weight: 700;
  color: var(--rd-light);
}
.dbp__hdr-sub {
  font-size: 0.7rem;
  color: var(--text3);
  margin-top: 2px;
}

/* 게임 상태 카드 (hdp 스타일 재사용) */
.dbp__state-card {
  background: var(--surface);
  border: 1px solid var(--lead2);
  border-radius: var(--radius-md);
  padding: 10px 12px;
  display: flex;
  flex-direction: column;
  gap: 5px;
}
.dbp__state-title { font-size: 0.72rem; font-weight: 700; color: var(--text3); margin-bottom: 4px; }
.dbp__state-row   { display: flex; align-items: center; gap: 8px; font-size: 0.72rem; }
.dbp__state-key   { color: var(--text4); min-width: 48px; }
.dbp__state-val   { color: var(--text2); flex: 1; }
.dbp__state-tag   { font-size: 0.6rem; font-weight: 600; padding: 1px 6px; border-radius: 8px; }
.dbp__state-tag--good    { background: rgba(58,90,174,0.2);  color: var(--bl-light); }
.dbp__state-tag--evil    { background: rgba(140,48,48,0.2);  color: var(--rd-light); }
.dbp__state-tag--neutral { background: rgba(92,83,137,0.2);  color: var(--pu-light); }

/* 질문 */
.dbp__question {
  font-size: 0.78rem;
  color: var(--text3);
  text-align: center;
  padding: 2px 0;
}

/* 선택지 카드 */
.dbp__option {
  background: var(--surface);
  border: 2px solid var(--lead2);
  border-radius: var(--radius-md);
  padding: 10px 12px;
  cursor: pointer;
  transition: border-color 0.15s, background 0.15s;
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.dbp__option:active { transform: scale(0.98); }
.dbp__option--recommended  { border-color: rgba(212,168,40,0.45); }
.dbp__option--aggressive   { border-color: rgba(140,48,48,0.35); }
.dbp__option--active {
  border-color: var(--gold) !important;
  background: rgba(212,168,40,0.08) !important;
  box-shadow: 0 0 0 1px rgba(212,168,40,0.25);
}

.dbp__option-top {
  display: flex;
  align-items: center;
  gap: 6px;
}
.dbp__rec-badge   { font-size: 0.58rem; color: var(--gold2); font-weight: 700; }
.dbp__option-icon  { font-size: 1rem; }
.dbp__option-label { font-size: 0.85rem; font-weight: 700; color: var(--text); flex: 1; }

/* 역할 토큰 미리보기 */
.dbp__tokens-row {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  padding: 4px 0 2px;
}
.dbp__token-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 3px;
}
.dbp__token-wrap {
  position: relative;
  width: 38px;
  height: 38px;
  flex-shrink: 0;
}
.dbp__token-bg,
.dbp__token-icon {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
}
.dbp__token-icon { object-fit: contain; }
.dbp__token-name {
  font-size: 0.6rem;
  color: var(--text3);
  text-align: center;
  max-width: 44px;
  word-break: keep-all;
  line-height: 1.2;
}

.dbp__option-impact {
  font-size: 0.68rem;
  color: var(--text3);
  line-height: 1.4;
}
.dbp__option-reason {
  font-size: 0.62rem;
  color: var(--gold);
  margin-top: 1px;
}

/* 결정 버튼 */
.dbp__decide-btn {
  margin-top: 4px;
  width: 100%;
  padding: 14px;
  font-size: 0.9rem;
  font-weight: 700;
  border-radius: 10px;
  min-height: 52px;
}
.dbp__decide-btn:disabled { opacity: 0.4; cursor: default; }
  `
  document.head.appendChild(style)
}
