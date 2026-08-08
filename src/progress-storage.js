import {
  ADVENTURE_QUEST,
  createInitialProgress,
} from "./quest-state.js";
import {
  grantProgressReward,
  nextLevelExp,
} from "./player-progression.js";

const STORAGE_VERSION = 2;
const STORAGE_PREFIX = "pixel-world.progress.v2:";
const LEGACY_STORAGE_PREFIX = "pixel-world.progress.v1:";
const LEGACY_STORAGE_VERSION = 1;
const VALID_STATUSES = new Set([
  "available",
  "active",
  "ready_to_report",
  "completed",
]);

function normalizeNickname(nickname) {
  return String(nickname ?? "").trim().replace(/\s+/gu, " ");
}

function isRecord(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function isReachableQuest(quest) {
  if (!isRecord(quest) || !VALID_STATUSES.has(quest.status)) return false;
  if (
    !Number.isSafeInteger(quest.progress)
    || quest.progress < 0
    || quest.progress > ADVENTURE_QUEST.required
  ) {
    return false;
  }

  if (quest.status === "available") return quest.progress === 0;
  if (quest.status === "active") return quest.progress < ADVENTURE_QUEST.required;
  return quest.progress === ADVENTURE_QUEST.required;
}

function isValidProgress(progress) {
  if (!isRecord(progress)) return false;
  if (!Number.isSafeInteger(progress.level) || progress.level < 1) return false;
  if (!Number.isSafeInteger(progress.nextLevelExp)
    || progress.nextLevelExp !== nextLevelExp(progress.level)) {
    return false;
  }
  if (!Number.isSafeInteger(progress.exp)
    || progress.exp < 0
    || progress.exp >= progress.nextLevelExp) {
    return false;
  }
  if (!Number.isSafeInteger(progress.gold) || progress.gold < 0) return false;
  if (!Array.isArray(progress.completedQuests)) return false;

  const completedQuestIds = new Set(progress.completedQuests);
  if (completedQuestIds.size !== progress.completedQuests.length
    || [...completedQuestIds].some((id) => id !== ADVENTURE_QUEST.id)) {
    return false;
  }

  const quest = progress.quests?.[ADVENTURE_QUEST.id];
  if (!isRecord(progress.quests) || !isReachableQuest(quest)) return false;

  return completedQuestIds.has(ADVENTURE_QUEST.id)
    === (quest.status === "completed");
}

function isValidLegacyProgress(progress) {
  if (!isRecord(progress)) return false;
  if (!Number.isSafeInteger(progress.exp) || progress.exp < 0 || progress.exp > 99) {
    return false;
  }

  return isRecord(progress.quests)
    && isReachableQuest(progress.quests[ADVENTURE_QUEST.id]);
}

function toProgress(value) {
  return {
    level: value.level,
    exp: value.exp,
    nextLevelExp: value.nextLevelExp,
    gold: value.gold,
    completedQuests: [...value.completedQuests],
    quests: {
      [ADVENTURE_QUEST.id]: {
        status: value.quests[ADVENTURE_QUEST.id].status,
        progress: value.quests[ADVENTURE_QUEST.id].progress,
      },
    },
  };
}

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

export function progressStorageKey(nickname) {
  return `${STORAGE_PREFIX}${encodeURIComponent(normalizeNickname(nickname))}`;
}

export function legacyProgressStorageKey(nickname) {
  return `${LEGACY_STORAGE_PREFIX}${encodeURIComponent(normalizeNickname(nickname))}`;
}

export function loadProgressWithStatus(storage, nickname) {
  try {
    const v2Raw = storage?.getItem(progressStorageKey(nickname));
    if (v2Raw !== null && v2Raw !== undefined) {
      let parsed;
      try {
        parsed = JSON.parse(v2Raw);
      } catch {
        parsed = null;
      }
      if (parsed?.version === STORAGE_VERSION && isValidProgress(parsed)) {
        return {
          progress: toProgress(parsed),
          migrationWriteFailed: false,
        };
      }
    }

    const v1Raw = storage?.getItem(legacyProgressStorageKey(nickname));
    if (v1Raw !== null && v1Raw !== undefined) {
      let parsed;
      try {
        parsed = JSON.parse(v1Raw);
      } catch {
        parsed = null;
      }
      if (parsed?.version === LEGACY_STORAGE_VERSION && isValidLegacyProgress(parsed)) {
        const migrated = migrateLegacyProgress(parsed);
        const migrationSave = saveProgress(storage, nickname, migrated);
        return {
          progress: migrated,
          migrationWriteFailed: !migrationSave.ok,
        };
      }
    }
  } catch {
    // Storage access and malformed JSON both recover to initial progress.
  }
  return {
    progress: createInitialProgress(),
    migrationWriteFailed: false,
  };
}

export function loadProgress(storage, nickname) {
  return loadProgressWithStatus(storage, nickname).progress;
}

export function saveProgress(storage, nickname, progress) {
  try {
    if (!isValidProgress(progress) || typeof storage?.setItem !== "function") {
      return { ok: false };
    }
    const payload = { version: STORAGE_VERSION, ...toProgress(progress) };
    storage.setItem(progressStorageKey(nickname), JSON.stringify(payload));
    return { ok: true };
  } catch {
    return { ok: false };
  }
}
