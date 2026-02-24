# 2026-02-25 개발 로그 — P2P 연결 안정성 개선

"트래커 연결 실패와 멀티플레이어 불안정 문제를 해결하고 싶다"는 요청으로 시작한 세션 기록.

## 📋 세션 요약

WebTorrent 트래커 불안정으로 피어 연결이 실패하는 문제를 해결하고, Trystero 전략을 여러 번 변경하며 최종적으로 Nostr 전략으로 5명 동시 접속에 성공한 세션.

---

## 🗣️ 작업 흐름

### 1. WebTorrent 트래커 연결 실패 문제 발견

**상황**
- 사용자가 Host에서 방을 만들고 Player가 참가하려 했지만 연결이 안 됨
- 콘솔에 계속 WebSocket 트래커 연결 실패 에러 반복:
  ```
  WebSocket connection to 'wss://tracker.btorrent.xyz/' failed
  WebSocket connection to 'wss://tracker.webtorrent.dev/' failed
  ```

**원인 파악**
- Trystero가 기본으로 사용하는 WebTorrent 트래커들이 불안정함
- `tracker.btorrent.xyz`와 `tracker.webtorrent.dev`가 과부하 또는 다운 상태
- 사용자는 트래커를 추가로 지정했지만 연결이 여전히 실패

**LLM의 접근**
1. 트래커 목록 확대: 더 많은 트래커를 추가해서 하나만 성공하면 되도록 시도
2. 파라미터 이름 오류 발견: `trackerUrls` 대신 `relayUrls`를 사용해야 함을 Trystero 문서에서 확인
3. 실패하는 트래커 제거: 불안정한 트래커들을 목록에서 제거

**결과**
- 파라미터 이름을 `relayUrls`로 수정
- 안정적인 트래커만 남김
- 하지만 여전히 연결 불안정

### 2. Player가 Lobby에 나타나지 않는 문제

**상황**
- 로그에서는 `[P2P] Peer joined` 메시지가 보임 (피어 연결 성공)
- 하지만 Host의 Lobby 화면에는 플레이어가 표시되지 않음
- `[P2P] No host peer found` 경고 발견

**원인 파악**
- Player가 Host보다 다른 Player와 먼저 연결될 수 있음 (P2P 메시 네트워크)
- 초기 코드는 "첫 번째로 연결된 피어 = Host"라고 잘못 가정
- Player 2가 Player 1과 먼저 연결되면 Player 1에게 JOIN_REQUEST를 보냄
- Host에게는 JOIN_REQUEST가 전달되지 않아 Lobby에 추가되지 않음

**해결 시도 1: 모든 피어에게 개별 전송**
- 각 피어 연결 시마다 JOIN_REQUEST를 보내도록 수정
- Player가 여러 피어와 연결되면 각각에게 전송
- 하지만 타이밍 문제로 여전히 불안정

**해결 시도 2: 브로드캐스트 방식**
- Quest-Net 샘플 프로젝트를 참고
- JOIN_REQUEST를 특정 피어가 아닌 **모든 피어에게 브로드캐스트**
- Host만 JOIN_REQUEST를 처리하고, 다른 Player는 무시
- JOIN_RESPONSE를 받으면 더 이상 브로드캐스트하지 않음

**결과**
- 브로드캐스트 방식으로 변경 후 연결 안정성 개선
- 하지만 여전히 일부 Player가 연결되지 않는 경우 발생

### 3. MQTT 전략으로 전환 시도

**상황**
- WebTorrent 트래커들이 대부분 불안정
- 어떤 트래커를 추가해도 신뢰성이 낮음
- Quest-Net 샘플 프로젝트가 MQTT 전략을 사용한다는 것을 발견

**LLM의 접근**
1. awesome-trystero 저장소에서 샘플 프로젝트들 조사
2. Quest-Net (TRPG 게임, 비슷한 멀티플레이어 구조) 발견
3. Quest-Net이 MQTT 전략을 사용한다는 것 확인
4. MQTT가 더 안정적일 것으로 판단

**구현**
- import 경로 변경: `trystero/torrent` → `trystero/mqtt`
- `relayUrls` 제거 (MQTT는 기본 브로커 사용)
- P2P 설정 단순화

