# Experience, Gold, and Save v2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add level progression, repeatable slime EXP and Gold rewards, level-based HP/MP growth, completed quest history, and backward-compatible nickname-scoped localStorage v2 saves.

**Architecture:** A new pure `player-progression.js` module owns reward, level, Gold roll, and derived-stat calculations. Existing quest state applies quest rewards idempotently, storage validates and migrates v1 data into a new v2 key, and `PixelRPG` coordinates enemy-death rewards, level-up recovery, HUD updates, and immediate persistence.

**Tech Stack:** Browser ES modules, HTML Canvas, DOM/CSS HUD, browser localStorage, Node.js built-in test runner (`node --test`), CommonJS static smoke tests.

## Global Constraints

- Start at level `1`.
- `nextLevelExp` must always equal `level * 100`.
- Carry excess EXP forward and allow multiple level-ups from one reward.
- Every slime death grants exactly `3 EXP` and a random integer from `1` through `3 Gold`.
- First quest completion grants exactly `15 EXP` and `30 Gold` once.
- Each level adds `10` maximum HP and `5` maximum MP.
- Any level-up fully restores current HP and MP to their new maxima.
- Store progress under `pixel-world.progress.v2:<normalized encoded nickname>`.
- Preserve valid v1 quest state and EXP during automatic migration; retain the v1 key.
- Do not add Firebase progress storage, shops, attack growth, equipment, or non-slime reward tables.

---

## File Map

- Create `src/player-progression.js`: pure progression rules, rewards, Gold roll, and level-derived stats.
- Create `tests/player-progression.test.mjs`: unit coverage for EXP carry, multiple levels, Gold bounds, and stats.
- Modify `src/quest-state.js`: initialize v2 progress fields and award the first quest reward once.
- Modify `tests/quest-state.test.mjs`: verify quest EXP, Gold, level result, and completed quest idempotency.
- Modify `src/progress-storage.js`: v2 validation, v1 validation, migration, and v2 persistence.
- Modify `tests/progress-storage.test.mjs`: verify v2 keys, migration, fallback, validation, and nickname separation.
- Modify `src/game.js`: apply enemy rewards, level-up recovery, dynamic subtitle, and HUD refresh.
- Modify `src/main.js`: bind new level, EXP bar, and Gold elements.
- Modify `index.html`: add level-aware EXP and Gold HUD elements.
- Modify `styles.css`: style the EXP bar and Gold row without expanding over the playfield.
- Modify `tests/quest-ui-smoke.cjs`: verify the new HUD and game wiring statically.
- Modify `tests/player-combat.test.mjs`: verify respawn continues using dynamic maxima.

---

### Task 1: Pure Player Progression Rules

**Files:**
- Create: `src/player-progression.js`
- Create: `tests/player-progression.test.mjs`

**Interfaces:**
- Consumes: a progress record containing `level`, `exp`, `nextLevelExp`, and `gold`; optional random function returning a number in `[0, 1]`.
- Produces: `nextLevelExp(level)`, `statsForLevel(level)`, `grantProgressReward(progress, reward)`, `rollSlimeGold(random)`, and `grantSlimeReward(progress, random)`.

- [ ] **Step 1: Write failing progression tests**

```js
import test from "node:test";
import assert from "node:assert/strict";
import {
  grantProgressReward,
  grantSlimeReward,
  nextLevelExp,
  rollSlimeGold,
  statsForLevel,
} from "../src/player-progression.js";

const base = () => ({ level: 1, exp: 0, nextLevelExp: 100, gold: 0 });

test("다음 레벨 필요 EXP는 현재 레벨의 100배다", () => {
  assert.equal(nextLevelExp(1), 100);
  assert.equal(nextLevelExp(3), 300);
});

test("초과 EXP는 이월되고 한 보상으로 여러 번 레벨업한다", () => {
  const result = grantProgressReward(
    { ...base(), exp: 90 },
    { exp: 320, gold: 7 },
  );
  assert.deepEqual(result.progress, {
    level: 3,
    exp: 110,
    nextLevelExp: 300,
    gold: 7,
  });
  assert.equal(result.levelsGained, 2);
});

test("슬라임 Gold는 1부터 3까지이며 처치 EXP는 3이다", () => {
  assert.equal(rollSlimeGold(() => 0), 1);
  assert.equal(rollSlimeGold(() => 0.5), 2);
  assert.equal(rollSlimeGold(() => 0.999999), 3);
  const result = grantSlimeReward(base(), () => 0.5);
  assert.equal(result.rewardExp, 3);
  assert.equal(result.rewardGold, 2);
  assert.equal(result.progress.exp, 3);
  assert.equal(result.progress.gold, 2);
});

test("레벨별 최대 HP와 MP를 계산한다", () => {
  assert.deepEqual(statsForLevel(1), { maxHp: 100, maxMp: 100 });
  assert.deepEqual(statsForLevel(4), { maxHp: 130, maxMp: 115 });
});
```

