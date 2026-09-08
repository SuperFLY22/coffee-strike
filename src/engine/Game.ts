import {
  RoomOptions,
  DEFAULT_ROOM_OPTIONS,
  WeaponType,
  WEAPON_CONFIGS,
  ItemType,
  GameResult,
  Team,
  WorldSnapshot
} from './Types';
import { Physics, ARENA_CONFIG, Arena } from './Physics';
import { Joystick } from './Joystick';
import { Player } from '../objects/Player';
import { Bullet } from '../objects/Bullet';
import { Obstacle } from '../objects/Obstacle';
import { Item } from '../objects/Item';
import { sound } from './Audio';
import { GameRenderer } from './GameRenderer';
import { HUDState, HUDPlayerState } from '../ui/HUDState';

export class Game {
  public canvas: HTMLCanvasElement;
  public ctx: CanvasRenderingContext2D;
  public joystick: Joystick;
  public arena: Arena = new Arena();

  public options: RoomOptions = { ...DEFAULT_ROOM_OPTIONS };
  public myPlayerId: string = 'local_player';
  public players: Map<string, Player> = new Map();
  public bullets: Bullet[] = [];
  public obstacles: Obstacle[] = [];
  public items: Item[] = [];

  public isRunning: boolean = false;
  public isHost: boolean = true;
  public isMultiplayer: boolean = false;

  // 타이머 & 서든데스
  public timeRemaining: number = 120;
  public totalDuration: number = 120;
  public timeScale: number = 1.0;
  public isSuddenDeath: boolean = false;
  public suddenDeathWarningTimer: number = 0;

  // 아이템 스폰 타이머
  private itemSpawnTimer: number = 5.0; // 5초 후 첫 스폰, 이후 15초 주기

  // 링아웃 순위 추적 (1 = 첫 탈락자 = 커피 당첨자)
  private currentEliminationRank: number = 1;
  public gameOverCallback?: (result: GameResult) => void;
  public onPlayerEliminated?: (nickname: string, isFirst: boolean) => void;
  public isGameOver: boolean = false;

  // 렌더 스케일 및 뷰포트
  public readonly virtualWidth = 720;
  public readonly virtualHeight = 1280;
  private lastTime: number = 0;
  private animFrameId: number | null = null;

  // 파티클/이펙트
  private shockwaves: Array<{ x: number; y: number; radius: number; maxRadius: number; color: string; alpha: number }> = [];
  public screenShake: number = 0; // 화면 흔들림 강도

  // 시작 3, 2, 1, GO! 카운트다운
  public isCountingDown: boolean = false;
  public countdownTimer: number = 0;
  private lastReportedCountdownSec: number = -1;
  public onCountdownTick?: (val: number | 'GO!') => void;
  public onCountdownFinished?: () => void;

  constructor(canvas: HTMLCanvasElement, container: HTMLElement) {
    this.canvas = canvas;
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Failed to get 2D canvas context');
    this.ctx = context;
    this.joystick = new Joystick(container);

    this.resizeCanvas();
    window.addEventListener('resize', () => this.resizeCanvas());
  }

  public resizeCanvas(): void {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.canvas.width = this.virtualWidth * dpr;
    this.canvas.height = this.virtualHeight * dpr;
  }

  public setOptions(opts: Partial<RoomOptions>): void {
    this.options = { ...this.options, ...opts };
    this.totalDuration = this.options.duration;
    this.timeRemaining = this.options.duration;
    this.timeScale = this.options.timeScale;
  }