**결과**
- MQTT 브로커 연결 시도
- 하지만 `test.mosquitto.org`가 불안정
- 피어 연결 후 곧 연결이 끊김 (`Peer left` 발생)
- 3~4명 연결 중 1~2명만 유지되는 불안정한 상태

### 4. Nostr 전략으로 최종 전환

**상황**
- MQTT 브로커도 불안정
- 연결이 자주 끊김
- 사용자가 답답해함

**LLM의 접근**
1. Trystero 문서에서 가장 안정적인 전략 찾기
2. Nostr: 8KB로 가장 가볍고, setup 불필요, 기본 전략으로 추천됨
3. Chitchatter (가장 유명한 Trystero 프로젝트)도 Nostr를 기본으로 사용
4. Nostr 전략으로 전환 결정

**구현**
- import 경로 변경: `trystero/mqtt` → `trystero` (기본 = Nostr)
- 인증 불필요한 공개 Nostr 릴레이 목록 추가:
  - `wss://relay.damus.io`
  - `wss://nos.lol`
  - `wss://relay.snort.social`
- `relayRedundancy: 2` 설정 추가 (동시 연결 수 제한으로 경고 감소)

**결과**
- **5명 동시 접속 성공!** 🎉
- 연결이 안정적으로 유지됨
- `Peer left` 없이 모든 플레이어가 Lobby에 표시됨
- 일부 Nostr 릴레이 경고가 있지만 기능에는 영향 없음

### 5. 경고 메시지 최소화

**상황**
- Nostr 전략으로 연결은 잘 되지만 콘솔에 경고 반복:
  ```
  relay.nostraddress.com - auth-required
  relay.nostromo.social - blocked: not on white-list
  ```
- Trystero가 자동으로 시도하는 기본 릴레이들의 실패 메시지

**해결**
- `relayRedundancy: 2` 추가: 동시 연결 수를 제한해 불필요한 시도 감소
- 커스텀 릴레이 3개가 작동하므로 기능에는 영향 없음

**결과**
- 경고 메시지 감소
- 연결 안정성 유지
- 사용자가 브라우저 콘솔 필터로 완전히 숨길 수 있음

---

## 🎯 구현된 기능

### P2P 연결 안정성 개선
- **안정적인 시그널링**: Nostr 릴레이 기반으로 전환
- **브로드캐스트 JOIN**: Player가 모든 피어에게 JOIN_REQUEST 브로드캐스트, Host만 응답
- **5명 동시 접속**: 테스트 성공 (이전에는 2~3명만 가능)
- **연결 유지**: `Peer left` 없이 안정적으로 유지

### Quest-Net 아키텍처 참고
- **Quest-Net 분석**: 비슷한 TRPG 멀티플레이어 게임의 P2P 구조 연구
- **RoomManager 패턴**: 방 관리와 피어 동기화를 분리하는 설계 참고
- **브로드캐스트 메시징**: 특정 피어가 아닌 전체 브로드캐스트로 Host 찾기

---

## 🤔 결정 사항 & 논의

### 왜 Nostr를 선택했나?

**시도한 전략들:**
1. **BitTorrent/WebTorrent** (초기): 트래커 불안정, 연결 실패 많음
2. **MQTT**: Quest-Net이 사용, 하지만 `test.mosquitto.org` 불안정
3. **Nostr** (최종): 가장 가볍고 안정적, Chitchatter도 사용

**Nostr의 장점:**
- Setup 불필요 (기본 릴레이 자동 사용)
- 가장 작은 번들 크기 (8KB)
- 분산형 네트워크로 단일 장애점 없음
- 공개 릴레이가 많아 선택지 풍부

### 브로드캐스트 vs 직접 전송

**초기 방식**: Player가 "첫 피어 = Host"로 가정하고 직접 전송
- 문제: P2P는 연결 순서를 보장하지 않음
- Player 3이 Player 1과 먼저 연결되면 실패

