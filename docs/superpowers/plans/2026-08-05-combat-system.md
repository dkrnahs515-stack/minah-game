# Pixel World Combat System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add directional movement, world collision, three combat-ready slimes, Ctrl basic attack, Q strong attack, hit feedback, enemy death fade, and player respawn to Pixel World.

**Architecture:** Keep `PixelRPG` as the orchestration layer while extracting pure combat geometry and enemy state transitions into focused ES modules. World collision data remains owned by `world.js`; tests use Node's built-in test runner and target pure functions without a browser DOM.

**Tech Stack:** HTML5 Canvas, native JavaScript ES modules, Firebase Realtime Database, Node.js `node:test`, GitHub Pages.

## Global Constraints

- Movement uses ArrowUp, ArrowDown, ArrowLeft, and ArrowRight; WASD movement is removed.
- Basic attack uses ControlLeft or ControlRight, deals 1 damage, has a 0.5 second cooldown, a 52 pixel range, and a 100 degree arc.
- Strong attack uses KeyQ, deals 3 damage, costs 20 MP, has a 4 second cooldown, a 0.22 second wind-up, an 84 pixel range, and a 140 degree arc.
- Three slimes spawn at world coordinates `(1260, 1040)`, `(1590, 1060)`, and `(1450, 1330)`.
- Slimes have 3 HP, move at 85 pixels per second, acquire the player within 360 pixels, and return home beyond 520 pixels.
- Basic and strong knockback start at 230 and 520 pixels per second respectively and decay at a factor of 8 per second.
- Slime contact deals 10 HP and gives the player 1 second of invulnerability.
- A dead slime fades from opacity 1 to 0 and scale 1 to 0.15 over 0.65 seconds, then is removed without respawning.
- Player death locks input and respawns at `(1440, 1110)` after 1.2 seconds with full HP and MP.
- Enemy state remains client-local; the Firebase player payload and database rules do not change.
- Do not add dependencies or a bundler.

---

### Task 1: Pure Combat Geometry

**Files:**
- Create: `src/combat.js`
- Create: `tests/combat.test.mjs`

**Interfaces:**
- Produces: `directionVector(direction): {x:number,y:number}`
- Produces: `isTargetInAttackArc(origin, direction, target, range, arcDegrees): boolean`
- Produces: `attackDefinition(kind): Readonly<{damage:number,cooldown:number,range:number,arcDegrees:number,windup:number,duration:number,mpCost:number,knockback:number}>`

- [ ] **Step 1: Write failing combat geometry tests**

```js
import test from "node:test";
import assert from "node:assert/strict";
import { attackDefinition, directionVector, isTargetInAttackArc } from "../src/combat.js";

test("directionVector maps all player directions", () => {
  assert.deepEqual(directionVector("up"), { x: 0, y: -1 });
  assert.deepEqual(directionVector("down"), { x: 0, y: 1 });
  assert.deepEqual(directionVector("left"), { x: -1, y: 0 });
  assert.deepEqual(directionVector("right"), { x: 1, y: 0 });
});

test("basic attack includes a close target in front and rejects one behind", () => {
  const origin = { x: 100, y: 100 };
  assert.equal(isTargetInAttackArc(origin, "right", { x: 145, y: 100 }, 52, 100), true);
  assert.equal(isTargetInAttackArc(origin, "right", { x: 70, y: 100 }, 52, 100), false);
});

test("strong attack exposes approved values", () => {
  assert.deepEqual(attackDefinition("strong"), {
    damage: 3, cooldown: 4, range: 84, arcDegrees: 140,
    windup: 0.22, duration: 0.4, mpCost: 20, knockback: 520,
  });
});
```

- [ ] **Step 2: Run the tests and confirm the missing-module failure**

Run: `node --test tests/combat.test.mjs`

Expected: FAIL with `ERR_MODULE_NOT_FOUND` for `src/combat.js`.

- [ ] **Step 3: Implement the pure combat functions**

```js
const DEFINITIONS = Object.freeze({
  basic: Object.freeze({
    damage: 1, cooldown: 0.5, range: 52, arcDegrees: 100,
    windup: 0, duration: 0.18, mpCost: 0, knockback: 230,
  }),
  strong: Object.freeze({
    damage: 3, cooldown: 4, range: 84, arcDegrees: 140,
    windup: 0.22, duration: 0.4, mpCost: 20, knockback: 520,
  }),
});

export function directionVector(direction) {
  return {
    up: { x: 0, y: -1 }, down: { x: 0, y: 1 },
    left: { x: -1, y: 0 }, right: { x: 1, y: 0 },
  }[direction] || { x: 0, y: 1 };
}

export function attackDefinition(kind) {
  return DEFINITIONS[kind] || DEFINITIONS.basic;
}

export function isTargetInAttackArc(origin, direction, target, range, arcDegrees) {
  const dx = target.x - origin.x;
  const dy = target.y - origin.y;
  const distance = Math.hypot(dx, dy);
  if (distance === 0 || distance > range) return false;
  const facing = directionVector(direction);
  const cosine = (facing.x * dx + facing.y * dy) / distance;
  return cosine >= Math.cos((arcDegrees * Math.PI / 180) / 2);
}
```

