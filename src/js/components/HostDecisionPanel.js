/**
 * C-09 HostDecisionPanel — 밤 행동 정보 선택 화면 (호스트 전용)
 *
 * 참가자를 깨우기 전에 호스트가 어떤 정보를 줄지 결정하는 화면.
 * - 게임 상태 3지표 (밸런스/정보량/위험도) 표시
 * - 4가지 선택지 (선팀 도움 / 중립 / 악팀 도움 / 직접 선택)
 * - 추천 선택지 gold border 강조
 * - 악팀 도움 ⚠️ 경고 표시
 *
 * @param {Object} data
 *   roleId       {string}    역할 ID
 *   actorSeatId  {number}    행동 참가자 자리번호
 *   analysis     {Object}    NightAdvisor 분석 결과
 *   options      {Object[]}  4가지 선택지
 *   onDecide     {Function}  onDecide(chosenOption) 콜백
 */

export function mountHostDecisionPanel(data) {
  const { roleId, actorSeatId, analysis, options, onDecide } = data

  const overlay = document.createElement('div')
  overlay.className = 'hdp-overlay'

  const panel = document.createElement('div')
  panel.className = 'hdp-panel'

  // ── 호스트 전용 라벨 ──
  const lockLabel = document.createElement('div')
  lockLabel.className = 'hdp__lock-label'
  lockLabel.textContent = '🔒 호스트 전용'
  panel.appendChild(lockLabel)

  // ── 역할 + 대상 헤더 ──
  const roleHeader = document.createElement('div')
  roleHeader.className = 'hdp__role-header'
  // roleId → 역할명 표시는 NightAction에서 이미 처리
  roleHeader.innerHTML = `<span class="hdp__actor-seat">${actorSeatId}번 자리</span> 행동`
  panel.appendChild(roleHeader)

  // ── 게임 상태 카드 ──
  const stateCard = document.createElement('div')
  stateCard.className = 'hdp__state-card'
  stateCard.innerHTML = `
    <div class="hdp__state-title">📊 현재 게임 상태</div>
    <div class="hdp__state-row">
      <span class="hdp__state-key">밸런스</span>
      <span class="hdp__state-val">선팀 ${analysis.goodCount}명 vs 악팀 ${analysis.evilCount}명</span>
      <span class="hdp__state-tag hdp__state-tag--${analysis.balanceTag === '선팀 우세' ? 'good' : analysis.balanceTag === '악팀 우세' ? 'evil' : 'neutral'}">${analysis.balanceTag}</span>
    </div>
    <div class="hdp__state-row">
      <span class="hdp__state-key">정보량</span>
      <span class="hdp__state-val">이 역할 ${analysis.infoCount}회 수령</span>
    </div>
    <div class="hdp__state-row">
      <span class="hdp__state-key">위험도</span>
      <span class="hdp__state-val">${analysis.riskLabel}</span>
    </div>
  `
  panel.appendChild(stateCard)

  // ── 선택지 목록 ──
  const question = document.createElement('div')
  question.className = 'hdp__question'
  question.textContent = '어떤 정보를 제공하시겠습니까?'
  panel.appendChild(question)

  let selectedOption = null
  const optionEls = []

  options.forEach(opt => {
    const card = document.createElement('div')
    card.className = 'hdp__option'
      + (opt.recommended ? ' hdp__option--recommended' : '')
      + (opt.id === 'evil' ? ' hdp__option--evil' : '')

    const topRow = document.createElement('div')
    topRow.className = 'hdp__option-top'
    topRow.innerHTML = `
      ${opt.recommended ? '<span class="hdp__rec-badge">★ 추천</span>' : ''}
      <span class="hdp__option-icon">${opt.icon}</span>
      <span class="hdp__option-label">${opt.label}</span>
      ${opt.id === 'evil' ? '<span class="hdp__warn">⚠️</span>' : ''}
    `

    const previewRow = document.createElement('div')
    previewRow.className = 'hdp__option-preview'
    previewRow.textContent = `"${opt.preview}"`

    const impactRow = document.createElement('div')
    impactRow.className = 'hdp__option-impact'
    impactRow.textContent = opt.impact

    if (opt.stateReason) {
      const reasonRow = document.createElement('div')
      reasonRow.className = 'hdp__option-reason'
      reasonRow.textContent = opt.stateReason
      card.appendChild(topRow)
      card.appendChild(previewRow)
      card.appendChild(impactRow)
      card.appendChild(reasonRow)
    } else {
      card.appendChild(topRow)
      card.appendChild(previewRow)
      card.appendChild(impactRow)
    }

    // 직접선택: 번호 입력 UI
    if (opt.id === 'custom' && opt.customType === 'number') {
      const customRow = document.createElement('div')
      customRow.className = 'hdp__custom-row'
      ;[0,1,2,3,4,5].forEach(n => {
        const btn = document.createElement('button')
        btn.className = 'hdp__custom-num-btn'
        btn.textContent = n
        btn.addEventListener('click', (e) => {
          e.stopPropagation()
          // 선택된 버튼 강조
          customRow.querySelectorAll('.hdp__custom-num-btn').forEach(b => b.classList.remove('hdp__custom-num-btn--on'))
          btn.classList.add('hdp__custom-num-btn--on')
          // 이 옵션 선택 + preview 업데이트
          opt.customValue = n
          opt.revealData  = { ...opt.revealData, message: String(n) }
          _selectOption(card, opt)
        })
        customRow.appendChild(btn)
      })
      card.appendChild(customRow)
    }

    card.addEventListener('click', () => {
      if (opt.id !== 'custom') _selectOption(card, opt)
    })

    panel.appendChild(card)
    optionEls.push(card)
  })

  // ── 결정 버튼 ──
  const decideBtn = document.createElement('button')
  decideBtn.className = 'hdp__decide-btn btn btn-gold'
  decideBtn.textContent = '▶ 결정 → 참가자 깨우기'
  decideBtn.disabled = true
  decideBtn.addEventListener('click', () => {
    if (!selectedOption) return
    overlay.remove()
    onDecide && onDecide(selectedOption)
  })
  panel.appendChild(decideBtn)

  function _selectOption(cardEl, opt) {
    optionEls.forEach(c => c.classList.remove('hdp__option--active'))
    cardEl.classList.add('hdp__option--active')
    selectedOption = opt
    decideBtn.disabled = false
  }

  overlay.appendChild(panel)
  document.body.appendChild(overlay)

  return () => overlay.remove()
}

