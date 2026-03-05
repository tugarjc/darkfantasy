const { Router } = require('express');
const { pool } = require('../db');
const { authenticateToken } = require('../middleware/auth');
const { getPlayerAchievements } = require('../game/achievements');

const router = Router();
router.use(authenticateToken);

// ── GET /api/achievements ──
router.get('/', async (req, res) => {
  try {
    const achievements = await getPlayerAchievements(req.user.id);
    const unlocked = achievements.filter(a => a.unlocked).length;
    res.json({ achievements, unlocked, total: achievements.length });
  } catch (err) {
    console.error('Load achievements error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ── POST /api/achievements/:id/claim ──
router.post('/:id/claim', async (req, res) => {
  const { id } = req.params;
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const row = await client.query(
      'SELECT progress, unlocked, claimed FROM player_achievements WHERE player_id = $1 AND achievement_id = $2',
      [req.user.id, id]
    );

    if (row.rows.length === 0 || !row.rows[0].unlocked) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Achievement not unlocked' });
    }
    if (row.rows[0].claimed) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Already claimed' });
    }

    // Get achievement definition
    const { ACHIEVEMENTS } = require('../game/achievements');
    const def = ACHIEVEMENTS.find(a => a.id === id);
    if (!def) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Achievement not found' });
    }

    // Mark claimed
    await client.query(
      'UPDATE player_achievements SET claimed = true WHERE player_id = $1 AND achievement_id = $2',
      [req.user.id, id]
    );

    // Apply rewards to primary circle
    const circle = await client.query(
      'SELECT id FROM circles WHERE player_id = $1 AND is_primary = true', [req.user.id]
    );
    if (circle.rows.length > 0) {
      const cid = circle.rows[0].id;
      if (def.rewardIron || def.rewardEssence || def.rewardSouls) {
        await client.query(
          `UPDATE resources SET iron = iron + $1, essence = essence + $2, souls = souls + $3 WHERE circle_id = $4`,
          [def.rewardIron, def.rewardEssence, def.rewardSouls, cid]
        );
      }
    }

    // Apply relics and score
    if (def.rewardRelics || def.rewardScore) {
      await client.query(
        'UPDATE players SET relics = relics + $1, score = score + $2 WHERE id = $3',
        [def.rewardRelics, def.rewardScore, req.user.id]
      );
    }

    await client.query('COMMIT');
    res.json({ message: 'Achievement claimed', reward: { iron: def.rewardIron, essence: def.rewardEssence, souls: def.rewardSouls, relics: def.rewardRelics, score: def.rewardScore } });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Claim achievement error:', err);
    res.status(500).json({ error: 'Internal server error' });
  } finally {
    client.release();
  }
});

module.exports = router;
