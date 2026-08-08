import test from "node:test";
import assert from "node:assert/strict";
import * as gameModule from "../src/game.js";

test("게임 캔버스는 desynchronized 힌트 없이 동기화된 2D context를 요청한다", () => {
  assert.equal(typeof gameModule.createGameCanvasContext, "function");

  const context = {};
  const calls = [];
  const canvas = {
    getContext(type, options) {
      calls.push({ type, options });
      return context;
    },
  };

  assert.strictEqual(gameModule.createGameCanvasContext(canvas), context);
  assert.deepEqual(calls, [{ type: "2d", options: { alpha: false } }]);
});
