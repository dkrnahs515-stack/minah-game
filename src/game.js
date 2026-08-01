import { GAME_CONFIG as C } from "./config.js";
import { createWorldLayer, getBiome } from "./world.js";
import { createNetworkAdapter } from "./network.js";

export class PixelRPG {
  constructor(elements) {
    this.canvas = elements.canvas;
    this.ctx = this.canvas.getContext("2d", { alpha: false, desynchronized: true });
    this.minimap = elements.minimap;
    this.minimapCtx = this.minimap.getContext("2d");
    this.ui = elements;
    this.keys = new Set();
    this.worldLayer = createWorldLayer();
    this.player = {
      x: 1440, y: 1110, prevX: 1440, prevY: 1110,
      w: 24, h: 31, dir: "down", moving: false, step: 0,
      hp: 100, mp: 100, color: "#4f8e5b", name: "무명의 모험가",
    };
    this.camera = { x: 0, y: 0, prevX: 0, prevY: 0 };
    this.remotePlayers = new Map();
    this.network = null;
    this.running = false;
    this.lastFrame = 0;
    this.accumulator = 0;
    this.fixedDt = 1 / C.SIMULATION_HZ;
    this.fpsSamples = [];
    this.lastFpsUpdate = 0;
    this.messageTimer = 0;
    this.renderScale = Math.min(devicePixelRatio || 1, C.MAX_DPR);
    this.lowFpsSeconds = 0;
    this.highFpsSeconds = 0;
  }

  async start() {
    this.bindEvents();
    this.resize();
    this.drawMinimapBase();
    this.network = await createNetworkAdapter(
      players => this.receiveRemotePlayers(players),
      (status, label) => this.updateNetworkStatus(status, label),
    );
    this.running = true;
    requestAnimationFrame(t => this.loop(t));
  }

  bindEvents() {
    addEventListener("resize", () => this.resize(), { passive: true });
    addEventListener("blur", () => this.keys.clear());
    addEventListener("keydown", event => {
      this.keys.add(event.code);
      if (["KeyQ","KeyE","KeyR","Digit1","Digit2","Digit3"].includes(event.code) && !event.repeat) {
        this.activateEmptySlot(event.code);
      }
      if (["ArrowUp","ArrowDown","ArrowLeft","ArrowRight","Space"].includes(event.code)) event.preventDefault();
    });
    addEventListener("keyup", event => this.keys.delete(event.code));
    document.querySelectorAll(".slot").forEach(button => {
      button.addEventListener("click", () => this.activateEmptySlot(button.dataset.code));
    });
  }

  resize() {
    const dpr = this.renderScale;
    const width = Math.max(1, innerWidth);
    const height = Math.max(1, innerHeight);
    this.canvas.width = Math.round(width * dpr);
    this.canvas.height = Math.round(height * dpr);
    this.canvas.style.width = `${width}px`;
    this.canvas.style.height = `${height}px`;
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.ctx.imageSmoothingEnabled = false;
  }

  loop(timestamp) {
    if (!this.running) return;
    if (!this.lastFrame) this.lastFrame = timestamp;
    const frameSeconds = Math.min((timestamp - this.lastFrame) / 1000, 0.1);
    this.lastFrame = timestamp;
    this.accumulator += frameSeconds;

    let steps = 0;
    while (this.accumulator >= this.fixedDt && steps < 10) {
      this.fixedUpdate(this.fixedDt);
      this.accumulator -= this.fixedDt;
      steps++;
    }
    if (steps === 10) this.accumulator = 0;

    const alpha = this.accumulator / this.fixedDt;
    this.render(alpha);
    this.measurePerformance(timestamp, frameSeconds);
    requestAnimationFrame(t => this.loop(t));
  }

  fixedUpdate(dt) {
    this.player.prevX = this.player.x;
    this.player.prevY = this.player.y;
    this.camera.prevX = this.camera.x;
    this.camera.prevY = this.camera.y;

    let dx = 0, dy = 0;
    if (this.keys.has("KeyW")) dy -= 1;
    if (this.keys.has("KeyS")) dy += 1;
    if (this.keys.has("KeyA")) dx -= 1;
    if (this.keys.has("KeyD")) dx += 1;

    this.player.moving = Boolean(dx || dy);
    if (this.player.moving) {
      const length = Math.hypot(dx, dy);
      dx /= length;
      dy /= length;
      this.player.x = clamp(this.player.x + dx * C.PLAYER_SPEED * dt, 20, C.WORLD_WIDTH - 20);
      this.player.y = clamp(this.player.y + dy * C.PLAYER_SPEED * dt, 20, C.WORLD_HEIGHT - 20);
      this.player.step += dt * 11;
      if (Math.abs(dx) > Math.abs(dy)) this.player.dir = dx > 0 ? "right" : "left";
      else this.player.dir = dy > 0 ? "down" : "up";
    }

    const targetX = clamp(this.player.x - innerWidth / 2, 0, Math.max(0, C.WORLD_WIDTH - innerWidth));
    const targetY = clamp(this.player.y - innerHeight / 2, 0, Math.max(0, C.WORLD_HEIGHT - innerHeight));
    const cameraFactor = 1 - Math.exp(-C.CAMERA_LERP * dt);
    this.camera.x += (targetX - this.camera.x) * cameraFactor;
    this.camera.y += (targetY - this.camera.y) * cameraFactor;

    this.network?.publish(this.player);
    this.updateRemoteInterpolation(dt);

    if (this.messageTimer > 0) {
      this.messageTimer -= dt;
      if (this.messageTimer <= 0) this.ui.message.classList.remove("show");
    }

    const biome = getBiome(this.player.x, this.player.y);
    const subtitle = this.ui.playerSubtitle;
    if (subtitle.dataset.biome !== biome) {
      subtitle.dataset.biome = biome;
      subtitle.textContent = `LV. 1 · ${biome}`;
    }
  }

