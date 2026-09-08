import {
  WeaponType,
  WEAPON_CONFIGS,
  Team,
  PlayerSnapshot
} from '../engine/Types';
import { Physics, ARENA_CONFIG } from '../engine/Physics';
import { Bullet } from './Bullet';
import { PlayerRenderer } from './PlayerRenderer';

export class Player {
  public id: string;
  public nickname: string;
  public team: Team;
  public isHost: boolean;
  public isBot: boolean;

  // 물리 속성
  public x: number;
  public y: number;
  public vx: number = 0;
  public vy: number = 0;
  public radius: number = 20;
  public angle: number = 0; // 라디안
  public baseSpeed: number = 220;
  public baseMass: number = 1.0;

  // 전투 & 체력 속성
  public weapon: WeaponType;
  public ammo: number;
  public maxAmmo: number;
  public isReloading: boolean = false;
  public reloadTimer: number = 0;
  public fireCooldownTimer: number = 0;
  public hp: number = 100;
  public maxHp: number = 300;
  public heatPercent: number = 0; // 누적 피격량 % (맞을수록 넉백 증가)

  // 버프 (남은 시간 초)
  public buffs = {
    power: 0,
    invincible: 0
  };

  // 생존 및 낙사 상태
  public isFalling: boolean = false;
  public isDead: boolean = false;
  public fallScale: number = 1.0;
  public fallAlpha: number = 1.0;
  public surviveTime: number = 0;
  public ringOutRank?: number; // 1이면 가장 먼저 탈락 (커피 당첨자)
  public knockbackStunTimer: number = 0; // 피격 시 조작 제어력 감쇄 타이머

  // 타겟팅 정보
  public targetPlayer: Player | null = null;

  constructor(
    id: string,
    nickname: string,
    team: Team = 'NONE',
    startX: number = ARENA_CONFIG.centerX,
    startY: number = ARENA_CONFIG.centerY,
    weapon: WeaponType = 'PISTOL',
    isHost: boolean = false,
    isBot: boolean = false
  ) {
    this.id = id;
    this.nickname = nickname;
    this.team = team;
    this.x = startX;
    this.y = startY;
    this.weapon = weapon;
    this.isHost = isHost;
    this.isBot = isBot;

    const stats = WEAPON_CONFIGS[weapon];
    this.maxAmmo = stats.maxAmmo;
    this.ammo = stats.maxAmmo;
  }

  public get currentSpeed(): number {
    return this.baseSpeed;
  }

  public get currentMass(): number {
    return this.baseMass;
  }

  public get mass(): number {
    return this.baseMass;
  }
  public set mass(v: number) {
    this.baseMass = v;
  }

  public get knockbackBonus(): number {
    return this.buffs.power > 0 ? 2.0 : 1.0;
  }

  public applyBuff(type: 'POWER' | 'HEAL' | 'INVINCIBLE', duration: number = 7.0): void {
    if (type === 'POWER') {
      this.buffs.power = duration;
    } else if (type === 'HEAL') {
      this.hp = Math.min(this.maxHp, this.hp + 200);
    } else if (type === 'INVINCIBLE') {
      this.buffs.invincible = duration;
    }
  }

  public takeHit(bullet: Bullet, dirX: number, dirY: number): boolean {
    if (this.isDead || this.isFalling) return false;
    // 무적 5초 상태에서는 피격 및 넉백 100% 면역
    if (this.buffs.invincible > 0) return false;

    // HP 감쇄
    this.hp = Math.max(0, this.hp - bullet.damage);
    // 누적 대미지% 증가 (맞을수록 넉백 기하급수 증가)
    this.heatPercent = Math.min(350, this.heatPercent + bullet.damage * 1.5);

    // 넉백 임펄스 적용
    Physics.applyKnockback(this, dirX, dirY, bullet.impulse, bullet.knockbackMultiplier);
    this.knockbackStunTimer = 0.40; // 0.4초간 조작 저항력 대폭 감쇄

    if (this.hp <= 0) {
      this.isDead = true;
    }
    return true;
  }

  public setWeapon(weapon: WeaponType): void {
    this.weapon = weapon;
    const stats = WEAPON_CONFIGS[weapon];
    this.maxAmmo = stats.maxAmmo;
    this.ammo = stats.maxAmmo;
    this.isReloading = false;
    this.reloadTimer = 0;
  }

  /**
   * 이동 입력(dx, dy: -1.0 ~ 1.0)을 받아 속도 업데이트
   */
  public applyInput(dx: number, dy: number, dt: number): void {
    if (this.isFalling || this.isDead) return;

    if (dx !== 0 || dy !== 0) {
      // 피격 직후에는 저항력을 25%로 감쇄하여 넉백으로 쭉 밀려나는 쾌감 극대화
      const controlFactor = this.knockbackStunTimer > 0 ? 0.25 : 1.0;
      this.x += dx * this.currentSpeed * controlFactor * dt;
      this.y += dy * this.currentSpeed * controlFactor * dt;
    }
  }

