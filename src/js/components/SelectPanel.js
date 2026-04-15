/**
 * C-06 SelectPanel — 밤 대상 선택 전체화면 패널 (호스트 전용)
 * 참가자가 호스트 화면에서 직접 탭하여 대상 선택
 *
 * @param {Object} data
 *   title      {string}    역할명
 *   roleIcon   {string}    역할 아이콘
 *   players    {Object[]}  선택 가능한 플레이어 목록
 *   maxSelect  {number}    최대 선택 수
 *   onConfirm  {Function}  onConfirm(selectedIds[]) 콜백
 * @returns {HTMLElement}
 */
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

export function renderSelectPanel(data) {
  const { title, roleIcon = '🎯', players = [], maxSelect = 1, onConfirm } = data

  let selectedIds = []

  const el = document.createElement('div')
  el.className = 'select-panel'

  // 헤더
  const header = document.createElement('div')
  header.className = 'select-panel__header'

  const iconSpan = document.createElement('span')
  iconSpan.className = 'select-panel__icon'
  // PNG 이미지면 img 태그로, 아니면 emoji로 표시
  if (roleIcon && roleIcon.endsWith('.webp')) {
    const img = document.createElement('img')
    img.src = `./asset/new/Icon_${roleIcon}`
    img.alt = title
    img.className = 'select-panel__icon-img'
    iconSpan.appendChild(img)
  } else {
    iconSpan.textContent = roleIcon
  }

  const titleWrap = document.createElement('div')
  titleWrap.className = 'select-panel__title-wrap'

  const titleDiv = document.createElement('div')
  titleDiv.className = 'select-panel__title panel-role-title'
  titleDiv.textContent = title
  // 진영별 색상 적용
  const teamClass = ROLE_TEAM_MAP[title]
  if (teamClass) {
    titleDiv.classList.add(`role-name-${teamClass}`)
  }

  const hintDiv = document.createElement('div')
  hintDiv.className = 'select-panel__hint'
  hintDiv.textContent = '대상을 선택하세요'

  titleWrap.appendChild(titleDiv)
  titleWrap.appendChild(hintDiv)

  header.appendChild(iconSpan)
  header.appendChild(titleWrap)
  el.appendChild(header)

  // 선택 카운터
  const counter = document.createElement('div')
  counter.className = 'select-panel__counter'
  counter.textContent = `선택: 0 / ${maxSelect}`
  el.appendChild(counter)

  // 플레이어 그리드
  const grid = document.createElement('div')
  grid.className = 'select-panel__grid'
  el.appendChild(grid)

  function buildGrid() {
    grid.innerHTML = ''
    players.forEach(p => {
      const role = ROLES_BY_ID[p.role]
      const isSelected = selectedIds.includes(p.id)
      const canSelect = p.status === 'alive'

      const cell = document.createElement('div')
      cell.className = 'select-panel__chip' +
        (isSelected ? ' select-panel__chip--selected' : '') +
        (!canSelect ? ' select-panel__chip--disabled' : '')

      const gemDiv = document.createElement('div')
      gemDiv.className = 'select-panel__gem'
      // PNG 이미지면 img 태그로, 아니면 emoji로 표시
      if (role?.icon && role.icon.endsWith('.webp')) {
        const img = document.createElement('img')
        img.src = `./asset/new/Icon_${role.icon}`
        img.alt = role.name
        img.className = 'select-panel__gem-img'
        gemDiv.appendChild(img)
      } else {
        gemDiv.textContent = role ? role.icon : '?'
      }

      const nameDiv = document.createElement('div')
      nameDiv.className = 'select-panel__chip-name'
      nameDiv.textContent = `${p.id}번`

      cell.appendChild(gemDiv)
      cell.appendChild(nameDiv)

      if (canSelect) {
        cell.addEventListener('click', () => {
          if (isSelected) {
            selectedIds = selectedIds.filter(id => id !== p.id)
          } else {
            if (selectedIds.length >= maxSelect) {
              if (maxSelect === 1) selectedIds = []
              else return
            }
            selectedIds.push(p.id)
          }
          buildGrid()
          updateConfirm()
        })
      }

      grid.appendChild(cell)
    })
  }

  // 확인 버튼
  const confirmBtn = document.createElement('button')
  confirmBtn.className = 'btn btn-primary panel-confirm-btn'
  confirmBtn.textContent = '✅ 확인'
  confirmBtn.disabled = true
  confirmBtn.addEventListener('click', () => onConfirm && onConfirm([...selectedIds]))
  el.appendChild(confirmBtn)

  function updateConfirm() {
    counter.textContent = `선택: ${selectedIds.length} / ${maxSelect}`
    confirmBtn.disabled = selectedIds.length === 0
  }

  buildGrid()
  return el
}