  /**
   * 로컬 싱글 플레이 (더미 봇 3기 포함) 초기화: 즉사 방지 안전 배치
   */
  public initLocalGame(myNickname: string = '나'): void {
    this.isHost = true;
    this.isMultiplayer = false;
    this.resetState();

    const weapons: WeaponType[] = ['PISTOL', 'SHOTGUN', 'SNIPER', 'MACHINEGUN'];
    const randomWeapon = weapons[Math.floor(Math.random() * weapons.length)];

    // 1. 내 플레이어 (하단 중앙 안전 구역, 링 경계로부터 250px 이상 안전 거리 확보)
    const me = new Player(
      this.myPlayerId,
      myNickname,
      'NONE',
      this.arena.centerX,
      this.arena.centerY + 160,
      randomWeapon,
      true,
      false
    );
    me.fireCooldownTimer = 1.0;
    this.players.set(me.id, me);

    // 2. 더미 봇 3기 (상단 중앙, 좌측 중앙, 우측 중앙 엄폐물 주변으로 안전 분산)
    const botConfigs = [
      { name: '알파봇', x: this.arena.centerX, y: this.arena.centerY - 160 },
      { name: '베타봇', x: this.arena.centerX - 180, y: this.arena.centerY },
      { name: '감마봇', x: this.arena.centerX + 180, y: this.arena.centerY }
    ];

    botConfigs.forEach((bConf, idx) => {
      const bWeapon = weapons[(idx + 1) % weapons.length];
      const bot = new Player(
        `bot_${idx + 1}`,
        bConf.name,
        'NONE',
        bConf.x,
        bConf.y,
        bWeapon,
        false,
        true
      );
      bot.fireCooldownTimer = 1.0;
      this.players.set(bot.id, bot);
    });

    this.spawnObstacles();
  }

  /**
   * 플레이어 목록을 경기장 중앙 반경(145px)에 균등 분산 스폰 (즉사 방지)
   */
  public spawnPlayers(
    lobbyPlayers: Array<{ id: string; nickname: string; isHost: boolean; team: Team }>,
    weaponsPool?: WeaponType[]
  ): void {
    const weapons: WeaponType[] = weaponsPool || ['PISTOL', 'SHOTGUN', 'SNIPER', 'MACHINEGUN'];
    const totalCount = lobbyPlayers.length;
    const angleStep = (Math.PI * 2) / Math.max(1, totalCount);
    const startAngle = Math.PI / 2; // 하단(6시 방향) 시작

    lobbyPlayers.forEach((lp, idx) => {
      const angle = startAngle + angleStep * idx;
      const dist = 145;
      const x = this.arena.centerX + Math.cos(angle) * dist;
      const y = this.arena.centerY + Math.sin(angle) * dist;
      const weapon = weapons[Math.floor(Math.random() * weapons.length)];

      const player = new Player(
        lp.id,
        lp.nickname,
        lp.team,
        x,
        y,
        weapon,
        lp.isHost,
        false
      );
      player.fireCooldownTimer = 1.0;
      this.players.set(player.id, player);
    });
  }

  /**
   * 맵 엄폐물 생성 (스타디움 최적화 바위 6개 분산 배치)
   */
  public spawnObstacles(): void {
    this.obstacles = [];
    const cx = this.arena.centerX;
    const cy = this.arena.centerY;
    const w = 55;
    const h = 55;

    // 상단 구역 2개
    this.obstacles.push(new Obstacle('obs_1', cx - 130 - w / 2, cy - 210 - h / 2, w, h));
    this.obstacles.push(new Obstacle('obs_2', cx + 130 - w / 2, cy - 210 - h / 2, w, h));

    // 중앙 좌우 2개
    this.obstacles.push(new Obstacle('obs_3', cx - 160 - w / 2, cy - h / 2, w, h));
    this.obstacles.push(new Obstacle('obs_4', cx + 160 - w / 2, cy - h / 2, w, h));

    // 하단 구역 2개
    this.obstacles.push(new Obstacle('obs_5', cx - 130 - w / 2, cy + 210 - h / 2, w, h));
    this.obstacles.push(new Obstacle('obs_6', cx + 130 - w / 2, cy + 210 - h / 2, w, h));
  }

