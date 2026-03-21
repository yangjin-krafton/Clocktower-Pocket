/**
 * H-06 DayFlow — 낮 진행 (심플 버전)
 * 처형 대상 선택 + 처단자 특수 능력 여부 확인
 * 플레이어 선택 UI: OvalSelectPanel 과 동일한 gl-seat-oval / gl-seat-slot 재사용
 */
import { renderPhaseHeader }  from '../components/PhaseHeader.js'
import { calcSlotMetrics }    from '../utils/ovalLayout.js'
import { ovalSlotPos }        from '../utils/ovalLayout.js'
import {
  createSeatOval,
  createSeatSlot,
  createRoleIconEl,
  createRoleNameLabel,
  createSeatNumLabel,
  buildOvalSlots,
} from '../utils/SeatWheel.js'

export class DayFlow {
  constructor({ engine, onStartNight, onGameOver, onHistoryPush }) {
    this.engine           = engine
    this.onStartNight     = onStartNight
    this.onGameOver       = onGameOver
    this.onHistoryPush    = onHistoryPush || (() => {})
    this.el               = null
    this.executionTargetId = null
    this.slayerTargetId   = null
  }

  mount(container) {
    this.el = document.createElement('div')
    this.el.className = 'dayflow-screen'
    this._render()
    container.appendChild(this.el)
  }

  unmount() { this.el?.remove() }

  refresh() { this._render() }

  // ── 인라인 오발 선택기 빌더 ────────────────────────────────
  /**
   * gl-seat-oval 기반 인라인 선택 UI 생성
   *
   * @param {Object[]}  players      - 표시할 플레이어 배열
   * @param {number[]}  selectedIds  - 현재 선택된 id 목록
   * @param {Function}  onSelect     - (id|null) => void — 선택 변경 시 호출
   * @param {number}    [maxSelect=1]
   * @returns {HTMLElement}  oval 컨테이너
   */
  _buildOval(players, selectedIds, onSelect, maxSelect = 1) {
    const oval = createSeatOval(
      'width:100%;max-width:280px;aspect-ratio:2/3;margin:0 auto;display:block;'
    )

    const appContent = document.getElementById('app-content')
    const containerW = appContent
      ? Math.min(appContent.getBoundingClientRect().width - 32, 280)
      : 260
    const { slotPx } = calcSlotMetrics(players.length, containerW, 36)
    const iconPx = Math.round(slotPx * 0.6)

    let current = [...selectedIds]

    const rebuild = () => {
      // 슬롯만 제거 (센터 레이블 등은 없으므로 전부 초기화)
      oval.innerHTML = ''

      buildOvalSlots(oval, players, slotPx, iconPx, {
        engine: this.engine,
        selectedIds: current,
        onSlotClick: (p) => {
          if (p.status !== 'alive') return
          const isSelected = current.includes(p.id)
          if (isSelected) {
            current = current.filter(id => id !== p.id)
          } else {
            if (maxSelect === 1) current = [p.id]
            else if (current.length < maxSelect) current.push(p.id)
          }
          onSelect(current[0] ?? null)
          rebuild()
        },
      })

      // 자리 번호 레이블
      players.forEach((p, i) => {
        const { x, y } = ovalSlotPos(i, players.length)
        oval.appendChild(
          createSeatNumLabel(x, y, slotPx, p.id, { dimmed: p.status !== 'alive' })
        )
      })
    }

    rebuild()
    return oval
  }

  // ── 메인 렌더 ─────────────────────────────────────────────
  _render() {
    this.el.innerHTML = ''
    const state = this.engine.state

    this.el.appendChild(renderPhaseHeader(state))

    // ─ 처형 결과 ─
    const execCard = document.createElement('div')
    execCard.className = 'card'
    execCard.innerHTML = '<div class="card-title">⚔️ 처형 결과</div>'

    const execLabel = document.createElement('div')
    execLabel.className = 'section-label'
    execLabel.textContent = '처형된 플레이어 선택 (없으면 선택 안 함)'
    execCard.appendChild(execLabel)

    execCard.appendChild(
      this._buildOval(
        state.players,
        this.executionTargetId ? [this.executionTargetId] : [],
        (id) => { this.executionTargetId = id; this._render() }
      )
    )

    if (this.executionTargetId) {
      const target = this.engine.getPlayer(this.executionTargetId)
      const execBtn = document.createElement('button')
      execBtn.className = 'btn btn-danger btn-full mt-12'
      execBtn.textContent = `⚔️ ${target?.name || this.executionTargetId}번 처형 확정 → 밤으로`
      execBtn.addEventListener('click', () => this._execute(this.executionTargetId))
      execCard.appendChild(execBtn)
    }

    this.el.appendChild(execCard)

    // ─ 처단자 특수 능력 ─
    const slayerPlayer = state.players.find(p => p.role === 'slayer' && p.status === 'alive')
    if (slayerPlayer && !this.engine.slayerUsed) {
      const slayCard = document.createElement('div')
      slayCard.className = 'card'
      slayCard.innerHTML = `<div class="card-title">🗡 처단자 선언</div>`

      const slayLabel = document.createElement('div')
      slayLabel.className = 'section-label'
      slayLabel.textContent = `${slayerPlayer.name} — 지목 대상 선택`
      slayCard.appendChild(slayLabel)

      const slayTargets = state.players.filter(p => p.id !== slayerPlayer.id)
      slayCard.appendChild(
        this._buildOval(
          slayTargets,
          this.slayerTargetId ? [this.slayerTargetId] : [],
          (id) => { this.slayerTargetId = id; this._render() }
        )
      )

      if (this.slayerTargetId) {
        const slayBtn = document.createElement('button')
        slayBtn.className = 'btn btn-danger btn-full mt-8'
        slayBtn.textContent = '🗡 처단자 지목 실행'
        slayBtn.addEventListener('click', () => {
          const result = this.engine.slayerDeclare(slayerPlayer.id, this.slayerTargetId)
          this.onHistoryPush({
            type: 'slayer', phase: 'day', round: state.round,
            actor: slayerPlayer.id, target: [this.slayerTargetId],
            label: `🗡 처단자 지목: ${this.slayerTargetId}번`,
            snapshot: this.engine.serialize(),
          })
          if (result.gameOver) {
            this.onGameOver && this.onGameOver(result.winner, result.reason)
            return
          }
          this.slayerTargetId = null
          this._render()
        })
        slayCard.appendChild(slayBtn)
      }

      this.el.appendChild(slayCard)
    }

    // ─ 처형 없이 밤으로 ─
    const endDayBtn = document.createElement('button')
    endDayBtn.className = 'btn btn-full mt-12'
    endDayBtn.textContent = '🌙 처형 없이 밤으로 전환'
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

  _execute(playerId) {
    const result = this.engine.execute(playerId)

    this.onHistoryPush({
      type: 'execution', phase: 'day', round: this.engine.state.round,
      target: [playerId],
      label: `⚔️ ${playerId}번 처형`,
      detail: `${playerId}번 처형 확정`,
      snapshot: this.engine.serialize(),
    })

    if (result.gameOver) {
      this.onGameOver && this.onGameOver(result.winner, result.reason)
      return
    }
    this.onStartNight && this.onStartNight()
  }
}

if (!document.getElementById('dayflow-style')) {
  const style = document.createElement('style')
  style.id = 'dayflow-style'
  style.textContent = `
.dayflow-screen { display: flex; flex-direction: column; gap: 10px; }
  `
  document.head.appendChild(style)
}
