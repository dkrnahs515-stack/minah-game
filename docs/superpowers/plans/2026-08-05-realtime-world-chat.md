# Pixel World Realtime World Chat Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a Firebase-backed global chat with a bottom-left message panel, Enter-to-chat controls, four-second player speech bubbles, and automatic removal of each player's messages when they disconnect.

**Architecture:** Pure modules own chat validation, message ordering, pruning, and screen-space bubble layout. A Firebase chat adapter reuses the existing authenticated app/database connection and stores at most five messages per connected UID, while a DOM controller owns chat focus and rendering. `PixelRPG` coordinates the controller, network callbacks, input suppression, and Canvas bubble rendering without changing the existing nickname, exit, portal, combat, or region-filtered player flows.

**Tech Stack:** HTML5 Canvas, native JavaScript ES modules, Firebase Authentication/Realtime Database 12.16.0, Node.js `node:test`, Playwright browser smoke tests, GitHub Pages/Firebase Hosting.

## Global Constraints

- Chat scope is the entire `public` room across `village`, `volcano`, `forest`, and `coast`.
- The chat panel shows at most 50 valid messages; each connected UID stores at most 5 server messages.
- Messages are normalized to single spaces, must contain 1–80 Unicode characters, and may not immediately duplicate the sender's previous message.
- A sender must wait 1 second between successful messages.
- The input opens with `Enter`, sends with `Enter`, and cancels with `Escape`; game movement and attacks are suppressed while it is focused.
- `Escape` closes chat before it may open the existing exit confirmation.
- Speech bubbles last 4 seconds and only render for characters visible in the active region; the panel remains global.
- Bubble width is `min(240px, viewportWidth × 0.45)`, with at most 4 lines, an 8px viewport margin, Unicode-safe ellipsis, vertical placement reversal, and a tail clamped 12px from box corners.
- Canvas render quality scaling must not change logical bubble text/box size; future camera zoom only scales the world-space anchor.
- Normal exit and `onDisconnect()` remove `rooms/{roomId}/chat/{uid}`.
- No package manager, bundler, permanent history, private messages, moderation backend, uploads, or new server runtime is added.
- Existing nickname entry, exit, portals, combat, respawn, 144Hz simulation, and Firebase player synchronization remain intact.
- No Firebase Admin/service-account key or other real secret may be added to tracked files, diffs, tests, docs, or logs. The final report must distinguish the expected Firebase Web API identifier from genuine admin credentials and mark console-only checks as unverified.
- The local chat branch starts from tree commit `5427a9d`; use `git diff 5427a9d...HEAD` for local scope review because remote `main` contains the equivalent world tree as a squash commit with a different SHA.

---

### Task 1: Pure Chat State, Validation, Ordering, and Pruning

**Files:**
- Create: `src/chat-state.js`
- Create: `tests/chat-state.test.mjs`

**Interfaces:**
- Consumes: `WORLD_IDS` from `src/world-data.js`
- Produces: `CHAT_LIMITS: { maxCharacters: 80, panelMessages: 50, messagesPerPlayer: 5, cooldownMs: 1000, bubbleDurationMs: 4000 }`
- Produces: `normalizeChatText(value): string`
- Produces: `validateChatDraft(value, previousText): { ok: boolean, text: string, error: string }`
- Produces: `flattenChatMessages(raw, limit?): Array<ChatMessage>`
- Produces: `messageIdsToPrune(rawUserMessages, limit?): string[]`
- Produces: `latestBubblesByUid(messages, options): Map<string, ChatMessage>`

- [ ] **Step 1: Write failing tests for normalization, validation, flattening, pruning, and bubble selection**

```js
// tests/chat-state.test.mjs
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

test("chat text normalizes whitespace without splitting Unicode characters", () => {
  assert.equal(normalizeChatText("  안녕\n\t월드 😀  "), "안녕 월드 😀");
  assert.equal(Array.from(normalizeChatText("😀".repeat(90))).length, CHAT_LIMITS.maxCharacters);
});

test("draft validation rejects empty and immediate duplicate messages", () => {
  assert.equal(validateChatDraft("   ", "").ok, false);
  assert.equal(validateChatDraft(" 안녕  월드 ", "안녕 월드").ok, false);
  assert.deepEqual(validateChatDraft(" 안녕  월드 ", "이전"), {
    ok: true,
    text: "안녕 월드",
    error: "",
  });
});

test("nested player messages flatten globally, discard invalid records, and keep the latest 50", () => {
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
  assert.equal(messages.length, 50);
  assert.equal(messages[0].text, "message 5");
  assert.equal(messages.at(-1).text, "message 54");
  assert.equal(messages.at(-1).uid, "u0");
});

test("per-player pruning removes the oldest ids after five messages", () => {
  const raw = Object.fromEntries(Array.from({ length: 7 }, (_, index) => [
    `m${index}`,
    { text: `m${index}`, name: "별", mapId: "village", createdAt: 100 + index },
  ]));
  assert.deepEqual(messageIdsToPrune(raw), ["m0", "m1"]);
});

test("latest bubbles include only fresh messages from the active map", () => {
  const messages = [
    { uid: "a", id: "1", text: "old", name: "A", mapId: "village", createdAt: 1000 },
    { uid: "a", id: "2", text: "new", name: "A", mapId: "village", createdAt: 4500 },
    { uid: "b", id: "3", text: "forest", name: "B", mapId: "forest", createdAt: 4900 },
  ];
  const bubbles = latestBubblesByUid(messages, { mapId: "village", now: 5000 });
  assert.equal(bubbles.size, 1);
  assert.equal(bubbles.get("a").text, "new");
});
```

- [ ] **Step 2: Run the chat-state tests and verify the missing module failure**

Run: `node --test tests/chat-state.test.mjs`

Expected: FAIL with `ERR_MODULE_NOT_FOUND` for `src/chat-state.js`.

- [ ] **Step 3: Implement the pure chat-state module**

