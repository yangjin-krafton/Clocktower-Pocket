# Clocktower Pocket — 구현 TODO

기준 문서: `docs/ui-ux-설계.md`, `docs/규칙-통합.md`, `docs/행위-앱vs현장.md`
UI 스타일: `sandbox/ui-concepts/combined-official.html`

---

## 진행 상태 범례
- [ ] 미착수
- [~] 진행 중
- [x] 완료

---

## Phase 0 — 기반 파일

- [x] `src/js/data/roles-tb.js` — Trouble Brewing 역할 정적 데이터 + 밤 순서 + 인원 구성표
- [x] `src/js/game-engine.js` — 게임 상태 + 규칙 엔진 (역할 배정, 밤 처리, 낮 처리, 승리 판정)
- [x] `src/css/theme.css` — 공유 CSS 변수 + 공통 스타일 (원작 팔레트 기반)
- [x] `src/js/p2p.js` — 신규 메시지 타입 추가 (GAME_START, NIGHT_INFO, VOTE_UPDATE, GAME_END, EMOJI)

---

## Phase 1 — 공통 컴포넌트 (11개)

- [x] `src/js/components/PlayerChip.js` (C-01)
- [x] `src/js/components/RoleCard.js` (C-02)
- [x] `src/js/components/PlayerGrid.js` (C-03)
- [x] `src/js/components/PhaseHeader.js` (C-04)
- [x] `src/js/components/InfoPanel.js` (C-05, 호스트 전용)
- [x] `src/js/components/SelectPanel.js` (C-06, 호스트 전용)
- [x] `src/js/components/VoteBar.js` (C-07)
- [x] `src/js/components/EmojiPicker.js` (C-08, 참가자 전용)
- [x] `src/js/components/EmojiPopup.js` (C-09, 참가자 전용)
- [x] `src/js/components/NightOrderList.js` (C-10, 호스트 전용)
- [x] `src/js/components/LogEntry.js` (C-11, 호스트 전용)

---

## Phase 2 — 호스트 화면 (7개)

- [x] `src/js/host/app.js` — HostApp 클래스, 화면 라우팅, P2P 연결 관리
- [x] `src/js/host/Setup.js` (H-01) — 인원 수 + 역할 선택 + 방 생성
- [x] `src/js/host/Lobby.js` (H-02) — 방 코드 + 참가자 대기 + 게임 시작
- [x] `src/js/host/Grimoire.js` (H-03) — 메인 상태판 + 플레이어 탭 → 상태 수정 팝업
- [x] `src/js/host/NightAction.js` (H-04) — 역할별 InfoPanel / SelectPanel 처리
- [x] `src/js/host/DayFlow.js` (H-06) — 지목 + 투표 + 처형 + Slayer 선언
- [x] `src/js/host/Victory.js` (H-07) — 승패 배너 + 역할 공개 + 로그

---

## Phase 3 — 참가자 화면 (8개)

- [x] `src/js/player/app.js` — PlayerApp 클래스, 탭 라우팅, P2P 연결 관리
- [x] `src/js/player/Join.js` (P-01) — 닉네임 + 방코드 입력, URL ?code= 자동 감지
- [x] `src/js/player/Waiting.js` (P-02) — 대기 화면, 연결 상태
- [x] `src/js/player/RoleCardScreen.js` (P-03) — 내 역할 카드
- [x] `src/js/player/PlayerTracker.js` (P-04) — 플레이어 추리 메모 (localStorage)
- [x] `src/js/player/EmojiPanel.js` (P-05) — 이모지 전송 + 수신 팝업
- [x] `src/js/player/Memo.js` (P-06) — 자유 메모장 (localStorage)
- [x] `src/js/player/CharacterDict.js` (P-07) — 캐릭터 사전 (팀별 필터)

---

## Phase 4 — HTML 진입점

- [x] `src/host.html` — theme.css + host/app.js 모듈 로드
- [x] `src/player.html` — theme.css + player/app.js 모듈 로드 + 탭바

---

## 알려진 규칙 주의사항 (구현 중 체크)

- [x] Empath: 좌석 기준 이웃 (생존 여부 무관, 사망해도 이웃은 유지)
- [x] Chef: 원형 좌석 — 마지막↔첫 번째도 인접
- [x] Fortune Teller: Red Herring은 게임 시작 시 1회 고정
- [x] Scarlet Woman: 데몬 사망 직후, 게임 종료 판정 전에 승계 체크
- [x] Imp self-kill: 같은 밤 새 Imp는 추가 행동하지 않음
- [x] Virgin: 1회성, 마을 주민이 지목 시에만 발동
- [x] Slayer: 선언 즉시 사용 횟수 소모
- [x] Saint: 처형 직후 즉시 선 패배
- [x] Drunk: 클라이언트에 실제 Drunk 타입 절대 미노출
- [x] Butler: 투표 단계에서만 제약 (DayFlow에서 메모로 처리)

---

## 향후 개선 사항 (v2)

- [ ] 호스트 Grimoire에서 원형 돌림판 뷰 (combined-official.html 스타일)
- [ ] 참가자 P2P 없이 오프라인 단독 사용 모드
- [ ] 밤 진행 중 Ravenkeeper 사망 트리거 자동 감지
- [ ] 역할 배정 수동 조정 기능 (Lobby에서 드래그)
- [ ] 게임 로그 내보내기 (텍스트)
