/**
 * 참가자 앱 — 오프라인 코드 입력 방식
 *
 * 흐름:
 *   방 코드 + 자리 번호 입력 → 디코딩 → 역할 카드 표시
 *   localStorage 에 마지막 세션 저장 (재방문 시 자동 복원)
 */
import { decodeRoomCode, formatCode } from '../room-code.js'
import { RoleCardScreen }             from './RoleCardScreen.js'
import { Memo }                       from './Memo.js'
import { CharacterDict }              from './CharacterDict.js'
import { RulesScreen }                from '../components/RulesScreen.js'
import { ROLES_BY_ID }                from '../data/roles-tb.js'

const STORAGE_KEY = 'ctp_player_session'

// 필요한 스타일 주입
if (!document.getElementById('player-app-style')) {
  const s = document.createElement('style')
  s.id = 'player-app-style'
  s.textContent = `
.join-screen {
  display: flex; flex-direction: column; align-items: center;
  padding: 40px 20px 24px; gap: 8px;
}
.join__logo  { font-size: 3rem; }
.join__title {
  font-family: 'Noto Serif KR', serif; font-size: 1.4rem; font-weight: 700;
  color: var(--gold2); text-shadow: 0 0 20px rgba(212,168,40,0.3);
}
.join__sub   { font-size: 0.72rem; color: var(--text3); }
.join__form  { width: 100%; margin-top: 16px; }
.join__field { margin-bottom: 12px; }
.seat-btn {
  min-width: 44px; padding: 10px 6px; border-radius: 6px;
  border: 1px solid var(--lead2); background: var(--surface2);
  color: var(--text3); font-size: 0.88rem; font-weight: 600;
  cursor: pointer; transition: all 0.15s;
}
.seat-btn--active {
  background: rgba(122,111,183,0.25); border-color: var(--pu-base); color: var(--text);
}
  `
  document.head.appendChild(s)
}

export class PlayerApp {
  constructor() {
    this.content  = document.getElementById('app-content')
    this.tabBar   = document.getElementById('tab-bar')

    this.session  = null   // { code, seatNum, roleId, team, playerCount }
    this.currentTab = 'role'
    this.pendingRulesPage = null
    this.screens  = {}
  }

  init() {
    // 저장된 세션 복원 시도
    try {
      const saved = localStorage.getItem(STORAGE_KEY)
      if (saved) {
        const parsed = JSON.parse(saved)
        const decoded = decodeRoomCode(parsed.code)
        if (decoded && parsed.seatNum >= 1 && parsed.seatNum <= decoded.playerCount) {
          this.session = {
            code:        parsed.code,
            seatNum:     parsed.seatNum,
            roleId:      decoded.assignedRoles[parsed.seatNum - 1],
            team:        null,
            playerCount: decoded.playerCount,
          }
          const role = ROLES_BY_ID[this.session.roleId]
          this.session.team = role
            ? (role.team === 'townsfolk' || role.team === 'outsider' ? 'good' : 'evil')
            : 'good'
        }
      }
    } catch {}

    this._buildTabs()
    this._switchTab('role')
  }

  // ─────────────────────────────────────
  // 탭 시스템
  // ─────────────────────────────────────

  _buildTabs() {
    this.tabBar.innerHTML = ''
    const tabs = [
      { id: 'role',  icon: '🎭', label: '내 역할' },
      { id: 'memo',  icon: '📝', label: '메모' },
      { id: 'dict',  icon: '📖', label: '사전' },
      { id: 'rules', icon: '📜', label: '규칙' },
    ]
    tabs.forEach(tab => {
      const btn = document.createElement('button')
      btn.className = 'tab-item' + (tab.id === this.currentTab ? ' active' : '')
      btn.dataset.tab = tab.id
      btn.innerHTML = `<span class="tab-icon">${tab.icon}</span><span class="tab-label">${tab.label}</span>`
      btn.addEventListener('click', () => window.switchTab(tab.id))
      this.tabBar.appendChild(btn)
    })
  }

