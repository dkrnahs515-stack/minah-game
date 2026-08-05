# 픽셀 월드 실시간 전체 채팅 구현 계획

> **에이전트 작업자 안내:** 필수 하위 스킬인 `superpowers:subagent-driven-development`(추천) 또는 `superpowers:executing-plans`를 사용해 이 계획을 작업 단위로 구현합니다. 각 단계는 진행 상황을 추적할 수 있도록 체크박스(`- [ ]`) 형식을 사용합니다.

**목표:** Firebase 기반 전체 월드 채팅을 추가하고, 왼쪽 아래 메시지 패널·Enter 채팅 조작·4초간 표시되는 플레이어 말풍선·접속 종료 시 해당 플레이어 메시지 자동 삭제를 구현합니다.

**구조:** 순수 모듈이 채팅 검증·메시지 정렬·오래된 메시지 정리·화면 좌표 기반 말풍선 배치를 담당합니다. Firebase 채팅 어댑터는 기존 인증 앱과 데이터베이스 연결을 재사용해 접속 중인 UID마다 메시지를 최대 5개 저장하고, DOM 컨트롤러는 채팅 포커스와 화면 표시를 담당합니다. `PixelRPG`는 기존 닉네임·나가기·포탈·전투·지역별 플레이어 표시 흐름을 변경하지 않으면서 컨트롤러, 네트워크 콜백, 게임 입력 차단, Canvas 말풍선 렌더링을 조정합니다.

**기술 구성:** HTML5 Canvas, 네이티브 JavaScript ES 모듈, Firebase Authentication/Realtime Database 12.16.0, Node.js `node:test`, Playwright 브라우저 스모크 테스트, GitHub Pages/Firebase Hosting.

## 구현 검토 반영 사항

2026-08-05 코드 검토 승인에 따라 아래 보완사항을 적용했습니다. 이후의 초기 코드 예시보다 실제 구현 파일과 이 목록을 우선 기준으로 사용합니다.

- 메시지 80자는 `Intl.Segmenter`의 grapheme 단위로 검사해 복합 이모지를 분리하지 않습니다.
- 80자 초과 메시지는 조용히 자르지 않고 오류로 안내합니다.
- 새 메시지 추가와 오래된 메시지 삭제를 하나의 Firebase `update()`로 처리합니다.
- UID별 채팅 규칙에 객체 구조와 최대 5개 하위 메시지 제한을 추가했습니다.
- `.info/connected`가 다시 `true`가 될 때 플레이어와 채팅의 `onDisconnect()`를 모두 재등록합니다.
- 전송 중에는 입력을 잠가 빠른 Enter로 중복 요청이 발생하지 않도록 합니다.
- 좁고 낮은 화면에서도 상자가 안전 영역을 넘지 않도록 표시 가능 줄 수를 자동 축소합니다.
- 실제 브라우저에서 온라인 가짜 Firebase 전송·입력 차단·Escape 우선순위와 기존 네 지역 포탈 회귀를 검증합니다.

## 구현 커밋

- `254c923`: 전체 채팅 상태 로직
- `6d221d3`: 말풍선 화면 경계 배치
- `223e439`: Firebase 전체 채팅 동기화와 보안 규칙
- `4e5217d`: 전체 채팅 UI 컨트롤러
- `2bd705e`: 플레이어 채팅 말풍선 통합

## 전체 공통 제약사항

