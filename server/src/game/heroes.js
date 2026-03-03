/**
 * Hero definitions — 6 hero types for Inferno Domini.
 *
 * Each hero provides passive bonuses when deployed with a legion.
 * Heroes gain XP from combat and level up (max 20).
 * XP required: 100 × level^1.8
 * Summoning requires autel_sacrifice building.
 */

const HEROES = {
  maledictus: {
    name: 'Maledictus',
    title: 'Archimage Maudit',
    description: 'Maitre des maledictions. Augmente la puissance offensive de toutes les unites.',
    category: 'combat',
    maxLevel: 20,
    // Summoning cost
    baseFer: 800,
    baseEssence: 600,
    baseAmes: 200,
    baseTime: 3600, // 1h
    // Per-level bonuses when deployed
    bonuses: {
      attackAll: 0.04,       // +4% ATK all units per level
      defenseAll: 0.01,      // +1% DEF all units per level
    },
  },
  volcana: {
    name: 'Volcana',
    title: 'Seigneur du Feu',
    description: 'Incarne la fureur volcanique. Bonus massif aux unites terrestres et siege.',
    category: 'combat',
    maxLevel: 20,
    baseFer: 1000,
    baseEssence: 400,
    baseAmes: 250,
    baseTime: 3600,
    bonuses: {
      attackGround: 0.06,    // +6% ATK ground units per level
      plunder: 0.03,         // +3% plunder per level
    },
  },
  skareth: {
    name: 'Skareth',
    title: 'Ombre Ancienne',
    description: 'Maitre de l\'espionnage et de la furtivite. Reduit les pertes et ameliore le renseignement.',
    category: 'special',
    maxLevel: 20,
    baseFer: 500,
    baseEssence: 800,
    baseAmes: 300,
    baseTime: 3600,
    bonuses: {
      espionage: 0.08,       // +8% spy effectiveness per level
      lossReduction: 0.02,   // -2% losses per level (capped at 30%)
    },
  },
  noctis: {
    name: 'Noctis',
    title: 'Chevalier Noir',
    description: 'Gardien indestructible. Renforce massivement la defense de vos armees.',
    category: 'combat',
    maxLevel: 20,
    baseFer: 1200,
    baseEssence: 300,
    baseAmes: 150,
    baseTime: 3600,
    bonuses: {
      defenseAll: 0.05,      // +5% DEF all units per level
      wallBonus: 0.02,       // +2% wall effectiveness per level (when defending)
    },
  },
  ignara: {
    name: 'Ignara',
    title: 'Tisseuse de Flammes',
    description: 'Canalise l\'energie infernale pour accelerer la production et la recherche.',
    category: 'economy',
    maxLevel: 20,
    baseFer: 600,
    baseEssence: 900,
    baseAmes: 100,
    baseTime: 3600,
    bonuses: {
      productionIron: 0.03,  // +3% iron production per level
      productionEssence: 0.03, // +3% essence production per level
      researchSpeed: 0.02,   // +2% research speed per level
    },
  },
  kharos: {
    name: 'Kharos',
    title: 'Faucheur d\'Ames',
    description: 'Collecteur d\'ames implacable. Augmente le pillage et la production d\'ames.',
    category: 'economy',
    maxLevel: 20,
    baseFer: 700,
    baseEssence: 500,
    baseAmes: 400,
    baseTime: 3600,
    bonuses: {
      plunder: 0.05,         // +5% plunder per level
      productionSouls: 0.05, // +5% souls production per level
      attackAll: 0.02,       // +2% ATK all units per level
    },
  },
};

/** XP required to reach a given level */
function xpForLevel(level) {
  return Math.floor(100 * Math.pow(level, 1.8));
}

/** Summoning cost for a hero (scales with autel level for discount) */
function summonCost(heroType, autelLevel) {
  const h = HEROES[heroType];
  if (!h) return null;
  const discount = 1 / (1 + 0.03 * autelLevel); // -3% per autel level
  return {
    fer: Math.floor(h.baseFer * discount),
    essence: Math.floor(h.baseEssence * discount),
    ames: Math.floor(h.baseAmes * discount),
    time: Math.max(300, Math.floor(h.baseTime * discount)), // min 5min
  };
}

/** XP gained from combat based on opponent power */
function combatXP(opponentPower, heroLevel) {
  // Base XP from combat, diminishing returns at higher levels
  return Math.max(5, Math.floor(opponentPower / (10 + heroLevel * 2)));
}

/** Chance hero dies in combat (only if attacker loses) */
function heroDeathChance(combatRatio, heroLevel) {
  // Base 15% death chance when losing, reduced by level
  const base = 0.15;
  const levelReduction = 0.005 * heroLevel; // -0.5% per level
  return Math.max(0.02, base - levelReduction); // min 2%
}

/** Get hero combat bonuses at a given level */
function getHeroBonuses(heroType, level) {
  const h = HEROES[heroType];
  if (!h) return {};
  const result = {};
  for (const [key, perLevel] of Object.entries(h.bonuses)) {
    result[key] = perLevel * level;
  }
  return result;
}

module.exports = { HEROES, xpForLevel, summonCost, combatXP, heroDeathChance, getHeroBonuses };
