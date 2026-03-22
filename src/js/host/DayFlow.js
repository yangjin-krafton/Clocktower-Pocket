/**
 * H-06 DayFlow — 낮 진행 (심플 버전)
 * 처형 대상 선택 + 처단자 특수 능력 + 처녀 지목 능력 처리
 * 플레이어 선택 UI: OvalSelectPanel 과 동일한 gl-seat-oval / gl-seat-slot 재사용
 */
import { renderPhaseHeader }  from '../components/PhaseHeader.js'
import { calcSlotMetrics, ovalSlotPos, drawOvalPieNumbers } from '../utils/ovalLayout.js'
import {
  createSeatOval,
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
    this.virginNominatorId = null  // 처녀를 지목한 사람
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
        drawPie: false,   // containerFill 로 카드 전체에 그림
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

    // 파이 배경 — 카드(부모) 전체를 채우고 카드 경계에서 자동 클리핑
    drawOvalPieNumbers(oval, players.length, { outerR: 160, showNumbers: false, containerFill: true })

    return oval
  }

  // ── 메인 렌더 ─────────────────────────────────────────────
  _render() {
    // 슬롯 선택 시 스크롤 위치 유지
    const scroller = document.scrollingElement || document.documentElement
    const savedTop = scroller.scrollTop

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

    // ─ 처녀 지목 ─
    const virginPlayer = state.players.find(p => p.role === 'virgin' && p.status === 'alive')
    if (virginPlayer && !this.engine.virginTriggered) {
      const virginCard = document.createElement('div')
      virginCard.className = 'card'
      virginCard.innerHTML = `<div class="card-title">👼 처녀 지목</div>`

      const virginLabel = document.createElement('div')
      virginLabel.className = 'section-label'
      virginLabel.textContent = `${virginPlayer.name}(${virginPlayer.id}번)을 지목한 플레이어 선택`
      virginCard.appendChild(virginLabel)

      // 처녀 본인 제외한 전체 플레이어가 지목자 후보
      const nominatorCandidates = state.players.filter(p => p.id !== virginPlayer.id)
      virginCard.appendChild(
        this._buildOval(
          nominatorCandidates,
          this.virginNominatorId ? [this.virginNominatorId] : [],
          (id) => { this.virginNominatorId = id; this._render() }
        )
      )

      if (this.virginNominatorId) {
        const nominator = this.engine.getPlayer(this.virginNominatorId)
        const virginBtn = document.createElement('button')
        virginBtn.className = 'btn btn-warning btn-full mt-8'
        virginBtn.textContent = `👼 ${nominator?.name || this.virginNominatorId}번이 처녀 지목`
        virginBtn.addEventListener('click', () => this._virginNominate(virginPlayer.id, this.virginNominatorId))
        virginCard.appendChild(virginBtn)
      }

      this.el.appendChild(virginCard)
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

    // 스크롤 위치 복원 (동기 — 브라우저 페인트 전에 적용)
    scroller.scrollTop = savedTop
  }

  _virginNominate(virginId, nominatorId) {
    const result = this.engine.nominate(nominatorId, virginId)

    this.onHistoryPush({
      type: 'nomination', phase: 'day', round: this.engine.state.round,
      actor: nominatorId, target: [virginId],
      label: `👼 처녀 지목: ${nominatorId}번 → ${virginId}번`,
      detail: result.virginTriggered ? `처녀 능력 발동! ${nominatorId}번 즉시 처형` : '발동 없음',
      snapshot: this.engine.serialize(),
    })

    this.virginNominatorId = null

    if (result.virginTriggered) {
      // 처녀 능력 발동 = 그날의 유일한 처형 → 즉시 밤으로 전환
      const winCheck = this.engine.checkWinCondition()
      if (winCheck.gameOver) {
        this.onGameOver && this.onGameOver(winCheck.winner, winCheck.reason)
        return
      }
      this.onStartNight && this.onStartNight()
      return
    }

    this._render()
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
