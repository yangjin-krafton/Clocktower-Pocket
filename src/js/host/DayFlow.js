/**
 * H-06 DayFlow — 낮 진행
 * 지목 등록 + 투표 집계 + 처형 처리
 */
import { renderPhaseHeader } from '../components/PhaseHeader.js'
import { renderPlayerGrid } from '../components/PlayerGrid.js'
import { renderVoteBar } from '../components/VoteBar.js'
import { ROLES_BY_ID } from '../data/roles-tb.js'

export class DayFlow {
  constructor({ engine, onStartNight, onGameOver, onHistoryPush }) {
    this.engine = engine
    this.onStartNight   = onStartNight
    this.onGameOver     = onGameOver
    this.onHistoryPush  = onHistoryPush || (() => {})
    this.el = null
    this.nominatorId  = null
    this.targetId     = null
    this.slayerActorId = null
  }

  mount(container) {
    this.el = document.createElement('div')
    this.el.className = 'dayflow-screen'
    this._render()
    container.appendChild(this.el)
  }

  unmount() { this.el?.remove() }

  refresh() { this._render() }

  _render() {
    this.el.innerHTML = ''
    const state = this.engine.state
    const roleMap = {}
    state.players.forEach(p => {
      const role = ROLES_BY_ID[p.role]
      roleMap[p.id] = { icon: role ? role.icon : '?', name: role ? role.name : p.role }
    })

    this.el.appendChild(renderPhaseHeader(state))

    // ─ 지목 섹션 ─
    const nomCard = document.createElement('div')
    nomCard.className = 'card'
    nomCard.innerHTML = '<div class="card-title">🎯 지목</div>'

    // 지목자 선택
    const nomStep = document.createElement('div')
    nomStep.className = 'dayflow__step'
    nomStep.innerHTML = `<div class="section-label">① 지목자 선택</div>`
    const nomGrid = document.createElement('div')
    nomGrid.appendChild(renderPlayerGrid(
      state.players.filter(p => p.status === 'alive'),
      {
        selectable: true,
        maxSelect: 1,
        selectedIds: this.nominatorId ? [this.nominatorId] : [],
        roleMap,
        onSelect: (ids) => { this.nominatorId = ids[0] || null; this._render() }
      }
    ))
    nomStep.appendChild(nomGrid)
    nomCard.appendChild(nomStep)

    // 대상 선택
    const targetStep = document.createElement('div')
    targetStep.className = 'dayflow__step'
    targetStep.innerHTML = `<div class="section-label">② 처형 대상 선택</div>`
    const targetGrid = renderPlayerGrid(
      state.players.filter(p => p.status === 'alive'),
      {
        selectable: true,
        maxSelect: 1,
        selectedIds: this.targetId ? [this.targetId] : [],
        roleMap,
        onSelect: (ids) => { this.targetId = ids[0] || null; this._render() }
      }
    )
    targetStep.appendChild(targetGrid)
    nomCard.appendChild(targetStep)

    // 지목 등록 버튼
    const nomBtn = document.createElement('button')
    nomBtn.className = 'btn btn-primary btn-full mt-12'
    nomBtn.textContent = '📌 지목 등록'
    nomBtn.disabled = !this.nominatorId || !this.targetId
    if (nomBtn.disabled) nomBtn.style.opacity = '0.5'
    nomBtn.addEventListener('click', () => this._registerNomination())
    nomCard.appendChild(nomBtn)
    this.el.appendChild(nomCard)

    // ─ 현재 지목 목록 + VoteBar ─
    if (state.nominations.length > 0) {
      const threshold = this.engine.getExecutionThreshold()

      state.nominations.forEach((nom, idx) => {
        const nominator = this.engine.getPlayer(nom.nominatorId)
        const target    = this.engine.getPlayer(nom.targetId)
        if (!target) return

        const voteCard = document.createElement('div')
        voteCard.className = 'card'
        voteCard.innerHTML = `<div class="card-title">📊 ${nominator?.name || '?'} → ${target.name}</div>`
        voteCard.appendChild(renderVoteBar({
          targetName: target.name,
          votes: nom.votes,
          threshold,
          isLeading: nom.votes === Math.max(...state.nominations.map(n => n.votes)) && nom.votes > 0,
        }))

        // 투표 수 조정
        const voteRow = document.createElement('div')
        voteRow.className = 'dayflow__vote-row'
        voteRow.innerHTML = `
          <button class="btn dayflow__vote-btn" data-delta="-1">－</button>
          <span class="dayflow__vote-num">${nom.votes}표</span>
          <button class="btn dayflow__vote-btn" data-delta="+1">＋</button>
        `
        voteRow.querySelectorAll('.dayflow__vote-btn').forEach(btn => {
          btn.addEventListener('click', () => {
            const delta = parseInt(btn.dataset.delta)
            const newVotes = Math.max(0, nom.votes + delta)
            this.engine.updateVotes(idx, newVotes)
            this._render()
          })
        })
        voteCard.appendChild(voteRow)

        // 처형 버튼 (문턱값 이상)
        if (nom.votes >= threshold) {
          const execBtn = document.createElement('button')
          execBtn.className = 'btn btn-danger btn-full mt-8'
          execBtn.textContent = `⚔️ ${target.name} 처형 확정`
          execBtn.addEventListener('click', () => this._execute(target.id))
          voteCard.appendChild(execBtn)
        }

        this.el.appendChild(voteCard)
      })
    }

    // ─ 특수 능력 ─
    const specialCard = document.createElement('div')
    specialCard.className = 'card'
    specialCard.innerHTML = '<div class="card-title">⚡ 특수 능력</div>'

    // Slayer
    const slayerPlayer = state.players.find(p => p.role === 'slayer' && p.status === 'alive')
    if (slayerPlayer && !this.engine.slayerUsed) {
      const slayRow = document.createElement('div')
      slayRow.className = 'dayflow__special-row'
      slayRow.innerHTML = `<span class="dayflow__special-label">🗡 처단자 선언 (${slayerPlayer.name})</span>`
      const slayGrid = renderPlayerGrid(
        state.players.filter(p => p.status === 'alive' && p.id !== slayerPlayer.id),
        {
          selectable: true,
          maxSelect: 1,
          roleMap,
          onSelect: (ids) => { this.slayerActorId = ids[0] || null }
        }
      )
      slayRow.appendChild(slayGrid)

      const slayBtn = document.createElement('button')
      slayBtn.className = 'btn btn-danger btn-full mt-8'
      slayBtn.textContent = '🗡 처단자 지목 실행'
      slayBtn.addEventListener('click', () => {
        if (this.slayerActorId) {
          const result = this.engine.slayerDeclare(slayerPlayer.id, this.slayerActorId)
          if (result.gameOver) {
            this.onGameOver && this.onGameOver(result.winner, result.reason)
          }
          this._render()
        }
      })
      slayRow.appendChild(slayBtn)
      specialCard.appendChild(slayRow)
    }

    this.el.appendChild(specialCard)

    // ─ 처형 없이 낮 종료 (Mayor 3인 체크) ─
    const endDayBtn = document.createElement('button')
    endDayBtn.className = 'btn btn-full mt-12'
    endDayBtn.textContent = '🌙 밤으로 전환 (처형 없이)'
    endDayBtn.addEventListener('click', () => {
      const winCheck = this.engine.checkWinCondition()
      if (winCheck.gameOver) {
        this.onGameOver && this.onGameOver(winCheck.winner, winCheck.reason)
        return
      }
      this.onStartNight && this.onStartNight()
    })
    this.el.appendChild(endDayBtn)
  }

