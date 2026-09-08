import { Team, WeaponType, WEAPON_CONFIGS, BulletSnapshot } from '../engine/Types';

export class Bullet {
  public id: string;
  public shooterId: string;
  public shooterTeam: Team;
  public weapon: WeaponType;
  public x: number;
  public y: number;
  public vx: number;
  public vy: number;
  public radius: number;
  public color: string;
  public impulse: number;
  public damage: number;
  public knockbackMultiplier: number;
  public distanceTraveled: number = 0;
  public maxRange: number;
  public alive: boolean = true;

  // 트레일 이펙트
  public prevPositions: Array<{ x: number; y: number }> = [];

  constructor(
    shooterId: string,
    shooterTeam: Team,
    weapon: WeaponType,
    startX: number,
    startY: number,
    angle: number,
    knockbackMultiplier: number = 1.0
  ) {
    this.id = 'b_' + Math.random().toString(36).substring(2, 9);
    this.shooterId = shooterId;
    this.shooterTeam = shooterTeam;
    this.weapon = weapon;
    this.knockbackMultiplier = knockbackMultiplier;

    const config = WEAPON_CONFIGS[weapon];
    this.radius = config.bulletRadius;
    this.color = config.color;
    this.impulse = config.impulse;
    this.damage = config.damage * knockbackMultiplier;
    this.maxRange = config.range;

    this.x = startX;
    this.y = startY;
    this.vx = Math.cos(angle) * config.bulletSpeed;
    this.vy = Math.sin(angle) * config.bulletSpeed;
  }

  public update(dt: number): void {
    if (!this.alive) return;

    this.prevPositions.push({ x: this.x, y: this.y });
    if (this.prevPositions.length > 4) {
      this.prevPositions.shift();
    }

    const moveX = this.vx * dt;
    const moveY = this.vy * dt;
    this.x += moveX;
    this.y += moveY;

    this.distanceTraveled += Math.hypot(moveX, moveY);
    if (this.distanceTraveled >= this.maxRange) {
      this.alive = false;
    }
  }

  public render(ctx: CanvasRenderingContext2D): void {
    if (!this.alive) return;

    ctx.save();

    // 트레일 그리기 (스나이퍼는 더 긴 레이저 효과)
    if (this.prevPositions.length > 0) {
      ctx.beginPath();
      ctx.moveTo(this.prevPositions[0].x, this.prevPositions[0].y);
      for (let i = 1; i < this.prevPositions.length; i++) {
        ctx.lineTo(this.prevPositions[i].x, this.prevPositions[i].y);
      }
      ctx.lineTo(this.x, this.y);
      ctx.strokeStyle = this.color;
      ctx.lineWidth = this.weapon === 'SNIPER' ? 3 : this.radius * 1.2;
      ctx.globalAlpha = 0.35;
      ctx.stroke();
    }

    // 총알 본체
    ctx.globalAlpha = 1.0;
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
    ctx.fillStyle = '#ffffff';
    ctx.fill();

    // 글로우 아우라
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.radius + 2, 0, Math.PI * 2);
    ctx.strokeStyle = this.color;
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.restore();
  }

  public toSnapshot(): BulletSnapshot {
    return {
      id: this.id,
      shooterId: this.shooterId,
      shooterTeam: this.shooterTeam,
      weapon: this.weapon,
      x: Math.round(this.x),
      y: Math.round(this.y),
      vx: Math.round(this.vx),
      vy: Math.round(this.vy),
      radius: this.radius,
      color: this.color
    };
  }
}
