import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("채팅 규칙은 기존 플레이어 검증을 보존하고 작성자·구조·개수를 제한한다", async () => {
  const rules = JSON.parse(await readFile(new URL("../database.rules.json", import.meta.url), "utf8"));
  const room = rules.rules.rooms.$roomId;
  assert.match(room.players.$uid[".validate"], /mapId/);
  assert.equal(room.chat[".read"], "auth != null");
  assert.match(room.chat.$uid[".write"], /auth\.uid === \$uid/);
  assert.equal(room.chat.$uid[".validate"], "newData.hasChildren()");
  assert.doesNotMatch(room.chat.$uid[".validate"], /numChildren/);
  const message = room.chat.$uid.$messageId;
  assert.match(message[".validate"], /hasChildren/);
  assert.match(message.text[".validate"], /length <= 1024/);
  assert.match(message.mapId[".validate"], /village/);
  assert.equal(message.$other[".validate"], false);
});
