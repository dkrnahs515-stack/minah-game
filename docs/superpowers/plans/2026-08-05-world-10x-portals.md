# Pixel World 10배 월드·포탈 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Pixel World를 기존 면적의 정확히 10배인 네 지역 월드로 확장하고 포탈, 중앙 마을 안전지대, 지역별 몬스터와 지역 단위 Firebase 멀티플레이를 구현한다.

**Architecture:** `world-data.js`가 DOM과 무관한 지역 정의를 소유하고, `world.js`는 활성 지역 하나의 렌더링·충돌·포탈 조회를 담당한다. `game.js`는 지역 전환과 기존 전투를 조정하며, `network-state.js`가 Firebase 직렬화와 지역 필터를 순수 함수로 분리한다.

**Tech Stack:** HTML5 Canvas, native JavaScript ES modules, Firebase Authentication/Realtime Database 12.16.0, Node.js `node:test`, GitHub Pages.

## Global Constraints

- 중앙 마을은 `2,880 × 1,800px`, 외부 각 지역은 `4,320 × 3,600px`이다.
- 네 지역의 합산 면적은 `51,840,000px²`로 현재 면적 `5,184,000px²`의 정확히 10배다.
- 지역 ID는 `village`, `volcano`, `forest`, `coast` 네 값만 사용한다.
- 중앙 마을의 `enemySpawns`는 항상 빈 배열이다.
- 기존 방향키 이동, Ctrl 기본 공격, Q 강한 공격, HP/MP, 사망·부활 동작을 보존한다.
- 기존 닉네임 입장, 나가기, Firebase 익명 로그인과 `onDisconnect().remove()` 동작을 보존한다.
- 몬스터 상태는 클라이언트 로컬로 유지한다.
- 의존성과 번들러를 추가하지 않는다.
- 활성 지역의 정적 캔버스 하나만 메모리에 유지한다.

---

### Task 1: 순수 월드 정의와 10배 면적 불변식

**Files:**
- Create: `src/world-data.js`
- Create: `tests/world-data.test.mjs`

**Interfaces:**
- Produces: `WORLD_IDS: readonly ["village","volcano","forest","coast"]`
- Produces: `WORLD_DEFINITIONS: Readonly<Record<string, WorldDefinition>>`
- Produces: `normalizeWorldId(value): string`
- Produces: `getWorldDefinition(mapId): WorldDefinition`
- Produces: `getTotalWorldArea(): number`
- Produces: `getPortalDestination(mapId, portalId): {mapId:string,x:number,y:number} | null`
- Produces: `isSafeWorld(mapId): boolean`

- [ ] **Step 1: 면적·안전지대·포탈 테스트를 작성한다**

```js
import test from "node:test";
import assert from "node:assert/strict";
import {
  WORLD_IDS, WORLD_DEFINITIONS, getPortalDestination,
  getTotalWorldArea, isSafeWorld, normalizeWorldId,
} from "../src/world-data.js";

test("네 지역의 합산 면적은 기존 월드의 정확히 10배다", () => {
  assert.equal(getTotalWorldArea(), 2880 * 1800 * 10);
  assert.deepEqual(WORLD_IDS, ["village", "volcano", "forest", "coast"]);
  assert.deepEqual(
    WORLD_IDS.map(id => [WORLD_DEFINITIONS[id].width, WORLD_DEFINITIONS[id].height]),
    [[2880, 1800], [4320, 3600], [4320, 3600], [4320, 3600]],
  );
});

test("중앙 마을만 안전지대이며 몬스터 생성점이 없다", () => {
  assert.equal(isSafeWorld("village"), true);
  assert.equal(WORLD_DEFINITIONS.village.enemySpawns.length, 0);
  assert.equal(isSafeWorld("volcano"), false);
});

test("모든 포탈 목적지는 유효한 지역 내부다", () => {
  for (const mapId of WORLD_IDS) {
    for (const portal of WORLD_DEFINITIONS[mapId].portals) {
      const destination = getPortalDestination(mapId, portal.id);
      const target = WORLD_DEFINITIONS[destination.mapId];
      assert.ok(destination.x > 0 && destination.x < target.width);
      assert.ok(destination.y > 0 && destination.y < target.height);
    }
  }
});

test("알 수 없는 지역과 이전 데이터는 중앙 마을로 정규화된다", () => {
  assert.equal(normalizeWorldId(undefined), "village");
  assert.equal(normalizeWorldId("desert"), "village");
  assert.equal(normalizeWorldId("coast"), "coast");
});
```

- [ ] **Step 2: 새 모듈이 없어서 실패하는 것을 확인한다**

