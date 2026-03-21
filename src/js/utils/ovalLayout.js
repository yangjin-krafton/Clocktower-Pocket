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

/**
 * 타원 중심에 SVG 파이 차트를 그려 각 슬롯 방향의 자리번호를 표시합니다.
 *
 * 좌표계: viewBox="0 0 100 100" preserveAspectRatio="none"
 *  → CSS left%/top% 와 동일한 퍼센트 기준 좌표계.
 *  → 슬롯은 (50 + 43·cos θ, 50 + 43·sin θ) 에 위치.
 *  → 파이 슬라이스도 같은 각도로 방사(放射)되어 각 슬롯 방향을 가리킴.
 *  → 2:3 portrait 이므로 텍스트에 scale(1, 0.667) 적용해 세로 왜곡을 보정.
 *
 * @param {HTMLElement} ovalEl       position:relative 타원 컨테이너
 * @param {number}      total        자리 수
 * @param {Object}      [opts]
 * @param {number}      [opts.rotOffset=-Math.PI/2]  회전 오프셋 (기본 12시 방향)
 * @param {number}      [opts.innerR=8]              도넛 안쪽 반지름 (viewBox 단위)
 *                                                   중앙 UI 가 있으면 크게 설정
 * @param {number}      [opts.outerR=30]             도넛 바깥 반지름 (viewBox 단위)
 * @param {Array}       [opts.slices]  per-slot 스타일 [{fill?, textFill?, opacity?}]
 * @returns {SVGSVGElement}  생성된 SVG 요소
 */
export function drawOvalPieNumbers(ovalEl, total, opts = {}) {
  const { rotOffset = -Math.PI / 2, innerR = 8, outerR = 30, slices = [], showNumbers = true } = opts

  // 파이 기하
  const cx        = 50
  const cy        = 50
  const pieR      = outerR      // 외곽 반지름 (사용자 지정 또는 기본 30)
  const textR     = innerR + (pieR - innerR) * 0.60
  const halfSlice = Math.PI / total
  const halfGap   = Math.min(0.025, halfSlice * 0.06)  // 슬라이스 간격

  // 폰트 크기: 슬라이스 호 너비에 맞춰 조정 (viewBox 단위)
  const chord  = 2 * textR * Math.sin(halfSlice)
  const fontSz = Math.max(2.2, Math.min(chord * 0.72, 5.5))

  const NS  = 'http://www.w3.org/2000/svg'
  const svg = document.createElementNS(NS, 'svg')
  svg.setAttribute('viewBox',             '0 0 100 100')
  svg.setAttribute('preserveAspectRatio', 'none')
  svg.setAttribute('width',              '100%')
  svg.setAttribute('height',             '100%')
  svg.style.cssText = 'position:absolute;left:0;top:0;pointer-events:none;overflow:visible;'

  // ── 골드 / 퍼플 교차 방사형 그라디언트 정의 ──
  const uid  = Math.random().toString(36).slice(2, 7)
  const GRADS = [
    { id: `pg-gold-${uid}`,   peak: 'rgba(212,168,40,0.22)',  edge: 'rgba(212,168,40,0.05)' },
    { id: `pg-purple-${uid}`, peak: 'rgba(130,80,200,0.20)',  edge: 'rgba(130,80,200,0.05)' },
  ]

  const defs = document.createElementNS(NS, 'defs')
  GRADS.forEach(({ id, peak, edge }) => {
    const grad = document.createElementNS(NS, 'radialGradient')
    grad.setAttribute('id',             id)
    grad.setAttribute('cx',             String(cx))
    grad.setAttribute('cy',             String(cy))
    grad.setAttribute('r',              String(outerR))
    grad.setAttribute('gradientUnits',  'userSpaceOnUse')

    // 안쪽(innerR) → 투명, 슬롯 위치(~35%) → 피크, 외곽(100%) → 소멸
    ;[
      [(innerR / outerR).toFixed(3), 'rgba(0,0,0,0)'],
      ['0.35',                        peak            ],
      ['1.0',                         edge            ],
    ].forEach(([offset, color]) => {
      const s = document.createElementNS(NS, 'stop')
      s.setAttribute('offset',     offset)
      s.setAttribute('stop-color', color)
      grad.appendChild(s)
    })
    defs.appendChild(grad)
  })
  svg.appendChild(defs)

  for (let i = 0; i < total; i++) {
    const mid = (2 * Math.PI * i) / total + rotOffset
    const a0  = mid - halfSlice + halfGap
    const a1  = mid + halfSlice - halfGap
    const sd  = slices[i] || {}

    // 파이 슬라이스 경로
    const ox0 = cx + pieR   * Math.cos(a0), oy0 = cy + pieR   * Math.sin(a0)
    const ox1 = cx + pieR   * Math.cos(a1), oy1 = cy + pieR   * Math.sin(a1)
    const ix1 = cx + innerR * Math.cos(a1), iy1 = cy + innerR * Math.sin(a1)
    const ix0 = cx + innerR * Math.cos(a0), iy0 = cy + innerR * Math.sin(a0)
    const lg  = (halfSlice * 2 - halfGap * 2) > Math.PI ? 1 : 0

    const path = document.createElementNS(NS, 'path')
    path.setAttribute('d', [
      `M ${ox0.toFixed(2)} ${oy0.toFixed(2)}`,
      `A ${pieR} ${pieR} 0 ${lg} 1 ${ox1.toFixed(2)} ${oy1.toFixed(2)}`,
      `L ${ix1.toFixed(2)} ${iy1.toFixed(2)}`,
      `A ${innerR} ${innerR} 0 ${lg} 0 ${ix0.toFixed(2)} ${iy0.toFixed(2)}`,
      'Z',
    ].join(' '))

    // 짝수 → 골드 그라디언트 / 홀수 → 퍼플 그라디언트
    path.setAttribute('fill',   sd.fill || `url(#${GRADS[i % 2].id})`)
    path.setAttribute('stroke', 'none')
    svg.appendChild(path)

    if (showNumbers) {
      // 자리번호 텍스트
      // scale(1, 0.667) 로 2:3 종장(縱長) 왜곡을 보정 — 텍스트가 정방형으로 보임
      const tx = cx + textR * Math.cos(mid)
      const ty = cy + textR * Math.sin(mid)
      const g  = document.createElementNS(NS, 'g')
      g.setAttribute('transform', `translate(${tx.toFixed(2)},${ty.toFixed(2)}) scale(1,0.667)`)

      const text = document.createElementNS(NS, 'text')
      text.setAttribute('x',                '0')
      text.setAttribute('y',                '0')
      text.setAttribute('text-anchor',      'middle')
      text.setAttribute('dominant-baseline','middle')
      text.setAttribute('font-size',        fontSz.toFixed(2))
      text.setAttribute('font-weight',      '700')
      text.setAttribute('fill',             sd.textFill || 'var(--text3)')
      if (sd.opacity != null) text.setAttribute('opacity', sd.opacity)
      text.textContent = i + 1

      g.appendChild(text)
      svg.appendChild(g)
    }
  }

  // 슬롯보다 아래(z-order 낮음)에 삽입
  ovalEl.insertBefore(svg, ovalEl.firstChild)
  return svg
}
