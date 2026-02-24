/**
 * C-05 InfoPanel — 밤 정보 전달 전체화면 패널 (호스트 전용)
 * 호스트가 참가자에게 화면을 돌려서 보여주는 패널
 *
 * @param {Object} data
 *   title     {string}    역할명
 *   message   {string}    전달 정보 텍스트
 *   players   {Object[]}  관련 플레이어 목록 (선택적)
 *   roleIcon  {string}    역할 아이콘
 *   onConfirm {Function}  확인 버튼 콜백
 * @returns {HTMLElement}
 */
import { renderPlayerChip } from './PlayerChip.js'
import { ROLES_BY_ID } from '../data/roles-tb.js'

export function renderInfoPanel(data) {
  const { title, message, players = [], roleIcon = '🎴', onConfirm } = data

  const el = document.createElement('div')
  el.className = 'info-panel'

  // 역할 아이콘
  const iconEl = document.createElement('div')
  iconEl.className = 'info-panel__icon'
  iconEl.textContent = roleIcon

  // 제목
  const titleEl = document.createElement('div')
  titleEl.className = 'info-panel__title'
  titleEl.textContent = title

  // 메시지
  const msgEl = document.createElement('div')
  msgEl.className = 'info-panel__message'
  msgEl.textContent = message

  el.appendChild(iconEl)
  el.appendChild(titleEl)
  el.appendChild(msgEl)

  // 관련 플레이어 칩
  if (players.length > 0) {
    const playersEl = document.createElement('div')
    playersEl.className = 'info-panel__players'
    players.forEach(p => {
      const role = ROLES_BY_ID[p.role]
      const chip = renderPlayerChip(p, {
        roleIcon: role ? role.icon : '?',
        showRole: true,
      })
      playersEl.appendChild(chip)
    })
    el.appendChild(playersEl)
  }

  // 확인 버튼
  const confirmBtn = document.createElement('button')
  confirmBtn.className = 'info-panel__confirm btn btn-primary'
  confirmBtn.textContent = '✅ 확인'
  confirmBtn.addEventListener('click', () => onConfirm && onConfirm())
  el.appendChild(confirmBtn)

  return el
}

/**
 * InfoPanel을 DOM에 마운트 (전체화면 오버레이)
 * @returns {Function} unmount 함수
 */
export function mountInfoPanel(data) {
  const overlay = document.createElement('div')
  overlay.className = 'info-panel-overlay'

  const panel = renderInfoPanel({
    ...data,
    onConfirm: () => {
      overlay.remove()
      data.onConfirm && data.onConfirm()
    }
  })
  overlay.appendChild(panel)
  document.body.appendChild(overlay)

  return () => overlay.remove()
}

if (!document.getElementById('info-panel-style')) {
  const style = document.createElement('style')
  style.id = 'info-panel-style'
  style.textContent = `
.info-panel-overlay {
  position: fixed;
  inset: 0;
  background: var(--bg);
  z-index: 200;
  display: flex;
  align-items: center;
  justify-content: center;
}
.info-panel {
  width: 100%;
  max-width: 430px;
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 32px 24px;
  gap: 20px;
  /* 보라 glow */
  background: radial-gradient(ellipse 80% 60% at 50% 30%, rgba(122,111,183,0.1) 0%, transparent 60%);
}
.info-panel__icon {
  font-size: 3.5rem;
  line-height: 1;
  filter: drop-shadow(0 0 16px rgba(212,168,40,0.5));
}
.info-panel__title {
  font-family: 'Noto Serif KR', serif;
  font-size: 1.6rem;
  font-weight: 700;
  color: var(--gold2);
  text-align: center;
  line-height: 1.2;
  text-shadow: 0 0 20px rgba(212,168,40,0.4);
}
.info-panel__message {
  font-size: 1.15rem;
  color: var(--text);
  text-align: center;
  line-height: 1.6;
  background: var(--surface);
  border: 1px solid rgba(92,83,137,0.3);
  border-radius: 12px;
  padding: 16px 20px;
  width: 100%;
  max-width: 320px;
  word-break: keep-all;
}
.info-panel__players {
  display: flex;
  justify-content: center;
  gap: 16px;
  flex-wrap: wrap;
}
.info-panel__confirm {
  width: 100%;
  max-width: 280px;
  padding: 16px;
  font-size: 1rem;
  font-weight: 700;
  border-radius: 12px;
  min-height: 56px;
}
  `
  document.head.appendChild(style)
}