Run: `node --test tests/world-data.test.mjs`

Expected: FAIL with `ERR_MODULE_NOT_FOUND` for `src/world-data.js`.

- [ ] **Step 3: 네 지역 정의를 구현한다**

```js
export const WORLD_IDS = Object.freeze(["village", "volcano", "forest", "coast"]);

const villagePortals = [
  { id: "to-forest", x: 570, y: 410, w: 96, h: 96, label: "태고의 숲", color: "#53d769",
    destination: { mapId: "forest", x: 2160, y: 3260 } },
  { id: "to-volcano", x: 2214, y: 410, w: 96, h: 96, label: "활화산", color: "#ff7043",
    destination: { mapId: "volcano", x: 2160, y: 3260 } },
  { id: "to-coast", x: 1392, y: 1500, w: 96, h: 96, label: "해안가", color: "#38bdf8",
    destination: { mapId: "coast", x: 2160, y: 340 } },
];

const returnPortal = (id, x, y) => ({
  id, x, y, w: 96, h: 96, label: "중앙 마을", color: "#d8b4fe",
  destination: { mapId: "village", x: 1440, y: 1180 },
});

export const WORLD_DEFINITIONS = Object.freeze({
  village: Object.freeze({
    id: "village", name: "중앙 마을", width: 2880, height: 1800,
    spawn: Object.freeze({ x: 1440, y: 1110 }), safe: true,
    portals: Object.freeze(villagePortals), enemySpawns: Object.freeze([]),
    obstacles: Object.freeze([
      { x: 1120, y: 180, w: 640, h: 250, type: "townHall" },
      { x: 240, y: 650, w: 690, h: 430, type: "farm" },
      { x: 2020, y: 610, w: 560, h: 350, type: "shops" },
      { x: 1080, y: 1320, w: 720, h: 240, type: "tradePost" },
    ]),
  }),
  volcano: Object.freeze({
    id: "volcano", name: "끓어오르는 활화산", width: 4320, height: 3600,
    spawn: Object.freeze({ x: 2160, y: 3260 }), safe: false,
    portals: Object.freeze([returnPortal("to-village", 2112, 3320)]),
    enemySpawns: Object.freeze([
      { kind: "fire-slime", x: 1250, y: 2850 }, { kind: "fire-slime", x: 1750, y: 2480 },
      { kind: "fire-slime", x: 2580, y: 2630 }, { kind: "fire-slime", x: 3150, y: 2860 },
      { kind: "fire-slime", x: 1120, y: 1720 }, { kind: "fire-slime", x: 2110, y: 1510 },
      { kind: "fire-slime", x: 3050, y: 1680 }, { kind: "fire-slime", x: 2190, y: 820 },
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
    id: "forest", name: "태고의 숲", width: 4320, height: 3600,
    spawn: Object.freeze({ x: 2160, y: 3260 }), safe: false,
    portals: Object.freeze([returnPortal("to-village", 2112, 3320)]),
    enemySpawns: Object.freeze([
      { kind: "forest-slime", x: 980, y: 2820 }, { kind: "forest-slime", x: 1660, y: 2430 },
      { kind: "forest-slime", x: 2670, y: 2580 }, { kind: "forest-slime", x: 3380, y: 2800 },
      { kind: "forest-slime", x: 2060, y: 1640 }, { kind: "boar", x: 1120, y: 1460 },
      { kind: "boar", x: 3180, y: 1510 }, { kind: "boar", x: 1640, y: 780 },
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
    id: "coast", name: "푸른 해안가", width: 4320, height: 3600,
    spawn: Object.freeze({ x: 2160, y: 340 }), safe: false,
    portals: Object.freeze([returnPortal("to-village", 2112, 184)]),
    enemySpawns: Object.freeze([
      { kind: "crab", x: 880, y: 980 }, { kind: "crab", x: 1480, y: 1260 },
      { kind: "crab", x: 2840, y: 1180 }, { kind: "crab", x: 3460, y: 980 },
      { kind: "crab", x: 2180, y: 1780 }, { kind: "water-slime", x: 1040, y: 2380 },
      { kind: "water-slime", x: 1780, y: 2760 }, { kind: "water-slime", x: 2740, y: 2680 },
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
  return WORLD_IDS.reduce((sum, id) => sum + WORLD_DEFINITIONS[id].width * WORLD_DEFINITIONS[id].height, 0);
}
export function getPortalDestination(mapId, portalId) {
  return getWorldDefinition(mapId).portals.find(portal => portal.id === portalId)?.destination || null;
}
export function isSafeWorld(mapId) {
  return getWorldDefinition(mapId).safe;
}
```

