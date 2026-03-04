const { Router } = require('express');
const { pool } = require('../db');
const { authenticateToken } = require('../middleware/auth');

const router = Router();

// ── GET /api/leaderboard?type=score&limit=50 ──
router.get('/', authenticateToken, async (req, res) => {
  const type = req.query.type || 'score';
  const limit = Math.min(parseInt(req.query.limit) || 50, 100);

  try {
    let query;

    switch (type) {
      case 'military': {
        // Top by total unit value
        query = `
          SELECT p.id, p.username, p.faction, p.score, p.relics,
                 a.name as alliance_name, a.tag as alliance_tag,
                 COALESCE(SUM(u.quantity), 0)::int as military_value
          FROM players p
          LEFT JOIN alliances a ON p.alliance_id = a.id
          LEFT JOIN circles c ON c.player_id = p.id
          LEFT JOIN units u ON u.circle_id = c.id AND u.quantity > 0
          WHERE p.is_banned = false
          GROUP BY p.id, a.name, a.tag
          ORDER BY military_value DESC, p.score DESC
          LIMIT $1
        `;
        break;
      }
      case 'relics': {
        query = `
          SELECT p.id, p.username, p.faction, p.score, p.relics,
                 a.name as alliance_name, a.tag as alliance_tag,
                 0 as military_value
          FROM players p
          LEFT JOIN alliances a ON p.alliance_id = a.id
          WHERE p.is_banned = false
          ORDER BY p.relics DESC, p.score DESC
          LIMIT $1
        `;
        break;
      }
      default: {
        // score
        query = `
          SELECT p.id, p.username, p.faction, p.score, p.relics,
                 a.name as alliance_name, a.tag as alliance_tag,
                 0 as military_value
          FROM players p
          LEFT JOIN alliances a ON p.alliance_id = a.id
          WHERE p.is_banned = false
          ORDER BY p.score DESC
          LIMIT $1
        `;
        break;
      }
    }

    const result = await pool.query(query, [limit]);

    const entries = result.rows.map((row, i) => ({
      rank: i + 1,
      id: row.id,
      username: row.username,
      faction: row.faction,
      score: parseInt(row.score),
      relics: row.relics,
      militaryValue: parseInt(row.military_value),
      alliance: row.alliance_tag ? { name: row.alliance_name, tag: row.alliance_tag } : null,
    }));

    res.json({ type, entries });
  } catch (err) {
    console.error('Leaderboard error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
