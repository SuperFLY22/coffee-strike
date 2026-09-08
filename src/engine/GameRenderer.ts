// Canvas 2D Rendering Engine for Coffee Strike
import { Arena } from './Arena';
import { Player } from '../objects/Player';
import { Bullet } from '../objects/Bullet';
import { Obstacle } from '../objects/Obstacle';
import { Item } from '../objects/Item';
import { Joystick } from './Joystick';

export interface ShockwaveEffect {
  x: number;
  y: number;
  radius: number;
  maxRadius: number;
  color: string;
  alpha: number;
}

export interface GameRenderState {
  ctx: CanvasRenderingContext2D;
  virtualWidth: number;
  virtualHeight: number;
  arena: Arena;
  players: Map<string, Player>;
  bullets: Bullet[];
  obstacles: Obstacle[];
  items: Item[];
  shockwaves: ShockwaveEffect[];
  joystick: Joystick;
  myPlayerId: string;
  isSuddenDeath: boolean;
  suddenDeathWarningTimer: number;
  screenShake: number;
}

export class GameRenderer {
  /**
   * 경기장 및 게임 오브젝트 전체 프레임 렌더링
   */
  public static render(state: GameRenderState, onUpdateShake?: (newShake: number) => void): void {
    const dpr = typeof window !== 'undefined' ? Math.min(window.devicePixelRatio || 1, 2) : 1;
    const ctx = state.ctx;

    ctx.save();
    ctx.scale(dpr, dpr);

    // 피격 화면 흔들림 효과
    let currentShake = state.screenShake;
    if (currentShake > 0) {
      const sx = (Math.random() - 0.5) * currentShake;
      const sy = (Math.random() - 0.5) * currentShake;
      ctx.translate(sx, sy);
      currentShake = Math.max(0, currentShake - 0.8);
      if (onUpdateShake) {
        onUpdateShake(currentShake);
      }
    }

    // 1. 배경 심연 렌더링
    this.renderBackground(ctx, state.virtualWidth, state.virtualHeight, state.arena);

    // 2. 경기장 플랫폼 렌더링
    this.renderArena(ctx, state.arena, state.isSuddenDeath);

    // 3. 엄폐물 렌더링
    for (const obs of state.obstacles) {
      obs.render(ctx);
    }

    // 4. 아이템 렌더링
    for (const item of state.items) {
      item.render(ctx);
    }

    // 5. 플레이어 렌더링 (낙하 중인 플레이어 먼저, 살아있는 플레이어 나중에)
    const sortedPlayers = Array.from(state.players.values()).sort((a, b) => {
      if (a.isFalling && !b.isFalling) return -1;
      if (!a.isFalling && b.isFalling) return 1;
      return 0;
    });

    for (const p of sortedPlayers) {
      p.render(ctx, p.id === state.myPlayerId);
    }

    // 6. 총알 렌더링
    for (const b of state.bullets) {
      b.render(ctx);
    }

    // 7. 충격파 이펙트
    for (const sw of state.shockwaves) {
      ctx.save();
      ctx.beginPath();
      ctx.arc(sw.x, sw.y, sw.radius, 0, Math.PI * 2);
      ctx.strokeStyle = sw.color;
      ctx.globalAlpha = sw.alpha;
      ctx.lineWidth = 3;
      ctx.stroke();
      ctx.restore();
    }

    // 8. 가상 조이스틱 터치 링 렌더링
    state.joystick.render(ctx);

    // 9. 서든데스 경고 오버레이
    if (state.suddenDeathWarningTimer > 0) {
      this.renderSuddenDeathWarning(ctx, state.virtualWidth, state.arena);
    }

    ctx.restore();
  }

  public static renderBackground(
    ctx: CanvasRenderingContext2D,
    virtualWidth: number,
    virtualHeight: number,
    arena: Arena
  ): void {
    // 깊은 사이버 우주 심연 그라데이션
    const bgGrad = ctx.createRadialGradient(
      arena.centerX, arena.centerY, 100,
      arena.centerX, arena.centerY, 700
    );
    bgGrad.addColorStop(0, '#090d16');
    bgGrad.addColorStop(1, '#020408');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, virtualWidth, virtualHeight);

