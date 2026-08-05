import { getWorldDefinition } from "./world-data.js";

const ENEMY_TYPES = Object.freeze({
  "fire-slime": Object.freeze({
    name: "화염 슬라임", hp: 4, speed: 92, damage: 12, radius: 18,
    color: "#ef5a32", accent: "#ffb23f",
  }),
  "forest-slime": Object.freeze({
    name: "숲 슬라임", hp: 4, speed: 88, damage: 10, radius: 18,
    color: "#4fb867", accent: "#91d66f",
  }),
  boar: Object.freeze({
    name: "멧돼지", hp: 6, speed: 112, damage: 15, radius: 20,
    color: "#8b5a3c", accent: "#d2a36f",
  }),
  crab: Object.freeze({
    name: "해안 게", hp: 5, speed: 76, damage: 12, radius: 20,
    color: "#ef6b57", accent: "#ffc3a7",
  }),
  "water-slime": Object.freeze({
    name: "물방울 슬라임", hp: 4, speed: 84, damage: 10, radius: 18,
    color: "#48a9d8", accent: "#9be5f2",
  }),
});

const AGGRO_DISTANCE = 360;
const RETURN_DISTANCE = 520;
const DEATH_DURATION = 0.65;

export function createEnemies(mapId) {
  return getWorldDefinition(mapId).enemySpawns.map((spawn, index) => {
    const type = ENEMY_TYPES[spawn.kind];
    return {
      id: `${mapId}-enemy-${index + 1}`,
      kind: spawn.kind,
      name: type.name,
      x: spawn.x,
      y: spawn.y,
      prevX: spawn.x,
      prevY: spawn.y,
      homeX: spawn.x,
      homeY: spawn.y,
      hp: type.hp,
      maxHp: type.hp,
      speed: type.speed,
      contactDamage: type.damage,
      radius: type.radius,
      color: type.color,
      accent: type.accent,
      state: "idle",
      moving: false,
      step: index * 1.7,
      hitFlash: 0,
      shake: 0,
      deathTime: 0,
      opacity: 1,
      scale: 1,
      knockbackX: 0,
      knockbackY: 0,
      contactCooldown: 0,
    };
  });
}

export function damageEnemy(enemy, damage, direction, knockbackSpeed) {
  if (enemy.state === "dying") return { killed: false, damageNumber: null };

  enemy.hp = Math.max(0, enemy.hp - damage);
  enemy.hitFlash = 0.16;
  enemy.shake = 0.2;
  enemy.knockbackX = direction.x * knockbackSpeed;
  enemy.knockbackY = direction.y * knockbackSpeed;
  if (enemy.hp === 0) {
    enemy.state = "dying";
    enemy.deathTime = 0;
    enemy.moving = false;
  }

  return {
    killed: enemy.hp === 0,
    damageNumber: { x: enemy.x, y: enemy.y - 26, value: damage },
  };
}

export function updateEnemies(enemies, player, dt, isBlocked) {
  for (const enemy of enemies) {
    enemy.prevX = enemy.x;
    enemy.prevY = enemy.y;
    enemy.hitFlash = Math.max(0, enemy.hitFlash - dt);
    enemy.shake = Math.max(0, enemy.shake - dt);
    enemy.contactCooldown = Math.max(0, enemy.contactCooldown - dt);

    const hasKnockback = Math.hypot(enemy.knockbackX, enemy.knockbackY) > 1;
    if (hasKnockback) {
      moveWithCollision(
        enemy,
        enemy.knockbackX * dt,
        enemy.knockbackY * dt,
        isBlocked,
      );
      const decay = Math.exp(-8 * dt);
      enemy.knockbackX *= decay;
      enemy.knockbackY *= decay;
    } else {
      enemy.knockbackX = 0;
      enemy.knockbackY = 0;
    }

    if (enemy.state === "dying") {
      enemy.deathTime += dt;
      const progress = Math.min(1, enemy.deathTime / DEATH_DURATION);
      enemy.opacity = 1 - progress;
      enemy.scale = 1 - 0.85 * progress;
      continue;
    }

    if (!hasKnockback) updateEnemyMovement(enemy, player, dt, isBlocked);
    if (enemy.moving) enemy.step += dt * 8;
  }

  return enemies.filter(enemy => enemy.state !== "dying" || enemy.deathTime < DEATH_DURATION);
}