  _registerNomination() {
    if (!this.nominatorId || !this.targetId) return
    const nomId = this.nominatorId
    const tgtId = this.targetId
    const result = this.engine.nominate(nomId, tgtId)

    this.onHistoryPush({
      type: 'nomination', phase: 'day', round: this.engine.state.round,
      actor: nomId, target: [tgtId],
      label: `${nomId}번 → ${tgtId}번 지명`,
      detail: result.virginTriggered
        ? `${nomId}번이 ${tgtId}번을 지명 (처녀 능력 발동!)`
        : `${nomId}번이 ${tgtId}번을 지명`,
    })

    if (result.virginTriggered) {
      this._showAlert('처녀 능력 발동!', '지목자가 마을 주민이어서 즉시 처형됩니다.')
    }
    this.nominatorId = null
    this.targetId    = null
    this._render()
  }

  _execute(playerId) {
    const result = this.engine.execute(playerId)

    this.onHistoryPush({
      type: 'execution', phase: 'day', round: this.engine.state.round,
      target: [playerId],
      label: `⚔️ ${playerId}번 처형`,
      detail: `${playerId}번 처형 확정`,
    })

    if (result.gameOver) {
      this.onGameOver && this.onGameOver(result.winner, result.reason)
      return
    }
    this.onStartNight && this.onStartNight()
  }

  _showAlert(title, message) {
    const overlay = document.createElement('div')
    overlay.className = 'popup-overlay'
    overlay.innerHTML = `
      <div class="popup-box" style="text-align:center">
        <div style="font-size:2rem;margin-bottom:12px">⚡</div>
        <div style="font-family:'Noto Serif KR',serif;font-size:1.1rem;font-weight:700;color:var(--gold2);margin-bottom:8px">${title}</div>
        <div style="font-size:0.82rem;color:var(--text2);margin-bottom:16px">${message}</div>
        <button class="btn btn-primary btn-full">확인</button>
      </div>
    `
    overlay.querySelector('button').addEventListener('click', () => overlay.remove())
    document.body.appendChild(overlay)
  }
}

if (!document.getElementById('dayflow-style')) {
  const style = document.createElement('style')
  style.id = 'dayflow-style'
  style.textContent = `
.dayflow-screen { display: flex; flex-direction: column; gap: 10px; }
.dayflow__step { margin-bottom: 10px; }
.dayflow__vote-row {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 16px;
  margin-top: 8px;
}
.dayflow__vote-btn { min-width: 44px; font-size: 1.2rem; }
.dayflow__vote-num {
  font-family: 'Noto Serif KR', serif;
  font-size: 1.1rem;
  font-weight: 700;
  color: var(--text);
  min-width: 50px;
  text-align: center;
}
.dayflow__special-row { margin-bottom: 4px; }
.dayflow__special-label { font-size: 0.78rem; color: var(--text2); display: block; margin-bottom: 6px; }
  `
  document.head.appendChild(style)
}
