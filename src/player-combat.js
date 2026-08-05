export function applyPlayerDamage(player, amount) {
  if (player.invulnerable > 0 || player.respawnTimer > 0) {
    return { applied: false, died: false };
  }

  player.hp = Math.max(0, player.hp - amount);
  player.invulnerable = 1;
  player.hitFlash = 0.18;
  const died = player.hp === 0;
  if (died) player.respawnTimer = 1.2;
  return { applied: true, died };
}

export function tickPlayerStatus(player, dt) {
  player.invulnerable = Math.max(0, player.invulnerable - dt);
  player.hitFlash = Math.max(0, player.hitFlash - dt);
  if (player.respawnTimer > 0) player.respawnTimer = Math.max(0, player.respawnTimer - dt);
}

export function respawnPlayer(player, spawn = { x: 1440, y: 1110 }) {
  player.x = spawn.x;
  player.y = spawn.y;
  player.prevX = spawn.x;
  player.prevY = spawn.y;
  player.hp = player.maxHp;
  player.mp = player.maxMp;
  player.invulnerable = 0;
  player.hitFlash = 0;
  player.respawnTimer = 0;
}
