import { WORLD_IDS } from "./world-data.js";

export const CHAT_LIMITS = Object.freeze({
  maxCharacters: 80,
  maxStorageUnits: 1024,
  panelMessages: 50,
  messagesPerPlayer: 5,
  cooldownMs: 1000,
  bubbleDurationMs: 4000,
});

const graphemeSegmenter = typeof globalThis.Intl?.Segmenter === "function"
  ? new Intl.Segmenter("ko", { granularity: "grapheme" })
  : null;

export function splitGraphemes(value) {
  const text = typeof value === "string" ? value : "";
  return graphemeSegmenter
    ? [...graphemeSegmenter.segment(text)].map(part => part.segment)
    : Array.from(text);
}

export function normalizeChatText(value) {
  return typeof value === "string" ? value.replace(/\s+/gu, " ").trim() : "";
}

export function validateChatDraft(value, previousText = "") {
  const text = normalizeChatText(value);
  if (!text) return { ok: false, text, error: "메시지를 입력해 주세요." };
  if (splitGraphemes(text).length > CHAT_LIMITS.maxCharacters || text.length > CHAT_LIMITS.maxStorageUnits) {
    return { ok: false, text, error: `메시지는 ${CHAT_LIMITS.maxCharacters}자 이내로 입력해 주세요.` };
  }
  if (text === normalizeChatText(previousText)) {
    return { ok: false, text, error: "같은 메시지를 연속으로 보낼 수 없습니다." };
  }
  return { ok: true, text, error: "" };
}

function validRecord(record) {
  if (!record || typeof record.text !== "string" || typeof record.name !== "string") return false;
  const text = normalizeChatText(record.text);
  const name = normalizeChatText(record.name);
  const textLength = splitGraphemes(text).length;
  const nameLength = splitGraphemes(name).length;
  return textLength >= 1
    && textLength <= CHAT_LIMITS.maxCharacters
    && text.length <= CHAT_LIMITS.maxStorageUnits
    && nameLength >= 1
    && nameLength <= 12
    && name.length <= 192
    && WORLD_IDS.includes(record.mapId)
    && Number.isFinite(record.createdAt);
}

export function flattenChatMessages(raw, limit = CHAT_LIMITS.panelMessages) {
  const messages = [];
  for (const [uid, bucket] of Object.entries(raw || {})) {
    if (!bucket || typeof bucket !== "object" || Array.isArray(bucket)) continue;
    for (const [id, record] of Object.entries(bucket)) {
      if (!validRecord(record)) continue;
      messages.push({
        uid,
        id,
        ...record,
        text: normalizeChatText(record.text),
        name: normalizeChatText(record.name),
      });
    }
  }
  messages.sort((a, b) => a.createdAt - b.createdAt
    || a.uid.localeCompare(b.uid)
    || a.id.localeCompare(b.id));
  return messages.slice(-Math.max(0, limit));
}

export function messageIdsToPrune(rawUserMessages, limit = CHAT_LIMITS.messagesPerPlayer) {
  const entries = Object.entries(rawUserMessages || {})
    .filter(([, record]) => validRecord(record))
    .sort(([idA, a], [idB, b]) => a.createdAt - b.createdAt || idA.localeCompare(idB));
  return entries
    .slice(0, Math.max(0, entries.length - Math.max(0, limit)))
    .map(([id]) => id);
}

export function latestBubblesByUid(messages, {
  mapId,
  now,
  durationMs = CHAT_LIMITS.bubbleDurationMs,
}) {
  const result = new Map();
  for (const message of messages || []) {
    const age = now - message.createdAt;
    if (message.mapId !== mapId || age < 0 || age > durationMs) continue;
    const current = result.get(message.uid);
    if (!current || current.createdAt <= message.createdAt) result.set(message.uid, message);
  }
  return result;
}
