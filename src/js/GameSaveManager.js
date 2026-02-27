/**
 * GameSaveManager — 게임 상태 저장/로드/슬롯 관리
 *
 * localStorage 키 구조:
 *   'ctp_saves'       → SaveMeta[]  (슬롯 목록)
 *   'ctp_save_{id}'   → SaveData    (전체 직렬 데이터)
 */

const META_KEY   = 'ctp_saves'
const DATA_PREFIX = 'ctp_save_'
const MAX_SLOTS  = 10

export class GameSaveManager {

  // ── 슬롯 목록 ──

  /** @returns {SaveMeta[]} updatedAt 내림차순 */
  static listSaves() {
    try {
      const raw = localStorage.getItem(META_KEY)
      const list = raw ? JSON.parse(raw) : []
      return list.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0))
    } catch { return [] }
  }

  // ── 저장 ──

  /**
   * @param {string} id       슬롯 ID
   * @param {SaveData} data   전체 저장 데이터
   */
  static save(id, data) {
    if (!id || !data) return false
    try {
      // meta 갱신
      const list = this.listSaves()
      const now  = Date.now()
      const existing = list.find(m => m.id === id)

      const meta = {
        id,
        label:       data.meta?.label || this._autoLabel(data),
        createdAt:   existing?.createdAt || now,
        updatedAt:   now,
        mode:        data.meta?.mode || 'host',
        playerCount: data.engineState?.players?.length || data.meta?.playerCount || 0,
        round:       data.engineState?.round ?? data.meta?.round ?? 0,
        phase:       data.engineState?.phase || data.meta?.phase || 'lobby',
        roomCode:    data.hostState?.roomCode || data.meta?.roomCode || '',
      }

      // 기존 항목이면 업데이트, 없으면 추가
      const newList = existing
        ? list.map(m => m.id === id ? meta : m)
        : [meta, ...list]

      // 최대 슬롯 초과 시 가장 오래된 항목 제거
      while (newList.length > MAX_SLOTS) {
        const removed = newList.pop()
        try { localStorage.removeItem(DATA_PREFIX + removed.id) } catch {}
      }

      localStorage.setItem(META_KEY, JSON.stringify(newList))

      // 데이터 저장
      data.meta = meta
      localStorage.setItem(DATA_PREFIX + id, JSON.stringify(data))
      return true
    } catch (e) {
      console.warn('[GameSaveManager] save failed:', e)
      return false
    }
  }

  // ── 로드 ──

  /** @returns {SaveData|null} */
  static load(id) {
    try {
      const raw = localStorage.getItem(DATA_PREFIX + id)
      return raw ? JSON.parse(raw) : null
    } catch { return null }
  }

  // ── 삭제 ──

  static delete(id) {
    try {
      const list = this.listSaves().filter(m => m.id !== id)
      localStorage.setItem(META_KEY, JSON.stringify(list))
      localStorage.removeItem(DATA_PREFIX + id)
    } catch {}
  }

  // ── ID 생성 ──

  static createId() {
    return 'g_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 6)
  }

  // ── 자동 레이블 ──

  static _autoLabel(data) {
    const n     = data.engineState?.players?.length || '?'
    const phase = data.engineState?.phase || 'lobby'
    const round = data.engineState?.round || 0
    const phaseKo = { lobby: '로비', night: '밤', day: '낮' }[phase] || phase
    return `${n}인 ${phaseKo}${round > 0 ? round : ''}`
  }

  // ── 시간 포맷 ──

  static formatTimeAgo(timestamp) {
    const diff = Date.now() - timestamp
    const sec  = Math.floor(diff / 1000)
    if (sec < 60) return '방금 전'
    const min = Math.floor(sec / 60)
    if (min < 60) return `${min}분 전`
    const hr = Math.floor(min / 60)
    if (hr < 24) return `${hr}시간 전`
    const day = Math.floor(hr / 24)
    return `${day}일 전`
  }
}
