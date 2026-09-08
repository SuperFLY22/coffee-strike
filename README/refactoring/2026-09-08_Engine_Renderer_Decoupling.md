# Coffee Strike 리팩토링 명세서 (Refactoring Specification)
**Date**: 2026-09-08  
**Target Module**: `src/engine/Game.ts`, `src/engine/Renderer.ts` (신설), `src/ui/HUD.ts`, `src/engine/Physics.ts`  
**Status**: Proposal (Pending User Approval)

---

## 1. As-Is 분석 (Current Bottlenecks & Technical Debt)

### 1.1 구문 무결성 파괴 (Critical Build Blocker)
- **대상**: `src/ui/HUD.ts` (152~153 라인)
- **현상**: `hideCountdown()` 메서드 끝에 중복 닫는 중괄호(`}`)가 삽입되어 클래스 선언이 조기 종료됨. 이로 인해 `tsc` 빌드 시 50개 이상의 컴파일 에러(`TS1128`, `TS1005` 등) 발생 및 프로덕션 빌드 불가.

### 1.2 거대 God Class 및 관심사 분리(SoC) 위반
- **대상**: `src/engine/Game.ts` (844 lines)
- **현상**:
  - 단일 클래스가 [1] 메인 루프 [2] 물리 충돌 판정 [3] 엔티티 라이프사이클(스폰/제거) [4] 서든데스 & 링아웃 순위 판정 [5] 네트워크 스냅샷 동기화 [6] Canvas 2D 렌더링(배경, 네온 라인, 파티클, 텍스트, 화면 흔들림)을 모두 도맡아 처리.
  - 파일 길이가 800줄을 초과하여 가독성과 유지보수성이 현저히 저하됨.

### 1.3 전역 상태 가변 오염 (Global State Mutation)
- **대상**: `src/engine/Physics.ts`의 `ARENA_CONFIG`
- **현상**: 
  - `ARENA_CONFIG`가 상수 객체로 export되어 있으나, `Game.ts`의 서든데스/링 수축 로직(218~225행)에서 `ARENA_CONFIG.radius`, `ARENA_CONFIG.halfHeight`를 런타임에 직접 덮어씀(Mutation).
  - 여러 게임 인스턴스 실행, 리플레이, 또는 단위 테스트 병렬 실행 시 상태 오염(Side-Effect) 발생 위험.

### 1.4 리소스 정리(Cleanup/Dispose) 누수 위험
- **대상**: `Game.ts`, `Joystick.ts`
- **현상**: `window.addEventListener('resize')` 등 브라우저 이벤트 바인딩에 대한 `destroy()` 또는 해제 인터페이스 부재로 로비 재진입 시 메모리 누수 잠재.

### 1.5 회귀 테스트 커버리지 공백
- **대상**: `tests/engine.test.ts`
- **현상**: 순수 물리 공식만 테스트 중. 핵심 승패 판정(서든데스 진입, 링아웃 순위 기록, 스냅샷 직렬화 무결성)에 대한 불변성 검증이 누락됨.

---

## 2. To-Be 설계 (Refactoring Architecture & Strategy)

```
[Entry: main.ts] ──> [Game (Engine Core: ~450 lines)]
                          │ (상태 관리, 틱 시뮬레이션, 링아웃 판정)
                          ├──> [Renderer (Canvas 2D: ~350 lines)] (신규 분리)
                          ├──> [ArenaState (격리된 아레나 수축 상태)] (신규 분리)
                          └──> [HUD (UI & 모바일 컨트롤: ~310 lines)] (문법 복구)
```

### 2.1 HUD 문법 정상화 및 인터페이스 보존
- `src/ui/HUD.ts` 내 중복 중괄호 제거 및 `tsc` 무결성 확보.
- 기존 외부 호출 시그니처(`showCountdown`, `hideCountdown`, `update`, `showGameOver` 등) 100% 보존.

### 2.2 Game - Renderer 관심사 분리 (SRP 달성)
- `src/engine/Renderer.ts` 생성:
  - 캔버스 컨텍스트 초기화, 뷰포트/스케일 조정, 경기장(배경, 테두리, 수축 링) 드로잉
  - 오브젝트 드로잉 위임(플레이어, 발사체, 아이템, 장애물)
  - 이펙트 드로잉(쇼크웨이브, 파티클, 서든데스 네온, 화면 흔들림 오프셋)
- `src/engine/Game.ts`:
  - 렌더링 드로잉 코드를 `Renderer`로 위임하여 핵심 파일 크기를 400~500줄 수준으로 슬림화.
  - 시뮬레이션(`update`)과 드로잉(`render`)의 명확한 레이어 분리.

### 2.3 Arena State 격리 (Immutable Base + Instance Dynamic State)
- `ARENA_CONFIG`를 읽기 전용 기본 설정값(`BASE_ARENA_CONFIG`)으로 유지.
- 인스턴스별 `ArenaState` 객체(`radius`, `halfHeight`, `centerX`, `centerY`)를 `Game` 인스턴스 내부에 소유시켜 전역 오염 원천 차단.

### 2.4 라이프사이클 관리 강화
- `Game.destroy()` 인터페이스 도입: `window.removeEventListener`, `cancelAnimationFrame`, `joystick.destroy()` 명시적 해제 지원.

### 2.5 회귀 방지 Golden Master 테스트 추가
- `tests/engine.test.ts` 확장:
  - 링아웃 순위 집계 로직(1등 커피 당첨자부터 역순위 판정)
  - 경기 시간대별 아레나 수축 비율 계산 검증
  - 네트워크 스냅샷 직렬화/역직렬화 데이터 정합성 검증

---

## 3. Regression Risks & Interface Preservation Strategy

| 모듈 | 기존 공개 인터페이스 | 변경 사항 | 위험도 및 완화책 |
|------|-------------------|-----------|------------------|
| `HUD.ts` | `update(game)`, `showGameOver(...)` 등 | 중복 구문 오류 제거 | 위험도 0 (시그니처 완전 동일) |
| `Game.ts` | `start()`, `stop()`, `update()`, `render()`, `resetState()` | 내부 렌더링 로직을 `Renderer`로 위임 | 외부 `main.ts` 호출 인터페이스 100% 동일 유지 |
| `Physics.ts` | `isOutOfArena(x, y, arenaState?)` | 선택적 `arenaState` 주입 파라미터 지원(하위호환성 유지) | 기존 호출부(`tests/engine.test.ts`) 무수정 동작 보장 |

---

## 4. Phase별 실행 계획 (Post-Approval)

1. **Phase 1: Syntax & Compile Fix**
   - `src/ui/HUD.ts` 중복 중괄호 제거 및 `npm run build` 기초 검증 통과
2. **Phase 2: Renderer Extraction**
   - `src/engine/Renderer.ts` 생성 및 `Game.ts` 내 캔버스 드로잉 로직 이관
3. **Phase 3: Arena State Isolation**
   - 전역 상수 변조 방지 및 `Game.arenaState` 인스턴스 상태화
4. **Phase 4: Golden Master Test Expansion & Verification**
   - `tests/engine.test.ts`에 시뮬레이션 & 규칙 테스트 추가
   - `npm test` 및 `npm run build` 전체 패스 확인
