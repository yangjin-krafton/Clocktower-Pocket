/**
 * ovalLayout.js — 타원형 좌석 배치 계산 공유 유틸리티
 *
 * 세 곳 모두 같은 공식을 사용합니다:
 *   - 자리 배치 탭 (app.js _showSeatLayout)
 *   - 호스트 게임 세팅 (Grimoire.js _renderSeatWheel)
 *   - 호스트 담 액션 대상 선택 (OvalSelectPanel.js)
 */

/** 타원 반지름 (컨테이너 % 단위, 2:3 portrait 기준) */
const RX = 43, RY = 43

/**
 * 주어진 타원 너비(px)에서 슬롯 크기와 파생 치수를 계산합니다.
 *
 * @param {number} total      플레이어 수
 * @param {number} ovalW      타원 컨테이너 너비 (px)
 * @param {number} [minSlot=36]  슬롯 최소 크기 (px)
 * @returns {{ slotPx: number, iconPx: number, badgeFontPx: number, badgeSize: number }}
 */
export function calcSlotMetrics(total, ovalW, minSlot = 36) {
  const chord  = 2 * Math.sin(Math.PI / total) * (ovalW * 0.43)
  const slotPx = Math.max(minSlot, Math.min(Math.floor(chord * 0.82), Math.floor(ovalW * 0.28)))
  return {
    slotPx,
    iconPx:      Math.round(slotPx * 0.62),
    badgeFontPx: Math.max(9,  Math.round(slotPx * 0.18)),
    badgeSize:   Math.max(16, Math.round(slotPx * 0.22)),
  }
}

/**
 * 가용 공간을 측정해 타원 치수(px)를 계산합니다.
 *
 * @param {number}  [reservedH=106]    가용 높이에서 제외할 픽셀
 *                                     (헤더 + 탭바 + 서브헤더 등)
 * @param {boolean} [useViewportH=false]  true 이면 window.innerHeight 사용
 *                                        (fixed overlay 전용)
 * @returns {{ ovalW: number, ovalH: number, rawH: number }}
 */
export function measureOvalSpace(reservedH = 106, useViewportH = false) {
  const acRect = document.getElementById('app-content')?.getBoundingClientRect()
  const availW = acRect?.width || 320
  const rawH   = useViewportH ? window.innerHeight : (acRect?.height || 520)
  const availH = rawH - reservedH
  const ovalW  = Math.floor(Math.min(availW, availH * 2 / 3))
  const ovalH  = Math.floor(ovalW * 1.5)
  return { ovalW, ovalH, rawH }
}

/**
 * 가용 공간 측정 + 슬롯 메트릭 계산을 한 번에 수행합니다.
 *
 * @param {number}  total
 * @param {number}  [reservedH=106]
 * @param {boolean} [useViewportH=false]
 * @returns {{ ovalW, ovalH, rawH, slotPx, iconPx, badgeFontPx, badgeSize }}
 */
export function calcOvalLayout(total, reservedH = 106, useViewportH = false) {
  const { ovalW, ovalH, rawH } = measureOvalSpace(reservedH, useViewportH)
  return { ovalW, ovalH, rawH, ...calcSlotMetrics(total, ovalW) }
}

/**
 * 타원 위의 슬롯 위치를 % 좌표로 계산합니다.
 *
 * @param {number} index          슬롯 인덱스 (0-based)
 * @param {number} total          전체 슬롯 수
 * @param {number} [rotOffset]    회전 오프셋 (rad), 기본 -π/2 (12시 방향 시작)
 * @returns {{ x: number, y: number }}  left / top % 값
 */
export function ovalSlotPos(index, total, rotOffset = -Math.PI / 2) {
  const angle = (2 * Math.PI * index) / total + rotOffset
  return {
    x: 50 + RX * Math.cos(angle),
    y: 50 + RY * Math.sin(angle),
  }
}

/**
 * selfSeatId 를 6시(하단 중앙)에 놓는 회전 오프셋을 계산합니다.
 *
 * @param {number|null} selfSeatId  본인 자리번호 (1-based), null 이면 0번 슬롯
 * @param {number}      total
 * @returns {number} rotOffset (rad)
 */
export function ovalSelfRotOffset(selfSeatId, total) {
  const selfIdx = selfSeatId != null ? selfSeatId - 1 : 0
  return Math.PI / 2 - (2 * Math.PI * selfIdx / total)
}
