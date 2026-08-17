/**
 * Deterministic level curve.
 *
 * Level 1 starts at 0 XP. Thresholds increase with level so high levels
 * require progressively more XP.
 */

export interface LevelInfo {
  level: number;
  currentLevelXp: number;
  nextLevelXp: number;
  xpIntoLevel: number;
  xpNeededForNext: number;
  progress: number; // 0..1
}

export function xpThresholdForLevel(level: number): number {
  if (level <= 1) return 0;
  let total = 0;
  for (let l = 1; l < level; l++) {
    total += 100 + (l - 1) * 30;
  }
  return total;
}

export function levelFromXp(totalXp: number): LevelInfo {
  const xp = Math.max(0, Math.floor(totalXp));
  let level = 1;
  while (xp >= xpThresholdForLevel(level + 1)) {
    level += 1;
  }
  const currentLevelXp = xpThresholdForLevel(level);
  const nextLevelXp = xpThresholdForLevel(level + 1);
  const xpIntoLevel = xp - currentLevelXp;
  const xpNeededForNext = nextLevelXp - currentLevelXp;
  const progress = xpNeededForNext === 0 ? 0 : Math.min(1, xpIntoLevel / xpNeededForNext);

  return {
    level,
    currentLevelXp,
    nextLevelXp,
    xpIntoLevel,
    xpNeededForNext,
    progress,
  };
}

export function playerLevelFromXp(totalXp: number): number {
  return levelFromXp(totalXp).level;
}
