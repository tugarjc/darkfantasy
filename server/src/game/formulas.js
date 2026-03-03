// ============================================================
// INFERNO DOMINI — Game Formulas (from GDD v2)
// ============================================================

// ── Resource Production ──
// production_rate = base_rate × 1.1^n
function productionRate(baseRate, level) {
  return baseRate * Math.pow(1.1, level);
}

// storage_max = base_storage × 2^(n/5)
function storageCap(baseStorage, level) {
  return baseStorage * Math.pow(2, level / 5);
}

// ── Building Costs ──
// cost(n) = base × 1.5^(n-1)
function buildingCost(baseCost, level) {
  return Math.ceil(baseCost * Math.pow(1.5, level - 1));
}

// temps_construction(n) = base_time × 1.6^(n-1) / (1 + 0.05 × nv_biblio)
// Returns seconds. Minimum 10 seconds.
function buildingTime(baseTimeSeconds, level, biblioLevel) {
  const raw = baseTimeSeconds * Math.pow(1.6, level - 1) / (1 + 0.05 * biblioLevel);
  return Math.max(10, Math.round(raw));
}

// ── Research ──
// temps_recherche(n) = base × 1.8^(n-1) / (1 + 0.08 × nv_biblio)
function researchTime(baseTimeSeconds, level, biblioLevel) {
  const raw = baseTimeSeconds * Math.pow(1.8, level - 1) / (1 + 0.08 * biblioLevel);
  return Math.max(10, Math.round(raw));
}

// cost(n) = base × 1.6^(n-1)
function researchCost(baseCost, level) {
  return Math.ceil(baseCost * Math.pow(1.6, level - 1));
}

// ── Unit Training ──
function unitTrainTime(baseTimeSeconds, quantity) {
  return baseTimeSeconds * quantity;
}

// ── Combat ──
function combatRatio(totalAtt, totalDef) {
  if (totalAtt + totalDef === 0) return 0.5;
  return totalAtt / (totalAtt + totalDef);
}

function combatLosses(units, ratio, isAttacker) {
  const lossRatio = isAttacker ? (1 - ratio) : ratio;
  const randomFactor = 0.9 + Math.random() * 0.2; // 0.9 - 1.1
  return Math.floor(units * lossRatio * randomFactor);
}

// ── Hero XP ──
function heroXpNeeded(level) {
  return Math.ceil(100 * Math.pow(level, 1.8));
}

// ── Score ──
function scoreEconomic(buildingLevels) {
  return buildingLevels.reduce((sum, lv) => sum + lv, 0) * 100;
}

function scoreMilitary(unitCosts) {
  return Math.floor(unitCosts.reduce((sum, cost) => sum + cost, 0) / 10);
}

function scoreResearch(researchLevels) {
  return researchLevels.reduce((sum, lv) => sum + lv, 0) * 150;
}

module.exports = {
  productionRate,
  storageCap,
  buildingCost,
  buildingTime,
  researchTime,
  researchCost,
  unitTrainTime,
  combatRatio,
  combatLosses,
  heroXpNeeded,
  scoreEconomic,
  scoreMilitary,
  scoreResearch,
};
