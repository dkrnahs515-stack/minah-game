import test from "node:test";
import assert from "node:assert/strict";
import {
  acceptAdventureQuest,
  createInitialProgress,
  recordAdventureKill,
} from "../src/quest-state.js";
import { arenDialogueModel } from "../src/aren-dialogue.js";

test("아렌 대화는 퀘스트 상태에 맞는 행동을 제공한다", () => {
  assert.equal(arenDialogueModel(createInitialProgress()).action, "accept");

  const active = acceptAdventureQuest(createInitialProgress());
  assert.match(arenDialogueModel(active).body, /0\/3/);
  assert.equal(arenDialogueModel(active).action, "close");
});

test("보고 가능과 완료 상태는 각각 완료 보고와 닫기 행동을 제공한다", () => {
  let progress = acceptAdventureQuest(createInitialProgress());
  for (const enemyKind of ["fire-slime", "forest-slime", "water-slime"]) {
    progress = recordAdventureKill(progress, enemyKind);
  }

  assert.deepEqual(arenDialogueModel(progress), {
    title: "현자 아렌",
    body: "슬라임 세 마리를 모두 처치했군요. 이제 임무를 보고하세요.",
    action: "complete",
    actionLabel: "완료 보고",
  });

  progress.quests.adventureStart.status = "completed";
  assert.equal(arenDialogueModel(progress).action, "close");
  assert.equal(arenDialogueModel(progress).actionLabel, "대화 마치기");
});
