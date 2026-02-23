# 2026-02-24 Devlog — P2P 연결 테스트 구현 및 Hub External URL 지원

"GitHub Pages에서도 페이지 접속 잘 됩니다. 이제 다음 서버 테스트 진행 해줘요, 실제 p2p 처럼 유저 끼리 연결"로 시작한 세션 기록.

## 오늘의 목표

- P2P 연결을 위한 기본 구조 구현 (Host/Player 화면)
- Trystero 라이브러리를 사용한 WebRTC P2P 연결
- 실제 유저 간 메시지 송수신 테스트
- Hub에서 GitHub Pages로의 external URL 지원 구현

## 사용한 요청(프롬프트)와 결과

### 1) P2P 연결 테스트 시작

**요청**
> 이제 github 에서도 패이지 접속 잘됩니다. 이제 다음 서버 테스트 진행 해줘요, 실제 p2p 처럼 유저 끼리 연결

**LLM의 접근**
1. README.md를 읽어서 프로젝트의 P2P 구조 파악
   - Trystero 라이브러리 사용
   - BitTorrent 트래커 시그널링
   - Host(스토리텔러)와 Player(참가자) 구조
2. 필요한 파일 구조 계획:
   - `js/p2p.js`: P2P 연결 관리 모듈
   - `host.html`: 방장 화면 (방 생성, 참가자 관리)
   - `player.html`: 참가자 화면 (방 참가, 메시지 수신)
   - `index.html`: 메인 페이지 업데이트

**결과**
- Todo 리스트 작성으로 작업 계획 수립
- `src/js/` 디렉토리 생성
- `src/js/p2p.js` 생성: Trystero 기반 P2P 매니저 클래스
- `src/host.html` 생성: 방 생성 및 관리 화면
- `src/player.html` 생성: 방 참가 및 메시지 수신 화면
- `src/index.html` 업데이트: Host/Player 선택 메인 화면

**확인 포인트**
- 로컬 서버 실행 (포트 8080)
- host.html과 player.html이 각각 로드되는지 확인

**관련 파일**
- `src/js/p2p.js`
- `src/host.html`
- `src/player.html`
- `src/index.html`

### 2) 모듈 스크립트 스코프 오류 해결

**상황**
```
Uncaught ReferenceError: createRoom is not defined
```
- `onclick="createRoom()"` 인라인 이벤트 핸들러가 작동하지 않음
- Trystero CDN 경로도 404 오류

**원인 파악**
1. ES 모듈(`type="module"`)에서 선언한 함수는 전역 스코프에 노출되지 않음
2. Trystero CDN 경로가 잘못됨 (초기에 잘못된 경로 사용)

**해결**
1. 인라인 이벤트 핸들러 제거하고 `addEventListener`로 변경
2. `DOMContentLoaded` 이벤트에서 이벤트 리스너 등록
3. Enter 키 지원 추가 (UX 개선)
4. Trystero CDN을 여러 번 시도:
   - `esm.sh/trystero` → 404
   - `cdn.skypack.dev/trystero` → 404
   - 최종적으로 공식 문서 확인

**결과**
- 모든 버튼이 `addEventListener`로 작동
- Enter 키로도 방 참가/메시지 전송 가능

**배운 점**
- ES 모듈에서는 함수가 자동으로 전역에 노출되지 않음
- CDN 경로는 공식 문서를 먼저 확인해야 함

### 3) Trystero 공식 문서 확인 및 CDN 수정

**요청**
> https://github.com/dmotz/trystero 에서 해결 방법 찾기

**LLM의 접근**
1. WebFetch로 Trystero GitHub 공식 문서 확인
2. 올바른 CDN 경로 찾기:
   - `https://esm.run/trystero/torrent` (BitTorrent 전략)
   - `https://esm.run/trystero` (Nostr 전략, 기본값)

**결과**
- `js/p2p.js`에서 import 경로 수정:
  ```javascript
  import { joinRoom } from 'https://esm.run/trystero/torrent'
  ```

**확인 포인트**
- 브라우저 개발자 도구에서 404 오류가 사라졌는지 확인

### 4) 메시지 타입 이름 길이 제한 오류

**상황**
```
Error: Trystero: action type string "JOIN_RESPONSE" (13b) exceeds byte limit (12)
```
- Trystero는 메시지 타입 이름을 12바이트로 제한
- `JOIN_REQUEST`, `JOIN_RESPONSE`, `CHAT_MESSAGE` 등이 너무 김

**해결**
1. 메시지 타입 매핑 시스템 구현:
   - 긴 이름 → 짧은 이름 자동 변환
   - `JOIN_REQUEST` → `JOIN_REQ`
   - `JOIN_RESPONSE` → `JOINED`
   - `CHAT_MESSAGE` → `CHAT`
   - `NIGHT_ACTION` → `NIGHT_ACT`
