export const PROGRESSION_RULES = Object.freeze({
  slimeExp: 3,
  slimeGoldMin: 1,
  slimeGoldMax: 3,
  baseMaxHp: 100,
  baseMaxMp: 100,
  maxHpPerLevel: 10,
  maxMpPerLevel: 5,
});

export function nextLevelExp(level) {
  return level * 100;
}

export function statsForLevel(level) {
  return {
    maxHp: PROGRESSION_RULES.baseMaxHp + (level - 1) * PROGRESSION_RULES.maxHpPerLevel,
    maxMp: PROGRESSION_RULES.baseMaxMp + (level - 1) * PROGRESSION_RULES.maxMpPerLevel,
  };
}

export function grantProgressReward(progress, { exp = 0, gold = 0 } = {}) {
  const next = { ...progress, exp: progress.exp + exp, gold: progress.gold + gold };
  let levelsGained = 0;
  while (next.exp >= next.nextLevelExp) {
    next.exp -= next.nextLevelExp;
    next.level += 1;
    next.nextLevelExp = nextLevelExp(next.level);
    levelsGained += 1;
  }
  return { progress: next, levelsGained };
}

export function rollSlimeGold(random = Math.random) {
  const sample = Math.min(0.9999999999999999, Math.max(0, random()));
  return PROGRESSION_RULES.slimeGoldMin + Math.floor(sample * 3);
}

export function grantSlimeReward(progress, random = Math.random) {
  const rewardGold = rollSlimeGold(random);
  const result = grantProgressReward(progress, {
    exp: PROGRESSION_RULES.slimeExp,
    gold: rewardGold,
  });
  return { ...result, rewardExp: PROGRESSION_RULES.slimeExp, rewardGold };
}
