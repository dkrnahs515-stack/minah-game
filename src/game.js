import { GAME_CONFIG as C } from "./config.js";
import { attackDefinition, directionVector, isTargetInAttackArc } from "./combat.js";
import { createEnemies, damageEnemy, drawEnemy, updateEnemies } from "./enemies.js";
import { movementVector } from "./input.js";
import { createNetworkAdapter } from "./network.js";
import { applyPlayerDamage, respawnPlayer, tickPlayerStatus } from "./player-combat.js";
import { advancePortalTransition, createPortalTransition } from "./portal-transition.js";
import { getWorldDefinition, normalizeWorldId } from "./world-data.js";
import {
  createWorldLayer,
  findActivePortal,
  getBiome,
  isWorldPositionBlocked,
} from "./world.js";

const PLAYER_RADIUS = 14;
const MAX_MEASURED_FPS = 240;

export function fpsSampleFromFrameSeconds(frameSeconds) {
  if (frameSeconds <= 0) return null;
  const fps = 1 / frameSeconds;
  return fps <= MAX_MEASURED_FPS ? fps : null;
}

export class PixelRPG {
  constructor(elements) {
    this.canvas = elements.canvas;
    this.ctx = this.canvas.getContext("2d", { alpha: false, desynchronized: true });
    this.minimap = elements.minimap;
    this.minimapCtx = this.minimap.getContext("2d");
    this.ui = elements;
    this.keys = new Set();
    this.mapId = "village";
    this.worldLayer = createWorldLayer(this.mapId);
    const spawn = getWorldDefinition(this.mapId).spawn;
    this.player = {
      x: spawn.x, y: spawn.y, prevX: spawn.x, prevY: spawn.y,
      w: 24, h: 31, dir: "down", moving: false, step: 0,
      hp: 100, maxHp: 100, mp: 100, maxMp: 100,
      invulnerable: 0, hitFlash: 0, respawnTimer: 0,
      color: "#4f8e5b", name: "모험가",
    };
    this.camera = { x: 0, y: 0, prevX: 0, prevY: 0 };
    this.remotePlayers = new Map();
    this.enemies = [];
    this.portalTransition = null;
    this.portalCooldown = 0;
    this.attackState = null;
    this.basicCooldown = 0;
    this.strongCooldown = 0;
    this.damageNumbers = [];
    this.network = null;
    this.running = false;
    this.inputEnabled = false;
    this.eventsBound = false;
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

  async enter(nickname) {
    if (this.running) return;
    if (!this.eventsBound) {
      this.bindEvents();
      this.eventsBound = true;
    }

    this.player.name = sanitizeName(nickname);
    this.ui.playerName.textContent = this.player.name;
    this.ui.playerCount.textContent = "1";
    this.remotePlayers.clear();
    this.switchWorld("village", getWorldDefinition("village").spawn.x, getWorldDefinition("village").spawn.y, false);
    this.resetCombatState();
    this.inputEnabled = true;
    this.resize();
    this.drawMinimapBase();

    if (this.network) await this.network.stop();
    this.network = await createNetworkAdapter(
      players => this.receiveRemotePlayers(players),
      (status, label) => this.updateNetworkStatus(status, label),
    );

    this.running = true;
    this.lastFrame = 0;
    this.accumulator = 0;
    this.notify(`${this.player.name}님, 방향키로 이동하고 Ctrl로 공격하세요.`);
    requestAnimationFrame(timestamp => this.loop(timestamp));
  }

  async leave({ silent = false } = {}) {
    if (!this.running && !this.network) return;
    this.running = false;
    this.inputEnabled = false;
    this.keys.clear();
    this.player.moving = false;
    this.lastFrame = 0;
    this.accumulator = 0;

    const network = this.network;
    this.network = null;
    if (network) await network.stop();

    this.remotePlayers.clear();
    this.portalTransition = null;
    this.portalCooldown = 0;
    this.switchWorld("village", getWorldDefinition("village").spawn.x, getWorldDefinition("village").spawn.y, false);
    this.resetCombatState();
    this.ui.playerCount.textContent = "0";
    this.updateNetworkStatus("offline", "나감");
    if (!silent) this.ui.message.classList.remove("show");
  }

  isRunning() {
    return this.running;
  }

  setInputEnabled(enabled) {
    this.inputEnabled = Boolean(enabled) && this.player.respawnTimer <= 0;
    if (!this.inputEnabled) {
      this.keys.clear();
      this.player.moving = false;
    }
  }

  bindEvents() {
    addEventListener("resize", () => this.resize(), { passive: true });
    addEventListener("blur", () => this.keys.clear());
    addEventListener("keydown", event => {
      if (!this.running || !this.inputEnabled || isTypingTarget(event.target)) return;

      if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(event.code)) {
        this.keys.add(event.code);
        event.preventDefault();
        return;
      }

      if (["ControlLeft", "ControlRight"].includes(event.code) && !event.repeat) {
        if (!event.altKey && !event.metaKey && !event.shiftKey) this.tryAttack("basic");
        event.preventDefault();
        return;
      }

      if (event.code === "KeyQ" && !event.repeat && !event.ctrlKey && !event.metaKey && !event.altKey) {
        this.tryAttack("strong");
        event.preventDefault();
        return;
      }

      if (["KeyE", "KeyR", "Digit1", "Digit2", "Digit3"].includes(event.code) && !event.repeat) {
        this.activateEmptySlot(event.code);
      }
    });
    addEventListener("keyup", event => this.keys.delete(event.code));

    document.querySelectorAll(".slot").forEach(button => {
      button.addEventListener("click", () => {
        if (!this.running || !this.inputEnabled) return;
        if (button.dataset.code === "KeyQ") this.tryAttack("strong");
        else this.activateEmptySlot(button.dataset.code);
      });
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
    requestAnimationFrame(nextTimestamp => this.loop(nextTimestamp));
  }

  fixedUpdate(dt) {
    this.player.prevX = this.player.x;
    this.player.prevY = this.player.y;
    this.camera.prevX = this.camera.x;
    this.camera.prevY = this.camera.y;

    this.basicCooldown = Math.max(0, this.basicCooldown - dt);
    this.strongCooldown = Math.max(0, this.strongCooldown - dt);
    this.portalCooldown = Math.max(0, this.portalCooldown - dt);
    const wasRespawning = this.player.respawnTimer > 0;
    tickPlayerStatus(this.player, dt);
    if (wasRespawning && this.player.respawnTimer === 0) this.finishRespawn();

    if (this.portalTransition) {
      this.updatePortalTransition(dt);
    } else {
      this.updateAttack(dt);
      const isBlocked = (x, y, radius) => isWorldPositionBlocked(this.mapId, x, y, radius);
      this.enemies = updateEnemies(this.enemies, this.player, dt, isBlocked);

      if (this.player.respawnTimer <= 0) {
        this.applyEnemyContactDamage();
        this.updatePlayerMovement(dt);
        this.tryEnterPortal();
      }
    }
    this.updateDamageNumbers(dt);

    this.updateCamera(dt);
    this.network?.publish(this.player, this.mapId);
    this.updateRemoteInterpolation(dt);
    this.updateMessage(dt);
    this.updateBiome();
    this.updateHud();
  }

  updatePlayerMovement(dt) {
    const movement = this.inputEnabled ? movementVector(this.keys) : { x: 0, y: 0 };
    const dx = movement.x;
    const dy = movement.y;
    this.player.moving = Boolean(dx || dy);

    if (!this.player.moving) return;
    const nextX = this.player.x + dx * C.PLAYER_SPEED * dt;
    if (!isWorldPositionBlocked(this.mapId, nextX, this.player.y, PLAYER_RADIUS)) this.player.x = nextX;
    const nextY = this.player.y + dy * C.PLAYER_SPEED * dt;
    if (!isWorldPositionBlocked(this.mapId, this.player.x, nextY, PLAYER_RADIUS)) this.player.y = nextY;
    this.player.step += dt * 11;
    if (Math.abs(dx) > Math.abs(dy)) this.player.dir = dx > 0 ? "right" : "left";
    else this.player.dir = dy > 0 ? "down" : "up";
  }

  tryEnterPortal() {
    if (!this.inputEnabled || this.portalCooldown > 0 || this.portalTransition) return;
    const portal = findActivePortal(this.mapId, this.player.x, this.player.y, PLAYER_RADIUS);
    if (!portal) return;
    if (!portal.destination) {
      this.portalCooldown = 1;
      this.notify("포탈이 불안정합니다.");
      return;
    }

    this.portalTransition = createPortalTransition(portal);
    this.inputEnabled = false;
    this.keys.clear();
    this.player.moving = false;
    const target = getWorldDefinition(portal.destination.mapId);
    if (this.ui.portalDestination) this.ui.portalDestination.textContent = target.name;
    if (this.ui.portalTransitionOverlay) {
      this.ui.portalTransitionOverlay.hidden = false;
      this.ui.portalTransitionOverlay.classList.add("active");
    }
  }

  updatePortalTransition(dt) {
    const tick = advancePortalTransition(this.portalTransition, dt);
    this.portalTransition = tick.state;
    if (tick.shouldSwap) {
      const { mapId, x, y } = tick.state.destination;
      this.switchWorld(mapId, x, y);
    }
    if (!tick.finished) return;

    this.portalCooldown = tick.state.cooldownAfter;
    this.portalTransition = null;
    this.inputEnabled = this.player.respawnTimer <= 0;
    if (this.ui.portalTransitionOverlay) {
      this.ui.portalTransitionOverlay.classList.remove("active");
      this.ui.portalTransitionOverlay.hidden = true;
    }
  }

  switchWorld(mapId, x, y, announce = true) {
    let world = getWorldDefinition(normalizeWorldId(mapId));
    let targetX = x;
    let targetY = y;
    const invalidTarget = !Number.isFinite(targetX)
      || !Number.isFinite(targetY)
      || isWorldPositionBlocked(world.id, targetX, targetY, PLAYER_RADIUS);
    if (invalidTarget) {
      world = getWorldDefinition("village");
      targetX = world.spawn.x;
      targetY = world.spawn.y;
      if (announce) this.notify("포탈이 불안정해 중앙 마을로 돌아왔습니다.");
    }

    this.mapId = world.id;
    this.worldLayer = createWorldLayer(this.mapId);
    this.enemies = createEnemies(this.mapId);
    this.player.x = targetX;
    this.player.y = targetY;
    this.player.prevX = targetX;
    this.player.prevY = targetY;
    this.remotePlayers.clear();
    this.ui.playerCount.textContent = "1";

    const cameraX = clamp(targetX - innerWidth / 2, 0, Math.max(0, world.width - innerWidth));
    const cameraY = clamp(targetY - innerHeight / 2, 0, Math.max(0, world.height - innerHeight));
    this.camera.x = cameraX;
    this.camera.y = cameraY;
    this.camera.prevX = cameraX;
    this.camera.prevY = cameraY;
    this.drawMinimapBase();
    this.updateBiome();
    if (announce) this.notify(regionEntryMessage(this.mapId));
  }

  tryAttack(kind) {
    if (!this.running || !this.inputEnabled || this.player.respawnTimer > 0 || this.attackState) return;
    const definition = attackDefinition(kind);
    const cooldown = kind === "strong" ? this.strongCooldown : this.basicCooldown;
    if (cooldown > 0) {
      if (kind === "strong") this.notify(`강한 공격 재사용까지 ${cooldown.toFixed(1)}초`);
      return;
    }
    if (this.player.mp < definition.mpCost) {
      this.notify("강한 공격에 필요한 MP가 부족합니다.");
      return;
    }

    this.player.mp -= definition.mpCost;
    if (kind === "strong") this.strongCooldown = definition.cooldown;
    else this.basicCooldown = definition.cooldown;
    this.attackState = { kind, elapsed: 0, applied: false, definition };
    this.player.moving = false;
    this.updateHud();
  }

  updateAttack(dt) {
    if (!this.attackState) return;
    this.attackState.elapsed += dt;
    if (!this.attackState.applied && this.attackState.elapsed >= this.attackState.definition.windup) {
      this.attackState.applied = true;
      this.applyAttackHits(this.attackState.definition);
    }
    if (this.attackState.elapsed >= this.attackState.definition.duration) this.attackState = null;
  }

  applyAttackHits(definition) {
    const knockbackDirection = directionVector(this.player.dir);
    for (const enemy of this.enemies) {
      if (enemy.state === "dying") continue;
      if (!isTargetInAttackArc(this.player, this.player.dir, enemy, definition.range, definition.arcDegrees)) continue;
      const result = damageEnemy(enemy, definition.damage, knockbackDirection, definition.knockback);
      if (result.damageNumber) {
        this.damageNumbers.push({ ...result.damageNumber, age: 0, duration: 0.55 });
      }
    }
  }

  applyEnemyContactDamage() {
    for (const enemy of this.enemies) {
      if (enemy.state === "dying" || enemy.contactCooldown > 0) continue;
      const dx = this.player.x - enemy.x;
      const dy = this.player.y - enemy.y;
      if (Math.hypot(dx, dy) >= enemy.radius + PLAYER_RADIUS) continue;
      const result = this.damagePlayer(enemy.contactDamage, enemy);
      if (result.applied) enemy.contactCooldown = 1;
      if (result.died) break;
    }
  }

  damagePlayer(amount, source) {
    const result = applyPlayerDamage(this.player, amount);
    if (!result.applied) return result;

    const dx = this.player.x - source.x;
    const dy = this.player.y - source.y;
    const length = Math.hypot(dx, dy) || 1;
    const pushX = dx / length * 34;
    const pushY = dy / length * 34;
    const nextX = this.player.x + pushX;
    if (!isWorldPositionBlocked(this.mapId, nextX, this.player.y, PLAYER_RADIUS)) this.player.x = nextX;
    const nextY = this.player.y + pushY;
    if (!isWorldPositionBlocked(this.mapId, this.player.x, nextY, PLAYER_RADIUS)) this.player.y = nextY;

    if (result.died) {
      this.inputEnabled = false;
      this.keys.clear();
      this.attackState = null;
      this.player.moving = false;
      this.ui.respawnOverlay.hidden = false;
    }
    return result;
  }

  finishRespawn() {
    const village = getWorldDefinition("village");
    respawnPlayer(this.player, village.spawn);
    this.switchWorld("village", village.spawn.x, village.spawn.y, false);
    this.ui.respawnOverlay.hidden = true;
    this.inputEnabled = true;
    this.notify("다시 모험을 시작합니다.");
  }

  resetCombatState() {
    const world = getWorldDefinition(this.mapId);
    respawnPlayer(this.player, world.spawn);
    this.player.moving = false;
    this.enemies = createEnemies(this.mapId);
    this.attackState = null;
    this.basicCooldown = 0;
    this.strongCooldown = 0;
    this.damageNumbers = [];
    this.ui.respawnOverlay.hidden = true;
    this.updateHud();
  }

  updateDamageNumbers(dt) {
    for (const number of this.damageNumbers) {
      number.age += dt;
      number.y -= 24 * dt;
    }
    this.damageNumbers = this.damageNumbers.filter(number => number.age < number.duration);
  }

  updateCamera(dt) {
    const world = getWorldDefinition(this.mapId);
    const targetX = clamp(this.player.x - innerWidth / 2, 0, Math.max(0, world.width - innerWidth));
    const targetY = clamp(this.player.y - innerHeight / 2, 0, Math.max(0, world.height - innerHeight));
    const cameraFactor = 1 - Math.exp(-C.CAMERA_LERP * dt);
    this.camera.x += (targetX - this.camera.x) * cameraFactor;
    this.camera.y += (targetY - this.camera.y) * cameraFactor;
  }

  updateMessage(dt) {
    if (this.messageTimer <= 0) return;
    this.messageTimer -= dt;
    if (this.messageTimer <= 0) this.ui.message.classList.remove("show");
  }

  updateBiome() {
    const biome = getBiome(this.mapId);
    const subtitle = this.ui.playerSubtitle;
    if (subtitle.dataset.biome !== biome) {
      subtitle.dataset.biome = biome;
      subtitle.textContent = `LV. 1 · ${biome}`;
    }
  }

  updateHud() {
    this.ui.hpText.textContent = `${Math.ceil(this.player.hp)} / ${this.player.maxHp}`;
    this.ui.mpText.textContent = `${Math.ceil(this.player.mp)} / ${this.player.maxMp}`;
    this.ui.hpBar.style.transform = `scaleX(${this.player.hp / this.player.maxHp})`;
    this.ui.mpBar.style.transform = `scaleX(${this.player.mp / this.player.maxMp})`;

    const unavailable = this.strongCooldown > 0 || this.player.mp < 20 || this.player.respawnTimer > 0;
    this.ui.strongSlot.classList.toggle("unavailable", unavailable);
    this.ui.strongCooldown.textContent = this.strongCooldown > 0 ? this.strongCooldown.toFixed(1) : "";
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
    this.remotePlayers.forEach(remote => entities.push({ ...remote, entityType: "player", remote: true }));
    this.enemies.forEach(enemy => entities.push({ entityType: "enemy", enemy, x: enemy.x, y: enemy.y }));
    entities.push({
      ...this.player,
      x: lerp(this.player.prevX, this.player.x, alpha),
      y: lerp(this.player.prevY, this.player.y, alpha),
      entityType: "player",
      remote: false,
    });
    entities.sort((a, b) => a.y - b.y);

    for (const entity of entities) {
      if (entity.x < cameraX - 60 || entity.x > cameraX + viewW + 60 || entity.y < cameraY - 80 || entity.y > cameraY + viewH + 80) continue;
      if (entity.entityType === "enemy") drawEnemy(ctx, entity.enemy, cameraX, cameraY, alpha);
      else drawPixelCharacter(ctx, entity, cameraX, cameraY, entity.remote ? null : this.attackState);
    }

    if (this.attackState) drawAttackEffect(ctx, this.player, this.attackState, cameraX, cameraY, alpha);
    this.drawDamageNumbers(ctx, cameraX, cameraY);
    this.renderMinimap();
  }

  drawDamageNumbers(ctx, cameraX, cameraY) {
    ctx.save();
    ctx.textAlign = "center";
    ctx.font = "900 15px sans-serif";
    for (const number of this.damageNumbers) {
      const progress = number.age / number.duration;
      ctx.globalAlpha = 1 - progress;
      ctx.fillStyle = number.value >= 3 ? "#fde047" : "#ffffff";
      ctx.fillText(`-${number.value}`, Math.round(number.x - cameraX), Math.round(number.y - cameraY));
    }
    ctx.restore();
  }

  receiveRemotePlayers(players) {
    if (!this.running && !this.network) return;
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
    this.messageTimer = 1.7;
  }

  updateNetworkStatus(status, label) {
    const badge = this.ui.networkBadge;
    badge.className = `status ${status}`;
    badge.textContent = label;
  }

  measurePerformance(timestamp, frameSeconds) {
    const fpsSample = fpsSampleFromFrameSeconds(frameSeconds);
    if (fpsSample !== null) this.fpsSamples.push(fpsSample);
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
    const world = getWorldDefinition(this.mapId);
    const context = this.minimapCtx;
    context.imageSmoothingEnabled = false;
    context.clearRect(0, 0, this.minimap.width, this.minimap.height);
    context.drawImage(this.worldLayer, 0, 0, world.width, world.height, 0, 0, this.minimap.width, this.minimap.height);
  }

  renderMinimap() {
    const world = getWorldDefinition(this.mapId);
    const context = this.minimapCtx;
    const width = this.minimap.width, height = this.minimap.height;
    context.clearRect(0, 0, width, height);
    context.drawImage(this.worldLayer, 0, 0, world.width, world.height, 0, 0, width, height);
    const drawDot = (x, y, color, size) => {
      context.fillStyle = color;
      context.fillRect(Math.round(x / world.width * width - size / 2), Math.round(y / world.height * height - size / 2), size, size);
    };
    this.enemies.forEach(enemy => drawDot(enemy.x, enemy.y, enemy.color, 4));
    this.remotePlayers.forEach(player => drawDot(player.x, player.y, "#f8fafc", 3));
    drawDot(this.player.x, this.player.y, "#ff4d6d", 5);
  }
}

function drawPixelCharacter(ctx, player, cameraX, cameraY, attackState = null) {
  const x = Math.round(player.x - cameraX);
  const y = Math.round(player.y - cameraY);
  const bob = player.moving ? Math.sin(player.step) * 1.6 : 0;
  ctx.save();
  ctx.translate(x, y + bob);

  ctx.fillStyle = "rgba(0,0,0,.28)";
  ctx.fillRect(-13, 14, 26, 7);
  ctx.fillStyle = "#5b3b2a";
  ctx.fillRect(-9, 6, 7, 12);
  ctx.fillRect(2, 6, 7, 12);
  ctx.fillStyle = player.hitFlash > 0 ? "#ef4444" : "#b88a4e";
  ctx.fillRect(-10, -9, 20, 18);
  ctx.fillStyle = player.hitFlash > 0 ? "#fca5a5" : player.color || "#4f8e5b";
  ctx.fillRect(-14, -11, 6, 20);
  ctx.fillRect(8, -11, 6, 20);
  ctx.fillRect(-12, -14, 24, 5);
  ctx.fillStyle = player.hitFlash > 0 ? "#fecaca" : "#f0c39a";
  ctx.fillRect(-9, -24, 18, 14);
  ctx.fillStyle = "#493329";
  ctx.fillRect(-10, -27, 20, 7);
  ctx.fillRect(-10, -22, 5, 9);
  ctx.fillStyle = "#202938";
  if (player.dir === "left") ctx.fillRect(-7, -18, 2, 2);
  else if (player.dir === "right") ctx.fillRect(5, -18, 2, 2);
  else { ctx.fillRect(-5, -18, 2, 2); ctx.fillRect(3, -18, 2, 2); }
  drawSword(ctx, player.dir, attackState);

  if (player.remote) {
    const name = sanitizeName(player.name);
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

function drawSword(ctx, direction, attackState) {
  const baseAngle = { right: 0, down: Math.PI / 2, left: Math.PI, up: -Math.PI / 2 }[direction] || 0;
  const progress = attackState ? clamp(attackState.elapsed / attackState.definition.duration, 0, 1) : 0.5;
  const swingSize = attackState?.kind === "strong" ? 2.2 : 1.45;
  const swing = attackState ? -swingSize / 2 + progress * swingSize : 0.55;
  ctx.save();
  ctx.rotate(baseAngle + swing);
  ctx.fillStyle = "#6b4b2f";
  ctx.fillRect(7, -4, 9, 8);
  ctx.fillStyle = attackState?.kind === "strong" ? "#fde68a" : "#dceeff";
  ctx.fillRect(14, -2, attackState?.kind === "strong" ? 27 : 21, 4);
  ctx.fillStyle = "#f8fafc";
  ctx.fillRect(18, -1, attackState?.kind === "strong" ? 20 : 15, 2);
  ctx.restore();
}

function drawAttackEffect(ctx, player, attackState, cameraX, cameraY, alpha) {
  const x = lerp(player.prevX, player.x, alpha) - cameraX;
  const y = lerp(player.prevY, player.y, alpha) - cameraY;
  const definition = attackState.definition;
  const baseAngle = { right: 0, down: Math.PI / 2, left: Math.PI, up: -Math.PI / 2 }[player.dir] || 0;
  const halfArc = definition.arcDegrees * Math.PI / 360;
  ctx.save();
  ctx.translate(Math.round(x), Math.round(y));
  ctx.lineCap = "square";
  if (attackState.elapsed < definition.windup) {
    const charge = definition.windup ? attackState.elapsed / definition.windup : 1;
    ctx.globalAlpha = 0.3 + charge * 0.5;
    ctx.strokeStyle = "#fde047";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(0, 0, 24 + charge * 10, 0, Math.PI * 2);
    ctx.stroke();
  } else {
    const activeProgress = clamp((attackState.elapsed - definition.windup) / Math.max(0.01, definition.duration - definition.windup), 0, 1);
    ctx.globalAlpha = 1 - activeProgress * 0.75;
    ctx.strokeStyle = attackState.kind === "strong" ? "#fde047" : "#e0f2fe";
    ctx.lineWidth = attackState.kind === "strong" ? 10 : 6;
    ctx.beginPath();
    ctx.arc(0, 0, definition.range * (0.72 + activeProgress * 0.28), baseAngle - halfArc, baseAngle + halfArc);
    ctx.stroke();
  }
  ctx.restore();
}

function clamp(value, min, max) { return Math.max(min, Math.min(max, value)); }
function lerp(a, b, t) { return a + (b - a) * t; }
function easeOutCubic(t) { return 1 - Math.pow(1 - t, 3); }
function regionEntryMessage(mapId) {
  return {
    village: "중앙 마을 안전지대입니다.",
    volcano: "화산의 열기와 화염 슬라임을 조심하세요.",
    forest: "숲길의 몬스터를 조심하세요.",
    coast: "해안의 게와 물방울 슬라임을 조심하세요.",
  }[mapId] || "중앙 마을 안전지대입니다.";
}
function sanitizeName(value) {
  return typeof value === "string" ? value.replace(/\s+/g, " ").trim().slice(0, 12) || "모험가" : "모험가";
}
function isTypingTarget(target) {
  return target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement || target?.isContentEditable;
}