export function drawEnemy(ctx, enemy, cameraX, cameraY, alpha = 1) {
  const x = Math.round(lerp(enemy.prevX, enemy.x, alpha) - cameraX);
  const y = Math.round(lerp(enemy.prevY, enemy.y, alpha) - cameraY);
  const bob = enemy.state === "dying"
    ? -Math.sin(Math.min(1, enemy.deathTime / DEATH_DURATION) * Math.PI) * 16
    : Math.sin(enemy.step) * 2;
  const shake = enemy.shake > 0 ? Math.sin(enemy.shake * 95) * 4 : 0;

  ctx.save();
  ctx.globalAlpha = enemy.opacity;
  ctx.translate(x + shake, y + bob);
  ctx.scale(enemy.scale, enemy.scale);
  ctx.fillStyle = "rgba(0,0,0,.28)";
  ctx.fillRect(-20, 12, 40, 8);

  if (enemy.kind === "boar") drawBoar(ctx, enemy);
  else if (enemy.kind === "crab") drawCrab(ctx, enemy);
  else drawSlimeBody(ctx, enemy);

  if (enemy.state !== "dying" && enemy.hp < enemy.maxHp) {
    ctx.fillStyle = "rgba(4,10,7,.8)";
    ctx.fillRect(-21, -31, 42, 5);
    ctx.fillStyle = "#ef4444";
    ctx.fillRect(-20, -30, 40 * (enemy.hp / enemy.maxHp), 3);
  }
  ctx.restore();
}

function drawSlimeBody(ctx, enemy) {
  ctx.fillStyle = enemy.hitFlash > 0 ? "#ffffff" : enemy.color;
  ctx.fillRect(-18, -10, 36, 22);
  ctx.fillRect(-13, -16, 26, 8);
  ctx.fillStyle = enemy.hitFlash > 0 ? "#ffffff" : enemy.accent;
  ctx.fillRect(-15, 7, 30, 7);
  ctx.fillRect(-9, -11, 7, 5);
  ctx.fillStyle = "#17311e";
  ctx.fillRect(-9, -6, 4, 5);
  ctx.fillRect(5, -6, 4, 5);
  ctx.fillRect(-4, 3, 8, 3);
}

function drawBoar(ctx, enemy) {
  ctx.fillStyle = enemy.hitFlash > 0 ? "#ffffff" : enemy.color;
  ctx.fillRect(-22, -13, 38, 27);
  ctx.fillRect(10, -9, 17, 19);
  ctx.fillRect(-17, 11, 7, 9);
  ctx.fillRect(7, 11, 7, 9);
  ctx.fillStyle = enemy.hitFlash > 0 ? "#ffffff" : enemy.accent;
  ctx.fillRect(17, 7, 14, 4);
  ctx.fillRect(16, -14, 5, 8);
  ctx.fillStyle = "#241711";
  ctx.fillRect(18, -4, 4, 4);
}

function drawCrab(ctx, enemy) {
  ctx.fillStyle = enemy.hitFlash > 0 ? "#ffffff" : enemy.color;
  ctx.fillRect(-18, -10, 36, 23);
  ctx.fillRect(-30, -13, 12, 10);
  ctx.fillRect(18, -13, 12, 10);
  ctx.fillRect(-27, 9, 12, 5);
  ctx.fillRect(15, 9, 12, 5);
  ctx.fillStyle = enemy.hitFlash > 0 ? "#ffffff" : enemy.accent;
  ctx.fillRect(-13, -15, 8, 8);
  ctx.fillRect(5, -15, 8, 8);
  ctx.fillStyle = "#2d1714";
  ctx.fillRect(-10, -13, 3, 3);
  ctx.fillRect(7, -13, 3, 3);
}

function updateEnemyMovement(enemy, player, dt, isBlocked) {
  const distanceToPlayer = Math.hypot(player.x - enemy.x, player.y - enemy.y);
  const distanceFromHome = Math.hypot(enemy.homeX - enemy.x, enemy.homeY - enemy.y);
  let target = null;

  if (distanceFromHome > RETURN_DISTANCE) {
    enemy.state = "returning";
    target = { x: enemy.homeX, y: enemy.homeY };
  } else if (distanceToPlayer <= AGGRO_DISTANCE) {
    enemy.state = "chasing";
    target = player;
  } else if (distanceFromHome > 2) {
    enemy.state = "returning";
    target = { x: enemy.homeX, y: enemy.homeY };
  } else {
    enemy.state = "idle";
    enemy.moving = false;
    return;
  }

  const dx = target.x - enemy.x;
  const dy = target.y - enemy.y;
  const distance = Math.hypot(dx, dy);
  if (distance <= 0.001) {
    enemy.moving = false;
    return;
  }

  const step = Math.min(enemy.speed * dt, distance);
  enemy.moving = moveWithCollision(
    enemy,
    dx / distance * step,
    dy / distance * step,
    isBlocked,
  );
}

function moveWithCollision(enemy, dx, dy, isBlocked) {
  let moved = false;
  const nextX = enemy.x + dx;
  if (!isBlocked(nextX, enemy.y, enemy.radius)) {
    enemy.x = nextX;
    moved = true;
  }
  const nextY = enemy.y + dy;
  if (!isBlocked(enemy.x, nextY, enemy.radius)) {
    enemy.y = nextY;
    moved = true;
  }
  return moved;
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

// Temporary compatibility exports keep the game runnable until its orchestration is
// switched to region-aware names in the portal integration task.
export const createSlimes = () => createEnemies("village");
export const damageSlime = damageEnemy;
export const updateSlimes = updateEnemies;
export const drawSlime = drawEnemy;
