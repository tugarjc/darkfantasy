const { Router } = require('express');
const { pool } = require('../db');
const { authenticateToken } = require('../middleware/auth');

const router = Router();

// ── GET /api/reports/battles ──
router.get('/battles', authenticateToken, async (req, res) => {
  const limit = Math.min(parseInt(req.query.limit) || 20, 50);
  const offset = parseInt(req.query.offset) || 0;

  try {
    const result = await pool.query(
      `SELECT br.*,
              pa.username as attacker_name,
              pd.username as defender_name,
              c.name as circle_name, c.coord_q, c.coord_r
       FROM battle_reports br
       LEFT JOIN players pa ON br.attacker_id = pa.id
       LEFT JOIN players pd ON br.defender_id = pd.id
       LEFT JOIN circles c ON br.circle_id = c.id
       WHERE br.attacker_id = $1 OR br.defender_id = $1
       ORDER BY br.created_at DESC
       LIMIT $2 OFFSET $3`,
      [req.user.id, limit, offset]
    );

    const reports = result.rows.map((r) => ({
      id: r.id,
      type: 'battle',
      isAttacker: r.attacker_id === req.user.id,
      attackerName: r.attacker_name,
      defenderName: r.defender_name,
      circleName: r.circle_name,
      coords: r.coord_q !== null ? { q: r.coord_q, r: r.coord_r } : null,
      outcome: r.outcome,
      createdAt: r.created_at,
    }));

    res.json({ reports });
  } catch (err) {
    console.error('Battle reports error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ── GET /api/reports/espionage ──
router.get('/espionage', authenticateToken, async (req, res) => {
  const limit = Math.min(parseInt(req.query.limit) || 20, 50);
  const offset = parseInt(req.query.offset) || 0;

  try {
    const result = await pool.query(
      `SELECT sr.*,
              c.name as target_name, c.coord_q, c.coord_r,
              p.username as target_player
       FROM spy_reports sr
       JOIN circles c ON sr.target_circle_id = c.id
       JOIN players p ON c.player_id = p.id
       WHERE sr.spy_player_id = $1
       ORDER BY sr.created_at DESC
       LIMIT $2 OFFSET $3`,
      [req.user.id, limit, offset]
    );

    const reports = result.rows.map((r) => ({
      id: r.id,
      type: 'espionage',
      targetName: r.target_name,
      targetPlayer: r.target_player,
      coords: { q: r.coord_q, r: r.coord_r },
      level: r.level,
      data: r.data,
      createdAt: r.created_at,
    }));

    res.json({ reports });
  } catch (err) {
    console.error('Spy reports error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ── GET /api/reports/summary ──
router.get('/summary', authenticateToken, async (req, res) => {
  try {
    const battles = await pool.query(
      `SELECT COUNT(*) as total,
              COUNT(*) FILTER (WHERE attacker_id = $1 AND (outcome->>'attackerWins')::boolean = true) as wins,
              COUNT(*) FILTER (WHERE attacker_id = $1 AND (outcome->>'attackerWins')::boolean = false) as losses
       FROM battle_reports
       WHERE attacker_id = $1 OR defender_id = $1`,
      [req.user.id]
    );

    const spies = await pool.query(
      'SELECT COUNT(*) as total FROM spy_reports WHERE spy_player_id = $1',
      [req.user.id]
    );

    res.json({
      battles: {
        total: parseInt(battles.rows[0].total),
        wins: parseInt(battles.rows[0].wins),
        losses: parseInt(battles.rows[0].losses),
      },
      espionage: {
        total: parseInt(spies.rows[0].total),
      },
    });
  } catch (err) {
    console.error('Reports summary error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
