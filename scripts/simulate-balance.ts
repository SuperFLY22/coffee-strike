import { WEAPON_CONFIGS, WeaponType } from '../src/engine/Types';
import { Physics, ARENA_CONFIG } from '../src/engine/Physics';

interface SimBot {
  id: string;
  weapon: WeaponType;
  x: number;
  y: number;
  vx: number;
  vy: number;
  mass: number;
  heatPercent: number;
  hp: number;
  isAlive: boolean;
  cooldownTimer: number;
  kills: number;
  ringoutsCaused: number;
}

const WEAPONS: WeaponType[] = ['PISTOL', 'SHOTGUN', 'SNIPER', 'MACHINEGUN'];
const TOTAL_ROUNDS = 200;
const DT = 1 / 30; // 30Hz 시뮬레이션
const MAX_TICKS = 30 * 45; // 라운드당 최대 45초

const stats: Record<WeaponType, { wins: number; kills: number; ringouts: number; rounds: number }> = {
  PISTOL: { wins: 0, kills: 0, ringouts: 0, rounds: 0 },
  SHOTGUN: { wins: 0, kills: 0, ringouts: 0, rounds: 0 },
  SNIPER: { wins: 0, kills: 0, ringouts: 0, rounds: 0 },
  MACHINEGUN: { wins: 0, kills: 0, ringouts: 0, rounds: 0 }
};

console.log(`\n🎮 [Coffee Strike] 무기 밸런스 헤드리스 시뮬레이션 시작 (총 ${TOTAL_ROUNDS} 라운드)...`);

for (let r = 0; r < TOTAL_ROUNDS; r++) {
  // 4마리 봇 생성 (각 무기 1개씩 장착)
  const bots: SimBot[] = WEAPONS.map((w, idx) => {
    stats[w].rounds++;
    const angle = (idx * Math.PI * 2) / WEAPONS.length;
    const dist = ARENA_CONFIG.radius * 0.45;
    return {
      id: `bot-${w}`,
      weapon: w,
      x: ARENA_CONFIG.centerX + Math.cos(angle) * dist,
      y: ARENA_CONFIG.centerY + Math.sin(angle) * dist,
      vx: 0,
      vy: 0,
      mass: 1.0,
      heatPercent: 0,
      hp: 100,
      isAlive: true,
      cooldownTimer: Math.random() * 0.5,
      kills: 0,
      ringoutsCaused: 0
    };
  });

  for (let tick = 0; tick < MAX_TICKS; tick++) {
    const aliveBots = bots.filter((b) => b.isAlive);
    if (aliveBots.length <= 1) break;

    // 봇 이동 및 AI 행동
    for (const bot of aliveBots) {
      bot.cooldownTimer -= DT;

      // 중앙 유지 경향 + 가장 가까운 적 탐색
      let target: SimBot | null = null;
      let minDist = Infinity;
      for (const other of aliveBots) {
        if (other.id === bot.id) continue;
        const d = Physics.distance(bot.x, bot.y, other.x, other.y);
        if (d < minDist) {
          minDist = d;
          target = other;
        }
      }

      if (target) {
        // 사거리 내에 있고 쿨다운 종료 시 발사
        const cfg = WEAPON_CONFIGS[bot.weapon];
        if (minDist <= cfg.range && bot.cooldownTimer <= 0) {
          bot.cooldownTimer = cfg.cooldown;

          // 명중 확률 (거리 비례: 80% ~ 40%)
          const hitChance = Math.max(0.35, 0.85 - (minDist / cfg.range) * 0.5);
          if (Math.random() < hitChance) {
            const angle = Math.atan2(target.y - bot.y, target.x - bot.x);
            const dirX = Math.cos(angle);
            const dirY = Math.sin(angle);

            // 대미지 및 넉백 적용
            const totalImpulse = cfg.impulse * (cfg.pelletCount > 1 ? cfg.pelletCount * 0.75 : 1);
            Physics.applyKnockback(target, dirX, dirY, totalImpulse, 1.0);
            target.heatPercent += cfg.damage * 0.8;
            target.hp -= cfg.damage;

            // 링 아웃 또는 HP 0 체크
            if (Physics.isOutOfArena(target.x, target.y) || target.hp <= 0) {
              target.isAlive = false;
              bot.kills++;
              stats[bot.weapon].kills++;
              if (Physics.isOutOfArena(target.x, target.y)) {
                stats[bot.weapon].ringouts++;
              }
            }
          }
        }
      }

      // 물리 이동
      bot.x += bot.vx * DT;
      bot.y += bot.vy * DT;
      bot.vx *= Physics.FRICTION;
      bot.vy *= Physics.FRICTION;

      // 장외 판정
      if (Physics.isOutOfArena(bot.x, bot.y)) {
        bot.isAlive = false;
      }
    }
  }

  const survivors = bots.filter((b) => b.isAlive);
  if (survivors.length === 1) {
    stats[survivors[0].weapon].wins++;
  }
}

console.log('\n======================================================');
console.log('📊 [Coffee Strike] 무기 밸런스 시뮬레이션 결과 리포트');
console.log('======================================================');
console.table(
  WEAPONS.map((w) => {
    const s = stats[w];
    const winRate = ((s.wins / s.rounds) * 100).toFixed(1) + '%';
    const avgKills = (s.kills / s.rounds).toFixed(2);
    const ringoutRate = s.kills > 0 ? ((s.ringouts / s.kills) * 100).toFixed(1) + '%' : '0%';
    return {
      무기명: WEAPON_CONFIGS[w].nameKo,
      총매치수: s.rounds,
      승리수: s.wins,
      승률: winRate,
      평균킬수: avgKills,
      '링아웃 낙사 비율': ringoutRate
    };
  })
);
console.log('💡 팁: 승률이 35% 이상인 무기는 넉백/쿨다운 하향, 15% 미만은 상향 권장.\n');