  render(alpha) {
    const ctx = this.ctx;
    const cameraX = lerp(this.camera.prevX, this.camera.x, alpha);
    const cameraY = lerp(this.camera.prevY, this.camera.y, alpha);
    const viewW = innerWidth;
    const viewH = innerHeight;

    ctx.clearRect(0, 0, viewW, viewH);
    ctx.drawImage(
      this.worldLayer,
      Math.floor(cameraX), Math.floor(cameraY), viewW, viewH,
      0, 0, viewW, viewH,
    );

    const entities = [];
    this.remotePlayers.forEach(remote => entities.push({ ...remote, remote: true }));
    entities.push({
      ...this.player,
      x: lerp(this.player.prevX, this.player.x, alpha),
      y: lerp(this.player.prevY, this.player.y, alpha),
      remote: false,
    });
    entities.sort((a, b) => a.y - b.y);

    for (const entity of entities) {
      if (entity.x < cameraX - 60 || entity.x > cameraX + viewW + 60 || entity.y < cameraY - 80 || entity.y > cameraY + viewH + 80) continue;
      drawPixelCharacter(ctx, entity, cameraX, cameraY);
    }

    this.renderMinimap();
  }

  receiveRemotePlayers(players) {
    const now = performance.now();
    const next = new Map();
    players.forEach((data, uid) => {
      const current = this.remotePlayers.get(uid);
      next.set(uid, {
        uid,
        x: current?.x ?? data.x,
        y: current?.y ?? data.y,
        fromX: current?.x ?? data.x,
        fromY: current?.y ?? data.y,
        targetX: data.x,
        targetY: data.y,
        snapshotAt: now,
        dir: data.dir || "down",
        moving: Boolean(data.moving),
        color: data.color || "#7585d8",
        name: sanitizeName(data.name),
        step: current?.step || 0,
      });
    });
    this.remotePlayers = next;
    this.ui.playerCount.textContent = String(this.remotePlayers.size + 1);
  }

  updateRemoteInterpolation(dt) {
    const now = performance.now();
    this.remotePlayers.forEach(remote => {
      const t = clamp((now - remote.snapshotAt) / C.REMOTE_INTERPOLATION_MS, 0, 1);
      remote.x = lerp(remote.fromX, remote.targetX, easeOutCubic(t));
      remote.y = lerp(remote.fromY, remote.targetY, easeOutCubic(t));
      if (remote.moving) remote.step += dt * 10;
    });
  }

  activateEmptySlot(code) {
    const slot = document.querySelector(`[data-code="${code}"]`);
    if (!slot) return;
    slot.classList.remove("flash");
    void slot.offsetWidth;
    slot.classList.add("flash");
    const isSkill = code.startsWith("Key");
    const key = code.replace("Key", "").replace("Digit", "");
    this.notify(`${key} ${isSkill ? "스킬" : "아이템"} 슬롯은 아직 비어 있습니다.`);
  }

  notify(text) {
    this.ui.message.textContent = text;
    this.ui.message.classList.add("show");
    this.messageTimer = 1.4;
  }

  updateNetworkStatus(status, label) {
    const badge = this.ui.networkBadge;
    badge.className = `status ${status}`;
    badge.textContent = label;
  }