    // 배경 그리드 패턴
    ctx.strokeStyle = 'rgba(30, 41, 59, 0.4)';
    ctx.lineWidth = 1;
    const gridSize = 60;
    for (let x = 0; x < virtualWidth; x += gridSize) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, virtualHeight);
      ctx.stroke();
    }
    for (let y = 0; y < virtualHeight; y += gridSize) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(virtualWidth, y);
      ctx.stroke();
    }
  }

  public static renderStadiumPath(
    ctx: CanvasRenderingContext2D,
    cx: number,
    cy: number,
    r: number,
    h: number
  ): void {
    ctx.beginPath();
    ctx.arc(cx, cy - h, r, Math.PI, 0, false);
    ctx.lineTo(cx + r, cy + h);
    ctx.arc(cx, cy + h, r, 0, Math.PI, false);
    ctx.lineTo(cx - r, cy - h);
    ctx.closePath();
  }

  public static renderArena(
    ctx: CanvasRenderingContext2D,
    arena: Arena,
    isSuddenDeath: boolean
  ): void {
    const cx = arena.centerX;
    const cy = arena.centerY;
    const r = arena.radius;
    const h = arena.halfHeight;

    // 1. 경기장 바닥 그림자 (스타디움)
    this.renderStadiumPath(ctx, cx, cy + 12, r + 4, h);
    ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
    ctx.fill();

    // 2. 플랫폼 본체 (스타디움 배틀그라운드 그라데이션)
    const platGrad = ctx.createRadialGradient(cx, cy, 20, cx, cy, r + h);
    platGrad.addColorStop(0, '#1e293b');
    platGrad.addColorStop(0.75, '#0f172a');
    platGrad.addColorStop(1, '#090d16');

    this.renderStadiumPath(ctx, cx, cy, r, h);
    ctx.fillStyle = platGrad;
    ctx.fill();

    // 3. 동심원 전술 라인 및 센터 로고
    ctx.strokeStyle = 'rgba(56, 189, 248, 0.15)';
    ctx.lineWidth = 1.5;
    this.renderStadiumPath(ctx, cx, cy, r * 0.45, h * 0.45);
    ctx.stroke();
    this.renderStadiumPath(ctx, cx, cy, r * 0.8, h * 0.8);
    ctx.stroke();

    // 중앙 커피 컵 그래픽 (미니멀 네온)
    ctx.font = '40px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.globalAlpha = 0.12;
    ctx.fillText('☕', cx, cy);
    ctx.globalAlpha = 1.0;

    // 4. 낙사 위험 경계선 (Danger Perimeter 펄스 네온)
    const dangerColor = isSuddenDeath ? '#ef4444' : '#f59e0b';
    this.renderStadiumPath(ctx, cx, cy, r, h);
    ctx.strokeStyle = dangerColor;
    ctx.lineWidth = isSuddenDeath ? 4.5 : 3;
    ctx.stroke();

    // 경계선 외곽 글로우
    this.renderStadiumPath(ctx, cx, cy, r + 3, h + 3);
    ctx.strokeStyle = isSuddenDeath ? 'rgba(239, 68, 68, 0.35)' : 'rgba(245, 158, 11, 0.25)';
    ctx.lineWidth = 6;
    ctx.stroke();
  }

  public static renderSuddenDeathWarning(
    ctx: CanvasRenderingContext2D,
    virtualWidth: number,
    arena: Arena
  ): void {
    ctx.save();
    // 상단 사이렌 배너
    ctx.fillStyle = 'rgba(239, 68, 68, 0.85)';
    ctx.fillRect(0, 180, virtualWidth, 70);

    ctx.font = '900 24px system-ui, -apple-system, sans-serif';
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('⚠️ SUDDEN DEATH: 엄폐물 제거! ⚠️', arena.centerX, 203);

    ctx.font = 'bold 14px system-ui, -apple-system, sans-serif';
    ctx.fillStyle = '#fef08a';
    ctx.fillText('탄약 무제한 난타전 개시!', arena.centerX, 230);
    ctx.restore();
  }
}
