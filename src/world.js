import { pointInRect } from "./collision.js";
import { getWorldDefinition, normalizeWorldId } from "./world-data.js";

export function createWorldLayer(mapId = "village") {
  const world = getWorldDefinition(mapId);
  const layer = document.createElement("canvas");
  layer.width = world.width;
  layer.height = world.height;
  const context = layer.getContext("2d", { alpha: false });
  context.imageSmoothingEnabled = false;

  const renderer = {
    village: drawVillage,
    volcano: drawVolcano,
    forest: drawForest,
    coast: drawCoast,
  }[world.id];
  renderer(context, world);
  drawPortals(context, world.portals);
  return layer;
}

export function getBiome(mapId = "village") {
  return getWorldDefinition(mapId).name;
}

export function getObstacles(mapId = "village") {
  return getWorldDefinition(mapId).obstacles;
}

export function findActivePortal(mapId, x, y, radius = 0) {
  const world = getWorldDefinition(mapId);
  return world.portals.find(portal => pointInRect(x, y, portal, radius)) || null;
}

export function isWorldPositionBlocked(mapIdOrX, xOrY, yOrRadius, radius = 0) {
  const usesRegionSignature = typeof mapIdOrX === "string";
  const mapId = usesRegionSignature ? normalizeWorldId(mapIdOrX) : "village";
  const x = usesRegionSignature ? xOrY : mapIdOrX;
  const y = usesRegionSignature ? yOrRadius : xOrY;
  const padding = usesRegionSignature ? radius : yOrRadius || 0;
  const world = getWorldDefinition(mapId);

  if (
    x - padding < 0
    || y - padding < 0
    || x + padding > world.width
    || y + padding > world.height
  ) return true;

  return world.obstacles.some(rect => pointInRect(x, y, rect, padding));
}

function drawVillage(context, world) {
  context.fillStyle = "#78b85f";
  context.fillRect(0, 0, world.width, world.height);
  drawGroundPattern(context, world, "#6daa57", 96, 8);

  context.fillStyle = "#cdb683";
  context.fillRect(1320, 0, 240, world.height);
  context.fillRect(0, 1000, world.width, 220);
  context.fillStyle = "#dbc89d";
  context.fillRect(1120, 820, 640, 580);
  context.fillStyle = "#bca273";
  context.fillRect(1240, 940, 400, 340);

  drawBuilding(context, 1120, 180, 640, 250, "#74513b", "#d6b576", "마을 회관");
  drawFarm(context, 240, 650, 690, 430);
  drawShopBlock(context, 2020, 610, 560, 350);
  drawTradePost(context, 1080, 1320, 720, 240);
  drawNpc(context, 760, 1160, "농부", "#5f8a3e");
  drawNpc(context, 2200, 1110, "상인", "#ca7b38");
  drawNpc(context, 2440, 1080, "대장장이", "#53677d");

  for (let index = 0; index < 44; index++) {
    const x = 80 + (index * 239) % 2700;
    const y = 80 + (index * 157) % 1600;
    if (x > 980 && x < 1900) continue;
    drawTree(context, x, y, "#347a46");
  }

  drawRegionTitle(context, world.name, world.width / 2, 88, "#f5e9c9");
}

function drawVolcano(context, world) {
  context.fillStyle = "#292329";
  context.fillRect(0, 0, world.width, world.height);
  drawGroundPattern(context, world, "#3a3034", 88, 13);

  context.fillStyle = "#66524a";
  context.beginPath();
  context.moveTo(850, world.height);
  context.lineTo(1450, 420);
  context.lineTo(2870, 420);
  context.lineTo(3470, world.height);
  context.fill();
  context.strokeStyle = "#9b7762";
  context.lineWidth = 110;
  context.beginPath();
  context.moveTo(2160, 3520);
  context.lineTo(2160, 1160);
  context.stroke();

  for (const obstacle of world.obstacles) {
    if (obstacle.type === "crater") drawCrater(context, obstacle);
    else drawLava(context, obstacle);
  }
  for (let index = 0; index < 24; index++) {
    const x = 900 + (index * 347) % 2500;
    const y = 420 + (index * 281) % 2800;
    pixelRect(context, x, y, 30 + index % 4 * 10, 18, "#171317");
  }
  drawRegionTitle(context, world.name, world.width / 2, 110, "#ffb199");
}