- [ ] **Step 4: Run the combat tests**

Run: `node --test tests/combat.test.mjs`

Expected: 3 tests pass.

- [ ] **Step 5: Commit the combat geometry**

```bash
git add src/combat.js tests/combat.test.mjs
git commit -m "전투 판정 기초 추가"
```

### Task 2: World Collision and Arrow-Key Movement

**Files:**
- Create: `src/collision.js`
- Create: `tests/collision.test.mjs`
- Modify: `src/world.js`
- Modify: `src/game.js`
- Modify: `index.html`

**Interfaces:**
- Produces: `pointInRect(x, y, rect, padding): boolean`
- Produces: `distanceToSegment(px, py, ax, ay, bx, by): number`
- Produces from `world.js`: `isWorldPositionBlocked(x, y, radius): boolean`
- Consumes in `game.js`: `isWorldPositionBlocked(nextX, nextY, 14)`

- [ ] **Step 1: Write failing collision tests**

```js
import test from "node:test";
import assert from "node:assert/strict";
import { distanceToSegment, pointInRect } from "../src/collision.js";

test("pointInRect includes collision padding", () => {
  const rect = { x: 100, y: 100, w: 50, h: 50 };
  assert.equal(pointInRect(95, 120, rect, 5), true);
  assert.equal(pointInRect(94, 120, rect, 5), false);
});

test("distanceToSegment measures a perpendicular point", () => {
  assert.equal(distanceToSegment(5, 5, 0, 0, 10, 0), 5);
});
```

- [ ] **Step 2: Run the collision tests and confirm failure**

Run: `node --test tests/collision.test.mjs`

Expected: FAIL with `ERR_MODULE_NOT_FOUND` for `src/collision.js`.

- [ ] **Step 3: Implement generic collision helpers**

```js
export function pointInRect(x, y, rect, padding = 0) {
  return x >= rect.x - padding && x <= rect.x + rect.w + padding
    && y >= rect.y - padding && y <= rect.y + rect.h + padding;
}

export function distanceToSegment(px, py, ax, ay, bx, by) {
  const dx = bx - ax;
  const dy = by - ay;
  if (dx === 0 && dy === 0) return Math.hypot(px - ax, py - ay);
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy)));
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}
```

- [ ] **Step 4: Add world collision data and query**

In `world.js`, import the helpers. Use the existing `obstacles` rectangles for landmarks. Represent the river as sampled points from the existing cubic Bézier from `(930,-40)` through `(760,560)`, `(1080,1040)`, to `(850,1840)`. Treat a point as blocked when its distance to any adjacent river sample segment is at most `45 + radius`, except inside bridge rectangles `{x:790,y:570,w:190,h:170}` and `{x:790,y:1110,w:190,h:190}`.

Export:

```js
export function isWorldPositionBlocked(x, y, radius = 0) {
  if (x - radius < 0 || y - radius < 0 || x + radius > C.WORLD_WIDTH || y + radius > C.WORLD_HEIGHT) return true;
  if (obstacles.some(rect => pointInRect(x, y, rect, radius))) return true;
  if (bridges.some(rect => pointInRect(x, y, rect, 0))) return false;
  return riverSegments.some(segment => distanceToSegment(x, y, ...segment) <= 45 + radius);
}
```

- [ ] **Step 5: Replace WASD movement with arrow movement and axis-separated collision**

In `game.js`, map `ArrowUp/Down/Left/Right` to movement. Compute `nextX` and `nextY` separately and accept each axis only when `isWorldPositionBlocked` returns false. Prevent default browser behavior for arrows while input is enabled. Delete WASD handling.

- [ ] **Step 6: Update visible control help**

In `index.html`, replace the WASD control group with four arrow-key `kbd` elements and label them `이동`. Add a Ctrl control row labeled `기본 공격`.

- [ ] **Step 7: Run tests**

Run: `node --test tests/*.test.mjs`

Expected: 5 tests pass.

- [ ] **Step 8: Commit collision and movement**

```bash
git add src/collision.js tests/collision.test.mjs src/world.js src/game.js index.html
git commit -m "지형 충돌과 방향키 이동 추가"
```

