/**
 * 참가자 앱 — 오프라인 코드 입력 방식
 *
 * 흐름:
 *   방 코드 + 자리 번호 입력 → 디코딩 → 역할 카드 표시
 *   localStorage 에 마지막 세션 저장 (재방문 시 자동 복원)
 */
import { decodeRoomCode, formatCode, copyRoomCode, copyRoomLink } from '../room-code.js'
import { Memo }                       from './Memo.js'
import { CharacterDict }              from './CharacterDict.js'
import { RulesScreen }                from '../components/RulesScreen.js'
import { ROLES_BY_ID }                from '../data/roles-tb.js'
import { ThemeManager }               from '../ThemeManager.js'
import { ovalSlotPos, ovalSelfRotOffset, calcSlotMetrics } from '../utils/ovalLayout.js'
import { TEAM_BORDER, createSeatOval, createSeatSlot, createRoleIconEl, createSeatNumLabel } from '../utils/SeatWheel.js'
import { GameSaveManager }            from '../GameSaveManager.js'

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

/* ── 역할 카드 오버레이 ── */
.dict__overlay {
  position: fixed; inset: 0;
  background: rgba(0,0,0,0.72);
  display: flex; align-items: center; justify-content: center;
  z-index: 300; opacity: 0;
  transition: opacity 0.18s;
  padding: 20px;
}
.dict__overlay--visible { opacity: 1; }

.dict__modal {
  background: var(--surface);
  border-radius: 18px;
  padding: 28px 20px 24px;
  max-width: 480px;
  width: 100%;
  max-height: 85vh;
  overflow-y: auto;
  position: relative;
  box-shadow: 0 8px 32px rgba(0,0,0,0.5);
}

.dict__modal-close {
  position: absolute; top: 12px; right: 12px;
  width: 30px; height: 30px;
  border-radius: 50%;
  border: 1px solid var(--lead2);
  background: var(--surface2);
  color: var(--text3);
  font-size: 0.75rem;
  cursor: pointer;
  display: flex; align-items: center; justify-content: center;
  line-height: 1;
}

.dict__modal-icon {
  width: 176px; height: 176px;
  display: flex; align-items: center; justify-content: center;
  font-size: 4.8rem;
  flex-shrink: 0;
  margin-bottom: 2px;
  opacity: 0.72;
}
.dict__modal-icon-img {
  width: 100%; height: 100%;
  object-fit: contain;
}

