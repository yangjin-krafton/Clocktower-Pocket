/**
 * 호스트 앱 — 진입점 (오프라인 전용)
 *
 * 흐름:
 *   진입 → 즉시 Grimoire (lobby phase)
 *          Grimoire 안에서: 인원/역할 설정 · 게임 시작 버튼
 *          호스트가 "게임 시작" 누르면 → 역할 배정 → 밤 페이즈 시작
 */
import { engine }                               from '../game-engine.js'
import { RulesScreen }                          from '../components/RulesScreen.js'
import { Grimoire }                             from './Grimoire.js'
import { NightAction }                          from './NightAction.js'
import { DayFlow }                              from './DayFlow.js'
import { Victory }                              from './Victory.js'
import { HistoryManager }                       from './HistoryManager.js'
import { HistoryBar }                           from './HistoryBar.js'
import { ROLES_TB, ROLES_BY_ID, PLAYER_COUNTS } from '../data/roles-tb.js'
import { encodeRoomCode, formatCode, copyRoomCode, copyRoomLink } from '../room-code.js'
import { GameSaveManager }                      from '../GameSaveManager.js'
import { ThemeManager }                         from '../ThemeManager.js'
import { calcOvalLayout, ovalSlotPos } from '../utils/ovalLayout.js'
import { createSeatOval, createSeatNumLabel, buildOvalSlots } from '../utils/SeatWheel.js'


const DEFAULT_PLAYER_COUNT = 7

export class HostApp {
  constructor() {
    this.currentScreen  = null
    this.nightAction    = null
    this.doneSteps      = []
    this.container      = document.getElementById('app-content')
    this.tabBar         = document.getElementById('tab-bar')

    this.pendingPlayerCount = DEFAULT_PLAYER_COUNT
    this.seatRoles          = new Array(DEFAULT_PLAYER_COUNT).fill(null)  // 자리별 역할 ID
    this.drunkAsRole        = null   // 주정뱅이가 믿는 마을 주민 역할 ID
    this._gameStarting      = false
    this._grimoire          = null
    this.currentTab         = 'role'
    this._lastRoomCode      = null

    // 히스토리 시스템
    this._history    = new HistoryManager()
    this._historyBar = new HistoryBar(this._history)
    this._viewerOverlay = null  // 열람 모드 오버레이

    // 저장 시스템
    this._saveId = null
    this._saveDebounce = null

    // 열람 모드 전환 구독
    this._history.on('navigate', (entry) => this._onHistoryNavigate(entry))
  }

  init() {
    ThemeManager.set('host')
    engine.reset()                                           // 이전 게임 상태 초기화
    this.pendingPlayerCount = DEFAULT_PLAYER_COUNT
    this.seatRoles          = new Array(DEFAULT_PLAYER_COUNT).fill(null)
    this.drunkAsRole        = null
    this._gameStarting      = false
    this._lastRoomCode      = null
    this._history.reset()
    this._historyBar.hide()
    this._buildTabs()
    this._switchTab('role')
  }