```js
// src/chat-state.js
import { WORLD_IDS } from "./world-data.js";

export const CHAT_LIMITS = Object.freeze({
  maxCharacters: 80,
  panelMessages: 50,
  messagesPerPlayer: 5,
  cooldownMs: 1000,
  bubbleDurationMs: 4000,
});

export function normalizeChatText(value) {
  return Array.from(typeof value === "string" ? value.replace(/\s+/g, " ").trim() : "")
    .slice(0, CHAT_LIMITS.maxCharacters)
    .join("");
}

export function validateChatDraft(value, previousText = "") {
  const text = normalizeChatText(value);
  if (!text) return { ok: false, text, error: "메시지를 입력해 주세요." };
  if (text === previousText) return { ok: false, text, error: "같은 메시지를 연속으로 보낼 수 없습니다." };
  return { ok: true, text, error: "" };
}

function validRecord(record) {
  return record && typeof record.text === "string"
    && Array.from(record.text).length >= 1
    && Array.from(record.text).length <= CHAT_LIMITS.maxCharacters
    && typeof record.name === "string"
    && Array.from(record.name).length >= 1
    && Array.from(record.name).length <= 12
    && WORLD_IDS.includes(record.mapId)
    && Number.isFinite(record.createdAt);
}

export function flattenChatMessages(raw, limit = CHAT_LIMITS.panelMessages) {
  const messages = [];
  for (const [uid, bucket] of Object.entries(raw || {})) {
    for (const [id, record] of Object.entries(bucket || {})) {
      if (!validRecord(record)) continue;
      messages.push({ uid, id, ...record, text: normalizeChatText(record.text) });
    }
  }
  messages.sort((a, b) => a.createdAt - b.createdAt || a.id.localeCompare(b.id));
  return messages.slice(-limit);
}

export function messageIdsToPrune(rawUserMessages, limit = CHAT_LIMITS.messagesPerPlayer) {
  const entries = Object.entries(rawUserMessages || {})
    .filter(([, record]) => validRecord(record))
    .sort(([, a], [, b]) => a.createdAt - b.createdAt);
  return entries
    .slice(0, Math.max(0, entries.length - limit))
    .map(([id]) => id);
}

export function latestBubblesByUid(messages, {
  mapId,
  now,
  durationMs = CHAT_LIMITS.bubbleDurationMs,
}) {
  const result = new Map();
  for (const message of messages) {
    const age = now - message.createdAt;
    if (message.mapId !== mapId || age < 0 || age > durationMs) continue;
    const current = result.get(message.uid);
    if (!current || current.createdAt <= message.createdAt) result.set(message.uid, message);
  }
  return result;
}
```

- [ ] **Step 4: Run the focused and full unit suites**

Run: `node --test tests/chat-state.test.mjs`

Expected: 5 tests pass.

Run: `node --test tests/*.test.mjs`

Expected: all existing tests plus the 5 chat-state tests pass.

- [ ] **Step 5: Commit the pure state boundary**

```powershell
git add -- src/chat-state.js tests/chat-state.test.mjs
git commit -m "전체 채팅 상태 로직 추가"
```

---

### Task 2: Unicode Wrapping and Viewport-Safe Bubble Layout

**Files:**
- Create: `src/chat-bubble-layout.js`
- Create: `tests/chat-bubble-layout.test.mjs`

**Interfaces:**
- Consumes: normalized message text from `chat-state.js`
- Produces: `worldToScreen(options): { x: number, y: number }`
- Produces: `wrapChatText(text, measureText, maxWidth, maxLines?): string[]`
- Produces: `layoutChatBubble(options): { lines: string[], box: Rect, tail: Tail, placement: "above" | "below" }`

- [ ] **Step 1: Write failing tests for Korean/emoji wrapping, corners, flipping, tail clamping, and zoom anchors**

```js
// tests/chat-bubble-layout.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import { layoutChatBubble, worldToScreen, wrapChatText } from "../src/chat-bubble-layout.js";

const measure = text => Array.from(text).length * 10;

test("wrapping keeps Unicode intact and ellipsizes after four lines", () => {
  const lines = wrapChatText("한글 English 😀 ".repeat(12), measure, 100, 4);
  assert.equal(lines.length, 4);
  assert.equal(lines.at(-1).endsWith("…"), true);
  assert.equal(lines.join("").includes("\uFFFD"), false);
});

test("bubble stays inside every viewport edge with an eight pixel margin", () => {
  for (const anchor of [
    { x: 1, topY: 1, bottomY: 50 },
    { x: 399, topY: 1, bottomY: 50 },
    { x: 1, topY: 260, bottomY: 299 },
    { x: 399, topY: 260, bottomY: 299 },
  ]) {
    const layout = layoutChatBubble({
      text: "모서리에서 읽을 수 있는 긴 말풍선입니다 😀",
      measureText: measure,
      anchor,
      viewportWidth: 400,
      viewportHeight: 300,
    });
    assert.ok(layout.box.x >= 8);
    assert.ok(layout.box.y >= 8);
    assert.ok(layout.box.x + layout.box.width <= 392);
    assert.ok(layout.box.y + layout.box.height <= 292);
  }
});

test("top-edge bubbles flip below and reverse the tail", () => {
  const layout = layoutChatBubble({
    text: "위쪽 가장자리",
    measureText: measure,
    anchor: { x: 200, topY: 10, bottomY: 58 },
    viewportWidth: 400,
    viewportHeight: 300,
  });
  assert.equal(layout.placement, "below");
  assert.equal(layout.tail.direction, "up");
});

test("horizontal correction keeps the tail away from rounded corners", () => {
  const layout = layoutChatBubble({
    text: "오른쪽",
    measureText: measure,
    anchor: { x: 398, topY: 160, bottomY: 208 },
    viewportWidth: 400,
    viewportHeight: 300,
  });
  assert.ok(layout.tail.x >= layout.box.x + 12);
  assert.ok(layout.tail.x <= layout.box.x + layout.box.width - 12);
});

test("camera zoom moves only the world anchor", () => {
  assert.deepEqual(worldToScreen({ worldX: 120, worldY: 80, cameraX: 20, cameraY: 10, zoom: 1.5 }), {
    x: 150,
    y: 105,
  });
});
```

- [ ] **Step 2: Run the layout tests and verify the missing module failure**

Run: `node --test tests/chat-bubble-layout.test.mjs`

Expected: FAIL with `ERR_MODULE_NOT_FOUND` for `src/chat-bubble-layout.js`.

- [ ] **Step 3: Implement Unicode segmentation, wrapping, and layout**

