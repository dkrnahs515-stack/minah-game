const ATTACK_DEFINITIONS = Object.freeze({
  basic: Object.freeze({
    damage: 1,
    cooldown: 0.5,
    range: 52,
    arcDegrees: 100,
    windup: 0,
    duration: 0.18,
    mpCost: 0,
    knockback: 230,
  }),
  strong: Object.freeze({
    damage: 3,
    cooldown: 4,
    range: 84,
    arcDegrees: 140,
    windup: 0.22,
    duration: 0.4,
    mpCost: 20,
    knockback: 520,
  }),
});

export function directionVector(direction) {
  return {
    up: { x: 0, y: -1 },
    down: { x: 0, y: 1 },
    left: { x: -1, y: 0 },
    right: { x: 1, y: 0 },
  }[direction] || { x: 0, y: 1 };
}

export function attackDefinition(kind) {
  return ATTACK_DEFINITIONS[kind] || ATTACK_DEFINITIONS.basic;
}

export function isTargetInAttackArc(origin, direction, target, range, arcDegrees) {
  const dx = target.x - origin.x;
  const dy = target.y - origin.y;
  const distance = Math.hypot(dx, dy);
  if (distance === 0 || distance > range) return false;

  const facing = directionVector(direction);
  const cosine = (facing.x * dx + facing.y * dy) / distance;
  const halfArcRadians = (arcDegrees * Math.PI / 180) / 2;
  return cosine >= Math.cos(halfArcRadians);
}
