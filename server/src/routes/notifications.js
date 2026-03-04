const { Router } = require('express');
const { pool } = require('../db');
const { authenticateToken } = require('../middleware/auth');

const router = Router();

// ── GET /api/notifications ──
router.get('/', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT id, type, data, read, created_at
       FROM notifications
       WHERE player_id = $1
       ORDER BY created_at DESC
       LIMIT 50`,
      [req.user.id]
    );

    const unreadRes = await pool.query(
      'SELECT COUNT(*) as c FROM notifications WHERE player_id = $1 AND read = false',
      [req.user.id]
    );

    res.json({
      notifications: result.rows,
      unreadCount: parseInt(unreadRes.rows[0].c),
    });
  } catch (err) {
    console.error('Notifications list error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ── POST /api/notifications/read ──
router.post('/read', authenticateToken, async (req, res) => {
  const { ids } = req.body;
  if (!Array.isArray(ids) || ids.length === 0) {
    return res.status(400).json({ error: 'ids array required' });
  }

  try {
    await pool.query(
      'UPDATE notifications SET read = true WHERE player_id = $1 AND id = ANY($2)',
      [req.user.id, ids]
    );
    res.json({ message: 'Marked as read' });
  } catch (err) {
    console.error('Notifications read error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ── POST /api/notifications/read-all ──
router.post('/read-all', authenticateToken, async (req, res) => {
  try {
    await pool.query(
      'UPDATE notifications SET read = true WHERE player_id = $1 AND read = false',
      [req.user.id]
    );
    res.json({ message: 'All marked as read' });
  } catch (err) {
    console.error('Notifications read-all error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
