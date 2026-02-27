/**
 * ThemeManager — 동적 테마 컬러 전환 관리
 *
 * document.documentElement에 data-theme 속성을 설정하여
 * CSS 커스텀 프로퍼티를 테마별로 오버라이드한다.
 *
 * 테마: 'host' (어두운 갈색) | 'player' (어두운 보라) | null (기본/랜딩)
 */

export class ThemeManager {
  static _current = null
  static _stack = []  // pushTemp/popTemp 용 스택

  /**
   * 테마 설정
   * @param {'host'|'player'|null} theme
   */
  static set(theme) {
    this._current = theme
    const el = document.documentElement
    if (theme) {
      el.setAttribute('data-theme', theme)
    } else {
      el.removeAttribute('data-theme')
    }
  }

  /** 현재 테마 반환 */
  static get() {
    return this._current
  }

  /**
   * 임시 테마 전환 (이전 테마를 스택에 저장)
   * 호스트가 참가자에게 폰을 넘겨줄 때 사용
   */
  static pushTemp(theme) {
    this._stack.push(this._current)
    this.set(theme)
  }

  /**
   * 임시 테마 해제, 이전 테마 복원
   */
  static popTemp() {
    const prev = this._stack.pop() ?? null
    this.set(prev)
  }
}
