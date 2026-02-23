# 2026-02-23 Devlog — 허브 통합 및 초기 설정

비개발자가 "프로젝트를 허브에 등록하고 접속 테스트하고 싶다"는 요청으로 시작한 세션 기록.

## 오늘의 목표

- `src/` 폴더에 서버 접속 테스트용 빈 페이지 생성
- Weeks Game Hub에 프로젝트 등록하여 허브 홈페이지에서 접속 가능하게 만들기
- GitHub Pages 설정으로 외부 접속 가능하게 배포 준비
- 허브 서버 실행 시 프로젝트 로드 상태 콘솔에 출력

## 사용한 요청(프롬프트)와 결과

### 1) 서버 접속 테스트 페이지 생성

**요청**
> 그럼 이제 src 폴더 아래. 서버 접속 테스트 할 수 있는 빈 페이지 추가하고. F:\Workspace\hub\README.md 참고해서, 허브 홈 페이지에서도 접속 할 수 있게 추가. 그리고 github pages 에도 등록

**LLM의 접근**
1. 현재 프로젝트 구조 확인 (src 폴더가 비어있음)
2. hub README와 hub.config.json 읽어서 다른 프로젝트들의 등록 방식 파악
3. Clocktower-Pocket README 읽어서 프로젝트 성격 이해 (정적 P2P 웹앱)

**결과**
- `src/index.html` 생성: 깔끔한 그라데이션 UI로 접속 상태, 프로젝트 정보, 실시간 타임스탬프 표시
- 연결 테스트 버튼과 자동 갱신 기능 포함
- 모바일 반응형 디자인 적용

**확인 포인트**
- `src/index.html` 파일이 생성되었는지 확인
- 브라우저로 직접 열어서 UI가 제대로 보이는지 테스트

**관련 파일**
- `src/index.html`

### 2) 허브 설정 파일에 프로젝트 추가

**요청**
- (위 요청에 포함)

**LLM의 접근**
1. `F:\Workspace\hub\hub.config.json` 읽어서 기존 프로젝트들의 설정 형식 확인
2. Clocktower-Pocket의 특성에 맞는 설정 작성:
   - `type: "static"` (서버 실행 없는 정적 파일)
   - `staticDir: "Clocktower-Pocket/src"` (src 폴더 서빙)
   - `tags: ["party", "social", "p2p"]` (게임 특성 반영)
   - `status: "개발 중"` (아직 초기 단계)

**결과**
- `hub.config.json`에 Clocktower-Pocket 항목 추가 (마지막 앱으로 등록)
- 프로젝트 ID: `clocktower-pocket`
- 라우트: `/games/clocktower-pocket/`

**확인 포인트**
- `hub.config.json` 마지막에 clocktower-pocket 항목이 있는지 확인
- JSON 문법 오류가 없는지 검증 (`python -m json.tool` 통과)

**관련 파일**
- `F:\Workspace\hub\hub.config.json`

### 3) GitHub Pages 배포 워크플로우 추가

**요청**
- (위 요청에 포함)

**LLM의 접근**
1. GitHub Actions를 사용한 자동 배포 워크플로우 작성
2. `src/` 폴더만 배포하도록 설정 (프로젝트 파일은 제외)
3. main 브랜치 푸시 시 자동 배포되도록 구성

**결과**
- `.github/workflows/deploy.yml` 생성
- GitHub Actions로 src 폴더를 GitHub Pages에 자동 배포
- 배포 후 URL: `https://yangjin-krafton.github.io/Clocktower-Pocket/`

**확인 포인트**
- `.github/workflows/deploy.yml` 파일 존재 확인
- 커밋 후 GitHub Settings > Pages에서 Source를 "GitHub Actions"로 설정

**관련 파일**
- `.github/workflows/deploy.yml`

### 4) 허브 홈페이지에 프로젝트가 보이지 않는 문제

**상황**
- 사용자가 허브를 실행했는데 Clocktower-Pocket이 보이지 않음
- HTML 소스에서 "🚧 개발중" 섹션 헤더는 확인됨

**원인 파악**
- 허브 서버가 이미 실행 중인 상태에서 `hub.config.json`을 수정했기 때문
- 허브 서버는 시작 시점에만 설정을 읽어들임