- [ ] **Step 2: Run the test and verify RED**

Run: `node --test tests/player-progression.test.mjs`

Expected: FAIL because `src/player-progression.js` does not exist.

- [ ] **Step 3: Implement the minimal pure progression module**

```js
export const PROGRESSION_RULES = Object.freeze({
  slimeExp: 3,
  slimeGoldMin: 1,
  slimeGoldMax: 3,
  baseMaxHp: 100,
  baseMaxMp: 100,
  maxHpPerLevel: 10,
  maxMpPerLevel: 5,
});

export function nextLevelExp(level) {
  return level * 100;
}

export function statsForLevel(level) {
  return {
    maxHp: PROGRESSION_RULES.baseMaxHp + (level - 1) * PROGRESSION_RULES.maxHpPerLevel,
    maxMp: PROGRESSION_RULES.baseMaxMp + (level - 1) * PROGRESSION_RULES.maxMpPerLevel,
  };
}

export function grantProgressReward(progress, { exp = 0, gold = 0 } = {}) {
  const next = { ...progress, exp: progress.exp + exp, gold: progress.gold + gold };
  let levelsGained = 0;
  while (next.exp >= next.nextLevelExp) {
    next.exp -= next.nextLevelExp;
    next.level += 1;
    next.nextLevelExp = nextLevelExp(next.level);
    levelsGained += 1;
  }
  return { progress: next, levelsGained };
}

export function rollSlimeGold(random = Math.random) {
  const sample = Math.min(0.9999999999999999, Math.max(0, random()));
  return PROGRESSION_RULES.slimeGoldMin + Math.floor(sample * 3);
}

export function grantSlimeReward(progress, random = Math.random) {
  const rewardGold = rollSlimeGold(random);
  const result = grantProgressReward(progress, {
    exp: PROGRESSION_RULES.slimeExp,
    gold: rewardGold,
  });
  return { ...result, rewardExp: PROGRESSION_RULES.slimeExp, rewardGold };
}
```

- [ ] **Step 4: Run the focused test and verify GREEN**

Run: `node --test tests/player-progression.test.mjs`

Expected: 4 tests pass, 0 fail.

- [ ] **Step 5: Commit the pure progression task**

```bash
git add src/player-progression.js tests/player-progression.test.mjs
git commit -m "플레이어 경험치와 골드 성장 규칙 추가"
```

---

### Task 2: Quest Reward and Completed Quest History

**Files:**
- Modify: `src/quest-state.js`
- Modify: `tests/quest-state.test.mjs`

**Interfaces:**
- Consumes: `grantProgressReward(progress, { exp, gold })` from Task 1.
- Produces: `createInitialProgress()` with all v2 fields and `completeAdventureQuest(progress)` returning `{ progress, rewardExp, rewardGold, levelsGained }`.

- [ ] **Step 1: Replace the old completion test with failing v2 assertions**

```js
test("완료 보고는 EXP 15와 Gold 30을 한 번만 지급하고 완료 목록에 기록한다", () => {
  let state = acceptAdventureQuest(createInitialProgress());
  for (const kind of ["fire-slime", "forest-slime", "water-slime"]) {
    state = recordAdventureKill(state, kind);
  }
  const first = completeAdventureQuest(state);
  const second = completeAdventureQuest(first.progress);

  assert.equal(first.rewardExp, 15);
  assert.equal(first.rewardGold, 30);
  assert.equal(first.progress.exp, 15);
  assert.equal(first.progress.gold, 30);
  assert.deepEqual(first.progress.completedQuests, ["adventureStart"]);
  assert.equal(second.rewardExp, 0);
  assert.equal(second.rewardGold, 0);
  assert.equal(second.progress.gold, 30);
  assert.deepEqual(second.progress.completedQuests, ["adventureStart"]);
});
```

Also update the invalid-transition expected progress to include:

```js
{
  level: 1,
  exp: 0,
  nextLevelExp: 100,
  gold: 0,
  completedQuests: [],
  quests: { adventureStart: { status: "completed", progress: 3 } },
}
```

