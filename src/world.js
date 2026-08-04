import { GAME_CONFIG as C } from "./config.js";
import { distanceToSegment, pointInRect } from "./collision.js";

const obstacles = [
  { x: 210, y: 230, w: 510, h: 270, type: "desertCity" },
  { x: 2260, y: 150, w: 420, h: 330, type: "iceCastle" },
  { x: 1120, y: 170, w: 640, h: 280, type: "greatTree" },
  { x: 1360, y: 700, w: 190, h: 170, type: "ruin" },
];

const bridges = [
  { x: 790, y: 570, w: 190, h: 170 },
  { x: 790, y: 1110, w: 190, h: 190 },
];

const riverSegments = createRiverSegments(40);

export function createWorldLayer() {
  const layer = document.createElement("canvas");
  layer.width = C.WORLD_WIDTH;
  layer.height = C.WORLD_HEIGHT;
  const g = layer.getContext("2d", { alpha: false });
  g.imageSmoothingEnabled = false;

  drawBiomes(g);
  drawRoads(g);
  drawWater(g);
  drawLandmarks(g);
  drawDecor(g);
  return layer;
}

function drawBiomes(g) {
  g.fillStyle = "#77b65c";
  g.fillRect(0, 0, C.WORLD_WIDTH, C.WORLD_HEIGHT);

  g.fillStyle = "#c8914d";
  g.fillRect(0, 0, 900, C.WORLD_HEIGHT);
  g.fillStyle = "#d8ab63";
  for (let y = 0; y < C.WORLD_HEIGHT; y += 64) {
    for (let x = 0; x < 900; x += 64) {
      if (((x + y) / 64) % 3 === 0) g.fillRect(x + 8, y + 14, 24, 5);
    }
  }

  g.fillStyle = "#386f46";
  g.fillRect(900, 0, 1040, 620);
  g.fillStyle = "#4b8751";
  for (let y = 0; y < 620; y += 48) {
    for (let x = 900; x < 1940; x += 48) {
      if (((x * 7 + y * 11) / 48) % 5 < 3) g.fillRect(x, y, 48, 48);
    }
  }

  g.fillStyle = "#cde9f3";
  g.fillRect(1940, 0, C.WORLD_WIDTH - 1940, C.WORLD_HEIGHT);
  g.fillStyle = "#a9d7e9";
  for (let y = 0; y < C.WORLD_HEIGHT; y += 72) {
    for (let x = 1940; x < C.WORLD_WIDTH; x += 72) {
      if (((x + y) / 72) % 4 === 0) g.fillRect(x + 10, y + 10, 30, 4);
    }
  }

  g.fillStyle = "#75b85d";
  g.beginPath();
  g.ellipse(1440, 1120, 750, 650, 0, 0, Math.PI * 2);
  g.fill();
}

function drawRoads(g) {
  g.strokeStyle = "#c7ad78";
  g.lineWidth = 74;
  g.lineCap = "round";
  g.lineJoin = "round";
  const roads = [
    [[380, 420], [820, 680], [1440, 930], [2280, 440]],
    [[1440, 930], [1450, 1540]],
    [[870, 1240], [1440, 930], [2060, 1250]],
  ];
  roads.forEach(points => {
    g.beginPath();
    g.moveTo(points[0][0], points[0][1]);
    points.slice(1).forEach(([x, y]) => g.lineTo(x, y));
    g.stroke();
  });
  g.strokeStyle = "rgba(93,69,41,.45)";
  g.lineWidth = 5;
  roads.forEach(points => {
    g.beginPath();
    g.moveTo(points[0][0], points[0][1]);
    points.slice(1).forEach(([x, y]) => g.lineTo(x, y));
    g.setLineDash([12, 20]);
    g.stroke();
    g.setLineDash([]);
  });
}

function drawWater(g) {
  g.strokeStyle = "#3d9bbb";
  g.lineWidth = 90;
  g.beginPath();
  g.moveTo(930, -40);
  g.bezierCurveTo(760, 560, 1080, 1040, 850, 1840);
  g.stroke();
  g.strokeStyle = "#9ae0e8";
  g.lineWidth = 8;
  g.setLineDash([40, 45]);
  g.stroke();
  g.setLineDash([]);
}

function pixelRect(g, x, y, w, h, color) {
  g.fillStyle = color;
  g.fillRect(Math.round(x), Math.round(y), w, h);
}