```js
// src/chat-bubble-layout.js
const VIEWPORT_MARGIN = 8;
const CORNER_TAIL_MARGIN = 12;
const BOX_PADDING_X = 10;
const BOX_PADDING_Y = 8;
const LINE_HEIGHT = 18;
const TAIL_HEIGHT = 7;
const ANCHOR_GAP = 7;

export function worldToScreen({ worldX, worldY, cameraX, cameraY, zoom = 1 }) {
  return { x: (worldX - cameraX) * zoom, y: (worldY - cameraY) * zoom };
}

function segments(text) {
  if (typeof Intl?.Segmenter === "function") {
    return [...new Intl.Segmenter("ko", { granularity: "word" }).segment(text)].map(part => part.segment);
  }
  return Array.from(text);
}

export function wrapChatText(text, measureText, maxWidth, maxLines = 4) {
  const tokens = segments(text);
  const lines = [];
  let line = "";
  let truncated = false;

  const pushLine = () => {
    lines.push(line.trimEnd());
    line = "";
  };

  for (const token of tokens) {
    if (measureText(line + token) <= maxWidth) {
      line += token;
      continue;
    }
    if (line) pushLine();
    for (const character of Array.from(token)) {
      if (measureText(line + character) <= maxWidth) line += character;
      else {
        pushLine();
        line = character;
      }
      if (lines.length === maxLines) {
        truncated = true;
        break;
      }
    }
    if (lines.length === maxLines) break;
  }
  if (line && lines.length < maxLines) lines.push(line.trimEnd());
  if (lines.length === maxLines && tokens.join("") !== lines.join("")) truncated = true;

  if (truncated && lines.length) {
    let last = lines.at(-1);
    while (last && measureText(`${last}…`) > maxWidth) last = Array.from(last).slice(0, -1).join("");
    lines[lines.length - 1] = `${last}…`;
  }
  return lines.length ? lines : [""];
}

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

export function layoutChatBubble({ text, measureText, anchor, viewportWidth, viewportHeight }) {
  const maxBoxWidth = Math.max(48, Math.min(240, viewportWidth * 0.45, viewportWidth - VIEWPORT_MARGIN * 2));
  const maxTextWidth = Math.max(24, maxBoxWidth - BOX_PADDING_X * 2);
  const lines = wrapChatText(text, measureText, maxTextWidth, 4);
  const textWidth = Math.max(...lines.map(measureText));
  const width = Math.min(maxBoxWidth, Math.max(56, textWidth + BOX_PADDING_X * 2));
  const height = lines.length * LINE_HEIGHT + BOX_PADDING_Y * 2;
  const aboveY = anchor.topY - ANCHOR_GAP - TAIL_HEIGHT - height;
  const belowY = anchor.bottomY + ANCHOR_GAP + TAIL_HEIGHT;
  const aboveFits = aboveY >= VIEWPORT_MARGIN;
  const belowFits = belowY + height <= viewportHeight - VIEWPORT_MARGIN;
  const placement = aboveFits || (!belowFits && anchor.topY >= viewportHeight - anchor.bottomY) ? "above" : "below";
  const preferredY = placement === "above" ? aboveY : belowY;
  const x = clamp(anchor.x - width / 2, VIEWPORT_MARGIN, viewportWidth - VIEWPORT_MARGIN - width);
  const y = clamp(preferredY, VIEWPORT_MARGIN, viewportHeight - VIEWPORT_MARGIN - height);
  const tailX = clamp(anchor.x, x + CORNER_TAIL_MARGIN, x + width - CORNER_TAIL_MARGIN);
  return {
    lines,
    box: { x, y, width, height, paddingX: BOX_PADDING_X, paddingY: BOX_PADDING_Y, lineHeight: LINE_HEIGHT },
    tail: {
      x: tailX,
      y: placement === "above" ? y + height : y,
      direction: placement === "above" ? "down" : "up",
      height: TAIL_HEIGHT,
    },
    placement,
  };
}
```

- [ ] **Step 4: Run layout and full unit suites**

Run: `node --test tests/chat-bubble-layout.test.mjs`

Expected: 5 tests pass.

Run: `node --test tests/*.test.mjs`

Expected: all tests pass.

- [ ] **Step 5: Commit the bubble layout boundary**

```powershell
git add -- src/chat-bubble-layout.js tests/chat-bubble-layout.test.mjs
git commit -m "말풍선 화면 경계 배치 추가"
```

---

### Task 3: Firebase Chat Adapter, Disconnect Cleanup, and Security Rules

**Files:**
- Create: `src/chat-network.js`
- Modify: `src/network.js`
- Modify: `database.rules.json`
- Create: `tests/chat-network.test.mjs`
- Create: `tests/database-rules.test.mjs`

**Interfaces:**
- Consumes: `flattenChatMessages()` and `messageIdsToPrune()` from `chat-state.js`
- Produces: `createOfflineChatAdapter(): ChatAdapter`
- Produces: `createFirebaseChatAdapter(options): Promise<ChatAdapter>`
- Changes: `createNetworkAdapter(callbacks)` returns `{ mode, uid, publish, chat, stop }`
- `ChatAdapter.send(payload)` consumes `{ text, name, mapId }` and returns `{ ok: boolean, error: string }`

- [ ] **Step 1: Write failing adapter tests with an injected Firebase module fake**

```js
// tests/chat-network.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import { createFirebaseChatAdapter, createOfflineChatAdapter } from "../src/chat-network.js";

function fakeFirebase(initial = {}) {
  const writes = [];
  const removes = [];
  let listener;
  const module = {
    ref: (_db, path) => ({ path, key: path.split("/").at(-1) }),
    onValue: (_ref, callback) => { listener = callback; callback({ val: () => initial }); return () => {}; },
    onDisconnect: ref => ({
      remove: async () => writes.push(["disconnect", ref.path]),
      cancel: async () => writes.push(["cancel", ref.path]),
    }),
    push: ref => ({ path: `${ref.path}/new-message`, key: "new-message" }),
    set: async (ref, value) => writes.push(["set", ref.path, value]),
    get: async () => ({ val: () => initial.owner || {} }),
    update: async (ref, value) => writes.push(["update", ref.path, value]),
    remove: async ref => removes.push(ref.path),
    serverTimestamp: () => 123456,
  };
  return { module, writes, removes, emit: value => listener({ val: () => value }) };
}

test("offline adapter rejects send without throwing", async () => {
  assert.deepEqual(await createOfflineChatAdapter().send({ text: "hello" }), {
    ok: false,
    error: "채팅 서버가 오프라인입니다.",
  });
});

test("firebase adapter subscribes globally, writes under its uid, and removes its subtree on stop", async () => {
  const fake = fakeFirebase();
  const received = [];
  const adapter = await createFirebaseChatAdapter({
    dbModule: fake.module,
    db: {},
    uid: "owner",
    roomId: "public",
    onMessagesChanged: messages => received.push(messages),
  });
  assert.deepEqual(await adapter.send({ text: "hello", name: "별", mapId: "village" }), { ok: true, error: "" });
  assert.equal(fake.writes.some(entry => entry[0] === "set" && entry[1].includes("chat/owner/new-message")), true);
  await adapter.stop();
  assert.deepEqual(fake.removes, ["rooms/public/chat/owner"]);
});
```

- [ ] **Step 2: Write a failing structural test for chat security rules**

