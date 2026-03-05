const { pool } = require('../db');
const { notify } = require('../utils/notify');

const ACHIEVEMENTS = [
  // ── Progression ──
  { id: 'first_building', category: 'progression', target: 1, rewardIron: 200, rewardEssence: 100, rewardSouls: 0, rewardRelics: 0, rewardScore: 0 },
  { id: 'builder_10', category: 'progression', target: 10, rewardIron: 500, rewardEssence: 300, rewardSouls: 0, rewardRelics: 0, rewardScore: 50 },
  { id: 'palace_10', category: 'progression', target: 10, rewardIron: 2000, rewardEssence: 1000, rewardSouls: 500, rewardRelics: 0, rewardScore: 200 },
  { id: 'all_buildings', category: 'progression', target: 1, rewardIron: 5000, rewardEssence: 3000, rewardSouls: 1500, rewardRelics: 10, rewardScore: 0 },
  // ── Combat ──
  { id: 'first_attack', category: 'combat', target: 1, rewardIron: 300, rewardEssence: 200, rewardSouls: 0, rewardRelics: 0, rewardScore: 0 },
  { id: 'warrior_50', category: 'combat', target: 50, rewardIron: 1000, rewardEssence: 500, rewardSouls: 0, rewardRelics: 0, rewardScore: 100 },
  { id: 'victories_25', category: 'combat', target: 25, rewardIron: 2000, rewardEssence: 1000, rewardSouls: 0, rewardRelics: 0, rewardScore: 300 },
  { id: 'dragon_slayer', category: 'combat', target: 1, rewardIron: 5000, rewardEssence: 3000, rewardSouls: 2000, rewardRelics: 20, rewardScore: 0 },
  // ── Economie ──
  { id: 'first_trade', category: 'economy', target: 1, rewardIron: 0, rewardEssence: 200, rewardSouls: 100, rewardRelics: 0, rewardScore: 0 },
  { id: 'merchant_20', category: 'economy', target: 20, rewardIron: 1000, rewardEssence: 500, rewardSouls: 0, rewardRelics: 0, rewardScore: 100 },
  { id: 'rich_100k', category: 'economy', target: 1, rewardIron: 0, rewardEssence: 500, rewardSouls: 500, rewardRelics: 0, rewardScore: 150 },
  { id: 'collector_500', category: 'economy', target: 1, rewardIron: 2000, rewardEssence: 2000, rewardSouls: 1000, rewardRelics: 0, rewardScore: 0 },
  // ── Social ──
  { id: 'join_alliance', category: 'social', target: 1, rewardIron: 300, rewardEssence: 200, rewardSouls: 0, rewardRelics: 0, rewardScore: 0 },
  { id: 'chat_100', category: 'social', target: 100, rewardIron: 500, rewardEssence: 300, rewardSouls: 0, rewardRelics: 0, rewardScore: 50 },
  { id: 'spy_10', category: 'social', target: 10, rewardIron: 800, rewardEssence: 500, rewardSouls: 200, rewardRelics: 0, rewardScore: 0 },
  { id: 'ally_defense', category: 'social', target: 1, rewardIron: 1000, rewardEssence: 800, rewardSouls: 400, rewardRelics: 0, rewardScore: 100 },
  // ── Maitrise ──
  { id: 'research_5', category: 'mastery', target: 5, rewardIron: 0, rewardEssence: 500, rewardSouls: 200, rewardRelics: 0, rewardScore: 0 },
  { id: 'hero_summon', category: 'mastery', target: 1, rewardIron: 800, rewardEssence: 500, rewardSouls: 0, rewardRelics: 0, rewardScore: 100 },
  { id: 'colonize', category: 'mastery', target: 1, rewardIron: 2000, rewardEssence: 1500, rewardSouls: 1000, rewardRelics: 0, rewardScore: 200 },
  { id: 'prestige_1', category: 'mastery', target: 1, rewardIron: 5000, rewardEssence: 3000, rewardSouls: 2000, rewardRelics: 50, rewardScore: 0 },
];

const ACHIEVEMENT_MAP = Object.fromEntries(ACHIEVEMENTS.map(a => [a.id, a]));

/**
 * Check and update achievement progress. Call with increment=1 for most,
 * or with setTo=true to set progress to a specific value (for level checks).
 */
async function checkAchievement(playerId, achievementId, increment = 1, client = null, setTo = null) {
  const def = ACHIEVEMENT_MAP[achievementId];
  if (!def) return;

  const db = client || pool;

  try {
    // Upsert progress
    let result;
    if (setTo !== null) {
      result = await db.query(
        `INSERT INTO player_achievements (player_id, achievement_id, progress)
         VALUES ($1, $2, $3)
         ON CONFLICT (player_id, achievement_id) DO UPDATE SET progress = GREATEST(player_achievements.progress, $3)
         RETURNING progress, unlocked, claimed`,
        [playerId, achievementId, setTo]
      );
    } else {
      result = await db.query(
        `INSERT INTO player_achievements (player_id, achievement_id, progress)
         VALUES ($1, $2, $3)
         ON CONFLICT (player_id, achievement_id) DO UPDATE SET progress = player_achievements.progress + $3
         RETURNING progress, unlocked, claimed`,
        [playerId, achievementId, increment]
      );
    }

    const row = result.rows[0];
    if (row.unlocked || row.claimed) return; // Already unlocked

    if (row.progress >= def.target) {
      await db.query(
        `UPDATE player_achievements SET unlocked = true, unlocked_at = now() WHERE player_id = $1 AND achievement_id = $2`,
        [playerId, achievementId]
      );
      await notify(playerId, 'achievement_unlocked', { achievementId }, client);
    }
  } catch (err) {
    // Non-critical — log and continue
    console.error(`[ACHIEVEMENT] Error checking ${achievementId} for ${playerId}:`, err.message);
  }
}

async function getPlayerAchievements(playerId) {
  const result = await pool.query(
    'SELECT achievement_id, progress, unlocked, unlocked_at, claimed FROM player_achievements WHERE player_id = $1',
    [playerId]
  );
  const progressMap = Object.fromEntries(result.rows.map(r => [r.achievement_id, r]));

  return ACHIEVEMENTS.map(def => ({
    ...def,
    progress: progressMap[def.id]?.progress || 0,
    unlocked: progressMap[def.id]?.unlocked || false,
    unlocked_at: progressMap[def.id]?.unlocked_at || null,
    claimed: progressMap[def.id]?.claimed || false,
  }));
}

module.exports = { ACHIEVEMENTS, checkAchievement, getPlayerAchievements };
