import {
  WeaponType,
  WEAPON_CONFIGS,
  Team,
  TEAM_COLORS,
  PlayerSnapshot
} from '../engine/Types';
import { Physics, ARENA_CONFIG } from '../engine/Physics';
import { Bullet } from './Bullet';

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
      this.buffs.invincible = 5.0; // 무적 5초
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

  public render(ctx: CanvasRenderingContext2D, isMe: boolean = false): void {
    if (this.isDead) return;

    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.scale(this.fallScale, this.fallScale);
    ctx.globalAlpha = this.fallAlpha;

    const baseColor = this.team !== 'NONE' ? TEAM_COLORS[this.team] : (isMe ? '#38bdf8' : (this.isBot ? '#94a3b8' : '#a855f7'));

    // 1. 버프 오라 렌더링
    if (this.buffs.invincible > 0) {
      // 황금 무적 쉴드 펄스
      ctx.beginPath();
      ctx.arc(0, 0, this.radius + 8, 0, Math.PI * 2);
      ctx.strokeStyle = '#f59e0b';
      ctx.lineWidth = 3.5;
      ctx.stroke();

      ctx.beginPath();
      ctx.arc(0, 0, this.radius + 12, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(251, 191, 36, 0.4)';
      ctx.lineWidth = 2;
      ctx.stroke();
    } else if (this.buffs.power > 0) {
      // 붉은 파워 오라
      ctx.beginPath();
      ctx.arc(0, 0, this.radius + 7, 0, Math.PI * 2);
      ctx.strokeStyle = '#ef4444';
      ctx.lineWidth = 3;
      ctx.stroke();
    }

    // 2. 바닥 그림자
    ctx.beginPath();
    ctx.ellipse(0, 4, this.radius, this.radius * 0.7, 0, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
    ctx.fill();

    // 3. 총구(Gun Barrel) 렌더링
    ctx.save();
    ctx.rotate(this.angle);
    ctx.fillStyle = '#475569';
    ctx.fillRect(8, -4, 16, 8);
    ctx.strokeStyle = '#1e293b';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(8, -4, 16, 8);
    ctx.restore();

    // 4. 플레이어 캐릭터 본체 (원형 캡슐)
    ctx.beginPath();
    ctx.arc(0, 0, this.radius, 0, Math.PI * 2);
    ctx.fillStyle = baseColor;
    ctx.fill();

    // 테두리
    ctx.lineWidth = isMe ? 3 : 2;
    ctx.strokeStyle = isMe ? '#ffffff' : 'rgba(255, 255, 255, 0.7)';
    ctx.stroke();

    // 내 캐릭터인 경우 상단 역삼각형 인디케이터
    if (isMe) {
      ctx.beginPath();
      ctx.moveTo(0, -this.radius - 16);
      ctx.lineTo(-6, -this.radius - 24);
      ctx.lineTo(6, -this.radius - 24);
      ctx.closePath();
      ctx.fillStyle = '#38bdf8';
      ctx.fill();
    }

    // 5. 닉네임 & 무기 뱃지
    ctx.font = 'bold 11px system-ui, -apple-system, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillStyle = '#f8fafc';
    ctx.fillText(this.nickname, 0, -this.radius - 6);

    // 6. 미니 HP 바 & 누적 Heat%
    const barWidth = 34;
    const barHeight = 4;
    const barX = -barWidth / 2;
    const barY = this.radius + 6;

    // HP 바 배경
    ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
    ctx.fillRect(barX - 1, barY - 1, barWidth + 2, barHeight + 2);

    // HP 채우기
    const hpRatio = Math.max(0, Math.min(1.0, this.hp / 100));
    ctx.fillStyle = hpRatio > 0.5 ? '#10b981' : (hpRatio > 0.25 ? '#f59e0b' : '#ef4444');
    ctx.fillRect(barX, barY, barWidth * hpRatio, barHeight);

    // 누적 Heat% 텍스트 (넉백 배율 표시)
    if (this.heatPercent > 0) {
      ctx.font = 'bold 9px system-ui';
      ctx.fillStyle = this.heatPercent >= 100 ? '#ef4444' : '#f59e0b';
      ctx.fillText(`${Math.round(this.heatPercent)}%`, 0, barY + barHeight + 9);
    }

    // 재장전 중 표시
    if (this.isReloading) {
      ctx.font = 'bold 9px system-ui';
      ctx.fillStyle = '#f59e0b';
      ctx.fillText('RELOAD...', 0, barY + barHeight + 20);
    }

    ctx.restore();

    // 7. 타겟팅 락온 링 표시 (내가 조준 중인 적 상단에 십자선/원 렌더링)
    if (isMe && this.targetPlayer && !this.targetPlayer.isDead && !this.targetPlayer.isFalling) {
      this.renderLockOn(ctx, this.targetPlayer);
    }
  }

  private renderLockOn(ctx: CanvasRenderingContext2D, target: Player): void {
    ctx.save();
    ctx.translate(target.x, target.y);
    ctx.strokeStyle = 'rgba(239, 68, 68, 0.75)'; // Red target lock
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(0, 0, target.radius + 8, 0, Math.PI * 2);
    ctx.stroke();

    // 조준선 4점
    const tickLen = 5;
    const r = target.radius + 8;
    ctx.beginPath();
    ctx.moveTo(-r - tickLen, 0); ctx.lineTo(-r + tickLen, 0);
    ctx.moveTo(r - tickLen, 0); ctx.lineTo(r + tickLen, 0);
    ctx.moveTo(0, -r - tickLen); ctx.lineTo(0, -r + tickLen);
    ctx.moveTo(0, r - tickLen); ctx.lineTo(0, r + tickLen);
    ctx.stroke();

    ctx.restore();
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
