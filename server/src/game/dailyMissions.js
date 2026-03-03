// ============================================================
// INFERNO DOMINI — Daily Missions System
// ============================================================

// Mission templates — each has a type, description, target, and rewards
const MISSION_TEMPLATES = [
  {
    type: 'build',
    description: 'Ameliorer un batiment',
    target: 1,
    rewardIron: 500,
    rewardEssence: 300,
    rewardSouls: 0,
    rewardScore: 20,
  },
  {
    type: 'train',
    description: 'Entrainer 50 unites',
    target: 50,
    rewardIron: 400,
    rewardEssence: 200,
    rewardSouls: 50,
    rewardScore: 15,
  },
  {
    type: 'attack',
    description: 'Lancer une attaque',
    target: 1,
    rewardIron: 800,
    rewardEssence: 600,
    rewardSouls: 200,
    rewardScore: 40,
  },
  {
    type: 'trade',
    description: 'Creer une offre au marche',
    target: 1,
    rewardIron: 300,
    rewardEssence: 300,
    rewardSouls: 100,
    rewardScore: 10,
  },
  {
    type: 'research',
    description: 'Lancer une recherche',
    target: 1,
    rewardIron: 600,
    rewardEssence: 400,
    rewardSouls: 100,
    rewardScore: 25,
  },
  {
    type: 'event',
    description: 'Participer a un evenement',
    target: 1,
    rewardIron: 1000,
    rewardEssence: 800,
    rewardSouls: 300,
    rewardScore: 50,
  },
  {
    type: 'chat',
    description: 'Envoyer 5 messages',
    target: 5,
    rewardIron: 200,
    rewardEssence: 100,
    rewardSouls: 0,
    rewardScore: 5,
  },
  {
    type: 'spy',
    description: 'Espionner un joueur',
    target: 1,
    rewardIron: 500,
    rewardEssence: 500,
    rewardSouls: 150,
    rewardScore: 30,
  },
  {
    type: 'train_heavy',
    description: 'Entrainer 10 unites aeriennes',
    target: 10,
    rewardIron: 700,
    rewardEssence: 500,
    rewardSouls: 200,
    rewardScore: 35,
  },
  {
    type: 'build_multi',
    description: 'Ameliorer 3 batiments',
    target: 3,
    rewardIron: 1200,
    rewardEssence: 800,
    rewardSouls: 200,
    rewardScore: 50,
  },
];

// Bonus for completing multiple missions
const COMPLETION_BONUS = {
  3: { iron: 1000, essence: 800, souls: 300, score: 50, label: '3 missions' },
  5: { iron: 3000, essence: 2000, souls: 1000, score: 150, label: 'Toutes les missions' },
};

// Generate 5 random missions for a player
function generateDailyMissions() {
  const shuffled = [...MISSION_TEMPLATES].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, 5).map(m => ({
    ...m,
    progress: 0,
    completed: false,
    claimed: false,
  }));
}

module.exports = {
  MISSION_TEMPLATES,
  COMPLETION_BONUS,
  generateDailyMissions,
};