- [ ] **Step 4: 월드 정의 테스트를 통과시킨다**

Run: `node --test tests/world-data.test.mjs`

Expected: 4 tests pass.

- [ ] **Step 5: 월드 정의를 커밋한다**

```powershell
git add src/world-data.js tests/world-data.test.mjs
git commit -m "10배 지역 월드 정의 추가"
```

### Task 2: 활성 지역 렌더링·충돌·포탈 조회

**Files:**
- Modify: `src/world.js`
- Modify: `src/config.js`
- Modify: `tests/collision.test.mjs`
- Create: `tests/world.test.mjs`

**Interfaces:**
- Consumes: `getWorldDefinition(mapId)`
- Produces: `createWorldLayer(mapId): HTMLCanvasElement`
- Produces: `isWorldPositionBlocked(mapId, x, y, radius): boolean`
- Produces: `findActivePortal(mapId, x, y, radius): Portal | null`
- Produces: `getBiome(mapId): string`

- [ ] **Step 1: 지역 경계·장애물·포탈 테스트를 작성한다**

```js
import test from "node:test";
import assert from "node:assert/strict";
import { findActivePortal, getBiome, isWorldPositionBlocked } from "../src/world.js";

test("지역별 바깥 경계와 대표 장애물을 막는다", () => {
  assert.equal(isWorldPositionBlocked("village", -1, 100, 14), true);
  assert.equal(isWorldPositionBlocked("village", 1440, 1110, 14), false);
  assert.equal(isWorldPositionBlocked("volcano", 200, 1800, 14), true);
  assert.equal(isWorldPositionBlocked("forest", 2160, 800, 14), true);
  assert.equal(isWorldPositionBlocked("coast", 2160, 3300, 14), true);
});

test("포탈 영역과 표시 지역명을 반환한다", () => {
  assert.equal(findActivePortal("village", 618, 458, 14)?.id, "to-forest");
  assert.equal(findActivePortal("village", 1440, 1110, 14), null);
  assert.equal(getBiome("volcano"), "끓어오르는 활화산");
});
```

기존 `tests/collision.test.mjs`의 월드 충돌 호출에는 첫 인자로 `"village"`를 추가한다.

- [ ] **Step 2: 기존 함수 서명 때문에 실패하는 것을 확인한다**

Run: `node --test tests/collision.test.mjs tests/world.test.mjs`

Expected: FAIL because `isWorldPositionBlocked` does not accept `mapId` and `findActivePortal` is not exported.

- [ ] **Step 3: 지역별 충돌과 포탈 조회를 구현한다**

```js
import { pointInRect } from "./collision.js";
import { getWorldDefinition } from "./world-data.js";

export function isWorldPositionBlocked(mapId, x, y, radius = 0) {
  const world = getWorldDefinition(mapId);
  if (x - radius < 0 || y - radius < 0 || x + radius > world.width || y + radius > world.height) {
    return true;
  }
  return world.obstacles.some(rect => pointInRect(x, y, rect, radius));
}

export function findActivePortal(mapId, x, y, radius = 0) {
  const world = getWorldDefinition(mapId);
  return world.portals.find(portal => pointInRect(x, y, portal, radius)) || null;
}

export function getBiome(mapId) {
  return getWorldDefinition(mapId).name;
}

export function createWorldLayer(mapId) {
  const world = getWorldDefinition(mapId);
  const layer = document.createElement("canvas");
  layer.width = world.width;
  layer.height = world.height;
  const context = layer.getContext("2d", { alpha: false });
  context.imageSmoothingEnabled = false;
  ({
    village: drawVillage,
    volcano: drawVolcano,
    forest: drawForest,
    coast: drawCoast,
  })[world.id](context, world);
  drawPortals(context, world.portals);
  return layer;
}
```

`drawVillage`은 잔디 바탕, 중앙 광장, 북쪽 회관, 서쪽 밭과 헛간, 동쪽 상점·대장간, 남쪽 무역소를 그린다. `drawVolcano`는 `#272124` 현무암 바탕과 `#f04b24` 용암, `drawForest`는 `#285b38` 숲 바탕과 수목·연못, `drawCoast`는 `#d7bd75` 모래와 `#2f9bc5` 바다를 사용한다. 각 함수는 정의된 장애물 사각형을 같은 좌표로 그려 시각 지형과 충돌 지형을 일치시킨다. `drawPortals`는 각 포탈 사각형 안에 세 겹의 색상 사각형과 목적지 이름을 그린다.

`src/config.js`에서는 `WORLD_WIDTH`, `WORLD_HEIGHT`를 제거하고 나머지 성능·입력 상수를 유지한다.