  public resetState(): void {
    this.arena.reset();
    ARENA_CONFIG.radius = this.arena.radius;
    ARENA_CONFIG.halfHeight = this.arena.halfHeight;
    this.players.clear();
    this.bullets = [];
    this.obstacles = [];
    this.items = [];
    this.shockwaves = [];
    this.timeRemaining = this.options.duration;
    this.totalDuration = this.options.duration;
    this.timeScale = this.options.timeScale;
    this.isSuddenDeath = false;
    this.suddenDeathWarningTimer = 0;
    this.currentEliminationRank = 1;
    this.isGameOver = false;
    this.itemSpawnTimer = 5.0;
    this.isCountingDown = false;
    this.countdownTimer = 0;
    this.lastReportedCountdownSec = -1;
  }

  /**
   * 3, 2, 1 카운트다운 시작
   */
  public startCountdown(onFinished?: () => void): void {
    this.isCountingDown = true;
    this.countdownTimer = 3.6; // 3초 카운트다운 + 0.6초 GO!
    this.lastReportedCountdownSec = -1;
    if (onFinished) {
      this.onCountdownFinished = onFinished;
    }
    for (const p of this.players.values()) {
      p.fireCooldownTimer = 1.0;
    }
    this.start();
  }

  public start(): void {
    if (this.isRunning) return;
    this.isRunning = true;
    this.joystick.setEnabled(true);
    this.lastTime = performance.now();
    this.loop = this.loop.bind(this);
    this.animFrameId = requestAnimationFrame(this.loop);
  }

  public stop(): void {
    this.isRunning = false;
    this.isCountingDown = false;
    this.joystick.setEnabled(false);
    if (this.animFrameId !== null) {
      cancelAnimationFrame(this.animFrameId);
      this.animFrameId = null;
    }
  }

  private loop(currentTime: number): void {
    if (!this.isRunning) return;

    let dt = (currentTime - this.lastTime) / 1000;
    this.lastTime = currentTime;

    // 비정상적인 큰 dt 방지 (최대 0.1s)
    if (dt > 0.1) dt = 0.1;

    // 배속 적용
    const scaledDt = dt * this.timeScale;

    this.update(scaledDt, dt);
    this.render();

    this.animFrameId = requestAnimationFrame(this.loop);
  }

