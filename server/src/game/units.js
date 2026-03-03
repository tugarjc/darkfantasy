// ============================================================
// INFERNO DOMINI — Unit Definitions
// ============================================================

const UNITS = {
  // ── Terrestres ──
  squelette_soldat: {
    name: 'Squelette Soldat',
    category: 'ground',
    attack: 5, defense: 2, plunder: 5,
    costFer: 60, costEssence: 15, costAmes: 0,
    trainTime: 60, // 1 min
    requires: { building: 'caserne_damnes', level: 1 },
  },
  diablotin: {
    name: 'Diablotin',
    category: 'ground',
    attack: 10, defense: 5, plunder: 10,
    costFer: 100, costEssence: 30, costAmes: 0,
    trainTime: 120,
    requires: { building: 'caserne_damnes', level: 3 },
  },
  golem_cendres: {
    name: 'Golem de Cendres',
    category: 'ground',
    attack: 25, defense: 40, plunder: 0,
    costFer: 300, costEssence: 50, costAmes: 10,
    trainTime: 480,
    requires: { building: 'caserne_damnes', level: 5 },
  },
  seigneur_guerre: {
    name: 'Seigneur de Guerre',
    category: 'ground',
    attack: 50, defense: 20, plunder: 40,
    costFer: 400, costEssence: 80, costAmes: 20,
    trainTime: 900,
    requires: { building: 'caserne_damnes', level: 8 },
  },
  gardien_abime: {
    name: "Gardien de l'Abîme",
    category: 'ground',
    attack: 15, defense: 80, plunder: 0,
    costFer: 200, costEssence: 40, costAmes: 30,
    trainTime: 1200,
    requires: { building: 'caserne_damnes', level: 10 },
  },

  // ── Aériennes ──
  imp_volant: {
    name: 'Imp Volant',
    category: 'air',
    attack: 15, defense: 8, plunder: 15,
    costFer: 150, costEssence: 60, costAmes: 5,
    trainTime: 300,
    requires: { building: 'antre_betes', level: 1 },
  },
  drake_ombres: {
    name: 'Drake des Ombres',
    category: 'air',
    attack: 80, defense: 40, plunder: 60,
    costFer: 800, costEssence: 300, costAmes: 50,
    trainTime: 2700,
    requires: { building: 'antre_betes', level: 5 },
  },
  liche_aerienne: {
    name: 'Liche Aérienne',
    category: 'air',
    attack: 60, defense: 60, plunder: 0,
    costFer: 600, costEssence: 400, costAmes: 80,
    trainTime: 3600,
    requires: { building: 'antre_betes', level: 8 },
  },
  dragon_abyssal: {
    name: 'Dragon Abyssal',
    category: 'air',
    attack: 250, defense: 150, plunder: 200,
    costFer: 3000, costEssence: 1000, costAmes: 200,
    trainTime: 14400, // 4h
    requires: { building: 'antre_betes', level: 10 },
  },
};

module.exports = { UNITS };
