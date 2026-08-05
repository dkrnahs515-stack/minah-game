import test from "node:test";
import assert from "node:assert/strict";
import { filterPlayersForMap, serializePlayerState } from "../src/network-state.js";

test("serialized player state keeps existing fields and adds the active region", () => {
  assert.deepEqual(
    serializePlayerState(
      { x: 10.04, y: 20.06, dir: "left", moving: true, color: "#fff", name: "별" },
      "forest",
    ),
    {
      x: 10,
      y: 20.1,
      dir: "left",
      moving: true,
      color: "#fff",
      name: "별",
      mapId: "forest",
    },
  );
});

test("only valid remote players in the active region are visible", () => {
  const raw = {
    own: { x: 1, y: 1, mapId: "forest", dir: "down", moving: false, color: "#fff", name: "나" },
    same: { x: 100, y: 200, mapId: "forest", dir: "up", moving: true, color: "#0f0", name: "숲" },
    other: { x: 100, y: 200, mapId: "coast", dir: "left", moving: false, color: "#00f", name: "바다" },
    invalid: { x: 5000, y: 200, mapId: "forest", dir: "right", moving: false, color: "#f00", name: "범위 밖" },
  };
  const players = filterPlayersForMap(raw, "own", "forest");
  assert.deepEqual([...players.keys()], ["same"]);
  assert.equal(players.get("same").name, "숲");
});

test("legacy snapshots without a region remain visible in the village", () => {
  const players = filterPlayersForMap(
    { legacy: { x: 100, y: 100, dir: "down", moving: false, color: "#fff", name: "이전" } },
    "own",
    "village",
  );
  assert.equal(players.has("legacy"), true);
  assert.equal(players.get("legacy").mapId, "village");
});

test("unknown active region values safely fall back to the village", () => {
  const players = filterPlayersForMap(
    { villagePlayer: { x: 100, y: 100, mapId: "village", name: "마을" } },
    "own",
    "unknown",
  );
  assert.equal(players.has("villagePlayer"), true);
});
