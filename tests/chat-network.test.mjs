import test from "node:test";
import assert from "node:assert/strict";
import { createFirebaseChatAdapter, createOfflineChatAdapter } from "../src/chat-network.js";

function validMessages(count) {
  return Object.fromEntries(Array.from({ length: count }, (_, index) => [
    `m${index}`,
    { text: `메시지 ${index}`, name: "별", mapId: "village", createdAt: 100 + index },
  ]));
}

function createDatabaseFake(initialMessages = {}) {
  const state = {
    updates: [],
    removed: [],
    disconnectOperations: [],
    messageCallback: null,
    unsubscribed: false,
  };
  const dbModule = {
    ref: (_db, path) => ({ path, key: path.split("/").at(-1) }),
    push: ref => ({ path: `${ref.path}/new-message`, key: "new-message" }),
    serverTimestamp: () => 12345,
    get: async () => ({ val: () => initialMessages }),
    update: async (ref, values) => state.updates.push({ path: ref.path, values }),
    remove: async ref => state.removed.push(ref.path),
    onValue: (ref, callback) => {
      state.messageCallback = callback;
      return () => { state.unsubscribed = true; };
    },
    onDisconnect: ref => {
      const operation = { path: ref.path, removeCalls: 0, cancelCalls: 0 };
      state.disconnectOperations.push(operation);
      return {
        remove: async () => { operation.removeCalls += 1; },
        cancel: async () => { operation.cancelCalls += 1; },
      };
    },
  };
  return { dbModule, state };
}

test("오프라인 채팅 어댑터는 예외 없이 전송을 거부한다", async () => {
  const adapter = createOfflineChatAdapter();
  assert.deepEqual(await adapter.send({ text: "안녕" }), {
    ok: false,
    error: "채팅 서버가 오프라인입니다.",
  });
  await adapter.armDisconnect();
  await adapter.stop();
});

test("Firebase 채팅 어댑터는 구독 메시지를 전체 목록으로 전달한다", async () => {
  const { dbModule, state } = createDatabaseFake();
  const received = [];
  await createFirebaseChatAdapter({
    dbModule,
    db: {},
    uid: "user-a",
    roomId: "public",
    onMessagesChanged: messages => received.push(messages),
  });
  state.messageCallback({ val: () => ({ "user-a": validMessages(2) }) });
  assert.equal(received.at(-1).length, 2);
  assert.equal(received.at(-1)[0].uid, "user-a");
});

test("새 메시지와 가장 오래된 메시지 삭제를 하나의 갱신으로 처리한다", async () => {
  const { dbModule, state } = createDatabaseFake(validMessages(5));
  const adapter = await createFirebaseChatAdapter({
    dbModule,
    db: {},
    uid: "user-a",
    roomId: "public",
    onMessagesChanged: () => {},
  });
  assert.deepEqual(await adapter.send({ text: " 새 메시지 ", name: "별", mapId: "village" }), {
    ok: true,
    error: "",
  });
  assert.equal(state.updates.length, 1);
  assert.equal(state.updates[0].path, "rooms/public/chat/user-a");
  assert.equal(state.updates[0].values.m0, null);
  assert.deepEqual(state.updates[0].values["new-message"], {
    text: "새 메시지",
    name: "별",
    mapId: "village",
    createdAt: 12345,
  });
});

test("재연결마다 자동 삭제를 다시 예약하고 종료 시 최신 예약을 취소한다", async () => {
  const { dbModule, state } = createDatabaseFake();
  const adapter = await createFirebaseChatAdapter({
    dbModule,
    db: {},
    uid: "user-a",
    roomId: "public",
    onMessagesChanged: () => {},
  });
  await adapter.armDisconnect();
  await adapter.armDisconnect();
  assert.equal(state.disconnectOperations.length, 2);
  assert.deepEqual(state.disconnectOperations.map(item => item.removeCalls), [1, 1]);
  await adapter.stop();
  assert.equal(state.disconnectOperations.at(-1).cancelCalls, 1);
  assert.equal(state.unsubscribed, true);
  assert.deepEqual(state.removed, ["rooms/public/chat/user-a"]);
});