2. 내부적으로 짧은 이름 사용, 외부 API는 긴 이름 유지
3. 자동 변환 로직으로 개발자가 신경 쓰지 않아도 되게 설계

**결과**
- 모든 메시지 타입이 12바이트 이하로 조정됨
- 외부에서는 여전히 `sendToPeer(peerId, 'CHAT_MESSAGE', data)` 형태로 사용 가능

**배운 점**
- 라이브러리의 제약사항을 미리 파악하는 것이 중요
- 내부 구현과 외부 API를 분리하면 유연성 확보 가능

### 5) crypto.subtle API 오류 - HTTP 환경 제한

**상황**
```
TypeError: Cannot read properties of undefined (reading 'importKey')
TypeError: Cannot read properties of undefined (reading 'digest')
```
- Trystero가 암호화를 위해 `crypto.subtle` API 사용
- HTTP 환경(localhost:8080)에서는 `crypto.subtle`이 제한됨
- WebSocket 트래커 연결도 실패

**LLM의 접근**
1. Trystero 공식 문서에서 암호화 비활성화 옵션 찾기 → 없음
2. HTTP 환경 해결 방법 찾기 → GitHub Issues 확인
3. 여러 해결 방법 검토:
   - 127.0.0.1 사용 (효과 불확실)
   - HTTPS 로컬 서버 (복잡)
   - GitHub Pages 배포 (가장 확실)

**결정**
- **GitHub Pages에 배포**하는 것이 가장 확실한 방법
- HTTPS가 자동으로 적용되어 crypto API 완벽 작동
- 원격에서도 접속 가능해 실제 P2P 테스트에 적합

**결과**
- GitHub Pages 배포를 목표로 설정
- Hub에서 GitHub Pages로 리다이렉트하는 구조 계획

### 6) Hub에 External URL 지원 구현

**요청**
> 아 그럼 홈 hub.config.json 에서 접속 링크도 github pages 로 잡아줘요. 로컬 말고

**상황**
- `hub.config.json`에 `externalUrl` 추가
- 하지만 Hub 애플리케이션이 실제로 이를 지원하는지 불분명

**LLM의 접근**
1. Task 에이전트로 Hub 코드 분석:
   - `launcher_project.py`: `app_route()` 함수
   - `launcher_render_cards.py`: 카드 렌더링
   - `launcher_server.py`: HTTP 라우팅
2. **발견**: `external` 타입과 `externalUrl` 필드가 구현되지 않음
3. 사용자에게 두 가지 옵션 제시:
   - Hub 코드 수정 (external URL 지원 구현)
   - Config를 원복 (static 유지)

**사용자 선택**
> 방법 1: Hub 코드 수정 (external URL 지원 구현)

**구현 내용**

1. **launcher_project.py** - `app_route()` 함수 수정
   ```python
   def app_route(app: dict) -> str:
       # External URL 타입인 경우 직접 URL 반환
       if app.get("type") == "external" and app.get("externalUrl"):
           return app.get("externalUrl")
       # ... 기존 로직
   ```

2. **launcher_render_cards.py** - 카드 렌더링 수정
   ```python
   # External URL인 경우 전체 URL을 그대로 사용
   is_external = app.get("type") == "external" and app.get("externalUrl")
   if is_external:
       display_url = route  # 이미 전체 URL
   else:
       display_url = f"http://{public_host}:{public_hub_port}{route}"
   ```

3. **launcher_server.py** - HTTP 라우팅에 리다이렉트 추가
   ```python
   # External URL 타입인 경우 리다이렉트
   if app.get("type") == "external" and app.get("externalUrl"):
       external_url = app.get("externalUrl")
       self.send_response(302)
       self.send_header("Location", external_url)
       self.end_headers()
       return
   ```

**결과**
- Hub가 이제 `type: "external"` 앱을 지원
- 카드 클릭 시 GitHub Pages로 자동 리다이렉트
- 다른 프로젝트에서도 재사용 가능한 기능

**확인 포인트**
- Hub 재시작 후 Clocktower Pocket 카드 확인
- 카드 클릭 시 GitHub Pages로 이동하는지 확인

**관련 파일**
- `F:\Workspace\hub\src\launcher\launcher_project.py`
- `F:\Workspace\hub\src\launcher\launcher_render_cards.py`
- `F:\Workspace\hub\src\launcher\launcher_server.py`
- `F:\Workspace\hub\hub.config.json`

### 7) GitHub Pages URL 경로 수정

