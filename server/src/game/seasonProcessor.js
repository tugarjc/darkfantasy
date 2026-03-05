// ============================================================
// INFERNO DOMINI — Season Lifecycle Processor
// Activates upcoming seasons, ends expired ones, distributes rewards
// ============================================================

const { pool } = require('../db');
const { computePrestigeLevel, getPrestigeBonuses, seasonXpFromScore } = require('./prestige');
const { checkAchievement } = require('./achievements');

async function seasonTick() {
  const client = await pool.connect();
  try {
    // 1. Activate upcoming seasons whose start_date has passed
    const activated = await client.query(`
      UPDATE seasons SET status = 'active'
      WHERE status = 'upcoming' AND start_date <= NOW()
      RETURNING name
    `);
    for (const s of activated.rows) {
      console.log(`[SEASON] Season "${s.name}" is now active.`);
    }

    // 2. Find seasons to end
    const expired = await client.query(`
      SELECT * FROM seasons
      WHERE status = 'active' AND end_date <= NOW()
    `);

    for (const season of expired.rows) {
      await client.query('BEGIN');
      try {
        // Snapshot player scores into season_scores
        await client.query(`
          INSERT INTO season_scores (season_id, player_id, score)
          SELECT $1, id, score FROM players
          WHERE server_id = $2 AND is_banned = false AND score > 0
          ON CONFLICT (season_id, player_id) DO UPDATE SET score = EXCLUDED.score
        `, [season.id, season.server_id]);

        // Rank them
        await client.query(`
          WITH ranked AS (
            SELECT id, ROW_NUMBER() OVER (ORDER BY score DESC) as rk
            FROM season_scores WHERE season_id = $1
          )
          UPDATE season_scores ss SET rank = ranked.rk
          FROM ranked WHERE ss.id = ranked.id
        `, [season.id]);

        // Get all scored entries
        const scores = await client.query(
          'SELECT * FROM season_scores WHERE season_id = $1 ORDER BY rank',
          [season.id]
        );
        const rewards = season.rewards_config || {};

        for (const entry of scores.rows) {
          // Determine relics reward by rank
          let relicsReward = rewards.participant || 100;
          if (entry.rank === 1) relicsReward = rewards['1'] || 5000;
          else if (entry.rank === 2) relicsReward = rewards['2'] || 3000;
          else if (entry.rank === 3) relicsReward = rewards['3'] || 2000;
          else if (entry.rank <= 10) relicsReward = rewards.top10 || 1000;
          else if (entry.rank <= 25) relicsReward = rewards.top25 || 500;
          else if (entry.rank <= 50) relicsReward = rewards.top50 || 200;

          // Save relics earned
          await client.query(
            'UPDATE season_scores SET relics_earned = $2 WHERE id = $1',
            [entry.id, relicsReward]
          );

          // Give relics to player
          await client.query(
            'UPDATE players SET relics = relics + $2 WHERE id = $1',
            [entry.player_id, relicsReward]
          );

          // Award prestige XP
          const xpGain = seasonXpFromScore(parseInt(entry.score));
          await client.query(`
            INSERT INTO prestige (player_id, total_xp, level, bonuses, updated_at)
            VALUES ($1, $2, 0, '{}', NOW())
            ON CONFLICT (player_id) DO UPDATE
            SET total_xp = prestige.total_xp + $2, updated_at = NOW()
          `, [entry.player_id, xpGain]);

          // Recompute prestige level and bonuses
          const pRow = await client.query(
            'SELECT total_xp FROM prestige WHERE player_id = $1',
            [entry.player_id]
          );
          const totalXp = parseInt(pRow.rows[0].total_xp);
          const newLevel = computePrestigeLevel(totalXp);
          const bonuses = getPrestigeBonuses(newLevel);

          await client.query(
            'UPDATE prestige SET level = $2, bonuses = $3 WHERE player_id = $1',
            [entry.player_id, newLevel, JSON.stringify(bonuses)]
          );

          // Achievement hook
          if (newLevel >= 1) {
            checkAchievement(entry.player_id, 'prestige_1', 0, null, 1).catch(() => {});
          }

          // Sync victory_points for display
          await client.query(
            'UPDATE players SET victory_points = $2 WHERE id = $1',
            [entry.player_id, totalXp]
          );
        }

        // Mark season as ended
        await client.query(
          "UPDATE seasons SET status = 'ended' WHERE id = $1",
          [season.id]
        );

        console.log(`[SEASON] Season "${season.name}" ended. ${scores.rows.length} players ranked.`);
        await client.query('COMMIT');
      } catch (err) {
        await client.query('ROLLBACK');
        console.error('[SEASON] End season error:', err);
      }
    }
  } catch (err) {
    console.error('[SEASON] Tick error:', err);
  } finally {
    client.release();
  }
}

function startSeasonProcessor(intervalMs = 60000) {
  console.log(`[SEASON] Processor started (interval: ${intervalMs}ms)`);
  return setInterval(seasonTick, intervalMs);
}

module.exports = { startSeasonProcessor, seasonTick };