### Task 3: Slime State, Tracking, Knockback, and Death

**Files:**
- Create: `src/enemies.js`
- Create: `tests/enemies.test.mjs`

**Interfaces:**
- Produces: `createSlimes(): Slime[]`
- Produces: `updateSlimes(slimes, player, dt, isBlocked): Slime[]`
- Produces: `damageSlime(slime, damage, direction, knockbackSpeed): { killed:boolean, damageNumber:object }`
- Produces: `drawSlime(ctx, slime, cameraX, cameraY): void`

- [ ] **Step 1: Write failing enemy-state tests**

```js
import test from "node:test";
import assert from "node:assert/strict";
import { createSlimes, damageSlime, updateSlimes } from "../src/enemies.js";

test("three approved slimes spawn with 3 HP", () => {
  const slimes = createSlimes();
  assert.deepEqual(slimes.map(({ x, y, hp }) => ({ x, y, hp })), [
    { x: 1260, y: 1040, hp: 3 },
    { x: 1590, y: 1060, hp: 3 },
    { x: 1450, y: 1330, hp: 3 },
  ]);
});

test("strong damage starts death and knockback", () => {
  const slime = createSlimes()[0];
  const result = damageSlime(slime, 3, { x: 1, y: 0 }, 520);
  assert.equal(result.killed, true);
  assert.equal(slime.state, "dying");
  assert.equal(slime.knockbackX, 520);
});

test("dead slime is removed after 0.65 seconds", () => {
  const slime = createSlimes()[0];
  damageSlime(slime, 3, { x: 1, y: 0 }, 520);
  const remaining = updateSlimes([slime], { x: 0, y: 0 }, 0.66, () => false);
  assert.equal(remaining.length, 0);
});
```

- [ ] **Step 2: Run tests and confirm the missing-module failure**

Run: `node --test tests/enemies.test.mjs`

Expected: FAIL with `ERR_MODULE_NOT_FOUND`.

- [ ] **Step 3: Implement slime creation and state transitions**

Each slime contains `id, x, y, homeX, homeY, prevX, prevY, hp, maxHp, radius, state, hitFlash, shake, deathTime, scale, opacity, knockbackX, knockbackY, contactCooldown, step`. `updateSlimes` must:

- decrement timers;
- integrate knockback using axis-separated collision;
- exponentially decay knockback with `Math.exp(-8 * dt)`;
- chase at 85 pixels per second within 360 pixels;
- return home beyond 520 pixels;
- update dying opacity with `1 - deathTime / 0.65`;
- update dying scale with `1 - 0.85 * deathTime / 0.65`;
- filter slimes after `deathTime >= 0.65`.

- [ ] **Step 4: Implement slime drawing**

Draw a green pixel slime using canvas rectangles and ellipses. Apply `opacity`, `scale`, vertical bob, hit-flash white fill, and `shake` translation. Draw a compact red HP bar above living damaged slimes. Do not draw contact hitboxes.

- [ ] **Step 5: Run enemy and full tests**

Run: `node --test tests/*.test.mjs`

Expected: 8 tests pass.

- [ ] **Step 6: Commit enemy behavior**

```bash
git add src/enemies.js tests/enemies.test.mjs
git commit -m "슬라임 추적과 피격 상태 추가"
```

### Task 4: Integrate Attacks, Damage, HUD, and Respawn

**Files:**
- Modify: `src/game.js`
- Modify: `index.html`
- Modify: `styles.css`

**Interfaces:**
- Consumes: `attackDefinition`, `directionVector`, `isTargetInAttackArc`
- Consumes: `createSlimes`, `damageSlime`, `drawSlime`, `updateSlimes`
- Produces in `PixelRPG`: `tryAttack(kind): void`, `damagePlayer(amount, source): void`, `beginRespawn(): void`, `resetCombatState(): void`

- [ ] **Step 1: Add combat state to the game constructor and reset path**

Add `slimes`, `attackState`, `basicCooldown`, `strongCooldown`, `damageNumbers`, and player fields `maxHp:100, maxMp:100, invulnerable:0, respawnTimer:0, hitFlash:0`. Call `resetCombatState()` on successful entry and leave.

- [ ] **Step 2: Add one-shot Ctrl and Q input**

In `keydown`, ignore repeats. Call `tryAttack("basic")` for `ControlLeft` and `ControlRight`, and `tryAttack("strong")` for `KeyQ`. Do not fire when an input element is focused, input is disabled, the player is respawning, or another attack is active.

- [ ] **Step 3: Implement attack lifecycle and MP/cooldown validation**