```js
// tests/database-rules.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("chat rules require auth, uid ownership, bounded text, valid maps, and no extra fields", async () => {
  const rules = JSON.parse(await readFile(new URL("../database.rules.json", import.meta.url), "utf8"));
  const chat = rules.rules.rooms.$roomId.chat;
  const message = chat.$uid.$messageId;
  assert.equal(chat[".read"], "auth != null");
  assert.match(chat.$uid[".write"], /auth\.uid === \$uid/);
  assert.match(message.text[".validate"], /length <= 80/);
  assert.match(message.mapId[".validate"], /village/);
  assert.equal(message.$other[".validate"], false);
});
```

- [ ] **Step 3: Run the focused tests and verify missing adapter/rules failures**

Run: `node --test tests/chat-network.test.mjs tests/database-rules.test.mjs`

Expected: FAIL because `src/chat-network.js` and the `chat` rules do not exist.

- [ ] **Step 4: Implement the Firebase chat adapter with per-UID pruning and cleanup**

```js
// src/chat-network.js
import { flattenChatMessages, messageIdsToPrune } from "./chat-state.js";

export function createOfflineChatAdapter() {
  return {
    mode: "offline",
    send: async () => ({ ok: false, error: "채팅 서버가 오프라인입니다." }),
    stop: async () => {},
  };
}

export async function createFirebaseChatAdapter({ dbModule, db, uid, roomId, onMessagesChanged }) {
  const rootRef = dbModule.ref(db, `rooms/${roomId}/chat`);
  const userRef = dbModule.ref(db, `rooms/${roomId}/chat/${uid}`);
  const disconnect = dbModule.onDisconnect(userRef);
  await disconnect.remove();
  const unsubscribe = dbModule.onValue(rootRef, snapshot => {
    onMessagesChanged?.(flattenChatMessages(snapshot.val() || {}));
  });
  let stopped = false;

  return {
    mode: "firebase",
    send: async ({ text, name, mapId }) => {
      if (stopped) return { ok: false, error: "채팅 연결이 종료되었습니다." };
      try {
        const messageRef = dbModule.push(userRef);
        await dbModule.set(messageRef, {
          text,
          name,
          mapId,
          createdAt: dbModule.serverTimestamp(),
        });
        const snapshot = await dbModule.get(userRef);
        const ids = messageIdsToPrune(snapshot.val() || {});
        if (ids.length) {
          await dbModule.update(userRef, Object.fromEntries(ids.map(id => [id, null])));
        }
        return { ok: true, error: "" };
      } catch (error) {
        console.warn("채팅 메시지 전송 실패", error);
        return { ok: false, error: "메시지를 보내지 못했습니다." };
      }
    },
    stop: async () => {
      if (stopped) return;
      stopped = true;
      unsubscribe();
      try {
        await dbModule.remove(userRef);
        await disconnect.cancel();
      } catch (error) {
        console.warn("채팅 종료 정보 정리 실패", error);
      }
    },
  };
}
```

- [ ] **Step 5: Integrate one authenticated Firebase connection with the chat adapter**

Replace `src/network.js` with this callback-object version so player and chat adapters share one app, database, and anonymous user:

