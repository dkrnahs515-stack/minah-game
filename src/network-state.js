import { getWorldDefinition, normalizeWorldId } from "./world-data.js";

export function serializePlayerState(player, mapId) {
  return {
    x: Math.round(player.x * 10) / 10,
    y: Math.round(player.y * 10) / 10,
    dir: player.dir,
    moving: Boolean(player.moving),
    color: player.color,
    name: player.name,
    mapId: normalizeWorldId(mapId),
  };
}

export function filterPlayersForMap(rawPlayers, ownUid, activeMapId) {
  const mapId = normalizeWorldId(activeMapId);
  const world = getWorldDefinition(mapId);
  const players = new Map();

  Object.entries(rawPlayers || {}).forEach(([uid, raw]) => {
    if (uid === ownUid || normalizeWorldId(raw?.mapId) !== mapId) return;
    if (!Number.isFinite(raw?.x) || !Number.isFinite(raw?.y)) return;
    if (raw.x < 0 || raw.y < 0 || raw.x > world.width || raw.y > world.height) return;
    players.set(uid, { ...raw, mapId });
  });

  return players;
}
