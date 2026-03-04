// ============================================================
// INFERNO DOMINI — Alliance Research Definitions
// 6 collective technologies funded by alliance members
// ============================================================

const ALLIANCE_TECHS = {
  logistique_commune: {
    name: 'Logistique Commune',
    maxLevel: 3,
    effect: 'Réduit le temps de transport entre alliés de 10%/nv',
    effectPerLevel: { transport_speed: 0.10 },
    costs: { iron: 30000, essence: 20000, souls: 15000 },
    costMultiplier: 1.5,
  },
  entrepot_ameliore: {
    name: 'Entrepôt Amélioré',
    maxLevel: 5,
    effect: 'Augmente la capacité de stockage de 10000/nv par ressource',
    effectPerLevel: { storage_bonus: 10000 },
    costs: { iron: 60000, essence: 20000, souls: 0 },
    costMultiplier: 1.5,
  },
  coordination_guerre: {
    name: 'Coordination de Guerre',
    maxLevel: 3,
    effect: 'Augmente les PV gagnés pendant les guerres de 5%/nv',
    effectPerLevel: { war_score_bonus: 0.05 },
    costs: { iron: 50000, essence: 50000, souls: 20000 },
    costMultiplier: 1.5,
  },
  bouclier_pacte: {
    name: 'Bouclier de Pacte',
    maxLevel: 1,
    effect: 'Active un bouclier sur tous les membres pendant 2h (cooldown 7j)',
    effectPerLevel: { shield_hours: 2 },
    costs: { iron: 100000, essence: 100000, souls: 100000 },
    costMultiplier: 1,
  },
  maitrise_failles: {
    name: 'Maîtrise des Failles',
    maxLevel: 3,
    effect: 'Augmente les dégâts contre les boss de 10%/nv',
    effectPerLevel: { event_damage_bonus: 0.10 },
    costs: { iron: 0, essence: 40000, souls: 30000 },
    costMultiplier: 1.5,
  },
  recrutement_elite: {
    name: 'Recrutement d\'Élite',
    maxLevel: 3,
    effect: 'Réduit le temps d\'entraînement des unités de 5%/nv',
    effectPerLevel: { train_speed: 0.05 },
    costs: { iron: 40000, essence: 30000, souls: 20000 },
    costMultiplier: 1.5,
  },
};

function allianceTechCost(techType, currentLevel) {
  const tech = ALLIANCE_TECHS[techType];
  if (!tech) return null;
  const mult = Math.pow(tech.costMultiplier, currentLevel);
  return {
    iron: Math.ceil(tech.costs.iron * mult),
    essence: Math.ceil(tech.costs.essence * mult),
    souls: Math.ceil(tech.costs.souls * mult),
  };
}

module.exports = { ALLIANCE_TECHS, allianceTechCost };
