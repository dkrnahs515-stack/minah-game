import test from "node:test";
import assert from "node:assert/strict";
import { PixelRPG } from "../src/game.js";
import { legacyProgressStorageKey } from "../src/progress-storage.js";
import { acceptAdventureQuest, createInitialProgress } from "../src/quest-state.js";

function fakeNode() {
  return {
    textContent: "",
    style: {},
    dataset: {},
    classList: { add() {}, toggle() {} },
  };
}

function messageNode(notifications) {
  const node = fakeNode();
  Object.defineProperty(node, "textContent", {
    get() { return notifications.at(-1) ?? ""; },
    set(value) { notifications.push(value); },
  });
  return node;
}

function memoryStorage(onWrite = () => {}) {
  const values = new Map();
  const writes = [];
  return {
    writes,
    getItem(key) {
      return values.has(key) ? values.get(key) : null;
    },
    setItem(key, value) {
      values.set(key, String(value));
      writes.push({ key, value: JSON.parse(value) });
      onWrite(writes.at(-1));
    },
  };
}

function enemy(kind, x, hp = 1) {
  return {
    kind,
    x,
    y: 0,
    hp,
    maxHp: hp,
    state: "idle",
    moving: false,
    hitFlash: 0,
    shake: 0,
    deathTime: 0,
    knockbackX: 0,
    knockbackY: 0,
  };
}

function gameHarness({ progress = acceptAdventureQuest(createInitialProgress()), onWrite } = {}) {
  const notifications = [];
  const storage = memoryStorage(onWrite);
  const game = Object.create(PixelRPG.prototype);
  game.mapId = "volcano";
  game.player = {
    name: "테스터",
    x: 0,
    y: 0,
    dir: "right",
    hp: 70,
    maxHp: 100,
    mp: 60,
    maxMp: 100,
    respawnTimer: 0,
  };
  game.progress = progress;
  game.enemies = [];
  game.damageNumbers = [];
  game.strongCooldown = 0;
  game.messageTimer = 0;
  game.ui = {
    questProgress: fakeNode(),
    expText: fakeNode(),
    expBar: fakeNode(),
    goldText: fakeNode(),
    hpText: fakeNode(),
    mpText: fakeNode(),
    hpBar: fakeNode(),
    mpBar: fakeNode(),
    strongSlot: fakeNode(),
    strongCooldown: fakeNode(),
    playerSubtitle: fakeNode(),
    message: messageNode(notifications),
  };
  globalThis.localStorage = storage;
  return { game, notifications, storage };
}

const lethalAttack = Object.freeze({
  damage: 1,
  range: 100,
  arcDegrees: 180,
  knockback: 0,
});

async function withMinimumGold(run) {
  const originalRandom = Math.random;
  Math.random = () => 0;
  try {
    await run();
  } finally {
    Math.random = originalRandom;
    delete globalThis.localStorage;
  }
}

test("non-slime deaths receive no progression reward or persistence", async () => {
  await withMinimumGold(() => {
    const { game, notifications, storage } = gameHarness();
    game.enemies = [enemy("boar", 30)];

    game.applyAttackHits(lethalAttack);

    assert.equal(game.enemies[0].state, "dying");
    assert.equal(game.progress.exp, 0);
    assert.equal(game.progress.gold, 0);
    assert.equal(game.progress.quests.adventureStart.progress, 0);
    assert.equal(storage.writes.length, 0);
    assert.deepEqual(notifications, []);
  });
});

test("a dying slime rewards once and persists quest plus progression together", async () => {
  await withMinimumGold(() => {
    const { game, storage } = gameHarness();
    game.enemies = [enemy("fire-slime", 30)];

    game.applyAttackHits(lethalAttack);
    game.applyAttackHits(lethalAttack);

    assert.equal(game.progress.exp, 3);
    assert.equal(game.progress.gold, 1);
    assert.equal(game.progress.quests.adventureStart.progress, 1);
    assert.equal(storage.writes.length, 1);
    assert.equal(storage.writes[0].value.exp, 3);
    assert.equal(storage.writes[0].value.gold, 1);
    assert.equal(storage.writes[0].value.quests.adventureStart.progress, 1);
  });
});

test("a level-crossing kill restores stats and refreshes HUD before saving", async () => {
  await withMinimumGold(() => {
    let game;
    const harness = gameHarness({
      progress: { ...acceptAdventureQuest(createInitialProgress()), exp: 99 },
      onWrite() {
        assert.equal(game.ui.expText.textContent, "2 / 200");
        assert.equal(game.ui.goldText.textContent, "1 G");
        assert.equal(game.ui.hpText.textContent, "110 / 110");
        assert.equal(game.ui.mpText.textContent, "105 / 105");
        assert.equal(game.ui.playerSubtitle.textContent, "LV. 2 · 끓어오르는 활화산");
      },
    });
    game = harness.game;
    game.player.hp = 7;
    game.player.mp = 8;
    game.enemies = [enemy("fire-slime", 30)];

    game.applyAttackHits(lethalAttack);

    assert.equal(game.progress.level, 2);
    assert.equal(game.progress.exp, 2);
    assert.equal(game.player.hp, 110);
    assert.equal(game.player.mp, 105);
    assert.equal(harness.storage.writes.length, 1);
    assert.match(harness.notifications.at(-1), /^LEVEL UP! LV\.2/);
  });
});

test("multi-kill attacks leave a level-up notification last and save once", async () => {
  await withMinimumGold(() => {
    const { game, notifications, storage } = gameHarness({
      progress: { ...acceptAdventureQuest(createInitialProgress()), exp: 99 },
    });
    game.enemies = [enemy("fire-slime", 30), enemy("forest-slime", 40)];

    game.applyAttackHits(lethalAttack);

    assert.equal(game.progress.level, 2);
    assert.equal(game.progress.exp, 5);
    assert.equal(storage.writes.length, 1);
    assert.deepEqual(notifications, [
      "슬라임 처치! EXP +3 · Gold +1",
      "슬라임 처치! EXP +3 · Gold +1",
      "LEVEL UP! LV.2 · HP와 MP가 회복되었습니다.",
    ]);
  });
});

test("a write-failing v1 migration surfaces the existing save-failure notice", async () => {
  const { loadPlayerProgress } = await import("../src/game.js");
  assert.equal(typeof loadPlayerProgress, "function");
  const legacy = JSON.stringify({
    version: 1,
    exp: 15,
    quests: { adventureStart: { status: "completed", progress: 3 } },
  });
  const storage = {
    getItem(key) {
      return key === legacyProgressStorageKey("아렌") ? legacy : null;
    },
    setItem() {
      throw new Error("storage blocked");
    },
  };

  const loaded = loadPlayerProgress(storage, "아렌");

  assert.equal(loaded.progress.exp, 15);
  assert.equal(loaded.notice, "진행 상황을 브라우저에 저장할 수 없습니다.");
});
