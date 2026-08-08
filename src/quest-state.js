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
      [ADVENTURE_QUEST.id]: {
        status: "available",
        progress: 0,
      },
    },
  };
}

function cloneProgress(progress) {
  const quest = progress.quests[ADVENTURE_QUEST.id];
  return {
    ...progress,
    completedQuests: [...progress.completedQuests],
    quests: {
      ...progress.quests,
      [ADVENTURE_QUEST.id]: { ...quest },
    },
  };
}

export function acceptAdventureQuest(progress) {
  const next = cloneProgress(progress);
  const quest = next.quests[ADVENTURE_QUEST.id];
  if (quest.status === "available") quest.status = "active";
  return next;
}

export function recordAdventureKill(progress, enemyKind) {
  const next = cloneProgress(progress);
  const quest = next.quests[ADVENTURE_QUEST.id];
  if (quest.status !== "active" || !ADVENTURE_QUEST.targetKinds.includes(enemyKind)) return next;

  quest.progress = Math.min(ADVENTURE_QUEST.required, quest.progress + 1);
  if (quest.progress === ADVENTURE_QUEST.required) quest.status = "ready_to_report";
  return next;
}

export function completeAdventureQuest(progress) {
  const next = cloneProgress(progress);
  const quest = next.quests[ADVENTURE_QUEST.id];
  if (quest.status !== "ready_to_report") {
    return { progress: next, rewardExp: 0, rewardGold: 0, levelsGained: 0 };
  }

  quest.status = "completed";
  if (!next.completedQuests.includes(ADVENTURE_QUEST.id)) {
    next.completedQuests.push(ADVENTURE_QUEST.id);
  }
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
}