  /**
   * 봇 AI 로직: 살아있는 적을 추적하거나 경기장 중심을 유지
   */
  public updateBotAI(allPlayers: Player[], dt: number): { dx: number; dy: number } {
    if (this.isFalling || this.isDead) return { dx: 0, dy: 0 };

    // 경기장 가장자리에 너무 가까우면 중심 쪽으로 회피
    const distToCenter = Math.hypot(this.x - ARENA_CONFIG.centerX, this.y - ARENA_CONFIG.centerY);
    if (distToCenter > ARENA_CONFIG.radius * 0.75) {
      const angleToCenter = Math.atan2(ARENA_CONFIG.centerY - this.y, ARENA_CONFIG.centerX - this.x);
      return {
        dx: Math.cos(angleToCenter),
        dy: Math.sin(angleToCenter)
      };
    }

    // 가장 가까운 적 탐색
    let nearestEnemy: Player | null = null;
    let minDist = Infinity;

    for (const p of allPlayers) {
      if (p.id === this.id || p.isDead || p.isFalling) continue;
      if (this.team !== 'NONE' && p.team === this.team) continue;

      const d = Math.hypot(p.x - this.x, p.y - this.y);
      if (d < minDist) {
        minDist = d;
        nearestEnemy = p;
      }
    }

    if (nearestEnemy) {
      const angle = Math.atan2(nearestEnemy.y - this.y, nearestEnemy.x - this.x);
      // 거리에 따라 접근 또는 원거리 유지
      const targetDist = this.weapon === 'SHOTGUN' ? 120 : 250;
      if (minDist > targetDist) {
        return { dx: Math.cos(angle) * 0.8, dy: Math.sin(angle) * 0.8 };
      } else if (minDist < targetDist - 40) {
        return { dx: -Math.cos(angle) * 0.8, dy: -Math.sin(angle) * 0.8 };
      } else {
        // 좌우 원운동 회피
        return { dx: -Math.sin(angle) * 0.7, dy: Math.cos(angle) * 0.7 };
      }
    }

    return { dx: 0, dy: 0 };
  }

  /**
   * 살아있는 적 탐색 및 조준 각도 갱신
   */
  public updateAim(allPlayers: Player[]): void {
    if (this.isFalling || this.isDead) {
      this.targetPlayer = null;
      return;
    }

    const config = WEAPON_CONFIGS[this.weapon];
    let nearest: Player | null = null;
    let minDist = config.range;

    for (const other of allPlayers) {
      if (other.id === this.id || other.isDead || other.isFalling) continue;
      if (this.team !== 'NONE' && other.team === this.team) continue;

      const dist = Math.hypot(other.x - this.x, other.y - this.y);
      if (dist < minDist) {
        minDist = dist;
        nearest = other;
      }
    }

    this.targetPlayer = nearest;
    if (nearest) {
      this.angle = Math.atan2(nearest.y - this.y, nearest.x - this.x);
    }
  }

  /**
   * 자동 발사 트리거 (쿨다운 충족 및 사거리 내 적 존재 시)
   */
  public tryShoot(isUnlimitedAmmo: boolean): Bullet[] | null {
    if (this.isFalling || this.isDead || !this.targetPlayer) return null;
    if (this.fireCooldownTimer > 0) return null;
    if (this.isReloading) return null;

    // 탄약 모드 확인
    if (!isUnlimitedAmmo && this.ammo <= 0) {
      this.isReloading = true;
      this.reloadTimer = 1.2; // 1.2초 재장전
      return null;
    }

    const config = WEAPON_CONFIGS[this.weapon];
    this.fireCooldownTimer = config.cooldown;

    if (!isUnlimitedAmmo) {
      this.ammo -= 1;
      if (this.ammo <= 0) {
        this.isReloading = true;
        this.reloadTimer = 1.2;
      }
    }

    const bullets: Bullet[] = [];
    const muzzleDist = this.radius + 6;
    const startX = this.x + Math.cos(this.angle) * muzzleDist;
    const startY = this.y + Math.sin(this.angle) * muzzleDist;

    if (config.pelletCount > 1) {
      // 샷건: 부채꼴 4발
      const halfSpread = config.spreadAngle / 2;
      const step = config.spreadAngle / (config.pelletCount - 1);
      for (let i = 0; i < config.pelletCount; i++) {
        const bulletAngle = this.angle - halfSpread + i * step;
        bullets.push(
          new Bullet(
            this.id,
            this.team,
            this.weapon,
            startX,
            startY,
            bulletAngle,
            this.knockbackBonus
          )
        );
      }
    } else {
      // 피스톨, 스나이퍼, 머신건
      const spread = config.spreadAngle > 0 ? (Math.random() - 0.5) * config.spreadAngle : 0;
      bullets.push(
        new Bullet(
          this.id,
          this.team,
          this.weapon,
          startX,
          startY,
          this.angle + spread,
          this.knockbackBonus
        )
      );
    }

    return bullets;
  }