  public update(scaledDt: number, realDt: number): void {
    if (this.isGameOver) return;

    // 0. 시작 3, 2, 1 카운트다운 처리 (움직임 허용, 무기 발사 및 대미지 차단, 5초 무적 제거)
    if (this.isCountingDown) {
      this.countdownTimer -= realDt;
      if (this.countdownTimer > 0.6) {
        const sec = Math.ceil(this.countdownTimer - 0.6); // 3, 2, 1
        if (sec !== this.lastReportedCountdownSec) {
          this.lastReportedCountdownSec = sec;
          sound.playCountdownBeep(false);
          if (this.onCountdownTick) this.onCountdownTick(sec);
        }
      } else if (this.countdownTimer <= 0.6 && this.countdownTimer > 0) {
        if (this.lastReportedCountdownSec !== 0) {
          this.lastReportedCountdownSec = 0;
          sound.playCountdownBeep(true);
          if (this.onCountdownTick) this.onCountdownTick('GO!');
        }
      } else {
        this.isCountingDown = false;
        if (this.onCountdownFinished) this.onCountdownFinished();
      }

      // 3초 카운트다운 동안 조작 입력 및 이동 물리 허용
      const myPlayer = this.players.get(this.myPlayerId);
      if (myPlayer && !myPlayer.isDead && !myPlayer.isFalling) {
        const input = this.joystick.getInput();
        myPlayer.applyInput(input.dx, input.dy, scaledDt);
      }

      if (this.isHost) {
        const allActivePlayers = Array.from(this.players.values());
        for (const p of allActivePlayers) {
          if (p.isBot && !p.isDead && !p.isFalling) {
            const botInput = p.updateBotAI(allActivePlayers, scaledDt);
            p.applyInput(botInput.dx, botInput.dy, scaledDt);
          }
        }
      }

      const playerList = Array.from(this.players.values());
      for (const p of playerList) {
        p.updateMovementOnly(scaledDt, this.arena.radius, this.arena.halfHeight);
        for (const obs of this.obstacles) {
          if (obs.active) {
            Physics.resolveCircleRect(p, obs);
          }
        }
      }

      for (let i = 0; i < playerList.length; i++) {
        for (let j = i + 1; j < playerList.length; j++) {
          const p1 = playerList[i];
          const p2 = playerList[j];
          if (!p1.isDead && !p1.isFalling && !p2.isDead && !p2.isFalling) {
            Physics.resolveCircleCircle(
              { x: p1.x, y: p1.y, vx: p1.vx, vy: p1.vy, radius: p1.radius, mass: p1.currentMass },
              { x: p2.x, y: p2.y, vx: p2.vx, vy: p2.vy, radius: p2.radius, mass: p2.currentMass }
            );
          }
        }
      }

      return; // 카운트다운 동안에는 사격/대미지/경기 타이머 일시 정지
    }

    // 1. 경기 시간 업데이트
    this.timeRemaining -= scaledDt;
    if (this.timeRemaining <= 0) {
      this.timeRemaining = 0;
      this.triggerGameOver('타임오버');
      return;
    }

    // 2. 동적 경기장 수축 (Shrinking Ring)
    // 경기 시간 절반(60초) 경과 후부터 플랫폼이 서서히 수축: radius 310 -> 210, halfHeight 160 -> 60
    this.arena.updateShrink(this.timeRemaining);
    ARENA_CONFIG.radius = this.arena.radius;
    ARENA_CONFIG.halfHeight = this.arena.halfHeight;

    // 3. 10초 전 서든데스 확인 (초고속 수축 & 엄폐물 소멸)
    if (this.timeRemaining <= 10 && !this.isSuddenDeath) {
      this.triggerSuddenDeath();
    }
    if (this.suddenDeathWarningTimer > 0) {
      this.suddenDeathWarningTimer = Math.max(0, this.suddenDeathWarningTimer - realDt);
    }

    // 4. 아이템 주기적 스폰 (12초 주기, 최대 2개 유지)
    if (this.isHost) {
      this.itemSpawnTimer -= scaledDt;
      if (this.itemSpawnTimer <= 0) {
        this.itemSpawnTimer = 12.0;
        if (this.items.filter(it => it.active).length < 2) {
          this.spawnRandomItem();
        }
      }
    }

    // 5. 로컬 플레이어 조작 입력 적용
    const myPlayer = this.players.get(this.myPlayerId);
    if (myPlayer && !myPlayer.isDead && !myPlayer.isFalling) {
      const input = this.joystick.getInput();
      myPlayer.applyInput(input.dx, input.dy, scaledDt);
    }

    // 6. 봇 AI 업데이트 (호스트 전담)
    if (this.isHost) {
      const allActivePlayers = Array.from(this.players.values());
      for (const p of allActivePlayers) {
        if (p.isBot && !p.isDead && !p.isFalling) {
          const botInput = p.updateBotAI(allActivePlayers, scaledDt);
          p.applyInput(botInput.dx, botInput.dy, scaledDt);
        }
      }
    }

    // 7. 플레이어 물리, 버프, 낙사 업데이트 & 자동 격발
    const playerList = Array.from(this.players.values());
    for (const p of playerList) {
      // 링아웃 콜백
      p.update(scaledDt, this.arena.radius, this.arena.halfHeight, (eliminatedPlayer) => {
        if (!eliminatedPlayer.ringOutRank) {
          const isFirst = this.currentEliminationRank === 1;
          eliminatedPlayer.ringOutRank = this.currentEliminationRank++;
          sound.playRingOut();
          this.onPlayerEliminated?.(eliminatedPlayer.nickname, isFirst);
        }
      });

      if (!p.isDead && !p.isFalling) {
        // 엄폐물 슬라이딩 충돌
        for (const obs of this.obstacles) {
          if (obs.active) {
            Physics.resolveCircleRect(p, obs);
          }
        }

        // 아이템 픽업 검사
        for (const item of this.items) {
          if (item.active && Physics.checkCircleCircle(p.x, p.y, p.radius, item.x, item.y, item.radius)) {
            item.active = false;
            p.applyBuff(item.type);
            this.addShockwave(item.x, item.y, 45, item.type === 'INVINCIBLE' ? '#f59e0b' : (item.type === 'HEAL' ? '#10b981' : '#ef4444'));
            sound.playItemPickup();
          }
        }

        // 자동 조준 및 자동 발사 (호스트 전담 또는 싱글)
        if (this.isHost) {
          p.updateAim(playerList);
          const newBullets = p.tryShoot(this.isSuddenDeath || this.options.ammoMode === 'UNLIMITED');
          if (newBullets) {
            this.bullets.push(...newBullets);
            // 사운드 재생
            switch (p.weapon) {
              case 'PISTOL': sound.playPistol(); break;
              case 'SHOTGUN': sound.playShotgun(); break;
              case 'SNIPER': sound.playSniper(); break;
              case 'MACHINEGUN': sound.playMachinegun(); break;
            }
          }
        }
      }
    }

    // 플레이어 간 상호 원-원 충돌 반발
    for (let i = 0; i < playerList.length; i++) {
      for (let j = i + 1; j < playerList.length; j++) {
        const p1 = playerList[i];
        const p2 = playerList[j];
        if (!p1.isDead && !p1.isFalling && !p2.isDead && !p2.isFalling) {
          Physics.resolveCircleCircle(
            { x: p1.x, y: p1.y, vx: p1.vx, vy: p1.vy, radius: p1.radius, mass: p1.currentMass },
            { x: p2.x, y: p2.y, vx: p2.vx, vy: p2.vy, radius: p2.radius, mass: p2.currentMass }
          );
        }
      }
    }

    // 8. 총알 업데이트 및 충돌 판정
    for (let i = this.bullets.length - 1; i >= 0; i--) {
      const b = this.bullets[i];
      b.update(scaledDt);

      if (!b.alive) {
        this.bullets.splice(i, 1);
        continue;
      }

      // 엄폐물 충돌 검사
      let bulletHitObstacle = false;
      for (const obs of this.obstacles) {
        if (obs.active && Physics.checkCircleRect(b.x, b.y, b.radius, obs.x, obs.y, obs.width, obs.height).collided) {
          b.alive = false;
          bulletHitObstacle = true;
          this.addShockwave(b.x, b.y, 16, b.color);
          break;
        }
      }
      if (bulletHitObstacle) {
        this.bullets.splice(i, 1);
        continue;
      }

      // 플레이어 피격 검사 (호스트 전담)
      if (this.isHost) {
        for (const target of playerList) {
          if (target.isDead || target.isFalling) continue;
          if (target.id === b.shooterId) continue; // 자신 무시
          if (this.options.gameMode === 'TEAM' && b.shooterTeam !== 'NONE' && target.team === b.shooterTeam) continue; // 아군 무시

          if (Physics.checkCircleCircle(b.x, b.y, b.radius, target.x, target.y, target.radius)) {
            // 피격 각도
            const hitAngle = Math.atan2(b.vy, b.vx);
            const dirX = Math.cos(hitAngle);
            const dirY = Math.sin(hitAngle);

            const hitSuccess = target.takeHit(b, dirX, dirY);

            if (hitSuccess) {
              if (target.id === this.myPlayerId) {
                this.screenShake = 16;
              } else {
                this.screenShake = Math.max(this.screenShake, 7);
              }

              this.addShockwave(b.x, b.y, 28, b.color);
              sound.playHit();

              // HP 0 도달로 사망 시 링아웃 순위 부여
              if (target.isDead && !target.ringOutRank) {
                const isFirst = this.currentEliminationRank === 1;
                target.ringOutRank = this.currentEliminationRank++;
                sound.playRingOut();
                this.onPlayerEliminated?.(target.nickname, isFirst);
              }
            } else {
              // 무적 상태로 총알 튕김
              this.addShockwave(b.x, b.y, 32, '#f59e0b');
            }

            b.alive = false;
            this.bullets.splice(i, 1);
            break;
          }
        }
      }
    }

    // 9. 엄폐물 및 아이템 업데이트
    for (const obs of this.obstacles) {
      obs.update(scaledDt);
    }
    for (let i = this.items.length - 1; i >= 0; i--) {
      const it = this.items[i];
      it.update(scaledDt);
      if (!it.active) {
        this.items.splice(i, 1);
      }
    }

    // 10. 충격파 이펙트 업데이트
    for (let i = this.shockwaves.length - 1; i >= 0; i--) {
      const sw = this.shockwaves[i];
      sw.radius += realDt * 80;
      sw.alpha -= realDt * 2.5;
      if (sw.alpha <= 0 || sw.radius >= sw.maxRadius) {
        this.shockwaves.splice(i, 1);
      }
    }

    // 11. 승리/생존자 확인
    if (this.isHost) {
      this.checkWinningCondition();
    }
  }

