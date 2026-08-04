import test from "node:test";
import assert from "node:assert/strict";
import * as gameModule from "../src/game.js";

test("FPS 측정은 현실적인 프레임 간격만 표본으로 사용한다", () => {
  assert.equal(gameModule.fpsSampleFromFrameSeconds?.(0), null);
  assert.equal(gameModule.fpsSampleFromFrameSeconds?.(1 / 500), null);
  assert.equal(gameModule.fpsSampleFromFrameSeconds?.(1 / 240), 240);
  assert.equal(Math.round(gameModule.fpsSampleFromFrameSeconds?.(1 / 60)), 60);
});
