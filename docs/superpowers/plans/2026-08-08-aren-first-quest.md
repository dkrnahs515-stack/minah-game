# 현자 아렌 첫 퀘스트 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 현자 아렌과 대화해 슬라임 3마리 처치 퀘스트를 수락·보고하고 EXP 15를 닉네임별 브라우저 저장소에 보존한다.

**Architecture:** 퀘스트 전이, 저장, NPC 탐색, 대화 DOM을 각각 순수하거나 주입 가능한 모듈로 분리한다. `game.js`는 몬스터 처치 이벤트와 UI·저장 모듈을 조정하고 기존 전투·Firebase 흐름은 유지한다.

**Tech Stack:** 브라우저 ES modules, Canvas 2D, DOM, localStorage, Node.js `node:test`

## Global Constraints

- 새 중앙 초원, 골드, 아이템, 레벨업, Firebase 퀘스트 저장은 포함하지 않는다.
- `fire-slime`, `forest-slime`, `water-slime`만 처치 대상으로 인정한다.
- 퀘스트 완료 보상은 EXP 15이며 한 번만 지급한다.
- 진행 데이터는 `pixel-world.progress.v1:<nickname>` 키로 닉네임별 저장한다.
- 대화 중 이동·공격·포탈 진입을 차단하고 채팅 입력 중에는 대화를 열지 않는다.
- 기존 57개 테스트와 이동·전투·포탈·채팅·나가기 기능을 보존한다.

---

### Task 1: 퀘스트 상태 전이

**Files:**
- Create: `src/quest-state.js`
- Create: `tests/quest-state.test.mjs`

**Interfaces:**
- Produces: `createInitialProgress()`, `acceptAdventureQuest(progress)`, `recordAdventureKill(progress, enemyKind)`, `completeAdventureQuest(progress)`, `ADVENTURE_QUEST`
- State shape: `{ exp: number, quests: { adventureStart: { status: string, progress: number } } }`

- [ ] **Step 1: Write failing state tests**

```js
import {
  acceptAdventureQuest,
  completeAdventureQuest,
  createInitialProgress,
  recordAdventureKill,
} from "../src/quest-state.js";

test("퀘스트는 수락 후 승인된 슬라임 세 마리로 보고 가능 상태가 된다", () => {
  let state = acceptAdventureQuest(createInitialProgress());
  state = recordAdventureKill(state, "fire-slime");
  state = recordAdventureKill(state, "forest-slime");
  state = recordAdventureKill(state, "water-slime");
  assert.deepEqual(state.quests.adventureStart, {
    status: "ready_to_report",
    progress: 3,
  });
});

test("완료 보고는 EXP 15를 한 번만 지급한다", () => {
  let state = acceptAdventureQuest(createInitialProgress());
  for (const kind of ["fire-slime", "forest-slime", "water-slime"]) {
    state = recordAdventureKill(state, kind);
  }
  const first = completeAdventureQuest(state);
  const second = completeAdventureQuest(first.progress);
  assert.equal(first.rewardExp, 15);
  assert.equal(first.progress.exp, 15);
  assert.equal(second.rewardExp, 0);
  assert.equal(second.progress.exp, 15);
});
```

- [ ] **Step 2: Verify RED**

Run: `node --test tests/quest-state.test.mjs`
Expected: FAIL because `src/quest-state.js` does not exist.

- [ ] **Step 3: Implement immutable minimal state machine**

```js
export const ADVENTURE_QUEST = Object.freeze({
  id: "adventureStart",
  targetKinds: Object.freeze(["fire-slime", "forest-slime", "water-slime"]),
  required: 3,
  rewardExp: 15,
});
```

All transitions return new nested objects. Invalid transitions return an unchanged clone and never exceed progress 3.

- [ ] **Step 4: Verify GREEN and regression**

