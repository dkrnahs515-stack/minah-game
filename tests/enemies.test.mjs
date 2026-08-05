import test from "node:test";
import assert from "node:assert/strict";
import { createEnemies, damageEnemy, updateEnemies } from "../src/enemies.js";

test("the safe village never creates enemies", () => {
  assert.deepEqual(createEnemies("village"), []);
});

test("each exterior region creates its approved enemy roster", () => {
  assert.equal(createEnemies("volcano").length, 8);
  assert.deepEqual(
    new Set(createEnemies("forest").map(enemy => enemy.kind)),
    new Set(["forest-slime", "boar"]),
  );
  assert.deepEqual(
    new Set(createEnemies("coast").map(enemy => enemy.kind)),
    new Set(["crab", "water-slime"]),
  );
});

test("enemy species receive distinct combat stats", () => {
  const fire = createEnemies("volcano")[0];
  const boar = createEnemies("forest").find(enemy => enemy.kind === "boar");
  const crab = createEnemies("coast").find(enemy => enemy.kind === "crab");
  assert.deepEqual({ hp: fire.hp, damage: fire.contactDamage }, { hp: 4, damage: 12 });
  assert.deepEqual({ hp: boar.hp, speed: boar.speed }, { hp: 6, speed: 112 });
  assert.deepEqual({ hp: crab.hp, radius: crab.radius }, { hp: 5, radius: 20 });
});

test("a nearby player makes an enemy chase at its species speed", () => {
  const enemy = createEnemies("volcano")[0];
  const [updated] = updateEnemies(
    [enemy],
    { x: enemy.x + 100, y: enemy.y },
    0.1,
    () => false,
  );
  assert.ok(Math.abs(updated.x - (enemy.homeX + 9.2)) < 1e-9);
  assert.equal(updated.state, "chasing");
});

test("damage applies hit feedback and death fade to every species", () => {
  const enemy = createEnemies("forest").find(candidate => candidate.kind === "boar");
  const result = damageEnemy(enemy, enemy.hp, { x: 1, y: 0 }, 520);
  assert.equal(result.killed, true);
  assert.equal(enemy.state, "dying");
  assert.equal(enemy.knockbackX, 520);
  assert.equal(updateEnemies([enemy], { x: 0, y: 0 }, 0.66, () => false).length, 0);
});

test("blocked terrain prevents enemy knockback", () => {
  const enemy = createEnemies("coast")[0];
  damageEnemy(enemy, 1, { x: 1, y: 0 }, 230);
  const [updated] = updateEnemies([enemy], { x: enemy.x + 100, y: enemy.y }, 0.1, () => true);
  assert.equal(updated.x, enemy.homeX);
  assert.equal(updated.y, enemy.homeY);
});
