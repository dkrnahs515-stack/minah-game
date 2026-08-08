import test from "node:test";
import assert from "node:assert/strict";
import {
  legacyProgressStorageKey,
  loadProgress,
  progressStorageKey,
  saveProgress,
} from "../src/progress-storage.js";
import { createInitialProgress } from "../src/quest-state.js";

function memoryStorage() {
  const values = new Map();
  return {
    getItem(key) {
      return values.has(key) ? values.get(key) : null;
    },
    setItem(key, value) {
      values.set(key, String(value));
    },
  };
}

test("서로 다른 닉네임은 별도 진행 데이터를 사용한다", () => {
  const storage = memoryStorage();
  saveProgress(storage, "아렌", { ...createInitialProgress(), exp: 15 });

  assert.equal(loadProgress(storage, "아렌").exp, 15);
  assert.equal(loadProgress(storage, "다른 모험가").exp, 0);
});

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

test("손상되거나 유효하지 않은 저장 데이터는 기본값으로 복구된다", () => {
  const storage = memoryStorage();
  storage.setItem(progressStorageKey("아렌"), "{broken");
  assert.deepEqual(loadProgress(storage, "아렌"), createInitialProgress());
});

test("유효하지 않은 v2 진행 데이터는 기본값으로 복구된다", () => {
  const valid = {
    version: 2,
    ...createInitialProgress(),
  };
  const invalidValues = [
    { ...valid, level: 0 },
    { ...valid, exp: -1 },
    { ...valid, exp: 100 },
    { ...valid, nextLevelExp: 101 },
    { ...valid, gold: -1 },
    {
      ...valid,
      completedQuests: ["adventureStart", "adventureStart"],
      quests: { adventureStart: { status: "completed", progress: 3 } },
    },
    {
      ...valid,
      completedQuests: ["adventureStart", "otherQuest"],
      quests: { adventureStart: { status: "completed", progress: 3 } },
    },
    {
      ...valid,
      quests: { adventureStart: { status: "completed", progress: 3 } },
    },
    {
      ...valid,
      completedQuests: ["adventureStart"],
      quests: { adventureStart: { status: "active", progress: 1 } },
    },
    {
      ...valid,
      quests: { adventureStart: { status: "available", progress: 1 } },
    },
    {
      ...valid,
      quests: { adventureStart: { status: "active", progress: 3 } },
    },
    {
      ...valid,
      quests: { adventureStart: { status: "ready_to_report", progress: 0 } },
    },
    {
      ...valid,
      quests: { adventureStart: { status: "completed", progress: 2 } },
    },
  ];

  for (const value of invalidValues) {
    const storage = memoryStorage();
    storage.setItem(progressStorageKey("아렌"), JSON.stringify(value));
    assert.deepEqual(loadProgress(storage, "아렌"), createInitialProgress());
  }
});

test("유효하지 않은 v1 진행 데이터는 기본값으로 복구된다", () => {
  const storage = memoryStorage();
  storage.setItem(legacyProgressStorageKey("아렌"), JSON.stringify({
    version: 1,
    exp: 100,
    quests: { adventureStart: { status: "active", progress: 1 } },
  }));

  assert.deepEqual(loadProgress(storage, "아렌"), createInitialProgress());
});

test("저장 데이터는 버전 필드를 포함하고 저장 실패는 결과로 알린다", () => {
  const storage = memoryStorage();
  const progress = { ...createInitialProgress(), exp: 15 };
  assert.deepEqual(saveProgress(storage, "아렌", progress), { ok: true });
  assert.deepEqual(
    JSON.parse(storage.getItem(progressStorageKey("아렌"))),
    { version: 2, ...progress },
  );

  const failingStorage = {
    setItem() {
      throw new Error("storage blocked");
    },
  };
  assert.deepEqual(saveProgress(failingStorage, "아렌", progress), { ok: false });
  assert.deepEqual(saveProgress({}, "아렌", progress), { ok: false });
  assert.deepEqual(saveProgress(null, "아렌", progress), { ok: false });
});

test("v1 이전 쓰기가 실패하면 이전 상태에 실패 원인을 포함한다", async () => {
  const { loadProgressWithStatus } = await import("../src/progress-storage.js");
  assert.equal(typeof loadProgressWithStatus, "function");
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

  const result = loadProgressWithStatus(storage, "아렌");

  assert.equal(result.progress.exp, 15);
  assert.deepEqual(result.progress.completedQuests, ["adventureStart"]);
  assert.equal(result.migrationWriteFailed, true);
});