  private triggerSuddenDeath(): void {
    this.isSuddenDeath = true;
    this.suddenDeathWarningTimer = 3.0; // 3초간 경고 배너
    sound.playSuddenDeathAlarm();
    for (const obs of this.obstacles) {
      obs.triggerDisintegration();
    }
    this.addShockwave(this.arena.centerX, this.arena.centerY, this.arena.radius, '#ef4444');
  }

  private spawnRandomItem(): void {
    const types: ItemType[] = ['POWER', 'HEAL', 'INVINCIBLE'];
    const selectedType = types[Math.floor(Math.random() * types.length)];

    let spawnX = this.arena.centerX;
    let spawnY = this.arena.centerY;

    // 최대 25회 시도하여 장애물과 겹치지 않는 안전한 바닥 탐색
    for (let attempt = 0; attempt < 25; attempt++) {
      const angle = Math.random() * Math.PI * 2;
      const dist = Math.random() * (this.arena.radius * 0.7);
      const halfH = (Math.random() - 0.5) * (this.arena.halfHeight * 1.5);
      const x = this.arena.centerX + Math.cos(angle) * dist;
      const y = this.arena.centerY + halfH + Math.sin(angle) * (dist * 0.4);

      // 장애물과 충돌 검사 (안전 마진 40px)
      let hitObstacle = false;
      for (const obs of this.obstacles) {
        if (obs.active && Physics.checkCircleRect(x, y, 40, obs.x, obs.y, obs.width, obs.height).collided) {
          hitObstacle = true;
          break;
        }
      }

      if (!hitObstacle && !this.arena.isOutOfBounds(x, y, -20)) {
        spawnX = x;
        spawnY = y;
        break;
      }
    }

    const item = new Item(`item_${Date.now()}`, selectedType, spawnX, spawnY);
    this.items.push(item);
  }

