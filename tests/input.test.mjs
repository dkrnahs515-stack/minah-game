import test from "node:test";
import assert from "node:assert/strict";
import { movementVector } from "../src/input.js";

test("arrow keys produce normalized movement", () => {
  assert.deepEqual(movementVector(new Set(["ArrowRight"])), { x: 1, y: 0 });
  const diagonal = movementVector(new Set(["ArrowUp", "ArrowRight"]));
  assert.ok(Math.abs(diagonal.x - Math.SQRT1_2) < 1e-12);
  assert.ok(Math.abs(diagonal.y + Math.SQRT1_2) < 1e-12);
});

test("WASD no longer moves the player", () => {
  assert.deepEqual(movementVector(new Set(["KeyW", "KeyA"])), { x: 0, y: 0 });
});
