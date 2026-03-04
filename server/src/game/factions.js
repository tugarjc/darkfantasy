// ============================================================
// INFERNO DOMINI — Faction Definitions & Bonuses
// 4 factions, each with unique gameplay bonuses
// ============================================================

const FACTIONS = {
  legion_cendres: {
    name: 'Légion des Cendres',
    description: 'Maîtres de la forge et du fer',
    bonuses: {
      iron_production: 0.10,    // +10% iron production
      building_speed: 0.05,     // +5% building speed
    },
  },
  ordre_vide: {
    name: 'Ordre du Vide',
    description: 'Manipulateurs d\'essence et de magie',
    bonuses: {
      essence_production: 0.10, // +10% essence production
      research_speed: 0.05,     // +5% research speed
    },
  },
  pacte_chaines: {
    name: 'Pacte des Chaînes',
    description: 'Guerriers implacables et conquérants',
    bonuses: {
      attack_power: 0.10,       // +10% attack in combat
      plunder_bonus: 0.10,      // +10% plunder capacity
    },
  },
  culte_sang: {
    name: 'Culte du Sang',
    description: 'Espions et infiltrateurs des ombres',
    bonuses: {
      espionage_power: 0.10,    // +10% espionage effectiveness
      souls_production: 0.10,   // +10% souls production
    },
  },
};

// Get production multiplier for a faction
function factionProductionBonus(faction, resource) {
  const f = FACTIONS[faction];
  if (!f) return 1;
  const key = `${resource}_production`;
  return 1 + (f.bonuses[key] || 0);
}

// Get combat attack multiplier for a faction
function factionAttackBonus(faction) {
  const f = FACTIONS[faction];
  if (!f) return 1;
  return 1 + (f.bonuses.attack_power || 0);
}

// Get espionage multiplier for a faction
function factionEspionageBonus(faction) {
  const f = FACTIONS[faction];
  if (!f) return 1;
  return 1 + (f.bonuses.espionage_power || 0);
}

// Get plunder multiplier for a faction
function factionPlunderBonus(faction) {
  const f = FACTIONS[faction];
  if (!f) return 1;
  return 1 + (f.bonuses.plunder_bonus || 0);
}

// Get building speed multiplier for a faction (lower = faster)
function factionBuildingSpeedBonus(faction) {
  const f = FACTIONS[faction];
  if (!f) return 1;
  return 1 / (1 + (f.bonuses.building_speed || 0));
}

// Get research speed multiplier for a faction (lower = faster)
function factionResearchSpeedBonus(faction) {
  const f = FACTIONS[faction];
  if (!f) return 1;
  return 1 / (1 + (f.bonuses.research_speed || 0));
}

module.exports = {
  FACTIONS,
  factionProductionBonus,
  factionAttackBonus,
  factionEspionageBonus,
  factionPlunderBonus,
  factionBuildingSpeedBonus,
  factionResearchSpeedBonus,
};
