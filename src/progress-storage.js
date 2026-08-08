import { ADVENTURE_QUEST, createInitialProgress } from "./quest-state.js";

const STORAGE_PREFIX = "pixel-world.progress.v1:";
const STORAGE_VERSION = 1;
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
    !Number.isSafeInteger(quest.progress) ||
    quest.progress < 0 ||
    quest.progress > ADVENTURE_QUEST.required
  ) {
    return false;
  }

  if (quest.status === "available") return quest.progress === 0;
  if (quest.status === "active") return quest.progress < ADVENTURE_QUEST.required;
  return quest.progress === ADVENTURE_QUEST.required;
}

function isValidProgress(progress) {
  if (!isRecord(progress)) return false;
  if (!Number.isSafeInteger(progress.exp) || progress.exp < 0) return false;

  const quest = progress.quests?.[ADVENTURE_QUEST.id];
  return (
    isRecord(progress.quests) &&
    isReachableQuest(quest)
  );
}

function toProgress(value) {
  return {
    exp: value.exp,
    quests: {
      [ADVENTURE_QUEST.id]: {
        status: value.quests[ADVENTURE_QUEST.id].status,
        progress: value.quests[ADVENTURE_QUEST.id].progress,
      },
    },
  };
}

export function progressStorageKey(nickname) {
  return `${STORAGE_PREFIX}${encodeURIComponent(normalizeNickname(nickname))}`;
}

export function loadProgress(storage, nickname) {
  try {
    const raw = storage?.getItem(progressStorageKey(nickname));
    if (raw === null || raw === undefined) return createInitialProgress();

    const parsed = JSON.parse(raw);
    if (parsed?.version !== STORAGE_VERSION || !isValidProgress(parsed)) {
      return createInitialProgress();
    }
    return toProgress(parsed);
  } catch {
    return createInitialProgress();
  }
}

export function saveProgress(storage, nickname, progress) {
  try {
    if (!isValidProgress(progress) || typeof storage?.setItem !== "function") {
      return { ok: false };
    }
    const payload = { version: STORAGE_VERSION, ...toProgress(progress) };
    storage?.setItem(
      progressStorageKey(nickname),
      JSON.stringify(payload),
    );
    return { ok: true };
  } catch {
    return { ok: false };
  }
}
