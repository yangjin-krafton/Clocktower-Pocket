/**
 * 참가자 앱 — 오프라인 코드 입력 방식
 *
 * 흐름:
 *   방 코드 + 자리 번호 입력 → 디코딩 → 역할 카드 표시
 *   localStorage 에 마지막 세션 저장 (재방문 시 자동 복원)
 */
import { decodeRoomCode, formatCode } from '../room-code.js'
import { Memo }                       from './Memo.js'
import { CharacterDict }              from './CharacterDict.js'
import { RulesScreen }                from '../components/RulesScreen.js'
import { ROLES_BY_ID }                from '../data/roles-tb.js'
import { ThemeManager }               from '../ThemeManager.js'
import { ovalSlotPos, ovalSelfRotOffset } from '../utils/ovalLayout.js'
import { RoleCardScreen }             from './RoleCardScreen.js'

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
  width: 32px; height: 32px;
  border-radius: 50%;
  background: rgba(0,0,0,0.15);
  border: none;
  color: var(--text3);
  font-size: 1.1rem;
  cursor: pointer;
  display: flex; align-items: center; justify-content: center;
  transition: background 0.15s;
}
.dict__modal-close:hover { background: rgba(0,0,0,0.25); }
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
  }

  init() {
    ThemeManager.set('player')
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

      this._switchTab('seats')
    })

    // URL 코드 자동 시도
    if (urlCode) tryDecode()
    setTimeout(() => codeInput.focus(), 100)
  }

  // ─────────────────────────────────────
  // 자리 배치 탭 — 참가자 뷰 (의심 표시)
  // ─────────────────────────────────────

  _getSuspicions() {
    if (!this.session) return {}
    try { return JSON.parse(localStorage.getItem(`ctp_sus_${this.session.code}`) || '{}') } catch { return {} }
  }

  _setSuspicion(seatNum, mark) {
    if (!this.session) return
    const sus = this._getSuspicions()
    if (mark === null) delete sus[seatNum]
    else sus[seatNum] = mark
    try { localStorage.setItem(`ctp_sus_${this.session.code}`, JSON.stringify(sus)) } catch {}
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

    // 상단: 방 코드 + 자리 번호 배지
    const header = document.createElement('div')
    header.style.cssText = `
      display:flex;align-items:center;justify-content:center;
      padding:8px 16px;background:rgba(212,168,40,0.06);
      border-bottom:1px solid var(--lead2);
    `
    header.innerHTML = `
      <span style="font-size:0.68rem;color:var(--text4)">
        방 <b style="color:var(--gold2);font-family:monospace;letter-spacing:0.1em">${formatCode(this.session.code)}</b>
        &nbsp;·&nbsp; 자리 <b style="color:var(--text2)">${this.session.seatNum}</b>번
      </span>
    `
    this.content.appendChild(header)

    const { playerCount, seatNum: mySeat, roleId } = this.session
    const myRole = ROLES_BY_ID[roleId]

    // 가용 공간 계산: page-content 기준 (padding top 12 + bottom 68 = 80, sub header ~26px)
    const acRect  = document.getElementById('app-content')?.getBoundingClientRect()
    const availW  = acRect?.width  || this.content.getBoundingClientRect().width || 320
    const availH  = (acRect?.height || 520) - 80 - 26
    const ovalW   = Math.floor(Math.min(availW, availH * 2 / 3))
    const ovalH   = Math.floor(ovalW * 1.5)
    const contentH = (acRect?.height || 520) - 80

    const _RX_px    = ovalW * 0.43
    const _minChord = 2 * Math.sin(Math.PI / playerCount) * _RX_px
    const slotPx    = Math.max(36, Math.min(Math.floor(_minChord * 0.82), Math.floor(ovalW * 0.28)))
    const iconPx    = Math.round(slotPx * 0.62)
    const badgeFontPx = Math.max(10, Math.round(slotPx * 0.22))
    const badgeH      = Math.max(17, Math.round(slotPx * 0.25))
    const badgeMinW   = Math.max(18, Math.round(slotPx * 0.38))

    // 내 자리가 6시 방향(하단 중앙)에 오도록 회전 오프셋 계산
    const rotOffset = ovalSelfRotOffset(mySeat, playerCount)

    const MARKS = {
      evil:  { emoji: '🔴', label: '악인 의심', border: 'rgba(200,40,40,0.7)'  },
      watch: { emoji: '👁',  label: '주목',      border: 'rgba(200,150,0,0.7)'  },
      good:  { emoji: '🟢', label: '선 확인',   border: 'rgba(30,150,80,0.7)'  },
      dead:  { emoji: '💀', label: '사망',       border: 'rgba(120,120,120,0.7)'},
    }
    const MY_TEAM_BORDER = {
      townsfolk: 'rgba(46,74,143,0.65)', outsider: 'rgba(91,179,198,0.65)',
      minion: 'rgba(140,40,50,0.65)',    demon: 'rgba(160,30,40,0.9)',
    }

    const el = document.createElement('div')
    el.style.cssText = `display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:${contentH}px;gap:8px;`

    const oval = document.createElement('div')
    oval.id = 'player-seats-oval'
    oval.style.cssText = `position:relative;width:100%;max-width:min(100%,calc((100vh - 186px)*2/3));aspect-ratio:2/3;margin:0 auto;`

    const buildSlot = (i) => {
      const seatNum    = i + 1
      const isOwn      = seatNum === mySeat
      const sus        = this._getSuspicions()
      const mark       = sus[seatNum] || null
      const { x, y }   = ovalSlotPos(i, playerCount, rotOffset)
      const borderColor = isOwn
        ? (MY_TEAM_BORDER[myRole?.team] || 'var(--lead2)')
        : (mark ? MARKS[mark].border : 'var(--lead2)')

      const slot = document.createElement('div')
      slot.id = `pseat-${seatNum}`
      slot.style.cssText = `
        position:absolute;left:${x.toFixed(2)}%;top:${y.toFixed(2)}%;
        width:${slotPx}px;height:${slotPx}px;
        transform:translate(-50%,-50%);
        border-radius:8px;display:flex;flex-direction:column;
        align-items:center;justify-content:center;
        cursor:${isOwn ? 'default' : 'pointer'};
        border:2px solid ${borderColor};
        border-style:${isOwn || mark ? 'solid' : 'dashed'};
        background:${isOwn ? 'var(--surface)' : 'var(--surface2)'};
      `

      const iconEl = document.createElement('div')
      iconEl.style.cssText = `
        width:${iconPx}px;height:${iconPx}px;border-radius:50%;
        background:var(--surface2);overflow:hidden;
        display:flex;align-items:center;justify-content:center;
        font-size:${Math.round(iconPx * 0.58)}px;
      `
      if (isOwn) {
        if (myRole?.icon?.endsWith('.png')) {
          const img = document.createElement('img')
          img.src = `./asset/icons/${myRole.icon}`
          img.style.cssText = 'width:100%;height:100%;object-fit:contain;'
          iconEl.appendChild(img)
        } else { iconEl.textContent = myRole?.iconEmoji || '?' }
      } else if (mark) {
        iconEl.textContent = MARKS[mark].emoji
        iconEl.style.background = 'transparent'
      } else {
        iconEl.innerHTML = `<span style="color:var(--text4);font-size:${Math.round(iconPx*0.4)}px">?</span>`
      }
      slot.appendChild(iconEl)

      if (isOwn) {
        slot.addEventListener('click', () => this._showMyRoleModal())
      } else {
        slot.addEventListener('click', () => this._showSuspicionPicker(seatNum, oval, MARKS))
      }
      return slot
    }

    for (let i = 0; i < playerCount; i++) {
      const slot = buildSlot(i)
      oval.appendChild(slot)

      // 자리 번호 레이블 (슬롯과 중심 사이)
      const seatNum = i + 1
      const isOwn = seatNum === mySeat
      const { x, y } = ovalSlotPos(i, playerCount, rotOffset)
      const labelX = 50 + (x - 50) * 0.55
      const labelY = 50 + (y - 50) * 0.55
      const labelFontPx = Math.max(20, Math.round(slotPx * 0.55))

      const label = document.createElement('div')
      label.style.cssText = `
        position:absolute;left:${labelX.toFixed(2)}%;top:${labelY.toFixed(2)}%;
        transform:translate(-50%,-50%);
        font-size:${labelFontPx}px;font-weight:700;
        color:${isOwn ? 'var(--gold2)' : 'var(--gold2)'};
        pointer-events:none;text-shadow:0 1px 3px rgba(0,0,0,0.5);
        z-index:1;
      `
      label.textContent = seatNum

      oval.appendChild(label)
    }
    el.appendChild(oval)

    const sub = document.createElement('div')
    sub.style.cssText = 'text-align:center;font-size:0.65rem;color:var(--text4);'
    sub.textContent = `${playerCount}인 게임 · 자리 ${mySeat}번 · 다른 자리를 탭해 표시 추가`
    el.appendChild(sub)

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
      border-radius:14px;padding:10px 12px;
      display:flex;flex-direction:column;gap:8px;
      box-shadow:0 4px 24px rgba(0,0,0,0.4);z-index:100;
      min-width:200px;
    `

    const title = document.createElement('div')
    title.style.cssText = 'font-size:0.65rem;color:var(--text4);text-align:center;'
    title.textContent = `자리 ${seatNum}번 표시`
    picker.appendChild(title)

    const btnRow = document.createElement('div')
    btnRow.style.cssText = 'display:flex;gap:6px;flex-wrap:wrap;justify-content:center;'

    Object.entries(MARKS).forEach(([key, { emoji, label }]) => {
      const btn = document.createElement('button')
      btn.style.cssText = 'display:flex;flex-direction:column;align-items:center;gap:2px;padding:6px 10px;border-radius:8px;border:1px solid var(--lead2);background:var(--surface2);cursor:pointer;font-size:1.1rem;min-width:48px;'
      btn.innerHTML = `<span>${emoji}</span><span style="font-size:0.5rem;color:var(--text3)">${label}</span>`
      btn.addEventListener('click', () => {
        this._setSuspicion(seatNum, key)
        picker.remove()
        this._refreshSeatSlot(seatNum, oval, MARKS)
      })
      btnRow.appendChild(btn)
    })

    // 초기화 버튼
    const clearBtn = document.createElement('button')
    clearBtn.style.cssText = 'display:flex;flex-direction:column;align-items:center;gap:2px;padding:6px 10px;border-radius:8px;border:1px solid var(--lead2);background:var(--surface2);cursor:pointer;font-size:1.1rem;min-width:48px;'
    clearBtn.innerHTML = `<span>✕</span><span style="font-size:0.5rem;color:var(--text3)">초기화</span>`
    clearBtn.addEventListener('click', () => {
      this._setSuspicion(seatNum, null)
      picker.remove()
      this._refreshSeatSlot(seatNum, oval, MARKS)
    })
    btnRow.appendChild(clearBtn)

    picker.appendChild(btnRow)
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
  // 나가기
  // ─────────────────────────────────────

  _showMyRoleModal() {
    // 역할 카드를 오버레이로 표시
    const overlay = document.createElement('div')
    overlay.className = 'dict__overlay'
    overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove() })

    const modal = document.createElement('div')
    modal.className = 'dict__modal'

    // 닫기 버튼
    const closeBtn = document.createElement('button')
    closeBtn.className = 'dict__modal-close'
    closeBtn.textContent = '✕'
    closeBtn.addEventListener('click', () => overlay.remove())
    modal.appendChild(closeBtn)

    // 역할 카드 렌더링
    const cardWrap = document.createElement('div')
    cardWrap.style.cssText = 'width:100%;'
    modal.appendChild(cardWrap)

    const screen = new RoleCardScreen({ roleId: this.session.roleId, team: this.session.team })
    screen.mount(cardWrap)

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
    // 세션 초기화 (메모는 localStorage에 남아있음)
    this.session = null
    localStorage.removeItem(STORAGE_KEY)

    // 홈 화면으로
    this.content.innerHTML = ''
    this.tabBar.innerHTML = ''
    this._showJoinForm()
  }
}
