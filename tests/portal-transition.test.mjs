import test from "node:test";
import assert from "node:assert/strict";
import { advancePortalTransition, createPortalTransition } from "../src/portal-transition.js";

const portal = { destination: { mapId: "forest", x: 2160, y: 3260 } };

test("portal travel swaps regions once at the midpoint and ends after half a second", () => {
  let tick = advancePortalTransition(createPortalTransition(portal), 0.2);
  assert.equal(tick.shouldSwap, false);
  assert.equal(tick.finished, false);

  tick = advancePortalTransition(tick.state, 0.06);
  assert.equal(tick.shouldSwap, true);
  assert.equal(tick.finished, false);

  tick = advancePortalTransition(tick.state, 0.3);
  assert.equal(tick.shouldSwap, false);
  assert.equal(tick.finished, true);
});

test("portal travel copies its destination and carries a one-second reuse lock", () => {
  const state = createPortalTransition(portal);
  portal.destination.x = 999;
  assert.deepEqual(state.destination, { mapId: "forest", x: 2160, y: 3260 });
  assert.equal(state.cooldownAfter, 1);
});
