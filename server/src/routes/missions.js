const { Router } = require('express');
const { pool } = require('../db');
const { authenticateToken } = require('../middleware/auth');
const { generateDailyMissions, COMPLETION_BONUS } = require('../game/dailyMissions');

const router = Router();

// ── GET /api/missions ── Get today's missions (generate if needed)
router.get('/', authenticateToken, async (req, res) => {
  try {
    const today = new Date().toISOString().split('T')[0];

    let result = await pool.query(
      'SELECT * FROM daily_missions WHERE player_id = $1 AND day = $2',
      [req.user.id, today]
    );

    if (result.rows.length === 0) {
      // Generate new missions for today
      const missions = generateDailyMissions();
      await pool.query(
        'INSERT INTO daily_missions (player_id, day, missions, completed) VALUES ($1, $2, $3, 0)',
        [req.user.id, today, JSON.stringify(missions)]
      );
      result = await pool.query(
        'SELECT * FROM daily_missions WHERE player_id = $1 AND day = $2',
        [req.user.id, today]
      );
    }

    const row = result.rows[0];
    const missions = typeof row.missions === 'string' ? JSON.parse(row.missions) : row.missions;
    const bonusClaimed = typeof row.bonus_claimed === 'string' ? JSON.parse(row.bonus_claimed) : (row.bonus_claimed || {});

    res.json({
      day: row.day,
      missions,
      completed: row.completed,
      bonuses: COMPLETION_BONUS,
      bonusClaimed,
    });
  } catch (err) {
    console.error('Missions get error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ── POST /api/missions/progress ── Update mission progress
router.post('/progress', authenticateToken, async (req, res) => {
  const { missionType, amount = 1 } = req.body;
  if (!missionType) return res.status(400).json({ error: 'missionType requis' });

  try {
    const today = new Date().toISOString().split('T')[0];

    const result = await pool.query(
      'SELECT * FROM daily_missions WHERE player_id = $1 AND day = $2 FOR UPDATE',
      [req.user.id, today]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Aucune mission pour aujourd\'hui' });
    }

    const row = result.rows[0];
    const missions = typeof row.missions === 'string' ? JSON.parse(row.missions) : row.missions;

    let updated = false;
    for (const m of missions) {
      if (m.type === missionType && !m.completed) {
        m.progress = Math.min(m.target, m.progress + amount);
        if (m.progress >= m.target) {
          m.completed = true;
        }
        updated = true;
      }
    }

    if (updated) {
      const completedCount = missions.filter(m => m.completed).length;
      await pool.query(
        'UPDATE daily_missions SET missions = $3, completed = $4 WHERE player_id = $1 AND day = $2',
        [req.user.id, today, JSON.stringify(missions), completedCount]
      );
    }

    res.json({ missions, completed: missions.filter(m => m.completed).length });
  } catch (err) {
    console.error('Mission progress error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ── POST /api/missions/claim ── Claim reward for a completed mission
router.post('/claim', authenticateToken, async (req, res) => {
  const { index } = req.body; // mission index (0-4) or 'bonus_3' or 'bonus_5'
  if (index === undefined) return res.status(400).json({ error: 'index requis' });

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const today = new Date().toISOString().split('T')[0];

    const result = await client.query(
      'SELECT * FROM daily_missions WHERE player_id = $1 AND day = $2 FOR UPDATE',
      [req.user.id, today]
    );
    if (result.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Aucune mission' });
    }

    const row = result.rows[0];
    const missions = typeof row.missions === 'string' ? JSON.parse(row.missions) : row.missions;
    const bonusClaimed = typeof row.bonus_claimed === 'string' ? JSON.parse(row.bonus_claimed) : (row.bonus_claimed || {});

    // Get primary circle for rewards
    const circle = await client.query(
      'SELECT id FROM circles WHERE player_id = $1 AND is_primary = true',
      [req.user.id]
    );
    if (circle.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Cercle non trouve' });
    }
    const circleId = circle.rows[0].id;

    let reward;

    // Bonus claims
    if (index === 'bonus_3' || index === 'bonus_5') {
      const needed = index === 'bonus_3' ? 3 : 5;
      const completedCount = missions.filter(m => m.completed).length;

      if (completedCount < needed) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: `${needed} missions requises` });
      }

      if (bonusClaimed[index]) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: 'Bonus deja reclame' });
      }

      reward = COMPLETION_BONUS[needed];
      bonusClaimed[index] = true;
    } else {
      // Individual mission claim
      const idx = parseInt(index);
      if (idx < 0 || idx >= missions.length) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: 'Index invalide' });
      }
      const m = missions[idx];
      if (!m.completed) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: 'Mission non completee' });
      }
      if (m.claimed) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: 'Recompense deja reclamee' });
      }

      reward = { iron: m.rewardIron, essence: m.rewardEssence, souls: m.rewardSouls, score: m.rewardScore };
      missions[idx].claimed = true;
    }

    // Apply rewards
    await client.query(
      `UPDATE resources SET
        iron = iron + $2,
        essence = essence + $3,
        souls = souls + $4
       WHERE circle_id = $1`,
      [circleId, reward.iron, reward.essence, reward.souls]
    );

    if (reward.score > 0) {
      await client.query('UPDATE players SET score = score + $2 WHERE id = $1', [req.user.id, reward.score]);
    }

    // Save updated missions and bonus state
    await client.query(
      'UPDATE daily_missions SET missions = $3, bonus_claimed = $4 WHERE player_id = $1 AND day = $2',
      [req.user.id, today, JSON.stringify(missions), JSON.stringify(bonusClaimed)]
    );

    await client.query('COMMIT');

    res.json({
      message: 'Recompense reclamee',
      reward,
      missions,
    });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Mission claim error:', err);
    res.status(500).json({ error: 'Internal server error' });
  } finally {
    client.release();
  }
});

module.exports = router;