function drawForest(context, world) {
  context.fillStyle = "#285b38";
  context.fillRect(0, 0, world.width, world.height);
  drawGroundPattern(context, world, "#326d41", 80, 11);

  context.strokeStyle = "#8d744e";
  context.lineWidth = 150;
  context.lineCap = "round";
  context.beginPath();
  context.moveTo(2160, 3600);
  context.bezierCurveTo(2050, 2850, 2350, 2100, 2160, 1120);
  context.stroke();

  for (const obstacle of world.obstacles) {
    if (obstacle.type === "pond") drawPond(context, obstacle);
    else if (obstacle.type === "greatTree") drawGreatTree(context, obstacle);
    else drawDenseTrees(context, obstacle);
  }
  for (let index = 0; index < 78; index++) {
    const x = 700 + (index * 307) % 2920;
    const y = 120 + (index * 433) % 3300;
    if (x > 1850 && x < 2470) continue;
    drawTree(context, x, y, index % 3 === 0 ? "#194a2d" : "#226238");
  }
  drawRegionTitle(context, world.name, world.width / 2, 110, "#c9f7cf");
}

function drawCoast(context, world) {
  context.fillStyle = "#d9c27c";
  context.fillRect(0, 0, world.width, world.height);
  drawGroundPattern(context, world, "#cdb46b", 92, 7);

  context.fillStyle = "#64b9cc";
  context.fillRect(0, 2820, world.width, 180);
  context.fillStyle = "#2e91b7";
  context.fillRect(0, 3000, world.width, 600);
  for (let y = 3040; y < world.height; y += 90) {
    context.fillStyle = y % 180 === 0 ? "#66c7d4" : "#49abc5";
    for (let x = 20; x < world.width; x += 180) context.fillRect(x, y, 90, 8);
  }

  drawPier(context, 1880, 2450, 560, 570);
  for (const obstacle of world.obstacles) {
    if (obstacle.type === "cliff") drawCliff(context, obstacle);
    else if (obstacle.type === "wreck") drawWreck(context, obstacle);
    else if (obstacle.type === "lighthouse") drawLighthouse(context, obstacle);
  }
  for (let index = 0; index < 34; index++) {
    const x = 620 + (index * 397) % 3100;
    const y = 620 + (index * 233) % 2100;
    pixelRect(context, x, y, 20, 9, index % 2 ? "#a58d55" : "#f0dfaa");
  }
  drawRegionTitle(context, world.name, world.width / 2, 110, "#e4f8ff");
}

function drawGroundPattern(context, world, color, spacing, size) {
  context.fillStyle = color;
  for (let y = spacing / 2; y < world.height; y += spacing) {
    for (let x = spacing / 2; x < world.width; x += spacing) {
      if ((x / spacing + y / spacing) % 3 === 0) context.fillRect(x, y, size, size);
    }
  }
}

function drawBuilding(context, x, y, w, h, wall, roof, label) {
  pixelRect(context, x, y + 55, w, h - 55, wall);
  context.fillStyle = roof;
  context.beginPath();
  context.moveTo(x - 35, y + 75);
  context.lineTo(x + w / 2, y - 30);
  context.lineTo(x + w + 35, y + 75);
  context.fill();
  pixelRect(context, x + w / 2 - 46, y + h - 100, 92, 100, "#30251f");
  drawLabel(context, label, x + w / 2, y + 35);
}

function drawFarm(context, x, y, w, h) {
  pixelRect(context, x, y, w, h, "#8d6439");
  for (let row = 0; row < 7; row++) {
    pixelRect(context, x + 30, y + 35 + row * 50, w - 60, 14, "#c99451");
    for (let crop = 0; crop < 12; crop++) {
      pixelRect(context, x + 48 + crop * 50, y + 22 + row * 50, 10, 24, "#5f9d42");
    }
  }
  pixelRect(context, x + w - 190, y + 40, 150, 130, "#6c4630");
  drawLabel(context, "농장", x + 90, y + 30);
}

