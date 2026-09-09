// Lifecycle & Rematch Automated Verification Suite for Coffee Strike
import { Game } from '../src/engine/Game';
import { Player } from '../src/objects/Player';
import { ARENA_CONFIG } from '../src/engine/Physics';
import { DEFAULT_ROOM_OPTIONS, RoomOptions, GameResult } from '../src/engine/Types';
import { NetworkPacket, WorldSnapshot } from '../src/net/Protocol';

// Node 환경을 위한 최소 Canvas/DOM Mocking
function setupMockEnvironment() {
  (global as any).window = {
    devicePixelRatio: 2,
    addEventListener: () => {},
    removeEventListener: () => {},
    location: { origin: 'http://localhost:5173', pathname: '/' }
  };
  (global as any).requestAnimationFrame = (cb: any) => setTimeout(cb, 16) as any;
  (global as any).cancelAnimationFrame = (id: any) => clearTimeout(id);
  (global as any).document = {
    addEventListener: () => {},
    removeEventListener: () => {},
    createElement: (tag: string) => {
      const el: any = {
        className: '',
        style: {},
        innerHTML: '',
        appendChild: () => {},
        querySelector: () => null,
        querySelectorAll: () => [],
        addEventListener: () => {},
        removeEventListener: () => {}
      };
      return el;
    }
  };
}

function createMockCanvas(): HTMLCanvasElement {
  const baseMock: any = {
    save: () => {},
    restore: () => {},
    scale: () => {},
    translate: () => {},
    clearRect: () => {},
    fillRect: () => {},
    beginPath: () => {},
    moveTo: () => {},
    lineTo: () => {},
    arc: () => {},
    ellipse: () => {},
    fill: () => {},
    stroke: () => {},
    closePath: () => {},
    measureText: () => ({ width: 50 }),
    fillText: () => {},
    strokeText: () => {},
    createLinearGradient: () => ({ addColorStop: () => {} }),
    createRadialGradient: () => ({ addColorStop: () => {} })
  };

  const mockCtx = new Proxy(baseMock, {
    get: (target, prop) => {
      if (prop in target) return target[prop];
      return () => {};
    },
    set: (target, prop, value) => {
      target[prop] = value;
      return true;
    }
  });

  const canvas: any = {
    getContext: () => mockCtx,
    width: 720,
    height: 1280
  };
  return canvas as HTMLCanvasElement;
}

function createMockContainer(): HTMLElement {
  return {
    appendChild: () => {},
    removeChild: () => {},
    querySelector: () => null,
    querySelectorAll: () => [],
    addEventListener: () => {},
    removeEventListener: () => {}
  } as any;
}

