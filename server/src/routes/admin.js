const { Router } = require('express');
const { pool } = require('../db');
const { authenticateToken } = require('../middleware/auth');

const router = Router();

// ── Admin middleware ──
async function requireAdmin(req, res, next) {
  try {
    const result = await pool.query('SELECT is_admin FROM players WHERE id = $1', [req.user.id]);
    if (!result.rows[0]?.is_admin) {
      return res.status(403).json({ error: 'Acces refuse' });
    }
    next();
  } catch {
    res.status(500).json({ error: 'Internal server error' });
  }
}

// Helper: log admin action
async function auditLog(adminId, action, target, details = {}) {
  await pool.query(
    'INSERT INTO audit_logs (admin_id, action, target, details) VALUES ($1, $2, $3, $4)',
    [adminId, action, target, JSON.stringify(details)]
  );
}

// ── GET /api/admin/stats ── Server-wide stats
router.get('/stats', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const [players, circles, alliances, legions, offers, messages] = await Promise.all([
      pool.query('SELECT COUNT(*) as c FROM players'),
      pool.query('SELECT COUNT(*) as c FROM circles'),
      pool.query('SELECT COUNT(*) as c FROM alliances'),
      pool.query("SELECT COUNT(*) as c FROM legions WHERE status != 'arrivee'"),
      pool.query('SELECT COUNT(*) as c FROM market_offers WHERE is_accepted = false AND expires_at > NOW()'),
      pool.query('SELECT COUNT(*) as c FROM chat_messages'),
    ]);

    const online = await pool.query(
      "SELECT COUNT(*) as c FROM players WHERE last_login > NOW() - INTERVAL '15 minutes'"
    );

    const banned = await pool.query('SELECT COUNT(*) as c FROM players WHERE is_banned = true');

    const topPlayers = await pool.query(
      'SELECT id, username, faction, score, is_banned, is_admin, created_at FROM players ORDER BY score DESC LIMIT 10'
    );

    res.json({
      totalPlayers: parseInt(players.rows[0].c),
      totalCircles: parseInt(circles.rows[0].c),
      totalAlliances: parseInt(alliances.rows[0].c),
      activeLegions: parseInt(legions.rows[0].c),
      activeOffers: parseInt(offers.rows[0].c),
      totalMessages: parseInt(messages.rows[0].c),
      onlinePlayers: parseInt(online.rows[0].c),
      bannedPlayers: parseInt(banned.rows[0].c),
      topPlayers: topPlayers.rows,
    });
  } catch (err) {
    console.error('Admin stats error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ── GET /api/admin/players ── List players with search & pagination
router.get('/players', authenticateToken, requireAdmin, async (req, res) => {
  const { q, page = 1, limit = 20 } = req.query;
  const offset = (Math.max(1, parseInt(page)) - 1) * parseInt(limit);

  try {
    const params = [];
    let where = '';

    if (q && q.length >= 2) {
      where = ' WHERE p.username ILIKE $1 OR p.email ILIKE $1';
      params.push(`%${q}%`);
    }

    // Count
    const countRes = await pool.query(
      `SELECT COUNT(*) as c FROM players p LEFT JOIN alliances a ON p.alliance_id = a.id${where}`,
      params
    );
    const total = parseInt(countRes.rows[0].c);

    const query = `SELECT p.id, p.username, p.email, p.faction, p.score, p.is_banned, p.is_admin, p.is_premium,
                          p.last_login, p.created_at, a.name as alliance_name, a.tag as alliance_tag
                   FROM players p
                   LEFT JOIN alliances a ON p.alliance_id = a.id${where}
                   ORDER BY p.score DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    params.push(parseInt(limit), offset);

    const result = await pool.query(query, params);

    res.json({
      players: result.rows,
      total,
      page: parseInt(page),
      totalPages: Math.ceil(total / parseInt(limit)),
    });
  } catch (err) {
    console.error('Admin players error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ── GET /api/admin/players/:id ── Player detail
router.get('/players/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const player = await pool.query(
      `SELECT p.*, a.name as alliance_name, a.tag as alliance_tag
       FROM players p LEFT JOIN alliances a ON p.alliance_id = a.id
       WHERE p.id = $1`,
      [req.params.id]
    );
    if (player.rows.length === 0) {
      return res.status(404).json({ error: 'Joueur non trouve' });
    }

    const circles = await pool.query(
      `SELECT c.id, c.name, c.coord_q, c.coord_r, c.is_primary,
              r.iron, r.essence, r.souls, r.iron_rate, r.essence_rate, r.souls_rate
       FROM circles c
       LEFT JOIN resources r ON r.circle_id = c.id
       WHERE c.player_id = $1`,
      [req.params.id]
    );

    const heroes = await pool.query(
      'SELECT type, level, xp, is_deployed, is_dead FROM heroes WHERE player_id = $1',
      [req.params.id]
    );

    const researches = await pool.query(
      'SELECT type, level FROM researches WHERE player_id = $1 AND level > 0',
      [req.params.id]
    );

    const p = player.rows[0];
    delete p.password_hash; // Never expose

    res.json({
      player: p,
      circles: circles.rows,
      heroes: heroes.rows,
      researches: researches.rows,
    });
  } catch (err) {
    console.error('Admin player detail error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ── POST /api/admin/players/:id/ban ── Ban/unban player
router.post('/players/:id/ban', authenticateToken, requireAdmin, async (req, res) => {
  const { banned } = req.body;
  if (typeof banned !== 'boolean') {
    return res.status(400).json({ error: 'banned (boolean) requis' });
  }

  try {
    // Can't ban yourself
    if (req.params.id === req.user.id) {
      return res.status(400).json({ error: 'Impossible de se bannir soi-meme' });
    }

    // Can't ban other admins
    const target = await pool.query('SELECT is_admin, username FROM players WHERE id = $1', [req.params.id]);
    if (target.rows.length === 0) return res.status(404).json({ error: 'Joueur non trouve' });
    if (target.rows[0].is_admin) return res.status(403).json({ error: 'Impossible de bannir un admin' });

    await pool.query('UPDATE players SET is_banned = $2 WHERE id = $1', [req.params.id, banned]);
    await auditLog(req.user.id, banned ? 'ban' : 'unban', target.rows[0].username);

    res.json({ message: banned ? 'Joueur banni' : 'Joueur debanni' });
  } catch (err) {
    console.error('Admin ban error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ── POST /api/admin/players/:id/resources ── Set player resources
router.post('/players/:id/resources', authenticateToken, requireAdmin, async (req, res) => {
  const { iron, essence, souls } = req.body;

  try {
    const circle = await pool.query(
      'SELECT id FROM circles WHERE player_id = $1 AND is_primary = true',
      [req.params.id]
    );
    if (circle.rows.length === 0) return res.status(404).json({ error: 'Cercle non trouve' });

    const updates = [];
    const params = [circle.rows[0].id];
    let idx = 2;

    if (iron != null) { updates.push(`iron = $${idx++}`); params.push(iron); }
    if (essence != null) { updates.push(`essence = $${idx++}`); params.push(essence); }
    if (souls != null) { updates.push(`souls = $${idx++}`); params.push(souls); }

    if (updates.length === 0) return res.status(400).json({ error: 'Aucune ressource specifiee' });

    await pool.query(`UPDATE resources SET ${updates.join(', ')} WHERE circle_id = $1`, params);

    const target = await pool.query('SELECT username FROM players WHERE id = $1', [req.params.id]);
    await auditLog(req.user.id, 'set_resources', target.rows[0]?.username, { iron, essence, souls });

    res.json({ message: 'Ressources modifiees' });
  } catch (err) {
    console.error('Admin resources error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ── POST /api/admin/announce ── Send system announcement via chat
router.post('/announce', authenticateToken, requireAdmin, async (req, res) => {
  const { message } = req.body;
  if (!message || message.length < 1 || message.length > 500) {
    return res.status(400).json({ error: 'Message entre 1 et 500 caracteres' });
  }

  try {
    await pool.query(
      "INSERT INTO chat_messages (channel, sender_id, content) VALUES ('global', $1, $2)",
      [req.user.id, `[SYSTEME] ${message}`]
    );
    await auditLog(req.user.id, 'announce', null, { message });
    res.json({ message: 'Annonce envoyee' });
  } catch (err) {
    console.error('Admin announce error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ── GET /api/admin/audit ── Audit log
router.get('/audit', authenticateToken, requireAdmin, async (req, res) => {
  const { page = 1, limit = 30 } = req.query;
  const offset = (Math.max(1, parseInt(page)) - 1) * parseInt(limit);

  try {
    const result = await pool.query(
      `SELECT al.*, p.username as admin_name
       FROM audit_logs al
       JOIN players p ON al.admin_id = p.id
       ORDER BY al.created_at DESC
       LIMIT $1 OFFSET $2`,
      [parseInt(limit), offset]
    );

    const count = await pool.query('SELECT COUNT(*) as c FROM audit_logs');

    res.json({
      logs: result.rows,
      total: parseInt(count.rows[0].c),
      page: parseInt(page),
    });
  } catch (err) {
    console.error('Admin audit error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