function drawLandmarks(g) {
  pixelRect(g, 210, 230, 510, 270, "#9c6638");
  pixelRect(g, 230, 250, 470, 230, "#d1a15f");
  for (let x = 250; x < 690; x += 70) {
    pixelRect(g, x, 270, 42, 150, "#ba844a");
    pixelRect(g, x - 6, 255, 54, 18, "#e3bd75");
  }
  pixelRect(g, 410, 170, 95, 250, "#d4a75f");
  pixelRect(g, 438, 120, 40, 70, "#e8c780");
  pixelRect(g, 270, 405, 370, 38, "#68bfd0");

  g.fillStyle = "#74492d";
  g.fillRect(1390, 230, 80, 250);
  g.fillStyle = "#2f6f3e";
  for (let i = 0; i < 9; i++) {
    g.beginPath();
    g.arc(1430 + Math.cos(i) * 140, 230 + Math.sin(i) * 90, 110, 0, Math.PI * 2);
    g.fill();
  }
  g.fillStyle = "#77d9c5";
  g.fillRect(1415, 290, 30, 85);

  pixelRect(g, 2260, 150, 420, 330, "#6c9fbd");
  pixelRect(g, 2290, 180, 360, 270, "#bddfec");
  for (let x = 2300; x < 2650; x += 85) {
    pixelRect(g, x, 110, 55, 300, "#8bc3dd");
    pixelRect(g, x - 8, 90, 71, 35, "#d9f4ff");
  }
  pixelRect(g, 2420, 260, 100, 190, "#426f91");
  pixelRect(g, 2453, 290, 34, 160, "#1d405a");
  pixelRect(g, 2370, 105, 35, 95, "#66d6f1");
  pixelRect(g, 2535, 90, 35, 110, "#66d6f1");

  pixelRect(g, 1390, 845, 100, 100, "#6d5d87");
  pixelRect(g, 1423, 730, 34, 150, "#7dd3fc");
  pixelRect(g, 1433, 695, 14, 45, "#e0f7ff");
}

function drawDecor(g) {
  for (let i = 0; i < 160; i++) {
    const x = (i * 197) % C.WORLD_WIDTH;
    const y = (i * 389) % C.WORLD_HEIGHT;
    if (x < 850) drawCactus(g, x, y);
    else if (x < 1920 && y < 650) drawTree(g, x, y, "forest");
    else if (x > 1980) drawTree(g, x, y, "ice");
    else drawTree(g, x, y, "grass");
  }
}

function drawTree(g, x, y, type) {
  const trunk = type === "ice" ? "#6d7885" : "#6a432b";
  const leaf = type === "ice" ? "#7cb6ca" : type === "forest" ? "#245c37" : "#3f8650";
  pixelRect(g, x - 5, y + 10, 10, 22, trunk);
  pixelRect(g, x - 18, y - 6, 36, 22, leaf);
  pixelRect(g, x - 12, y - 17, 24, 17, leaf);
}

function drawCactus(g, x, y) {
  pixelRect(g, x - 4, y - 12, 8, 28, "#4e8b4f");
  pixelRect(g, x - 11, y - 4, 9, 7, "#4e8b4f");
  pixelRect(g, x + 3, y + 1, 9, 7, "#4e8b4f");
}

export function getBiome(x, y) {
  if (x < 900) return "사막 문명";
  if (x > 1940) return "빙결 왕국";
  if (y < 620) return "태고의 숲";
  return "중앙 초원";
}

export function getObstacles() {
  return obstacles;
}

export function isWorldPositionBlocked(x, y, radius = 0) {
  if (
    x - radius < 0
    || y - radius < 0
    || x + radius > C.WORLD_WIDTH
    || y + radius > C.WORLD_HEIGHT
  ) return true;

  if (obstacles.some(rect => pointInRect(x, y, rect, radius))) return true;
  if (bridges.some(rect => pointInRect(x, y, rect))) return false;

  return riverSegments.some(([ax, ay, bx, by]) => (
    distanceToSegment(x, y, ax, ay, bx, by) <= 45 + radius
  ));
}

function createRiverSegments(steps) {
  const segments = [];
  let previous = cubicPoint(0);
  for (let index = 1; index <= steps; index++) {
    const current = cubicPoint(index / steps);
    segments.push([previous.x, previous.y, current.x, current.y]);
    previous = current;
  }
  return segments;
}

function cubicPoint(t) {
  const inverse = 1 - t;
  return {
    x: inverse ** 3 * 930
      + 3 * inverse ** 2 * t * 760
      + 3 * inverse * t ** 2 * 1080
      + t ** 3 * 850,
    y: inverse ** 3 * -40
      + 3 * inverse ** 2 * t * 560
      + 3 * inverse * t ** 2 * 1040
      + t ** 3 * 1840,
  };
}