- 채팅 범위는 `village`, `volcano`, `forest`, `coast` 전 지역이 공유하는 `public` 방 전체입니다.
- 채팅 패널에는 유효한 메시지를 최대 50개 표시하며, 접속 중인 UID별 서버 메시지는 최대 5개 저장합니다.
- 메시지의 연속 공백은 하나로 정규화하고 1~80개의 유니코드 문자만 허용하며, 자신이 직전에 보낸 메시지와 같은 내용을 연속 전송할 수 없습니다.
- 메시지를 성공적으로 보낸 뒤 다음 전송까지 1초를 기다려야 합니다.
- `Enter`로 입력창을 열고 다시 `Enter`로 전송하며 `Escape`로 취소합니다. 입력창에 포커스가 있는 동안에는 게임 이동과 공격 입력을 차단합니다.
- `Escape`는 기존 나가기 확인창을 열기 전에 채팅 입력창을 먼저 닫습니다.
- 말풍선은 4초 동안 유지되며 현재 지역에서 보이는 캐릭터에만 표시합니다. 채팅 패널의 내용은 전 지역 공통으로 유지합니다.
- 말풍선 너비는 `min(240px, viewportWidth × 0.45)`이고 최대 4줄, 화면 가장자리 8px 여백, 유니코드 안전 말줄임표, 상하 배치 반전, 상자 모서리에서 12px 떨어지도록 제한한 말꼬리를 적용합니다.
- Canvas 렌더 품질 배율이 논리적 말풍선 글자와 상자 크기를 바꾸면 안 됩니다. 향후 카메라 줌은 월드 좌표 기준 앵커에만 적용합니다.
- 정상적인 나가기와 `onDisconnect()` 모두 `rooms/{roomId}/chat/{uid}`를 삭제합니다.
- 패키지 관리자, 번들러, 영구 채팅 기록, 개인 메시지, 서버형 운영 도구, 파일 업로드, 신규 서버 런타임은 추가하지 않습니다.
- 기존 닉네임 입장, 나가기, 포탈, 전투, 부활, 144Hz 시뮬레이션, Firebase 플레이어 동기화 기능을 그대로 보존합니다.
- Firebase Admin/서비스 계정 키 또는 다른 실제 비밀정보를 추적 파일, 변경 내역, 테스트, 문서, 로그에 추가하면 안 됩니다. 최종 보고에서는 공개가 전제된 Firebase 웹 API 식별자와 실제 관리자 자격 증명을 구분하고, 콘솔에서만 확인 가능한 항목은 미확인으로 표시합니다.
- 로컬 채팅 브랜치는 트리 커밋 `5427a9d`에서 시작합니다. 원격 `main`에는 동일한 월드 트리가 다른 SHA의 스쿼시 커밋으로 포함되어 있으므로 로컬 변경 범위는 `git diff 5427a9d...HEAD`로 검토합니다.

---

### 작업 1: 순수 채팅 상태, 검증, 정렬, 메시지 정리

**파일:**
- 생성: `src/chat-state.js`
- 생성: `tests/chat-state.test.mjs`

**인터페이스:**
- 사용: `src/world-data.js`의 `WORLD_IDS`
- 제공: `CHAT_LIMITS: { maxCharacters: 80, panelMessages: 50, messagesPerPlayer: 5, cooldownMs: 1000, bubbleDurationMs: 4000 }`
- 제공: `normalizeChatText(value): string`
- 제공: `validateChatDraft(value, previousText): { ok: boolean, text: string, error: string }`
- 제공: `flattenChatMessages(raw, limit?): Array<ChatMessage>`
- 제공: `messageIdsToPrune(rawUserMessages, limit?): string[]`
- 제공: `latestBubblesByUid(messages, options): Map<string, ChatMessage>`

- [ ] **1단계: 정규화·검증·평탄화·오래된 메시지 정리·말풍선 선택 실패 테스트 작성**

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

test("채팅 문자열은 유니코드 문자를 나누지 않고 공백을 정규화한다", () => {
  assert.equal(normalizeChatText("  안녕\n\t월드 😀  "), "안녕 월드 😀");
  assert.equal(Array.from(normalizeChatText("😀".repeat(90))).length, CHAT_LIMITS.maxCharacters);
});

test("메시지 초안 검증은 빈 문자열과 직전 메시지 중복을 거부한다", () => {
  assert.equal(validateChatDraft("   ", "").ok, false);
  assert.equal(validateChatDraft(" 안녕  월드 ", "안녕 월드").ok, false);
  assert.deepEqual(validateChatDraft(" 안녕  월드 ", "이전"), {
    ok: true,
    text: "안녕 월드",
    error: "",
  });
});

