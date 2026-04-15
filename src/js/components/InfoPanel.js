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

// 캐릭터 이름 → 진영 매핑
const ROLE_TEAM_MAP = {
  '세탁부': 'town', '사서': 'town', '조사관': 'town', '요리사': 'town',
  '공감인': 'town', '점쟁이': 'town', '장의사': 'town', '수도사': 'town',
  '까마귀 사육사': 'town', '처녀': 'town', '처단자': 'town', '군인': 'town', '시장': 'town',
  '집사': 'outside', '주정뱅이': 'outside', '은둔자': 'outside', '성자': 'outside',
  '독약꾼': 'minion', '스파이': 'minion', '진홍의 여인': 'minion', '남작': 'minion',
  '임프': 'demon'
}

export function renderInfoPanel(data) {
  const { title, message, players = [], roleIcon = '🎴', onConfirm } = data

  const el = document.createElement('div')
  el.className = 'info-panel'

  // 역할 아이콘
  const iconEl = document.createElement('div')
  iconEl.className = 'info-panel__icon'

  // PNG: token.webp 배경 위에 역할 아이콘 오버레이
  if (roleIcon && roleIcon.endsWith('.webp')) {
    iconEl.className = 'info-panel__icon info-panel__icon--token'
    iconEl.innerHTML = `
      <img class="info-panel__token-bg"   src="./asset/token.webp" alt="">
      <img class="info-panel__token-icon" src="./asset/new/Icon_${roleIcon}" alt="${title}">
    `
  } else {
    iconEl.textContent = roleIcon
  }

  // 제목
  const titleEl = document.createElement('div')
  titleEl.className = 'info-panel__title panel-role-title'
  titleEl.textContent = title
  // 진영별 색상 적용
  const teamClass = ROLE_TEAM_MAP[title]
  if (teamClass) {
    titleEl.classList.add(`role-name-${teamClass}`)
  }

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
        roleIcon:      role ? role.icon      : '',
        roleIconEmoji: role ? role.iconEmoji : '',
        roleTeam:      role ? role.team      : null,
        showRole: true,
      })
      playersEl.appendChild(chip)
    })
    el.appendChild(playersEl)
  }

  // 확인 / 공개 버튼 — revealData 있으면 "참가자에게 공개 →", 없으면 "✅ 확인"
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
  overlay.className = 'info-panel-overlay panel-overlay'

  const panel = renderInfoPanel({
    ...data,
    onConfirm: () => {
      overlay.remove()
      data.onConfirm?.()
    },
  })

  overlay.appendChild(panel)
  document.body.appendChild(overlay)

  return () => overlay.remove()
}

if (!document.getElementById('info-panel-style')) {
  const style = document.createElement('style')
  style.id = 'info-panel-style'
  style.textContent = `
/* .panel-overlay (theme.css): position fixed, inset, bg, z-index, display flex */
.info-panel-overlay {
  align-items: center;
  justify-content: center;
}
.info-panel {
  width: 100%;
  max-width: var(--app-max-width);
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
  width: 80px;
  height: 80px;
  display: flex;
  align-items: center;
  justify-content: center;
}
/* token 오버레이 모드 */
.info-panel__icon--token {
  position: relative;
  font-size: 0;
}
.info-panel__token-bg,
.info-panel__token-icon {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
}
.info-panel__token-icon {
  object-fit: contain;
  filter: drop-shadow(0 0 12px rgba(212,168,40,0.4));
}
/* .panel-role-title (theme.css): 진영별 색상 공통 처리 */
.info-panel__title {
  font-family: 'Noto Serif KR', serif;
  font-size: 1.6rem;
  font-weight: 700;
  text-align: center;
  line-height: 1.2;
  text-shadow: 0 0 20px rgba(212,168,40,0.4);
}
.info-panel__title.role-name-town    { text-shadow: 0 0 20px rgba(46,74,143,0.5); }
.info-panel__title.role-name-outside { text-shadow: 0 0 20px rgba(91,179,198,0.5); }
.info-panel__title.role-name-minion  { text-shadow: 0 0 20px rgba(110,27,31,0.6); }
.info-panel__title.role-name-demon   { text-shadow: 0 0 24px rgba(110,27,31,0.8); }
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
