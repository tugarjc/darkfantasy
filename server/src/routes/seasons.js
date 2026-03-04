const { Router } = require('express');
const { pool } = require('../db');
const { authenticateToken } = require('../middleware/auth');
const { PRESTIGE_LEVELS } = require('../game/prestige');

const router = Router();

// GET /api/seasons — list seasons for player's server
router.get('/', authenticateToken, async (req, res) => {
  try {
    const player = await pool.query('SELECT server_id FROM players WHERE id = $1', [req.user.id]);
    const serverId = player.rows[0]?.server_id;
    if (!serverId) return res.json({ seasons: [] });

    const result = await pool.query(`
      SELECT s.*,
        (SELECT COUNT(*) FROM season_scores ss WHERE ss.season_id = s.id) as participant_count,
        (SELECT ss.rank FROM season_scores ss WHERE ss.season_id = s.id AND ss.player_id = $2) as my_rank,
        (SELECT ss.score FROM season_scores ss WHERE ss.season_id = s.id AND ss.player_id = $2) as my_score
      FROM seasons s
      WHERE s.server_id = $1
      ORDER BY s.start_date DESC
      LIMIT 20
    `, [serverId, req.user.id]);

    res.json({ seasons: result.rows });
  } catch (err) {
    console.error('Seasons list error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/seasons/prestige — my prestige info
router.get('/prestige', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM prestige WHERE player_id = $1',
      [req.user.id]
    );

    const prestige = result.rows[0] || { level: 0, total_xp: 0, bonuses: {} };
    const nextLevel = PRESTIGE_LEVELS.find(p => p.level === prestige.level + 1);

    res.json({
      level: prestige.level,
      totalXp: parseInt(prestige.total_xp || 0),
      bonuses: prestige.bonuses,
      nextLevel: nextLevel ? {
        level: nextLevel.level,
        xpRequired: nextLevel.xpRequired,
        bonuses: nextLevel.bonuses,
      } : null,
      allLevels: PRESTIGE_LEVELS,
    });
  } catch (err) {
    console.error('Prestige error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/seasons/:id/leaderboard
router.get('/:id/leaderboard', authenticateToken, async (req, res) => {
  const limit = Math.min(parseInt(req.query.limit) || 50, 100);
  const offset = parseInt(req.query.offset) || 0;

  try {
    const result = await pool.query(`
      SELECT ss.rank, ss.score, ss.relics_earned,
             p.username, p.faction,
             a.tag as alliance_tag
      FROM season_scores ss
      JOIN players p ON p.id = ss.player_id
      LEFT JOIN alliances a ON p.alliance_id = a.id
      WHERE ss.season_id = $1
      ORDER BY ss.rank ASC
      LIMIT $2 OFFSET $3
    `, [req.params.id, limit, offset]);

    res.json({ entries: result.rows });
  } catch (err) {
    console.error('Season leaderboard error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
