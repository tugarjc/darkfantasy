// ============================================================
// INFERNO DOMINI — Research Definitions & Tech Tree
// ============================================================

const RESEARCHES = {
  // ── Forge Infernale (Production) ──
  metallurgie_maudite: {
    name: 'Metallurgie Maudite',
    category: 'production',
    description: '+5% production Fer par niveau',
    baseFer: 200, baseEssence: 100, baseAmes: 0,
    baseTime: 600, // 10 min
    maxLevel: 20,
    prerequisites: [{ building: 'bibliotheque_obscure', level: 1 }],
  },
  extraction_essence: {
    name: "Extraction d'Essence",
    category: 'production',
    description: '+5% production Essence par niveau',
    baseFer: 150, baseEssence: 200, baseAmes: 0,
    baseTime: 600,
    maxLevel: 20,
    prerequisites: [{ building: 'bibliotheque_obscure', level: 1 }],
  },
  recolte_ames: {
    name: "Recolte d'Ames",
    category: 'production',
    description: '+5% production Ames par niveau',
    baseFer: 200, baseEssence: 150, baseAmes: 50,
    baseTime: 900,
    maxLevel: 20,
    prerequisites: [{ building: 'bibliotheque_obscure', level: 3 }, { building: 'puits_ames', level: 1 }],
  },
  entrepot_etendu: {
    name: 'Entrepot Etendu',
    category: 'production',
    description: '+20% capacite de stockage par niveau',
    baseFer: 300, baseEssence: 200, baseAmes: 30,
    baseTime: 1200,
    maxLevel: 15,
    prerequisites: [{ building: 'bibliotheque_obscure', level: 3 }, { building: 'entrepot_damnes', level: 5 }],
  },
  economie_guerre: {
    name: 'Economie de Guerre',
    category: 'production',
    description: '-3% cout des unites par niveau',
    baseFer: 400, baseEssence: 300, baseAmes: 80,
    baseTime: 1800,
    maxLevel: 10,
    prerequisites: [{ building: 'bibliotheque_obscure', level: 5 }, { research: 'metallurgie_maudite', level: 5 }],
  },

  // ── Arts Martiaux (Combat) ──
  armes_maudites: {
    name: 'Armes Maudites',
    category: 'combat',
    description: '+5% attaque toutes unites par niveau',
    baseFer: 300, baseEssence: 150, baseAmes: 20,
    baseTime: 900,
    maxLevel: 20,
    prerequisites: [{ building: 'bibliotheque_obscure', level: 2 }],
  },
  armure_damnes: {
    name: 'Armure des Damnes',
    category: 'combat',
    description: '+5% defense toutes unites par niveau',
    baseFer: 250, baseEssence: 200, baseAmes: 20,
    baseTime: 900,
    maxLevel: 20,
    prerequisites: [{ building: 'bibliotheque_obscure', level: 2 }],
  },
  sorcellerie_aerienne: {
    name: 'Sorcellerie Aerienne',
    category: 'combat',
    description: '+8% attaque unites aeriennes par niveau',
    baseFer: 400, baseEssence: 350, baseAmes: 50,
    baseTime: 1500,
    maxLevel: 15,
    prerequisites: [{ building: 'bibliotheque_obscure', level: 5 }, { building: 'antre_betes', level: 3 }],
  },
  tactiques_infernales: {
    name: 'Tactiques Infernales',
    category: 'combat',
    description: '+3% pillage par niveau',
    baseFer: 350, baseEssence: 250, baseAmes: 40,
    baseTime: 1200,
    maxLevel: 15,
    prerequisites: [{ building: 'bibliotheque_obscure', level: 4 }, { research: 'armes_maudites', level: 3 }],
  },
  blindage_runique: {
    name: 'Blindage Runique',
    category: 'combat',
    description: '+3% efficacite murs par niveau',
    baseFer: 500, baseEssence: 300, baseAmes: 60,
    baseTime: 1800,
    maxLevel: 10,
    prerequisites: [{ building: 'bibliotheque_obscure', level: 6 }, { building: 'mur_ames', level: 5 }],
  },

  // ── Propulsion (Mobilite) ──
  vitesse_infernale: {
    name: 'Vitesse Infernale',
    category: 'mobility',
    description: '+10% vitesse legions par niveau',
    baseFer: 200, baseEssence: 200, baseAmes: 10,
    baseTime: 600,
    maxLevel: 20,
    prerequisites: [{ building: 'bibliotheque_obscure', level: 1 }],
  },
  navigation_plans: {
    name: 'Navigation des Plans',
    category: 'mobility',
    description: '-5% cout en ames par deplacement par niveau',
    baseFer: 300, baseEssence: 250, baseAmes: 30,
    baseTime: 1200,
    maxLevel: 15,
    prerequisites: [{ building: 'bibliotheque_obscure', level: 4 }, { research: 'vitesse_infernale', level: 3 }],
  },
  portails_temporaires: {
    name: 'Portails Temporaires',
    category: 'mobility',
    description: '+1 legion active par 3 niveaux',
    baseFer: 500, baseEssence: 400, baseAmes: 80,
    baseTime: 2400,
    maxLevel: 9,
    prerequisites: [{ building: 'bibliotheque_obscure', level: 8 }, { research: 'navigation_plans', level: 5 }],
  },

  // ── Occultisme (Special) ──
  espionnage_occulte: {
    name: 'Espionnage Occulte',
    category: 'special',
    description: '+1 niveau intel espionnage par niveau',
    baseFer: 250, baseEssence: 300, baseAmes: 40,
    baseTime: 1200,
    maxLevel: 10,
    prerequisites: [{ building: 'bibliotheque_obscure', level: 3 }, { building: 'tour_vigie', level: 1 }],
  },
  contre_espionnage: {
    name: 'Contre-Espionnage',
    category: 'special',
    description: '+10% detection espions par niveau',
    baseFer: 300, baseEssence: 350, baseAmes: 50,
    baseTime: 1500,
    maxLevel: 10,
    prerequisites: [{ building: 'bibliotheque_obscure', level: 5 }, { research: 'espionnage_occulte', level: 3 }],
  },
  colonisation_rapide: {
    name: 'Colonisation Rapide',
    category: 'special',
    description: '-10% temps colonisation par niveau',
    baseFer: 600, baseEssence: 400, baseAmes: 100,
    baseTime: 3600,
    maxLevel: 5,
    prerequisites: [{ building: 'bibliotheque_obscure', level: 8 }],
  },
  maitrise_failles: {
    name: 'Maitrise des Failles',
    category: 'special',
    description: '+10% bonus evenements failles par niveau',
    baseFer: 500, baseEssence: 500, baseAmes: 120,
    baseTime: 3600,
    maxLevel: 10,
    prerequisites: [{ building: 'bibliotheque_obscure', level: 10 }],
  },

  // ── Arcanes Legendaires (Endgame) ──
  teleportation_infernale: {
    name: 'Teleportation Infernale',
    category: 'legendary',
    description: 'Deplace un cercle vers des coordonnees choisies',
    baseFer: 5000, baseEssence: 5000, baseAmes: 2000,
    baseTime: 86400, // 24h
    maxLevel: 1,
    prerequisites: [{ building: 'bibliotheque_obscure', level: 20 }, { research: 'portails_temporaires', level: 9 }],
  },
  bouclier_absolu: {
    name: 'Bouclier Absolu',
    category: 'legendary',
    description: 'Active un bouclier 24h (cooldown 7j)',
    baseFer: 8000, baseEssence: 6000, baseAmes: 3000,
    baseTime: 86400,
    maxLevel: 1,
    prerequisites: [{ building: 'bibliotheque_obscure', level: 20 }, { research: 'blindage_runique', level: 10 }],
  },
  vision_pandemonium: {
    name: 'Vision du Pandemonium',
    category: 'legendary',
    description: 'Revele tous les cercles sur la carte',
    baseFer: 6000, baseEssence: 8000, baseAmes: 2500,
    baseTime: 86400,
    maxLevel: 1,
    prerequisites: [{ building: 'bibliotheque_obscure', level: 20 }, { research: 'espionnage_occulte', level: 10 }],
  },
  portail_permanent: {
    name: 'Portail Permanent',
    category: 'legendary',
    description: 'Legions instantanees entre vos cercles',
    baseFer: 10000, baseEssence: 8000, baseAmes: 4000,
    baseTime: 172800, // 48h
    maxLevel: 1,
    prerequisites: [{ building: 'bibliotheque_obscure', level: 25 }, { research: 'teleportation_infernale', level: 1 }],
  },
  invocation_primordiale: {
    name: 'Invocation Primordiale',
    category: 'legendary',
    description: 'Debloque le Dragon Abyssal au niveau max',
    baseFer: 12000, baseEssence: 10000, baseAmes: 5000,
    baseTime: 172800,
    maxLevel: 1,
    prerequisites: [{ building: 'bibliotheque_obscure', level: 25 }, { research: 'sorcellerie_aerienne', level: 15 }],
  },
  economie_absolue: {
    name: 'Economie Absolue',
    category: 'legendary',
    description: '+50% production toutes ressources',
    baseFer: 15000, baseEssence: 12000, baseAmes: 6000,
    baseTime: 259200, // 72h
    maxLevel: 1,
    prerequisites: [{ building: 'bibliotheque_obscure', level: 28 }, { research: 'economie_guerre', level: 10 }],
  },
  drain_dimensionnel: {
    name: 'Drain Dimensionnel',
    category: 'legendary',
    description: 'Vole 5% des ressources des cibles sans attaque',
    baseFer: 20000, baseEssence: 15000, baseAmes: 8000,
    baseTime: 345600, // 96h
    maxLevel: 1,
    prerequisites: [{ building: 'bibliotheque_obscure', level: 30 }, { research: 'maitrise_failles', level: 10 }],
  },
};

const CATEGORY_LABELS = {
  production: 'Forge Infernale',
  combat: 'Arts Martiaux',
  mobility: 'Propulsion',
  special: 'Occultisme',
  legendary: 'Arcanes Legendaires',
};

module.exports = { RESEARCHES, CATEGORY_LABELS };
