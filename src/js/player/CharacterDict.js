/**
 * P-07 CharacterDict — 캐릭터 사전 (그리드 토큰 뷰)
 *
 * - 그리드 레이아웃: 4열, 진영별 섹션
 * - 토큰 클릭 → 역할 상세 모달 (큰 화면)
 * - 모달 안: 아이콘·이름·진영·능력 + 규칙 바로가기 버튼
 * - 배경 클릭 or ✕ → 모달 닫기
 */
import { ROLES_TB } from '../data/roles-tb.js'

const TEAM_LABEL  = { townsfolk: '마을 주민', outsider: '아웃사이더', minion: '미니언', demon: '임프' }
const TEAM_COLOR  = { townsfolk: 'var(--bl-light)', outsider: 'var(--tl-light)', minion: 'var(--rd-light)', demon: 'var(--rd-light)' }
const GEM_CLASS   = { townsfolk: 'gem-town', outsider: 'gem-outside', minion: 'gem-minion', demon: 'gem-demon' }
const BADGE_CLASS = { townsfolk: 'badge-town', outsider: 'badge-outside', minion: 'badge-minion', demon: 'badge-demon' }

export class CharacterDict {
  constructor({ scriptRoles = null, onRoleClick = null, initialScenario = null } = {}) {
    this.scriptRoles = scriptRoles
    this.onRoleClick = onRoleClick  // (roleId) => 규칙 탭 해당 페이지로 이동
    this.el         = null
    this._modal     = null
    // 시나리오 필터: 'all' | 'tb' | 'game'  ('game'은 호스트 전용)
    // initialScenario 명시 > scriptRoles 있으면 'game' > 기본 'all'
    this.scenario   = initialScenario ?? (scriptRoles ? 'game' : 'all')
  }

  mount(container) {
    this.el = document.createElement('div')
    this.el.className = 'dict-screen'
    this._render()
    container.appendChild(this.el)
  }

  unmount() {
    this._closeModal()
    this.el?.remove()
  }

  // ─────────────────────────────────────
  // 렌더링
  // ─────────────────────────────────────

  _getRoles() {
    let roles = ROLES_TB

    if (this.scenario === 'game' && this.scriptRoles) {
      roles = roles.filter(r => this.scriptRoles.includes(r.id))
    }
    // 'all'과 'tb' 모두 ROLES_TB 전체 표시

    return roles
  }

  _render() {
    this.el.innerHTML = ''

    // ── 시나리오 필터 행 ──
    const scenarioRow = document.createElement('div')
    scenarioRow.className = 'dict__filter'

    const scenarioItems = [
      { key: 'all',  label: '전체' },
      { key: 'tb',   label: '등장 가능한' },
    ]
    // '실제 등장한' 필터는 scriptRoles가 있을 때(호스트)만 표시
    if (this.scriptRoles) {
      scenarioItems.push({ key: 'game', label: '👑 실제 등장한' })
    }

    scenarioItems.forEach(({ key, label }) => {
      const btn = document.createElement('button')
      btn.className = 'dict__filter-btn'
        + (this.scenario === key ? ' dict__filter-btn--active' : '')
        + (key === 'game' ? ' dict__filter-btn--host' : '')
      btn.textContent = label
      btn.addEventListener('click', () => { this.scenario = key; this._render() })
      scenarioRow.appendChild(btn)
    })
    this.el.appendChild(scenarioRow)

    const roles = this._getRoles()
    if (roles.length === 0) {
      const empty = document.createElement('div')
      empty.style.cssText = 'text-align:center;padding:32px;color:var(--text3);font-size:0.8rem;'
      empty.textContent = '역할 없음'
      this.el.appendChild(empty)
      return
    }

    // ── 그리드: 항상 진영별 섹션으로 표시 ──
    ;['townsfolk', 'outsider', 'minion', 'demon'].forEach(team => {
      const teamRoles = roles.filter(r => r.team === team)
      if (teamRoles.length === 0) return

      const section = document.createElement('div')
      section.className = 'dict__section'

      const heading = document.createElement('div')
      heading.className = `dict__section-title dict__section-title--${team}`
      heading.textContent = TEAM_LABEL[team]
      section.appendChild(heading)

      section.appendChild(this._buildGrid(teamRoles))
      this.el.appendChild(section)
    })
  }

