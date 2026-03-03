// ============================================================
// INFERNO DOMINI — Building Definitions & Prerequisites
// ============================================================

const BUILDINGS = {
  // ── Production ──
  forge_damnes: {
    name: 'Forge des Damnés',
    category: 'production',
    resource: 'iron',
    baseFer: 60, baseEssence: 15, baseAmes: 0,
    baseTime: 120, // 2 min in seconds
    baseRate: 30,
    maxLevel: 30,
    prerequisites: [],
  },
  sanctuaire_neant: {
    name: 'Sanctuaire du Néant',
    category: 'production',
    resource: 'essence',
    baseFer: 50, baseEssence: 30, baseAmes: 0,
    baseTime: 150,
    baseRate: 20,
    maxLevel: 30,
    prerequisites: [],
  },
  puits_ames: {
    name: 'Puits des Âmes',
    category: 'production',
    resource: 'souls',
    baseFer: 100, baseEssence: 50, baseAmes: 20,
    baseTime: 300,
    baseRate: 10,
    maxLevel: 30,
    prerequisites: [{ building: 'forge_damnes', level: 5 }],
  },
  serre_tenebres: {
    name: 'Serre des Ténèbres',
    category: 'production',
    resource: 'all_bonus',
    baseFer: 200, baseEssence: 150, baseAmes: 50,
    baseTime: 600,
    maxLevel: 30,
    prerequisites: [{ building: 'sanctuaire_neant', level: 10 }],
  },

  // ── Defense ──
  mur_ames: {
    name: 'Mur des Âmes',
    category: 'defense',
    baseFer: 80, baseEssence: 20, baseAmes: 0,
    baseTime: 180,
    maxLevel: 30,
    prerequisites: [],
  },
  tour_chaos: {
    name: 'Tour du Chaos',
    category: 'defense',
    baseFer: 150, baseEssence: 80, baseAmes: 10,
    baseTime: 480,
    maxLevel: 30,
    prerequisites: [{ building: 'mur_ames', level: 3 }],
  },
  portail_invocation: {
    name: "Portail d'Invocation",
    category: 'defense',
    baseFer: 300, baseEssence: 200, baseAmes: 50,
    baseTime: 900,
    maxLevel: 30,
    prerequisites: [{ building: 'tour_chaos', level: 5 }],
  },
  bouclier_infernal: {
    name: 'Bouclier Infernal',
    category: 'defense',
    baseFer: 500, baseEssence: 300, baseAmes: 100,
    baseTime: 1500,
    maxLevel: 30,
    prerequisites: [{ building: 'portail_invocation', level: 8 }],
  },
  crypte_souterraine: {
    name: 'Crypte Souterraine',
    category: 'defense',
    baseFer: 250, baseEssence: 100, baseAmes: 30,
    baseTime: 720,
    maxLevel: 30,
    prerequisites: [{ building: 'mur_ames', level: 10 }],
  },

  // ── Military ──
  caserne_damnes: {
    name: 'Caserne des Damnés',
    category: 'military',
    baseFer: 120, baseEssence: 40, baseAmes: 0,
    baseTime: 240,
    maxLevel: 30,
    prerequisites: [{ building: 'forge_damnes', level: 3 }],
  },
  antre_betes: {
    name: 'Antre des Bêtes',
    category: 'military',
    baseFer: 250, baseEssence: 150, baseAmes: 30,
    baseTime: 600,
    maxLevel: 30,
    prerequisites: [{ building: 'caserne_damnes', level: 5 }],
  },
  forge_ames_liees: {
    name: 'Forge des Âmes Liées',
    category: 'military',
    baseFer: 400, baseEssence: 250, baseAmes: 80,
    baseTime: 1200,
    maxLevel: 30,
    prerequisites: [{ building: 'caserne_damnes', level: 8 }],
  },
  autel_sacrifice: {
    name: "Autel du Sacrifice",
    category: 'military',
    baseFer: 600, baseEssence: 400, baseAmes: 150,
    baseTime: 1800,
    maxLevel: 30,
    prerequisites: [{ building: 'forge_damnes', level: 10 }],
  },

  // ── Support ──
  bibliotheque_obscure: {
    name: 'Bibliothèque Obscure',
    category: 'support',
    baseFer: 100, baseEssence: 80, baseAmes: 0,
    baseTime: 180,
    maxLevel: 30,
    prerequisites: [],
  },
  tour_vigie: {
    name: 'Tour de Vigie',
    category: 'support',
    baseFer: 200, baseEssence: 120, baseAmes: 20,
    baseTime: 480,
    maxLevel: 30,
    prerequisites: [{ building: 'bibliotheque_obscure', level: 5 }],
  },
  marche_demoniaque: {
    name: 'Marché Démoniaque',
    category: 'support',
    baseFer: 300, baseEssence: 200, baseAmes: 40,
    baseTime: 720,
    maxLevel: 30,
    prerequisites: [{ building: 'bibliotheque_obscure', level: 8 }],
  },
  palais_infernal: {
    name: 'Palais Infernal',
    category: 'support',
    baseFer: 350, baseEssence: 200, baseAmes: 60,
    baseTime: 900,
    maxLevel: 30,
    prerequisites: [{ building: 'forge_damnes', level: 5 }],
  },
  entrepot_damnes: {
    name: 'Entrepôt des Damnés',
    category: 'support',
    baseFer: 80, baseEssence: 30, baseAmes: 0,
    baseTime: 120,
    maxLevel: 30,
    prerequisites: [],
  },
};

module.exports = { BUILDINGS };
