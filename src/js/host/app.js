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
import { encodeRoomCode, formatCode }           from '../room-code.js'
import { GameSaveManager }                      from '../GameSaveManager.js'

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
    this.pendingPlayerCount = DEFAULT_PLAYER_COUNT
    this.seatRoles          = new Array(DEFAULT_PLAYER_COUNT).fill(null)
    this._buildTabs()
    this._switchTab('role')
  }

  /**
   * 세이브 데이터로부터 게임 복원 후 진입
   * @param {string} saveId  GameSaveManager 슬롯 ID
   */
  initFromSave(saveId) {
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
  }

  _switchTab(tabId) {
    this.currentTab = tabId
    this.tabBar.querySelectorAll('.tab-item').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.tab === tabId)
    })

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
        const memo = new Memo()
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
      }),
      onStartGame:         () => this._handleManualStart(),
      onStartNight:        () => this._handleStartNight(),
      onStartDay:          () => this._handleStartDay(),
      onNextNightStep:     () => this._handleNextNightStep(),
      onPlayerAction:      (action, id) => this._handlePlayerAction(action, id),
      onPlayerCountChange: (n) => {
        const newN = Math.max(5, Math.min(20, n))
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
        this._grimoire?.refresh()
      },
      onAutoAssign: () => {
        this.seatRoles = this._autoRoles(this.pendingPlayerCount)
        this._grimoire?.refresh()
      },
    })

    grimoire.mount(this.container)
    this.currentScreen = grimoire
    this._grimoire     = grimoire

    // 게임 중이면 나가기 버튼 삽입
    if (this._gameStarting) this._insertExitButton()

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

    // 방 코드 생성
    const code = encodeRoomCode(this.pendingPlayerCount, assignedRoles, redHerringId)
    this._lastRoomCode = code

    // 코드 팝업 표시 → 닫으면 게임 시작
    this._showCodePopup(code, assignedRoles, () => {
      this._gameStarting = true
      const names = Array.from({ length: this.pendingPlayerCount }, (_, i) => `플레이어${i + 1}`)
      engine.reset()
      this._history.reset()
      engine.initGame(names, assignedRoles, { preAssigned: true, redHerringId })
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
      this.tabBar.querySelectorAll('.tab-item').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.tab === 'role')
      })
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
    box.style.cssText = 'max-height:88vh;overflow-y:auto;padding:20px 16px;'

    // 제목
    const title = document.createElement('div')
    title.style.cssText = 'font-family:"Noto Serif KR",serif;font-size:1rem;font-weight:700;color:var(--gold2);margin-bottom:16px;text-align:center;'
    title.textContent = '🏰 방 코드가 생성되었습니다'
    box.appendChild(title)

    // 방 코드 표시
    const codeDisplay = document.createElement('div')
    codeDisplay.style.cssText = `
      background:var(--surface2);border:2px solid var(--gold2);border-radius:10px;
      padding:14px 10px;text-align:center;margin-bottom:16px;cursor:pointer;
    `
    const formatted = formatCode(code)
    codeDisplay.innerHTML = `
      <div style="font-size:1.6rem;font-weight:900;letter-spacing:0.2em;color:var(--gold2);font-family:monospace">${formatted}</div>
      <div style="font-size:0.65rem;color:var(--text4);margin-top:6px;">탭하여 복사</div>
    `
    codeDisplay.addEventListener('click', () => {
      navigator.clipboard?.writeText(code).catch(() => {})
      codeDisplay.querySelector('div:last-child').textContent = '✓ 복사됨!'
      setTimeout(() => { codeDisplay.querySelector('div:last-child').textContent = '탭하여 복사' }, 1500)
    })
    box.appendChild(codeDisplay)

    // 자리별 역할 목록
    const listTitle = document.createElement('div')
    listTitle.style.cssText = 'font-size:0.75rem;color:var(--text3);margin-bottom:8px;font-weight:600;'
    listTitle.textContent = '자리별 역할 배정 (호스트 전용)'
    box.appendChild(listTitle)

    const list = document.createElement('div')
    list.style.cssText = 'display:flex;flex-direction:column;gap:4px;margin-bottom:20px;'
    assignedRoles.forEach((roleId, i) => {
      const role = ROLES_BY_ID[roleId]
      const teamColor = {
        townsfolk: 'var(--bl-light)', outsider: 'var(--tl-light)',
        minion: 'var(--rd-light)', demon: 'var(--rd-light)',
      }[role?.team] || 'var(--text2)'

      const row = document.createElement('div')
      row.style.cssText = 'display:flex;align-items:center;gap:10px;padding:6px 10px;background:var(--surface2);border-radius:6px;'

      const seatBadge = document.createElement('span')
      seatBadge.style.cssText = 'font-size:0.7rem;background:var(--lead2);color:var(--text3);border-radius:4px;padding:2px 7px;min-width:36px;text-align:center;'
      seatBadge.textContent = `자리 ${i + 1}`

      const iconSpan = document.createElement('span')
      iconSpan.style.cssText = 'width:22px;height:22px;display:inline-flex;align-items:center;justify-content:center;flex-shrink:0;'
      if (role?.icon?.endsWith('.png')) {
        const img = document.createElement('img')
        img.src = `./asset/icons/${role.icon}`
        img.style.cssText = 'width:100%;height:100%;object-fit:contain;'
        iconSpan.appendChild(img)
      } else {
        iconSpan.textContent = role?.iconEmoji || '?'
      }

      const nameSpan = document.createElement('span')
      nameSpan.style.cssText = `font-size:0.82rem;font-weight:600;color:${teamColor};`
      nameSpan.textContent = role?.name || roleId

      row.appendChild(seatBadge)
      row.appendChild(iconSpan)
      row.appendChild(nameSpan)
      list.appendChild(row)
    })
    box.appendChild(list)

    // 안내 문구
    const hint = document.createElement('div')
    hint.style.cssText = 'font-size:0.68rem;color:var(--text4);text-align:center;margin-bottom:16px;line-height:1.6;'
    hint.textContent = '참가자에게 방 코드와 자리 번호를 알려주세요.\n참가자는 앱에서 코드 + 자리 번호로 자신의 역할을 확인합니다.'
    hint.style.whiteSpace = 'pre-line'
    box.appendChild(hint)

    // 게임 시작 버튼
    const startBtn = document.createElement('button')
    startBtn.className = 'btn btn-gold btn-full'
    startBtn.style.cssText = 'padding:14px;font-size:0.95rem;'
    startBtn.textContent = '▶ 게임 시작 (스토리텔러 화면)'
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
    this.tabBar.querySelectorAll('.tab-item').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.tab === 'role')
    })
    this._showGrimoire()
  }

  _handleStartDay() {
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
    this.tabBar.querySelectorAll('.tab-item').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.tab === 'role')
    })
    this._showDayFlow()
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
          const roleName = ROLES_BY_ID[roleId]?.name || roleId
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
    this._insertExitButton()
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
        this._lastRoomCode = null
        this._switchTab('role')
      },
    })
    victory.mount(this.container)
    this.currentScreen = victory
  }

  _handlePlayerAction(action, actorId) {}

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

  _insertExitButton() {
    const btn = document.createElement('button')
    btn.style.cssText = `
      position:absolute;top:8px;right:8px;z-index:20;
      background:rgba(255,255,255,0.06);border:1px solid var(--lead2);
      border-radius:8px;padding:4px 10px;cursor:pointer;
      font-size:0.62rem;color:var(--text4);
      display:flex;align-items:center;gap:4px;
    `
    btn.textContent = '🏠 나가기'
    btn.addEventListener('click', () => this._showExitConfirm())
    this.container.style.position = 'relative'
    this.container.appendChild(btn)
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
        <div style="text-align:center;padding:60px 20px;color:var(--text3)">
          <div style="font-size:2rem;margin-bottom:12px">🪑</div>
          <div>게임 시작 후 이용 가능합니다</div>
        </div>`
      return
    }

    const { players } = state
    const total = players.length
    const RX = 43, RY = 43
    const slotPx = total <= 6 ? 62 : total <= 9 ? 56 : total <= 13 ? 50 : total <= 16 ? 44 : 38
    const iconPx = Math.round(slotPx * 0.62)

    const TEAM_BORDER = {
      townsfolk: 'rgba(46,74,143,0.65)',
      outsider:  'rgba(91,179,198,0.65)',
      minion:    'rgba(140,40,50,0.65)',
      demon:     'rgba(160,30,40,0.9)',
    }

    const el = document.createElement('div')
    el.style.cssText = 'padding:8px 0 4px;'

    const sub = document.createElement('div')
    sub.style.cssText = 'text-align:center;font-size:0.65rem;color:var(--text4);margin-bottom:4px;'
    sub.textContent = `${total}인 게임 · 호스트 전용 전체 공개`
    el.appendChild(sub)

    const oval = document.createElement('div')
    oval.style.cssText = 'position:relative;width:100%;aspect-ratio:2/3;overflow:visible;'

    players.forEach((player, i) => {
      const role  = ROLES_BY_ID[player.role]
      const angle = (2 * Math.PI * i) / total - Math.PI / 2
      const x = 50 + RX * Math.cos(angle)
      const y = 50 + RY * Math.sin(angle)
      const isDead = player.status !== 'alive'

      const slot = document.createElement('div')
      slot.style.cssText = `
        position:absolute;left:${x.toFixed(2)}%;top:${y.toFixed(2)}%;
        width:${slotPx}px;height:${slotPx}px;
        transform:translate(-50%,-50%);
        border-radius:8px;display:flex;flex-direction:column;
        align-items:center;justify-content:center;
        cursor:pointer;border:2px solid ${TEAM_BORDER[role?.team] || 'var(--lead2)'};
        background:var(--surface);
        ${isDead ? 'opacity:0.38;filter:grayscale(0.65);' : ''}
      `

      const iconEl = document.createElement('div')
      iconEl.style.cssText = `
        width:${iconPx}px;height:${iconPx}px;border-radius:50%;
        background:var(--surface2);overflow:hidden;
        display:flex;align-items:center;justify-content:center;
        font-size:${Math.round(iconPx * 0.58)}px;
      `
      if (role?.icon?.endsWith('.png')) {
        const img = document.createElement('img')
        img.src = `./asset/icons/${role.icon}`
        img.style.cssText = 'width:100%;height:100%;object-fit:contain;'
        iconEl.appendChild(img)
      } else { iconEl.textContent = role?.iconEmoji || '?' }
      slot.appendChild(iconEl)

      const badge = document.createElement('span')
      badge.style.cssText = `
        position:absolute;bottom:-4px;right:-4px;
        min-width:14px;height:14px;padding:0 3px;border-radius:7px;
        background:var(--surface2);border:1px solid var(--lead2);
        font-size:0.48rem;font-weight:700;color:var(--text3);
        display:flex;align-items:center;justify-content:center;z-index:1;
      `
      badge.textContent = player.id
      slot.appendChild(badge)

      slot.addEventListener('click', () => {
        document.getElementById('host-seat-popup')?.remove()
        const ov = document.createElement('div')
        ov.className = 'popup-overlay'
        ov.id = 'host-seat-popup'
        const box = document.createElement('div')
        box.className = 'popup-box'
        box.style.padding = '16px'
        const teamLabel = { townsfolk:'마을 주민', outsider:'아웃사이더', minion:'미니언', demon:'데몬' }
        box.innerHTML = `
          <div style="display:flex;align-items:center;gap:10px;margin-bottom:14px;">
            <div style="font-size:2rem;">${role?.iconEmoji || '?'}</div>
            <div>
              <div style="font-weight:700;font-size:0.92rem;color:var(--text)">${player.id}번 자리</div>
              <div style="font-size:0.72rem;color:var(--text3)">${role?.name || player.role} · ${teamLabel[role?.team] || ''}</div>
              <div style="font-size:0.68rem;margin-top:2px;color:${isDead ? 'var(--rd-light)' : 'var(--tl-light)'}">${isDead ? '💀 사망' : '✅ 생존'}${player.isPoisoned ? ' · ☠ 중독' : ''}${player.isDrunk ? ' · 🍾 취함' : ''}</div>
            </div>
          </div>
          <div style="font-size:0.68rem;color:var(--text4);line-height:1.5;">${role?.ability || ''}</div>
        `
        const closeBtn = document.createElement('button')
        closeBtn.className = 'btn btn-full'
        closeBtn.style.marginTop = '12px'
        closeBtn.textContent = '닫기'
        closeBtn.addEventListener('click', () => ov.remove())
        box.appendChild(closeBtn)
        ov.appendChild(box)
        ov.addEventListener('click', e => { if (e.target === ov) ov.remove() })
        document.body.appendChild(ov)
      })

      oval.appendChild(slot)
    })

    el.appendChild(oval)
    this.container.appendChild(el)
  }
}