  _buildGrid(roles) {
    const grid = document.createElement('div')
    grid.className = 'dict__grid'
    roles.forEach(role => grid.appendChild(this._buildToken(role)))
    return grid
  }

  _buildToken(role) {
    const btn = document.createElement('button')
    btn.className = `dict__token dict__token--${role.team}`

    const iconDiv = document.createElement('div')
    iconDiv.className = 'dict__token-icon'
    if (role.icon?.endsWith('.png')) {
      const img = document.createElement('img')
      img.src = `./asset/icons/${role.icon}`
      img.alt = role.name
      iconDiv.appendChild(img)
    } else {
      iconDiv.textContent = role.iconEmoji || role.icon || '?'
    }

    const nameDiv = document.createElement('div')
    nameDiv.className = 'dict__token-name'
    nameDiv.textContent = role.name

    btn.appendChild(iconDiv)
    btn.appendChild(nameDiv)
    btn.addEventListener('click', () => this._openModal(role))
    return btn
  }

  // ─────────────────────────────────────
  // 상세 모달
  // ─────────────────────────────────────

  _openModal(role) {
    this._closeModal()

    const overlay = document.createElement('div')
    overlay.className = 'dict__overlay'
    overlay.addEventListener('click', e => { if (e.target === overlay) this._closeModal() })

    const modal = document.createElement('div')
    modal.className = 'dict__modal'

    // ── 닫기 버튼 ──
    const closeBtn = document.createElement('button')
    closeBtn.className = 'dict__modal-close'
    closeBtn.textContent = '✕'
    closeBtn.addEventListener('click', () => this._closeModal())
    modal.appendChild(closeBtn)

    // ── 큰 아이콘 (배경 없이 반투명) ──
    const iconWrap = document.createElement('div')
    iconWrap.className = 'dict__modal-icon'
    if (role.icon?.endsWith('.png')) {
      const img = document.createElement('img')
      img.src = `./asset/icons/${role.icon}`
      img.alt = role.name
      img.className = 'dict__modal-icon-img'
      iconWrap.appendChild(img)
    } else {
      iconWrap.textContent = role.iconEmoji || role.icon || '?'
    }
    modal.appendChild(iconWrap)

    // ── 역할명 ──
    const nameEl = document.createElement('div')
    nameEl.className = 'dict__modal-name'
    nameEl.style.color = TEAM_COLOR[role.team] || 'var(--text)'
    nameEl.textContent = role.name
    modal.appendChild(nameEl)

    // ── 진영 배지 ──
    const badge = document.createElement('span')
    badge.className = `badge ${BADGE_CLASS[role.team]}`
    badge.textContent = TEAM_LABEL[role.team] || role.team
    modal.appendChild(badge)

    // ── 능력 설명 ──
    if (role.ability) {
      const abilityEl = document.createElement('div')
      abilityEl.className = 'dict__modal-ability'
      abilityEl.textContent = role.ability
      modal.appendChild(abilityEl)
    }

    // ── 규칙 바로가기 버튼 ──
    if (this.onRoleClick) {
      const rulesBtn = document.createElement('button')
      rulesBtn.className = 'btn dict__modal-rules-btn'
      rulesBtn.innerHTML = '📜 규칙에서 자세히 보기'
      rulesBtn.addEventListener('click', () => {
        this._closeModal()
        this.onRoleClick(role.id)
      })
      modal.appendChild(rulesBtn)
    }

    overlay.appendChild(modal)
    document.body.appendChild(overlay)
    this._modal = overlay

    requestAnimationFrame(() => overlay.classList.add('dict__overlay--visible'))
  }

  _closeModal() {
    if (this._modal) {
      this._modal.remove()
      this._modal = null
    }
  }
}