- [ ] **Step 4: 충돌과 월드 테스트를 통과시킨다**

Run: `node --test tests/collision.test.mjs tests/world.test.mjs tests/world-data.test.mjs`

Expected: all tests pass.

- [ ] **Step 5: 지역 월드 렌더링을 커밋한다**

```powershell
git add src/world.js src/config.js tests/collision.test.mjs tests/world.test.mjs
git commit -m "지역별 지형과 포탈 충돌 구현"
```

### Task 3: 지역별 몬스터 상태 머신

**Files:**
- Modify: `src/enemies.js`
- Modify: `tests/enemies.test.mjs`
- Modify: `src/game.js`

**Interfaces:**
- Consumes: `getWorldDefinition(mapId).enemySpawns`
- Produces: `createEnemies(mapId): Enemy[]`
- Produces: `damageEnemy(enemy, damage, direction, knockbackSpeed): DamageResult`
- Produces: `updateEnemies(enemies, player, dt, isBlocked): Enemy[]`
- Produces: `drawEnemy(ctx, enemy, cameraX, cameraY, alpha): void`

- [ ] **Step 1: 안전지대와 지역별 적 생성 테스트로 기존 테스트를 교체한다**

```js
import test from "node:test";
import assert from "node:assert/strict";
import { createEnemies, damageEnemy, updateEnemies } from "../src/enemies.js";

test("중앙 마을에는 적이 생성되지 않는다", () => {
  assert.deepEqual(createEnemies("village"), []);
});

test("외부 지역에는 지정된 종류와 수의 적이 생성된다", () => {
  assert.equal(createEnemies("volcano").length, 8);
  assert.deepEqual(new Set(createEnemies("forest").map(enemy => enemy.kind)), new Set(["forest-slime", "boar"]));
  assert.deepEqual(new Set(createEnemies("coast").map(enemy => enemy.kind)), new Set(["crab", "water-slime"]));
});

test("지역별 적 능력치가 적용된다", () => {
  const fire = createEnemies("volcano")[0];
  const boar = createEnemies("forest").find(enemy => enemy.kind === "boar");
  assert.deepEqual({ hp: fire.hp, damage: fire.contactDamage }, { hp: 4, damage: 12 });
  assert.deepEqual({ hp: boar.hp, speed: boar.speed }, { hp: 6, speed: 112 });
});

test("피해와 사망 페이드 동작을 유지한다", () => {
  const enemy = createEnemies("volcano")[0];
  const result = damageEnemy(enemy, enemy.hp, { x: 1, y: 0 }, 520);
  assert.equal(result.killed, true);
  assert.equal(enemy.state, "dying");
  assert.equal(updateEnemies([enemy], { x: 0, y: 0 }, 0.66, () => false).length, 0);
});
```

- [ ] **Step 2: 새 일반화 인터페이스가 없어 실패하는 것을 확인한다**

Run: `node --test tests/enemies.test.mjs`

Expected: FAIL because `createEnemies`, `damageEnemy`, and `updateEnemies` are not exported.

- [ ] **Step 3: 적 종류와 공통 상태 머신을 구현한다**

```js
import { getWorldDefinition } from "./world-data.js";

const ENEMY_TYPES = Object.freeze({
  "fire-slime": Object.freeze({ name: "화염 슬라임", hp: 4, speed: 92, damage: 12, radius: 18, color: "#ef5a32" }),
  "forest-slime": Object.freeze({ name: "숲 슬라임", hp: 4, speed: 88, damage: 10, radius: 18, color: "#4fb867" }),
  boar: Object.freeze({ name: "멧돼지", hp: 6, speed: 112, damage: 15, radius: 20, color: "#8b5a3c" }),
  crab: Object.freeze({ name: "해안 게", hp: 5, speed: 76, damage: 12, radius: 20, color: "#ef6b57" }),
  "water-slime": Object.freeze({ name: "물방울 슬라임", hp: 4, speed: 84, damage: 10, radius: 18, color: "#48a9d8" }),
});

export function createEnemies(mapId) {
  return getWorldDefinition(mapId).enemySpawns.map((spawn, index) => {
    const type = ENEMY_TYPES[spawn.kind];
    return {
      id: `${mapId}-enemy-${index + 1}`, kind: spawn.kind, name: type.name,
      x: spawn.x, y: spawn.y, prevX: spawn.x, prevY: spawn.y,
      homeX: spawn.x, homeY: spawn.y, hp: type.hp, maxHp: type.hp,
      speed: type.speed, contactDamage: type.damage, radius: type.radius, color: type.color,
      state: "idle", moving: false, step: index * 1.7, hitFlash: 0, shake: 0,
      deathTime: 0, opacity: 1, scale: 1, knockbackX: 0, knockbackY: 0, contactCooldown: 0,
    };
  });
}
```

