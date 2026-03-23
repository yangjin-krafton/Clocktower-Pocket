/**
 * Clocktower Pocket — 진입점
 * 이야기꾼 모드로 진입합니다.
 */
import { GameSaveManager } from './GameSaveManager.js'
import { ThemeManager }    from './ThemeManager.js'
import { ScheduleCalendar } from './components/ScheduleCalendar.js'

const content = document.getElementById('app-content')
const tabBar = document.getElementById('tab-bar')
const PLAYER_SESSION_KEY = 'ctp_player_session'

let currentTab = 'role'
let appInstance = null

function getIncomingRoomCode() {
  return new URLSearchParams(location.search).get('code') || ''
}

function launchPlayerApp() {
  showLoading()
  import('./player/app.js').then(({ PlayerApp }) => {
    const app = new PlayerApp()
    appInstance = app
    app.init()
  })
}

function launchHostApp() {
  showLoading()
  import('./host/app.js').then(({ HostApp }) => {
    const app = new HostApp()
    appInstance = app
    app.init()
  })
}

function buildTabs() {
  tabBar.innerHTML = ''
  const tabs = [
    { id: 'role',    icon: '🏠', label: '홈' },
    { id: 'memo',    icon: '📝', label: '메모' },
    { id: 'dict',    icon: '🃏', label: '역할' },
    { id: 'rules',   icon: '📜', label: '규칙' },
  ]

  tabs.forEach(tab => {
    const btn = document.createElement('button')
    btn.className = 'tab-item' + (tab.id === currentTab ? ' active' : '')
    btn.dataset.tab = tab.id
    btn.innerHTML = `<span class="tab-icon">${tab.icon}</span><span class="tab-label">${tab.label}</span>`
    btn.addEventListener('click', () => window.switchTab(tab.id))
    tabBar.appendChild(btn)
  })
}

function switchTab(tabId) {
  currentTab = tabId

  // 앱이 로드되었으면 앱의 switchTab 호출
  if (appInstance && appInstance._switchTab) {
    appInstance._switchTab(tabId)
    return
  }

  // 앱이 로드되지 않았으면 기본 탭 처리
  tabBar.querySelectorAll('.tab-item').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.tab === tabId)
  })

  if (tabId === 'role') {
    showLanding()
  } else if (tabId === 'rules') {
    showRules()
  } else if (tabId === 'memo') {
    showMemo()
  } else if (tabId === 'dict') {
    showDict()
  }
}

// 앱이 탭바를 재빌드할 때 이 함수를 사용하도록 export
window.switchTab = switchTab

// 어디서든 랜딩 화면으로 복귀
window.goHome = () => {
  appInstance = null
  currentTab  = 'role'
  ThemeManager.set(null)  // 랜딩 기본 테마로 복원
  buildTabs()
  showLanding()
}

window.goHome = () => {
  appInstance = null
  currentTab  = 'role'
  if (location.search) {
    history.replaceState(null, '', location.pathname)
  }
  ThemeManager.set(null)
  buildTabs()
  showLanding()
}

function showLoading() {
  content.innerHTML = `
    <div class="empty-state">
      <div class="empty-state__icon">⏳</div>
      <div>초기화 중...</div>
    </div>
  `
}

function showLanding() {
  if (getIncomingRoomCode()) {
    launchPlayerApp()
    return
  }

  content.innerHTML = ''

  const wrap = document.createElement('div')
  wrap.className = 'landing'

  // 헤더
  wrap.innerHTML = `
    <div class="landing__logo">🏰</div>
    <h1 class="landing__title">Clocktower Pocket</h1>
    <p class="landing__sub">Blood on the Clocktower 게임 도우미</p>

    <div id="schedule-calendar-slot"></div>

    <div class="landing__cards">
      <button class="landing__card landing__card--host" id="btn-host">
        <span class="landing__card-icon">👑</span>
        <span class="landing__card-title">이야기꾼</span>
        <span class="landing__card-desc">방을 만들고<br>게임을 진행합니다</span>
      </button>

      <button class="landing__card landing__card--player" id="btn-player">
        <span class="landing__card-icon">🎮</span>
        <span class="landing__card-title">참가자</span>
        <span class="landing__card-desc">방 코드를 입력하여<br>내 역할을 확인합니다</span>
      </button>
    </div>
  `
  content.appendChild(wrap)

  // 일정 조율 캘린더
  const calSlot = document.getElementById('schedule-calendar-slot')
  const cal = new ScheduleCalendar()
  cal.mount(calSlot)

  // 새 게임 버튼
  document.getElementById('btn-host').addEventListener('click', () => {
    launchHostApp()
  })

  document.getElementById('btn-player').addEventListener('click', () => {
    launchPlayerApp()
  })

  // ── 저장된 게임 목록 ──
  renderSavedGames(wrap)
}

