/**
 * HistoryManager — 게임 히스토리 데이터 관리
 *
 * 게임에서 발생하는 모든 유의미한 행동을 기록하고,
 * 타임라인 네비게이션(커서 이동, 열람 모드)을 지원한다.
 */

export class HistoryManager {
  constructor() {
    this._entries = []
    this._cursor = -1      // -1 = 최신 (열람 모드 아님)
    this._nextId = 1
    this._listeners = {}
  }

  // ── 기록 ──

  /**
   * 새 히스토리 엔트리 추가
   * @param {Object} partial - type, phase, round, actor, roleId, target, result, label 등
   * @returns {Object} 생성된 엔트리
   */
  push(partial) {
    const entry = {
      id: this._nextId++,
      timestamp: Date.now(),
      phase: partial.phase || null,
      round: partial.round ?? 0,
      type: partial.type || 'unknown',
      actor: partial.actor ?? null,
      roleId: partial.roleId ?? null,
      target: partial.target ?? null,
      result: partial.result ?? null,
      label: partial.label || '',
      detail: partial.detail ?? null,
    }
    this._entries.push(entry)

    // 열람 모드였다면 최신으로 복귀
    if (this._cursor !== -1) {
      this._cursor = -1
    }

    this._emit('push', entry)
    return entry
  }

  // ── 조회 ──

  getAll() { return this._entries }

  getByRound(round) {
    return this._entries.filter(e => e.round === round)
  }

  getByPhase(phase) {
    return this._entries.filter(e => e.phase === phase)
  }

  getCurrent() {
    if (this._cursor === -1) return this.getLatest()
    return this._entries[this._cursor] || this.getLatest()
  }

  getLatest() {
    return this._entries[this._entries.length - 1] || null
  }

  // ── 네비게이션 ──

  goTo(entryId) {
    const idx = this._entries.findIndex(e => e.id === entryId)
    if (idx === -1) return
    // 이미 최신 엔트리면 열람 모드 해제
    if (idx === this._entries.length - 1) {
      this.goToLatest()
      return
    }
    this._cursor = idx
    this._emit('navigate', this._entries[idx])
  }

  goBack() {
    if (this._entries.length === 0) return
    if (this._cursor === -1) {
      // 최신에서 하나 이전으로
      this._cursor = Math.max(0, this._entries.length - 2)
    } else {
      this._cursor = Math.max(0, this._cursor - 1)
    }
    this._emit('navigate', this._entries[this._cursor])
  }

  goForward() {
    if (this._cursor === -1) return // 이미 최신
    if (this._cursor >= this._entries.length - 1) {
      this.goToLatest()
      return
    }
    this._cursor++
    this._emit('navigate', this._entries[this._cursor])
  }

  goToLatest() {
    const was = this._cursor
    this._cursor = -1
    if (was !== -1) {
      this._emit('navigate', this.getLatest())
    }
  }

  isViewingHistory() {
    return this._cursor !== -1
  }

  getCursorIndex() {
    return this._cursor === -1 ? this._entries.length - 1 : this._cursor
  }

  // ── 리셋 ──

  reset() {
    this._entries = []
    this._cursor = -1
    this._nextId = 1
    this._emit('reset')
  }

  // ── 직렬화 / 복원 ──

  serialize() {
    return {
      entries: JSON.parse(JSON.stringify(this._entries)),
      nextId:  this._nextId,
    }
  }

  restore(data) {
    if (!data) return
    this._entries = data.entries || []
    this._nextId  = data.nextId || (this._entries.length + 1)
    this._cursor  = -1
    // UI 재구축: reset 후 각 엔트리를 push 이벤트로 발행
    this._emit('reset')
    this._entries.forEach(e => this._emit('push', e))
  }

  // ── 이벤트 에미터 ──

  on(event, handler) {
    if (!this._listeners[event]) this._listeners[event] = []
    this._listeners[event].push(handler)
  }

  off(event, handler) {
    if (!this._listeners[event]) return
    this._listeners[event] = this._listeners[event].filter(h => h !== handler)
  }

  _emit(event, data) {
    ;(this._listeners[event] || []).forEach(h => h(data))
  }
}
