import { ItemType, ITEM_CONFIGS, ItemSnapshot } from '../engine/Types';

export class Item {
  public id: string;
  public type: ItemType;
  public x: number;
  public y: number;
  public radius: number = 16;
  public lifetime: number = 15.0; // 필드에 15초간 잔존
  public active: boolean = true;
  private pulseTimer: number = 0;

  constructor(id: string, type: ItemType, x: number, y: number) {
    this.id = id;
    this.type = type;
    this.x = x;
    this.y = y;
    this.lifetime = 15.0; // 15초 후 자동 소멸
  }

  public update(dt: number): void {
    if (!this.active) return;
    this.pulseTimer += dt * 4;
    this.lifetime -= dt;
    if (this.lifetime <= 0) {
      this.active = false;
    }
  }

  public render(ctx: CanvasRenderingContext2D): void {
    if (!this.active) return;

    const config = ITEM_CONFIGS[this.type];
    const scale = 1.0 + Math.sin(this.pulseTimer) * 0.12;

    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.scale(scale, scale);

    // 바닥 빛 번짐 (Glow)
    const glow = ctx.createRadialGradient(0, 0, 4, 0, 0, this.radius * 1.6);
    glow.addColorStop(0, config.color);
    glow.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(0, 0, this.radius * 1.6, 0, Math.PI * 2);
    ctx.fill();

    // 외부 링
    ctx.beginPath();
    ctx.arc(0, 0, this.radius, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
    ctx.fill();
    ctx.strokeStyle = config.color;
    ctx.lineWidth = 2.5;
    ctx.stroke();

    // 아이콘 이모지
    ctx.font = '14px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(config.icon, 0, 1);

    ctx.restore();
  }

  public toSnapshot(): ItemSnapshot {
    return {
      id: this.id,
      type: this.type,
      x: Math.round(this.x),
      y: Math.round(this.y),
      radius: this.radius,
      lifetime: Math.max(0, parseFloat(this.lifetime.toFixed(1)))
    };
  }
}
