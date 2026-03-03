// ============================================================
// INFERNO DOMINI — World Event Definitions
// ============================================================

const { UNITS } = require('./units');

// ── Event type definitions ──
const EVENT_TYPES = {
  faille: {
    name: 'Faille Dimensionnelle',
    description: 'Une brèche dans la réalité déverse des créatures démoniaques',
    hpBase: 50000,
    hpPerPlayer: 5000,  // scales with server player count
    durationHours: 4,
    difficulty: 1.0,    // loss multiplier
    rewardIron: 2000,
    rewardEssence: 1500,
    rewardSouls: 500,
    rewardScore: 100,
    spawnWeight: 5,     // relative spawn frequency
  },
  invasion: {
    name: 'Invasion Infernale',
    description: 'Une horde massive converge vers cette position',
    hpBase: 150000,
    hpPerPlayer: 10000,
    durationHours: 6,
    difficulty: 1.5,
    rewardIron: 5000,
    rewardEssence: 4000,
    rewardSouls: 2000,
    rewardScore: 300,
    spawnWeight: 3,
  },
  raid: {
    name: 'Raid du Pandémonium',
    description: 'Un archidémon ancien menace le serveur tout entier',
    hpBase: 500000,
    hpPerPlayer: 25000,
    durationHours: 12,
    difficulty: 2.0,
    rewardIron: 15000,
    rewardEssence: 12000,
    rewardSouls: 8000,
    rewardScore: 1000,
    spawnWeight: 1,
  },
};

// Calculate damage dealt by a unit composition against an event
function calculateEventDamage(composition, failleMasteryLevel) {
  let totalDamage = 0;
  for (const [type, qty] of Object.entries(composition)) {
    const unit = UNITS[type];
    if (!unit || qty <= 0) continue;
    totalDamage += unit.attack * qty;
  }
  // Faille mastery bonus: +10% per level
  const masteryBonus = 1 + 0.10 * failleMasteryLevel;
  return Math.floor(totalDamage * masteryBonus);
}

// Calculate unit losses when attacking an event
function calculateEventLosses(composition, difficulty) {
  const losses = {};
  const survivors = {};
  // Base loss rate: 5-15% depending on difficulty, with randomness
  const baseLossRate = 0.05 * difficulty;
  const lossRate = baseLossRate * (0.8 + Math.random() * 0.4);

  for (const [type, qty] of Object.entries(composition)) {
    if (qty <= 0) continue;
    const lost = Math.min(qty, Math.max(1, Math.floor(qty * lossRate)));
    losses[type] = lost;
    const remaining = qty - lost;
    if (remaining > 0) survivors[type] = remaining;
  }
  return { losses, survivors };
}

// Calculate rewards for a player based on their contribution ratio
function calculateRewards(eventType, contributionRatio, failleMasteryLevel) {
  const def = EVENT_TYPES[eventType];
  if (!def) return { iron: 0, essence: 0, souls: 0, score: 0 };

  const masteryBonus = 1 + 0.10 * failleMasteryLevel;
  const ratio = Math.min(1, contributionRatio); // cap at 100%

  return {
    iron: Math.floor(def.rewardIron * ratio * masteryBonus),
    essence: Math.floor(def.rewardEssence * ratio * masteryBonus),
    souls: Math.floor(def.rewardSouls * ratio * masteryBonus),
    score: Math.floor(def.rewardScore * ratio),
  };
}

// Pick a random event type based on weights
function randomEventType() {
  const entries = Object.entries(EVENT_TYPES);
  const totalWeight = entries.reduce((s, [, e]) => s + e.spawnWeight, 0);
  let roll = Math.random() * totalWeight;
  for (const [type, def] of entries) {
    roll -= def.spawnWeight;
    if (roll <= 0) return type;
  }
  return 'faille';
}

module.exports = {
  EVENT_TYPES,
  calculateEventDamage,
  calculateEventLosses,
  calculateRewards,
  randomEventType,
};
