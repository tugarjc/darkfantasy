// ============================================================
// INFERNO DOMINI — Prestige System
// Permanent bonuses earned from seasonal server participation
// ============================================================

const PRESTIGE_LEVELS = [
  { level: 1, xpRequired: 50000,   bonuses: { production: 0.02 } },
  { level: 2, xpRequired: 200000,  bonuses: { production: 0.02, combat: 0.05 } },
  { level: 3, xpRequired: 500000,  bonuses: { production: 0.02, combat: 0.05, buildTime: -0.05 } },
  { level: 4, xpRequired: 1500000, bonuses: { production: 0.12, combat: 0.05, buildTime: -0.05 } },
  { level: 5, xpRequired: 5000000, bonuses: { production: 0.12, combat: 0.05, buildTime: -0.05, maxLegion: 1 } },
];

function computePrestigeLevel(totalXp) {
  let level = 0;
  for (const p of PRESTIGE_LEVELS) {
    if (totalXp >= p.xpRequired) level = p.level;
    else break;
  }
  return level;
}

function getPrestigeBonuses(level) {
  if (level <= 0) return {};
  const entry = PRESTIGE_LEVELS.find(p => p.level === level);
  return entry ? entry.bonuses : {};
}

function seasonXpFromScore(score) {
  return Math.floor(score * 0.1);
}

module.exports = { PRESTIGE_LEVELS, computePrestigeLevel, getPrestigeBonuses, seasonXpFromScore };