/**
 * SelectPanel을 DOM에 마운트
 * @returns {Function} unmount
 */
export function mountSelectPanel(data) {
  const overlay = document.createElement('div')
  overlay.className = 'select-panel-overlay panel-overlay'

  const panel = renderSelectPanel({
    ...data,
    onConfirm: (ids) => {
      overlay.remove()
      data.onConfirm && data.onConfirm(ids)
    }
  })
  overlay.appendChild(panel)
  document.body.appendChild(overlay)

  return () => overlay.remove()
}

if (!document.getElementById('select-panel-style')) {
  const style = document.createElement('style')
  style.id = 'select-panel-style'
  style.textContent = `
/* .panel-overlay (theme.css): position fixed, inset, bg, z-index, display flex */
.select-panel-overlay {
  align-items: center;
  justify-content: center;
  padding: 20px;
}
.select-panel {
  width: 100%;
  max-width: var(--app-max-width);
  height: 100%;
  display: flex;
  flex-direction: column;
  gap: 14px;
  padding: 24px 16px;
  background: radial-gradient(ellipse 80% 50% at 50% 10%, rgba(91,179,198,0.08) 0%, transparent 60%);
}
.select-panel__header {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-shrink: 0;
}
.select-panel__icon {
  font-size: 2.2rem;
  width: 50px;
  height: 50px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}
.select-panel__icon-img {
  width: 100%;
  height: 100%;
  object-fit: contain;
}
.select-panel__title-wrap { flex: 1; }
/* .panel-role-title (theme.css): 진영별 색상 공통 처리 */
.select-panel__title {
  font-family: 'Noto Serif KR', serif;
  font-size: 1.2rem;
  font-weight: 700;
}
.select-panel__title.role-name-demon { text-shadow: 0 0 12px rgba(110,27,31,0.6); }
.select-panel__hint { font-size: 0.72rem; color: var(--text3); margin-top: 2px; }
.select-panel__counter {
  font-size: 0.78rem;
  color: var(--tl-base);
  text-align: center;
  font-weight: 600;
  flex-shrink: 0;
}
.select-panel__grid {
  flex: 1;
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(80px, 1fr));
  gap: 10px;
  overflow-y: auto;
  align-content: start;
  padding: 4px 0;
}
.select-panel__chip {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  padding: 10px 6px;
  border-radius: 10px;
  border: 2px solid var(--lead2);
  background: var(--surface);
  cursor: pointer;
  transition: all 0.15s;
  -webkit-tap-highlight-color: transparent;
}
.select-panel__chip:active { transform: scale(0.93); }
.select-panel__chip--selected {
  border-color: var(--gold);
  background: rgba(212,168,40,0.1);
  box-shadow: 0 0 12px rgba(212,168,40,0.35);
}
.select-panel__chip--disabled { opacity: 0.3; cursor: default; }
.select-panel__gem {
  font-size: 1.6rem;
  line-height: 1;
  width: 40px;
  height: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
}
.select-panel__gem-img {
  width: 100%;
  height: 100%;
  object-fit: contain;
}
.select-panel__chip-name {
  font-size: 0.72rem;
  color: var(--text);
  font-weight: 600;
  text-align: center;
}
.select-panel__chip-seat { font-size: 0.58rem; color: var(--text4); }
/* .panel-confirm-btn (theme.css): 확인 버튼 공통 스타일 */
  `
  document.head.appendChild(style)
}