  /**
   * 세이브 데이터로부터 게임 복원 후 진입
   * @param {string} saveId  GameSaveManager 슬롯 ID
   */
  initFromSave(saveId) {
    ThemeManager.set('host')
    const data = GameSaveManager.load(saveId)
    if (!data) {
      this.init()
      return
    }

    this._saveId = saveId

    // engine 복원
    engine.reset()
    engine.restore(data.engineData)

    // 호스트 상태 복원
    const hs = data.hostState || {}
    this.seatRoles          = hs.seatRoles || new Array(DEFAULT_PLAYER_COUNT).fill(null)
    this.drunkAsRole        = hs.drunkAsRole || null
    this.pendingPlayerCount = hs.pendingPlayerCount || this.seatRoles.length
    this._lastRoomCode      = hs.roomCode || null
    this.doneSteps          = hs.doneSteps || []
    this._gameStarting      = true

    // 히스토리 복원
    this._history.restore(data.historyData)

    // HistoryBar 마운트
    this._mountHistoryBar()

    // 탭 빌드 후 현재 phase에 맞는 화면 표시
    this._buildTabs()
    this.currentTab = 'role'
    this.tabBar.querySelectorAll('.tab-item').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.tab === 'role')
    })

    const phase = engine.state?.phase || 'lobby'
    if (phase === 'lobby') {
      this._gameStarting = false
      this._showGrimoire()
    } else if (phase === 'day') {
      this._showDayFlow()
    } else {
      // night — Grimoire 표시 (밤 화면)
      this._showGrimoire()
    }

    // 자동저장 시작
    this._startAutoSave()
  }

  // ─────────────────────────────────────
  // 기본 역할 자동 선택
  // ─────────────────────────────────────

  /**
   * 자동 역할 배정: 게임 규칙에 맞게 역할을 선택 후 자리별 배열로 반환
   * - 바론 선택 시 마을주민 -2 / 아웃사이더 +2 자동 반영
   * - 아웃사이더 최대 4개 제한 → 바론 불가 인원 수 보호
   */
  _autoRoles(n) {
    const comp = PLAYER_COUNTS[n]
    if (!comp) return new Array(n).fill(null)

    const shuffle  = arr => arr.slice().sort(() => Math.random() - 0.5)
    const byTeam   = team => ROLES_TB.filter(r => r.team === team)
    const OUTSIDER_MAX = byTeam('outsider').length  // 4개

    // 바론 포함 가능 여부 (아웃사이더가 +2 해도 최대 4개 이내)
    const baronOK  = (comp.outsider + 2) <= OUTSIDER_MAX

    // 미니언 선택 (바론 불가 시 제외)
    const minionPool = baronOK
      ? byTeam('minion')
      : byTeam('minion').filter(r => r.id !== 'baron')
    const minions  = shuffle(minionPool).slice(0, comp.minion)
    const hasBaron = minions.some(r => r.id === 'baron')

    // 바론 효과 적용
    const needTown = comp.townsfolk - (hasBaron ? 2 : 0)
    const needOut  = comp.outsider  + (hasBaron ? 2 : 0)

    const townsfolk = shuffle(byTeam('townsfolk')).slice(0, needTown)
    const outsiders = shuffle(byTeam('outsider')).slice(0, needOut)

    const pool = [
      ...townsfolk.map(r => r.id),
      ...outsiders.map(r => r.id),
      ...minions.map(r => r.id),
      'imp',
    ]

    return shuffle(pool)
  }


  // ─────────────────────────────────────
  // 탭 시스템
  // ─────────────────────────────────────

  _buildTabs() {
    this.tabBar.innerHTML = ''
    const tabs = [
      { id: 'role',  icon: '🎭', label: '그리모아' },
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

    // 게임 진행 중이면 나가기 탭 추가 (lobby 이외 phase이거나 _gameStarting 플래그)
    const inGame = this._gameStarting || (engine.state?.phase && engine.state.phase !== 'lobby')
    if (inGame) {
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
    this.tabBar.querySelectorAll('.tab-item').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.tab === tabId)
    })

    // 밤 행동 오버레이 숨기기/보이기
    if (tabId === 'role') {
      this.nightAction?.showOverlay()
    } else {
      this.nightAction?.hideOverlay()
    }

    // hbar: 그리모아 탭에서만 표시
    if (tabId === 'role') this._historyBar.show()
    else this._historyBar.hide()

    this._clearScreen()

    if (tabId === 'role') {
      const phase = engine.state?.phase || 'lobby'
      if (phase === 'lobby' || phase === 'night') {
        this._showGrimoire()
      } else if (phase === 'day') {
        this._showDayFlow()
      } else {
        this._showGrimoire()
      }
    } else if (tabId === 'seats') {
      this._showSeatLayout()
    } else if (tabId === 'rules') {
      const initialPage = this._pendingRulesPage || 'index.md'
      this._pendingRulesPage = null
      const rulesScreen = new RulesScreen({ initialPage })
      rulesScreen.mount(this.container)
      this.currentScreen = rulesScreen
    } else if (tabId === 'memo') {
      import('../player/Memo.js').then(({ Memo }) => {
        const memo = new Memo({ gameKey: this._saveId || 'session' })
        memo.mount(this.container)
        this.currentScreen = memo
      })
    } else if (tabId === 'dict') {
      import('../player/CharacterDict.js').then(({ CharacterDict }) => {
        const assigned    = this.seatRoles.filter(Boolean)
        const scriptRoles = assigned.length > 0 ? assigned : null
        const dict = new CharacterDict({
          scriptRoles,
          onRoleClick: (roleId) => {
            this._pendingRulesPage = `${roleId}.md`
            this._switchTab('rules')
          },
        })
        dict.mount(this.container)
        this.currentScreen = dict
      })
    }
  }

  // ─────────────────────────────────────
  // 화면 전환
  // ─────────────────────────────────────

  _clearScreen() {
    this.currentScreen?.unmount()
    this.currentScreen = null
    this._grimoire     = null
    this.container.innerHTML = ''
    this._dismissViewer()  // 열람 모드 해제
  }

  _showGrimoire() {
    this._clearScreen()
    this.doneSteps = []

    const grimoire = new Grimoire({
      engine,
      getLobbyConfig:  () => ({
        playerCount: this.pendingPlayerCount,
        seatRoles:   this.seatRoles,
        roomCode:    this._lastRoomCode,
        drunkAsRole: this.drunkAsRole,
      }),
      onStartGame:         () => this._handleManualStart(),
      onStartNight:        () => this._handleStartNight(),
      onStartDay:          () => this._handleStartDay(),
      onNextNightStep:     () => this._handleNextNightStep(),
      onPlayerAction:      (action, id) => this._handlePlayerAction(action, id),
      onPlayerCountChange: (n) => {
        const newN = Math.max(5, Math.min(15, n))
        // 자리 배열 크기 조정 (늘리면 null 추가, 줄이면 자르기)
        if (newN > this.pendingPlayerCount) {
          for (let i = this.pendingPlayerCount; i < newN; i++) this.seatRoles.push(null)
        } else {
          this.seatRoles = this.seatRoles.slice(0, newN)
        }
        this.pendingPlayerCount = newN
        this._grimoire?.refresh()
      },
      onSeatRoleAssign: (seatIdx, roleId) => {
        // 같은 역할이 다른 자리에 있으면 제거
        if (roleId) {
          this.seatRoles = this.seatRoles.map((r, i) => (r === roleId && i !== seatIdx) ? null : r)
        }
        this.seatRoles[seatIdx] = roleId || null
        // 주정뱅이가 빠지면 drunkAsRole 초기화
        if (!this.seatRoles.includes('drunk')) {
          this.drunkAsRole = null
        }
        this._grimoire?.refresh()
      },
      onDrunkAsChange: (roleId) => {
        this.drunkAsRole = roleId
        this._grimoire?.refresh()
      },
      onAddTraveller: () => this._switchTab('seats'),
      onAutoAssign: () => {
        this.seatRoles = this._autoRoles(this.pendingPlayerCount)
        // 주정뱅이가 있으면 drunkAs 자동 선택 (게임에 없는 마을 주민 중 랜덤)
        if (this.seatRoles.includes('drunk')) {
          const usedIds = new Set(this.seatRoles.filter(Boolean))
          const availTf = ROLES_TB.filter(r => r.team === 'townsfolk' && !usedIds.has(r.id))
          const pool = availTf.length > 0 ? availTf : ROLES_TB.filter(r => r.team === 'townsfolk')
          this.drunkAsRole = pool[Math.floor(Math.random() * pool.length)].id
        } else {
          this.drunkAsRole = null
        }
        this._grimoire?.refresh()
      },
    })

    grimoire.mount(this.container)
    this.currentScreen = grimoire
    this._grimoire     = grimoire

    engine.on('stateChanged', () => grimoire.refresh())
  }

  // ─────────────────────────────────────
  // 게임 시작
  // ─────────────────────────────────────

  _handleManualStart() {
    if (this._gameStarting) return

    // seatRoles가 이미 자리별로 배정된 역할 배열
    const assignedRoles = [...this.seatRoles]

    // 레드헤링 계산 (선 팀 플레이어 중 1명)
    const goodPlayerIds = assignedRoles
      .map((roleId, i) => {
        const role = ROLES_BY_ID[roleId]
        const isGood = role ? (role.team === 'townsfolk' || role.team === 'outsider') : true
        return isGood ? i + 1 : null
      })
      .filter(Boolean)
    const redHerringId = goodPlayerIds.length > 0
      ? goodPlayerIds[Math.floor(Math.random() * goodPlayerIds.length)]
      : 0

    // 방 코드 생성 — 주정뱅이 자리는 믿는 역할로 인코딩 (참가자에게 보이는 역할)
    const codeRoles = [...assignedRoles]
    const drunkIdx = codeRoles.indexOf('drunk')
    if (drunkIdx >= 0 && this.drunkAsRole) {
      codeRoles[drunkIdx] = this.drunkAsRole
    }
    const code = encodeRoomCode(this.pendingPlayerCount, codeRoles, redHerringId)
    this._lastRoomCode = code

    // 코드 팝업 표시 → 닫으면 게임 시작
    this._showCodePopup(code, assignedRoles, () => {
      this._gameStarting = true
      const names = Array.from({ length: this.pendingPlayerCount }, (_, i) => `플레이어${i + 1}`)
      engine.reset()
      this._history.reset()
      engine.initGame(names, assignedRoles, { preAssigned: true, redHerringId, drunkAs: this.drunkAsRole })
      engine.startNight()

      // HistoryBar DOM 삽입 (app-content 바로 앞)
      this._mountHistoryBar()

      // 첫 밤 히스토리 기록
      this._history.push({
        type: 'phase-start', phase: 'night', round: engine.state.round,
        label: `🌙 밤 ${engine.state.round}`,
        snapshot: engine.serialize(),
      })

      // 세이브 슬롯 생성 + 자동저장 시작
      this._saveId = GameSaveManager.createId()
      this._autoSave()
      this._startAutoSave()

      this.currentTab = 'role'
      this._buildTabs()  // 나가기 탭 포함하여 재빌드
      this._showGrimoire()
    })
  }

  _showCodePopup(code, assignedRoles, onStart) {
    document.getElementById('code-popup')?.remove()

    const overlay = document.createElement('div')
    overlay.className = 'popup-overlay'
    overlay.id = 'code-popup'

    const box = document.createElement('div')
    box.className = 'popup-box'
    box.style.cssText = 'max-height:90vh;overflow-y:auto;padding:24px 18px 20px;'

    // ── 헤더 ──
    box.innerHTML = `
      <div style="text-align:center;margin-bottom:20px;">
        <div style="font-size:1.5rem;margin-bottom:4px;">🏰</div>
        <div style="font-family:'Noto Serif KR',serif;font-size:1.05rem;font-weight:700;color:var(--gold2);">방 코드가 생성되었습니다</div>
        <div style="font-size:0.62rem;color:var(--text4);margin-top:4px;letter-spacing:0.04em;">참가자에게 코드 또는 링크를 공유하세요</div>
      </div>
    `

    // ── 코드 + 링크 공유 카드 2개 ──
    const formatted = formatCode(code)
    const shareRow = document.createElement('div')
    shareRow.style.cssText = 'display:flex;gap:10px;margin-bottom:20px;'

    function makeShareCard(mainHtml, subText, onCopy) {
      const card = document.createElement('div')
      card.style.cssText = `
        flex:1;background:var(--surface2);border:2px solid var(--gold2);border-radius:12px;
        padding:16px 10px 12px;text-align:center;cursor:pointer;
        transition:background 0.15s,border-color 0.15s;
        -webkit-tap-highlight-color:transparent;
      `
      const main = document.createElement('div')
      main.innerHTML = mainHtml
      const hint = document.createElement('div')
      hint.style.cssText = 'font-size:0.6rem;color:var(--text4);margin-top:8px;letter-spacing:0.03em;'
      hint.textContent = subText
      card.appendChild(main)
      card.appendChild(hint)
      card.addEventListener('click', async () => {
        const copied = await onCopy()
        hint.textContent = copied ? '✓ 복사됨!' : '복사 실패'
        card.style.borderColor = copied ? 'var(--tl-base)' : 'var(--rd-light)'
        setTimeout(() => {
          hint.textContent = subText
          card.style.borderColor = 'var(--gold2)'
        }, 1500)
      })
      return card
    }

    shareRow.appendChild(makeShareCard(
      `<div style="font-size:1.45rem;font-weight:900;letter-spacing:0.18em;color:var(--gold2);font-family:monospace;line-height:1.2;">${formatted}</div>`,
      '방 코드 복사',
      () => copyRoomCode(code)
    ))
    shareRow.appendChild(makeShareCard(
      `<div style="font-size:1.6rem;line-height:1.2;">🔗</div>
       <div style="font-size:0.65rem;color:var(--text3);margin-top:4px;font-weight:600;">바로 접속 링크</div>`,
      '링크 복사',
      () => copyRoomLink(code)
    ))
    box.appendChild(shareRow)

    // ── 구분선 ──
    const divider = document.createElement('div')
    divider.style.cssText = 'height:1px;background:var(--lead2);margin-bottom:16px;'
    box.appendChild(divider)

    // ── 자리별 역할 목록 ──
    const listTitle = document.createElement('div')
    listTitle.style.cssText = 'font-size:0.68rem;color:var(--text4);margin-bottom:10px;letter-spacing:0.05em;text-transform:uppercase;'
    listTitle.textContent = '자리별 역할 배정 · 호스트 전용'
    box.appendChild(listTitle)

    const list = document.createElement('div')
    list.style.cssText = 'display:flex;flex-direction:column;gap:6px;margin-bottom:22px;'

    const TEAM_COLOR = {
      townsfolk: 'var(--bl-light)', outsider: 'var(--tl-light)',
      minion: 'var(--rd-light)',    demon:    'var(--rd-light)',
    }
    const TEAM_BG = {
      townsfolk: 'rgba(46,74,143,0.12)', outsider: 'rgba(91,179,198,0.10)',
      minion:    'rgba(140,48,48,0.14)', demon:    'rgba(110,27,31,0.18)',
    }

    assignedRoles.forEach((roleId, i) => {
      const role = ROLES_BY_ID[roleId]
      const tc   = TEAM_COLOR[role?.team] || 'var(--text2)'
      const tb   = TEAM_BG[role?.team]    || 'var(--surface2)'

      const row = document.createElement('div')
      row.style.cssText = `
        display:flex;align-items:center;gap:10px;
        padding:8px 12px;border-radius:10px;
        background:${tb};
        border:1px solid rgba(255,255,255,0.04);
      `

      // 자리 번호 배지
      const badge = document.createElement('span')
      badge.style.cssText = `
        font-size:0.65rem;font-weight:700;
        background:rgba(212,168,40,0.12);color:var(--gold2);
        border:1px solid rgba(212,168,40,0.3);
        border-radius:6px;padding:2px 8px;min-width:34px;text-align:center;flex-shrink:0;
      `
      badge.textContent = `${i + 1}번`

      // 아이콘
      const iconWrap = document.createElement('span')
      iconWrap.style.cssText = 'width:24px;height:24px;display:inline-flex;align-items:center;justify-content:center;flex-shrink:0;'
      if (role?.icon?.endsWith('.png')) {
        const img = document.createElement('img')
        img.src = `./asset/new/Icon_${role.icon}`
        img.style.cssText = 'width:100%;height:100%;object-fit:contain;'
        iconWrap.appendChild(img)
      } else {
        iconWrap.textContent = role?.iconEmoji || '?'
      }

      // 역할명
      const name = document.createElement('span')
      name.style.cssText = `font-size:0.85rem;font-weight:700;color:${tc};`
      name.textContent = role?.name || roleId

      row.appendChild(badge)
      row.appendChild(iconWrap)
      row.appendChild(name)

      // 주정뱅이 drunkAs
      if (roleId === 'drunk' && this.drunkAsRole) {
        const drunkAsInfo = ROLES_BY_ID[this.drunkAsRole]
        if (drunkAsInfo) {
          const as = document.createElement('span')
          as.style.cssText = 'font-size:0.62rem;color:var(--text4);margin-left:auto;white-space:nowrap;'
          as.textContent = `→ ${drunkAsInfo.name} 인지`
          row.appendChild(as)
        }
      }

      list.appendChild(row)
    })
    box.appendChild(list)

    // ── 게임 시작 버튼 ──
    const startBtn = document.createElement('button')
    startBtn.className = 'btn btn-gold btn-full'
    startBtn.style.cssText = 'padding:15px;font-size:0.95rem;font-weight:700;border-radius:12px;'
    startBtn.textContent = '▶  게임 시작'
    startBtn.addEventListener('click', () => {
      overlay.remove()
      onStart()
    })
    box.appendChild(startBtn)

    overlay.appendChild(box)
    document.body.appendChild(overlay)
  }

  _handleStartNight() {
    engine.startNight()
    this.doneSteps = []

    this._history.push({
      type: 'phase-start', phase: 'night', round: engine.state.round,
      label: `🌙 밤 ${engine.state.round}`,
      snapshot: engine.serialize(),
    })
    this._autoSave()  // 밤 전환 시 즉시 저장

    this.currentTab = 'role'
    this._buildTabs()
    this._showGrimoire()
  }

  _handleStartDay() {
    const nightResult = this._buildNightResultData()
    engine.startDay()

    // 밤 사망자 히스토리 기록
    const deaths = engine.state.players.filter(p => p.status === 'dead')
    const deathNames = deaths.map(p => `${p.id}번`).join(', ')
    if (deaths.length > 0) {
      this._history.push({
        type: 'night-resolve', phase: 'night', round: engine.state.round,
        label: `💀 ${deathNames} 사망`,
        detail: `밤 ${engine.state.round} 결과: ${deathNames || '사망자 없음'}`,
        snapshot: engine.serialize(),
      })
    }

    const winCheck = engine.checkWinCondition()
    if (winCheck.gameOver) {
      this._showVictory(winCheck.winner, winCheck.reason)
      return
    }

    this._history.push({
      type: 'phase-start', phase: 'day', round: engine.state.round,
      label: `☀️ 낮 ${engine.state.round}`,
      snapshot: engine.serialize(),
    })
    this._autoSave()  // 낮 전환 시 즉시 저장

    this.currentTab = 'role'
    this._buildTabs()
    this._showNightResultPopup(nightResult, () => this._showDayFlow())
  }

  _handleNextNightStep() {
    const step = engine.state.currentNightStep
    if (!step) {
      this._handleStartDay()
      return
    }
    if (!this.nightAction) {
      this.nightAction = new NightAction({
        engine,
        onStepDone: (roleId, targetIds) => {
          this.doneSteps.push(roleId)

          // 밤 행동 히스토리 기록
          const SPECIAL_STEP_NAMES = { 'minion-info': '미니언 공개', 'demon-info': '임프 정보' }
          const roleName = SPECIAL_STEP_NAMES[roleId] || ROLES_BY_ID[roleId]?.name || roleId
          const targetLabel = (targetIds && targetIds.length > 0)
            ? `→ ${targetIds.map(id => `${id}번`).join(', ')}`
            : ''
          this._history.push({
            type: 'night-action', phase: 'night', round: engine.state.round,
            roleId,
            actor: this._findActorForRole(roleId),
            target: targetIds || [],
            label: `${roleName}${targetLabel ? ' ' + targetLabel : ''}`,
            detail: `${roleName} ${targetLabel}`,
            snapshot: engine.serialize(),
          })

          engine.nextNightStep()
          const next = engine.state.currentNightStep
          if (next) {
            this.nightAction.processCurrentStep()
          } else {
            this.nightAction = null
            this._handleStartDay()
          }
        },
      })
    }
    this.nightAction.processCurrentStep()
  }

  _buildNightResultData() {
    const round = engine.state.round
    const impAction = engine.nightActions
      .filter(a => a.round === round && a.roleId === 'imp')
      .pop()

    const deathIds = [...new Set([
      ...engine.pendingDeaths,
      ...(impAction && impAction.targetIds?.[0] === impAction.actorId ? [impAction.actorId] : []),
    ])]
    const deathPlayers = deathIds.map(id => engine.getPlayer(id)).filter(Boolean)

    if (!impAction || !impAction.targetIds || impAction.targetIds.length === 0) {
      return {
        round,
        targetLabel: '없음',
        summary: '이번 밤에는 임프 공격이 없었습니다.',
        detail: '첫날 밤이거나, 임프가 아직 대상을 고르지 않았습니다.',
        deathIds,
        deathPlayers,
      }
    }

    const targetId = impAction.targetIds[0]
    const target = engine.getPlayer(targetId)
    const targetLabel = target ? `${target.id}번 ${target.name}` : `${targetId}번`

    if (targetId === impAction.actorId) {
      const successor = engine.state.players.find(
        p => p.role === 'imp' && p.status === 'alive' && p.id !== targetId
      )
      return {
        round,
        targetLabel,
        summary: '임프가 자기 자신을 선택했습니다.',
        detail: successor
          ? `${targetLabel}이 자결했고, ${successor.id}번 ${successor.name}이 새 임프가 되었습니다.`
          : `${targetLabel}이 자결했습니다.`,
        deathIds,
        deathPlayers,
      }
    }

    if (deathIds.includes(targetId)) {
      return {
        round,
        targetLabel,
        summary: `${targetLabel}이 임프의 공격으로 사망했습니다.`,
        detail: '지목 대상이 그대로 밤 사망으로 이어졌습니다.',
        deathIds,
        deathPlayers,
      }
    }

    // 보호 원인 감지 (engine._resolveNight 과 동일 조건)
    const isMonkProtected = engine.monkProtect === targetId
    const isSoldier       = target?.role === 'soldier' && !target?.isPoisoned
    const isMayor         = target?.role === 'mayor'   && !target?.isPoisoned

    let protectReason = null
    if (isMonkProtected) {
      const monk = engine.state.players.find(p => p.role === 'monk' && p.status === 'alive')
      protectReason = {
        icon: '🛡',
        label: '수도사 보호',
        desc: monk
          ? `${monk.id}번 ${monk.name}이(가) ${targetLabel}을(를) 보호하고 있습니다.`
          : `수도사가 ${targetLabel}을(를) 보호하고 있습니다.`,
      }
    } else if (isSoldier) {
      protectReason = {
        icon: '⚔',
        label: '군인 면역',
        desc: `${targetLabel}은(는) 군인이라 임프의 공격에 면역입니다.`,
      }
    } else if (isMayor && deathPlayers.length === 0) {
      protectReason = {
        icon: '🏛',
        label: '시장 튕김',
        desc: `시장 능력으로 공격이 튕겼지만, 다른 사망자도 없었습니다.`,
      }
    }

    if (deathPlayers.length > 0) {
      const deathLabel = deathPlayers.map(p => `${p.id}번 ${p.name}`).join(', ')
      const mayorDesc  = isMayor ? '시장 능력으로 공격이 튕겨 다른 플레이어가 사망했습니다.' : '실제 사망자가 발생했습니다.'
      return {
        round, targetLabel,
        summary: `${targetLabel}은 살아남았고, 다른 플레이어가 사망했습니다.`,
        detail:  `${mayorDesc} 사망자: ${deathLabel}`,
        protectReason: isMayor ? { icon: '🏛', label: '시장 튕김', desc: `${targetLabel}의 시장 능력으로 공격이 다른 플레이어에게 튕겼습니다.` } : null,
        deathIds, deathPlayers,
      }
    }

    return {
      round, targetLabel,
      summary: `${targetLabel}은 이번 밤 사망하지 않았습니다.`,
      detail:  protectReason ? protectReason.desc : '알 수 없는 이유로 공격이 막혔습니다.',
      protectReason,
      deathIds, deathPlayers,
    }
  }

  _showNightResultPopup(result, onContinue) {
    const overlay = document.createElement('div')
    overlay.className = 'popup-overlay'

    const box = document.createElement('div')
    box.className = 'popup-box'
    box.style.cssText = 'text-align:center;padding:24px 18px 20px;max-width:420px;'

    const deathLabel = result.deathPlayers.length > 0
      ? result.deathPlayers.map(p => `${p.id}번 ${p.name}`).join(', ')
      : '없음'

    const protectCard = result.protectReason ? `
      <div style="
        background:rgba(14,116,144,0.12);border:1.5px solid rgba(14,116,144,0.5);
        border-radius:12px;padding:12px 14px;margin-bottom:10px;
        display:flex;align-items:flex-start;gap:10px;text-align:left;
      ">
        <span style="font-size:1.4rem;flex-shrink:0;line-height:1.2;">${result.protectReason.icon}</span>
        <div>
          <div style="font-size:0.72rem;font-weight:700;color:var(--tl-light);margin-bottom:3px;">${result.protectReason.label}</div>
          <div style="font-size:0.7rem;color:var(--text3);line-height:1.5;">${result.protectReason.desc}</div>
        </div>
      </div>
    ` : ''

    box.innerHTML = `
      <div style="font-size:2rem;margin-bottom:8px;">🌙</div>
      <div style="font-family:'Noto Serif KR',serif;font-size:1.04rem;font-weight:700;color:var(--gold2);margin-bottom:6px;">
        밤 ${result.round} 임프 결과
      </div>
      <div style="font-size:0.72rem;color:var(--text4);margin-bottom:14px;">
        임프가 이번 밤 누구를 노렸는지 확인합니다
      </div>
      <div style="background:var(--surface2);border:1px solid var(--lead2);border-radius:12px;padding:14px 12px;margin-bottom:10px;">
        <div style="font-size:0.64rem;color:var(--text4);margin-bottom:4px;">임프 목표</div>
        <div style="font-size:0.96rem;font-weight:800;color:var(--text2);">${result.targetLabel}</div>
      </div>
      <div style="background:var(--surface2);border:1px solid var(--lead2);border-radius:12px;padding:14px 12px;margin-bottom:10px;">
        <div style="font-size:0.64rem;color:var(--text4);margin-bottom:4px;">결과</div>
        <div style="font-size:0.88rem;font-weight:700;color:var(--text);line-height:1.5;">${result.summary}</div>
      </div>
      ${protectCard}
      <div style="font-size:0.68rem;color:var(--text4);margin-bottom:18px;">밤 사망자: ${deathLabel}</div>
    `

    const continueBtn = document.createElement('button')
    continueBtn.className = 'btn btn-gold btn-full'
    continueBtn.textContent = '낮 시작'
    continueBtn.addEventListener('click', () => {
      overlay.remove()
      onContinue?.()
    })

    box.appendChild(continueBtn)
    overlay.appendChild(box)
    document.body.appendChild(overlay)
  }

  _showDayFlow() {
    this._clearScreen()
    const dayFlow = new DayFlow({
      engine,
      onStartNight: () => this._handleStartNight(),
      onGameOver:   (winner, reason) => this._showVictory(winner, reason),
      onHistoryPush: (entry) => this._history.push(entry),
    })
    dayFlow.mount(this.container)
    this.currentScreen = dayFlow
    engine.on('stateChanged', () => dayFlow.refresh())
  }

  _showVictory(winner, reason) {
    this._clearScreen()
    this.currentTab = 'role'
    this.tabBar.querySelectorAll('.tab-item').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.tab === 'role')
    })
    const victory = new Victory({
      engine,
      winner,
      reason,
      onNewGame: () => {
        // 세이브 삭제 (게임 종료)
        if (this._saveId) {
          GameSaveManager.delete(this._saveId)
          this._saveId = null
        }
        this._stopAutoSave()
        engine.reset()
        this._history.reset()
        this._historyBar.hide()
        this._gameStarting = false
        this.seatRoles     = new Array(this.pendingPlayerCount).fill(null)
        this.drunkAsRole   = null
        this._lastRoomCode = null
        this._switchTab('role')
      },
    })
    victory.mount(this.container)
    this.currentScreen = victory
  }

  _handlePlayerAction(_action, _actorId) {}

  // ─────────────────────────────────────
  // 히스토리 시스템
  // ─────────────────────────────────────

  _mountHistoryBar() {
    // 이미 DOM에 있으면 스킵
    if (this._historyBar.el.parentNode) {
      this._historyBar.show()
      return
    }
    const app = this.container.parentNode
    app.insertBefore(this._historyBar.el, this.container)
    this._historyBar.show()
  }

  _onHistoryNavigate(entry) {
    if (this._history.isViewingHistory() && entry) {
      this._showViewer(entry)
    } else {
      this._dismissViewer()
    }
  }

  _showViewer(entry) {
    this._dismissViewer()

    // 열람 배너 + 오버레이
    const overlay = document.createElement('div')
    overlay.className = 'hbar-viewer-overlay'

    // 배너
    const banner = document.createElement('div')
    banner.className = 'hbar-viewing-banner'

    const phaseKo = entry.phase === 'night' ? '밤' : '낮'
    const bannerText = document.createElement('span')
    bannerText.className = 'hbar-viewing-banner__text'
    bannerText.textContent = `⚠️ ${phaseKo} ${entry.round} — ${entry.label} 열람 중`
    banner.appendChild(bannerText)

    const backBtn = document.createElement('button')
    backBtn.className = 'hbar-viewing-banner__back'
    backBtn.textContent = '현재로 돌아가기 →'
    backBtn.addEventListener('click', () => this._history.goToLatest())
    banner.appendChild(backBtn)

    overlay.appendChild(banner)

    // 엔트리 상세 카드
    const card = document.createElement('div')
    card.className = 'hbar-viewer-card'

    const typeNames = {
      'phase-start': '페이즈 시작',
      'night-action': '밤 행동',
      'night-resolve': '밤 결과',
      'nomination': '지명',
      'vote': '투표',
      'execution': '처형',
      'death': '사망',
    }

    card.innerHTML = `
      <div class="hbar-viewer-card__type">${typeNames[entry.type] || entry.type}</div>
      <div class="hbar-viewer-card__label">${entry.label}</div>
      ${entry.detail ? `<div class="hbar-viewer-card__detail">${entry.detail}</div>` : ''}
    `
    overlay.appendChild(card)

    // 되돌리기 버튼 (snapshot 있을 때만)
    if (entry.snapshot) {
      const rewindBtn = document.createElement('button')
      rewindBtn.className = 'btn btn-danger btn-full'
      rewindBtn.style.cssText = 'margin:12px 16px 0;width:calc(100% - 32px);'
      rewindBtn.textContent = '↩ 이 시점으로 되돌리기'
      rewindBtn.addEventListener('click', () => this._confirmRewind(entry))
      overlay.appendChild(rewindBtn)
    }

    // 전후 탐색 버튼
    const navRow = document.createElement('div')
    navRow.style.cssText = 'display:flex;gap:8px;padding:0 16px;margin-top:10px;'

    const prevBtn = document.createElement('button')
    prevBtn.className = 'btn'
    prevBtn.style.flex = '1'
    prevBtn.textContent = '‹ 이전'
    prevBtn.addEventListener('click', () => this._history.goBack())
    navRow.appendChild(prevBtn)

    const nextBtn = document.createElement('button')
    nextBtn.className = 'btn'
    nextBtn.style.flex = '1'
    nextBtn.textContent = '다음 ›'
    nextBtn.addEventListener('click', () => this._history.goForward())
    navRow.appendChild(nextBtn)

    overlay.appendChild(navRow)

    // app-content에 상대 위치 설정 후 오버레이 추가
    this.container.style.position = 'relative'
    this.container.appendChild(overlay)
    this._viewerOverlay = overlay
  }

  _confirmRewind(entry) {
    const overlay = document.createElement('div')
    overlay.className = 'popup-overlay'
    const box = document.createElement('div')
    box.className = 'popup-box'
    box.style.textAlign = 'center'
    box.innerHTML = `
      <div style="font-size:2rem;margin-bottom:12px">↩</div>
      <div style="font-family:'Noto Serif KR',serif;font-size:1rem;font-weight:700;color:var(--gold2);margin-bottom:8px">되돌리기 확인</div>
      <div style="font-size:0.78rem;color:var(--text2);margin-bottom:6px;line-height:1.5">
        <b>"${entry.label}"</b> 시점으로 되돌립니다.
      </div>
      <div style="font-size:0.68rem;color:var(--rd-light);margin-bottom:16px;line-height:1.4">
        이후의 모든 행동이 취소됩니다.<br>이 작업은 되돌릴 수 없습니다.
      </div>
      <div class="btn-grid-2">
        <button class="btn" id="rewind-cancel">취소</button>
        <button class="btn btn-danger" id="rewind-confirm">되돌리기</button>
      </div>
    `
    overlay.appendChild(box)
    overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove() })
    document.body.appendChild(overlay)

    box.querySelector('#rewind-cancel').addEventListener('click', () => overlay.remove())
    box.querySelector('#rewind-confirm').addEventListener('click', () => {
      overlay.remove()
      this._executeRewind(entry)
    })
  }

  _executeRewind(entry) {
    // 1) engine 상태 복원
    engine.restore(entry.snapshot)

    // 2) 히스토리에서 이후 엔트리 삭제
    this._history.rewindTo(entry.id)

    // 3) 열람 모드 해제
    this._dismissViewer()

    // 4) 호스트 상태 동기화
    this.doneSteps = []
    this.nightAction = null

    // 5) 현재 phase에 맞는 화면 다시 표시
    const phase = engine.state.phase
    this.currentTab = 'role'
    this.tabBar.querySelectorAll('.tab-item').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.tab === 'role')
    })

    if (phase === 'day') {
      this._showDayFlow()
    } else {
      this._showGrimoire()
    }

    // 6) HistoryBar 재마운트 (clearScreen에서 DOM이 변경되므로)
    this._mountHistoryBar()

    // 6) 즉시 저장
    this._autoSave()
  }

  _dismissViewer() {
    if (this._viewerOverlay) {
      this._viewerOverlay.remove()
      this._viewerOverlay = null
    }
  }

  _findActorForRole(roleId) {
    if (roleId === 'minion-info' || roleId === 'demon-info' || roleId === 'spy') return null
    const p = engine.state.players.find(p => p.role === roleId && p.status === 'alive')
    return p ? p.id : null
  }

  // ─────────────────────────────────────
  // 저장 시스템
  // ─────────────────────────────────────

  _autoSave() {
    if (!this._saveId) return
    const data = {
      engineData:  engine.serialize(),
      hostState: {
        seatRoles:          [...this.seatRoles],
        drunkAsRole:        this.drunkAsRole,
        pendingPlayerCount: this.pendingPlayerCount,
        roomCode:           this._lastRoomCode,
        doneSteps:          [...this.doneSteps],
        currentTab:         this.currentTab,
      },
      historyData: this._history.serialize(),
    }
    GameSaveManager.save(this._saveId, data)
  }

  _startAutoSave() {
    this._stopAutoSave()
    // stateChanged마다 디바운스 저장
    this._autoSaveHandler = () => {
      clearTimeout(this._saveDebounce)
      this._saveDebounce = setTimeout(() => this._autoSave(), 1000)
    }
    engine.on('stateChanged', this._autoSaveHandler)

    // 페이지 이탈 시 즉시 저장
    this._beforeUnloadHandler = () => this._autoSave()
    window.addEventListener('beforeunload', this._beforeUnloadHandler)
  }

  _stopAutoSave() {
    if (this._autoSaveHandler) {
      engine.off('stateChanged', this._autoSaveHandler)
      this._autoSaveHandler = null
    }
    if (this._beforeUnloadHandler) {
      window.removeEventListener('beforeunload', this._beforeUnloadHandler)
      this._beforeUnloadHandler = null
    }
    clearTimeout(this._saveDebounce)
  }

  /** 호스트가 게임에서 나가기 (저장 후 홈으로) */
  exitToHome() {
    this._autoSave()
    this._stopAutoSave()
    this._historyBar.hide()
    this._saveId = null
    window.goHome?.()
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
      <div style="font-size:0.78rem;color:var(--text2);margin-bottom:16px;line-height:1.5">게임은 자동 저장됩니다.<br>나중에 이어서 플레이할 수 있습니다.</div>
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

  // ─────────────────────────────────────
  // 자리 배치 탭 — 전체 공개 링 뷰
  // ─────────────────────────────────────

  _showSeatLayout() {
    const state = engine.state
    if (!state || state.phase === 'lobby') {
      this.container.innerHTML = `
        <div class="empty-state">
          <div class="empty-state__icon">🪑</div>
          <div>게임 시작 후 이용 가능합니다</div>
        </div>`
      return
    }

    const { players } = state
    const travellers = this._getHostTravellers()

    // 위치 기반 정렬: 일반 좌석 사이에 여행자를 끼워넣기
    const orderedEntries = []
    for (let s = 0; s < players.length; s++) {
      orderedEntries.push({ type: 'player', player: players[s] })
      travellers.forEach((t, tIdx) => {
        if (((t.afterSeat || players.length) - 1) === s) {
          orderedEntries.push({ type: 'traveller', tIdx, roleId: t.roleId })
        }
      })
    }

    // buildOvalSlots 에 전달할 통합 플레이어 배열 (여행자는 가상 객체)
    const mergedPlayers = orderedEntries.map(entry => {
      if (entry.type === 'player') return entry.player
      return {
        id: `T${entry.tIdx + 1}`, role: entry.roleId,
        team: 'traveller', status: 'alive',
        _isTraveller: true, _tIdx: entry.tIdx,
        _alignment: travellers[entry.tIdx].alignment || 'good',
      }
    })

    const total = mergedPlayers.length

    const { rawH, slotPx, iconPx } = calcOvalLayout(total, 106)
    const contentH = rawH - 80

    const el = document.createElement('div')
    el.style.cssText = `display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:${contentH}px;gap:8px;position:relative;`

    // 여행자 추가 버튼 (좌측 상단)
    const addBtn = document.createElement('button')
    addBtn.className = 'traveller-add-btn'
    addBtn.style.cssText = 'position:absolute;top:0;left:10px;z-index:10;'
    addBtn.innerHTML = '<span>🧳</span> 여행자 추가'
    addBtn.addEventListener('click', () => this._showHostTravellerPicker())
    el.appendChild(addBtn)

    const oval = createSeatOval(`width:100%;max-width:min(100%,calc((100vh - 186px)*2/3));aspect-ratio:2/3;margin:0 auto;`)

    buildOvalSlots(oval, mergedPlayers, slotPx, iconPx, { engine })

    // 여행자 슬롯: 클릭 핸들러 + 진영 테두리 색
    const slots = oval.querySelectorAll('.gl-seat-slot')
    mergedPlayers.forEach((p, i) => {
      if (p._isTraveller && slots[i]) {
        slots[i].style.cursor = 'pointer'
        slots[i].style.borderColor = p._alignment === 'evil'
          ? 'rgba(200,40,40,0.7)' : 'rgba(40,100,200,0.7)'
        slots[i].addEventListener('click', () => this._showHostTravellerSlotMenu(p._tIdx))
      }
    })

    // 자리 번호 레이블
    mergedPlayers.forEach((p, i) => {
      const { x, y } = ovalSlotPos(i, total)
      const label = p._isTraveller ? `T${p._tIdx + 1}` : p.id
      oval.appendChild(createSeatNumLabel(x, y, slotPx, label, { dimmed: p.status !== 'alive' }))
    })

    el.appendChild(oval)

    const sub = document.createElement('div')
    sub.style.cssText = 'text-align:center;font-size:0.65rem;color:var(--text4);'
    sub.textContent = `${players.length}인 게임${travellers.length ? ` + 여행자 ${travellers.length}명` : ''} · 호스트 전용 전체 공개`
    el.appendChild(sub)

    this.container.appendChild(el)
  }

  // ─────────────────────────────────────
  // 여행자 메모 (로컬 전용)
  // ─────────────────────────────────────

  _getHostTravellers() {
    if (!this._lastRoomCode) return []
    try {
      return JSON.parse(localStorage.getItem(`ctp_host_travellers_${this._lastRoomCode}`) || '[]')
    } catch { return [] }
  }

  _saveHostTravellers(travellers) {
    if (!this._lastRoomCode) return
    try { localStorage.setItem(`ctp_host_travellers_${this._lastRoomCode}`, JSON.stringify(travellers)) } catch {}
  }

  _showHostTravellerPicker() {
    document.getElementById('traveller-picker')?.remove()

    const playerCount = engine.state?.players?.length || this.pendingPlayerCount
    const TRAVELLER_ROLES = ROLES_TB.filter(r => r.team === 'traveller')

    const overlay = document.createElement('div')
    overlay.id = 'traveller-picker'
    overlay.style.cssText = `
      position:fixed;inset:0;background:rgba(0,0,0,0.72);
      display:flex;align-items:center;justify-content:center;
      z-index:300;opacity:0;transition:opacity 0.18s;padding:20px;
    `
    overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove() })

    const modal = document.createElement('div')
    modal.style.cssText = `
      background:var(--surface);border-radius:18px;padding:20px 16px;
      max-width:480px;width:100%;max-height:85vh;overflow-y:auto;position:relative;
      box-shadow:0 8px 32px rgba(0,0,0,0.5);
    `

    const closeBtn = document.createElement('button')
    closeBtn.style.cssText = `
      position:absolute;top:12px;right:12px;width:30px;height:30px;border-radius:50%;
      border:1px solid var(--lead2);background:var(--surface2);color:var(--text3);
      font-size:0.75rem;cursor:pointer;display:flex;align-items:center;justify-content:center;
    `
    closeBtn.textContent = '✕'
    closeBtn.addEventListener('click', () => overlay.remove())
    modal.appendChild(closeBtn)

    // ── Step 1: 역할 선택 ──
    const showRoleStep = () => {
      while (modal.children.length > 1) modal.removeChild(modal.lastChild)

      const title = document.createElement('div')
      title.style.cssText = `font-family:'Noto Serif KR',serif;font-size:1.1rem;font-weight:700;color:var(--pu-light);text-align:center;margin-bottom:16px;`
      title.textContent = '🧳 여행자 추가'
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
        iconDiv.style.cssText = `width:44px;height:44px;border-radius:50%;background:var(--surface2);overflow:hidden;display:flex;align-items:center;justify-content:center;flex-shrink:0;`
        if (role.icon?.endsWith('.png')) {
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

    // ── Step 2: 위치 선택 ──
    const showPositionStep = (role) => {
      while (modal.children.length > 1) modal.removeChild(modal.lastChild)

      const header = document.createElement('div')
      header.style.cssText = 'text-align:center;margin-bottom:14px;'
      header.innerHTML = `
        <div style="font-family:'Noto Serif KR',serif;font-size:1rem;font-weight:700;color:var(--pu-light);">${role.iconEmoji || '🧳'} ${role.name}</div>
        <div style="font-size:0.78rem;color:var(--text3);margin-top:4px;">어디에 앉나요?</div>
      `
      modal.appendChild(header)

      // 현재 원탁 상태 구축
      const curTravellers = this._getHostTravellers()
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
        const left = circle[i], right = circle[(i + 1) % circle.length]
        const btn = document.createElement('button')
        btn.style.cssText = `
          padding:10px 14px;border-radius:8px;border:1.5px solid rgba(122,111,183,0.3);
          background:rgba(122,111,183,0.06);cursor:pointer;font-size:0.8rem;font-weight:600;
          color:var(--text2);transition:all 0.15s;white-space:nowrap;
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
          showAlignmentStep(role, afterSeat, insertIdx, curTravellers)
        })
        grid.appendChild(btn)
      }
      modal.appendChild(grid)

      const backBtn = document.createElement('button')
      backBtn.style.cssText = `display:block;margin:14px auto 0;padding:8px 20px;border-radius:8px;border:1px solid var(--lead2);background:var(--surface2);cursor:pointer;font-size:0.75rem;color:var(--text3);`
      backBtn.textContent = '← 역할 다시 선택'
      backBtn.addEventListener('click', () => showRoleStep())
      modal.appendChild(backBtn)
    }

    // ── Step 3: 진영 선택 ──
    const showAlignmentStep = (role, afterSeat, insertIdx, curTravellers) => {
      while (modal.children.length > 1) modal.removeChild(modal.lastChild)

      const header = document.createElement('div')
      header.style.cssText = 'text-align:center;margin-bottom:16px;'
      header.innerHTML = `
        <div style="font-family:'Noto Serif KR',serif;font-size:1rem;font-weight:700;color:var(--pu-light);">${role.iconEmoji || '🧳'} ${role.name}</div>
        <div style="font-size:0.78rem;color:var(--text3);margin-top:4px;">진영을 선택하세요</div>
      `
      modal.appendChild(header)

      const btnRow = document.createElement('div')
      btnRow.style.cssText = 'display:flex;gap:12px;justify-content:center;'

      const makeAlignBtn = (alignment, emoji, label, color) => {
        const btn = document.createElement('button')
        btn.style.cssText = `
          flex:1;max-width:160px;padding:20px 16px;border-radius:12px;
          border:2px solid ${color};background:${color.replace(/[\d.]+\)$/, '0.08)')};
          cursor:pointer;font-weight:700;color:var(--text);
          display:flex;flex-direction:column;align-items:center;gap:6px;
          transition:all 0.15s;
        `
        btn.innerHTML = `<span style="font-size:1.6rem;">${emoji}</span><span style="font-size:0.9rem;">${label}</span>`
        btn.addEventListener('click', () => {
          curTravellers.splice(insertIdx, 0, { roleId: role.id, afterSeat, alignment })
          this._saveHostTravellers(curTravellers)
          overlay.remove()
          this._switchTab('seats')
        })
        return btn
      }

      btnRow.appendChild(makeAlignBtn('good', '💙', '선 (Good)', 'rgba(40,100,200,0.7)'))
      btnRow.appendChild(makeAlignBtn('evil', '❤️', '악 (Evil)', 'rgba(200,40,40,0.7)'))
      modal.appendChild(btnRow)

      const backBtn = document.createElement('button')
      backBtn.style.cssText = `display:block;margin:14px auto 0;padding:8px 20px;border-radius:8px;border:1px solid var(--lead2);background:var(--surface2);cursor:pointer;font-size:0.75rem;color:var(--text3);`
      backBtn.textContent = '← 위치 다시 선택'
      backBtn.addEventListener('click', () => showPositionStep(role))
      modal.appendChild(backBtn)
    }

    showRoleStep()
    overlay.appendChild(modal)
    document.body.appendChild(overlay)
    requestAnimationFrame(() => { overlay.style.opacity = '1' })
  }

  _showHostTravellerSlotMenu(travellerIndex) {
    const travellers = this._getHostTravellers()
    const traveller = travellers[travellerIndex]
    if (!traveller) return

    const role = ROLES_BY_ID[traveller.roleId]
    if (!role) return

    const playerCount = engine.state?.players?.length || this.pendingPlayerCount

    document.getElementById('traveller-menu')?.remove()

    const overlay = document.createElement('div')
    overlay.id = 'traveller-menu'
    overlay.style.cssText = `
      position:fixed;inset:0;background:rgba(0,0,0,0.72);
      display:flex;align-items:center;justify-content:center;
      z-index:300;opacity:0;transition:opacity 0.18s;padding:20px;
    `
    overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove() })

    const modal = document.createElement('div')
    modal.style.cssText = `
      background:var(--surface);border-radius:18px;padding:28px 20px 24px;
      max-width:480px;width:100%;max-height:85vh;overflow-y:auto;position:relative;
      box-shadow:0 8px 32px rgba(0,0,0,0.5);
    `

    const closeBtn = document.createElement('button')
    closeBtn.style.cssText = `
      position:absolute;top:12px;right:12px;width:30px;height:30px;border-radius:50%;
      border:1px solid var(--lead2);background:var(--surface2);color:var(--text3);
      font-size:0.75rem;cursor:pointer;display:flex;align-items:center;justify-content:center;
    `
    closeBtn.textContent = '✕'
    closeBtn.addEventListener('click', () => overlay.remove())
    modal.appendChild(closeBtn)

    // 아이콘
    const iconWrap = document.createElement('div')
    iconWrap.style.cssText = 'width:176px;height:176px;display:flex;align-items:center;justify-content:center;font-size:4.8rem;flex-shrink:0;margin:0 auto 2px;opacity:0.72;'
    if (role.icon?.endsWith('.png')) {
      const img = document.createElement('img')
      img.src = `./asset/new/Icon_${role.icon}`
      img.style.cssText = 'width:100%;height:100%;object-fit:contain;'
      iconWrap.appendChild(img)
    } else {
      iconWrap.textContent = role.iconEmoji || '?'
    }
    modal.appendChild(iconWrap)

    // 역할명
    const nameEl = document.createElement('div')
    nameEl.style.cssText = `font-family:'Noto Serif KR',serif;font-size:1.45rem;font-weight:700;text-align:center;line-height:1.2;color:var(--pu-light);`
    nameEl.textContent = role.name
    modal.appendChild(nameEl)

    // 배지 + 위치
    const badge = document.createElement('span')
    badge.className = 'badge badge-traveller'
    badge.textContent = '여행자'
    const badgeWrap = document.createElement('div')
    badgeWrap.style.cssText = 'text-align:center;margin:4px 0;'
    badgeWrap.appendChild(badge)
    modal.appendChild(badgeWrap)

    // 진영 표시
    const alignment = traveller.alignment || 'good'
    const alignBadge = document.createElement('span')
    alignBadge.className = `badge ${alignment === 'evil' ? 'badge-evil' : 'badge-good'}`
    alignBadge.textContent = alignment === 'evil' ? '악 Evil' : '선 Good'
    alignBadge.style.marginLeft = '6px'
    badgeWrap.appendChild(alignBadge)

    const afterSeat = traveller.afterSeat || playerCount
    const nextSeat = afterSeat < playerCount ? afterSeat + 1 : 1
    const posInfo = document.createElement('div')
    posInfo.style.cssText = 'font-size:0.72rem;color:var(--text3);text-align:center;margin-top:4px;'
    posInfo.textContent = `📍 ${afterSeat}번 — ${nextSeat}번 사이`
    modal.appendChild(posInfo)

    // 능력 설명
    if (role.ability) {
      const abilityEl = document.createElement('div')
      abilityEl.style.cssText = `background:var(--surface2);border:1px solid var(--lead2);border-radius:8px;padding:16px 18px;font-size:1.0rem;color:var(--text2);line-height:1.75;text-align:center;width:100%;margin-top:8px;`
      abilityEl.textContent = role.ability
      modal.appendChild(abilityEl)
    }

    // 삭제 버튼
    const delBtn = document.createElement('button')
    delBtn.style.cssText = `width:100%;padding:11px 0;border-radius:8px;font-size:0.82rem;margin-top:8px;background:rgba(200,40,40,0.15);border:1px solid rgba(200,40,40,0.4);color:var(--rd-light);cursor:pointer;`
    delBtn.textContent = '🗑 여행자 제거'
    delBtn.addEventListener('click', () => {
      travellers.splice(travellerIndex, 1)
      this._saveHostTravellers(travellers)
      overlay.remove()
      this._switchTab('seats')
    })
    modal.appendChild(delBtn)

    overlay.appendChild(modal)
    document.body.appendChild(overlay)
    requestAnimationFrame(() => { overlay.style.opacity = '1' })
  }
}
