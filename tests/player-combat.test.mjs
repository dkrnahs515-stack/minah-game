import test from "node:test";
import assert from "node:assert/strict";
import {
  applyPlayerDamage,
  respawnPlayer,
  tickPlayerStatus,
} from "../src/player-combat.js";

function player(overrides = {}) {
  return {
    x: 1500,
    y: 1200,
    prevX: 1500,
    prevY: 1200,
    hp: 100,
    maxHp: 100,
    mp: 40,
    maxMp: 100,
    invulnerable: 0,
    hitFlash: 0,
    respawnTimer: 0,
    ...overrides,
  };
}

test("contact damage reduces HP and starts one second of invulnerability", () => {
  const target = player();
  assert.deepEqual(applyPlayerDamage(target, 10), { applied: true, died: false });
  assert.equal(target.hp, 90);
  assert.equal(target.invulnerable, 1);
  assert.equal(target.hitFlash, 0.18);
});

test("damage is ignored during invulnerability", () => {
  const target = player({ invulnerable: 0.5 });
  assert.deepEqual(applyPlayerDamage(target, 10), { applied: false, died: false });
  assert.equal(target.hp, 100);
});

test("lethal damage starts the 1.2 second respawn countdown", () => {
  const target = player({ hp: 10 });
  assert.deepEqual(applyPlayerDamage(target, 10), { applied: true, died: true });
  assert.equal(target.hp, 0);
  assert.equal(target.respawnTimer, 1.2);
});

test("status timers count down without becoming negative", () => {
  const target = player({ invulnerable: 0.5, hitFlash: 0.1 });
  tickPlayerStatus(target, 0.2);
  assert.equal(target.invulnerable, 0.3);
  assert.equal(target.hitFlash, 0);
});

test("respawn restores position, HP, MP, and frame history", () => {
  const target = player({ hp: 0, mp: 0, respawnTimer: 0.01 });
  respawnPlayer(target);
  assert.deepEqual(
    { x: target.x, y: target.y, prevX: target.prevX, prevY: target.prevY },
    { x: 1440, y: 1110, prevX: 1440, prevY: 1110 },
  );
  assert.equal(target.hp, 100);
  assert.equal(target.mp, 100);
  assert.equal(target.respawnTimer, 0);
});

test("respawn accepts the safe-world spawn selected by the game", () => {
  const target = player({ hp: 0, mp: 0, respawnTimer: 0.01 });
  respawnPlayer(target, { x: 320, y: 480 });
  assert.deepEqual(
    { x: target.x, y: target.y, prevX: target.prevX, prevY: target.prevY },
    { x: 320, y: 480, prevX: 320, prevY: 480 },
  );
  assert.equal(target.hp, 100);
  assert.equal(target.mp, 100);
});

test("부활은 레벨에서 갱신된 최대 HP와 MP까지 회복한다", () => {
  const target = {
    x: 0, y: 0, prevX: 0, prevY: 0,
    hp: 0, maxHp: 120, mp: 1, maxMp: 110,
    invulnerable: 1, hitFlash: 1, respawnTimer: 1,
  };
  respawnPlayer(target, { x: 4, y: 5 });
  assert.equal(target.hp, 120);
  assert.equal(target.mp, 110);
});
