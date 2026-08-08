import test from "node:test";
import assert from "node:assert/strict";
import {
  grantProgressReward,
  grantSlimeReward,
  nextLevelExp,
  rollSlimeGold,
  statsForLevel,
} from "../src/player-progression.js";

const base = () => ({ level: 1, exp: 0, nextLevelExp: 100, gold: 0 });

test("다음 레벨 필요 EXP는 현재 레벨의 100배다", () => {
  assert.equal(nextLevelExp(1), 100);
  assert.equal(nextLevelExp(3), 300);
});

test("초과 EXP는 이월되고 한 보상으로 여러 번 레벨업한다", () => {
  const result = grantProgressReward(
    { ...base(), exp: 90 },
    { exp: 320, gold: 7 },
  );
  assert.deepEqual(result.progress, {
    level: 3,
    exp: 110,
    nextLevelExp: 300,
    gold: 7,
  });
  assert.equal(result.levelsGained, 2);
});

test("슬라임 Gold는 1부터 3까지이며 처치 EXP는 3이다", () => {
  assert.equal(rollSlimeGold(() => 0), 1);
  assert.equal(rollSlimeGold(() => 0.5), 2);
  assert.equal(rollSlimeGold(() => 0.999999), 3);
  const result = grantSlimeReward(base(), () => 0.5);
  assert.equal(result.rewardExp, 3);
  assert.equal(result.rewardGold, 2);
  assert.equal(result.progress.exp, 3);
  assert.equal(result.progress.gold, 2);
});

test("레벨별 최대 HP와 MP를 계산한다", () => {
  assert.deepEqual(statsForLevel(1), { maxHp: 100, maxMp: 100 });
  assert.deepEqual(statsForLevel(4), { maxHp: 130, maxMp: 115 });
});