if (!document.getElementById('host-decision-panel-style')) {
  const style = document.createElement('style')
  style.id = 'host-decision-panel-style'
  style.textContent = `
.hdp-overlay {
  position: fixed;
  inset: 0;
  background: var(--bg);
  z-index: 215;
  display: flex;
  align-items: stretch;
  overflow-y: auto;
}
.hdp-panel {
  width: 100%;
  max-width: var(--app-max-width);
  margin: 0 auto;
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 16px 16px 24px;
}
.hdp__lock-label {
  font-size: 0.62rem;
  color: var(--text4);
  text-align: center;
  letter-spacing: 0.06em;
  padding: 4px 0;
}
.hdp__role-header {
  text-align: center;
  font-family: 'Noto Serif KR', serif;
  font-size: 1rem;
  font-weight: 700;
  color: var(--text);
}
.hdp__actor-seat { color: var(--gold2); }

/* 게임 상태 카드 */
.hdp__state-card {
  background: var(--surface);
  border: 1px solid var(--lead2);
  border-radius: var(--radius-md);
  padding: 10px 12px;
  display: flex;
  flex-direction: column;
  gap: 5px;
}
.hdp__state-title { font-size: 0.72rem; font-weight: 700; color: var(--text3); margin-bottom: 4px; }
.hdp__state-row   { display: flex; align-items: center; gap: 8px; font-size: 0.72rem; }
.hdp__state-key   { color: var(--text4); min-width: 42px; }
.hdp__state-val   { color: var(--text2); flex: 1; }
.hdp__state-tag   { font-size: 0.6rem; font-weight: 600; padding: 1px 6px; border-radius: 8px; }
.hdp__state-tag--good    { background: rgba(58,90,174,0.2); color: var(--bl-light); }
.hdp__state-tag--evil    { background: rgba(140,48,48,0.2); color: var(--rd-light); }
.hdp__state-tag--neutral { background: rgba(92,83,137,0.2); color: var(--pu-light); }

.hdp__question {
  font-size: 0.78rem;
  color: var(--text3);
  text-align: center;
  padding: 2px 0;
}

/* 선택지 카드 */
.hdp__option {
  background: var(--surface);
  border: 2px solid var(--lead2);
  border-radius: var(--radius-md);
  padding: 10px 12px;
  cursor: pointer;
  transition: border-color 0.15s, background 0.15s;
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.hdp__option:active { transform: scale(0.98); }
.hdp__option--recommended { border-color: rgba(212,168,40,0.45); }
.hdp__option--evil        { border-color: rgba(140,48,48,0.4); }
.hdp__option--active {
  border-color: var(--gold) !important;
  background: rgba(212,168,40,0.08) !important;
  box-shadow: 0 0 0 1px rgba(212,168,40,0.25);
}

.hdp__option-top { display: flex; align-items: center; gap: 6px; }
.hdp__rec-badge  { font-size: 0.58rem; color: var(--gold2); font-weight: 700; }
.hdp__option-icon  { font-size: 1rem; }
.hdp__option-label { font-size: 0.82rem; font-weight: 700; color: var(--text); flex: 1; }
.hdp__warn         { font-size: 0.8rem; }

.hdp__option-preview {
  font-size: 0.78rem;
  color: var(--tl-light);
  font-style: italic;
  padding-left: 2px;
}
.hdp__option-impact {
  font-size: 0.68rem;
  color: var(--text4);
  line-height: 1.4;
}
.hdp__option-reason {
  font-size: 0.62rem;
  color: var(--gold);
  margin-top: 2px;
}

/* 직접선택 숫자 버튼 */
.hdp__custom-row {
  display: flex;
  gap: 6px;
  margin-top: 6px;
  flex-wrap: wrap;
}
.hdp__custom-num-btn {
  width: 36px;
  height: 36px;
  border-radius: 8px;
  border: 1px solid var(--lead2);
  background: var(--surface2);
  color: var(--text2);
  font-size: 0.9rem;
  font-weight: 700;
  cursor: pointer;
  transition: all 0.12s;
}
.hdp__custom-num-btn--on {
  border-color: var(--gold);
  background: rgba(212,168,40,0.15);
  color: var(--gold2);
}

/* 결정 버튼 */
.hdp__decide-btn {
  margin-top: 4px;
  width: 100%;
  padding: 14px;
  font-size: 0.9rem;
  font-weight: 700;
  border-radius: 10px;
  min-height: 52px;
}
.hdp__decide-btn:disabled { opacity: 0.4; cursor: default; }
  `
  document.head.appendChild(style)
}