`tryAttack` reads `attackDefinition(kind)`. Strong attacks fail with a message when MP is below 20 or cooldown is above zero. A successful attack stores `kind, elapsed:0, applied:false`, subtracts MP, and sets the correct cooldown. During fixed update, increment elapsed and apply damage exactly once after `windup`. Clear the state after `duration`.

- [ ] **Step 4: Apply attack hits and damage numbers**

At the active instant, call `isTargetInAttackArc` for every living slime. Call `damageSlime` once for each hit using `directionVector(player.dir)`. Push a damage-number object `{x, y, value, age:0, duration:0.55}`; update and discard numbers in fixed update.

- [ ] **Step 5: Add slime contact damage and player invulnerability**

When distance between a living slime and the player is less than `slime.radius + 14`, call `damagePlayer(10, slime)`. The method returns during invulnerability, otherwise sets invulnerability to 1 second, hit flash to 0.18 seconds, subtracts HP, and attempts axis-separated knockback away from the slime. If HP reaches zero, call `beginRespawn()`.

- [ ] **Step 6: Implement respawn**

`beginRespawn()` disables input, clears keys and active attack, and sets `respawnTimer = 1.2`. Fixed update counts down. On expiry, set current and previous player coordinates to `(1440,1110)`, restore HP and MP to 100, clear invulnerability, reset current and previous camera coordinates to the clamped spawn target, re-enable input, and show `다시 모험을 시작합니다.`.

- [ ] **Step 7: Integrate entity ordering and combat rendering**

Add living and dying slimes to the same Y-sorted entity list as players. Draw slimes with `drawSlime`; draw the player with a red hit flash and attack-specific sword pose. Draw basic and strong arc effects after the player. Draw damage numbers in world space after entities.

- [ ] **Step 8: Update HUD state every fixed update**

Set HP and MP text and bar transforms from current values. Replace Q slot content with `강한 공격` and `MP 20`. Add a cooldown overlay whose height or text reflects `strongCooldown`. Disable the slot visually when MP is insufficient or the cooldown is active. Leave E, R, and item slots empty.

- [ ] **Step 9: Add respawn overlay**

Add `#respawnOverlay` inside the HUD with text `쓰러졌습니다` and `잠시 후 중앙 초원에서 부활합니다.`. Show it only while `respawnTimer > 0`. Style it as a non-interactive dark vignette that does not permanently cover the playfield.

- [ ] **Step 10: Run full tests**

Run: `node --test tests/*.test.mjs`

Expected: 8 tests pass with no failures.

- [ ] **Step 11: Commit integrated combat**

```bash
git add src/game.js index.html styles.css
git commit -m "플레이어 공격과 부활 전투 흐름 추가"
```

### Task 5: Documentation and Browser Regression Verification

**Files:**
- Modify: `README.md`
- Modify: `FIREBASE_SETUP.md`

**Interfaces:**
- No new runtime interfaces.
- Confirms the complete game loop and existing Firebase compatibility.

- [ ] **Step 1: Update player documentation**

Replace WASD instructions with arrow movement, Ctrl basic attack, Q strong attack, and Esc exit. Document local-only enemies, slime HP, collision, player contact damage, and respawn.

- [ ] **Step 2: Correct the Firebase repository name**

In `FIREBASE_SETUP.md`, replace `dkrnahs515-stack/minah-game` with `dkrnahs515-stack/pixel_world`.

- [ ] **Step 3: Run automated tests**

Run: `node --test tests/*.test.mjs`

Expected: 8 tests pass.

- [ ] **Step 4: Run static module syntax checks**

Run:

```bash
node --check src/combat.js
node --check src/collision.js
node --check src/enemies.js
node --check src/game.js
node --check src/main.js
node --check src/network.js
node --check src/world.js
```

Expected: every command exits 0 without output.

- [ ] **Step 5: Serve and smoke-test the game**

Run: `python3 -m http.server 4173`

Verify in a desktop browser:

1. Entry screen loads without console errors.
2. Nickname entry opens the game.
3. Arrow keys move and WASD does not.
4. Landmarks and river block movement while both bridges allow passage.
5. Ctrl damages a front-facing slime only once per press.
6. Q consumes 20 MP, kills a full-health slime, and applies stronger knockback.
7. Hit flash, shake, damage number, and 0.65 second death fade are visible.
8. Contact damage respects the 1 second invulnerability period.
9. HP 0 shows the respawn overlay and returns the player to `(1440,1110)`.
10. Esc exit and re-entry reset slimes, cooldowns, HP, and MP.
11. Firebase status, remote player count, and player cleanup still work.

- [ ] **Step 6: Commit documentation and verification fixes**

```bash
git add README.md FIREBASE_SETUP.md
git commit -m "전투 조작과 배포 문서 갱신"
```