  private addShockwave(x: number, y: number, maxRadius: number, color: string): void {
    this.shockwaves.push({
      x,
      y,
      radius: 4,
      maxRadius,
      color,
      alpha: 0.9
    });
  }

  private checkWinningCondition(): void {
    const alivePlayers = Array.from(this.players.values()).filter(p => !p.isDead);

    if (this.options.gameMode === 'FFA') {
      if (alivePlayers.length <= 1 && this.players.size > 1) {
        this.triggerGameOver('최후의 1인 생존');
      }
    } else {
      // 팀전
      const aliveTeams = new Set(alivePlayers.map(p => p.team));
      if (aliveTeams.size <= 1 && this.players.size > 1) {
        this.triggerGameOver('팀 승리');
      }
    }
  }

  public triggerGameOver(reason: string): void {
    if (this.isGameOver) return;
    this.isGameOver = true;
    sound.playGameOver();

    const allPlayers = Array.from(this.players.values());

    // 커피 당첨자 선출 로직 (PRD 명세)
    // 1순위: 가장 먼저 맵 밖으로 떨어진 플레이어 (ringOutRank === 1)
    // 타임오버 또는 아무도 안 떨어진 경우: 생존 시간 최하위 또는 링아웃 거리 최대
    let coffeeCandidate = allPlayers.find(p => p.ringOutRank === 1);

    if (!coffeeCandidate) {
      // 가장 생존 시간이 짧거나 경기장 중심에서 가장 먼 플레이어
      coffeeCandidate = [...allPlayers].sort((a, b) => {
        const da = Physics.getArenaDistanceRatio(a.x, a.y);
        const db = Physics.getArenaDistanceRatio(b.x, b.y);
        return db - da; // 외곽에 더 가까운 사람
      })[0];
    }

    // 랭킹 산정 (생존 시간 긴 순서대로 1등 ~ N등)
    const sorted = [...allPlayers].sort((a, b) => {
      if (!a.isDead && b.isDead) return -1;
      if (a.isDead && !b.isDead) return 1;
      return b.surviveTime - a.surviveTime;
    });

    const winner = sorted[0];
    const rankings = sorted.map((p, idx) => ({
      rank: idx + 1,
      nickname: p.nickname,
      team: p.team,
      surviveTime: Math.round(p.surviveTime),
      isCoffeeBuyer: p.id === coffeeCandidate?.id
    }));

    const result: GameResult = {
      winnerId: winner?.id,
      winnerNickname: winner?.nickname,
      winnerTeam: winner?.team,
      coffeeBuyer: {
        id: coffeeCandidate ? coffeeCandidate.id : 'unknown',
        nickname: coffeeCandidate ? coffeeCandidate.nickname : '알 수 없음',
        reason: reason === '최후의 1인 생존' ? '가장 먼저 링아웃 탈락!' : '타임오버 시 외곽 밀림 최다자!',
        team: coffeeCandidate ? coffeeCandidate.team : 'NONE'
      },
      rankings
    };

    if (this.gameOverCallback) {
      this.gameOverCallback(result);
    }
  }