- [ ] **Step 2: Run quest tests and verify RED**

Run: `node --test tests/quest-state.test.mjs`

Expected: FAIL because initial progress has no v2 fields and quest completion has no Gold or completed quest history.

- [ ] **Step 3: Extend initial progress and complete the quest through the progression module**

```js
import { grantProgressReward } from "./player-progression.js";

export const ADVENTURE_QUEST = Object.freeze({
  id: "adventureStart",
  targetKinds: Object.freeze(["fire-slime", "forest-slime", "water-slime"]),
  required: 3,
  rewardExp: 15,
  rewardGold: 30,
});

export function createInitialProgress() {
  return {
    level: 1,
    exp: 0,
    nextLevelExp: 100,
    gold: 0,
    completedQuests: [],
    quests: {
      [ADVENTURE_QUEST.id]: { status: "available", progress: 0 },
    },
  };
}
```

In `cloneProgress`, also clone `completedQuests`. In `completeAdventureQuest`, return zeroed rewards outside `ready_to_report`; otherwise append the quest ID only when absent, call `grantProgressReward`, and return its `levelsGained` with the fixed quest rewards.

```js
const rewarded = grantProgressReward(next, {
  exp: ADVENTURE_QUEST.rewardExp,
  gold: ADVENTURE_QUEST.rewardGold,
});
return {
  progress: rewarded.progress,
  rewardExp: ADVENTURE_QUEST.rewardExp,
  rewardGold: ADVENTURE_QUEST.rewardGold,
  levelsGained: rewarded.levelsGained,
};
```

- [ ] **Step 4: Run focused progression and quest tests**

Run: `node --test tests/player-progression.test.mjs tests/quest-state.test.mjs`

Expected: all focused tests pass with 0 failures.

- [ ] **Step 5: Commit quest progression integration**

```bash
git add src/quest-state.js tests/quest-state.test.mjs
git commit -m "첫 퀘스트 경험치와 골드 보상 확장"
```

---

### Task 3: localStorage v2 Validation and v1 Migration

**Files:**
- Modify: `src/progress-storage.js`
- Modify: `tests/progress-storage.test.mjs`

**Interfaces:**
- Consumes: `createInitialProgress()`, `ADVENTURE_QUEST`, `nextLevelExp(level)`, and `grantProgressReward(progress, reward)`.
- Produces: `progressStorageKey(nickname)` for v2, `legacyProgressStorageKey(nickname)` for v1, `loadProgress(storage, nickname)`, and `saveProgress(storage, nickname, progress)`.

- [ ] **Step 1: Write failing v2 key, round-trip, migration, fallback, and validation tests**

```js
import {
  legacyProgressStorageKey,
  loadProgress,
  progressStorageKey,
  saveProgress,
} from "../src/progress-storage.js";

test("v2 키를 사용하고 닉네임 공백을 정규화한다", () => {
  assert.equal(
    progressStorageKey("  아렌   모험가  "),
    "pixel-world.progress.v2:%EC%95%84%EB%A0%8C%20%EB%AA%A8%ED%97%98%EA%B0%80",
  );
});

test("정상 v1 진행을 v2로 이전하고 원본은 유지한다", () => {
  const storage = memoryStorage();
  const oldValue = {
    version: 1,
    exp: 15,
    quests: { adventureStart: { status: "completed", progress: 3 } },
  };
  storage.setItem(legacyProgressStorageKey("아렌"), JSON.stringify(oldValue));

  const migrated = loadProgress(storage, "아렌");
  assert.deepEqual(migrated, {
    level: 1,
    exp: 15,
    nextLevelExp: 100,
    gold: 0,
    completedQuests: ["adventureStart"],
    quests: { adventureStart: { status: "completed", progress: 3 } },
  });
  assert.deepEqual(JSON.parse(storage.getItem(progressStorageKey("아렌"))), {
    version: 2,
    ...migrated,
  });
  assert.deepEqual(JSON.parse(storage.getItem(legacyProgressStorageKey("아렌"))), oldValue);
});

test("손상된 v2가 있으면 정상 v1에서 복구한다", () => {
  const storage = memoryStorage();
  storage.setItem(progressStorageKey("아렌"), "{broken");
  storage.setItem(legacyProgressStorageKey("아렌"), JSON.stringify({
    version: 1,
    exp: 0,
    quests: { adventureStart: { status: "active", progress: 1 } },
  }));
  assert.equal(loadProgress(storage, "아렌").quests.adventureStart.progress, 1);
});
```