Run: `node --test tests/quest-state.test.mjs tests/enemies.test.mjs tests/combat.test.mjs`
Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/quest-state.js tests/quest-state.test.mjs
git commit -m "첫 퀘스트 상태 전이 추가"
```

### Task 2: 닉네임별 브라우저 저장

**Files:**
- Create: `src/progress-storage.js`
- Create: `tests/progress-storage.test.mjs`

**Interfaces:**
- Consumes: `createInitialProgress()`
- Produces: `progressStorageKey(nickname)`, `loadProgress(storage, nickname)`, `saveProgress(storage, nickname, progress)`
- Return contract: `saveProgress` returns `{ ok: boolean }` and never throws.

- [ ] **Step 1: Write failing storage tests**

```js
test("서로 다른 닉네임은 별도 진행 데이터를 사용한다", () => {
  const storage = memoryStorage();
  saveProgress(storage, "아렌", { ...createInitialProgress(), exp: 15 });
  assert.equal(loadProgress(storage, "아렌").exp, 15);
  assert.equal(loadProgress(storage, "다른 모험가").exp, 0);
});

test("손상되거나 유효하지 않은 저장 데이터는 기본값으로 복구된다", () => {
  const storage = memoryStorage();
  storage.setItem(progressStorageKey("아렌"), "{broken");
  assert.deepEqual(loadProgress(storage, "아렌"), createInitialProgress());
});
```

- [ ] **Step 2: Verify RED**

Run: `node --test tests/progress-storage.test.mjs`
Expected: FAIL because the storage module is missing.

- [ ] **Step 3: Implement validated versioned persistence**

Normalize whitespace in nickname, use URI encoding in the key, store `{ version: 1, ...progress }`, and validate EXP, status, and progress bounds during load.

- [ ] **Step 4: Verify GREEN**

Run: `node --test tests/progress-storage.test.mjs tests/quest-state.test.mjs`
Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/progress-storage.js tests/progress-storage.test.mjs
git commit -m "닉네임별 퀘스트 진행 저장 추가"
```

### Task 3: 현자 아렌 NPC 엔티티

**Files:**
- Create: `src/npc-data.js`
- Create: `src/npcs.js`
- Create: `tests/npcs.test.mjs`
- Modify: `src/world.js`

**Interfaces:**
- Produces: `getNpcsForWorld(mapId)`, `findNearbyNpc(npcs, player)`, `drawNpc(ctx, npc, cameraX, cameraY)`
- `findNearbyNpc` returns the nearest in-range NPC or `null`.

- [ ] **Step 1: Write failing NPC tests**

```js
test("아렌은 중앙 마을에만 배치된다", () => {
  assert.equal(getNpcsForWorld("village")[0].id, "aren");
  assert.deepEqual(getNpcsForWorld("forest"), []);
});

test("상호작용 범위 안의 가장 가까운 NPC만 찾는다", () => {
  const [aren] = getNpcsForWorld("village");
  assert.equal(findNearbyNpc([aren], { x: aren.x + 30, y: aren.y }).id, "aren");
  assert.equal(findNearbyNpc([aren], { x: aren.x + 100, y: aren.y }), null);
});
```

- [ ] **Step 2: Verify RED**

Run: `node --test tests/npcs.test.mjs`
Expected: FAIL because NPC modules are missing.

- [ ] **Step 3: Implement data, proximity, and canvas renderer**

Place Aren at `{ x: 1440, y: 520, interactionRadius: 80 }`. Remove only the old static `촌장` draw call from `drawVillage`; preserve farmer, merchant, and blacksmith drawings.

- [ ] **Step 4: Verify GREEN**

Run: `node --test tests/npcs.test.mjs tests/world.test.mjs`
Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/npc-data.js src/npcs.js src/world.js tests/npcs.test.mjs
git commit -m "상호작용 가능한 현자 아렌 추가"
```

### Task 4: 대화 상태와 DOM 컨트롤러

**Files:**
- Create: `src/aren-dialogue.js`
- Create: `src/dialogue-controller.js`
- Create: `tests/aren-dialogue.test.mjs`
- Create: `tests/dialogue-controller.test.mjs`

**Interfaces:**
- Consumes: adventure quest progress
- Produces: `arenDialogueModel(progress)`, `DialogueController`
- Dialogue model: `{ title, body, action: "accept" | "complete" | "close", actionLabel }`

- [ ] **Step 1: Write failing dialogue-model tests**

```js
test("아렌 대화는 퀘스트 상태에 맞는 행동을 제공한다", () => {
  assert.equal(arenDialogueModel(createInitialProgress()).action, "accept");
  const active = acceptAdventureQuest(createInitialProgress());
  assert.match(arenDialogueModel(active).body, /0\/3/);
});
```

- [ ] **Step 2: Verify RED**

Run: `node --test tests/aren-dialogue.test.mjs tests/dialogue-controller.test.mjs`
Expected: FAIL because dialogue modules are missing.

- [ ] **Step 3: Implement model and injected DOM controller**

`DialogueController.open(model)` fills text, binds one action callback supplied in the constructor, and removes `hidden`. `close()` hides the overlay. Repeated opens must not accumulate event listeners.

- [ ] **Step 4: Verify GREEN**

Run: `node --test tests/aren-dialogue.test.mjs tests/dialogue-controller.test.mjs`
Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/aren-dialogue.js src/dialogue-controller.js tests/aren-dialogue.test.mjs tests/dialogue-controller.test.mjs
git commit -m "아렌 퀘스트 대화 흐름 추가"
```