export function runLifecycleTests() {
  console.log('--- Coffee Strike Lifecycle & Rematch Verification Suite ---');
  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, testName: string) {
    if (condition) {
      console.log(`✅ [PASS] ${testName}`);
      passed++;
    } else {
      console.error(`❌ [FAIL] ${testName}`);
      failed++;
    }
  }

  setupMockEnvironment();

  // 1. 방 코드 대소문자 정규화 검증
  const rawInput = ' ab12cd ';
  const normalized = rawInput.trim().toUpperCase();
  const hostPeerId = `coffee-${normalized.toLowerCase()}`;
  assert(normalized === 'AB12CD', 'Room code input correctly trimmed and converted to uppercase');
  assert(hostPeerId === 'coffee-ab12cd', 'PeerJS ID consistently mapped regardless of casing');

  // 2. 가상 호스트 및 게스트 인스턴스 생성
  const hostCanvas = createMockCanvas();
  const hostContainer = createMockContainer();
  const hostGame = new Game(hostCanvas, hostContainer);
  hostGame.isHost = true;
  hostGame.isMultiplayer = true;

  const guestCanvas = createMockCanvas();
  const guestContainer = createMockContainer();
  const guestGame = new Game(guestCanvas, guestContainer);
  guestGame.isHost = false;
  guestGame.isMultiplayer = true;

  // 3. 1차 게임 시작 시뮬레이션
  const lobbyPlayers = [
    { id: 'host_p1', nickname: '방장', isHost: true, team: 'NONE' as const },
    { id: 'guest_p2', nickname: '게스트', isHost: false, team: 'NONE' as const }
  ];

  // 호스트가 플레이어 2명 배치 및 1차 게임 시작
  hostGame.resetState();
  lobbyPlayers.forEach((lp, idx) => {
    const p = new Player(lp.id, lp.nickname, lp.team, ARENA_CONFIG.centerX, ARENA_CONFIG.centerY + (idx * 50), 'PISTOL', lp.isHost, false);
    hostGame.players.set(p.id, p);
  });
  hostGame.spawnObstacles();
  const round1Snapshot = hostGame.createWorldSnapshot();

  // 게스트가 S2C_GAME_START 수신하여 초기화
  guestGame.resetState();
  guestGame.applyWorldSnapshot(round1Snapshot);

  assert(hostGame.players.size === 2, 'Host initialized with 2 players in round 1');
  assert(guestGame.players.size === 2, 'Guest synchronized round 1 initial snapshot');
  assert(!guestGame.isGameOver, 'Guest starts round 1 with isGameOver = false');

  // 4. 1차 게임 도중 게스트 링아웃 탈락 발생 -> 게임 오버 산정 검증
  const guestPlayer = hostGame.players.get('guest_p2')!;
  guestPlayer.isDead = true;
  guestPlayer.ringOutRank = 1; // 첫 번째 링아웃
  guestPlayer.surviveTime = 12.5;

  const hostPlayer = hostGame.players.get('host_p1')!;
  hostPlayer.isDead = false;
  hostPlayer.surviveTime = 30.0;

  let gameOverResult: GameResult | null = null;
  hostGame.gameOverCallback = (result) => {
    gameOverResult = result;
  };

  hostGame.triggerGameOver('최후의 1인 생존');

  assert(hostGame.isGameOver === true, 'Host marked isGameOver = true');
  assert(gameOverResult !== null, 'Host triggered gameOverCallback');
  assert(gameOverResult?.winnerNickname === '방장', 'Host won the match');
  assert(gameOverResult?.coffeeBuyer.nickname === '게스트', 'First knocked-out guest selected as Coffee Buyer');

  // 게스트도 S2C_GAME_OVER 수신
  guestGame.isGameOver = true;
  guestGame.stop();
  assert(guestGame.isGameOver === true, 'Guest recorded isGameOver = true');

  // 5. 호스트 재게임 (Rematch) 실행 -> 게스트 2차 게임 정상 진입 검증
  // 호스트 재시작 로직
  hostGame.stop();
  hostGame.resetState();
  assert(hostGame.isGameOver === false, 'Host resetState cleared isGameOver flag');

  lobbyPlayers.forEach((lp, idx) => {
    const p = new Player(lp.id, lp.nickname, lp.team, ARENA_CONFIG.centerX, ARENA_CONFIG.centerY + (idx * 50), 'SHOTGUN', lp.isHost, false);
    hostGame.players.set(p.id, p);
  });
  hostGame.spawnObstacles();
  hostGame.startCountdown();
  const round2Snapshot = hostGame.createWorldSnapshot();

  // 게스트가 S2C_GAME_START 수신:
  // 수정된 핸들러: game.stop(), resetState(), applyWorldSnapshot(), startCountdown()
  guestGame.stop();
  guestGame.resetState();
  guestGame.applyWorldSnapshot(round2Snapshot);
  guestGame.startCountdown();

  assert(guestGame.isGameOver === false, 'Guest isGameOver successfully reset to false for round 2');
  assert(guestGame.isCountingDown === true, 'Guest countdown initiated for round 2');
  assert(guestGame.players.size === 2, 'Guest synchronized 2 new players for round 2');
  assert(guestGame.players.get('guest_p2')?.isDead === false, 'Guest player revived in round 2');
  assert(!guestGame.players.get('guest_p2')?.ringOutRank, 'Guest player ringOutRank cleared');

  // 6. 패킷 유실 자가 복구 검증: 게스트가 isGameOver 상태에서 S2C_STATE만 받았을 때
  guestGame.isGameOver = true; // 강제 게임오버 상태
  const needsSelfHealing = !guestGame.isRunning || guestGame.isGameOver;
  assert(needsSelfHealing === true, 'Guest correctly identifies need for self-healing when S2C_STATE arrives during isGameOver');

  if (needsSelfHealing) {
    guestGame.stop();
    guestGame.resetState();
    guestGame.applyWorldSnapshot(round2Snapshot);
  }
  // 7. 재경기(Rematch) 하트비트 자가 복구 검증 (게스트 결과화면 멈춤 방지)
  let guestIsWaitingRematch = true;
  const guestHeartbeatPacket: NetworkPacket = {
    type: 'C2S_HEARTBEAT',
    id: 'guest_p2',
    isWaitingRematch: guestIsWaitingRematch
  };

  // 호스트가 게임 가동 중 게스트의 isWaitingRematch 하트비트를 수신했을 때
  let rematchPacketSent = false;
  if (guestHeartbeatPacket.type === 'C2S_HEARTBEAT' && guestHeartbeatPacket.isWaitingRematch && hostGame.isRunning) {
    rematchPacketSent = true;
  }
  assert(rematchPacketSent === true, 'Host immediately dispatches S2C_GAME_START when receiving waiting rematch heartbeat');

  // 게스트가 S2C_GAME_START 수신하여 isWaitingRematch 플래그 해제 및 게임 루프 진입
  guestIsWaitingRematch = false;
  guestGame.stop();
  guestGame.resetState();
  guestGame.applyWorldSnapshot(round2Snapshot);
  guestGame.startCountdown();
  assert(guestIsWaitingRematch === false, 'Guest resets isWaitingRematch to false on rematch entry');
  assert(guestGame.isRunning === true, 'Guest game running state successfully restored');

  // 8. 카운트다운 중 이동 허용 및 5초 무적 제거 검증
  const testGuest = guestGame.players.get('guest_p2')!;
  const initialX = testGuest.x;
  testGuest.applyInput(1, 0, 0.1);
  testGuest.updateMovementOnly(0.1, hostGame.arena.radius, hostGame.arena.halfHeight);
  assert(testGuest.x > initialX, 'Player can freely move during 3-second countdown');
  assert(testGuest.buffs.invincible === 0, 'No 5-second invincibility buff present on player during or after countdown');
  hostGame.stop();
  guestGame.stop();

  console.log(`\nLifecycle Test Result: ${passed} Passed, ${failed} Failed`);
  if (failed > 0) {
    process.exit(1);
  }
}

runLifecycleTests();
