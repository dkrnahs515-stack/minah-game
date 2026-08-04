import test from "node:test";
import assert from "node:assert/strict";
import {
  attackDefinition,
  directionVector,
  isTargetInAttackArc,
} from "../src/combat.js";

test("directionVector maps all player directions", () => {
  assert.deepEqual(directionVector("up"), { x: 0, y: -1 });
  assert.deepEqual(directionVector("down"), { x: 0, y: 1 });
  assert.deepEqual(directionVector("left"), { x: -1, y: 0 });
  assert.deepEqual(directionVector("right"), { x: 1, y: 0 });
});

test("basic attack includes a close target in front and rejects one behind", () => {
  const origin = { x: 100, y: 100 };
  assert.equal(isTargetInAttackArc(origin, "right", { x: 145, y: 100 }, 52, 100), true);
  assert.equal(isTargetInAttackArc(origin, "right", { x: 70, y: 100 }, 52, 100), false);
});

test("attack arc rejects targets outside its range and angle", () => {
  const origin = { x: 100, y: 100 };
  assert.equal(isTargetInAttackArc(origin, "up", { x: 100, y: 47 }, 52, 100), false);
  assert.equal(isTargetInAttackArc(origin, "right", { x: 100, y: 145 }, 52, 100), false);
});

test("strong attack exposes the approved combat behavior", () => {
  assert.deepEqual(attackDefinition("strong"), {
    damage: 3,
    cooldown: 4,
    range: 84,
    arcDegrees: 140,
    windup: 0.22,
    duration: 0.4,
    mpCost: 20,
    knockback: 520,
  });
});
