const { Router } = require('express');
const { pool } = require('../db');
const { authenticateToken } = require('../middleware/auth');

const router = Router();

// ── GET /api/circles/:id ──
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    // Update resources lazily
    await pool.query('SELECT update_resources($1)', [req.params.id]);

    // Fetch circle
    const circle = await pool.query(
      'SELECT * FROM circles WHERE id = $1 AND player_id = $2',
      [req.params.id, req.user.id]
    );
    if (circle.rows.length === 0) {
      return res.status(404).json({ error: 'Circle not found' });
    }

    // Fetch resources, buildings, units in parallel
    const [resources, buildings, units] = await Promise.all([
      pool.query('SELECT * FROM resources WHERE circle_id = $1', [req.params.id]),
      pool.query('SELECT type, level, upgrade_end FROM buildings WHERE circle_id = $1 ORDER BY type', [req.params.id]),
      pool.query('SELECT type, quantity FROM units WHERE circle_id = $1 AND quantity > 0', [req.params.id]),
    ]);

    res.json({
      circle: circle.rows[0],
      resources: resources.rows[0] || null,
      buildings: buildings.rows,
      units: units.rows,
    });
  } catch (err) {
    console.error('Circle fetch error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ── GET /api/circles (all player circles) ──
router.get('/', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT id, name, coord_q, coord_r, is_primary FROM circles WHERE player_id = $1 ORDER BY is_primary DESC',
      [req.user.id]
    );
    res.json({ circles: result.rows });
  } catch (err) {
    console.error('Circles list error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