// ─────────────────────────────────────
// 스타일
// ─────────────────────────────────────
if (!document.getElementById('dict-style')) {
  const style = document.createElement('style')
  style.id = 'dict-style'
  style.textContent = `
/* ── 사전 화면 ── */
.dict-screen {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

/* 필터 버튼 */
.dict__filter {
  display: flex;
  gap: 5px;
  flex-wrap: wrap;
  margin-bottom: 8px;
}
.dict__filter-btn {
  padding: 5px 11px;
  border-radius: 16px;
  border: 1px solid var(--lead2);
  background: var(--surface);
  color: var(--text3);
  font-size: 0.68rem;
  cursor: pointer;
  transition: all 0.15s;
}
.dict__filter-btn--active {
  background: rgba(122,111,183,0.2);
  border-color: var(--pu-base);
  color: var(--text);
}
/* 호스트 전용 이번 게임 필터 */
.dict__filter-btn--host {
  border-color: rgba(212,175,55,0.5);
  color: var(--gold2, #c9a84c);
}
.dict__filter-btn--host.dict__filter-btn--active {
  background: rgba(212,175,55,0.15);
  border-color: var(--gold2, #c9a84c);
  color: var(--gold2, #c9a84c);
}

/* 진영 섹션 */
.dict__section { margin-bottom: 8px; }
.dict__section-title {
  font-size: 0.62rem;
  font-weight: 700;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  padding: 2px 0 5px;
  color: var(--text3);
}
.dict__section-title--townsfolk { color: var(--bl-light); }
.dict__section-title--outsider  { color: var(--tl-light); }
.dict__section-title--minion    { color: var(--rd-light); }
.dict__section-title--demon     { color: var(--rd-light); opacity: 0.85; }

/* 그리드 */
.dict__grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 6px;
}

/* 토큰 버튼 */
.dict__token {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  background: var(--surface);
  border: 1.5px solid transparent;
  border-radius: 10px;
  padding: 8px 4px 6px;
  cursor: pointer;
  transition: transform 0.12s, background 0.12s;
  -webkit-tap-highlight-color: transparent;
}
.dict__token:active { transform: scale(0.91); background: var(--surface2); }
.dict__token--townsfolk { border-color: rgba(46,74,143,0.45); }
.dict__token--outsider  { border-color: rgba(91,179,198,0.45); }
.dict__token--minion    { border-color: rgba(110,27,31,0.45); }
.dict__token--demon     { border-color: rgba(110,27,31,0.65); }

.dict__token-icon {
  width: 46px;
  height: 46px;
  border-radius: 50%;
  overflow: hidden;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.4rem;
  background: var(--surface2);
}
.dict__token-icon img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}
.dict__token-name {
  font-size: 0.6rem;
  color: var(--text2);
  text-align: center;
  line-height: 1.2;
  word-break: keep-all;
}

/* ── 상세 모달 ── */
.dict__overlay {
  position: fixed;
  inset: 0;
  background: rgba(0,0,0,0.72);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 300;
  opacity: 0;
  transition: opacity 0.18s;
  padding: 20px;
}
.dict__overlay--visible { opacity: 1; }

.dict__modal {
  background: var(--surface);
  border-radius: 18px;
  padding: 28px 20px 24px;
  width: 100%;
  max-width: 400px;
  max-height: 78vh;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
  position: relative;
  box-shadow: 0 8px 32px rgba(0,0,0,0.5);
}

.dict__modal-close {
  position: absolute;
  top: 12px;
  right: 12px;
  width: 30px;
  height: 30px;
  border-radius: 50%;
  border: 1px solid var(--lead2);
  background: var(--surface2);
  color: var(--text3);
  font-size: 0.75rem;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  line-height: 1;
}

.dict__modal-icon {
  width: 176px;
  height: 176px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 4.8rem;
  flex-shrink: 0;
  margin-bottom: 2px;
  opacity: 0.72;
}
.dict__modal-icon-img {
  width: 100%;
  height: 100%;
  object-fit: contain;
}

.dict__modal-name {
  font-family: 'Noto Serif KR', serif;
  font-size: 1.45rem;
  font-weight: 700;
  text-align: center;
  line-height: 1.2;
}

.dict__modal-ability {
  background: var(--surface2);
  border: 1px solid var(--lead2);
  border-radius: 8px;
  padding: 16px 18px;
  font-size: 1.0rem;
  color: var(--text2);
  line-height: 1.75;
  text-align: center;
  width: 100%;
}

.dict__modal-rules-btn {
  width: 100%;
  padding: 11px 0;
  border-radius: 8px;
  font-size: 0.82rem;
  margin-top: 2px;
  background: rgba(122,111,183,0.15);
  border: 1px solid var(--pu-base);
  color: var(--text);
  cursor: pointer;
  transition: background 0.15s;
}
.dict__modal-rules-btn:active { background: rgba(122,111,183,0.3); }
  `
  document.head.appendChild(style)
}