  _switchTab(tabId) {
    this.currentTab = tabId
    this.content.innerHTML = ''
    this.tabBar.querySelectorAll('.tab-item').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.tab === tabId)
    })

    switch (tabId) {
      case 'role':
        if (this.session) {
          this._showRoleCard()
        } else {
          this._showJoinForm()
        }
        break
      case 'memo':
        const memo = new Memo()
        memo.mount(this.content)
        this.screens.memo = memo
        break
      case 'dict':
        const dict = new CharacterDict({ scriptRoles: null, onRoleClick: (id) => this._openRule(id) })
        dict.mount(this.content)
        break
      case 'rules':
        const initialPage = this.pendingRulesPage || 'index.md'
        this.pendingRulesPage = null
        const rules = new RulesScreen({ initialPage })
        rules.mount(this.content)
        break
    }
  }

  _openRule(roleId) {
    this.pendingRulesPage = `${roleId}.md`
    this._switchTab('rules')
  }

  // ─────────────────────────────────────
  // 역할 카드 화면
  // ─────────────────────────────────────

  _showRoleCard() {
    // 상단: 방 코드 + 자리 번호 배지
    const header = document.createElement('div')
    header.style.cssText = `
      display:flex;align-items:center;justify-content:space-between;
      padding:8px 16px;background:rgba(212,168,40,0.06);
      border-bottom:1px solid var(--lead2);gap:8px;
    `
    header.innerHTML = `
      <span style="font-size:0.68rem;color:var(--text4)">
        방 <b style="color:var(--gold2);font-family:monospace;letter-spacing:0.1em">${formatCode(this.session.code)}</b>
        &nbsp;·&nbsp; 자리 <b style="color:var(--text2)">${this.session.seatNum}</b>번
      </span>
      <button id="player-reset-btn" style="font-size:0.65rem;color:var(--text4);background:none;border:none;cursor:pointer;padding:2px 6px;">나가기</button>
    `
    this.content.appendChild(header)

    header.querySelector('#player-reset-btn').addEventListener('click', () => {
      if (confirm('이 게임에서 나가시겠습니까?')) {
        this._leaveGame()
        window.goHome?.()
      }
    })

    // 역할 카드
    const cardWrap = document.createElement('div')
    cardWrap.style.cssText = 'padding:0;'
    this.content.appendChild(cardWrap)

    const screen = new RoleCardScreen({ roleId: this.session.roleId, team: this.session.team })
    screen.mount(cardWrap)
  }

  _leaveGame() {
    this.session = null
    localStorage.removeItem(STORAGE_KEY)
    this._switchTab('role')
  }

  // ─────────────────────────────────────
  // 참가 폼
  // ─────────────────────────────────────

  _showJoinForm() {
    const urlCode = new URLSearchParams(location.search).get('code') || ''

    const el = document.createElement('div')
    el.className = 'join-screen'
    el.innerHTML = `
      <button id="p-back-btn" style="
        position:absolute;top:12px;left:12px;
        background:none;border:none;cursor:pointer;
        font-size:0.8rem;color:var(--text4);
        display:flex;align-items:center;gap:4px;padding:6px 8px;
        border-radius:8px;
      ">← 홈으로</button>

      <div class="join__logo">🏰</div>
      <h1 class="join__title">Clocktower Pocket</h1>
      <p class="join__sub">방 코드로 입장</p>

      <div class="card join__form">
        <div class="join__field">
          <div class="section-label">방 코드</div>
          <input id="p-code" class="input" type="text"
            placeholder="방 코드 입력 (예: ABCD-EFGH)"
            style="text-transform:uppercase;letter-spacing:0.12em;font-size:1rem;text-align:center;"
            value="${urlCode}" autocomplete="off" autocorrect="off" spellcheck="false">
          <div id="p-code-error" style="font-size:0.68rem;color:var(--rd-light);margin-top:4px;min-height:16px;"></div>
        </div>

        <div class="join__field" id="seat-field" style="display:none">
          <div class="section-label">내 자리 번호</div>
          <div id="seat-grid" style="display:flex;flex-wrap:wrap;gap:6px;margin-top:6px;"></div>
        </div>

        <button id="p-join-btn" class="btn btn-primary btn-full" style="padding:14px;font-size:0.95rem;margin-top:8px;display:none;">
          🎭 역할 확인하기
        </button>
      </div>
    `
    this.content.style.position = 'relative'
    this.content.appendChild(el)

    el.querySelector('#p-back-btn').addEventListener('click', () => window.goHome?.())

    const codeInput   = el.querySelector('#p-code')
    const codeError   = el.querySelector('#p-code-error')
    const seatField   = el.querySelector('#seat-field')
    const seatGrid    = el.querySelector('#seat-grid')
    const joinBtn     = el.querySelector('#p-join-btn')

    let decoded = null
    let selectedSeat = null

    const renderSeats = () => {
      seatGrid.innerHTML = ''
      selectedSeat = null
      joinBtn.style.display = 'none'
      if (!decoded) return
      for (let i = 1; i <= decoded.playerCount; i++) {
        const btn = document.createElement('button')
        btn.className = 'seat-btn'
        btn.textContent = i
        btn.addEventListener('click', () => {
          seatGrid.querySelectorAll('button').forEach(b => b.classList.remove('seat-btn--active'))
          btn.classList.add('seat-btn--active')
          selectedSeat = i
          joinBtn.style.display = ''
        })
        seatGrid.appendChild(btn)
      }
    }

    const tryDecode = () => {
      const raw = codeInput.value.replace(/[^A-Za-z0-9]/g, '').toUpperCase()
      codeError.textContent = ''
      if (raw.length === 0) {
        decoded = null
        seatField.style.display = 'none'
        joinBtn.style.display = 'none'
        return
      }
      const result = decodeRoomCode(raw)
      if (!result) {
        codeError.textContent = '유효하지 않은 방 코드입니다.'
        decoded = null
        seatField.style.display = 'none'
        joinBtn.style.display = 'none'
      } else {
        decoded = result
        seatField.style.display = ''
        renderSeats()
        codeError.textContent = `✓ ${result.playerCount}인 게임 — 자리 번호를 선택하세요`
        codeError.style.color = 'var(--tl-light)'
      }
    }

    codeInput.addEventListener('input', () => {
      codeError.style.color = 'var(--rd-light)'
      tryDecode()
    })

    joinBtn.addEventListener('click', () => {
      if (!decoded || !selectedSeat) return
      const rawCode = codeInput.value.replace(/[^A-Za-z0-9]/g, '').toUpperCase()
      const roleId = decoded.assignedRoles[selectedSeat - 1]
      const role = ROLES_BY_ID[roleId]
      const team = role
        ? (role.team === 'townsfolk' || role.team === 'outsider' ? 'good' : 'evil')
        : 'good'

      this.session = { code: rawCode, seatNum: selectedSeat, roleId, team, playerCount: decoded.playerCount }
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify({ code: rawCode, seatNum: selectedSeat })) } catch {}

      this._switchTab('role')
    })

    // URL 코드 자동 시도
    if (urlCode) tryDecode()
    setTimeout(() => codeInput.focus(), 100)
  }
}