  measurePerformance(timestamp, frameSeconds) {
    if (frameSeconds > 0) this.fpsSamples.push(1 / frameSeconds);
    if (this.fpsSamples.length > 120) this.fpsSamples.shift();
    if (timestamp - this.lastFpsUpdate < 500) return;
    this.lastFpsUpdate = timestamp;
    const fps = this.fpsSamples.length ? this.fpsSamples.reduce((a, b) => a + b, 0) / this.fpsSamples.length : 0;
    this.ui.fpsText.textContent = String(Math.round(fps));

    if (fps < 82) { this.lowFpsSeconds += 0.5; this.highFpsSeconds = 0; }
    else if (fps > 125) { this.highFpsSeconds += 0.5; this.lowFpsSeconds = 0; }
    else { this.lowFpsSeconds = Math.max(0, this.lowFpsSeconds - 0.25); this.highFpsSeconds = 0; }

    if (this.lowFpsSeconds >= 3 && this.renderScale > C.MIN_RENDER_SCALE) {
      this.renderScale = Math.max(C.MIN_RENDER_SCALE, this.renderScale - 0.25);
      this.lowFpsSeconds = 0;
      this.ui.qualityText.textContent = "성능 우선";
      this.resize();
    } else if (this.highFpsSeconds >= 5 && this.renderScale < Math.min(devicePixelRatio || 1, C.MAX_DPR)) {
      this.renderScale = Math.min(Math.min(devicePixelRatio || 1, C.MAX_DPR), this.renderScale + 0.25);
      this.highFpsSeconds = 0;
      this.ui.qualityText.textContent = "고화질";
      this.resize();
    }
  }

  drawMinimapBase() {
    const g = this.minimapCtx;
    g.imageSmoothingEnabled = false;
    g.clearRect(0, 0, this.minimap.width, this.minimap.height);
    g.drawImage(this.worldLayer, 0, 0, C.WORLD_WIDTH, C.WORLD_HEIGHT, 0, 0, this.minimap.width, this.minimap.height);
  }

  renderMinimap() {
    const g = this.minimapCtx;
    const w = this.minimap.width, h = this.minimap.height;
    g.clearRect(0, 0, w, h);
    g.drawImage(this.worldLayer, 0, 0, C.WORLD_WIDTH, C.WORLD_HEIGHT, 0, 0, w, h);
    const drawDot = (x, y, color, size) => {
      g.fillStyle = color;
      g.fillRect(Math.round(x / C.WORLD_WIDTH * w - size / 2), Math.round(y / C.WORLD_HEIGHT * h - size / 2), size, size);
    };
    this.remotePlayers.forEach(p => drawDot(p.x, p.y, "#f8fafc", 3));
    drawDot(this.player.x, this.player.y, "#ff4d6d", 5);
  }
}

function drawPixelCharacter(ctx, p, cameraX, cameraY) {
  const x = Math.round(p.x - cameraX);
  const y = Math.round(p.y - cameraY);
  const bob = p.moving ? Math.sin(p.step) * 1.6 : 0;
  ctx.save();
  ctx.translate(x, y + bob);

  ctx.fillStyle = "rgba(0,0,0,.28)";
  ctx.fillRect(-13, 14, 26, 7);
  ctx.fillStyle = "#5b3b2a";
  ctx.fillRect(-9, 6, 7, 12);
  ctx.fillRect(2, 6, 7, 12);
  ctx.fillStyle = "#b88a4e";
  ctx.fillRect(-10, -9, 20, 18);
  ctx.fillStyle = p.color || "#4f8e5b";
  ctx.fillRect(-14, -11, 6, 20);
  ctx.fillRect(8, -11, 6, 20);
  ctx.fillRect(-12, -14, 24, 5);
  ctx.fillStyle = "#f0c39a";
  ctx.fillRect(-9, -24, 18, 14);
  ctx.fillStyle = "#493329";
  ctx.fillRect(-10, -27, 20, 7);
  ctx.fillRect(-10, -22, 5, 9);
  ctx.fillStyle = "#202938";
  if (p.dir === "left") ctx.fillRect(-7, -18, 2, 2);
  else if (p.dir === "right") ctx.fillRect(5, -18, 2, 2);
  else { ctx.fillRect(-5, -18, 2, 2); ctx.fillRect(3, -18, 2, 2); }
  ctx.fillStyle = "#dceeff";
  ctx.fillRect(11, -4, 4, 19);
  ctx.fillStyle = "#6b4b2f";
  ctx.fillRect(9, 11, 8, 4);

  if (p.remote) {
    const name = sanitizeName(p.name);
    ctx.font = "11px sans-serif";
    const width = Math.ceil(ctx.measureText(name).width) + 10;
    ctx.fillStyle = "rgba(10,16,27,.78)";
    ctx.fillRect(-width / 2, -44, width, 15);
    ctx.fillStyle = "#fff";
    ctx.textAlign = "center";
    ctx.fillText(name, 0, -33);
  }
  ctx.restore();
}

function clamp(value, min, max) { return Math.max(min, Math.min(max, value)); }
function lerp(a, b, t) { return a + (b - a) * t; }
function easeOutCubic(t) { return 1 - Math.pow(1 - t, 3); }
function sanitizeName(value) { return typeof value === "string" ? value.slice(0, 16) : "모험가"; }