```js
// src/network.js
import { FIREBASE_CONFIG, GAME_CONFIG as C, ROOM_ID } from "./config.js";
import { createFirebaseChatAdapter, createOfflineChatAdapter } from "./chat-network.js";
import { filterPlayersForMap, serializePlayerState } from "./network-state.js";

function createOfflineNetworkAdapter() {
  return {
    mode: "offline",
    uid: "local-player",
    publish: () => {},
    chat: createOfflineChatAdapter(),
    stop: async () => {},
  };
}

export async function createNetworkAdapter({
  onPlayersChanged,
  onStatusChanged,
  onChatMessagesChanged,
  onChatStatusChanged,
} = {}) {
  if (!FIREBASE_CONFIG?.apiKey || !FIREBASE_CONFIG?.databaseURL) {
    onStatusChanged?.("offline", "Firebase 설정 필요");
    onChatStatusChanged?.("offline", "채팅 오프라인");
    return createOfflineNetworkAdapter();
  }

  onStatusChanged?.("connecting", "접속 중");
  try {
    const version = "12.16.0";
    const [appModule, authModule, dbModule] = await Promise.all([
      import(`https://www.gstatic.com/firebasejs/${version}/firebase-app.js`),
      import(`https://www.gstatic.com/firebasejs/${version}/firebase-auth.js`),
      import(`https://www.gstatic.com/firebasejs/${version}/firebase-database.js`),
    ]);

    const app = appModule.getApps().length ? appModule.getApp() : appModule.initializeApp(FIREBASE_CONFIG);
    const auth = authModule.getAuth(app);
    const user = auth.currentUser || (await authModule.signInAnonymously(auth)).user;
    const uid = user.uid;
    const db = dbModule.getDatabase(app);
    const playerRef = dbModule.ref(db, `rooms/${ROOM_ID}/players/${uid}`);
    const playersRef = dbModule.ref(db, `rooms/${ROOM_ID}/players`);
    const connectedRef = dbModule.ref(db, ".info/connected");
    const playerDisconnect = dbModule.onDisconnect(playerRef);
    await playerDisconnect.remove();

    let stopped = false;
    let activeMapId = "village";
    let rawPlayers = {};
    const emitVisiblePlayers = () => {
      onPlayersChanged?.(filterPlayersForMap(rawPlayers, uid, activeMapId));
    };
    const unsubscribePlayers = dbModule.onValue(playersRef, snapshot => {
      rawPlayers = snapshot.val() || {};
      emitVisiblePlayers();
    });
    const unsubscribeConnected = dbModule.onValue(connectedRef, snapshot => {
      const online = snapshot.val() === true;
      onStatusChanged?.(online ? "online" : "connecting", online ? "온라인" : "재연결 중");
    });

    let lastPublish = 0;
    const publish = (state, mapId = "village") => {
      if (stopped) return;
      if (mapId !== activeMapId) {
        activeMapId = mapId;
        emitVisiblePlayers();
      }
      const now = performance.now();
      if (now - lastPublish < 1000 / C.NETWORK_SEND_HZ) return;
      lastPublish = now;
      dbModule.update(playerRef, {
        ...serializePlayerState(state, activeMapId),
        updatedAt: dbModule.serverTimestamp(),
      }).catch(error => console.warn("플레이어 위치 전송 실패", error));
    };

    let chat = createOfflineChatAdapter();
    try {
      chat = await createFirebaseChatAdapter({
        dbModule,
        db,
        uid,
        roomId: ROOM_ID,
        onMessagesChanged: onChatMessagesChanged,
      });
      onChatStatusChanged?.("online", "전체 채팅");
    } catch (error) {
      console.warn("채팅 연결 실패", error);
      onChatStatusChanged?.("offline", "채팅 오프라인");
    }

    return {
      mode: "firebase",
      uid,
      publish,
      chat,
      stop: async () => {
        if (stopped) return;
        stopped = true;
        unsubscribePlayers();
        unsubscribeConnected();
        await chat.stop();
        try {
          await dbModule.remove(playerRef);
          await playerDisconnect.cancel();
        } catch (error) {
          console.warn("플레이어 퇴장 정보 정리 실패", error);
        }
      },
    };
  } catch (error) {
    console.error("Firebase 연결 실패", error);
    onStatusChanged?.("offline", "연결 실패");
    onChatStatusChanged?.("offline", "채팅 오프라인");
    return createOfflineNetworkAdapter();
  }
}
```

- [ ] **Step 6: Add authenticated, owner-only, field-bounded chat rules**

Add this sibling next to `players` under `rooms/$roomId`:

```json
"chat": {
  ".read": "auth != null",
  "$uid": {
    ".write": "auth != null && auth.uid === $uid",
    "$messageId": {
      ".validate": "newData.hasChildren(['text','name','mapId','createdAt'])",
      "text": {
        ".validate": "newData.isString() && newData.val().length > 0 && newData.val().length <= 80"
      },
      "name": {
        ".validate": "newData.isString() && newData.val().length > 0 && newData.val().length <= 12"
      },
      "mapId": {
        ".validate": "newData.isString() && (newData.val() === 'village' || newData.val() === 'volcano' || newData.val() === 'forest' || newData.val() === 'coast')"
      },
      "createdAt": {
        ".validate": "newData.isNumber() && newData.val() <= now"
      },
      "$other": {
        ".validate": false
      }
    }
  }
}
```

- [ ] **Step 7: Run adapter, rules, and complete unit suites**

Run: `node --test tests/chat-network.test.mjs tests/database-rules.test.mjs`

Expected: 3 focused tests pass.

Run: `node --test tests/*.test.mjs`

Expected: all tests pass.

Run: `Get-Content -Raw database.rules.json | ConvertFrom-Json | Out-Null`

Expected: PowerShell exits 0.

- [ ] **Step 8: Commit network and server-rule integration**

```powershell
git add -- src/chat-network.js src/network.js database.rules.json tests/chat-network.test.mjs tests/database-rules.test.mjs
git commit -m "Firebase 전체 채팅 동기화 추가"
```

---

### Task 4: Bottom-Left Chat UI, Enter/Escape Flow, and Offline State

**Files:**
- Create: `src/chat-controller.js`
- Create: `tests/chat-controller.test.mjs`
- Create: `tests/static-chat-ui.test.mjs`
- Modify: `index.html`
- Modify: `styles.css`

**Interfaces:**
- Produces: `chatKeyAction({ code, typing, running, exitOpen }): "open" | "cancel" | null`
- Produces: `ChatController` methods `open()`, `cancel()`, `submit()`, `setMode()`, `renderMessages()`, `reset()`, `isTyping()`
- Consumed later by Task 5 through `PixelRPG`: controller focus and submit methods

- [ ] **Step 1: Write failing tests for key priority and static UI structure**

```js
// tests/chat-controller.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import { chatKeyAction } from "../src/chat-controller.js";

test("Enter opens chat only while the game is running and exit is closed", () => {
  assert.equal(chatKeyAction({ code: "Enter", typing: false, running: true, exitOpen: false }), "open");
  assert.equal(chatKeyAction({ code: "Enter", typing: false, running: true, exitOpen: true }), null);
});

test("Escape cancels chat before the exit dialog can open", () => {
  assert.equal(chatKeyAction({ code: "Escape", typing: true, running: true, exitOpen: false }), "cancel");
  assert.equal(chatKeyAction({ code: "Escape", typing: false, running: true, exitOpen: false }), null);
});
```

```js
// tests/static-chat-ui.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("chat panel contains accessible status, message list, form, and bounded input", async () => {
  const html = await readFile(new URL("../index.html", import.meta.url), "utf8");
  assert.match(html, /id="chatPanel"/);
  assert.match(html, /id="chatMessages"/);
  assert.match(html, /id="chatForm"/);
  assert.match(html, /id="chatInput"[^>]+maxlength="80"/);
  assert.match(html, /aria-live="polite"/);
});

test("chat panel is interactive and responsive from desktop to mobile", async () => {
  const css = await readFile(new URL("../styles.css", import.meta.url), "utf8");
  assert.match(css, /\.chat-panel[^}]+pointer-events:\s*auto/s);
  assert.match(css, /@media \(max-width: 520px\)[\s\S]+\.chat-panel/);
});
```

- [ ] **Step 2: Run the controller/static tests and verify failures**

Run: `node --test tests/chat-controller.test.mjs tests/static-chat-ui.test.mjs`

Expected: FAIL because the module and markup do not exist.

- [ ] **Step 3: Add the chat panel markup inside `#hud`**

Place it after `#message` and before the minimap:

```html
<section id="chatPanel" class="chat-panel glass" aria-label="전체 월드 채팅">
  <header>
    <strong>전체 월드</strong>
    <span id="chatStatus" class="chat-status offline">오프라인</span>
  </header>
  <ol id="chatMessages" class="chat-messages" aria-live="polite" aria-relevant="additions"></ol>
  <form id="chatForm" class="chat-form" autocomplete="off">
    <label class="sr-only" for="chatInput">전체 월드 메시지</label>
    <input id="chatInput" type="text" maxlength="80" placeholder="Enter로 채팅" disabled />
    <button type="submit" aria-label="메시지 보내기" disabled>전송</button>
  </form>
</section>
```

- [ ] **Step 4: Add responsive panel styles without covering the hotbar**

```css
.sr-only { position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px; overflow: hidden; clip: rect(0,0,0,0); white-space: nowrap; border: 0; }
.chat-panel { pointer-events: auto; position: absolute; left: 14px; bottom: 100px; width: min(360px,calc(100vw - 28px)); max-height: 250px; overflow: hidden; border-radius: 14px; text-shadow: none; }
.chat-panel header { display: flex; align-items: center; justify-content: space-between; padding: 8px 10px; border-bottom: 1px solid var(--line); }
.chat-panel header strong { font-size: 12px; }
.chat-status { color: var(--muted); font-size: 10px; }
.chat-status.online { color: #bbf7d0; }
.chat-status.offline { color: #fecaca; }
.chat-messages { height: 145px; margin: 0; padding: 8px 10px; overflow-y: auto; list-style: none; background: rgba(3,7,18,.36); user-select: text; }
.chat-messages li { margin: 0 0 5px; color: #e2e8f0; font-size: 12px; line-height: 1.35; overflow-wrap: anywhere; }
.chat-messages b { margin-right: 5px; color: #81e6d9; }
.chat-form { display: grid; grid-template-columns: 1fr auto; gap: 6px; padding: 8px; }
.chat-form input { min-width: 0; padding: 8px 9px; border: 1px solid var(--line); border-radius: 8px; background: rgba(3,7,18,.72); color: white; user-select: text; }
.chat-form button { border: 0; border-radius: 8px; padding: 0 11px; background: #0f766e; color: white; cursor: pointer; font-weight: 800; }
.chat-form :disabled { cursor: not-allowed; opacity: .5; }
```

Inside the existing `@media (max-width: 520px)` block add:

```css
.chat-panel { bottom: 76px; max-height: 205px; }
.chat-messages { height: 105px; }
```

- [ ] **Step 5: Implement the controller with cooldown, duplicate checks, text-only rendering, and focus state**

```js
// src/chat-controller.js
import { CHAT_LIMITS, validateChatDraft } from "./chat-state.js";

export function chatKeyAction({ code, typing, running, exitOpen }) {
  if (code === "Escape" && typing) return "cancel";
  if (code === "Enter" && running && !typing && !exitOpen) return "open";
  return null;
}

export class ChatController {
  constructor({ panel, list, form, input, status, onSend, onTypingChange, now = () => Date.now() }) {
    this.panel = panel;
    this.list = list;
    this.form = form;
    this.input = input;
    this.status = status;
    this.onSend = onSend;
    this.onTypingChange = onTypingChange;
    this.now = now;
    this.previousText = "";
    this.lastSentAt = -Infinity;
    this.online = false;
    this.form.addEventListener("submit", event => { event.preventDefault(); this.submit(); });
  }

  isTyping() { return document.activeElement === this.input; }

  open() {
    if (!this.online || this.input.disabled) return false;
    this.input.focus();
    this.onTypingChange?.(true);
    return true;
  }

  cancel() {
    if (!this.isTyping()) return false;
    this.input.value = "";
    this.input.blur();
    this.onTypingChange?.(false);
    return true;
  }

  async submit() {
    const draft = validateChatDraft(this.input.value, this.previousText);
    if (!draft.ok) return this.setStatus("error", draft.error);
    if (this.now() - this.lastSentAt < CHAT_LIMITS.cooldownMs) {
      return this.setStatus("error", "메시지는 1초에 한 번 보낼 수 있습니다.");
    }
    const result = await this.onSend(draft.text);
    if (!result.ok) return this.setStatus("error", result.error);
    this.previousText = draft.text;
    this.lastSentAt = this.now();
    this.input.value = "";
    this.input.blur();
    this.onTypingChange?.(false);
    this.setMode("online", "전체 채팅");
  }

  setStatus(mode, label) {
    this.status.className = `chat-status ${mode}`;
    this.status.textContent = label;
  }

  setMode(mode, label) {
    this.online = mode === "online";
    this.input.disabled = !this.online;
    this.form.querySelector("button").disabled = !this.online;
    this.setStatus(mode, label);
    if (!this.online) this.cancel();
  }

  renderMessages(messages) {
    const fragment = document.createDocumentFragment();
    for (const message of messages) {
      const item = document.createElement("li");
      const name = document.createElement("b");
      const text = document.createElement("span");
      name.textContent = message.name;
      text.textContent = message.text;
      item.append(name, text);
      fragment.append(item);
    }
    this.list.replaceChildren(fragment);
    this.list.scrollTop = this.list.scrollHeight;
  }

  reset() {
    this.previousText = "";
    this.lastSentAt = -Infinity;
    this.list.replaceChildren();
    this.input.value = "";
    this.setMode("offline", "오프라인");
  }
}
```

- [ ] **Step 6: Run controller, static UI, and full unit suites**

Run: `node --test tests/chat-controller.test.mjs tests/static-chat-ui.test.mjs`

Expected: 4 focused tests pass.

Run: `node --test tests/*.test.mjs`

Expected: all tests pass.

- [ ] **Step 7: Commit the chat UI and controller**

```powershell
git add -- src/chat-controller.js index.html styles.css tests/chat-controller.test.mjs tests/static-chat-ui.test.mjs
git commit -m "전체 채팅 UI 컨트롤러 추가"
```

---

### Task 5: Game Coordination and Canvas Speech Bubbles

**Files:**
- Modify: `src/game.js`
- Modify: `src/main.js`
- Modify: `tests/browser-smoke.cjs`
- Create: `tests/static-chat-integration.test.mjs`

**Interfaces:**
- Consumes: `ChatController`, `latestBubblesByUid()`, `layoutChatBubble()`, `worldToScreen()`
- Produces for `main.js`: `openChatInput()`, `cancelChatInput()`, `isChatTyping()`
- Produces internal methods: `sendChat(text)`, `receiveChatMessages(messages)`, `drawChatBubble(ctx, entity, message, cameraX, cameraY)`

- [ ] **Step 1: Write a failing static integration test before wiring the game**

```js
// tests/static-chat-integration.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("game coordinates the controller, global messages, input suppression, and bubble overlay", async () => {
  const game = await readFile(new URL("../src/game.js", import.meta.url), "utf8");
  const main = await readFile(new URL("../src/main.js", import.meta.url), "utf8");
  assert.match(game, /import \{ ChatController \}/);
  assert.match(game, /latestBubblesByUid/);
  assert.match(game, /chatInputActive/);
  assert.match(game, /openChatInput\(\)/);
  assert.match(game, /function drawChatBubble/);
  assert.match(main, /chatKeyAction/);
  assert.match(main, /game\.cancelChatInput\(\)/);
});
```

- [ ] **Step 2: Run the integration test and verify it fails**

Run: `node --test tests/static-chat-integration.test.mjs`

Expected: FAIL because `game.js` and `main.js` do not yet contain chat coordination.

- [ ] **Step 3: Construct the chat controller and initialize game chat state**

Add imports:

```js
import { layoutChatBubble, worldToScreen } from "./chat-bubble-layout.js";
import { ChatController } from "./chat-controller.js";
import { latestBubblesByUid } from "./chat-state.js";
```

In the constructor add:

```js
this.chatInputActive = false;
this.chatMessages = [];
this.chat = new ChatController({
  panel: elements.chatPanel,
  list: elements.chatMessages,
  form: elements.chatForm,
  input: elements.chatInput,
  status: elements.chatStatus,
  onSend: text => this.sendChat(text),
  onTypingChange: active => {
    this.chatInputActive = active;
    if (active) {
      this.keys.clear();
      this.player.moving = false;
    }
  },
});
```

- [ ] **Step 4: Connect chat callbacks to the existing Firebase network lifecycle**

Replace the positional `createNetworkAdapter` call in `enter()`:

```js
this.network = await createNetworkAdapter({
  onPlayersChanged: players => this.receiveRemotePlayers(players),
  onStatusChanged: (status, label) => this.updateNetworkStatus(status, label),
  onChatMessagesChanged: messages => this.receiveChatMessages(messages),
  onChatStatusChanged: (status, label) => this.chat.setMode(status, label),
});
this.chat.setMode(this.network.chat.mode === "firebase" ? "online" : "offline",
  this.network.chat.mode === "firebase" ? "전체 채팅" : "채팅 오프라인");
```

In `leave()` call `this.chat.reset()`, clear `chatMessages`, and set `chatInputActive = false` after the network adapter stops.

- [ ] **Step 5: Add public focus methods and network send/receive coordination**

```js
openChatInput() {
  if (!this.running) return false;
  return this.chat.open();
}

cancelChatInput() {
  return this.chat.cancel();
}

isChatTyping() {
  return this.chat.isTyping();
}

async sendChat(text) {
  if (!this.network?.chat || this.network.chat.mode !== "firebase") {
    return { ok: false, error: "채팅 서버가 오프라인입니다." };
  }
  return this.network.chat.send({ text, name: this.player.name, mapId: this.mapId });
}

receiveChatMessages(messages) {
  this.chatMessages = messages;
  this.chat.renderMessages(messages);
}
```

- [ ] **Step 6: Wire DOM elements and Enter/Escape priority in `main.js`**

Import `chatKeyAction`, add `chatPanel`, `chatMessages`, `chatForm`, `chatInput`, and `chatStatus` to `elements`, then replace the global Escape-only listener with:

```js
addEventListener("keydown", event => {
  const action = chatKeyAction({
    code: event.code,
    typing: game.isChatTyping(),
    running: game.isRunning(),
    exitOpen: !exitOverlay.hidden,
  });
  if (action === "cancel") {
    game.cancelChatInput();
    event.preventDefault();
    return;
  }
  if (action === "open") {
    game.openChatInput();
    event.preventDefault();
    return;
  }
  if (event.code !== "Escape") return;
  if (!exitOverlay.hidden) closeExitDialog();
  else if (game.isRunning()) openExitDialog();
});
```

The existing `exitButton`, `cancelExitButton`, `confirmExitButton`, and `pagehide` listeners remain byte-for-byte unchanged; only the global keyboard listener is replaced.

- [ ] **Step 7: Suppress movement and attacks while chat is active**

Add `this.chatInputActive` to the `keydown` guard:

```js
if (!this.running || !this.inputEnabled || this.chatInputActive || isTypingTarget(event.target)) return;
```

Also change `updatePlayerMovement()` to require both flags:

```js
const movement = this.inputEnabled && !this.chatInputActive
  ? movementVector(this.keys)
  : { x: 0, y: 0 };
```

- [ ] **Step 8: Render speech bubbles in a separate overlay pass**

In `render()` give the local entity its authenticated UID, collect visible player entities, and draw bubbles after all characters/enemies:

```js
const playerEntities = [];
// While drawing each visible player entity:
playerEntities.push(entity);

const bubbles = latestBubblesByUid(this.chatMessages, {
  mapId: this.mapId,
  now: Date.now(),
});
for (const entity of playerEntities) {
  const message = bubbles.get(entity.uid);
  if (message) drawChatBubble(ctx, entity, message, cameraX, cameraY, viewW, viewH);
}
```

The local entity must use `uid: this.network?.uid || "local-player"`; remote entities already carry their UID.

Add this Canvas renderer near `drawPixelCharacter()`:

```js
function drawChatBubble(ctx, player, message, cameraX, cameraY, viewportWidth, viewportHeight) {
  ctx.save();
  ctx.font = "700 13px Pretendard, 'Noto Sans KR', sans-serif";
  const screen = worldToScreen({
    worldX: player.x,
    worldY: player.y,
    cameraX,
    cameraY,
    zoom: 1,
  });
  const layout = layoutChatBubble({
    text: message.text,
    measureText: text => ctx.measureText(text).width,
    anchor: { x: screen.x, topY: screen.y - 62, bottomY: screen.y + 24 },
    viewportWidth,
    viewportHeight,
  });
  const { box, tail, lines } = layout;
  ctx.fillStyle = "rgba(8,15,27,.94)";
  ctx.strokeStyle = "rgba(255,255,255,.28)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.roundRect(box.x, box.y, box.width, box.height, 8);
  ctx.fill();
  ctx.stroke();
  ctx.beginPath();
  if (tail.direction === "down") {
    ctx.moveTo(tail.x - 6, tail.y);
    ctx.lineTo(tail.x + 6, tail.y);
    ctx.lineTo(tail.x, tail.y + tail.height);
  } else {
    ctx.moveTo(tail.x - 6, tail.y);
    ctx.lineTo(tail.x + 6, tail.y);
    ctx.lineTo(tail.x, tail.y - tail.height);
  }
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = "#f8fafc";
  ctx.textAlign = "left";
  ctx.textBaseline = "top";
  lines.forEach((line, index) => {
    ctx.fillText(line, box.x + box.paddingX, box.y + box.paddingY + index * box.lineHeight);
  });
  ctx.restore();
}
```

- [ ] **Step 9: Extend browser smoke coverage for offline safety and Escape priority**

Retain this exact deterministic route before navigation, then add assertions after entering:

```js
await page.route("https://www.gstatic.com/**", route => route.abort());
```

```js
assert.equal(await page.locator("#chatPanel").isVisible(), true);
assert.equal(await page.locator("#chatInput").isDisabled(), true);
assert.match(await page.locator("#chatStatus").textContent(), /오프라인/);
```

Before the final exit-button flow, verify an offline `Enter` does not trap focus or break `Escape`:

```js
await page.keyboard.press("Enter");
assert.equal(await page.locator("#chatInput").isFocused(), false);
await page.keyboard.press("Escape");
assert.equal(await page.locator("#exitOverlay").isVisible(), true);
await page.locator("#cancelExitButton").click();
```

The Unicode wrapping, corners, tail reversal, and virtual zoom are already covered by pure layout tests; the browser smoke test confirms the production DOM, offline mode, and exit flow without requiring live Firebase credentials.

- [ ] **Step 10: Run full unit and browser smoke verification**

Run: `node --test tests/*.test.mjs`

Expected: all tests pass.

Start a local static server in the repository, then run:

```powershell
$env:PIXEL_WORLD_URL='http://127.0.0.1:4173'
$env:PLAYWRIGHT_BROWSER_PATH='C:\Program Files (x86)\Google\Chrome\Application\chrome.exe'
node tests/browser-smoke.cjs
```

Expected: exit 0, no page errors, offline chat is disabled, and `Escape` still opens/cancels the exit dialog.

- [ ] **Step 11: Commit game and speech-bubble integration**

```powershell
git add -- src/game.js src/main.js tests/browser-smoke.cjs tests/static-chat-integration.test.mjs
git commit -m "플레이어 채팅 말풍선 통합"
```

---

### Task 6: Documentation, Firebase Deployment Notes, and Mandatory Secret Audit

**Files:**
- Modify: `README.md`
- Modify: `FIREBASE_SETUP.md`

**Interfaces:**
- Documents the runtime path `rooms/public/chat/{uid}/{messageId}` and the owner-only rule model
- Produces the final security report required by the user; it does not store any credential value

- [ ] **Step 1: Document chat controls, retention, and Firebase rule deployment**

Add these facts to README/Firebase setup prose:

```markdown
## 전체 월드 채팅

- `Enter`: 채팅 입력 및 전송
- 입력 중 `Esc`: 채팅 취소
- 모든 지역의 최근 메시지 최대 50개 표시
- 같은 지역의 캐릭터 머리 위에는 최신 메시지를 4초간 표시
- 플레이어별 최근 5개 메시지만 유지하며 퇴장·연결 종료 시 해당 UID의 채팅을 삭제

채팅 데이터는 `rooms/public/chat/{uid}/{messageId}`에 저장됩니다. 갱신된
`database.rules.json`을 배포하지 않으면 채팅 쓰기가 거부됩니다.
```

- [ ] **Step 2: Run fresh complete verification**

Run: `node --test tests/*.test.mjs`

Expected: every unit/static test passes with 0 failures.

Run: `Get-Content -Raw database.rules.json | ConvertFrom-Json | Out-Null`

Expected: exit 0.

Run the browser smoke procedure from Task 5 again.

Expected: exit 0 and no page errors.

If the user separately authorizes deployment of the updated rules and client, open two private browser sessions with different nicknames and verify this exact matrix; otherwise report every row as `배포 승인 전 확인 필요`:

```text
Session A village -> Session B forest: both messages appear in the global panel
Different regions: neither character bubble renders on the other region
Both sessions village: each newest message renders above the matching character for 4 seconds
Session B exits: all Session B messages disappear after its chat UID subtree is removed
Session A remains: movement, Ctrl/Q attacks, portals, and exit continue working
```

- [ ] **Step 3: Run a tracked-file secret scan without printing matched values**

```powershell
$patterns = @(
  @{ Name='Google API key'; Regex='AIza[0-9A-Za-z_-]{35}' },
  @{ Name='Private key block'; Regex='-----BEGIN (RSA |EC |OPENSSH )?PRIVATE KEY-----' },
  @{ Name='Service account private_key'; Regex='"private_key"\s*:' },
  @{ Name='GitHub token'; Regex='gh[pousr]_[0-9A-Za-z]{20,}' },
  @{ Name='AWS access key'; Regex='AKIA[0-9A-Z]{16}' },
  @{ Name='OpenAI-style key'; Regex='sk-[0-9A-Za-z_-]{20,}' }
)
$findings = @()
foreach ($file in (git ls-files)) {
  if (-not (Test-Path -LiteralPath $file -PathType Leaf)) { continue }
  $lineNumber = 0
  Get-Content -LiteralPath $file -ErrorAction SilentlyContinue | ForEach-Object {
    $lineNumber++
    foreach ($pattern in $patterns) {
      if ($_ -match $pattern.Regex) {
        $findings += [pscustomobject]@{ Type=$pattern.Name; File=$file; Line=$lineNumber }
      }
    }
  }
}
$findings | Sort-Object Type,File,Line | Format-Table -AutoSize
```

Expected: only the known Firebase Web API identifier may appear in `src/firebase-config.js`. Any private key, service-account `private_key`, GitHub token, AWS key, or OpenAI-style key blocks completion and requires revocation/rotation before publishing.

Then scan commit diffs for a high-risk key that was added and removed before the final tree:

```powershell
$historyPatterns = @(
  'BEGIN (RSA |EC |OPENSSH )?PRIVATE KEY',
  '"private_key"[[:space:]]*:',
  'AKIA[0-9A-Z]{16}',
  'gh[pousr]_[0-9A-Za-z]{20,}',
  'sk-[0-9A-Za-z_-]{20,}'
)
$historyHits = @()
foreach ($pattern in $historyPatterns) {
  $files = git log --all -G $pattern --format='%h' --name-only -- 2>$null |
    Where-Object { $_ -and $_ -notmatch '^[0-9a-f]{7,40}$' } |
    Sort-Object -Unique
  foreach ($file in $files) { $historyHits += $file }
}
$historyHits | Sort-Object -Unique
```

Expected: no output. Any file output requires inspection without printing the matched credential, followed by revocation/rotation if it was a real admin credential.

- [ ] **Step 4: Inspect the actual diff and workflow secret references**

Run:

```powershell
git diff --check
git status -sb
git diff --stat 5427a9d...HEAD
rg -n "firebaseServiceAccount|FIREBASE_SERVICE_ACCOUNT" .github/workflows
```

Expected:

- No whitespace errors.
- Only intended chat/spec/docs files changed.
- The Firebase deployment workflow contains only `${{ secrets.FIREBASE_SERVICE_ACCOUNT_PIXEL_WORLD_8CB9B }}` and never a JSON value or private key.

- [ ] **Step 5: Record console-only checks honestly in the handoff**

The completion report must include this exact status model:

```text
Firebase Web API key: expected public client identifier; tracked location reported
Firebase Admin/service-account key in code/history: not detected, or BLOCKED with exact file only
Other high-risk key patterns: not detected, or BLOCKED with exact file only
Realtime Database rules file: JSON valid; authenticated read and owner-only player/chat writes verified
Google Cloud HTTP referrer/API restrictions: verified only if the console was actually inspected; otherwise 확인 필요
Firebase App Check enforcement: verified only if the console was actually inspected; otherwise 확인 필요
GitHub Secret scanning open alerts: verified only if the Security page/API was actually inspected; otherwise 확인 필요
Firebase deployment workflow secret: reference-only in Git; Actions secret value/existence 확인 필요 unless console inspected
```

- [ ] **Step 6: Commit documentation**

```powershell
git add -- README.md FIREBASE_SETUP.md
git commit -m "전체 채팅과 Firebase 보안 안내 추가"
```

- [ ] **Step 7: Stop before publishing and present integration choices**

Do not push, deploy Firebase rules/Hosting, close Secret scanning alerts, change repository visibility, or enable App Check without the user's explicit approval. Report the branch name, commits, test counts, browser smoke result, and the full security status from Step 5.
