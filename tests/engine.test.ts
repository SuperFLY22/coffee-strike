// Automated Verification Suite for Coffee Strike Physics & Rules
import { Physics, ARENA_CONFIG } from '../src/engine/Physics';
import { WEAPON_CONFIGS, ITEM_CONFIGS } from '../src/engine/Types';

function runTests() {
  console.log('--- Coffee Strike Physics & Game Rules Test Suite ---');
  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, testName: string) {
    if (condition) {
      console.log(`✅ [PASS] ${testName}`);
      passed++;
    } else {
      console.error(`❌ [FAIL] ${testName}`);
      failed++;
    }
  }

  // 1. Arena Boundary & Ring-out Check (Stadium)
  const insideArena = !Physics.isOutOfArena(ARENA_CONFIG.centerX, ARENA_CONFIG.centerY);
  assert(insideArena, 'Center of stadium arena is inside bounds');

  const outsideArena = Physics.isOutOfArena(ARENA_CONFIG.centerX + ARENA_CONFIG.radius + 15, ARENA_CONFIG.centerY);
  assert(outsideArena, 'Position beyond stadium arena radius triggers isOutOfArena (Ring-out)');

  // 2. Knockback Impulse Calculation Test (heat 0%)
  const target = { vx: 0, vy: 0, mass: 1.0, heatPercent: 0 };
  Physics.applyKnockback(target, 1, 0, WEAPON_CONFIGS.PISTOL.impulse, 1.0);
  assert(target.vx === WEAPON_CONFIGS.PISTOL.impulse, 'Pistol knockback applied correctly to mass 1.0 at heat 0%');

  // 3. Power Buff (2.0x Knockback Multiplier)
  const powerTarget = { vx: 0, vy: 0, mass: 1.0, heatPercent: 0 };
  Physics.applyKnockback(powerTarget, 1, 0, WEAPON_CONFIGS.SNIPER.impulse, 2.0);
  assert(powerTarget.vx === WEAPON_CONFIGS.SNIPER.impulse * 2, 'Power buff applies 2.0x knockback multiplier');

  // 4. Heat% Knockback Scaling (Heat 100% -> 2.6x multiplier)
  const heatedTarget = { vx: 0, vy: 0, mass: 1.0, heatPercent: 100 };
  Physics.applyKnockback(heatedTarget, 1, 0, 100, 1.0);
  assert(Math.abs(heatedTarget.vx - 260) < 0.01, 'Heat 100% scales knockback by 2.6x');

  // 5. Circle-Rect (Obstacle) Collision Detection
  const rect = { x: 100, y: 100, width: 50, height: 50 };
  const collisionResult = Physics.checkCircleRect(90, 125, 20, rect.x, rect.y, rect.width, rect.height);
  assert(collisionResult.collided, 'Circle overlapping rectangle reports collided = true');

  const noCollision = Physics.checkCircleRect(50, 50, 10, rect.x, rect.y, rect.width, rect.height);
  assert(!noCollision.collided, 'Distant circle reports collided = false');

  // 6. Weapon 4 Types Configuration Validation
  assert(WEAPON_CONFIGS.PISTOL.impulse === 520, 'Pistol impulse is 520');
  assert(WEAPON_CONFIGS.SHOTGUN.pelletCount === 4, 'Shotgun has 4 pellets');
  assert(WEAPON_CONFIGS.SNIPER.damage === 70, 'Sniper has high 70 damage');
  assert(WEAPON_CONFIGS.MACHINEGUN.cooldown === 0.08, 'Machinegun has rapid 0.08s cooldown');

  // 7. New Item Configs Validation
  assert(ITEM_CONFIGS.POWER.duration === 7.0, 'Power item duration is 7.0s');
  assert(ITEM_CONFIGS.INVINCIBLE.duration === 5.0, 'Invincible item duration is 5.0s');
  assert(ITEM_CONFIGS.HEAL.nameKo === '체력 +200', 'Heal item restores 200 HP');

  console.log(`\nTest Result: ${passed} Passed, ${failed} Failed`);
  if (failed > 0) {
    process.exit(1);
  }
}

runTests();