**해결**
- 허브 서버 재시작 안내 (Ctrl+C → `hub` 재실행)
- 재시작 후 브라우저 새로고침

**결과**
- 재시작 후 "🚧 개발중" 섹션에 Clocktower Pocket 카드 표시 확인

**배운 점**
- 설정 파일 변경 후에는 반드시 서버 재시작 필요
- 런타임 중 동적 변경은 별도 API(`/api/register`)로 가능하지만, 정적 설정은 재시작 필요

### 5) 허브 서버 로그 출력 추가

**요청**
> 서버 실행 할 때, 콘솔 log 출력 하게 해줘

**맥락**
- 사용자가 허브 실행 시 다른 프로젝트들(Dating Show, Dungeon Explorer 등)의 서버 시작 로그는 보이지만
- 정적 앱(Clocktower-Pocket)은 별도 프로세스가 없어서 로그가 없음
- 프로젝트가 제대로 로드되었는지 확인하고 싶음

**LLM의 접근**
1. `launcher_main.py` 확인: 앱을 로드하는 로직 위치 파악
2. `launcher_server.py` 확인: HTTP 요청 로그가 비활성화되어 있음 발견
3. 두 가지 로그 추가:
   - 서버 시작 시 모든 앱의 로드 상태 출력 (정적/동적 구분)
   - 선택적 HTTP 요청 로그 (환경변수로 제어)

**결과**
- `launcher_main.py`에 앱 로드 로그 추가:
  ```
  [hub] loading 14 app(s)...
  [hub] clocktower-pocket (static): Clocktower Pocket - static files ready
  ```
- `launcher_server.py`에 HTTP 요청 로그 추가 (환경변수 `HUB_VERBOSE_LOG=1` 설정 시)

**확인 포인트**
- 허브 재시작 후 콘솔에서 다음 로그 확인:
  ```
  [hub] loading 14 app(s)...
  [hub] haminion (static): Haminion - static files ready
  [hub] clocktower-pocket (static): Clocktower Pocket - static files ready
  ...
  ```
- 정적 앱은 "static files ready", 서버 앱은 "starting..." 메시지 표시

**관련 파일**
- `F:\Workspace\hub\src\launcher\launcher_main.py` (38-51행)
- `F:\Workspace\hub\src\launcher\launcher_server.py` (564-567행)

## 다음에 이어서 할 일(요청 후보)

- [ ] GitHub에 변경사항 커밋 및 푸시
- [ ] GitHub Pages 설정 활성화 (Settings > Pages > Source: GitHub Actions)
- [ ] 배포된 페이지 접속 테스트 (`https://yangjin-krafton.github.io/Clocktower-Pocket/`)
- [ ] 실제 게임 기능 구현 시작 (방 생성, 플레이어 입장, WebRTC 연결 등)
- [ ] 썸네일 이미지 추가 (`thumbs/` 폴더에 스크린샷)

## 바이브 코딩 팁(비개발자 관점)

### 허브에 프로젝트 추가할 때
- `hub.config.json`에 프로젝트 정보만 추가하면 자동으로 메인 페이지에 카드 표시됨
- 정적 파일만 있는 프로젝트는 `type: "static"`, 서버가 필요하면 `type: "python"` 등으로 지정
- 설정 변경 후에는 **반드시 허브 서버 재시작** 필요 (이걸 모르면 "왜 안 보이지?" 하고 한참 헤맴)

### 로그의 중요성
- 초기 단계에서는 "뭔가 제대로 로드되었는지" 눈으로 확인할 수 있는 로그가 중요
- 정적 앱도 "로드되었다"는 메시지가 있으면 심리적으로 안심됨
- 문제가 생겼을 때 로그가 없으면 원인 파악이 어려움

### GitHub Pages 배포
- GitHub Actions를 사용하면 푸시만 해도 자동 배포됨
- 처음에는 Settings > Pages에서 Source를 수동으로 "GitHub Actions"로 설정해줘야 함
- 워크플로우 파일(`.github/workflows/*.yml`)을 먼저 푸시한 후에 설정하는 순서가 중요

---

**날짜**: 2026-02-23
**세션 시간**: 약 30분
**상태**: 허브 통합 완료, GitHub Pages 배포 준비 완료, 다음은 실제 게임 기능 구현 단계
