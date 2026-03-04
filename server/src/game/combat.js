// ============================================================
// INFERNO DOMINI — Combat Resolution Engine
// Resolves attack outcomes, calculates losses, plunder
// ============================================================

const { UNITS } = require('./units');
const { factionAttackBonus, factionPlunderBonus } = require('./factions');

// Calculate total attack and defense power for a composition
function compositionPower(comp, faction = null) {
  let totalAttack = 0;
  let totalDefense = 0;
  let totalPlunder = 0;
  for (const [type, qty] of Object.entries(comp)) {
    const unit = UNITS[type];
    if (!unit) continue;
    totalAttack += unit.attack * qty;
    totalDefense += unit.defense * qty;
    totalPlunder += unit.plunder * qty;
  }
  // Apply faction bonuses if provided
  if (faction) {
    totalAttack = Math.floor(totalAttack * factionAttackBonus(faction));
    totalPlunder = Math.floor(totalPlunder * factionPlunderBonus(faction));
  }
  return { totalAttack, totalDefense, totalPlunder };
}

// Wall defense bonus: +2% per mur_ames level, +5% per tour_chaos level
function wallBonus(murLevel, tourLevel) {
  return 1 + 0.02 * murLevel + 0.05 * tourLevel;
}

// Resolve combat between attacker and defender compositions
// Returns: { attackerWins, attackerLosses, defenderLosses, plunder }
function resolveCombat(attackerComp, defenderComp, defenseBonus = 1, attackerFaction = null, defenderFaction = null, attackerPrestigeBonus = 0, defenderPrestigeBonus = 0) {
  const attPower = compositionPower(attackerComp, attackerFaction);
  const defPower = compositionPower(defenderComp, defenderFaction);

  // Apply prestige combat bonus to attacker
  attPower.totalAttack = Math.floor(attPower.totalAttack * (1 + attackerPrestigeBonus));

  // Apply wall/defense bonus + prestige to defender
  const adjustedDefense = defPower.totalDefense * defenseBonus * (1 + defenderPrestigeBonus);

  // Combat ratio
  const totalForce = attPower.totalAttack + adjustedDefense;
  if (totalForce === 0) {
    return {
      attackerWins: true,
      ratio: 1,
      attackerLosses: {},
      defenderLosses: {},
      plunderCapacity: attPower.totalPlunder,
    };
  }

  const ratio = attPower.totalAttack / totalForce;
  const attackerWins = ratio > 0.5;

  // Calculate losses for each unit type
  // Loser loses more units proportionally
  const attackerLossRatio = (1 - ratio) * (0.9 + Math.random() * 0.2);
  const defenderLossRatio = ratio * (0.9 + Math.random() * 0.2);

  const attackerLosses = {};
  const attackerSurvivors = {};
  for (const [type, qty] of Object.entries(attackerComp)) {
    const losses = Math.min(qty, Math.floor(qty * attackerLossRatio));
    attackerLosses[type] = losses;
    const surviving = qty - losses;
    if (surviving > 0) attackerSurvivors[type] = surviving;
  }

  const defenderLosses = {};
  const defenderSurvivors = {};
  for (const [type, qty] of Object.entries(defenderComp)) {
    const losses = Math.min(qty, Math.floor(qty * defenderLossRatio));
    defenderLosses[type] = losses;
    const surviving = qty - losses;
    if (surviving > 0) defenderSurvivors[type] = surviving;
  }

  // Plunder capacity based on surviving attackers
  const survivorPower = compositionPower(attackerSurvivors);

  return {
    attackerWins,
    ratio: Math.round(ratio * 1000) / 1000,
    attackerLosses,
    defenderLosses,
    attackerSurvivors,
    defenderSurvivors,
    plunderCapacity: attackerWins ? survivorPower.totalPlunder : 0,
  };
}

// Calculate plunder amounts (capped by plunder capacity and available resources)
// Crypte protects a percentage of resources
function calculatePlunder(plunderCapacity, targetResources, crypteLevel) {
  if (plunderCapacity <= 0) return { iron: 0, essence: 0, souls: 0 };

  // Crypte protects 5% per level of resources
  const protectionRate = Math.min(0.9, 0.05 * crypteLevel);

  const availableIron = Math.floor(targetResources.iron * (1 - protectionRate));
  const availableEssence = Math.floor(targetResources.essence * (1 - protectionRate));
  const availableSouls = Math.floor(targetResources.souls * (1 - protectionRate));

  const totalAvailable = availableIron + availableEssence + availableSouls;
  if (totalAvailable === 0) return { iron: 0, essence: 0, souls: 0 };

  // Distribute plunder proportionally, capped by capacity
  const scale = Math.min(1, plunderCapacity / totalAvailable);

  return {
    iron: Math.floor(availableIron * scale),
    essence: Math.floor(availableEssence * scale),
    souls: Math.floor(availableSouls * scale),
  };
}

module.exports = { compositionPower, wallBonus, resolveCombat, calculatePlunder };
