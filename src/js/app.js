/**
 * Clocktower Pocket — 통합 진입점
 * 랜딩 화면에서 호스트/참가자 모드를 선택한 뒤
 * 해당 앱 모듈을 동적으로 로드합니다.
 */

const content = document.getElementById('app-content')
const badge   = document.getElementById('app-badge')

function showLoading() {
  content.innerHTML = `
    <div style="text-align:center;padding:60px 20px;color:var(--text3)">
      <div style="font-size:2rem;margin-bottom:12px">⏳</div>
      <div>초기화 중...</div>
    </div>
  `
}

function showLanding() {
  badge.textContent = ''
  badge.style.display = 'none'

  content.innerHTML = `
    <div class="landing">
      <div class="landing__logo">🏰</div>
      <h1 class="landing__title">Clocktower Pocket</h1>
      <p class="landing__sub">Blood on the Clocktower 게임 도우미</p>

      <div class="landing__cards">
        <button class="landing__card landing__card--host" id="btn-host">
          <span class="landing__card-icon">👑</span>
          <span class="landing__card-title">스토리텔러</span>
          <span class="landing__card-desc">방을 만들고<br>게임을 진행합니다</span>
        </button>

        <button class="landing__card landing__card--player" id="btn-player">
          <span class="landing__card-icon">🎮</span>
          <span class="landing__card-title">참가자</span>
          <span class="landing__card-desc">방 코드를 입력하여<br>참가합니다</span>
        </button>
      </div>

      <div class="landing__divider"></div>
      <p class="landing__tip">
        서버 없는 P2P 연결 · WebRTC + Trystero
      </p>
    </div>
  `

  document.getElementById('btn-host').addEventListener('click', () => {
    badge.textContent = '호스트'
    badge.className = 'app-header__badge badge--host'
    badge.style.display = ''
    showLoading()
    import('./host/app.js').then(({ HostApp }) => new HostApp().init())
  })

  document.getElementById('btn-player').addEventListener('click', () => {
    badge.textContent = '참가자'
    badge.className = 'app-header__badge badge--player'
    badge.style.display = ''
    showLoading()
    import('./player/app.js').then(({ PlayerApp }) => new PlayerApp().init())
  })
}

showLanding()

// 개발 환경에서만 dev 콘솔 활성화 (localhost 또는 127.0.0.1)
if (location.hostname === 'localhost' || location.hostname === '127.0.0.1') {
  import('./dev-console.js').catch(e => console.warn('[DEV] dev-console 로드 실패:', e))
}