기존 추적·귀환·넉백·사망 페이드 알고리즘을 `slime` 대신 `enemy` 매개변수로 일반화한다. 이동 속도는 상수 대신 `enemy.speed`, 접촉 피해는 `enemy.contactDamage`를 사용한다. `drawEnemy`는 `kind`에 따라 슬라임 몸체, 멧돼지 사각 실루엣, 게 집게 실루엣을 선택하고 공통 HP 바·점멸·흔들림·사망 페이드를 유지한다.

`src/game.js`의 import와 호출만 새 이름으로 바꾸고 게임 흐름 변경은 Task 5에서 수행한다.

- [ ] **Step 4: 적 테스트와 기존 전투 테스트를 통과시킨다**

Run: `node --test tests/enemies.test.mjs tests/combat.test.mjs tests/player-combat.test.mjs`

Expected: all tests pass.

- [ ] **Step 5: 지역별 몬스터를 커밋한다**

```powershell
git add src/enemies.js src/game.js tests/enemies.test.mjs
git commit -m "지역별 몬스터 종류 추가"
```

### Task 4: Firebase 지역 직렬화와 보안 규칙

**Files:**
- Create: `src/network-state.js`
- Create: `tests/network-state.test.mjs`
- Modify: `src/network.js`
- Modify: `database.rules.json`

**Interfaces:**
- Consumes: `normalizeWorldId(value)`, `getWorldDefinition(mapId)`
- Produces: `serializePlayerState(player, mapId): PlayerSnapshot`
- Produces: `filterPlayersForMap(rawPlayers, ownUid, mapId): Map<string, PlayerSnapshot>`

- [ ] **Step 1: 직렬화·호환성·지역 필터 테스트를 작성한다**

```js
import test from "node:test";
import assert from "node:assert/strict";
import { filterPlayersForMap, serializePlayerState } from "../src/network-state.js";

test("플레이어 상태에 mapId와 기존 필드를 함께 직렬화한다", () => {
  assert.deepEqual(
    serializePlayerState({ x: 10.04, y: 20.06, dir: "left", moving: true, color: "#fff", name: "별" }, "forest"),
    { x: 10, y: 20.1, dir: "left", moving: true, color: "#fff", name: "별", mapId: "forest" },
  );
});

test("같은 지역의 유효한 원격 플레이어만 반환한다", () => {
  const raw = {
    own: { x: 1, y: 1, mapId: "forest" },
    same: { x: 100, y: 200, mapId: "forest", name: "숲" },
    other: { x: 100, y: 200, mapId: "coast", name: "바다" },
    invalid: { x: 5000, y: 200, mapId: "forest" },
  };
  assert.deepEqual([...filterPlayersForMap(raw, "own", "forest").keys()], ["same"]);
});

test("mapId가 없는 이전 데이터는 중앙 마을에서 보인다", () => {
  const players = filterPlayersForMap({ legacy: { x: 100, y: 100, name: "이전" } }, "own", "village");
  assert.equal(players.has("legacy"), true);
});
```

- [ ] **Step 2: 새 모듈이 없어 실패하는 것을 확인한다**

Run: `node --test tests/network-state.test.mjs`

Expected: FAIL with `ERR_MODULE_NOT_FOUND`.

- [ ] **Step 3: 순수 네트워크 상태 변환을 구현한다**

```js
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
```

- [ ] **Step 4: Firebase 어댑터에 mapId를 연결한다**

`createNetworkAdapter`의 플레이어 콜백은 원시 스냅샷을 보관하고, `publish(state, mapId)` 호출 때 활성 지역을 갱신한 뒤 `filterPlayersForMap` 결과를 전달한다. Firebase `update`에는 `serializePlayerState(state, mapId)`와 `updatedAt: serverTimestamp()`를 함께 기록한다. `stop`과 익명 인증 흐름은 변경하지 않는다.

- [ ] **Step 5: Realtime Database 좌표 규칙을 지역별로 제한한다**

