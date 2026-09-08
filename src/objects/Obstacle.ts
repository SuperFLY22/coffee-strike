import { ObstacleSnapshot } from '../engine/Types';

export class Obstacle {
  public id: string;
  public x: number;
  public y: number;
  public width: number;
  public height: number;
  public active: boolean = true;
  public disintegrating: boolean = false;
  public alpha: number = 1.0;
  public scale: number = 1.0;

  constructor(id: string, x: number, y: number, width: number, height: number) {
    this.id = id;
    this.x = x;
    this.y = y;
    this.width = width;
    this.height = height;
  }

  public triggerDisintegration(): void {
    this.disintegrating = true;
  }

  public update(dt: number): void {
    if (this.disintegrating && this.active) {
      this.alpha -= dt * 2.0; // 0.5초만에 페이드아웃
      this.scale = Math.max(0, this.scale - dt * 2.0);
      if (this.alpha <= 0) {
        this.active = false;
        this.alpha = 0;
      }
    }
  }

  public render(ctx: CanvasRenderingContext2D): void {
    if (!this.active) return;

    ctx.save();
    ctx.globalAlpha = this.alpha;

    const cx = this.x + this.width / 2;
    const cy = this.y + this.height / 2;

    ctx.translate(cx, cy);
    ctx.scale(this.scale, this.scale);
    ctx.translate(-cx, -cy);

    // 엄폐물 그림자
    ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
    ctx.fillRect(this.x + 4, this.y + 6, this.width, this.height);

    // 본체 바위 (사이버 벙커 스타일 그라데이션)
    const grad = ctx.createLinearGradient(this.x, this.y, this.x + this.width, this.y + this.height);
    grad.addColorStop(0, '#334155');
    grad.addColorStop(1, '#1e293b');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.roundRect(this.x, this.y, this.width, this.height, 8);
    ctx.fill();

    // 테두리 네온 라인
    ctx.strokeStyle = this.disintegrating ? '#ef4444' : '#64748b';
    ctx.lineWidth = 2;
    ctx.stroke();

    // 상단 반사광 하이라이트
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(this.x + 4, this.y + 2);
    ctx.lineTo(this.x + this.width - 4, this.y + 2);
    ctx.stroke();

    ctx.restore();
  }

  public toSnapshot(): ObstacleSnapshot {
    return {
      id: this.id,
      x: Math.round(this.x),
      y: Math.round(this.y),
      width: Math.round(this.width),
      height: Math.round(this.height)
    };
  }
}
