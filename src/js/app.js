/**
 * Clocktower Pocket — 진입점
 * 스토리텔러 모드로 진입합니다.
 */

const content = document.getElementById('app-content')
const tabBar = document.getElementById('tab-bar')

let currentTab = 'role'
let appInstance = null

function buildTabs() {
  tabBar.innerHTML = ''
  const tabs = [
    { id: 'role',    icon: '🏠', label: '홈' },
    { id: 'memo',    icon: '📝', label: '메모' },
    { id: 'dict',    icon: '📖', label: '사전' },
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

function showLoading() {
  content.innerHTML = `
    <div style="text-align:center;padding:60px 20px;color:var(--text3)">
      <div style="font-size:2rem;margin-bottom:12px">⏳</div>
      <div>초기화 중...</div>
    </div>
  `
}

function showLanding() {
  content.innerHTML = `
    <div class="landing">
      <div class="landing__logo">🏰</div>
      <h1 class="landing__title">Clocktower Pocket</h1>
      <p class="landing__sub">Blood on the Clocktower 게임 도우미</p>

      <div class="landing__cards" style="grid-template-columns:1fr">
        <button class="landing__card landing__card--host" id="btn-host">
          <span class="landing__card-icon">👑</span>
          <span class="landing__card-title">스토리텔러</span>
          <span class="landing__card-desc">게임을 진행합니다</span>
        </button>
      </div>
    </div>
  `

  document.getElementById('btn-host').addEventListener('click', () => {
    showLoading()
    import('./host/app.js').then(({ HostApp }) => {
      const app = new HostApp()
      appInstance = app
      app.init()
    })
  })
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