```json
{
  "rules": {
    "rooms": {
      "$roomId": {
        "players": {
          ".read": "auth != null",
          "$uid": {
            ".write": "auth != null && auth.uid === $uid",
            ".validate": "newData.hasChildren(['x','y','dir','moving','name','color','mapId']) && newData.child('x').isNumber() && newData.child('x').val() >= 0 && newData.child('y').isNumber() && newData.child('y').val() >= 0 && newData.child('mapId').isString() && (newData.child('mapId').val() === 'village' || newData.child('mapId').val() === 'volcano' || newData.child('mapId').val() === 'forest' || newData.child('mapId').val() === 'coast') && ((newData.child('mapId').val() === 'village' && newData.child('x').val() <= 2880 && newData.child('y').val() <= 1800) || (newData.child('mapId').val() !== 'village' && newData.child('x').val() <= 4320 && newData.child('y').val() <= 3600)) && newData.child('dir').isString() && newData.child('name').isString() && newData.child('name').val().length <= 16 && newData.child('color').isString()"
          }
        }
      }
    }
  }
}
```

- [ ] **Step 6: 네트워크 테스트와 JSON 구문 검사를 통과시킨다**

Run: `node --test tests/network-state.test.mjs; Get-Content -Raw database.rules.json | ConvertFrom-Json | Out-Null`

Expected: tests pass and PowerShell exits 0.

- [ ] **Step 7: 지역 네트워크 상태를 커밋한다**

```powershell
git add src/network-state.js src/network.js database.rules.json tests/network-state.test.mjs
git commit -m "지역별 멀티플레이 동기화 추가"
```

### Task 5: 포탈 전환·카메라·부활 통합

**Files:**
- Create: `src/portal-transition.js`
- Create: `tests/portal-transition.test.mjs`
- Modify: `src/game.js`
- Modify: `src/player-combat.js`
- Modify: `tests/player-combat.test.mjs`

**Interfaces:**
- Consumes: `createWorldLayer`, `findActivePortal`, `getWorldDefinition`, `createEnemies`
- Produces: `createPortalTransition(portal): PortalTransition`
- Produces: `advancePortalTransition(state, dt): {state, shouldSwap, finished}`
- Produces in `PixelRPG`: `switchWorld(mapId, x, y): void`

- [ ] **Step 1: 전환 시점과 재사용 잠금 테스트를 작성한다**

```js
import test from "node:test";
import assert from "node:assert/strict";
import { advancePortalTransition, createPortalTransition } from "../src/portal-transition.js";

const portal = { destination: { mapId: "forest", x: 2160, y: 3260 } };

test("포탈 전환은 0.25초에 지역을 한 번 교체하고 0.5초에 끝난다", () => {
  let state = createPortalTransition(portal);
  let tick = advancePortalTransition(state, 0.2);
  assert.equal(tick.shouldSwap, false);
  tick = advancePortalTransition(tick.state, 0.06);
  assert.equal(tick.shouldSwap, true);
  tick = advancePortalTransition(tick.state, 0.3);
  assert.equal(tick.shouldSwap, false);
  assert.equal(tick.finished, true);
});

test("전환에는 목적지와 1초 재사용 잠금이 포함된다", () => {
  const state = createPortalTransition(portal);
  assert.deepEqual(state.destination, portal.destination);
  assert.equal(state.cooldownAfter, 1);
});
```

- [ ] **Step 2: 전환 모듈이 없어 실패하는 것을 확인한다**

Run: `node --test tests/portal-transition.test.mjs`

Expected: FAIL with `ERR_MODULE_NOT_FOUND`.

- [ ] **Step 3: 결정론적 포탈 전환 상태를 구현한다**

```js
export function createPortalTransition(portal) {
  return {
    elapsed: 0, swapped: false, duration: 0.5, swapAt: 0.25,
    cooldownAfter: 1, destination: { ...portal.destination },
  };
}

export function advancePortalTransition(state, dt) {
  const elapsed = Math.min(state.duration, state.elapsed + dt);
  const shouldSwap = !state.swapped && elapsed >= state.swapAt;
  const next = { ...state, elapsed, swapped: state.swapped || shouldSwap };
  return { state: next, shouldSwap, finished: elapsed >= state.duration };
}
```

- [ ] **Step 4: 부활 위치를 월드 시작점으로 주입하도록 변경한다**

`respawnPlayer(player, spawn = { x: 1440, y: 1110 })` 서명으로 바꾸고 위치 필드를 `spawn.x`, `spawn.y`에서 설정한다. 기존 인자 없는 호출의 결과가 변하지 않는 테스트와 `{x:10,y:20}` 주입 테스트를 추가한다.

- [ ] **Step 5: PixelRPG에 활성 지역 상태와 전환 루프를 연결한다**

생성자에서 `mapId = "village"`, `worldLayer = createWorldLayer(mapId)`, `portalTransition = null`, `portalCooldown = 0`을 설정한다. `enter`와 `leave`는 중앙 마을 시작 상태로 초기화한다.

`fixedUpdate`는 다음 순서를 사용한다.

