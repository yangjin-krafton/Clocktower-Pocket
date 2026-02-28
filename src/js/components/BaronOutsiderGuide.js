/**
 * BaronOutsiderGuide - Baron 슬롯 전용 아웃사이더 배정 가이드
 * 아웃사이더가 충분히 배정되었는지 시각적으로 표시
 */

export class BaronOutsiderGuide {
  /**
   * @param {HTMLElement} slotElement - Baron 슬롯 엘리먼트
   * @param {number} requiredOutsiders - 필요한 아웃사이더 수
   * @param {number} currentOutsiders - 현재 배정된 아웃사이더 수
   */
  constructor(slotElement, requiredOutsiders, currentOutsiders) {
    this.slot = slotElement
    this.requiredOutsiders = requiredOutsiders
    this.currentOutsiders = currentOutsiders
    this.container = null

    this._init()
  }

  _init() {
    // 컨테이너 생성
    this.container = document.createElement('div')
    this.container.className = 'baron-outsider-guide'

    // 조건 충족 여부
    const isComplete = this.currentOutsiders >= this.requiredOutsiders

    // 상태 클래스 추가
    if (isComplete) {
      this.container.classList.add('baron-outsider-guide--complete')
    } else {
      this.container.classList.add('baron-outsider-guide--warning')
    }

    // 아웃사이더 슬롯들 생성
    for (let i = 0; i < this.requiredOutsiders; i++) {
      const slot = document.createElement('div')
      slot.className = 'baron-outsider-slot'

      // 배정된 수량만큼 채워진 상태로 표시
      if (i < this.currentOutsiders) {
        slot.classList.add('baron-outsider-slot--filled')
      } else {
        slot.classList.add('baron-outsider-slot--empty')
      }

      this.container.appendChild(slot)
    }

    // 슬롯에 추가
    this.slot.appendChild(this.container)
  }

  /**
   * 아웃사이더 수 업데이트
   */
  update(currentOutsiders) {
    this.currentOutsiders = currentOutsiders
    this.destroy()
    this._init()
  }

  destroy() {
    if (this.container && this.container.parentNode) {
      this.container.remove()
    }
    this.container = null
  }
}

/**
 * Baron 슬롯에 아웃사이더 가이드를 추가하는 헬퍼 함수
 */
export function addBaronOutsiderGuide(slotElement, requiredOutsiders, currentOutsiders) {
  // 기존 가이드 제거
  const existingGuide = slotElement.querySelector('.baron-outsider-guide')
  if (existingGuide) {
    existingGuide.remove()
  }

  return new BaronOutsiderGuide(slotElement, requiredOutsiders, currentOutsiders)
}