Add a table-driven invalid-v2 test covering level `0`, negative EXP, `exp >= nextLevelExp`, mismatched `nextLevelExp`, negative Gold, duplicate completed IDs, unknown completed IDs, and unreachable quest state/progress combinations. Assert each falls back to `createInitialProgress()` when no legacy value exists.

- [ ] **Step 2: Run storage tests and verify RED**

Run: `node --test tests/progress-storage.test.mjs`

Expected: FAIL because the current module still writes v1 and exports no legacy-key function or migration.

- [ ] **Step 3: Implement v2 storage and legacy conversion**

Define explicit constants and key helpers:

```js
const STORAGE_VERSION = 2;
const STORAGE_PREFIX = "pixel-world.progress.v2:";
const LEGACY_STORAGE_PREFIX = "pixel-world.progress.v1:";

export function progressStorageKey(nickname) {
  return `${STORAGE_PREFIX}${encodeURIComponent(normalizeNickname(nickname))}`;
}

export function legacyProgressStorageKey(nickname) {
  return `${LEGACY_STORAGE_PREFIX}${encodeURIComponent(normalizeNickname(nickname))}`;
}
```

`isValidProgress` must require safe integers, `level >= 1`, `nextLevelExp === nextLevelExp(level)`, `0 <= exp < nextLevelExp`, `gold >= 0`, a duplicate-free `completedQuests` containing only `adventureStart`, and the existing reachable quest-state rules. It must also require the completed list and quest status to agree.

Legacy v1 validation must require a safe integer EXP in `0..99`. The only production v1 rewards are `0` and `15`; rejecting larger manipulated values prevents an untrusted localStorage value from triggering an excessive migration loop.

Implement migration by starting from the v2 initial shape, applying the legacy EXP through `grantProgressReward`, copying the legacy quest, and deriving `completedQuests` from `status === "completed"`.

```js
function migrateLegacyProgress(legacy) {
  const initial = createInitialProgress();
  const rewarded = grantProgressReward(initial, { exp: legacy.exp, gold: 0 });
  const quest = legacy.quests[ADVENTURE_QUEST.id];
  return {
    ...rewarded.progress,
    completedQuests: quest.status === "completed" ? [ADVENTURE_QUEST.id] : [],
    quests: { [ADVENTURE_QUEST.id]: { ...quest } },
  };
}
```

`loadProgress` must try valid v2 first, then valid v1, save the migrated result to v2 on a best-effort basis, and finally return initial progress. `saveProgress` writes only `{ version: 2, ...progress }` and retains its `{ ok: boolean }` contract.

- [ ] **Step 4: Run focused storage, quest, and progression tests**

Run: `node --test tests/player-progression.test.mjs tests/quest-state.test.mjs tests/progress-storage.test.mjs`

Expected: all focused tests pass with 0 failures.

- [ ] **Step 5: Commit storage migration**

```bash
git add src/progress-storage.js tests/progress-storage.test.mjs
git commit -m "브라우저 진행 저장 v2와 v1 이전 추가"
```

---

### Task 4: Dynamic Level Stats and Enemy Reward Wiring

**Files:**
- Modify: `src/game.js`
- Modify: `tests/player-combat.test.mjs`
- Modify: `tests/quest-ui-smoke.cjs`

**Interfaces:**
- Consumes: `grantSlimeReward(progress, random)`, `statsForLevel(level)`, and quest completion results with `levelsGained`.
- Produces: `PixelRPG.applyProgressionStats(restore)` and `PixelRPG.recordEnemyKill(enemyKind)` behavior.

- [ ] **Step 1: Write failing static wiring and dynamic respawn tests**

Extend `tests/quest-ui-smoke.cjs`:

```js
test("적 처치 보상과 레벨 능력치가 게임에 연결된다", () => {
  const game = readFileSync(path.join(__dirname, "../src/game.js"), "utf8");
  assert.match(game, /grantSlimeReward/);
  assert.match(game, /statsForLevel/);
  assert.match(game, /recordEnemyKill/);
  assert.match(game, /LEVEL UP!/);
});
```

Extend `tests/player-combat.test.mjs` with a dynamic maximum regression:

