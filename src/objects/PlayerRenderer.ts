// Player 2D Canvas Renderer for Coffee Strike
import { TEAM_COLORS } from '../engine/Types';
import type { Player } from './Player';

export class PlayerRenderer {
  /**
   * 플레이어 캐릭터 및 상태 렌더링
   */
  public static draw(ctx: CanvasRenderingContext2D, player: Player, isMe: boolean = false): void {
    if (player.isDead) return;

    ctx.save();
    ctx.translate(player.x, player.y);
    ctx.scale(player.fallScale, player.fallScale);
    ctx.globalAlpha = player.fallAlpha;

    const baseColor = player.team !== 'NONE'
      ? TEAM_COLORS[player.team]
      : (isMe ? '#38bdf8' : (player.isBot ? '#94a3b8' : '#a855f7'));

    // 1. 버프 오라 렌더링
    if (player.buffs.invincible > 0) {
      // 황금 무적 쉴드 펄스
      ctx.beginPath();
      ctx.arc(0, 0, player.radius + 8, 0, Math.PI * 2);
      ctx.strokeStyle = '#f59e0b';
      ctx.lineWidth = 3.5;
      ctx.stroke();

      ctx.beginPath();
      ctx.arc(0, 0, player.radius + 12, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(251, 191, 36, 0.4)';
      ctx.lineWidth = 2;
      ctx.stroke();
    } else if (player.buffs.power > 0) {
      // 붉은 파워 오라
      ctx.beginPath();
      ctx.arc(0, 0, player.radius + 7, 0, Math.PI * 2);
      ctx.strokeStyle = '#ef4444';
      ctx.lineWidth = 3;
      ctx.stroke();
    }

    // 2. 바닥 그림자
    ctx.beginPath();
    ctx.ellipse(0, 4, player.radius, player.radius * 0.7, 0, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
    ctx.fill();

    // 3. 블래스터 레일건 배럴
    ctx.save();
    ctx.rotate(player.angle);
    ctx.fillStyle = '#1e293b';
    ctx.fillRect(8, -5, 18, 10);
    ctx.strokeStyle = '#475569';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(8, -5, 18, 10);

    // 총구 에너지 코어 라인
    ctx.fillStyle = isMe ? '#00f0ff' : baseColor;
    ctx.fillRect(12, -1.5, 12, 3);
    ctx.restore();

    // 4. 플레이어 캐릭터 본체 (원형 캡슐)
    ctx.beginPath();
    ctx.arc(0, 0, player.radius, 0, Math.PI * 2);
    ctx.fillStyle = baseColor;
    ctx.fill();

    // 내부 음영 하이라이트
    const bodyGrad = ctx.createRadialGradient(-player.radius * 0.3, -player.radius * 0.3, 2, 0, 0, player.radius);
    bodyGrad.addColorStop(0, 'rgba(255, 255, 255, 0.35)');
    bodyGrad.addColorStop(0.7, 'rgba(0, 0, 0, 0.1)');
    bodyGrad.addColorStop(1, 'rgba(0, 0, 0, 0.5)');
    ctx.fillStyle = bodyGrad;
    ctx.beginPath();
    ctx.arc(0, 0, player.radius, 0, Math.PI * 2);
    ctx.fill();

    // 사이버 바이저 (Visor) 안광 효과
    ctx.save();
    ctx.rotate(player.angle);
    ctx.beginPath();
    ctx.ellipse(player.radius * 0.45, 0, 4, player.radius * 0.5, 0, 0, Math.PI * 2);
    ctx.fillStyle = '#0b0f19';
    ctx.fill();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.6)';
    ctx.lineWidth = 1;
    ctx.stroke();

    // 바이저 네온 슬릿
    ctx.beginPath();
    ctx.ellipse(player.radius * 0.45, 0, 1.8, player.radius * 0.35, 0, 0, Math.PI * 2);
    ctx.fillStyle = isMe ? '#00f0ff' : '#f8fafc';
    ctx.fill();
    ctx.restore();

    // 외곽 테두리
    ctx.lineWidth = isMe ? 3.5 : 2;
    ctx.strokeStyle = isMe ? '#00f0ff' : 'rgba(255, 255, 255, 0.85)';
    ctx.stroke();

    // 내 캐릭터인 경우 상단 역삼각형 인디케이터
    if (isMe) {
      ctx.beginPath();
      ctx.moveTo(0, -player.radius - 14);
      ctx.lineTo(-7, -player.radius - 24);
      ctx.lineTo(7, -player.radius - 24);
      ctx.closePath();
      ctx.fillStyle = '#00f0ff';
      ctx.fill();
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }

    // 5. 닉네임 & 무기 뱃지
    ctx.font = 'bold 11px system-ui, -apple-system, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillStyle = '#f8fafc';
    ctx.fillText(player.nickname, 0, -player.radius - 6);

    // 6. 미니 HP 바 & 누적 Heat%
    const barWidth = 34;
    const barHeight = 4;
    const barX = -barWidth / 2;
    const barY = player.radius + 6;

    // HP 바 배경
    ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
    ctx.fillRect(barX - 1, barY - 1, barWidth + 2, barHeight + 2);

    // HP 채우기
    const hpRatio = Math.max(0, Math.min(1.0, player.hp / 100));
    ctx.fillStyle = hpRatio > 0.5 ? '#10b981' : (hpRatio > 0.25 ? '#f59e0b' : '#ef4444');
    ctx.fillRect(barX, barY, barWidth * hpRatio, barHeight);

    // 누적 Heat% 텍스트 (넉백 배율 표시)
    if (player.heatPercent > 0) {
      ctx.font = 'bold 9px system-ui';
      ctx.fillStyle = player.heatPercent >= 100 ? '#ef4444' : '#f59e0b';
      ctx.fillText(`${Math.round(player.heatPercent)}%`, 0, barY + barHeight + 9);
    }

    // 재장전 중 표시
    if (player.isReloading) {
      ctx.font = 'bold 9px system-ui';
      ctx.fillStyle = '#f59e0b';
      ctx.fillText('RELOAD...', 0, barY + barHeight + 20);
    }

    ctx.restore();

    // 7. 타겟팅 락온 링 표시 (내가 조준 중인 적 상단에 십자선/원 렌더링)
    if (isMe && player.targetPlayer && !player.targetPlayer.isDead && !player.targetPlayer.isFalling) {
      this.drawLockOn(ctx, player.targetPlayer);
    }
  }

  /**
   * 조준 락온 링 및 십자선 렌더링
   */
  public static drawLockOn(ctx: CanvasRenderingContext2D, target: Player): void {
    ctx.save();
    ctx.translate(target.x, target.y);
    ctx.strokeStyle = 'rgba(239, 68, 68, 0.75)';
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
}