  /**
   * 물리 및 상태 업데이트
   */
  public update(
    dt: number,
    currentRadius: number = ARENA_CONFIG.radius,
    currentHalfHeight: number = ARENA_CONFIG.halfHeight,
    onRingOut?: (p: Player) => void
  ): void {
    if (this.isDead) return;

    if (!this.isFalling) {
      this.surviveTime += dt;

      // 쿨다운 및 재장전
      if (this.fireCooldownTimer > 0) {
        this.fireCooldownTimer = Math.max(0, this.fireCooldownTimer - dt);
      }
      if (this.isReloading) {
        this.reloadTimer -= dt;
        if (this.reloadTimer <= 0) {
          this.isReloading = false;
          this.ammo = this.maxAmmo;
        }
      }

      // 버프 시간 차감
      if (this.buffs.power > 0) this.buffs.power = Math.max(0, this.buffs.power - dt);
      if (this.buffs.invincible > 0) this.buffs.invincible = Math.max(0, this.buffs.invincible - dt);
      if (this.knockbackStunTimer > 0) this.knockbackStunTimer = Math.max(0, this.knockbackStunTimer - dt);

      // 물리 관성 이동 (넉백 속도 적용)
      this.x += this.vx * dt;
      this.y += this.vy * dt;

      // 마찰 감속
      this.vx *= Math.pow(Physics.FRICTION, dt * 60);
      this.vy *= Math.pow(Physics.FRICTION, dt * 60);
      if (Math.abs(this.vx) < 2) this.vx = 0;
      if (Math.abs(this.vy) < 2) this.vy = 0;

      // 경기장 링아웃 낙사 체크
      if (Physics.isOutOfArena(this.x, this.y, currentRadius, currentHalfHeight, this.radius * 0.5)) {
        this.isFalling = true;
        if (onRingOut) {
          onRingOut(this);
        }
      }
    } else {
      // 낙하 애니메이션 (크기 축소 및 페이드아웃)
      this.x += this.vx * dt * 0.5;
      this.y += this.vy * dt * 0.5;
      this.fallScale = Math.max(0, this.fallScale - dt * 2.2);
      this.fallAlpha = Math.max(0, this.fallAlpha - dt * 2.5);

      if (this.fallScale <= 0 || this.fallAlpha <= 0) {
        this.isDead = true;
        this.fallScale = 0;
        this.fallAlpha = 0;
      }
    }
  }

  /**
   * 시작 카운트다운(3초) 동안 발사/링아웃 없이 조이스틱 이동 관성 및 경기장 안전 유지
   */
  public updateMovementOnly(
    dt: number,
    currentRadius: number = ARENA_CONFIG.radius,
    currentHalfHeight: number = ARENA_CONFIG.halfHeight
  ): void {
    if (this.isDead || this.isFalling) return;

    // 물리 관성 이동
    this.x += this.vx * dt;
    this.y += this.vy * dt;

    // 마찰 감속
    this.vx *= Math.pow(Physics.FRICTION, dt * 60);
    this.vy *= Math.pow(Physics.FRICTION, dt * 60);
    if (Math.abs(this.vx) < 2) this.vx = 0;
    if (Math.abs(this.vy) < 2) this.vy = 0;

    // 카운트다운 동안에는 경기장 경계 밖으로 나가지 못하게 링 내부로 안전 클램프
    const distRatio = Physics.getArenaDistanceRatio(this.x, this.y);
    if (distRatio > 0.88) {
      const angle = Math.atan2(this.y - ARENA_CONFIG.centerY, this.x - ARENA_CONFIG.centerX);
      const maxDist = currentRadius * 0.85;
      this.x = ARENA_CONFIG.centerX + Math.cos(angle) * maxDist;
      this.y = ARENA_CONFIG.centerY + Math.sin(angle) * (currentHalfHeight * 0.85);
      this.vx = 0;
      this.vy = 0;
    }
  }

  public render(ctx: CanvasRenderingContext2D, isMe: boolean = false): void {
    PlayerRenderer.draw(ctx, this, isMe);
  }

  public toSnapshot(): PlayerSnapshot {
    return {
      id: this.id,
      nickname: this.nickname,
      team: this.team,
      isHost: this.isHost,
      isBot: this.isBot,
      x: Math.round(this.x),
      y: Math.round(this.y),
      vx: Math.round(this.vx),
      vy: Math.round(this.vy),
      angle: parseFloat(this.angle.toFixed(2)),
      weapon: this.weapon,
      ammo: this.ammo,
      isReloading: this.isReloading,
      isFalling: this.isFalling,
      isDead: this.isDead,
      fallScale: parseFloat(this.fallScale.toFixed(2)),
      fallAlpha: parseFloat(this.fallAlpha.toFixed(2)),
      hp: Math.round(this.hp),
      maxHp: this.maxHp,
      heatPercent: Math.round(this.heatPercent),
      buffs: {
        power: parseFloat(this.buffs.power.toFixed(1)),
        invincible: parseFloat(this.buffs.invincible.toFixed(1))
      },
      ringOutRank: this.ringOutRank,
      surviveTime: parseFloat(this.surviveTime.toFixed(1))
    };
  }
}