function drawShopBlock(context, x, y, w, h) {
  pixelRect(context, x, y + 60, w, h - 60, "#b78155");
  pixelRect(context, x - 24, y, w / 2 + 24, 90, "#bb4950");
  pixelRect(context, x + w / 2, y, w / 2 + 24, 90, "#456f89");
  pixelRect(context, x + 110, y + 190, 90, 160, "#422e27");
  pixelRect(context, x + 360, y + 190, 90, 160, "#422e27");
  drawLabel(context, "상점 · 대장간", x + w / 2, y + 42);
}

function drawTradePost(context, x, y, w, h) {
  pixelRect(context, x, y + 45, w, h - 45, "#81634b");
  for (let offset = 0; offset < w; offset += 90) {
    pixelRect(context, x + offset, y, 54, 70, offset % 180 ? "#efe1b5" : "#b34c4c");
  }
  drawLabel(context, "무역소", x + w / 2, y + 125);
}

function drawLava(context, obstacle) {
  pixelRect(context, obstacle.x, obstacle.y, obstacle.w, obstacle.h, "#b82e1f");
  for (let y = obstacle.y + 30; y < obstacle.y + obstacle.h; y += 100) {
    for (let x = obstacle.x + 20; x < obstacle.x + obstacle.w; x += 140) {
      pixelRect(context, x, y, 84, 12, "#ff9f2f");
      pixelRect(context, x + 18, y + 3, 45, 5, "#ffe074");
    }
  }
}

function drawCrater(context, obstacle) {
  context.fillStyle = "#141014";
  context.beginPath();
  context.ellipse(
    obstacle.x + obstacle.w / 2,
    obstacle.y + obstacle.h / 2,
    obstacle.w / 2,
    obstacle.h / 2,
    0,
    0,
    Math.PI * 2,
  );
  context.fill();
  context.strokeStyle = "#ef5b2a";
  context.lineWidth = 42;
  context.stroke();
}

function drawDenseTrees(context, obstacle) {
  pixelRect(context, obstacle.x, obstacle.y, obstacle.w, obstacle.h, "#183f2a");
  for (let y = obstacle.y + 30; y < obstacle.y + obstacle.h; y += 58) {
    for (let x = obstacle.x + 28; x < obstacle.x + obstacle.w; x += 58) drawTree(context, x, y, "#164d2c");
  }
}

function drawGreatTree(context, obstacle) {
  pixelRect(context, obstacle.x, obstacle.y, obstacle.w, obstacle.h, "#1d4b2d");
  pixelRect(context, obstacle.x + obstacle.w / 2 - 120, obstacle.y + 180, 240, obstacle.h - 180, "#68462f");
  context.fillStyle = "#174d2a";
  context.beginPath();
  context.arc(obstacle.x + obstacle.w / 2, obstacle.y + 250, 430, 0, Math.PI * 2);
  context.fill();
  context.fillStyle = "#3d8c4d";
  context.beginPath();
  context.arc(obstacle.x + obstacle.w / 2 - 120, obstacle.y + 150, 220, 0, Math.PI * 2);
  context.arc(obstacle.x + obstacle.w / 2 + 170, obstacle.y + 170, 250, 0, Math.PI * 2);
  context.fill();
}

function drawPond(context, obstacle) {
  pixelRect(context, obstacle.x, obstacle.y, obstacle.w, obstacle.h, "#2e8799");
  pixelRect(context, obstacle.x + 30, obstacle.y + 28, obstacle.w - 60, obstacle.h - 56, "#4cacc0");
  for (let x = obstacle.x + 60; x < obstacle.x + obstacle.w - 30; x += 120) {
    pixelRect(context, x, obstacle.y + obstacle.h / 2, 56, 7, "#9dd9d5");
  }
}

