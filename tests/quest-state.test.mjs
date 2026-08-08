import test from "node:test";
import assert from "node:assert/strict";
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
  assert.equal(second.progress.exp, 15);
  assert.equal(second.progress.gold, 30);
  assert.deepEqual(second.progress.completedQuests, ["adventureStart"]);
});

test("수락 전 처치와 비슬라임 처치는 진행도를 바꾸지 않는다", () => {
  const initial = createInitialProgress();
  const beforeAccept = recordAdventureKill(initial, "fire-slime");
  const active = acceptAdventureQuest(initial);
  const afterInvalidKind = recordAdventureKill(active, "boar");

  assert.deepEqual(beforeAccept, initial);
  assert.deepEqual(afterInvalidKind, active);
});

test("진행도는 세 마리에서 멈추고 모든 전이는 입력을 변경하지 않는다", () => {
  const initial = createInitialProgress();
  const active = acceptAdventureQuest(initial);
  const afterFirst = recordAdventureKill(active, "fire-slime");
  const ready = recordAdventureKill(
    recordAdventureKill(afterFirst, "forest-slime"),
    "water-slime",
  );
  const afterExtra = recordAdventureKill(ready, "fire-slime");

  assert.equal(ready.quests.adventureStart.progress, 3);
  assert.equal(afterExtra.quests.adventureStart.progress, 3);
  assert.equal(afterExtra.quests.adventureStart.status, "ready_to_report");
  assert.equal(initial.quests.adventureStart.progress, 0);
  assert.equal(active.quests.adventureStart.progress, 0);
  assert.equal(afterFirst.quests.adventureStart.progress, 1);
});

test("잘못된 상태에서의 전이는 보상 없이 복제된 상태를 반환한다", () => {
  const initial = createInitialProgress();
  const accepted = acceptAdventureQuest(initial);
  const completed = completeAdventureQuest(accepted);
  const completedAgain = completeAdventureQuest({
    ...completed.progress,
    quests: {
      adventureStart: { status: "completed", progress: 3 },
    },
  });

  assert.equal(completed.rewardExp, 0);
  assert.deepEqual(completed.progress, accepted);
  assert.equal(completedAgain.rewardExp, 0);
  assert.notStrictEqual(completedAgain.progress, accepted);
  assert.deepEqual(completedAgain.progress, {
    level: 1,
    exp: 0,
    nextLevelExp: 100,
    gold: 0,
    completedQuests: [],
    quests: { adventureStart: { status: "completed", progress: 3 } },
  });
});