```js
this.portalCooldown = Math.max(0, this.portalCooldown - dt);
this.updatePortalTransition(dt);
if (!this.portalTransition) {
  this.updateAttack(dt);
  this.enemies = updateEnemies(this.enemies, this.player, dt, this.isBlocked);
  if (this.player.respawnTimer <= 0) {
    this.applyEnemyContactDamage();
    this.updatePlayerMovement(dt);
    this.tryEnterPortal();
  }
}
this.updateCamera(dt);
this.network?.publish(this.player, this.mapId);
```

`tryEnterPortal`은 잠금이 0일 때만 `findActivePortal(this.mapId, player.x, player.y, PLAYER_RADIUS)`를 조회한다. 목적지가 없으면 `포탈이 불안정합니다.`를 표시하고 1초 잠금을 둔다. 목적지가 있으면 `createPortalTransition`을 설정하고 입력을 잠근다.

`switchWorld(mapId, x, y)`는 대상 좌표의 경계와 충돌을 검증한다. 성공하면 `mapId`, `worldLayer`, `enemies`, 플레이어 현재/이전 좌표, 카메라 현재/이전 좌표, 미니맵 기반 레이어와 지역명을 한 번에 갱신한다. 실패하면 중앙 마을 시작점으로 전환한다.

- [ ] **Step 6: 카메라와 미니맵을 현재 지역 크기로 변경한다**

`updateCamera`, `finishRespawn`, `drawMinimapBase`, `renderMinimap`에서 전역 크기 대신 `getWorldDefinition(this.mapId).width/height`를 사용한다. 원격 플레이어와 몬스터는 현재 지역 좌표만 그린다.

- [ ] **Step 7: 외부 지역 사망 시 중앙 마을에서 부활시킨다**

부활 완료 시 `switchWorld("village", village.spawn.x, village.spawn.y)`를 호출한 뒤 HP/MP를 복원하고 입력을 다시 허용한다. 중앙 마을에서는 `createEnemies("village")` 결과가 빈 배열인지 유지한다.

- [ ] **Step 8: 통합 관련 단위 테스트를 통과시킨다**

Run: `node --test tests/*.test.mjs`

Expected: all tests pass, including existing input, combat, FPS, damage and collision tests.

- [ ] **Step 9: 포탈과 게임 루프를 커밋한다**

```powershell
git add src/portal-transition.js src/game.js src/player-combat.js tests/portal-transition.test.mjs tests/player-combat.test.mjs
git commit -m "포탈 전환과 중앙 마을 부활 통합"
```

### Task 6: NPC·HUD 전환 표시·문서와 브라우저 회귀 검증

**Files:**
- Modify: `index.html`
- Modify: `styles.css`
- Modify: `src/main.js`
- Modify: `src/game.js`
- Modify: `README.md`
- Modify: `FIREBASE_SETUP.md`
- Create: `tests/static-ui.test.mjs`

**Interfaces:**
- Consumes: 활성 지역명과 포탈 전환 진행률
- Produces: `#portalTransitionOverlay`, `#portalDestination`

- [ ] **Step 1: 필수 UI와 기존 입장·퇴장 요소 회귀 테스트를 작성한다**

```js
import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("입장·퇴장 UI와 포탈 전환 UI가 함께 존재한다", async () => {
  const html = await readFile(new URL("../index.html", import.meta.url), "utf8");
  for (const id of [
    "entryOverlay", "nicknameForm", "exitOverlay", "exitButton",
    "portalTransitionOverlay", "portalDestination", "hud", "minimap",
  ]) {
    assert.match(html, new RegExp(`id=["']${id}["']`));
  }
});

test("문서가 10배 월드와 네 지역 조작을 설명한다", async () => {
  const readme = await readFile(new URL("../README.md", import.meta.url), "utf8");
  assert.match(readme, /10배/);
  assert.match(readme, /중앙 마을/);
  assert.match(readme, /활화산/);
  assert.match(readme, /태고의 숲/);
  assert.match(readme, /해안가/);
});
```

- [ ] **Step 2: 새 포탈 UI와 문서 설명이 없어 실패하는 것을 확인한다**

Run: `node --test tests/static-ui.test.mjs`

Expected: FAIL because `portalTransitionOverlay` and the 10배 world documentation are absent.

- [ ] **Step 3: 비상호작용 포탈 페이드 UI를 추가한다**

`#hud` 안에 다음 요소를 추가하고 `src/main.js`의 `elements`에 전달한다.

```html
<section id="portalTransitionOverlay" class="portal-transition-overlay" hidden>
  <div>
    <small>PORTAL TRAVEL</small>
    <strong id="portalDestination">중앙 마을</strong>
  </div>
</section>
```

