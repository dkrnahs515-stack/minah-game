import test from "node:test";
import assert from "node:assert/strict";
import { distanceToSegment, pointInRect } from "../src/collision.js";
import { isWorldPositionBlocked } from "../src/world.js";

test("pointInRect includes collision padding", () => {
  const rect = { x: 100, y: 100, w: 50, h: 50 };
  assert.equal(pointInRect(95, 120, rect, 5), true);
  assert.equal(pointInRect(94, 120, rect, 5), false);
});

test("pointInRect includes its exact outer boundary", () => {
  const rect = { x: 100, y: 100, w: 50, h: 50 };
  assert.equal(pointInRect(150, 150, rect), true);
  assert.equal(pointInRect(151, 150, rect), false);
});

test("distanceToSegment measures a perpendicular point", () => {
  assert.equal(distanceToSegment(5, 5, 0, 0, 10, 0), 5);
});

test("distanceToSegment clamps to the nearest endpoint", () => {
  assert.equal(distanceToSegment(15, 0, 0, 0, 10, 0), 5);
});

test("world collision blocks boundaries and landmarks", () => {
  assert.equal(isWorldPositionBlocked(-1, 100, 14), true);
  assert.equal(isWorldPositionBlocked(300, 300, 14), true);
  assert.equal(isWorldPositionBlocked(1440, 1110, 14), false);
});

test("world collision blocks the river but allows bridge crossings", () => {
  assert.equal(isWorldPositionBlocked(900, 900, 14), true);
  assert.equal(isWorldPositionBlocked(880, 650, 14), false);
  assert.equal(isWorldPositionBlocked(880, 1200, 14), false);
});