**개선 방식**: 모든 피어에게 브로드캐스트
- Host만 JOIN_REQUEST를 처리
- 다른 Player는 무시
- JOIN_RESPONSE 받으면 중단
- Quest-Net도 이 방식 사용

---

## 🐛 문제 & 해결

### 1. 트래커 설정이 무시되는 문제

**증상**: `relayUrls`를 추가했지만 Trystero가 무시함

**원인**: 파라미터 이름이 잘못됨
- 잘못: `trackerUrls` (BitTorrent 용어)
- 정답: `relayUrls` (Trystero 공식 파라미터)

**해결**: Trystero GitHub 문서를 확인해서 올바른 파라미터 이름 사용

**교훈**: 라이브러리 설정이 안 먹힐 때는 공식 문서 확인이 우선

### 2. Player가 Host를 찾지 못하는 문제

**증상**: 피어는 연결되지만 Lobby에 추가되지 않음

**원인**: Player가 다른 Player와 먼저 연결되어 잘못된 피어에게 JOIN_REQUEST 전송

**해결**:
1. 모든 피어 연결 시마다 JOIN_REQUEST 브로드캐스트
2. Host만 응답, Player는 무시
3. JOIN_RESPONSE 받으면 중단

**교훈**: P2P는 중앙 서버가 없어서 "누가 Host인지" 찾는 것도 프로토콜이 필요

### 3. MQTT 브로커 불안정

**증상**: 연결 후 곧 끊김, "connack timeout" 에러

**원인**: `test.mosquitto.org`는 테스트용 브로커라 과부하 상태

**시도한 해결책**:
- 다른 MQTT 브로커 찾기 → 대부분 인증 필요하거나 불안정
- 커스텀 브로커 구축 → 너무 복잡

**최종 해결**: MQTT 포기하고 Nostr로 전환

**교훈**: 무료 공개 서비스는 신뢰성이 낮을 수 있음, 여러 전략 시도해보는 유연성 필요

### 4. 브라우저 캐시 문제

**증상**: 코드를 수정했는데 이전 동작이 반복됨

**원인**: 브라우저가 ES 모듈을 캐시해서 새 코드가 로드되지 않음

**해결**:
- Ctrl + Shift + R (강력 새로고침)
- 또는 개발자 도구에서 "Disable cache" 체크
- 모든 탭 닫고 다시 열기

**교훈**: P2P 테스트할 때는 항상 강력 새로고침

---

## 📝 다음에 할 일

- [ ] 역할 배정 시스템 구현
- [ ] 밤/낮 페이즈 전환
- [ ] 투표 메커니즘
- [ ] 연결 끊김 시 재연결 로직
- [ ] 모바일 UI 최적화
- [ ] 연결 상태 표시 개선

---

## 💡 메모 / 인사이트

### P2P는 예측 불가능하다
- 중앙 서버가 없어서 "연결 순서"를 보장할 수 없음
- "첫 번째 피어 = Host"같은 가정은 위험
- 브로드캐스트 방식으로 불확실성 해결

### 라이브러리 전략 선택이 중요하다
- 같은 라이브러리(Trystero)도 전략에 따라 안정성이 천차만별
- BitTorrent: 트래커 의존성 높음
- MQTT: 브로커 품질에 좌우됨
- Nostr: 분산형이라 가장 안정적

### 오픈소스 샘플이 보물이다
- Quest-Net 코드를 보고 많은 힌트를 얻음
- 특히 브로드캐스트 패턴과 방 관리 구조
- awesome-trystero 같은 큐레이션 리스트가 매우 유용

### 에러 로그는 친구다
- "connack timeout" → MQTT 브로커 문제
- "auth-required" → 릴레이가 인증 필요
- "not on white-list" → 차단됨
- 정확히 읽으면 해결 방향이 보임

### 경고는 무시해도 될 때가 있다
- Nostr 릴레이 일부가 실패해도 괜찮음
- 하나만 작동하면 P2P 연결 가능
- 기능에 영향 없으면 무시하고 진행

---

**날짜**: 2026-02-25
**세션 시간**: 약 3시간
**상태**: P2P 연결 안정성 확보 완료, 5명 동시 접속 성공! 다음은 게임 로직 구현 단계
