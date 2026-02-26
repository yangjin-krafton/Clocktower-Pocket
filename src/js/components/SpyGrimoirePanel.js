/**
 * C-10 SpyGrimoirePanel — 스파이 전용 그리모어 시각화 패널
 *
 * 호스트가 공개 방식을 선택하면, 스파이에게 오발 좌석 배치도로
 * 그리모어(전체 역할 정보)를 보여주는 전용 화면.
 *
 * 공개 모드 3가지:
 *   'all'     — 모든 자리 역할 공개
 *   'half'    — 무작위 절반만 역할 공개, 나머지 ?
 *   'shuffle' — 모든 역할 공개 + 자리 번호 셔플 (어떤 자리인지 모름)
 *
 * 사용:
 *   mountSpyModeSelector({ players, onSelected })   ← 호스트가 모드 선택
 *   mountSpyGrimoirePanel({ players, mode, onNext }) ← 스파이에게 공개
 */
import { ROLES_BY_ID } from '../data/roles-tb.js'

// ── 유틸 ─────────────────────────────────────────────────
function shuffle(arr) {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

// 오발 좌표 계산 (1번 = 12시, 시계방향)
function ovalPos(i, total, RX = 43, RY = 43) {
  const angle = (2 * Math.PI * i) / total - Math.PI / 2
  return {
    x: 50 + RX * Math.cos(angle),
    y: 50 + RY * Math.sin(angle),
  }
}

const TEAM_BORDER = {
  townsfolk: 'rgba(46,74,143,0.6)',
  outsider:  'rgba(91,179,198,0.6)',
  minion:    'rgba(140,40,50,0.7)',
  demon:     'rgba(160,30,40,0.95)',
}

// ────────────────────────────────────────────────────────
// 1. 호스트 모드 선택 패널
// ────────────────────────────────────────────────────────
export function mountSpyModeSelector({ players, onSelected }) {
  const overlay = document.createElement('div')
  overlay.className = 'spy-mode-overlay'

  const panel = document.createElement('div')
  panel.className = 'spy-mode-panel'

  panel.innerHTML = `
    <div class="spy-mode__lock">🔒 호스트 전용</div>
    <div class="spy-mode__title">🕵️ 스파이 그리모어</div>
    <div class="spy-mode__sub">어떤 방식으로 공개하시겠습니까?</div>
  `

  const MODES = [
    {
      id: 'all',
      icon: '🔍',
      label: '모두 공개',
      desc: '모든 자리의 역할을 그대로 보여줍니다.',
      cls: 'spy-mode__btn--all',
    },
    {
      id: 'half',
      icon: '👁',
      label: '반만 공개',
      desc: '무작위로 절반 자리만 역할 공개, 나머지는 ? 처리.',
      cls: 'spy-mode__btn--half',
    },
    {
      id: 'shuffle',
      icon: '🎲',
      label: '자리 번호 셔플',
      desc: '역할은 모두 보이지만 자리 번호가 뒤섞여 어느 자리인지 알 수 없습니다.',
      cls: 'spy-mode__btn--shuffle',
    },
  ]

  MODES.forEach(mode => {
    const btn = document.createElement('button')
    btn.className = `spy-mode__btn ${mode.cls}`
    btn.innerHTML = `
      <span class="spy-mode__btn-icon">${mode.icon}</span>
      <div class="spy-mode__btn-text">
        <div class="spy-mode__btn-label">${mode.label}</div>
        <div class="spy-mode__btn-desc">${mode.desc}</div>
      </div>
    `
    btn.addEventListener('click', () => {
      overlay.remove()
      onSelected(mode.id)
    })
    panel.appendChild(btn)
  })

  overlay.appendChild(panel)
  document.body.appendChild(overlay)

  return () => overlay.remove()
}

// ────────────────────────────────────────────────────────
// 2. 스파이 공개 화면 (오발 그리모어)
// ────────────────────────────────────────────────────────
export function mountSpyGrimoirePanel({ players, mode, onNext }) {
  // 모드별 슬롯 데이터 준비
  const slots = _buildSlots(players, mode)

  const overlay = document.createElement('div')
  overlay.className = 'spy-grim-overlay'

  const panel = document.createElement('div')
  panel.className = 'spy-grim-panel'

  // 상단 힌트
  const label = document.createElement('div')
  label.className = 'spy-grim__label'
  label.textContent = '👁 참가자 화면'
  panel.appendChild(label)

  // 역할명 + 모드 표시
  const hdr = document.createElement('div')
  hdr.className = 'spy-grim__hdr'
  const modeLabel = { all: '전체 공개', half: '절반 공개', shuffle: '자리 번호 셔플' }
  hdr.innerHTML = `
    <span class="spy-grim__role-name">🕵️ 스파이 — 그리모어</span>
    <span class="spy-grim__mode-badge">${modeLabel[mode] || ''}</span>
  `
  panel.appendChild(hdr)

  // 오발 래퍼
  const wrap = document.createElement('div')
  wrap.className = 'spy-grim__wrap'

  const oval = document.createElement('div')
  oval.className = 'spy-grim__oval'

  const total = slots.length

  // 슬롯 크기 계산
  const appContent = document.getElementById('app-content')
  const containerW  = appContent ? (appContent.getBoundingClientRect().width - 32) : 300
  const baseRatio   = total <= 6 ? 0.20 : total <= 9 ? 0.18 : total <= 13 ? 0.16 : total <= 16 ? 0.14 : 0.12
  const slotPx      = Math.min(68, Math.max(32, Math.round(containerW * baseRatio)))
  const iconPx      = Math.round(slotPx * 0.58)

  slots.forEach((slot, i) => {
    const { x, y } = ovalPos(i, total)
    const role = slot.role ? ROLES_BY_ID[slot.role] : null
    const borderColor = role ? (TEAM_BORDER[role.team] || 'var(--lead2)') : 'var(--lead2)'

    const el = document.createElement('div')
    el.className = 'spy-grim__slot'
    el.style.cssText = `
      left:${x.toFixed(2)}%;
      top:${y.toFixed(2)}%;
      width:${slotPx}px;
      height:${slotPx}px;
      border-color:${borderColor};
    `

    // 자리 번호 배지
    const numBadge = document.createElement('span')
    numBadge.className = 'spy-grim__seat-num'
    numBadge.textContent = slot.displaySeatNum  // 모드에 따라 실제/셔플 번호

    // 역할 아이콘 영역
    const iconEl = document.createElement('div')
    iconEl.className = 'spy-grim__icon'
    iconEl.style.cssText = `width:${iconPx}px;height:${iconPx}px;font-size:${Math.round(iconPx*0.6)}px;`

    if (!slot.revealed) {
      // 숨겨진 슬롯 (half 모드)
      iconEl.innerHTML = `<span style="color:var(--text4);font-size:${Math.round(iconPx*0.55)}px">?</span>`
      el.classList.add('spy-grim__slot--hidden')
    } else if (role?.icon?.endsWith('.png')) {
      const img = document.createElement('img')
      img.src = `./asset/icons/${role.icon}`
      img.style.cssText = 'width:100%;height:100%;object-fit:contain;'
      iconEl.appendChild(img)
    } else {
      iconEl.textContent = role ? (role.iconEmoji || role.icon || '?') : '?'
    }

    // 역할명 (작게)
    const roleNameEl = document.createElement('div')
    roleNameEl.className = 'spy-grim__role-text'
    roleNameEl.textContent = slot.revealed && role ? role.name : ''

    el.appendChild(numBadge)
    el.appendChild(iconEl)
    el.appendChild(roleNameEl)
    oval.appendChild(el)
  })

  wrap.appendChild(oval)
  panel.appendChild(wrap)

  // [호스트] 다음 버튼
  const nextBtn = document.createElement('button')
  nextBtn.className = 'spy-grim__next btn btn-primary'
  nextBtn.textContent = '[ 호스트 ] 다음 →'
  nextBtn.addEventListener('click', () => {
    overlay.remove()
    onNext && onNext()
  })
  panel.appendChild(nextBtn)

  overlay.appendChild(panel)
  document.body.appendChild(overlay)

  return () => overlay.remove()
}

// ────────────────────────────────────────────────────────
// 내부: 모드별 슬롯 데이터 생성
// ────────────────────────────────────────────────────────
function _buildSlots(players, mode) {
  const base = players.map(p => ({
    id:             p.id,
    displaySeatNum: p.id,   // 기본: 실제 번호
    role:           p.role,
    revealed:       true,
  }))

  if (mode === 'half') {
    // 무작위 절반 숨김
    const halfCount = Math.ceil(players.length / 2)
    const hiddenSet = new Set(shuffle([...Array(players.length).keys()]).slice(halfCount))
    return base.map((s, i) => hiddenSet.has(i) ? { ...s, revealed: false } : s)
  }

  if (mode === 'shuffle') {
    // 자리 번호 배열을 셔플해서 displaySeatNum만 교체
    const shuffledIds = shuffle(players.map(p => p.id))
    return base.map((s, i) => ({ ...s, displaySeatNum: shuffledIds[i] }))
  }

  return base  // 'all': 그대로
}

// ────────────────────────────────────────────────────────
// 스타일 주입
// ────────────────────────────────────────────────────────
if (!document.getElementById('spy-grimoire-style')) {
  const style = document.createElement('style')
  style.id = 'spy-grimoire-style'
  style.textContent = `

/* ── 모드 선택 (호스트 전용) ── */
.spy-mode-overlay {
  position: fixed; inset: 0;
  background: var(--bg);
  z-index: 215;
  display: flex; align-items: center; justify-content: center;
}
.spy-mode-panel {
  width: 100%; max-width: var(--app-max-width);
  display: flex; flex-direction: column;
  gap: 10px; padding: 24px 20px;
}
.spy-mode__lock {
  font-size: 0.62rem; color: var(--text4);
  text-align: center; letter-spacing: 0.05em;
}
.spy-mode__title {
  font-family: 'Noto Serif KR', serif;
  font-size: 1.2rem; font-weight: 700;
  color: var(--gold2); text-align: center;
}
.spy-mode__sub {
  font-size: 0.75rem; color: var(--text3);
  text-align: center; margin-bottom: 6px;
}
.spy-mode__btn {
  display: flex; align-items: center; gap: 12px;
  padding: 14px 16px;
  background: var(--surface); border: 2px solid var(--lead2);
  border-radius: var(--radius-md);
  cursor: pointer; transition: border-color 0.15s, background 0.15s;
  text-align: left; -webkit-tap-highlight-color: transparent;
}
.spy-mode__btn:active { transform: scale(0.98); }
.spy-mode__btn--all:hover    { border-color: var(--tl-base); background: rgba(91,179,198,0.06); }
.spy-mode__btn--half:hover   { border-color: var(--pu-base); background: rgba(144,128,204,0.06); }
.spy-mode__btn--shuffle:hover { border-color: var(--gold);  background: rgba(212,168,40,0.06); }
.spy-mode__btn-icon { font-size: 1.8rem; flex-shrink: 0; }
.spy-mode__btn-label {
  font-size: 0.92rem; font-weight: 700; color: var(--text); margin-bottom: 2px;
}
.spy-mode__btn-desc { font-size: 0.7rem; color: var(--text4); line-height: 1.4; }

/* ── 그리모어 공개 화면 (참가자 공개) ── */
.spy-grim-overlay {
  position: fixed; inset: 0;
  background: var(--bg);
  z-index: 210;
  display: flex; align-items: stretch;
}
.spy-grim-panel {
  width: 100%; max-width: var(--app-max-width);
  margin: 0 auto;
  display: flex; flex-direction: column;
  padding: 12px 16px 16px; gap: 8px;
  background: radial-gradient(ellipse 80% 50% at 50% 15%, rgba(92,83,137,0.12) 0%, transparent 60%);
}
.spy-grim__label {
  font-size: 0.62rem; color: var(--text4);
  text-align: center; letter-spacing: 0.05em;
}
.spy-grim__hdr {
  display: flex; align-items: center; justify-content: center; gap: 8px;
}
.spy-grim__role-name {
  font-family: 'Noto Serif KR', serif;
  font-size: 1rem; font-weight: 700;
  color: var(--rd-light);
}
.spy-grim__mode-badge {
  font-size: 0.6rem; color: var(--text4);
  background: var(--surface2); border: 1px solid var(--lead2);
  border-radius: 8px; padding: 2px 7px;
}

.spy-grim__wrap {
  flex: 1; min-height: 0;
  display: flex; align-items: center; justify-content: center;
  overflow: hidden;
}
.spy-grim__oval {
  position: relative;
  width: min(100%, calc((100svh - 200px) * 2 / 3));
  max-height: 100%;
  aspect-ratio: 2 / 3;
  margin: 0 auto;
}

/* 슬롯 */
.spy-grim__slot {
  position: absolute;
  transform: translate(-50%, -50%);
  border-radius: 8px; border: 2px solid var(--lead2);
  background: var(--surface);
  display: flex; flex-direction: column;
  align-items: center; justify-content: center;
  gap: 1px; overflow: visible;
}
.spy-grim__slot--hidden {
  background: var(--surface2);
  border-style: dashed;
  border-color: var(--lead2) !important;
  opacity: 0.65;
}

/* 자리 번호 배지 (상단 중앙) */
.spy-grim__seat-num {
  position: absolute; top: 2px; left: 50%;
  transform: translateX(-50%);
  font-size: 0.68rem; font-weight: 700;
  color: var(--gold2);
  background: rgba(10,9,22,0.72);
  border: 1px solid rgba(212,168,40,0.5);
  border-radius: 9px; padding: 0 4px;
  line-height: 1.5; white-space: nowrap;
  z-index: 2; pointer-events: none;
}
.spy-grim__icon {
  border-radius: 50%; background: var(--surface2);
  display: flex; align-items: center; justify-content: center;
  flex-shrink: 0; pointer-events: none; overflow: hidden;
}
.spy-grim__role-text {
  font-size: 0.46rem; color: var(--text3);
  text-align: center; line-height: 1.2;
  max-width: 100%; white-space: nowrap;
  overflow: hidden; text-overflow: ellipsis;
  padding: 0 2px; pointer-events: none;
}

/* 다음 버튼 */
.spy-grim__next {
  flex-shrink: 0;
  padding: 14px; font-size: 0.9rem; font-weight: 700;
  border-radius: 10px; min-height: 52px;
  opacity: 0.65;
}
.spy-grim__next:hover { opacity: 1; }
  `
  document.head.appendChild(style)
}
