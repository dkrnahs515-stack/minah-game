export const WORLD_IDS = Object.freeze(["village", "volcano", "forest", "coast"]);

const villagePortals = Object.freeze([
  {
    id: "to-forest", x: 570, y: 410, w: 96, h: 96,
    label: "태고의 숲", color: "#53d769",
    destination: Object.freeze({ mapId: "forest", x: 2160, y: 3260 }),
  },
  {
    id: "to-volcano", x: 2214, y: 410, w: 96, h: 96,
    label: "활화산", color: "#ff7043",
    destination: Object.freeze({ mapId: "volcano", x: 2160, y: 3260 }),
  },
  {
    id: "to-coast", x: 1392, y: 1620, w: 96, h: 96,
    label: "해안가", color: "#38bdf8",
    destination: Object.freeze({ mapId: "coast", x: 2160, y: 340 }),
  },
]);

function returnPortal(id, x, y) {
  return Object.freeze({
    id, x, y, w: 96, h: 96,
    label: "중앙 마을", color: "#d8b4fe",
    destination: Object.freeze({ mapId: "village", x: 1440, y: 1180 }),
  });
}

export const WORLD_DEFINITIONS = Object.freeze({
  village: Object.freeze({
    id: "village",
    name: "중앙 마을",
    width: 2880,
    height: 1800,
    spawn: Object.freeze({ x: 1440, y: 1110 }),
    safe: true,
    portals: villagePortals,
    enemySpawns: Object.freeze([]),
    obstacles: Object.freeze([
      { x: 1120, y: 180, w: 640, h: 250, type: "townHall" },
      { x: 240, y: 650, w: 690, h: 430, type: "farm" },
      { x: 2020, y: 610, w: 560, h: 350, type: "shops" },
      { x: 1080, y: 1320, w: 720, h: 240, type: "tradePost" },
    ]),
  }),
  volcano: Object.freeze({
    id: "volcano",
    name: "끓어오르는 활화산",
    width: 4320,
    height: 3600,
    spawn: Object.freeze({ x: 2160, y: 3260 }),
    safe: false,
    portals: Object.freeze([returnPortal("to-village", 2112, 3320)]),
    enemySpawns: Object.freeze([
      { kind: "fire-slime", x: 1250, y: 2850 },
      { kind: "fire-slime", x: 1750, y: 2480 },
      { kind: "fire-slime", x: 2580, y: 2630 },
      { kind: "fire-slime", x: 3150, y: 2860 },
      { kind: "fire-slime", x: 1120, y: 1720 },
      { kind: "fire-slime", x: 2110, y: 1510 },
      { kind: "fire-slime", x: 3050, y: 1680 },
      { kind: "fire-slime", x: 2190, y: 820 },
    ]),
    obstacles: Object.freeze([
      { x: 0, y: 0, w: 760, h: 3600, type: "lava" },
      { x: 3560, y: 0, w: 760, h: 3600, type: "lava" },
      { x: 1560, y: 620, w: 1200, h: 620, type: "crater" },
      { x: 1200, y: 1960, w: 520, h: 340, type: "lava" },
      { x: 2700, y: 2050, w: 520, h: 360, type: "lava" },
    ]),
  }),
  forest: Object.freeze({
    id: "forest",
    name: "태고의 숲",
    width: 4320,
    height: 3600,
    spawn: Object.freeze({ x: 2160, y: 3260 }),
    safe: false,
    portals: Object.freeze([returnPortal("to-village", 2112, 3320)]),
    enemySpawns: Object.freeze([
      { kind: "forest-slime", x: 980, y: 2820 },
      { kind: "forest-slime", x: 1660, y: 2430 },
      { kind: "forest-slime", x: 2670, y: 2580 },
      { kind: "forest-slime", x: 3380, y: 2800 },
      { kind: "forest-slime", x: 2060, y: 1640 },
      { kind: "boar", x: 1120, y: 1460 },
      { kind: "boar", x: 3180, y: 1510 },
      { kind: "boar", x: 1640, y: 780 },
      { kind: "boar", x: 2780, y: 730 },
    ]),
    obstacles: Object.freeze([
      { x: 0, y: 0, w: 640, h: 3600, type: "trees" },
      { x: 3680, y: 0, w: 640, h: 3600, type: "trees" },
      { x: 1660, y: 500, w: 1000, h: 690, type: "greatTree" },
      { x: 820, y: 1800, w: 700, h: 420, type: "pond" },
      { x: 2820, y: 1840, w: 650, h: 390, type: "pond" },
    ]),
  }),
  coast: Object.freeze({
    id: "coast",
    name: "푸른 해안가",
    width: 4320,
    height: 3600,
    spawn: Object.freeze({ x: 2160, y: 340 }),
    safe: false,
    portals: Object.freeze([returnPortal("to-village", 2112, 184)]),
    enemySpawns: Object.freeze([
      { kind: "crab", x: 880, y: 980 },
      { kind: "crab", x: 1480, y: 1260 },
      { kind: "crab", x: 2840, y: 1180 },
      { kind: "crab", x: 3460, y: 980 },
      { kind: "crab", x: 2180, y: 1780 },
      { kind: "water-slime", x: 1040, y: 2380 },
      { kind: "water-slime", x: 1780, y: 2760 },
      { kind: "water-slime", x: 2740, y: 2680 },
      { kind: "water-slime", x: 3380, y: 2320 },
    ]),
    obstacles: Object.freeze([
      { x: 0, y: 3000, w: 4320, h: 600, type: "deepWater" },
      { x: 0, y: 0, w: 520, h: 1600, type: "cliff" },
      { x: 3800, y: 0, w: 520, h: 1600, type: "cliff" },
      { x: 950, y: 2050, w: 580, h: 260, type: "wreck" },
      { x: 3180, y: 1740, w: 300, h: 420, type: "lighthouse" },
    ]),
  }),
});

export function normalizeWorldId(value) {
  return WORLD_IDS.includes(value) ? value : "village";
}

export function getWorldDefinition(mapId) {
  return WORLD_DEFINITIONS[normalizeWorldId(mapId)];
}

export function getTotalWorldArea() {
  return WORLD_IDS.reduce(
    (total, id) => total + WORLD_DEFINITIONS[id].width * WORLD_DEFINITIONS[id].height,
    0,
  );
}

export function getPortalDestination(mapId, portalId) {
  return getWorldDefinition(mapId).portals.find(portal => portal.id === portalId)?.destination || null;
}

export function isSafeWorld(mapId) {
  return getWorldDefinition(mapId).safe;
}
