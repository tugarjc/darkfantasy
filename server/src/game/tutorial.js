// ============================================================
// INFERNO DOMINI — Tutorial / Onboarding Quests
// 7 introduction quests for new players (Day 1-7)
// ============================================================

const TUTORIAL_QUESTS = [
  {
    id: 'premiere_flamme',
    name: 'Première Flamme',
    description: 'Améliorer la Forge des Damnés au niveau 2',
    objective: { type: 'upgrade_building', building: 'forge_damnes', level: 2 },
    reward: { iron: 300, essence: 0, souls: 0, relics: 0, score: 50 },
    chapter: 1,
  },
  {
    id: 'essence_vie',
    name: 'Essence de Vie',
    description: 'Améliorer le Sanctuaire du Néant au niveau 2',
    objective: { type: 'upgrade_building', building: 'sanctuaire_neant', level: 2 },
    reward: { iron: 0, essence: 200, souls: 0, relics: 0, score: 50 },
    chapter: 1,
  },
  {
    id: 'premiers_soldats',
    name: 'Premiers Soldats',
    description: 'Entraîner 10 Squelettes Soldats',
    objective: { type: 'train_units', unit: 'squelette_soldat', count: 10 },
    reward: { iron: 0, essence: 0, souls: 100, relics: 0, score: 50 },
    chapter: 1,
  },
  {
    id: 'connais_ennemi',
    name: 'Connais ton Ennemi',
    description: 'Lancer une mission d\'espionnage',
    objective: { type: 'send_spy', count: 1 },
    reward: { iron: 0, essence: 0, souls: 0, relics: 50, score: 75 },
    chapter: 2,
  },
  {
    id: 'murs_sang',
    name: 'Murs de Sang',
    description: 'Améliorer le Mur des Âmes au niveau 2',
    objective: { type: 'upgrade_building', building: 'mur_ames', level: 2 },
    reward: { iron: 500, essence: 0, souls: 0, relics: 0, score: 75 },
    chapter: 2,
  },
  {
    id: 'premiere_conquete',
    name: 'Première Conquête',
    description: 'Attaquer un événement mondial ou une Terre Maudite',
    objective: { type: 'attack_event', count: 1 },
    reward: { iron: 500, essence: 300, souls: 200, relics: 25, score: 100 },
    chapter: 3,
  },
  {
    id: 'maitre_ombres',
    name: 'Maître des Ombres',
    description: 'Compléter les 6 quêtes précédentes',
    objective: { type: 'complete_all_previous' },
    reward: { iron: 1000, essence: 800, souls: 500, relics: 500, score: 250 },
    chapter: 3,
  },
];

// New player protection tiers
const PROTECTION_TIERS = {
  novice: {
    maxScore: 1000,
    maxAge: 72, // hours
    immunity: true,       // full PvP immunity
    description: 'Immunité PvP totale',
  },
  apprenti: {
    maxScore: 5000,
    attackerScoreRatio: 3, // can only be attacked by players with < 3x score
    description: 'Attaqué par joueurs < 3x votre score',
  },
  seigneur: {
    maxScore: Infinity,
    attackerScoreRatio: 5, // PvP complet, ratio 5x max
    description: 'PvP complet, ratio x5 max',
  },
};

// Anti-farming: max attacks on same target
const ANTI_FARMING = {
  maxAttacksPerDay: 3,
  cooldownHours: 12,
};

function getProtectionTier(score, createdAt) {
  const ageHours = (Date.now() - new Date(createdAt).getTime()) / (1000 * 3600);
  if (score < PROTECTION_TIERS.novice.maxScore || ageHours < PROTECTION_TIERS.novice.maxAge) {
    return 'novice';
  }
  if (score < PROTECTION_TIERS.apprenti.maxScore) {
    return 'apprenti';
  }
  return 'seigneur';
}

// Check if an attack is allowed based on protection rules
function canAttack(attackerScore, defenderScore, defenderCreatedAt) {
  const tier = getProtectionTier(defenderScore, defenderCreatedAt);

  if (tier === 'novice') {
    return { allowed: false, reason: 'Ce joueur est protégé (novice — immunité PvP)' };
  }

  const tierDef = PROTECTION_TIERS[tier];
  if (tierDef.attackerScoreRatio && attackerScore > defenderScore * tierDef.attackerScoreRatio) {
    return { allowed: false, reason: `Score trop élevé pour attaquer ce joueur (ratio max x${tierDef.attackerScoreRatio})` };
  }

  return { allowed: true };
}

module.exports = {
  TUTORIAL_QUESTS,
  PROTECTION_TIERS,
  ANTI_FARMING,
  getProtectionTier,
  canAttack,
};