.dict__modal-name {
  font-family: 'Noto Serif KR', serif;
  font-size: 1.45rem; font-weight: 700;
  text-align: center; line-height: 1.2;
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
.dict__modal-rules-btn:hover {
  background: rgba(122,111,183,0.25);
}

  `
  document.head.appendChild(s)
}

export class PlayerApp {
  constructor() {
    this.content  = document.getElementById('app-content')
    this.tabBar   = document.getElementById('tab-bar')

    this.session  = null   // { code, seatNum, roleId, team, playerCount }
    this.currentTab = 'seats'
    this.pendingRulesPage = null
    this.screens  = {}
    this.saveId   = null   // 현재 게임 저장 ID
  }

  init() {
    ThemeManager.set('player')
    // 저장된 세션 복원 시도
    try {
      const saved = localStorage.getItem(STORAGE_KEY)
      if (saved) {
        const parsed = JSON.parse(saved)
        const decoded = decodeRoomCode(parsed.code)

        if (parsed.isTraveller && decoded) {
          // 여행자 세션 복원
          this.session = {
            code:        parsed.code,
            seatNum:     null,
            roleId:      parsed.roleId,
            team:        'traveller',
            playerCount: decoded.playerCount,
            isTraveller: true,
          }
          const saves = GameSaveManager.listSaves().filter(s => s.mode === 'player')
          const existingSave = saves.find(s => s.roomCode === parsed.code && s.isTraveller)
          this.saveId = existingSave ? existingSave.id : GameSaveManager.createId()
          if (!existingSave) this._savePlayerGame()
        } else if (decoded && parsed.seatNum >= 1 && parsed.seatNum <= decoded.playerCount) {
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

          const saves = GameSaveManager.listSaves().filter(s => s.mode === 'player')
          const existingSave = saves.find(s => s.roomCode === parsed.code && s.seatNum === parsed.seatNum)
          if (existingSave) {
            this.saveId = existingSave.id
          } else {
            this.saveId = GameSaveManager.createId()
            this._savePlayerGame()
          }
        }
      }
    } catch {}

    this._buildTabs()
    this._switchTab('seats')
  }

  // ─────────────────────────────────────
  // 탭 시스템
  // ─────────────────────────────────────

  _buildTabs() {
    this.tabBar.innerHTML = ''
    const tabs = [
      { id: 'seats', icon: '🪑', label: '자리배치' },
      { id: 'memo',  icon: '📝', label: '메모' },
      { id: 'dict',  icon: '🃏', label: '역할' },
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

    // 게임 참가 중이면 나가기 탭 추가 (가장 오른쪽)
    if (this.session) {
      const exitBtn = document.createElement('button')
      exitBtn.className = 'tab-item tab-item--exit'
      exitBtn.dataset.tab = 'exit'
      exitBtn.innerHTML = `<span class="tab-icon">🏠</span><span class="tab-label">나가기</span>`
      exitBtn.addEventListener('click', () => this._showExitConfirm())
      this.tabBar.appendChild(exitBtn)
    }
  }

  _switchTab(tabId) {
    this.currentTab = tabId
    this.content.innerHTML = ''
    this.tabBar.querySelectorAll('.tab-item').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.tab === tabId)
    })

    switch (tabId) {
      case 'seats':
        if (this.session) {
          this._showSeatLayout()
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
  // 참가 폼
  // ─────────────────────────────────────

  _showJoinForm() {
    const urlCode = new URLSearchParams(location.search).get('code') || ''
    const saves = GameSaveManager.listSaves().filter(s => s.mode === 'player')

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

      ${saves.length > 0 ? `
        <div class="card" style="margin-bottom:8px;width:100%;">
          <div class="section-label">저장된 게임</div>
          <div id="saved-games" style="display:flex;flex-direction:column;gap:6px;margin-top:8px;"></div>
        </div>
      ` : ''}

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

        <button id="p-traveller-btn" class="btn btn-traveller btn-full" style="padding:14px;font-size:0.95rem;margin-top:8px;display:none;">
          🧳 여행자로 입장
        </button>
      </div>
    `
    this.content.style.position = 'relative'
    this.content.appendChild(el)

    el.querySelector('#p-back-btn').addEventListener('click', () => window.goHome?.())

    // 저장된 게임 목록 렌더링
    if (saves.length > 0) {
      const savedGamesEl = el.querySelector('#saved-games')
      saves.forEach(save => {
        const btn = document.createElement('button')
        btn.className = 'btn'
        btn.style.cssText = `
          display:flex;align-items:center;justify-content:space-between;
          padding:10px 12px;background:var(--surface2);
          border:1px solid var(--lead2);border-radius:8px;
          font-size:0.75rem;width:100%;text-align:left;
        `
        const role = ROLES_BY_ID[save.roleId]
        btn.innerHTML = `
          <div style="display:flex;flex-direction:column;gap:2px;">
            <div style="font-weight:700;color:var(--text);">
              ${role?.iconEmoji || '🎭'} ${role?.name || '참가자'} · 자리 ${save.seatNum}번
            </div>
            <div style="font-size:0.62rem;color:var(--text4);">
              방 ${formatCode(save.roomCode)} · ${save.playerCount}인 게임
            </div>
          </div>
          <div style="font-size:0.6rem;color:var(--text4);">
            ${GameSaveManager.formatTimeAgo(save.updatedAt)}
          </div>
        `
        btn.addEventListener('click', () => this._loadPlayerGame(save.id))
        savedGamesEl.appendChild(btn)
      })
    }

    const codeInput   = el.querySelector('#p-code')
    const codeError   = el.querySelector('#p-code-error')
    const seatField   = el.querySelector('#seat-field')
    const seatGrid    = el.querySelector('#seat-grid')
    const joinBtn     = el.querySelector('#p-join-btn')
    const travBtn     = el.querySelector('#p-traveller-btn')

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
        travBtn.style.display = 'none'
        return
      }
      const result = decodeRoomCode(raw)
      if (!result) {
        codeError.textContent = '유효하지 않은 방 코드입니다.'
        decoded = null
        seatField.style.display = 'none'
        joinBtn.style.display = 'none'
        travBtn.style.display = 'none'
      } else {
        decoded = result
        seatField.style.display = ''
        travBtn.style.display = ''
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

      // 게임 저장
      this.saveId = GameSaveManager.createId()
      this._savePlayerGame()

      // 탭바 재구성 (나가기 탭 포함)
      this._buildTabs()
      this._switchTab('seats')
    })

    travBtn.addEventListener('click', () => {
      if (!decoded) return
      const rawCode = codeInput.value.replace(/[^A-Za-z0-9]/g, '').toUpperCase()
      this._showTravellerJoinPicker(rawCode, decoded)
    })

    // URL 코드 자동 시도
    if (urlCode) tryDecode()
    setTimeout(() => codeInput.focus(), 100)
  }

  _showTravellerJoinPicker(rawCode, decoded) {
    const TRAVELLER_ROLES = Object.values(ROLES_BY_ID).filter(r => r.team === 'traveller')

    const overlay = document.createElement('div')
    overlay.className = 'dict__overlay'
    overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove() })

    const modal = document.createElement('div')
    modal.className = 'dict__modal'
    modal.style.padding = '20px 16px'

    const closeBtn = document.createElement('button')
    closeBtn.className = 'dict__modal-close'
    closeBtn.textContent = '✕'
    closeBtn.addEventListener('click', () => overlay.remove())
    modal.appendChild(closeBtn)

    const title = document.createElement('div')
    title.style.cssText = `font-family:'Noto Serif KR',serif;font-size:1.1rem;font-weight:700;color:var(--pu-light);text-align:center;margin-bottom:16px;`
    title.textContent = '🧳 여행자 역할 선택'
    modal.appendChild(title)

    TRAVELLER_ROLES.forEach(role => {
      const row = document.createElement('button')
      row.style.cssText = `
        display:flex;align-items:center;gap:12px;width:100%;
        padding:12px 14px;margin-bottom:8px;border-radius:10px;
        border:1.5px solid rgba(122,111,183,0.3);background:rgba(122,111,183,0.06);
        cursor:pointer;transition:all 0.15s;text-align:left;
      `
      const iconDiv = document.createElement('div')
      iconDiv.style.cssText = 'width:44px;height:44px;border-radius:50%;background:var(--surface2);overflow:hidden;display:flex;align-items:center;justify-content:center;flex-shrink:0;'
      if (role.icon?.endsWith('.webp')) {
        const img = document.createElement('img')
        img.src = `./asset/new/Icon_${role.icon}`
        img.style.cssText = 'width:100%;height:100%;object-fit:contain;'
        iconDiv.appendChild(img)
      } else {
        iconDiv.style.fontSize = '1.5rem'
        iconDiv.textContent = role.iconEmoji || '?'
      }
      row.appendChild(iconDiv)

      const info = document.createElement('div')
      info.style.cssText = 'flex:1;min-width:0;'
      const nameEl = document.createElement('div')
      nameEl.style.cssText = 'font-weight:700;font-size:0.9rem;color:var(--pu-light);'
      nameEl.textContent = role.name
      info.appendChild(nameEl)
      const abilityEl = document.createElement('div')
      abilityEl.style.cssText = 'font-size:0.68rem;color:var(--text3);line-height:1.4;margin-top:2px;overflow:hidden;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;'
      abilityEl.textContent = role.ability
      info.appendChild(abilityEl)
      row.appendChild(info)

      row.addEventListener('click', () => {
        overlay.remove()
        this.session = {
          code: rawCode,
          seatNum: null,
          roleId: role.id,
          team: 'traveller',
          playerCount: decoded.playerCount,
          isTraveller: true,
        }
        try { localStorage.setItem(STORAGE_KEY, JSON.stringify({ code: rawCode, isTraveller: true, roleId: role.id })) } catch {}
        this.saveId = GameSaveManager.createId()
        this._savePlayerGame()
        this._buildTabs()
        this._switchTab('seats')
      })

      modal.appendChild(row)
    })

    overlay.appendChild(modal)
    document.body.appendChild(overlay)
    requestAnimationFrame(() => overlay.classList.add('dict__overlay--visible'))
  }

  // ─────────────────────────────────────
  // 자리 배치 탭 — 참가자 뷰 (의심 표시)
  // ─────────────────────────────────────

  _getSuspicions() {
    if (!this.session) return {}
    try {
      const sus = JSON.parse(localStorage.getItem(`ctp_sus_${this.session.code}`) || '{}')
      // 유효하지 않은 마크 제거 (MARKS에 없는 키)
      const validMarks = ['evil', 'good', 'watch', 'poison', 'drunk']
      Object.keys(sus).forEach(key => {
        if (!validMarks.includes(sus[key])) {
          delete sus[key]
        }
      })
      return sus
    } catch { return {} }
  }

  _setSuspicion(seatNum, mark) {
    if (!this.session) return
    const sus = this._getSuspicions()
    // 같은 마크를 다시 클릭하면 제거 (토글)
    if (sus[seatNum] === mark) {
      delete sus[seatNum]
    } else if (mark === null) {
      delete sus[seatNum]
    } else {
      sus[seatNum] = mark
    }
    try { localStorage.setItem(`ctp_sus_${this.session.code}`, JSON.stringify(sus)) } catch {}
  }

  // ─────────────────────────────────────
  // 여행자 메모 (로컬 전용)
  // ─────────────────────────────────────

  _getTravellers() {
    if (!this.session) return []
    try {
      return JSON.parse(localStorage.getItem(`ctp_travellers_${this.session.code}`) || '[]')
    } catch { return [] }
  }

  _saveTravellers(travellers) {
    if (!this.session) return
    try { localStorage.setItem(`ctp_travellers_${this.session.code}`, JSON.stringify(travellers)) } catch {}
  }

  _showSeatLayout() {
    if (!this.session) {
      this.content.innerHTML = `
        <div style="text-align:center;padding:60px 20px;color:var(--text3)">
          <div style="font-size:2rem;margin-bottom:12px">🪑</div>
          <div>게임 참가 후 이용 가능합니다</div>
        </div>`
      return
    }

    // 상단: 방 코드 / 자리 번호 / 링크
    const headerRow = document.createElement('div')
    headerRow.style.cssText = `
      display:flex;align-items:stretch;gap:6px;
      padding:8px 10px 0;
    `

    const makeTopCard = ({ flex = '0 0 auto', minWidth = '0', mainHtml, hintText, onCopy }) => {
      const card = document.createElement('div')
      card.style.cssText = `
        flex:${flex};min-width:${minWidth};
        display:flex;flex-direction:column;align-items:center;justify-content:center;
        background:var(--surface2);border:1.5px solid rgba(212,168,40,0.45);
        border-radius:12px;padding:10px 12px;cursor:pointer;gap:4px;
        transition:border-color 0.15s;-webkit-tap-highlight-color:transparent;
      `
      const main = document.createElement('div')
      main.innerHTML = mainHtml
      const hint = document.createElement('div')
      hint.style.cssText = 'font-size:0.52rem;color:var(--text4);white-space:nowrap;'
      hint.textContent = hintText
      card.appendChild(main)
      card.appendChild(hint)
      if (onCopy) {
        card.addEventListener('click', async () => {
          const copied = await onCopy()
          hint.textContent = copied ? '✓ 복사!' : '복사 실패'
          card.style.borderColor = copied ? 'var(--tl-base)' : 'var(--rd-light)'
          setTimeout(() => {
            hint.textContent = hintText
            card.style.borderColor = 'rgba(212,168,40,0.45)'
          }, 1500)
        })
      } else {
        card.style.cursor = 'default'
      }
      return card
    }

    const formattedCode = formatCode(this.session.code)
    const seatNum = this.session.seatNum
    const isTraveller = !!this.session.isTraveller

    headerRow.appendChild(makeTopCard({
      flex: '1 1 auto',
      minWidth: '0',
      mainHtml: `<div style="font-size:1rem;font-weight:900;letter-spacing:0.14em;color:var(--gold2);font-family:monospace;line-height:1.2;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${formattedCode}</div>`,
      hintText: '방 코드 복사',
      onCopy: () => copyRoomCode(this.session.code),
    }))

    if (isTraveller) {
      const travRole = ROLES_BY_ID[this.session.roleId]
      const roleCard = makeTopCard({
        flex: '0 0 auto',
        mainHtml: `<div style="font-size:1rem;line-height:1;">${travRole?.iconEmoji || '🧳'}</div><div style="font-size:0.75rem;font-weight:700;color:var(--pu-light);line-height:1;">${travRole?.name || '여행자'}</div>`,
        hintText: '탭=역할 보기',
        onCopy: null,
      })
      roleCard.style.cursor = 'pointer'
      roleCard.addEventListener('click', () => this._showMyRoleModal())
      headerRow.appendChild(roleCard)
    } else {
      headerRow.appendChild(makeTopCard({
        flex: '0 0 auto',
        mainHtml: `<div style="font-size:0.62rem;color:var(--text4);margin-bottom:1px;">자리</div><div style="font-size:1rem;font-weight:800;color:var(--text2);line-height:1;">${seatNum}번</div>`,
        hintText: '내 번호',
        onCopy: null,
      }))
    }

    headerRow.appendChild(makeTopCard({
      flex: '0 0 auto',
      mainHtml: `<div style="font-size:1.15rem;line-height:1;">🔗</div>`,
      hintText: '링크 복사',
      onCopy: () => copyRoomLink(this.session.code),
    }))

    this.content.appendChild(headerRow)

    // 안내 문구 (상단 바 바로 아래) - 30% 축소
    const sub = document.createElement('div')
    sub.style.cssText = 'text-align:center;font-size:0.91rem;color:var(--text4);padding:8px 16px;'
    sub.textContent = `다른 자리를 탭해 표시 추가`
    this.content.appendChild(sub)

    const { playerCount, seatNum: mySeat, roleId, isTraveller: isTravellerSession } = this.session
    const myRole = isTravellerSession ? null : ROLES_BY_ID[roleId]
    const travellers = this._getTravellers()

    // 위치 기반 정렬: 일반 좌석 사이에 여행자를 끼워넣기
    const orderedSlots = []
    for (let s = 1; s <= playerCount; s++) {
      orderedSlots.push({ type: 'player', seatNum: s })
      travellers.forEach((t, tIdx) => {
        if ((t.afterSeat || playerCount) === s) {
          orderedSlots.push({ type: 'traveller', tIdx, roleId: t.roleId })
        }
      })
    }
    const totalSlots = orderedSlots.length

    // 가용 공간 계산: page-content 기준
    // padding (12 + 68 = 80) + header (~36px) + sub (~30px) = 146px
    const acRect  = document.getElementById('app-content')?.getBoundingClientRect()
    const availW  = acRect?.width  || this.content.getBoundingClientRect().width || 320
    const reservedH = 146  // page-content padding + header + sub
    const availH  = (acRect?.height || 520) - reservedH
    const ovalW   = Math.floor(Math.min(availW, availH * 2 / 3))
    const ovalH   = Math.floor(ovalW * 1.5)
    const contentH = availH

    const { slotPx, iconPx } = calcSlotMetrics(totalSlots, ovalW)
    const badgeFontPx = Math.max(10, Math.round(slotPx * 0.22))
    const badgeH      = Math.max(17, Math.round(slotPx * 0.25))
    const badgeMinW   = Math.max(18, Math.round(slotPx * 0.38))

    // 내 자리가 6시 방향(하단 중앙)에 오도록 회전 오프셋 계산
    const mySlotIndex = mySeat ? orderedSlots.findIndex(s => s.type === 'player' && s.seatNum === mySeat) : -1
    const rotOffset = mySlotIndex >= 0
      ? ovalSelfRotOffset(mySlotIndex + 1, totalSlots)
      : -Math.PI / 2  // 여행자: 12시 방향 기본

    const MARKS = {
      evil:   { emoji: '❤️', border: 'rgba(200,40,40,0.7)'   },
      good:   { emoji: '💙', border: 'rgba(40,100,200,0.7)'  },
      watch:  { emoji: '🎭', border: 'rgba(200,150,0,0.7)'   },
      poison: { emoji: '🦠', border: 'rgba(100,200,80,0.7)'  },
      drunk:  { emoji: '🍺', border: 'rgba(180,120,60,0.7)'  },
    }
    const el = document.createElement('div')
    el.style.cssText = `display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:${contentH}px;gap:8px;position:relative;`

    // 여행자 추가 버튼 (좌측 상단)
    const addTravBtn = document.createElement('button')
    addTravBtn.className = 'traveller-add-btn'
    addTravBtn.style.cssText = 'position:absolute;top:0;left:10px;z-index:10;'
    addTravBtn.innerHTML = `<span>🧳</span> 여행자 추가`
    addTravBtn.addEventListener('click', () => this._showTravellerPicker())
    el.appendChild(addTravBtn)

    const oval = createSeatOval(`width:100%;max-width:min(100%,calc((100vh - 186px)*2/3));aspect-ratio:2/3;margin:0 auto;`)
    oval.id = 'player-seats-oval'

    const buildSlot = (i) => {
      const entry     = orderedSlots[i]
      const { x, y } = ovalSlotPos(i, totalSlots, rotOffset)

      // ── 여행자 슬롯 ──
      if (entry.type === 'traveller') {
        const travRole = ROLES_BY_ID[entry.roleId]
        const slot = createSeatSlot(x, y, slotPx, {
          borderColor: 'rgba(122,111,183,0.7)',
          borderWidth: 2,
          borderStyle: 'solid',
          background: 'rgba(122,111,183,0.08)',
        })
        slot.id = `pseat-t${entry.tIdx}`
        slot.appendChild(createRoleIconEl(travRole, iconPx))
        slot.addEventListener('click', () => this._showTravellerSlotMenu(entry.tIdx))
        return slot
      }

      // ── 일반 슬롯 ──
      const seatNum    = entry.seatNum
      const isOwn      = seatNum === mySeat
      const sus        = this._getSuspicions()
      const mark       = sus[seatNum] || null
      const borderColor = isOwn
        ? (TEAM_BORDER[myRole?.team] || 'var(--lead2)')
        : (mark && MARKS[mark] ? MARKS[mark].border : 'var(--lead2)')

      const slot = createSeatSlot(x, y, slotPx, {
        borderColor,
        borderWidth: 2,
        borderStyle: (isOwn || (mark && MARKS[mark])) ? 'solid' : 'dashed',
        cursor:      isOwn ? 'default' : undefined,
        background:  isOwn ? undefined : 'var(--surface2)',
      })
      slot.id = `pseat-${seatNum}`

      if (isOwn) {
        slot.appendChild(createRoleIconEl(myRole, iconPx))
      } else if (mark && MARKS[mark]) {
        const iconEl = document.createElement('div')
        iconEl.style.cssText = `width:${iconPx}px;height:${iconPx}px;border-radius:50%;background:transparent;display:flex;align-items:center;justify-content:center;font-size:${Math.round(iconPx * 0.58)}px;`
        iconEl.textContent = MARKS[mark].emoji
        slot.appendChild(iconEl)
      } else {
        slot.appendChild(createRoleIconEl(null, iconPx, { fallbackEmoji: '?' }))
      }

      if (isOwn) {
        slot.addEventListener('click', () => this._showMyRoleModal())
      } else {
        slot.addEventListener('click', () => this._showSuspicionPicker(seatNum, oval, MARKS))
      }
      return slot
    }

    for (let i = 0; i < totalSlots; i++) {
      const { x, y } = ovalSlotPos(i, totalSlots, rotOffset)
      oval.appendChild(buildSlot(i))
      const entry = orderedSlots[i]
      const label = entry.type === 'player' ? entry.seatNum : `T${entry.tIdx + 1}`
      oval.appendChild(createSeatNumLabel(x, y, slotPx, label))
    }
    el.appendChild(oval)

    this.content.appendChild(el)
  }

  _showSuspicionPicker(seatNum, oval, MARKS) {
    document.getElementById('sus-picker')?.remove()

    const picker = document.createElement('div')
    picker.id = 'sus-picker'
    picker.style.cssText = `
      position:fixed;bottom:calc(var(--tab-h,56px) + 8px);left:50%;
      transform:translateX(-50%);
      background:var(--surface);border:1px solid var(--lead2);
      border-radius:14px;padding:10px;
      display:flex;gap:6px;
      box-shadow:0 4px 24px rgba(0,0,0,0.4);z-index:100;
    `

    // 5개 버튼 (이모지만 표시)
    Object.entries(MARKS).forEach(([key, { emoji }]) => {
      const btn = document.createElement('button')
      btn.style.cssText = `
        display:flex;align-items:center;justify-content:center;
        width:48px;height:48px;
        border-radius:50%;
        border:2px solid var(--lead2);
        background:var(--surface2);
        cursor:pointer;
        font-size:1.5rem;
        transition:transform 0.15s, border-color 0.15s;
      `
      btn.textContent = emoji
      btn.addEventListener('click', () => {
        this._setSuspicion(seatNum, key)
        picker.remove()
        this._refreshSeatSlot(seatNum, oval, MARKS)
      })
      btn.addEventListener('mousedown', () => {
        btn.style.transform = 'scale(0.9)'
      })
      btn.addEventListener('mouseup', () => {
        btn.style.transform = 'scale(1)'
      })
      picker.appendChild(btn)
    })

    // 초기화 버튼 제거 (5개만 유지)
    // 더블탭으로 제거하거나, 같은 버튼 다시 탭하면 제거되도록 할 수 있음
    document.body.appendChild(picker)

    // 외부 탭 → 닫기
    setTimeout(() => {
      const close = (e) => { if (!picker.contains(e.target)) { picker.remove(); document.removeEventListener('click', close) } }
      document.addEventListener('click', close)
    }, 50)
  }

  _refreshSeatSlot(seatNum, oval, MARKS) {
    // 전체 다시 그리기 대신 해당 슬롯만 교체
    this._switchTab('seats')
  }

  // ─────────────────────────────────────
  // 여행자 추가/관리 UI
  // ─────────────────────────────────────

  _showTravellerPicker() {
    document.getElementById('traveller-picker')?.remove()

    const { playerCount } = this.session
    const TRAVELLER_ROLES = Object.values(ROLES_BY_ID).filter(r => r.team === 'traveller')

    const overlay = document.createElement('div')
    overlay.id = 'traveller-picker'
    overlay.className = 'dict__overlay'
    overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove() })

    const modal = document.createElement('div')
    modal.className = 'dict__modal'
    modal.style.padding = '20px 16px'

    const closeBtn = document.createElement('button')
    closeBtn.className = 'dict__modal-close'
    closeBtn.textContent = '✕'
    closeBtn.addEventListener('click', () => overlay.remove())
    modal.appendChild(closeBtn)

    // ── Step 1: 역할 선택 ──
    const showRoleStep = () => {
      while (modal.children.length > 1) modal.removeChild(modal.lastChild)

      const title = document.createElement('div')
      title.style.cssText = `
        font-family:'Noto Serif KR',serif;font-size:1.1rem;font-weight:700;
        color:var(--pu-light);text-align:center;margin-bottom:16px;
      `
      title.textContent = '🧳 여행자 추가'
      modal.appendChild(title)

      TRAVELLER_ROLES.forEach(role => {
        const row = document.createElement('button')
        row.style.cssText = `
          display:flex;align-items:center;gap:12px;width:100%;
          padding:12px 14px;margin-bottom:8px;
          border-radius:10px;border:1.5px solid rgba(122,111,183,0.3);
          background:rgba(122,111,183,0.06);cursor:pointer;
          transition:all 0.15s;text-align:left;
        `

        const iconDiv = document.createElement('div')
        iconDiv.style.cssText = `
          width:44px;height:44px;border-radius:50%;
          background:var(--surface2);overflow:hidden;
          display:flex;align-items:center;justify-content:center;flex-shrink:0;
        `
        if (role.icon?.endsWith('.webp')) {
          const img = document.createElement('img')
          img.src = `./asset/new/Icon_${role.icon}`
          img.style.cssText = 'width:100%;height:100%;object-fit:contain;'
          iconDiv.appendChild(img)
        } else {
          iconDiv.style.fontSize = '1.5rem'
          iconDiv.textContent = role.iconEmoji || '?'
        }
        row.appendChild(iconDiv)

        const info = document.createElement('div')
        info.style.cssText = 'flex:1;min-width:0;'
        const nameEl = document.createElement('div')
        nameEl.style.cssText = 'font-weight:700;font-size:0.9rem;color:var(--pu-light);'
        nameEl.textContent = role.name
        info.appendChild(nameEl)
        const abilityEl = document.createElement('div')
        abilityEl.style.cssText = 'font-size:0.68rem;color:var(--text3);line-height:1.4;margin-top:2px;overflow:hidden;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;'
        abilityEl.textContent = role.ability
        info.appendChild(abilityEl)
        row.appendChild(info)

        row.addEventListener('click', () => showPositionStep(role))
        modal.appendChild(row)
      })
    }

    // ── Step 2: 위치 선택 (현재 원탁 상태 반영) ──
    const showPositionStep = (role) => {
      while (modal.children.length > 1) modal.removeChild(modal.lastChild)

      const header = document.createElement('div')
      header.style.cssText = 'text-align:center;margin-bottom:14px;'
      header.innerHTML = `
        <div style="font-family:'Noto Serif KR',serif;font-size:1rem;font-weight:700;color:var(--pu-light);">
          ${role.iconEmoji || '🧳'} ${role.name}
        </div>
        <div style="font-size:0.78rem;color:var(--text3);margin-top:4px;">어디에 앉나요?</div>
      `
      modal.appendChild(header)

      // 현재 원탁 순서 (기존 여행자 포함) 구축
      const curTravellers = this._getTravellers()
      const circle = []
      for (let s = 1; s <= playerCount; s++) {
        circle.push({ type: 'player', seatNum: s, label: `${s}번` })
        curTravellers.forEach((t, tIdx) => {
          if ((t.afterSeat || playerCount) === s) {
            const tRole = ROLES_BY_ID[t.roleId]
            circle.push({ type: 'traveller', tIdx, label: `${tRole?.iconEmoji || '🧳'}${tRole?.name || '?'}` })
          }
        })
      }

      const grid = document.createElement('div')
      grid.style.cssText = 'display:flex;flex-wrap:wrap;gap:6px;justify-content:center;'

      for (let i = 0; i < circle.length; i++) {
        const left  = circle[i]
        const right = circle[(i + 1) % circle.length]

        const btn = document.createElement('button')
        btn.style.cssText = `
          padding:10px 14px;border-radius:8px;
          border:1.5px solid rgba(122,111,183,0.3);
          background:rgba(122,111,183,0.06);cursor:pointer;
          font-size:0.8rem;font-weight:600;color:var(--text2);
          transition:all 0.15s;white-space:nowrap;
        `
        btn.textContent = `${left.label} — ${right.label} 사이`

        btn.addEventListener('click', () => {
          let afterSeat, insertIdx
          if (left.type === 'player') {
            afterSeat = left.seatNum
            const firstSame = curTravellers.findIndex(t => (t.afterSeat || playerCount) === afterSeat)
            insertIdx = firstSame >= 0 ? firstSame : curTravellers.length
          } else {
            afterSeat = curTravellers[left.tIdx].afterSeat || playerCount
            insertIdx = left.tIdx + 1
          }
          curTravellers.splice(insertIdx, 0, { roleId: role.id, afterSeat })
          this._saveTravellers(curTravellers)
          overlay.remove()
          this._switchTab('seats')
        })
        grid.appendChild(btn)
      }
      modal.appendChild(grid)

      const backBtn = document.createElement('button')
      backBtn.style.cssText = `
        display:block;margin:14px auto 0;padding:8px 20px;
        border-radius:8px;border:1px solid var(--lead2);
        background:var(--surface2);cursor:pointer;
        font-size:0.75rem;color:var(--text3);
      `
      backBtn.textContent = '← 역할 다시 선택'
      backBtn.addEventListener('click', () => showRoleStep())
      modal.appendChild(backBtn)
    }

    showRoleStep()

    overlay.appendChild(modal)
    document.body.appendChild(overlay)
    requestAnimationFrame(() => overlay.classList.add('dict__overlay--visible'))
  }

  _showTravellerSlotMenu(travellerIndex) {
    const travellers = this._getTravellers()
    const traveller = travellers[travellerIndex]
    if (!traveller) return

    const role = ROLES_BY_ID[traveller.roleId]
    if (!role) return

    document.getElementById('traveller-menu')?.remove()

    const overlay = document.createElement('div')
    overlay.id = 'traveller-menu'
    overlay.className = 'dict__overlay'
    overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove() })

    const modal = document.createElement('div')
    modal.className = 'dict__modal'

    const closeBtn = document.createElement('button')
    closeBtn.className = 'dict__modal-close'
    closeBtn.textContent = '✕'
    closeBtn.addEventListener('click', () => overlay.remove())
    modal.appendChild(closeBtn)

    // 아이콘
    const iconWrap = document.createElement('div')
    iconWrap.className = 'dict__modal-icon'
    if (role.icon?.endsWith('.webp')) {
      const img = document.createElement('img')
      img.src = `./asset/new/Icon_${role.icon}`
      img.alt = role.name
      img.className = 'dict__modal-icon-img'
      iconWrap.appendChild(img)
    } else {
      iconWrap.textContent = role.iconEmoji || '?'
    }
    modal.appendChild(iconWrap)

    // 역할명
    const nameEl = document.createElement('div')
    nameEl.className = 'dict__modal-name'
    nameEl.style.color = 'var(--pu-light)'
    nameEl.textContent = role.name
    modal.appendChild(nameEl)

    // 여행자 배지
    const badge = document.createElement('span')
    badge.className = 'badge badge-traveller'
    badge.textContent = '여행자'
    modal.appendChild(badge)

    // 위치 정보
    const { playerCount } = this.session
    const afterSeat = traveller.afterSeat || playerCount
    const nextSeat = afterSeat < playerCount ? afterSeat + 1 : 1
    const posInfo = document.createElement('div')
    posInfo.style.cssText = 'font-size:0.72rem;color:var(--text3);text-align:center;margin-top:4px;'
    posInfo.textContent = `📍 ${afterSeat}번 — ${nextSeat}번 사이`
    modal.appendChild(posInfo)

    // 능력 설명
    if (role.ability) {
      const abilityEl = document.createElement('div')
      abilityEl.className = 'dict__modal-ability'
      abilityEl.textContent = role.ability
      modal.appendChild(abilityEl)
    }

    // 삭제 버튼
    const delBtn = document.createElement('button')
    delBtn.className = 'btn'
    delBtn.style.cssText = `
      width:100%;padding:11px 0;border-radius:8px;font-size:0.82rem;
      margin-top:8px;background:rgba(200,40,40,0.15);
      border:1px solid rgba(200,40,40,0.4);color:var(--rd-light);cursor:pointer;
    `
    delBtn.textContent = '🗑 여행자 제거'
    delBtn.addEventListener('click', () => {
      travellers.splice(travellerIndex, 1)
      this._saveTravellers(travellers)
      overlay.remove()
      this._switchTab('seats')
    })
    modal.appendChild(delBtn)

    // 규칙 바로가기
    const rulesBtn = document.createElement('button')
    rulesBtn.className = 'btn dict__modal-rules-btn'
    rulesBtn.innerHTML = '📜 규칙에서 자세히 보기'
    rulesBtn.addEventListener('click', () => {
      overlay.remove()
      this._openRule(role.id)
    })
    modal.appendChild(rulesBtn)

    overlay.appendChild(modal)
    document.body.appendChild(overlay)
    requestAnimationFrame(() => overlay.classList.add('dict__overlay--visible'))
  }

  // ─────────────────────────────────────
  // 나가기
  // ─────────────────────────────────────

  _showMyRoleModal() {
    const role = ROLES_BY_ID[this.session.roleId]
    if (!role) return

    const TEAM_COLOR = { townsfolk: 'var(--bl-light)', outsider: 'var(--tl-light)', minion: 'var(--rd-light)', demon: 'var(--rd-light)', traveller: 'var(--pu-light)' }
    const TEAM_LABEL = { townsfolk: '마을 주민', outsider: '아웃사이더', minion: '미니언', demon: '임프', traveller: '여행자' }
    const BADGE_CLASS = { townsfolk: 'badge-town', outsider: 'badge-outside', minion: 'badge-minion', demon: 'badge-demon', traveller: 'badge-traveller' }

    // 역할 카드를 오버레이로 표시 (CharacterDict와 동일한 UI)
    const overlay = document.createElement('div')
    overlay.className = 'dict__overlay'
    overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove() })

    const modal = document.createElement('div')
    modal.className = 'dict__modal'

    // ── 닫기 버튼 ──
    const closeBtn = document.createElement('button')
    closeBtn.className = 'dict__modal-close'
    closeBtn.textContent = '✕'
    closeBtn.addEventListener('click', () => overlay.remove())
    modal.appendChild(closeBtn)

    // ── 큰 아이콘 ──
    const iconWrap = document.createElement('div')
    iconWrap.className = 'dict__modal-icon'
    if (role.icon?.endsWith('.webp')) {
      const img = document.createElement('img')
      img.src = `./asset/new/Icon_${role.icon}`
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
    const rulesBtn = document.createElement('button')
    rulesBtn.className = 'btn dict__modal-rules-btn'
    rulesBtn.innerHTML = '📜 규칙에서 자세히 보기'
    rulesBtn.addEventListener('click', () => {
      overlay.remove()
      this._openRule(role.id)
    })
    modal.appendChild(rulesBtn)

    overlay.appendChild(modal)
    document.body.appendChild(overlay)

    requestAnimationFrame(() => overlay.classList.add('dict__overlay--visible'))
  }

  _showExitConfirm() {
    const overlay = document.createElement('div')
    overlay.className = 'popup-overlay'
    const box = document.createElement('div')
    box.className = 'popup-box'
    box.style.textAlign = 'center'
    box.innerHTML = `
      <div style="font-size:2rem;margin-bottom:12px">🏠</div>
      <div style="font-family:'Noto Serif KR',serif;font-size:1rem;font-weight:700;color:var(--gold2);margin-bottom:8px">게임 나가기</div>
      <div style="font-size:0.78rem;color:var(--text2);margin-bottom:16px;line-height:1.5">게임에서 나가시겠습니까?<br>저장된 메모는 유지됩니다.</div>
      <div class="btn-grid-2">
        <button class="btn" id="exit-cancel">취소</button>
        <button class="btn btn-gold" id="exit-confirm">나가기</button>
      </div>
    `
    overlay.appendChild(box)
    overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove() })
    document.body.appendChild(overlay)

    box.querySelector('#exit-cancel').addEventListener('click', () => overlay.remove())
    box.querySelector('#exit-confirm').addEventListener('click', () => {
      overlay.remove()
      this.exitToHome()
    })
  }

  exitToHome() {
    // 게임 저장 (나가기 전)
    this._savePlayerGame()

    // 세션 초기화 (메모는 localStorage에 남아있음)
    this.session = null
    this.saveId = null
    localStorage.removeItem(STORAGE_KEY)

    // 홈 화면으로
    this.content.innerHTML = ''
    this.tabBar.innerHTML = ''
    this._showJoinForm()
  }

  // ─────────────────────────────────────
  // 게임 저장/로드
  // ─────────────────────────────────────

  _savePlayerGame() {
    if (!this.session || !this.saveId) return

    const saveData = {
      meta: {
        mode: 'player',
        playerCount: this.session.playerCount,
        roomCode: this.session.code,
        seatNum: this.session.seatNum,
        roleId: this.session.roleId,
        isTraveller: this.session.isTraveller || false,
      },
      code: this.session.code,
      seatNum: this.session.seatNum,
      roleId: this.session.roleId,
      team: this.session.team,
      playerCount: this.session.playerCount,
      isTraveller: this.session.isTraveller || false,
    }

    GameSaveManager.save(this.saveId, saveData)
  }

  _loadPlayerGame(saveId) {
    const saveData = GameSaveManager.load(saveId)
    if (!saveData) {
      alert('저장된 게임을 불러올 수 없습니다.')
      return
    }

    // 방 코드 검증
    const decoded = decodeRoomCode(saveData.code)
    if (!decoded) {
      alert('저장된 방 코드가 유효하지 않습니다.')
      return
    }

    // 세션 복원
    this.session = {
      code: saveData.code,
      seatNum: saveData.seatNum,
      roleId: saveData.roleId,
      team: saveData.team,
      playerCount: saveData.playerCount,
    }
    this.saveId = saveId

    try { localStorage.setItem(STORAGE_KEY, JSON.stringify({ code: saveData.code, seatNum: saveData.seatNum })) } catch {}

    this._buildTabs()
    this._switchTab('seats')
  }
}
