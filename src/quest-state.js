export const ADVENTURE_QUEST = Object.freeze({
  id: "adventureStart",
  targetKinds: Object.freeze(["fire-slime", "forest-slime", "water-slime"]),
  required: 3,
  rewardExp: 15,
});

export function createInitialProgress() {
  return {
    exp: 0,
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
  if (quest.status !== "ready_to_report") return { progress: next, rewardExp: 0 };

  quest.status = "completed";
  next.exp += ADVENTURE_QUEST.rewardExp;
  return { progress: next, rewardExp: ADVENTURE_QUEST.rewardExp };
}
