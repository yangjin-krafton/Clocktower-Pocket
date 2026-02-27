/**
 * P-03 RoleCardScreen — 내 역할 카드 (규칙 페이지 표시)
 */
import { RulesScreen } from '../components/RulesScreen.js'
import { ROLES_BY_ID } from '../data/roles-tb.js'

export class RoleCardScreen {
  constructor({ roleId, team }) {
    this.roleId = roleId
    this.team   = team
    this.el     = null
    this.rulesScreen = null
  }

  mount(container) {
    this.el = document.createElement('div')
    this.el.className = 'rolecard-screen'
    this._render()
    container.appendChild(this.el)
  }

  unmount() {
    this.rulesScreen?.unmount()
    this.el?.remove()
  }

  _render() {
    this.el.innerHTML = ''
    const role = ROLES_BY_ID[this.roleId]
    if (!role) {
      // 역할 배정 대기 — 착석 현황은 상단 LobbyBanner가 표시
      this.el.innerHTML = `
        <div class="rolecard-waiting">
          <div class="rolecard-waiting__icon">🏰</div>
          <div class="rolecard-waiting__title">역할 배정 대기 중</div>
          <div class="rolecard-waiting__dot-row">
            <div class="rolecard-waiting__dot"></div>
            <div class="rolecard-waiting__dot" style="animation-delay:0.2s"></div>
            <div class="rolecard-waiting__dot" style="animation-delay:0.4s"></div>
          </div>
          <div class="rolecard-waiting__hint">
            모든 플레이어가 입장하면<br>역할이 자동으로 배정됩니다<br><br>
            <span style="color:var(--text3)">지금 아래 탭에서<br>캐릭터 사전을 미리 확인하세요</span>
          </div>
        </div>
      `
      return
    }

    // 역할의 규칙 페이지를 RulesScreen으로 표시
    const rulePage = `${role.id}.md`
    this.rulesScreen = new RulesScreen({ initialPage: rulePage })
    this.rulesScreen.mount(this.el)
  }
}

if (!document.getElementById('rolecard-screen-style')) {
  const style = document.createElement('style')
  style.id = 'rolecard-screen-style'
  style.textContent = `
.rolecard-screen { display: flex; flex-direction: column; gap: 10px; }
.rolecard-screen__title {
  font-size: 0.62rem;
  font-weight: 700;
  color: var(--text4);
  letter-spacing: 0.08em;
  text-transform: uppercase;
  text-align: center;
  padding-top: 4px;
}
.rolecard-screen__team {
  text-align: center;
  padding: 10px;
  border-radius: 8px;
  font-size: 0.85rem;
  font-weight: 700;
  border: 1px solid;
}
.rolecard-screen__team--good {
  background: rgba(91,179,198,0.1);
  border-color: rgba(91,179,198,0.3);
  color: var(--tl-light);
}
.rolecard-screen__team--evil {
  background: rgba(110,27,31,0.12);
  border-color: rgba(110,27,31,0.4);
  color: var(--rd-light);
}

/* ── 역할 대기 상태 ── */
.rolecard-waiting {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 48px 20px 32px;
  gap: 10px;
  text-align: center;
}
.rolecard-waiting__icon { font-size: 2.8rem; }
.rolecard-waiting__title {
  font-family: 'Noto Serif KR', serif;
  font-size: 1.1rem;
  font-weight: 700;
  color: var(--text);
}
.rolecard-waiting__dot-row {
  display: flex;
  gap: 8px;
  margin: 4px 0;
}
.rolecard-waiting__dot {
  width: 9px; height: 9px;
  border-radius: 50%;
  background: var(--pu-base);
  animation: dot-pulse 1.2s infinite;
}
.rolecard-waiting__hint {
  font-size: 0.68rem;
  color: var(--text4);
  line-height: 1.6;
  margin-top: 4px;
}
  `
  document.head.appendChild(style)
}
