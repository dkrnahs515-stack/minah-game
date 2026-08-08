const AREN = Object.freeze({
  id: "aren",
  name: "현자 아렌",
  mapId: "village",
  x: 1440,
  y: 520,
  interactionRadius: 80,
  coatColor: "#6f5bd3",
});

const NPCS_BY_WORLD = Object.freeze({
  village: Object.freeze([AREN]),
});

export function getNpcsForWorld(mapId = "village") {
  return NPCS_BY_WORLD[mapId] || [];
}