```css
.portal-transition-overlay {
  position: absolute; inset: 0; z-index: 24; display: grid; place-items: center;
  pointer-events: none; background: rgba(3, 7, 18, .9);
  opacity: 0; transition: opacity .15s ease;
}
.portal-transition-overlay.active { opacity: 1; }
.portal-transition-overlay strong { display: block; margin-top: 6px; font-size: 28px; }
.portal-transition-overlay small { color: #c4b5fd; letter-spacing: .18em; }
```

`game.js`는 포탈 전환 시작 시 목적지 이름을 설정하고 overlay의 `hidden`을 해제한다. 완료 시 `active`를 제거한 뒤 숨긴다.

- [ ] **Step 4: 중앙 마을 NPC 표식과 지역별 안내를 그린다**

`world.js`의 마을 렌더링에 촌장 `(1440,520)`, 농부 `(760,1160)`, 상인 `(2200,1110)`, 대장장이 `(2440,1080)`의 픽셀 캐릭터와 이름표를 그린다. 지역 진입 메시지는 각각 `중앙 마을 안전지대입니다.`, `화산의 열기와 화염 슬라임을 조심하세요.`, `숲길의 몬스터를 조심하세요.`, `해안의 게와 물방울 슬라임을 조심하세요.`를 사용한다.

- [ ] **Step 5: README와 Firebase 안내를 갱신한다**

README에 현재/신규 면적 표, 네 지역, 포탈 자동 이동, 안전지대, 지역별 몬스터, 같은 지역 플레이어만 표시되는 동기화 규칙을 기록한다. FIREBASE_SETUP에는 `mapId` 필드와 새 보안 규칙 배포 필요성을 기록한다. 기존 닉네임·나가기·조작 설명은 유지한다.

- [ ] **Step 6: 전체 자동 검증을 실행한다**

Run:

```powershell
node --test tests/*.test.mjs
Get-ChildItem src -Filter *.js | ForEach-Object { node --check $_.FullName }
Get-Content -Raw database.rules.json | ConvertFrom-Json | Out-Null
```

Expected: all tests pass, every syntax check exits 0, database rules parse without error.

- [ ] **Step 7: 로컬 서버에서 브라우저 플레이테스트를 수행한다**

Run: `python -m http.server 4173`

브라우저에서 다음 상태를 각각 캡처한다.

1. 닉네임 입장 화면.
2. 중앙 마을의 광장·NPC·세 포탈과 몬스터 0마리 상태.
3. 활화산의 용암·열기 효과와 화염 슬라임.
4. 태고의 숲의 수목·연못과 숲 슬라임·멧돼지.
5. 해안가의 바다·부두와 게·물방울 슬라임.
6. 외부 지역 사망 후 중앙 마을 부활.
7. 나가기 확인과 입장 화면 복귀.

각 포탈 왕복, 1초 재사용 잠금, Ctrl/Q 공격, 미니맵, 창 크기 변경과 브라우저 콘솔 오류 여부를 확인한다.

- [ ] **Step 8: 문서와 UI를 커밋한다**

```powershell
git add index.html styles.css src/main.js src/game.js src/world.js README.md FIREBASE_SETUP.md tests/static-ui.test.mjs
git commit -m "10배 월드 UI와 안내 문서 완성"
```

### Task 7: 최종 회귀 검증과 작업 브랜치 게시

**Files:**
- Verify only: all tracked files

**Interfaces:**
- No new runtime interfaces.

- [ ] **Step 1: 작업 트리와 변경 범위를 점검한다**

Run: `git status --short; git diff main...HEAD --stat; git diff --check`

Expected: only planned game, test, documentation and design files are changed; `git diff --check` exits 0.

- [ ] **Step 2: 전체 테스트와 구문 검사를 새로 실행한다**

Run:

```powershell
node --test tests/*.test.mjs
Get-ChildItem src -Filter *.js | ForEach-Object { node --check $_.FullName }
Get-Content -Raw database.rules.json | ConvertFrom-Json | Out-Null
```

Expected: zero test failures, zero syntax failures, valid JSON.

- [ ] **Step 3: 브라우저 대표 화면과 콘솔을 다시 확인한다**

Run: `python -m http.server 4173`

Expected: 네 지역 진입, 안전지대, 몬스터, 부활, 닉네임 입장과 나가기가 동작하고 콘솔에 처리되지 않은 오류가 없다.

- [ ] **Step 4: 브랜치를 GitHub에 푸시한다**

Run: `git push -u origin feature/world-10x-portals`

Expected: remote branch advances to the verified local HEAD without force push.
