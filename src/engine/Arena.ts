// Stadium Arena State & Bounds Management for Coffee Strike

export interface ArenaConfig {
  centerX: number;
  centerY: number;
  baseRadius: number;
  baseHalfHeight: number;
  radius: number;
  halfHeight: number;
  dangerMargin: number;
}

export const DEFAULT_ARENA_CONFIG: Readonly<ArenaConfig> = Object.freeze({
  centerX: 360,
  centerY: 640,
  baseRadius: 310,
  baseHalfHeight: 160,
  radius: 310,
  halfHeight: 160,
  dangerMargin: 30
});

export class Arena {
  public radius: number;
  public halfHeight: number;
  public readonly centerX: number;
  public readonly centerY: number;
  public readonly baseRadius: number;
  public readonly baseHalfHeight: number;
  public readonly dangerMargin: number;

  constructor(config: Partial<ArenaConfig> = {}) {
    const cfg = { ...DEFAULT_ARENA_CONFIG, ...config };
    this.centerX = cfg.centerX;
    this.centerY = cfg.centerY;
    this.baseRadius = cfg.baseRadius;
    this.baseHalfHeight = cfg.baseHalfHeight;
    this.radius = cfg.radius;
    this.halfHeight = cfg.halfHeight;
    this.dangerMargin = cfg.dangerMargin;
  }

  /**
   * 경기장 크기 업데이트 (경기 시간 절반/60초 이하 경과 후 서서히 수축)
   */
  public updateShrink(timeRemaining: number): void {
    if (timeRemaining < 60) {
      const shrinkRatio = Math.max(0, timeRemaining / 60);
      this.radius = 210 + (this.baseRadius - 210) * shrinkRatio;
      this.halfHeight = 60 + (this.baseHalfHeight - 60) * shrinkRatio;
    } else {
      this.radius = this.baseRadius;
      this.halfHeight = this.baseHalfHeight;
    }
  }

  /**
   * 경기장 이탈(낙사/Ring-out) 판정
   */
  public isOutOfBounds(x: number, y: number, margin: number = 0): boolean {
    const clampedY = Math.max(
      this.centerY - this.halfHeight,
      Math.min(this.centerY + this.halfHeight, y)
    );
    const dist = Math.hypot(x - this.centerX, y - clampedY);
    return dist > (this.radius + margin);
  }

  /**
   * 링아웃 위험도 비율 반환 (0.0 ~ 1.0+)
   */
  public getDistanceRatio(x: number, y: number): number {
    const clampedY = Math.max(
      this.centerY - this.halfHeight,
      Math.min(this.centerY + this.halfHeight, y)
    );
    const dist = Math.hypot(x - this.centerX, y - clampedY);
    return dist / this.radius;
  }

  /**
   * 경기장 초기화
   */
  public reset(): void {
    this.radius = this.baseRadius;
    this.halfHeight = this.baseHalfHeight;
  }
}