function renderSavedGames(container) {
  // 호스트 세이브 목록
  const hostSaves = GameSaveManager.listSaves()

  // 참가자 세션
  let playerSession = null
  try {
    const raw = localStorage.getItem(PLAYER_SESSION_KEY)
    if (raw) playerSession = JSON.parse(raw)
  } catch {}

  const hasAny = hostSaves.length > 0 || playerSession

  if (!hasAny) return

  const section = document.createElement('div')
  section.className = 'save-section'

  // 구분선
  const divider = document.createElement('div')
  divider.className = 'landing__divider'
  section.appendChild(divider)

  // 제목
  const title = document.createElement('div')
  title.className = 'save-section__title'
  title.textContent = '저장된 게임'
  section.appendChild(title)

  const list = document.createElement('div')
  list.className = 'save-list'

  // 참가자 세션 카드
  if (playerSession) {
    const card = createSaveCard({
      icon: '🎮',
      label: `참가자 · 자리 ${playerSession.seatNum}번`,
      sub: `방 ${formatCodeShort(playerSession.code)}`,
      onResume: () => {
        showLoading()
        import('./player/app.js').then(({ PlayerApp }) => {
          const app = new PlayerApp()
          appInstance = app
          app.init()
        })
      },
      onDelete: () => {
        localStorage.removeItem(PLAYER_SESSION_KEY)
        renderSavedGames(container)
      },
    })
    list.appendChild(card)
  }

  // 호스트 세이브 카드
  hostSaves.forEach(meta => {
    const phaseKo = { lobby: '로비', night: '밤', day: '낮' }[meta.phase] || meta.phase
    const card = createSaveCard({
      icon: '👑',
      label: `${meta.playerCount}인 ${phaseKo}${meta.round > 0 ? meta.round : ''}`,
      sub: `방 ${formatCodeShort(meta.roomCode)} · ${GameSaveManager.formatTimeAgo(meta.updatedAt)}`,
      onResume: () => {
        showLoading()
        import('./host/app.js').then(({ HostApp }) => {
          const app = new HostApp()
          appInstance = app
          app.initFromSave(meta.id)
        })
      },
      onDelete: () => {
        GameSaveManager.delete(meta.id)
        // 목록 다시 렌더
        section.remove()
        renderSavedGames(container)
      },
    })
    list.appendChild(card)
  })

  section.appendChild(list)

  // 기존 섹션 교체
  const existing = container.querySelector('[data-save-section]')
  if (existing) existing.remove()
  section.dataset.saveSection = '1'
  container.appendChild(section)
}

function createSaveCard({ icon, label, sub, onResume, onDelete }) {
  const card = document.createElement('div')
  card.className = 'save-card'

  // 아이콘
  const iconEl = document.createElement('span')
  iconEl.className = 'save-card__icon'
  iconEl.textContent = icon
  card.appendChild(iconEl)

  // 텍스트
  const textCol = document.createElement('div')
  textCol.className = 'save-card__text'
  textCol.innerHTML = `
    <div class="save-card__label">${label}</div>
    <div class="save-card__sub">${sub}</div>
  `
  card.appendChild(textCol)

  // 버튼
  const btnCol = document.createElement('div')
  btnCol.className = 'save-card__btns'

  const resumeBtn = document.createElement('button')
  resumeBtn.className = 'save-card__resume'
  resumeBtn.textContent = '이어하기'
  resumeBtn.addEventListener('click', onResume)
  btnCol.appendChild(resumeBtn)

  const delBtn = document.createElement('button')
  delBtn.className = 'save-card__del'
  delBtn.textContent = '삭제'
  delBtn.addEventListener('click', (e) => {
    e.stopPropagation()
    if (confirm('이 저장 데이터를 삭제하시겠습니까?')) onDelete()
  })
  btnCol.appendChild(delBtn)

  card.appendChild(btnCol)
  return card
}

function formatCodeShort(code) {
  if (!code) return '—'
  return code.match(/.{1,4}/g)?.join('-') ?? code
}

function showRules() {
  import('./components/RulesScreen.js').then(({ RulesScreen }) => {
    content.innerHTML = ''
    const initialPage = _pendingRulesPage || 'index.md'
    _pendingRulesPage = null
    const rules = new RulesScreen({ initialPage })
    rules.mount(content)
  })
}

function showMemo() {
  import('./player/Memo.js').then(({ Memo }) => {
    content.innerHTML = ''
    const memo = new Memo()
    memo.mount(content)
  })
}

let _pendingRulesPage = null

function showDict() {
  import('./player/CharacterDict.js').then(({ CharacterDict }) => {
    content.innerHTML = ''
    const dict = new CharacterDict({
      scriptRoles: null,
      onRoleClick: (roleId) => {
        _pendingRulesPage = `${roleId}.md`
        switchTab('rules')
      },
    })
    dict.mount(content)
  })
}

// 초기화
tabBar.style.display = 'flex'
buildTabs()
showLanding()
