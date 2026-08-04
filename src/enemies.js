const SPAWNS = Object.freeze([
  { x: 1260, y: 1040 },
  { x: 1590, y: 1060 },
  { x: 1450, y: 1330 },
]);

const SLIME_SPEED = 85;
const AGGRO_DISTANCE = 360;
const RETURN_DISTANCE = 520;
const DEATH_DURATION = 0.65;

export function createSlimes() {
  return SPAWNS.map((spawn, index) => ({
    id: `slime-${index + 1}`,
    x: spawn.x,
    y: spawn.y,
    prevX: spawn.x,
    prevY: spawn.y,
    homeX: spawn.x,
    homeY: spawn.y,
    hp: 3,
    maxHp: 3,
    radius: 18,
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
  }));
}

export function damageSlime(slime, damage, direction, knockbackSpeed) {
  if (slime.state === "dying") return { killed: false, damageNumber: null };

  slime.hp = Math.max(0, slime.hp - damage);
  slime.hitFlash = 0.16;
  slime.shake = 0.2;
  slime.knockbackX = direction.x * knockbackSpeed;
  slime.knockbackY = direction.y * knockbackSpeed;
  if (slime.hp === 0) {
    slime.state = "dying";
    slime.deathTime = 0;
    slime.moving = false;
  }

  return {
    killed: slime.hp === 0,
    damageNumber: { x: slime.x, y: slime.y - 26, value: damage },
  };
}

export function updateSlimes(slimes, player, dt, isBlocked) {
  for (const slime of slimes) {
    slime.prevX = slime.x;
    slime.prevY = slime.y;
    slime.hitFlash = Math.max(0, slime.hitFlash - dt);
    slime.shake = Math.max(0, slime.shake - dt);
    slime.contactCooldown = Math.max(0, slime.contactCooldown - dt);

    const hasKnockback = Math.hypot(slime.knockbackX, slime.knockbackY) > 1;
    if (hasKnockback) {
      moveWithCollision(
        slime,
        slime.knockbackX * dt,
        slime.knockbackY * dt,
        isBlocked,
      );
      const decay = Math.exp(-8 * dt);
      slime.knockbackX *= decay;
      slime.knockbackY *= decay;
    } else {
      slime.knockbackX = 0;
      slime.knockbackY = 0;
    }

    if (slime.state === "dying") {
      slime.deathTime += dt;
      const progress = Math.min(1, slime.deathTime / DEATH_DURATION);
      slime.opacity = 1 - progress;
      slime.scale = 1 - 0.85 * progress;
      continue;
    }

    if (!hasKnockback) updateSlimeMovement(slime, player, dt, isBlocked);
    if (slime.moving) slime.step += dt * 8;
  }

  return slimes.filter(slime => slime.state !== "dying" || slime.deathTime < DEATH_DURATION);
}

export function drawSlime(ctx, slime, cameraX, cameraY, alpha = 1) {
  const x = Math.round(lerp(slime.prevX, slime.x, alpha) - cameraX);
  const y = Math.round(lerp(slime.prevY, slime.y, alpha) - cameraY);
  const bob = slime.state === "dying"
    ? -Math.sin(Math.min(1, slime.deathTime / DEATH_DURATION) * Math.PI) * 16
    : Math.sin(slime.step) * 2;
  const shake = slime.shake > 0 ? Math.sin(slime.shake * 95) * 4 : 0;

  ctx.save();
  ctx.globalAlpha = slime.opacity;
  ctx.translate(x + shake, y + bob);
  ctx.scale(slime.scale, slime.scale);

  ctx.fillStyle = "rgba(0,0,0,.28)";
  ctx.fillRect(-18, 12, 36, 8);
  ctx.fillStyle = slime.hitFlash > 0 ? "#ffffff" : "#50c96b";
  ctx.fillRect(-18, -10, 36, 22);
  ctx.fillRect(-13, -16, 26, 8);
  ctx.fillStyle = slime.hitFlash > 0 ? "#dcfce7" : "#2f9349";
  ctx.fillRect(-15, 7, 30, 7);
  ctx.fillStyle = "#14311d";
  ctx.fillRect(-9, -6, 4, 5);
  ctx.fillRect(5, -6, 4, 5);
  ctx.fillRect(-4, 3, 8, 3);

  if (slime.state !== "dying" && slime.hp < slime.maxHp) {
    ctx.fillStyle = "rgba(4,10,7,.8)";
    ctx.fillRect(-19, -27, 38, 5);
    ctx.fillStyle = "#ef4444";
    ctx.fillRect(-18, -26, 36 * (slime.hp / slime.maxHp), 3);
  }
  ctx.restore();
}

function updateSlimeMovement(slime, player, dt, isBlocked) {
  const distanceToPlayer = Math.hypot(player.x - slime.x, player.y - slime.y);
  const distanceFromHome = Math.hypot(slime.homeX - slime.x, slime.homeY - slime.y);
  let target = null;

  if (distanceFromHome > RETURN_DISTANCE) {
    slime.state = "returning";
    target = { x: slime.homeX, y: slime.homeY };
  } else if (distanceToPlayer <= AGGRO_DISTANCE) {
    slime.state = "chasing";
    target = player;
  } else if (distanceFromHome > 2) {
    slime.state = "returning";
    target = { x: slime.homeX, y: slime.homeY };
  } else {
    slime.state = "idle";
    slime.moving = false;
    return;
  }

  const dx = target.x - slime.x;
  const dy = target.y - slime.y;
  const distance = Math.hypot(dx, dy);
  if (distance <= 0.001) {
    slime.moving = false;
    return;
  }

  const step = Math.min(SLIME_SPEED * dt, distance);
  slime.moving = moveWithCollision(
    slime,
    dx / distance * step,
    dy / distance * step,
    isBlocked,
  );
}

function moveWithCollision(slime, dx, dy, isBlocked) {
  let moved = false;
  const nextX = slime.x + dx;
  if (!isBlocked(nextX, slime.y, slime.radius)) {
    slime.x = nextX;
    moved = true;
  }
  const nextY = slime.y + dy;
  if (!isBlocked(slime.x, nextY, slime.radius)) {
    slime.y = nextY;
    moved = true;
  }
  return moved;
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}
