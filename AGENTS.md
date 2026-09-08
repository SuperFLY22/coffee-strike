# Project Rules: Coffee Strike

이 프로젝트에 적용되는 핵심 불변 규칙 모음입니다. 상세 규칙은 [.agents/rules/coffee_strike_rules.md](file:///.agents/rules/coffee_strike_rules.md)를 참조하십시오.

## 1. Stack Guardrails
- **허용**: `vite`, `typescript`, `peerjs`, `lucide` (UI 아이콘 선택 사항).
- **금지**: React/Vue 등 UI 프레임워크, Tailwind CSS, Phaser/Pixi/Three.js 등 대형 엔진, Socket.io/Express 등 백엔드.
- **Vercel 정적 배포 호환**: `vite.config.ts` base 경로 `'./'` 또는 `'/'`, 외부 API 키/.env 의존성 0건 유지.

## 2. Mobile UX Guardrails
- **캔버스 DPI 스케일링**: `window.devicePixelRatio` 기반 버퍼 크기(`canvas.width = rect.width * dpr`)와 CSS 뷰포트 분리 보정.
- **브라우저 제스처 차단**: `viewport-fit=cover`, `user-scalable=no`, CSS `touch-action: none;`, `user-select: none;`, `overflow: hidden;`.
- **멀티터치 격리**: 가상 조이스틱 구현 시 touch `identifier` 추적 관리 (`touches[0]` 직접 참조 금지).

## 3. Host-Authoritative Guardrails
- **호스트 독점 물리 연산**: 게스트는 탄환/충돌/넉백 연산 금지, 조이스틱 방향 벡터 `(dx, dy)`만 30Hz 송신. 호스트가 판정 및 스냅샷 브로드캐스트.
- **로컬 봇(AI) 모드 영구 보존**: 싱글 테스트용 3~9마리 더미 봇 스폰 스위치 유지.
- **이탈 예외 처리**: 호스트 이탈 시 알림 모달 후 로비 복귀, 게스트 이탈 시 즉시 엔티티 삭제 브로드캐스트.

## 4. Harness Gate Rules
- **순차 실행**: Phase 0 ➔ Phase 1 ➔ Phase 2 ➔ Phase 3 ➔ Phase 4 준수.
- **DoD**: 단계별 `npx tsc --noEmit` 에러 0건 확인 필수.
- **Anti-Lazy**: 생략 주석(`// ...`) 금지, 모듈 분리(`engine/`, `objects/`, `net/`, `ui/`) 준수, 온전한 코드 작성.
- **리소스 정리**: 게임 재시작 시 `rAF`, `setInterval`, 조이스틱 리스너 `destroy()`/`cleanup()` 누수 방지.

## 5. Verification Checklist
- [ ] 조작: 좌측 플로팅 조이스틱 + 최근접 적 자동 조준/발사
- [ ] 승패: 링 밖 넉백 낙사 판정 (HP 대미지 아님)
- [ ] 결과창: 1위 승자 및 "커피 당첨자(최초 낙사자/타임오버 꼴찌)" 하이라이트
- [ ] 무기 4종: 피스톨, 샷건, 스나이퍼, 머신건
- [ ] 아이템 3종: 파워(넉백 2배), 스피드(이동속도 1.5배), 쉴드(체중 3배/밀림 70% 감소)
- [ ] 10초 서든데스: 엄폐물 전면 소멸 + 탄약 무제한
- [ ] 방 옵션: 개인전/팀전(2~4팀, 팀킬 방지), 1~3배속, 탄약 제한/무제한
