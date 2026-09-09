// Physics and Collision Engine for Coffee Strike

import { DEFAULT_ARENA_CONFIG, Arena } from './Arena';

export { Arena, DEFAULT_ARENA_CONFIG };
export const ARENA_CONFIG = { ...DEFAULT_ARENA_CONFIG };

export class Physics {
  // 선형 마찰 계수 (0.94: 부드러운 빙판 미끄러짐 및 시원한 넉백)
  public static readonly FRICTION = 0.94;

  /**
   * 두 점 사이의 거리 계산
   */
  public static distance(x1: number, y1: number, x2: number, y2: number): number {
    return Math.hypot(x2 - x1, y2 - y1);
  }

  /**
   * 원과 원의 충돌 검사
   */
  public static checkCircleCircle(
    x1: number, y1: number, r1: number,
    x2: number, y2: number, r2: number
  ): boolean {
    const dist = Math.hypot(x2 - x1, y2 - y1);
    return dist < (r1 + r2);
  }

  /**
   * 원(Circle)과 축정렬 직사각형(AABB) 충돌 검사
   */
  public static checkCircleRect(
    cx: number, cy: number, cr: number,
    rx: number, ry: number, rw: number, rh: number
  ): { collided: boolean; nearestX: number; nearestY: number } {
    // 사각형 내에서 원 중심과 가장 가까운 점(Clamping)
    const nearestX = Math.max(rx, Math.min(cx, rx + rw));
    const nearestY = Math.max(ry, Math.min(cy, ry + rh));

    const dx = cx - nearestX;
    const dy = cy - nearestY;
    const dist = Math.hypot(dx, dy);

    return {
      collided: dist < cr,
      nearestX,
      nearestY
    };
  }

  /**
   * 엄폐물(AABB)과 플레이어(Circle) 충돌 해결 (슬라이딩 처리)
   */
  public static resolveCircleRect(
    circle: { x: number; y: number; vx: number; vy: number; radius: number },
    rect: { x: number; y: number; width: number; height: number }
  ): void {
    const nearestX = Math.max(rect.x, Math.min(circle.x, rect.x + rect.width));
    const nearestY = Math.max(rect.y, Math.min(circle.y, rect.y + rect.height));

    const dx = circle.x - nearestX;
    const dy = circle.y - nearestY;
    const dist = Math.hypot(dx, dy);

    if (dist < circle.radius) {
      if (dist === 0) {
        // 완전히 사각형 내부인 경우 바깥으로 밀어냄
        circle.x += 1;
        return;
      }
      const overlap = circle.radius - dist;
      const nx = dx / dist;
      const ny = dy / dist;

      // 위치 보정
      circle.x += nx * overlap;
      circle.y += ny * overlap;

      // 법선 방향 속도 제거 (미끄러짐 효과)
      const dot = circle.vx * nx + circle.vy * ny;
      if (dot < 0) {
        circle.vx -= dot * nx;
        circle.vy -= dot * ny;
      }
    }
  }

  /**
   * 플레이어 간 원-원 충돌 해결 (반발 및 밀어내기)
   */
  public static resolveCircleCircle(
    p1: { x: number; y: number; vx: number; vy: number; radius: number; mass: number },
    p2: { x: number; y: number; vx: number; vy: number; radius: number; mass: number }
  ): void {
    const dx = p2.x - p1.x;
    const dy = p2.y - p1.y;
    const dist = Math.hypot(dx, dy);
    const minDist = p1.radius + p2.radius;

    if (dist < minDist && dist > 0) {
      const nx = dx / dist;
      const ny = dy / dist;
      const overlap = minDist - dist;

      // 질량 비례 위치 분할
      const totalMass = p1.mass + p2.mass;
      const r1 = p2.mass / totalMass;
      const r2 = p1.mass / totalMass;

      p1.x -= nx * overlap * r1;
      p1.y -= ny * overlap * r1;
      p2.x += nx * overlap * r2;
      p2.y += ny * overlap * r2;

      // 탄성 충돌 임펄스 분배 (강력한 스모 범핑 반발력)
      const kx = p1.vx - p2.vx;
      const ky = p1.vy - p2.vy;
      const relSpeed = nx * kx + ny * ky;
      const baseBump = 95; // 부딪히기만 해도 서로 튕겨나가는 기본 임펄스 상향
      const p = Math.max(baseBump, 2.4 * Math.abs(relSpeed)) / totalMass;

      p1.vx -= nx * p * p2.mass;
      p1.vy -= ny * p * p2.mass;
      p2.vx += nx * p * p1.mass;
      p2.vy += ny * p * p1.mass;
    }
  }

  /**
   * 넉백 임펄스 적용 공식 (누적 대미지% 반영 스매시 스케일링)
   * v_target = v_target + (F_knockback * itemMultiplier * (1 + heat% * 1.5)) / mass_target
   */
  public static applyKnockback(
    target: { vx: number; vy: number; mass: number; heatPercent?: number },
    dirX: number,
    dirY: number,
    impulse: number,
    itemMultiplier: number = 1.0
  ): void {
    const heat = target.heatPercent || 0;
    const heatMultiplier = 1.0 + (heat / 100) * 0.8; // 누적 피격 시 완만하게 넉백 증가 (100%일 때 1.8배)
    const effectiveImpulse = (impulse * itemMultiplier * heatMultiplier) / Math.max(0.3, target.mass);
    target.vx += dirX * effectiveImpulse;
    target.vy += dirY * effectiveImpulse;
  }

  /**
   * 경기장 플랫폼 밖으로 벗어났는지 확인 (스타디움 캡슐 Ring-out 검사)
   */
  public static isOutOfArena(x: number, y: number, currentRadius: number = ARENA_CONFIG.radius, currentHalfHeight: number = ARENA_CONFIG.halfHeight, margin: number = 0): boolean {
    const clampedY = Math.max(ARENA_CONFIG.centerY - currentHalfHeight, Math.min(ARENA_CONFIG.centerY + currentHalfHeight, y));
    const dist = Math.hypot(x - ARENA_CONFIG.centerX, y - clampedY);
    return dist > (currentRadius + margin);
  }

  /**
   * 링아웃까지 남은 거리 비율 (0: 중심 축, 1: 경계선)
   */
  public static getArenaDistanceRatio(x: number, y: number, currentRadius: number = ARENA_CONFIG.radius, currentHalfHeight: number = ARENA_CONFIG.halfHeight): number {
    const clampedY = Math.max(ARENA_CONFIG.centerY - currentHalfHeight, Math.min(ARENA_CONFIG.centerY + currentHalfHeight, y));
    const dist = Math.hypot(x - ARENA_CONFIG.centerX, y - clampedY);
    return Math.min(1.0, dist / Math.max(1, currentRadius));
  }
}
