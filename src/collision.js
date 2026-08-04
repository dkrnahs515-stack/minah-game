export function pointInRect(x, y, rect, padding = 0) {
  return x >= rect.x - padding
    && x <= rect.x + rect.w + padding
    && y >= rect.y - padding
    && y <= rect.y + rect.h + padding;
}

export function distanceToSegment(px, py, ax, ay, bx, by) {
  const dx = bx - ax;
  const dy = by - ay;
  if (dx === 0 && dy === 0) return Math.hypot(px - ax, py - ay);

  const projection = ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy);
  const t = Math.max(0, Math.min(1, projection));
  const closestX = ax + t * dx;
  const closestY = ay + t * dy;
  return Math.hypot(px - closestX, py - closestY);
}