test("플레이어별 중첩 메시지는 전체 목록으로 합치고 잘못된 기록을 버린 뒤 최신 50개를 유지한다", () => {
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

test("플레이어별 메시지 정리는 5개를 초과한 가장 오래된 ID를 반환한다", () => {
  const raw = Object.fromEntries(Array.from({ length: 7 }, (_, index) => [
    `m${index}`,
    { text: `m${index}`, name: "별", mapId: "village", createdAt: 100 + index },
  ]));
  assert.deepEqual(messageIdsToPrune(raw), ["m0", "m1"]);
});

test("최신 말풍선은 현재 지역의 유효 시간이 남은 메시지만 포함한다", () => {
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

- [ ] **2단계: 채팅 상태 테스트를 실행해 모듈 누락으로 실패하는지 확인**

실행: `node --test tests/chat-state.test.mjs`

예상 결과: `src/chat-state.js`에 대한 `ERR_MODULE_NOT_FOUND` 오류로 실패합니다.

- [ ] **3단계: 순수 채팅 상태 모듈 구현**

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

- [ ] **4단계: 해당 테스트와 전체 단위 테스트 모음 실행**

실행: `node --test tests/chat-state.test.mjs`

예상 결과: 테스트 5개가 통과합니다.

실행: `node --test tests/*.test.mjs`

예상 결과: 기존 테스트와 채팅 상태 테스트 5개가 모두 통과합니다.

- [ ] **5단계: 순수 상태 모듈 작업 커밋**

```powershell
git add -- src/chat-state.js tests/chat-state.test.mjs
git commit -m "전체 채팅 상태 로직 추가"
```

---

### 작업 2: 유니코드 줄바꿈과 화면 경계 안전 말풍선 배치

**파일:**
- 생성: `src/chat-bubble-layout.js`
- 생성: `tests/chat-bubble-layout.test.mjs`

**인터페이스:**
- 사용: `chat-state.js`에서 정규화한 메시지 문자열
- 제공: `worldToScreen(options): { x: number, y: number }`
- 제공: `wrapChatText(text, measureText, maxWidth, maxLines?): string[]`
- 제공: `layoutChatBubble(options): { lines: string[], box: Rect, tail: Tail, placement: "above" | "below" }`

- [ ] **1단계: 한국어·이모지 줄바꿈, 네 모서리, 상하 반전, 말꼬리 제한, 줌 앵커 실패 테스트 작성**

```js
// tests/chat-bubble-layout.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import { layoutChatBubble, worldToScreen, wrapChatText } from "../src/chat-bubble-layout.js";

const measure = text => Array.from(text).length * 10;

test("줄바꿈은 유니코드를 온전히 유지하고 4줄 이후 말줄임표를 적용한다", () => {
  const lines = wrapChatText("한글 English 😀 ".repeat(12), measure, 100, 4);
  assert.equal(lines.length, 4);
  assert.equal(lines.at(-1).endsWith("…"), true);
  assert.equal(lines.join("").includes("\uFFFD"), false);
});

test("말풍선은 모든 화면 가장자리에서 8픽셀 여백 안쪽에 머문다", () => {
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

test("화면 위쪽 공간이 부족한 말풍선은 아래로 이동하고 말꼬리를 반전한다", () => {
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

test("수평 위치 보정 후 말꼬리는 둥근 모서리에서 떨어진 위치를 유지한다", () => {
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

test("카메라 줌은 월드 좌표 앵커만 이동시킨다", () => {
  assert.deepEqual(worldToScreen({ worldX: 120, worldY: 80, cameraX: 20, cameraY: 10, zoom: 1.5 }), {
    x: 150,
    y: 105,
  });
});
```

- [ ] **2단계: 배치 테스트를 실행해 모듈 누락으로 실패하는지 확인**

실행: `node --test tests/chat-bubble-layout.test.mjs`

예상 결과: `src/chat-bubble-layout.js`에 대한 `ERR_MODULE_NOT_FOUND` 오류로 실패합니다.

- [ ] **3단계: 유니코드 분할, 줄바꿈, 말풍선 배치 구현**

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

- [ ] **4단계: 배치 테스트와 전체 단위 테스트 모음 실행**

실행: `node --test tests/chat-bubble-layout.test.mjs`

예상 결과: 테스트 5개가 통과합니다.

실행: `node --test tests/*.test.mjs`

예상 결과: 모든 테스트가 통과합니다.

- [ ] **5단계: 말풍선 배치 모듈 작업 커밋**

```powershell
git add -- src/chat-bubble-layout.js tests/chat-bubble-layout.test.mjs
git commit -m "말풍선 화면 경계 배치 추가"
```

---

### 작업 3: Firebase 채팅 어댑터, 접속 종료 정리, 보안 규칙

**파일:**
- 생성: `src/chat-network.js`
- 수정: `src/network.js`
- 수정: `database.rules.json`
- 생성: `tests/chat-network.test.mjs`
- 생성: `tests/database-rules.test.mjs`

**인터페이스:**
- 사용: `chat-state.js`의 `flattenChatMessages()`와 `messageIdsToPrune()`
- 제공: `createOfflineChatAdapter(): ChatAdapter`
- 제공: `createFirebaseChatAdapter(options): Promise<ChatAdapter>`
- 변경: `createNetworkAdapter(callbacks)`가 `{ mode, uid, publish, chat, stop }`을 반환
- `ChatAdapter.send(payload)`는 `{ text, name, mapId }`를 받아 `{ ok: boolean, error: string }`을 반환

- [ ] **1단계: 주입한 Firebase 가짜 모듈을 사용하는 어댑터 실패 테스트 작성**

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

test("오프라인 어댑터는 예외 없이 메시지 전송을 거부한다", async () => {
  assert.deepEqual(await createOfflineChatAdapter().send({ text: "hello" }), {
    ok: false,
    error: "채팅 서버가 오프라인입니다.",
  });
});

test("Firebase 어댑터는 전체 채팅을 구독하고 자신의 UID 아래에 기록하며 종료 시 하위 트리를 삭제한다", async () => {
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

- [ ] **2단계: 채팅 보안 규칙 구조 실패 테스트 작성**

```js
// tests/database-rules.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("채팅 규칙은 인증·UID 소유권·문자 수 제한·유효한 지역·추가 필드 금지를 요구한다", async () => {
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

- [ ] **3단계: 관련 테스트를 실행해 어댑터와 규칙 누락으로 실패하는지 확인**

실행: `node --test tests/chat-network.test.mjs tests/database-rules.test.mjs`

예상 결과: `src/chat-network.js`와 `chat` 규칙이 없으므로 실패합니다.

- [ ] **4단계: UID별 오래된 메시지 정리와 접속 종료 정리를 포함한 Firebase 채팅 어댑터 구현**

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

- [ ] **5단계: 인증된 단일 Firebase 연결에 채팅 어댑터 통합**

플레이어와 채팅 어댑터가 하나의 앱·데이터베이스·익명 사용자를 공유하도록 `src/network.js`를 다음 콜백 객체 방식으로 교체합니다.

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

- [ ] **6단계: 인증·작성자 전용·필드 제한 채팅 규칙 추가**

`rooms/$roomId` 아래의 `players`와 같은 단계에 다음 규칙을 추가합니다.

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

- [ ] **7단계: 어댑터·규칙·전체 단위 테스트 모음 실행**

실행: `node --test tests/chat-network.test.mjs tests/database-rules.test.mjs`

예상 결과: 관련 테스트 3개가 통과합니다.

실행: `node --test tests/*.test.mjs`

예상 결과: 모든 테스트가 통과합니다.

실행: `Get-Content -Raw database.rules.json | ConvertFrom-Json | Out-Null`

예상 결과: PowerShell이 종료 코드 0으로 끝납니다.

- [ ] **8단계: 네트워크와 서버 규칙 통합 작업 커밋**

```powershell
git add -- src/chat-network.js src/network.js database.rules.json tests/chat-network.test.mjs tests/database-rules.test.mjs
git commit -m "Firebase 전체 채팅 동기화 추가"
```

---

### 작업 4: 왼쪽 아래 채팅 UI, Enter/Escape 흐름, 오프라인 상태

**파일:**
- 생성: `src/chat-controller.js`
- 생성: `tests/chat-controller.test.mjs`
- 생성: `tests/static-chat-ui.test.mjs`
- 수정: `index.html`
- 수정: `styles.css`

**인터페이스:**
- 제공: `chatKeyAction({ code, typing, running, exitOpen }): "open" | "cancel" | null`
- 제공: `ChatController` 메서드 `open()`, `cancel()`, `submit()`, `setMode()`, `renderMessages()`, `reset()`, `isTyping()`
- 작업 5에서 `PixelRPG`를 통해 사용: 컨트롤러 포커스 및 전송 메서드

- [ ] **1단계: 키 입력 우선순위와 정적 UI 구조 실패 테스트 작성**

```js
// tests/chat-controller.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import { chatKeyAction } from "../src/chat-controller.js";

test("Enter는 게임 실행 중이고 나가기 확인창이 닫힌 경우에만 채팅을 연다", () => {
  assert.equal(chatKeyAction({ code: "Enter", typing: false, running: true, exitOpen: false }), "open");
  assert.equal(chatKeyAction({ code: "Enter", typing: false, running: true, exitOpen: true }), null);
});

test("Escape는 나가기 확인창보다 채팅을 먼저 취소한다", () => {
  assert.equal(chatKeyAction({ code: "Escape", typing: true, running: true, exitOpen: false }), "cancel");
  assert.equal(chatKeyAction({ code: "Escape", typing: false, running: true, exitOpen: false }), null);
});
```

```js
// tests/static-chat-ui.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("채팅 패널은 접근 가능한 상태·메시지 목록·입력 폼·길이 제한 입력창을 포함한다", async () => {
  const html = await readFile(new URL("../index.html", import.meta.url), "utf8");
  assert.match(html, /id="chatPanel"/);
  assert.match(html, /id="chatMessages"/);
  assert.match(html, /id="chatForm"/);
  assert.match(html, /id="chatInput"[^>]+maxlength="80"/);
  assert.match(html, /aria-live="polite"/);
});

test("채팅 패널은 데스크톱부터 모바일까지 상호작용 가능하고 반응형으로 동작한다", async () => {
  const css = await readFile(new URL("../styles.css", import.meta.url), "utf8");
  assert.match(css, /\.chat-panel[^}]+pointer-events:\s*auto/s);
  assert.match(css, /@media \(max-width: 520px\)[\s\S]+\.chat-panel/);
});
```

- [ ] **2단계: 컨트롤러와 정적 UI 테스트를 실행해 실패 확인**

실행: `node --test tests/chat-controller.test.mjs tests/static-chat-ui.test.mjs`

예상 결과: 모듈과 마크업이 없으므로 실패합니다.

- [ ] **3단계: `#hud` 안에 채팅 패널 마크업 추가**

`#message` 다음, 미니맵 앞에 배치합니다.

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

- [ ] **4단계: 단축키 표시줄을 가리지 않는 반응형 패널 스타일 추가**

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

기존 `@media (max-width: 520px)` 블록 안에 다음 내용을 추가합니다.

```css
.chat-panel { bottom: 76px; max-height: 205px; }
.chat-messages { height: 105px; }
```

- [ ] **5단계: 재전송 대기·중복 검사·텍스트 전용 렌더링·포커스 상태를 포함한 컨트롤러 구현**

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

- [ ] **6단계: 컨트롤러·정적 UI·전체 단위 테스트 모음 실행**

실행: `node --test tests/chat-controller.test.mjs tests/static-chat-ui.test.mjs`

예상 결과: 관련 테스트 4개가 통과합니다.

실행: `node --test tests/*.test.mjs`

예상 결과: 모든 테스트가 통과합니다.

- [ ] **7단계: 채팅 UI와 컨트롤러 작업 커밋**

```powershell
git add -- src/chat-controller.js index.html styles.css tests/chat-controller.test.mjs tests/static-chat-ui.test.mjs
git commit -m "전체 채팅 UI 컨트롤러 추가"
```

---

### 작업 5: 게임 흐름 연동과 Canvas 말풍선

**파일:**
- 수정: `src/game.js`
- 수정: `src/main.js`
- 수정: `tests/browser-smoke.cjs`
- 생성: `tests/static-chat-integration.test.mjs`

**인터페이스:**
- 사용: `ChatController`, `latestBubblesByUid()`, `layoutChatBubble()`, `worldToScreen()`
- `main.js`에 제공: `openChatInput()`, `cancelChatInput()`, `isChatTyping()`
- 내부 메서드 제공: `sendChat(text)`, `receiveChatMessages(messages)`, `drawChatBubble(ctx, entity, message, cameraX, cameraY)`

- [ ] **1단계: 게임 연동 전 정적 통합 실패 테스트 작성**

```js
// tests/static-chat-integration.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("게임은 컨트롤러·전체 메시지·입력 차단·말풍선 오버레이를 연동한다", async () => {
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

- [ ] **2단계: 통합 테스트를 실행해 실패 확인**

실행: `node --test tests/static-chat-integration.test.mjs`

예상 결과: `game.js`와 `main.js`에 채팅 연동 코드가 아직 없으므로 실패합니다.

- [ ] **3단계: 채팅 컨트롤러 생성과 게임 채팅 상태 초기화**

다음 모듈을 가져옵니다.

```js
import { layoutChatBubble, worldToScreen } from "./chat-bubble-layout.js";
import { ChatController } from "./chat-controller.js";
import { latestBubblesByUid } from "./chat-state.js";
```

생성자에 다음 내용을 추가합니다.

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

- [ ] **4단계: 기존 Firebase 네트워크 생명주기에 채팅 콜백 연결**

`enter()`의 위치 인자 방식 `createNetworkAdapter` 호출을 다음과 같이 교체합니다.

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

`leave()`에서는 네트워크 어댑터가 정지한 뒤 `this.chat.reset()`을 호출하고, `chatMessages`를 비우며, `chatInputActive = false`로 설정합니다.

- [ ] **5단계: 공개 포커스 메서드와 네트워크 송수신 연동 추가**

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

- [ ] **6단계: `main.js`에 DOM 요소와 Enter/Escape 우선순위 연결**

`chatKeyAction`을 가져오고 `elements`에 `chatPanel`, `chatMessages`, `chatForm`, `chatInput`, `chatStatus`를 추가한 다음, 전역 Escape 전용 이벤트 처리기를 다음 코드로 교체합니다.

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

기존 `exitButton`, `cancelExitButton`, `confirmExitButton`, `pagehide` 이벤트 처리기는 그대로 유지하고 전역 키보드 이벤트 처리기만 교체합니다.

- [ ] **7단계: 채팅 활성화 중 이동과 공격 입력 차단**

`keydown` 입력 차단 조건에 `this.chatInputActive`를 추가합니다.

```js
if (!this.running || !this.inputEnabled || this.chatInputActive || isTypingTarget(event.target)) return;
```

`updatePlayerMovement()`도 두 상태를 모두 확인하도록 변경합니다.

```js
const movement = this.inputEnabled && !this.chatInputActive
  ? movementVector(this.keys)
  : { x: 0, y: 0 };
```

- [ ] **8단계: 별도의 오버레이 단계에서 말풍선 렌더링**

`render()`에서 로컬 캐릭터에 인증된 UID를 지정하고, 현재 보이는 플레이어 객체를 모은 뒤, 모든 캐릭터와 몬스터를 그린 다음 말풍선을 그립니다.

```js
const playerEntities = [];
// 화면에 보이는 각 플레이어 객체를 그리는 동안:
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

로컬 객체는 `uid: this.network?.uid || "local-player"`를 사용해야 하며, 원격 객체에는 이미 각 UID가 들어 있습니다.

다음 Canvas 렌더러를 `drawPixelCharacter()` 가까이에 추가합니다.

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

- [ ] **9단계: 오프라인 안전성과 Escape 우선순위 브라우저 스모크 검사 확장**

페이지 이동 전에 다음과 같은 결정적 네트워크 차단 경로를 그대로 유지하고, 입장 후 검증을 추가합니다.

```js
await page.route("https://www.gstatic.com/**", route => route.abort());
```

```js
assert.equal(await page.locator("#chatPanel").isVisible(), true);
assert.equal(await page.locator("#chatInput").isDisabled(), true);
assert.match(await page.locator("#chatStatus").textContent(), /오프라인/);
```

마지막 나가기 버튼 흐름을 검사하기 전에 오프라인 상태의 `Enter`가 포커스를 가두거나 `Escape` 동작을 깨뜨리지 않는지 확인합니다.

```js
await page.keyboard.press("Enter");
assert.equal(await page.locator("#chatInput").isFocused(), false);
await page.keyboard.press("Escape");
assert.equal(await page.locator("#exitOverlay").isVisible(), true);
await page.locator("#cancelExitButton").click();
```

유니코드 줄바꿈, 네 모서리, 말꼬리 반전, 가상 줌은 순수 배치 테스트에서 이미 검증합니다. 브라우저 스모크 테스트는 실제 Firebase 자격 증명 없이 운영 DOM, 오프라인 상태, 나가기 흐름을 확인합니다.

- [ ] **10단계: 전체 단위 테스트와 브라우저 스모크 검증 실행**

실행: `node --test tests/*.test.mjs`

예상 결과: 모든 테스트가 통과합니다.

저장소에서 로컬 정적 서버를 시작한 뒤 다음 명령을 실행합니다.

```powershell
$env:PIXEL_WORLD_URL='http://127.0.0.1:4173'
$env:PLAYWRIGHT_BROWSER_PATH='C:\Program Files (x86)\Google\Chrome\Application\chrome.exe'
node tests/browser-smoke.cjs
```

예상 결과: 종료 코드 0, 페이지 오류 없음, 오프라인 채팅 비활성화, `Escape`로 나가기 확인창 열기와 취소가 정상 동작합니다.

- [ ] **11단계: 게임과 말풍선 통합 작업 커밋**

```powershell
git add -- src/game.js src/main.js tests/browser-smoke.cjs tests/static-chat-integration.test.mjs
git commit -m "플레이어 채팅 말풍선 통합"
```

---

### 작업 6: 문서, Firebase 배포 안내, 필수 비밀정보 감사

**파일:**
- 수정: `README.md`
- 수정: `FIREBASE_SETUP.md`

**인터페이스:**
- 런타임 경로 `rooms/public/chat/{uid}/{messageId}`와 작성자 전용 규칙 모델 문서화
- 사용자가 요청한 최종 보안 보고서 제공. 자격 증명 값은 어떤 것도 저장하지 않음

- [ ] **1단계: 채팅 조작, 보존 범위, Firebase 규칙 배포 방법 문서화**

README와 Firebase 설정 안내에 다음 내용을 추가합니다.

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

- [ ] **2단계: 전체 검증을 처음부터 다시 실행**

실행: `node --test tests/*.test.mjs`

예상 결과: 모든 단위·정적 테스트가 실패 0건으로 통과합니다.

실행: `Get-Content -Raw database.rules.json | ConvertFrom-Json | Out-Null`

예상 결과: 종료 코드 0입니다.

작업 5의 브라우저 스모크 절차를 다시 실행합니다.

예상 결과: 종료 코드 0이며 페이지 오류가 없습니다.

사용자가 변경된 규칙과 클라이언트 배포를 별도로 승인하면 서로 다른 닉네임으로 비공개 브라우저 세션 두 개를 열어 다음 항목을 정확히 검증합니다. 승인하지 않았다면 모든 항목을 `배포 승인 전 확인 필요`로 보고합니다.

```text
세션 A 마을 -> 세션 B 숲: 두 메시지가 모두 전체 채팅 패널에 표시됨
서로 다른 지역: 상대 지역의 캐릭터 말풍선은 표시되지 않음
두 세션 모두 마을: 각 최신 메시지가 해당 캐릭터 위에 4초간 표시됨
세션 B 퇴장: 채팅 UID 하위 트리 삭제 후 세션 B의 모든 메시지가 사라짐
세션 A 유지: 이동, Ctrl/Q 공격, 포탈, 나가기 기능이 계속 동작함
```

- [ ] **3단계: 일치한 값을 출력하지 않는 추적 파일 비밀정보 검사 실행**

```powershell
$patterns = @(
  @{ Name='Google API 키'; Regex='AIza[0-9A-Za-z_-]{35}' },
  @{ Name='개인 키 블록'; Regex='-----BEGIN (RSA |EC |OPENSSH )?PRIVATE KEY-----' },
  @{ Name='서비스 계정 private_key'; Regex='"private_key"\s*:' },
  @{ Name='GitHub 토큰'; Regex='gh[pousr]_[0-9A-Za-z]{20,}' },
  @{ Name='AWS 액세스 키'; Regex='AKIA[0-9A-Z]{16}' },
  @{ Name='OpenAI 형식 키'; Regex='sk-[0-9A-Za-z_-]{20,}' }
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

예상 결과: 알려진 Firebase 웹 API 식별자만 `src/firebase-config.js`에 나타날 수 있습니다. 개인 키, 서비스 계정 `private_key`, GitHub 토큰, AWS 키, OpenAI 형식 키가 발견되면 작업 완료를 중단하고 게시 전에 해당 키를 폐기·교체해야 합니다.

다음으로 최종 파일 상태에서는 삭제되었지만 이전 커밋에서 추가되었던 고위험 키가 있는지 커밋 변경 내역을 검사합니다.

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

예상 결과: 출력이 없어야 합니다. 파일이 출력되면 일치한 자격 증명 값을 표시하지 않고 조사하며, 실제 관리자 자격 증명이었다면 폐기·교체합니다.

- [ ] **4단계: 실제 변경 내역과 워크플로 비밀정보 참조 검사**

실행:

```powershell
git diff --check
git status -sb
git diff --stat 5427a9d...HEAD
rg -n "firebaseServiceAccount|FIREBASE_SERVICE_ACCOUNT" .github/workflows
```

예상 결과:

- 공백 오류가 없습니다.
- 의도한 채팅·설계·문서 파일만 변경되었습니다.
- Firebase 배포 워크플로에는 `${{ secrets.FIREBASE_SERVICE_ACCOUNT_PIXEL_WORLD_8CB9B }}` 참조만 있고 JSON 값이나 개인 키는 없습니다.

- [ ] **5단계: 콘솔에서만 확인 가능한 항목을 인수인계에 정확히 기록**

완료 보고서에는 다음 상태 형식을 정확히 포함합니다.

```text
Firebase 웹 API 키: 공개용 클라이언트 식별자로 예상됨, 추적 파일 위치 보고
코드/이력의 Firebase Admin·서비스 계정 키: 감지되지 않음, 또는 정확한 파일명만 포함해 차단 보고
기타 고위험 키 형식: 감지되지 않음, 또는 정확한 파일명만 포함해 차단 보고
Realtime Database 규칙 파일: JSON 유효, 인증된 읽기와 작성자 전용 플레이어·채팅 쓰기 확인
Google Cloud HTTP 리퍼러/API 제한: 실제 콘솔을 확인한 경우에만 확인 완료, 그 외에는 확인 필요
Firebase App Check 적용: 실제 콘솔을 확인한 경우에만 확인 완료, 그 외에는 확인 필요
GitHub Secret scanning 미해결 알림: Security 페이지/API를 실제로 확인한 경우에만 확인 완료, 그 외에는 확인 필요
Firebase 배포 워크플로 비밀정보: Git에는 참조만 존재, 콘솔을 확인하지 않았다면 Actions 비밀정보 값·존재 여부는 확인 필요
```

- [ ] **6단계: 문서 작업 커밋**

```powershell
git add -- README.md FIREBASE_SETUP.md
git commit -m "전체 채팅과 Firebase 보안 안내 추가"
```

- [ ] **7단계: 게시 전 중지하고 통합 방식 선택지 제시**

사용자의 명시적 승인 없이 푸시, Firebase 규칙·Hosting 배포, Secret scanning 알림 닫기, 저장소 공개 범위 변경, App Check 활성화를 진행하지 않습니다. 브랜치 이름, 커밋, 테스트 개수, 브라우저 스모크 결과, 5단계의 전체 보안 상태를 보고합니다.
