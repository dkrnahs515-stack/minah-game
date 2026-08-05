import test from "node:test";
import assert from "node:assert/strict";
import {
  WORLD_DEFINITIONS,
  WORLD_IDS,
  getPortalDestination,
  getTotalWorldArea,
  isSafeWorld,
  normalizeWorldId,
} from "../src/world-data.js";

test("four regions total exactly ten times the original playable area", () => {
  assert.equal(getTotalWorldArea(), 2880 * 1800 * 10);
  assert.deepEqual(WORLD_IDS, ["village", "volcano", "forest", "coast"]);
  assert.deepEqual(
    WORLD_IDS.map(id => [WORLD_DEFINITIONS[id].width, WORLD_DEFINITIONS[id].height]),
    [[2880, 1800], [4320, 3600], [4320, 3600], [4320, 3600]],
  );
});

test("the village is the only safe region and has no enemy spawns", () => {
  assert.equal(isSafeWorld("village"), true);
  assert.equal(WORLD_DEFINITIONS.village.enemySpawns.length, 0);
  assert.equal(isSafeWorld("volcano"), false);
  assert.equal(isSafeWorld("forest"), false);
  assert.equal(isSafeWorld("coast"), false);
});

test("every portal destination is inside a valid region", () => {
  for (const mapId of WORLD_IDS) {
    for (const portal of WORLD_DEFINITIONS[mapId].portals) {
      const destination = getPortalDestination(mapId, portal.id);
      assert.ok(destination);
      const target = WORLD_DEFINITIONS[destination.mapId];
      assert.ok(target);
      assert.ok(destination.x > 0 && destination.x < target.width);
      assert.ok(destination.y > 0 && destination.y < target.height);
    }
  }
});

test("unknown and legacy region values normalize to the village", () => {
  assert.equal(normalizeWorldId(undefined), "village");
  assert.equal(normalizeWorldId("desert"), "village");
  assert.equal(normalizeWorldId("coast"), "coast");
});