function drawCliff(context, obstacle) {
  pixelRect(context, obstacle.x, obstacle.y, obstacle.w, obstacle.h, "#7b6d5d");
  for (let y = obstacle.y + 20; y < obstacle.y + obstacle.h; y += 80) {
    pixelRect(context, obstacle.x + 20, y, obstacle.w - 40, 18, "#9a8a75");
  }
}

function drawPier(context, x, y, w, h) {
  pixelRect(context, x, y, w, h, "#6f4b32");
  for (let offset = 0; offset < h; offset += 70) pixelRect(context, x, y + offset, w, 10, "#9a6c45");
}

function drawWreck(context, obstacle) {
  pixelRect(context, obstacle.x, obstacle.y + 80, obstacle.w, obstacle.h - 80, "#67412e");
  pixelRect(context, obstacle.x + 240, obstacle.y, 28, obstacle.h, "#4c3327");
  context.fillStyle = "#d8c894";
  context.beginPath();
  context.moveTo(obstacle.x + 268, obstacle.y + 20);
  context.lineTo(obstacle.x + 500, obstacle.y + 120);
  context.lineTo(obstacle.x + 268, obstacle.y + 150);
  context.fill();
}

function drawLighthouse(context, obstacle) {
  pixelRect(context, obstacle.x + 80, obstacle.y + 70, obstacle.w - 160, obstacle.h - 70, "#e7e1cf");
  pixelRect(context, obstacle.x + 70, obstacle.y + 170, obstacle.w - 140, 42, "#c84d4d");
  pixelRect(context, obstacle.x + 55, obstacle.y, obstacle.w - 110, 90, "#bd4747");
  pixelRect(context, obstacle.x + 125, obstacle.y + 270, 50, 150, "#39404a");
}

function drawTree(context, x, y, leafColor) {
  pixelRect(context, x - 7, y + 12, 14, 30, "#62432e");
  pixelRect(context, x - 24, y - 6, 48, 29, leafColor);
  pixelRect(context, x - 17, y - 23, 34, 22, leafColor);
}

function drawNpc(context, x, y, name, coatColor) {
  pixelRect(context, x - 10, y + 7, 8, 14, "#51372a");
  pixelRect(context, x + 2, y + 7, 8, 14, "#51372a");
  pixelRect(context, x - 13, y - 12, 26, 21, coatColor);
  pixelRect(context, x - 8, y - 25, 16, 14, "#e8b78c");
  pixelRect(context, x - 9, y - 29, 18, 6, "#4a3328");
  drawLabel(context, name, x, y - 38);
}

function drawPortals(context, portals) {
  context.textAlign = "center";
  context.font = "900 22px sans-serif";
  for (const portal of portals) {
    context.fillStyle = "rgba(6, 10, 25, .72)";
    context.fillRect(portal.x - 12, portal.y - 12, portal.w + 24, portal.h + 24);
    context.fillStyle = portal.color;
    context.fillRect(portal.x, portal.y, portal.w, portal.h);
    context.fillStyle = "rgba(255,255,255,.72)";
    context.fillRect(portal.x + 18, portal.y + 18, portal.w - 36, portal.h - 36);
    context.fillStyle = "#ffffff";
    context.fillText(portal.label, portal.x + portal.w / 2, portal.y - 25);
  }
}

function drawRegionTitle(context, text, x, y, color) {
  context.textAlign = "center";
  context.font = "900 38px sans-serif";
  context.fillStyle = "rgba(3, 7, 18, .65)";
  context.fillText(text, x + 3, y + 4);
  context.fillStyle = color;
  context.fillText(text, x, y);
}

function drawLabel(context, text, x, y) {
  context.textAlign = "center";
  context.font = "900 21px sans-serif";
  context.fillStyle = "rgba(6, 10, 20, .82)";
  context.fillText(text, x + 2, y + 3);
  context.fillStyle = "#fff7db";
  context.fillText(text, x, y);
}

function pixelRect(context, x, y, width, height, color) {
  context.fillStyle = color;
  context.fillRect(Math.round(x), Math.round(y), Math.round(width), Math.round(height));
}