**상황**
```
https://yangjin-krafton.github.io/Clocktower-Pocket/src/ → 404
```
- GitHub Actions가 `src` 디렉토리를 루트로 배포
- URL에 `/src/`가 필요 없음

**해결**
- `hub.config.json`의 `externalUrl` 수정:
  ```json
  "externalUrl": "https://yangjin-krafton.github.io/Clocktower-Pocket/"
  ```

**결과**
- 올바른 URL로 접속 가능
- Hub에서 카드 클릭 시 정상 작동

### 8) P2P 연결 테스트 성공! 🎉

**결과**
- GitHub Pages에서 HTTPS로 접속
- Host가 방 생성 → 6자리 코드 발급
- Player가 방 코드로 참가 → 연결 성공
- Host ↔ Player 간 메시지 송수신 확인
- Trystero Nostr 전략으로 안정적 연결

**사용자 피드백**
> 오 이제 연결 잘 도비니다. !!

## 구현된 기능

### P2P 연결 시스템
- **방 생성**: Host가 6자리 랜덤 코드로 방 생성
- **방 참가**: Player가 코드를 입력하여 방 참가
- **실시간 메시지**: Host와 Player 간 양방향 메시지 전송
- **연결 상태 표시**: 연결/연결 끊김/연결 중 상태 실시간 표시
- **참가자 목록**: Host 화면에서 연결된 플레이어 실시간 확인

### Hub External URL 지원
- **외부 URL 리다이렉트**: Hub 카드 클릭 시 외부 URL로 자동 이동
- **카드 표시 개선**: External 앱은 전체 URL이 표시됨
- **재사용 가능**: 다른 프로젝트에서도 GitHub Pages나 외부 배포 사이트 링크 가능

## 문제 & 해결

### 1) Trystero CDN 경로 찾기
- **문제**: 여러 CDN 시도했지만 404 오류 계속 발생
- **해결**: 공식 GitHub 문서 확인 → `esm.run` 사용 확인
- **교훈**: 라이브러리 문제는 공식 문서를 먼저 확인

### 2) 메시지 타입 이름 길이 제한
- **문제**: Trystero가 12바이트 제한을 두고 있음
- **해결**: 내부 매핑 시스템 구현으로 자동 변환
- **교훈**: 라이브러리 제약사항은 추상화 레이어로 숨길 수 있음

### 3) HTTP 환경에서 crypto API 제한
- **문제**: localhost HTTP에서 `crypto.subtle`이 undefined
- **해결**: GitHub Pages(HTTPS) 배포로 근본적 해결
- **교훈**: 보안 API는 HTTPS 환경이 필수

### 4) Hub가 external URL을 지원하지 않음
- **문제**: Config에 필드를 추가했지만 코드가 없음
- **해결**: Hub 코드 3개 파일 수정으로 기능 구현
- **교훈**: 인프라 개선도 프로젝트 개발의 일부

## 다음에 할 일

- [ ] 실제 게임 로직 구현
  - [ ] 플레이어 역할 배정
  - [ ] 밤/낮 페이즈 관리
  - [ ] 투표 시스템
- [ ] UI 개선
  - [ ] QR 코드 생성 (방 코드 공유)
  - [ ] 모바일 최적화
  - [ ] 역할 카드 디자인
- [ ] 에러 처리 강화
  - [ ] 연결 실패 시 재시도 로직
  - [ ] 네트워크 불안정 대응
- [ ] 썸네일 이미지 추가 (현재 placeholder)

## 비개발자 관점의 인사이트

### P2P는 생각보다 복잡하다
- "서버 없이 직접 연결"이라는 개념은 간단해 보이지만
- 실제로는 시그널링, 암호화, 보안 컨텍스트 등 많은 제약이 있음
- HTTP/HTTPS 차이가 기능 작동 여부에 직접적 영향을 줌

### 오류 메시지는 단서다
- `12바이트 제한` 오류 → 메시지 타입 이름을 줄여야 함
- `crypto.subtle undefined` → HTTPS가 필요함
- 오류를 무시하지 말고 정확히 읽으면 해결 방향을 알려줌

### 인프라도 같이 성장한다
- Clocktower Pocket을 만들면서 Hub도 개선됨
- External URL 지원은 이 프로젝트만의 기능이 아님
- 다른 프로젝트들도 이 기능을 활용 가능

### GitHub Pages는 강력하다
- 무료 HTTPS 호스팅
- Git push만 하면 자동 배포
- P2P 앱처럼 서버가 필요 없는 경우 완벽한 선택

---

**날짜**: 2026-02-24
**세션 시간**: 약 2시간
**상태**: P2P 연결 테스트 성공! 다음은 실제 게임 로직 구현 단계