```js
test("부활은 레벨에서 갱신된 최대 HP와 MP까지 회복한다", () => {
  const player = {
    x: 0, y: 0, prevX: 0, prevY: 0,
    hp: 0, maxHp: 120, mp: 1, maxMp: 110,
    invulnerable: 1, hitFlash: 1, respawnTimer: 1,
  };
  respawnPlayer(player, { x: 4, y: 5 });
  assert.equal(player.hp, 120);
  assert.equal(player.mp, 110);
});
```

- [ ] **Step 2: Run focused tests and verify RED**

Run: `node --test tests/player-combat.test.mjs tests/quest-ui-smoke.cjs`

Expected: the dynamic respawn regression passes, while the static game wiring test fails because reward functions and `recordEnemyKill` are absent.

- [ ] **Step 3: Wire progression into `PixelRPG`**

Import the progression functions:

```js
import { grantSlimeReward, statsForLevel } from "./player-progression.js";
```

Add a method that always updates maxima and only restores on entry/reset or a level-up:

```js
applyProgressionStats(restore = false) {
  const { maxHp, maxMp } = statsForLevel(this.progress.level);
  this.player.maxHp = maxHp;
  this.player.maxMp = maxMp;
  if (restore) {
    this.player.hp = maxHp;
    this.player.mp = maxMp;
  } else {
    this.player.hp = Math.min(this.player.hp, maxHp);
    this.player.mp = Math.min(this.player.mp, maxMp);
  }
}
```

After `loadProgress`, call `applyProgressionStats(true)` before `resetCombatState`. Replace the killed-enemy call with `recordEnemyKill(enemy.kind)`. `recordEnemyKill` must update quest progress first, grant slime rewards only for `ADVENTURE_QUEST.targetKinds`, restore stats when `levelsGained > 0`, refresh HUD, notify with the exact reward text, and persist once after the combined state change.

For quest completion, consume `result.levelsGained`, restore stats on level-up, use `퀘스트 완료! EXP 15 · Gold 30을 획득했습니다.`, refresh all progression HUD values, and persist once.

Update `updateBiome` so a level change refreshes the subtitle even when the biome does not change:

```js
const level = String(this.progress.level);
if (subtitle.dataset.biome !== biome || subtitle.dataset.level !== level) {
  subtitle.dataset.biome = biome;
  subtitle.dataset.level = level;
  subtitle.textContent = `LV. ${level} · ${biome}`;
}
```

When a level is gained, the final notification is:

```js
`LEVEL UP! LV.${this.progress.level} · HP와 MP가 회복되었습니다.`
```

- [ ] **Step 4: Run game-adjacent tests and the full unit suite**

Run: `node --test tests/player-progression.test.mjs tests/quest-state.test.mjs tests/progress-storage.test.mjs tests/player-combat.test.mjs tests/quest-ui-smoke.cjs`

Expected: all selected tests pass with 0 failures.

- [ ] **Step 5: Commit game orchestration**

```bash
git add src/game.js tests/player-combat.test.mjs tests/quest-ui-smoke.cjs
git commit -m "슬라임 보상과 레벨 능력치 게임 연결"
```

---

### Task 5: Level, EXP Bar, and Gold HUD

**Files:**
- Modify: `index.html`
- Modify: `styles.css`
- Modify: `src/main.js`
- Modify: `src/game.js`
- Modify: `tests/quest-ui-smoke.cjs`

**Interfaces:**
- Consumes: `progress.level`, `progress.exp`, `progress.nextLevelExp`, and `progress.gold`.
- Produces: DOM elements `#expText`, `#expBar`, and `#goldText`; `updateProgressHud()` updates their text and bar scale.

- [ ] **Step 1: Write failing HUD structure assertions**

```js
test("HUD는 레벨 진행 EXP 막대와 Gold를 표시한다", () => {
  const html = readFileSync(path.join(__dirname, "../index.html"), "utf8");
  const main = readFileSync(path.join(__dirname, "../src/main.js"), "utf8");
  const css = readFileSync(path.join(__dirname, "../styles.css"), "utf8");

  assert.match(html, /id="expText">0 \/ 100/);
  assert.match(html, /id="expBar"/);
  assert.match(html, /id="goldText">0 G/);
  assert.match(main, /expBar:\s*document\.querySelector\("#expBar"\)/);
  assert.match(main, /goldText:\s*document\.querySelector\("#goldText"\)/);
  assert.match(css, /\.bar\.exp/);
});
```

- [ ] **Step 2: Run the HUD smoke test and verify RED**

Run: `node --test tests/quest-ui-smoke.cjs`

