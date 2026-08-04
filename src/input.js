export function movementVector(keys) {
  let x = 0;
  let y = 0;
  if (keys.has("ArrowUp")) y -= 1;
  if (keys.has("ArrowDown")) y += 1;
  if (keys.has("ArrowLeft")) x -= 1;
  if (keys.has("ArrowRight")) x += 1;

  const length = Math.hypot(x, y);
  if (length === 0) return { x: 0, y: 0 };
  return { x: x / length, y: y / length };
}
