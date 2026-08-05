import test from "node:test";
import assert from "node:assert/strict";
import {
  findActivePortal,
  getBiome,
  isWorldPositionBlocked,
} from "../src/world.js";

test("region boundaries and representative landmarks block movement", () => {
  assert.equal(isWorldPositionBlocked("village", -1, 100, 14), true);
  assert.equal(isWorldPositionBlocked("village", 1440, 1110, 14), false);
  assert.equal(isWorldPositionBlocked("volcano", 200, 1800, 14), true);
  assert.equal(isWorldPositionBlocked("forest", 2160, 800, 14), true);
  assert.equal(isWorldPositionBlocked("coast", 2160, 3300, 14), true);
});

test("portal lookup reports only overlapping portals", () => {
  assert.equal(findActivePortal("village", 618, 458, 14)?.id, "to-forest");
  assert.equal(findActivePortal("village", 1440, 1110, 14), null);
  assert.equal(findActivePortal("coast", 2160, 232, 14)?.id, "to-village");
});

test("the active region name is exposed for the HUD", () => {
  assert.equal(getBiome("village"), "중앙 마을");
  assert.equal(getBiome("volcano"), "끓어오르는 활화산");
  assert.equal(getBiome("forest"), "태고의 숲");
  assert.equal(getBiome("coast"), "푸른 해안가");
});
