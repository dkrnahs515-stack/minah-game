import test from "node:test";
import assert from "node:assert/strict";
import {
  CHAT_LIMITS,
  flattenChatMessages,
  latestBubblesByUid,
  messageIdsToPrune,
  normalizeChatText,
  validateChatDraft,
} from "../src/chat-state.js";

test("채팅 문자열은 복합 이모지를 유지하면서 공백을 정규화한다", () => {
  assert.equal(normalizeChatText("   안녕\n\t월드 👨‍👩‍👧‍👦   "), "안녕 월드 👨‍👩‍👧‍👦");
});

test("메시지 초안 검증은 빈 문자열, 직전 메시지 중복, 80자 초과를 거부한다", () => {
  assert.equal(validateChatDraft("    ", "").ok, false);
  assert.equal(validateChatDraft(" 안녕  월드 ", "안녕 월드").ok, false);
  assert.equal(validateChatDraft("😀".repeat(81), "").ok, false);
  assert.equal(validateChatDraft("👨‍👩‍👧‍👦".repeat(80), "").ok, true);
  assert.deepEqual(validateChatDraft(" 안녕  월드 ", "이전"), {
    ok: true,
    text: "안녕 월드",
    error: "",
  });
});

test("플레이어별 중첩 메시지는 잘못된 기록을 버리고 최신 50개만 정렬한다", () => {
  const raw = {};
  for (let index = 0; index < 55; index++) {
    const uid = `u${index % 3}`;
    raw[uid] ||= {};
    raw[uid][`m${String(index).padStart(2, "0")}`] = {
      text: `message ${index}`,
      name: `user ${index % 3}`,
      mapId: index % 2 ? "forest" : "village",
      createdAt: 1000 + index,
    };
  }
  raw.u0.invalid = { text: "bad", mapId: "unknown", createdAt: "now" };
  const messages = flattenChatMessages(raw);
  assert.equal(messages.length, CHAT_LIMITS.panelMessages);
  assert.equal(messages[0].text, "message 5");
  assert.equal(messages.at(-1).text, "message 54");
  assert.equal(messages.at(-1).uid, "u0");
});

test("플레이어별 메시지 정리는 제한을 초과한 가장 오래된 ID를 반환한다", () => {
  const raw = Object.fromEntries(Array.from({ length: 7 }, (_, index) => [
    `m${index}`,
    { text: `m${index}`, name: "별", mapId: "village", createdAt: 100 + index },
  ]));
  assert.deepEqual(messageIdsToPrune(raw), ["m0", "m1"]);
  assert.deepEqual(messageIdsToPrune(raw, 4), ["m0", "m1", "m2"]);
});

test("최신 말풍선은 현재 지역에서 4초 이내에 생성된 메시지만 선택한다", () => {
  const messages = [
    { uid: "a", id: "1", text: "old", name: "A", mapId: "village", createdAt: 1000 },
    { uid: "a", id: "2", text: "new", name: "A", mapId: "village", createdAt: 4500 },
    { uid: "b", id: "3", text: "forest", name: "B", mapId: "forest", createdAt: 4900 },
  ];
  const bubbles = latestBubblesByUid(messages, { mapId: "village", now: 5000 });
  assert.equal(bubbles.size, 1);
  assert.equal(bubbles.get("a").text, "new");
});