  public render(): void {
    GameRenderer.render(
      {
        ctx: this.ctx,
        virtualWidth: this.virtualWidth,
        virtualHeight: this.virtualHeight,
        arena: this.arena,
        players: this.players,
        bullets: this.bullets,
        obstacles: this.obstacles,
        items: this.items,
        shockwaves: this.shockwaves,
        joystick: this.joystick,
        myPlayerId: this.myPlayerId,
        isSuddenDeath: this.isSuddenDeath,
        suddenDeathWarningTimer: this.suddenDeathWarningTimer,
        screenShake: this.screenShake
      },
      (newShake) => {
        this.screenShake = newShake;
      }
    );
  }

  /**
   * HUD 뷰 레이어 렌더링용 상태 DTO 생성
   */
  public createHUDState(): HUDState {
    const allPlayers = Array.from(this.players.values());
    const aliveCount = allPlayers.filter(p => !p.isDead).length;
    const myPlayer = this.players.get(this.myPlayerId);

    let myPlayerState: HUDPlayerState | undefined;
    if (myPlayer) {
      const stats = WEAPON_CONFIGS[myPlayer.weapon];
      myPlayerState = {
        hp: myPlayer.hp,
        maxHp: 100,
        heatPercent: myPlayer.heatPercent,
        weapon: myPlayer.weapon,
        ammo: myPlayer.ammo,
        maxAmmo: stats.maxAmmo,
        isReloading: myPlayer.isReloading,
        reloadTimer: myPlayer.reloadTimer,
        invincibleRemaining: myPlayer.buffs.invincible,
        powerRemaining: myPlayer.buffs.power
      };
    }

    return {
      timeRemaining: this.timeRemaining,
      totalDuration: this.totalDuration,
      timeScale: this.timeScale,
      isSuddenDeath: this.isSuddenDeath,
      aliveCount,
      totalCount: allPlayers.length,
      ammoMode: this.options.ammoMode,
      myPlayer: myPlayerState
    };
  }

  /**
   * 네트워크 클라이언트 동기화용 전체 월드 스냅샷 생성
   */
  public createWorldSnapshot(): WorldSnapshot {
    return {
      timeRemaining: Math.round(this.timeRemaining),
      totalDuration: this.totalDuration,
      timeScale: this.timeScale,
      isSuddenDeath: this.isSuddenDeath,
      arenaRadius: Math.round(this.arena.radius),
      players: Array.from(this.players.values()).map(p => p.toSnapshot()),
      bullets: this.bullets.map(b => b.toSnapshot()),
      obstacles: this.obstacles.filter(o => o.active).map(o => o.toSnapshot()),
      items: this.items.filter(i => i.active).map(i => i.toSnapshot())
    };
  }