### Task 5: 게임·HUD·README 통합

**Files:**
- Modify: `index.html`
- Modify: `styles.css`
- Modify: `src/main.js`
- Modify: `src/game.js`
- Modify: `README.md`
- Create: `tests/quest-ui-smoke.cjs`

**Interfaces:**
- Consumes: quest, persistence, NPC, and dialogue modules from Tasks 1–4
- Game methods: `openNpcDialogue()`, `handleDialogueAction(action)`, `recordQuestKill(enemyKind)`, `persistProgress()`, `updateQuestHud()`

- [ ] **Step 1: Write failing static UI smoke test**

```js
test("첫 퀘스트 UI와 F 조작 안내가 연결된다", () => {
  const html = readFileSync(new URL("../index.html", import.meta.url), "utf8");
  const game = readFileSync(new URL("../src/game.js", import.meta.url), "utf8");
  assert.match(html, /id="dialogueOverlay"/);
  assert.match(html, /id="questTracker"/);
  assert.match(html, /id="expText"/);
  assert.match(html, /<kbd>F<\/kbd>/);
  assert.match(game, /recordQuestKill/);
});
```

- [ ] **Step 2: Verify RED**

Run: `node --test tests/quest-ui-smoke.cjs`
Expected: FAIL because the UI IDs and integration do not exist.

- [ ] **Step 3: Add UI markup and styling**

Add a modal dialogue overlay, one primary action button, close button, NPC proximity prompt, quest tracker, and EXP line. Preserve responsive chat, minimap, controls, and hotbar layout.

- [ ] **Step 4: Integrate game behavior**

Load progress after nickname normalization in `enter`. Bind `KeyF` before empty-slot handling. Render Aren in depth order, update the prompt only in village, forward successful kills from `applyAttackHits`, save after state changes, and update HUD. Dialogue open state must block movement, attack, portal, and chat opening.

- [ ] **Step 5: Update README**

Document `F` interaction, “모험의 시작” flow, EXP 15 reward, nickname-specific browser save, and the fact that all three current slime species count.

- [ ] **Step 6: Verify focused and full suite**

Run: `node --test tests/quest-ui-smoke.cjs tests/*.test.mjs`
Expected: all tests pass with no warnings.

Run: `for file in src/*.js; do node --check "$file"; done`
Expected: exit 0 for every source file.

- [ ] **Step 7: Browser smoke test**

Serve the repository, enter a nickname, walk to Aren, press `F`, accept the quest, defeat three approved slimes, return and report, verify EXP 15, reload with the same nickname, then verify completed state and EXP restore. Confirm a different nickname starts at EXP 0.

- [ ] **Step 8: Commit**

```bash
git add index.html styles.css src/main.js src/game.js README.md tests/quest-ui-smoke.cjs
git commit -m "아렌 첫 퀘스트 게임 흐름 완성"
```

### Task 6: Final verification and GitHub handoff

**Files:**
- Modify only if verification reveals a tested defect.

**Interfaces:**
- Produces: verified feature branch and Draft PR against `main`.

- [ ] **Step 1: Run fresh full verification**

Run: `node --test tests/*.test.mjs`
Expected: zero failures.

Run: `git diff --check main...HEAD`
Expected: no output and exit 0.

- [ ] **Step 2: Review scope**

Run: `git status --short --branch && git log --oneline main..HEAD && git diff --stat main...HEAD`
Expected: only the approved spec, plan, quest feature, tests, and README changes.

- [ ] **Step 3: Push and create Draft PR**

Push `agent/aren-first-quest`, then create a Draft PR targeting `main` with implementation summary, save behavior, and exact verification counts.
