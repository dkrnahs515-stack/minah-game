import test from "node:test";
import assert from "node:assert/strict";
import {
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

test("닉네임의 공백은 정규화하고 저장 키는 URI 인코딩한다", () => {
  assert.equal(
    progressStorageKey("  아렌   모험가  "),
    "pixel-world.progress.v1:%EC%95%84%EB%A0%8C%20%EB%AA%A8%ED%97%98%EA%B0%80",
  );
});

test("손상되거나 유효하지 않은 저장 데이터는 기본값으로 복구된다", () => {
  const storage = memoryStorage();
  storage.setItem(progressStorageKey("아렌"), "{broken");
  assert.deepEqual(loadProgress(storage, "아렌"), createInitialProgress());
});

test("버전, EXP, 상태, 진행도 검증에 실패하면 기본값으로 복구된다", () => {
  const invalidValues = [
    { version: 2, exp: 15, quests: { adventureStart: { status: "active", progress: 1 } } },
    { version: 1, exp: -1, quests: { adventureStart: { status: "active", progress: 1 } } },
    { version: 1, exp: 15, quests: { adventureStart: { status: "unknown", progress: 1 } } },
    { version: 1, exp: 15, quests: { adventureStart: { status: "active", progress: 4 } } },
  ];

  for (const value of invalidValues) {
    const storage = memoryStorage();
    storage.setItem(progressStorageKey("아렌"), JSON.stringify(value));
    assert.deepEqual(loadProgress(storage, "아렌"), createInitialProgress());
  }
});

test("도달할 수 없는 상태와 진행도 조합은 기본값으로 복구된다", () => {
  const unreachableValues = [
    { status: "available", progress: 1 },
    { status: "active", progress: 3 },
    { status: "ready_to_report", progress: 0 },
    { status: "completed", progress: 2 },
  ];

  for (const quest of unreachableValues) {
    const storage = memoryStorage();
    storage.setItem(
      progressStorageKey("아렌"),
      JSON.stringify({ version: 1, exp: 15, quests: { adventureStart: quest } }),
    );
    assert.deepEqual(loadProgress(storage, "아렌"), createInitialProgress());
  }
});

test("저장 데이터는 버전 필드를 포함하고 저장 실패는 결과로 알린다", () => {
  const storage = memoryStorage();
  const progress = { ...createInitialProgress(), exp: 15 };
  assert.deepEqual(saveProgress(storage, "아렌", progress), { ok: true });
  assert.deepEqual(
    JSON.parse(storage.getItem(progressStorageKey("아렌"))),
    { version: 1, ...progress },
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