  /**
   * 게스트 클라이언트 측 스냅샷 보간/적용 (장애물 및 아이템 동기화 완비)
   */
  public applyWorldSnapshot(snap: WorldSnapshot): void {
    this.timeRemaining = snap.timeRemaining;
    this.totalDuration = snap.totalDuration;
    this.timeScale = snap.timeScale;
    this.isSuddenDeath = snap.isSuddenDeath;
    if (snap.arenaRadius) {
      this.arena.radius = snap.arenaRadius;
      ARENA_CONFIG.radius = snap.arenaRadius;
    }

    // 플레이어 동기화
    for (const pSnap of snap.players) {
      let p = this.players.get(pSnap.id);
      if (!p) {
        p = new Player(
          pSnap.id,
          pSnap.nickname,
          pSnap.team,
          pSnap.x,
          pSnap.y,
          pSnap.weapon,
          pSnap.isHost,
          pSnap.isBot
        );
        this.players.set(p.id, p);
      }

      const wasDead = p.isDead;
      p.hp = pSnap.hp ?? 100;
      p.maxHp = pSnap.maxHp ?? 300;
      p.heatPercent = pSnap.heatPercent ?? 0;

      // 내 플레이어 위치는 스무스 보간
      if (p.id === this.myPlayerId) {
        p.vx = pSnap.vx;
        p.vy = pSnap.vy;
        p.isFalling = pSnap.isFalling;
        p.isDead = pSnap.isDead;
        p.fallScale = pSnap.fallScale;
        p.fallAlpha = pSnap.fallAlpha;
        p.ammo = pSnap.ammo;
        p.isReloading = pSnap.isReloading;
        p.buffs = pSnap.buffs;
        p.ringOutRank = pSnap.ringOutRank;
        p.surviveTime = pSnap.surviveTime;
      } else {
        p.x = pSnap.x;
        p.y = pSnap.y;
        p.vx = pSnap.vx;
        p.vy = pSnap.vy;
        p.angle = pSnap.angle;
        p.weapon = pSnap.weapon;
        p.ammo = pSnap.ammo;
        p.isReloading = pSnap.isReloading;
        p.isFalling = pSnap.isFalling;
        p.isDead = pSnap.isDead;
        p.fallScale = pSnap.fallScale;
        p.fallAlpha = pSnap.fallAlpha;
        p.buffs = pSnap.buffs;
        p.ringOutRank = pSnap.ringOutRank;
        p.surviveTime = pSnap.surviveTime;
      }

      if (!wasDead && p.isDead) {
        this.onPlayerEliminated?.(p.nickname, p.ringOutRank === 1);
      }
    }

    // 총알 동기화
    this.bullets = snap.bullets.map(bSnap => {
      const b = new Bullet(
        bSnap.shooterId,
        bSnap.shooterTeam,
        bSnap.weapon,
        bSnap.x,
        bSnap.y,
        0
      );
      b.id = bSnap.id;
      b.vx = bSnap.vx;
      b.vy = bSnap.vy;
      b.color = bSnap.color;
      return b;
    });

    // 엄폐물 동기화 (모바일 게스트 미표시 버그 수정)
    if (this.isSuddenDeath) {
      this.obstacles = [];
    } else if (snap.obstacles && snap.obstacles.length > 0) {
      this.obstacles = snap.obstacles.map(oSnap => {
        return new Obstacle(oSnap.id, oSnap.x, oSnap.y, oSnap.width, oSnap.height);
      });
    }

    // 아이템 동기화
    if (snap.items) {
      this.items = snap.items.map(iSnap => {
        const item = new Item(iSnap.id, iSnap.type, iSnap.x, iSnap.y);
        item.radius = iSnap.radius;
        item.lifetime = iSnap.lifetime;
        return item;
      });
    }
  }
}