Expected: FAIL because EXP bar and Gold elements do not exist.

- [ ] **Step 3: Add HUD markup, bindings, styles, and updates**

Replace the current accumulated EXP line with:

```html
<div class="exp-line"><span>EXP</span><b id="expText">0 / 100</b></div>
<div class="bar exp"><i id="expBar"></i></div>
<div class="gold-line"><span>GOLD</span><b id="goldText">0 G</b></div>
```

Bind `expBar` and `goldText` in `src/main.js`. Add `.bar.exp`, `.bar.exp i`, and `.gold-line` rules that reuse the existing compact player-panel spacing and do not change panel positioning.

In `src/game.js`, make the progression HUD update atomic:

```js
updateProgressHud() {
  this.ui.expText.textContent = `${this.progress.exp} / ${this.progress.nextLevelExp}`;
  this.ui.expBar.style.transform = `scaleX(${this.progress.exp / this.progress.nextLevelExp})`;
  this.ui.goldText.textContent = `${this.progress.gold} G`;
}
```

Call `updateProgressHud()` from quest/progression initialization and every reward path. Change completed quest text to `완료 · EXP 15 · Gold 30 획득`.

- [ ] **Step 4: Run HUD and focused progression tests**

Run: `node --test tests/quest-ui-smoke.cjs tests/player-progression.test.mjs tests/quest-state.test.mjs`

Expected: all selected tests pass with 0 failures.

- [ ] **Step 5: Commit the HUD**

```bash
git add index.html styles.css src/main.js src/game.js tests/quest-ui-smoke.cjs
git commit -m "레벨 경험치와 골드 HUD 추가"
```

---

### Task 6: Full Regression and Browser Playtest

**Files:**
- Modify only if a failing test reveals a defect in files already listed above.

**Interfaces:**
- Consumes: all completed tasks.
- Produces: a verified branch ready for review and publication.

- [ ] **Step 1: Run syntax checks**

```bash
node --check src/player-progression.js
node --check src/quest-state.js
node --check src/progress-storage.js
node --check src/game.js
node --check src/main.js
```

Expected: every command exits `0` without output.

- [ ] **Step 2: Run the complete automated suite**

Run: `node --test tests/*.test.mjs tests/*.cjs`

Expected: all tests pass, with `fail 0`, `cancelled 0`, and `skipped 0`.

- [ ] **Step 3: Check patch integrity**

```bash
git diff origin/main...HEAD --check
git status --short
```

Expected: no whitespace errors; only intentional feature files or a clean worktree after commits.

- [ ] **Step 4: Run the browser smoke test against a local static server**

Start: `python3 -m http.server 4173`

Open: `http://127.0.0.1:4173/`

Verify through normal UI interaction:

1. Enter with a unique nickname.
2. Confirm `LV. 1`, `EXP 0 / 100`, and `0 G`.
3. Accept Aren's first quest.
4. Kill one slime and confirm `EXP 3 / 100`, Gold in `1..3`, and the exact reward notification.
5. Complete three kills and report to Aren; confirm totals `EXP 24 / 100` and Gold in `33..39`.
6. Leave and re-enter with the same nickname; confirm level, EXP, Gold, and completed quest restore.

Level-up carry, `LV. 2`, `EXP 2 / 200`, max HP `110`, max MP `105`, and full recovery are covered by the deterministic progression and combat tests because the first quest alone intentionally does not reach level 2.

- [ ] **Step 5: Commit any verification-only correction**

If Step 1-4 requires a correction, write a failing regression test first, implement only that correction, rerun the complete suite, then commit the exact changed files:

```bash
git add src/player-progression.js src/quest-state.js src/progress-storage.js src/game.js src/main.js index.html styles.css tests/player-progression.test.mjs tests/quest-state.test.mjs tests/progress-storage.test.mjs tests/player-combat.test.mjs tests/quest-ui-smoke.cjs
git commit -m "경험치 골드 저장 통합 검증 보완"
```

If no correction is required, do not create an empty commit.

---

## Completion Criteria

- All v2 fields load, validate, mutate, display, and persist by normalized nickname.
- Existing valid v1 progress migrates without deleting the v1 value.
- Slime rewards and quest completion rewards are issued exactly once per event.
- EXP carry and multi-level progression use the current level's threshold.
- Level-derived HP/MP maxima and full level-up recovery work with respawn.
- The full automated test suite has zero failures.
- Browser playtest confirms the first quest reward totals and same-nickname restoration.
