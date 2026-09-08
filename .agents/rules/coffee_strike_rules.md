# Coffee Strike Project Rules

## 1. 기술 스택 및 의존성 불변 규칙 (Stack Guardrails)
- **허용 스택**: `vite`, `typescript`, `peerjs`, `lucide` (UI 아이콘 선택 사항).
- **설치 금지**: React/Vue 등 UI 프레임워크, Tailwind CSS, Phaser/Pixi/Three.js 등 대형 게임 엔진, Socket.io/Express 등 백엔드 패키지 일체 금지.
- **Vercel 정적 배포 호환성**:
  - `vite.config.ts`의 base 경로는 상대 경로(`'./'`) 또는 루트(`'/'`) 고정 (번들 Asset 404 방지).
  - 빌드 시 외부 API 키, 서버 환경변수(`.env`) 의존성 0건 유지.

---

## 2. 모바일 터치 및 캔버스 렌더링 불변 규칙 (Mobile UX Guardrails)
- **고해상도(Retina/DPI) 캔버스 스케일링**:
  - `window.devicePixelRatio` 감지 기반 캔버스 내부 버퍼 크기(`canvas.width = rect.width * dpr`)와 CSS 뷰포트 크기 분리 보정.
- **브라우저 기본 제스처 원천 차단**:
  - `index.html`: `viewport-fit=cover`, `user-scalable=no`, `maximum-scale=1.0`.
  - CSS: `body`, `canvas`에 `touch-action: none;`, `user-select: none;`, `-webkit-user-select: none;`, `overflow: hidden;` 필수 적용.
- **멀티터치 식별자(Touch Identifier) 격리**:
  - 가상 조이스틱 구현 시 `e.touches[0]` 직접 참조 금지. 최초 터치된 손가락의 `identifier`를 추적하여 다중 터치 시 조작 축 튐 현상 방지.

---

## 3. P2P 네트워크 및 동기화 불변 규칙 (Host-Authoritative Guardrails)
- **호스트 독점 물리 연산 (Host-Authoritative)**:
  - 게스트 클라이언트: 자체 탄환 생성, 충돌 감지, 넉백 좌표 수정 연산 절대 금지.
  - 게스트 송신 데이터: 오직 조이스틱 방향 벡터 `(dx, dy)`만 30Hz(33ms 주기)로 호스트에 송신.
  - 호스트 판정: 충돌, 넉백, 낙하, 아이템 획득, 엄폐물 제거를 전담 판정하고 전체 월드 상태 스냅샷을 게스트들에게 브로드캐스트.
- **로컬 봇(Bot) 모드 영구 유지**:
  - 단독 개발 및 테스트 환경 검증용 로컬 더미 봇(AI) 3~9마리 자동 스폰 스위치 코드 영구 보존.
- **PeerJS 예외 및 이탈 처리**:
  - 호스트 이탈 시: 게스트 화면에 "호스트와의 연결이 끊어졌습니다" 모달 팝업 후 로비 복귀.
  - 게스트 이탈 시: 호스트 월드에서 해당 플레이어 엔티티 즉시 제거 브로드캐스트.

---

## 4. 자율 하네스 실행 및 게이트 검증 규칙 (Harness Gate Rules)
- **단계적 순차 실행 (Strict Phased Execution)**:
  - Phase 0(부트스트랩) ➔ Phase 1(코어 물리/조작) ➔ Phase 2(무기/서든데스/배속) ➔ Phase 3(P2P 네트워크) ➔ Phase 4(UI/빌드 검증). 임의 건너뛰기 금지.
- **게이트 통과 조건 (Definition of Done)**:
  - 각 단계 완료 시 `npx tsc --noEmit` 실행 필수 (타입 에러 0건 확인 전 다음 단계 진입 금지).
- **Anti-Lazy Coding (게으른 코드 금지)**:
  - `// ... 기존 코드 유지`, `// TODO: 추후 구현` 형태의 주석 생략 엄격 금지.
  - 모듈 분리(`engine/`, `objects/`, `net/`, `ui/`) 준수 및 완전한 전체 코드 작성.
- **이벤트 리스너 및 메모리 누수 방지**:
  - 게임 재시작(Restart) 시 `requestAnimationFrame`, `setInterval`, 조이스틱 이벤트 리스너 반드시 `destroy()` / `cleanup()` 처리.

---

## 5. 게임 수치 및 기획 불변 검증표 (Verification Checklist)
- [ ] **조작**: 화면 좌측 플로팅 가상 조이스틱 + 사거리 내 최근접 적 자동 조준/발사
- [ ] **승패 판정**: HP 대미지가 아닌 총알 넉백(밀림)을 통한 링 밖 낙사 판정
- [ ] **결과창**: 1위 승자 표시 외 "커피 당첨자(최초 낙사자 또는 타임오버 시 꼴찌)" 하이라이트 박스 출력
- [ ] **무기 4종**:
  - 피스톨 (밸런스형)
  - 샷건 (4발 방사형 넉백)
  - 스나이퍼 (1타 강력 넉백)
  - 머신건 (고연사 밀림)
- [ ] **아이템 3종**:
  - 파워 (넉백 2배)
  - 스피드 (이동속도 1.5배)
  - 쉴드 (체중 3배 적용으로 피격 밀림 70% 감소)
- [ ] **10초 서든데스**: 경기 종료 10초 전 엄폐물 전면 소멸 + 전원 탄약 무제한 적용
- [ ] **방 옵션**: 개인전/팀전(2~4팀, 아군 오사 방지), 1~3배속 조절, 탄약 제한/무제한
