import test from "node:test";
import assert from "node:assert/strict";
import { createSlimes, damageSlime, updateSlimes } from "../src/enemies.js";

test("three approved slimes spawn with 3 HP", () => {
  const slimes = createSlimes();
  assert.deepEqual(slimes.map(({ x, y, hp }) => ({ x, y, hp })), [
    { x: 1260, y: 1040, hp: 3 },
    { x: 1590, y: 1060, hp: 3 },
    { x: 1450, y: 1330, hp: 3 },
  ]);
});

test("a nearby player makes a slime chase at 85 pixels per second", () => {
  const slime = createSlimes()[0];
  const [updated] = updateSlimes([slime], { x: 1360, y: 1040 }, 0.1, () => false);
  assert.ok(Math.abs(updated.x - 1268.5) < 1e-9);
  assert.equal(updated.state, "chasing");
});

test("basic damage applies hit feedback and knockback", () => {
  const slime = createSlimes()[0];
  const result = damageSlime(slime, 1, { x: 1, y: 0 }, 230);
  assert.equal(slime.hp, 2);
  assert.equal(slime.hitFlash, 0.16);
  assert.equal(slime.knockbackX, 230);
  assert.deepEqual(result.damageNumber, { x: 1260, y: 1014, value: 1 });
});

test("strong damage starts death and strong knockback", () => {
  const slime = createSlimes()[0];
  const result = damageSlime(slime, 3, { x: 1, y: 0 }, 520);
  assert.equal(result.killed, true);
  assert.equal(slime.state, "dying");
  assert.equal(slime.knockbackX, 520);
});

test("dying slime fades, shrinks, and is removed after 0.65 seconds", () => {
  const slime = createSlimes()[0];
  damageSlime(slime, 3, { x: 1, y: 0 }, 520);
  const halfway = updateSlimes([slime], { x: 0, y: 0 }, 0.325, () => false);
  assert.equal(halfway.length, 1);
  assert.ok(Math.abs(halfway[0].opacity - 0.5) < 1e-9);
  assert.ok(Math.abs(halfway[0].scale - 0.575) < 1e-9);
  const remaining = updateSlimes(halfway, { x: 0, y: 0 }, 0.325, () => false);
  assert.equal(remaining.length, 0);
});

test("knockback cannot move a slime through blocked terrain", () => {
  const slime = createSlimes()[0];
  damageSlime(slime, 1, { x: 1, y: 0 }, 230);
  const [updated] = updateSlimes([slime], { x: 1360, y: 1040 }, 0.1, () => true);
  assert.equal(updated.x, 1260);
  assert.equal(updated.y, 1040);
});
