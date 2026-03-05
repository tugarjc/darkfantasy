const { Router } = require('express');
const bcrypt = require('bcrypt');
const { pool } = require('../db');
const { redis } = require('../redis');
const { authenticateToken } = require('../middleware/auth');

const router = Router();

// ── GET /api/player/export — GDPR data export ──
router.get('/export', authenticateToken, async (req, res) => {
  try {
    const playerId = req.user.id;

    const player = await pool.query(
      'SELECT id, username, email, faction, score, victory_points, relics, is_premium, created_at, last_login FROM players WHERE id = $1',
      [playerId]
    );
    if (player.rows.length === 0) return res.status(404).json({ error: 'Player not found' });

    const circles = await pool.query('SELECT id, name, coord_q, coord_r, is_primary, created_at FROM circles WHERE player_id = $1', [playerId]);
    const circleIds = circles.rows.map((c) => c.id);

    let resources = [];
    let buildings = [];
    let units = [];
    if (circleIds.length > 0) {
      resources = (await pool.query('SELECT * FROM resources WHERE circle_id = ANY($1)', [circleIds])).rows;
      buildings = (await pool.query('SELECT type, level, upgrade_end FROM buildings WHERE circle_id = ANY($1)', [circleIds])).rows;
      units = (await pool.query('SELECT type, count FROM units WHERE circle_id = ANY($1)', [circleIds])).rows;
    }

    const heroes = (await pool.query('SELECT name, type, level, xp, equipped, created_at FROM heroes WHERE player_id = $1', [playerId])).rows;
    const researches = (await pool.query('SELECT tech_id, level, upgrade_end FROM researches WHERE player_id = $1', [playerId])).rows;
    const legions = (await pool.query('SELECT id, status, mission_type, created_at FROM legions WHERE player_id = $1', [playerId])).rows;

    const battleReports = (await pool.query(
      'SELECT id, type, result, created_at FROM battle_reports WHERE attacker_id = $1 OR defender_id = $1 ORDER BY created_at DESC LIMIT 100',
      [playerId]
    )).rows;

    const marketOffers = (await pool.query(
      'SELECT resource_type, amount, price, created_at FROM market_offers WHERE seller_id = $1 ORDER BY created_at DESC LIMIT 100',
      [playerId]
    )).rows;

    const chatMessages = (await pool.query(
      'SELECT channel, content, created_at FROM chat_messages WHERE sender_id = $1 ORDER BY created_at DESC LIMIT 200',
      [playerId]
    )).rows;

    const dailyMissions = (await pool.query(
      'SELECT mission_id, progress, completed, claimed, assigned_at FROM daily_missions WHERE player_id = $1',
      [playerId]
    )).rows;

    const notifications = (await pool.query(
      'SELECT type, message, read, created_at FROM notifications WHERE player_id = $1 ORDER BY created_at DESC LIMIT 100',
      [playerId]
    )).rows;

    const relicTransactions = (await pool.query(
      'SELECT amount, type, source, created_at FROM relic_transactions WHERE player_id = $1 ORDER BY created_at DESC',
      [playerId]
    )).rows;

    const cosmetics = (await pool.query(
      'SELECT cosmetic_id, equipped, acquired_at FROM player_cosmetics WHERE player_id = $1',
      [playerId]
    )).rows;

    const exportData = {
      exportDate: new Date().toISOString(),
      player: player.rows[0],
      circles: circles.rows,
      resources,
      buildings,
      units,
      heroes,
      researches,
      legions,
      battleReports,
      marketOffers,
      chatMessages,
      dailyMissions,
      notifications,
      relicTransactions,
      cosmetics,
    };

    res.setHeader('Content-Disposition', 'attachment; filename="inferno-domini-data-export.json"');
    res.json(exportData);
  } catch (err) {
    console.error('Data export error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ── DELETE /api/player/account — GDPR account deletion ──
router.delete('/account', authenticateToken, async (req, res) => {
  const { password } = req.body;
  if (!password) return res.status(400).json({ error: 'Password required' });

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const playerRow = await client.query(
      'SELECT id, password_hash FROM players WHERE id = $1 FOR UPDATE',
      [req.user.id]
    );
    if (playerRow.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Player not found' });
    }

    const valid = await bcrypt.compare(password, playerRow.rows[0].password_hash);
    if (!valid) {
      await client.query('ROLLBACK');
      return res.status(401).json({ error: 'Invalid password' });
    }

    // Check if alliance leader
    const leaderCheck = await client.query(
      "SELECT a.id FROM alliances a JOIN alliance_members am ON a.id = am.alliance_id WHERE am.player_id = $1 AND am.role = 'leader'",
      [req.user.id]
    );
    if (leaderCheck.rows.length > 0) {
      await client.query('ROLLBACK');
      return res.status(409).json({ error: 'Transfer alliance leadership before deleting account' });
    }

    // Clean up non-cascaded data
    await client.query('DELETE FROM legions WHERE player_id = $1', [req.user.id]);
    await client.query('UPDATE battle_reports SET attacker_id = NULL WHERE attacker_id = $1', [req.user.id]);
    await client.query('UPDATE battle_reports SET defender_id = NULL WHERE defender_id = $1', [req.user.id]);

    // Delete player (cascades to circles, resources, buildings, units, etc.)
    await client.query('DELETE FROM players WHERE id = $1', [req.user.id]);

    await client.query('COMMIT');

    // Revoke refresh token
    try { await redis.del(`refresh:${req.user.id}`); } catch { /* ignore */ }

    res.json({ message: 'Account deleted' });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Account deletion error:', err);
    res.status(500).json({ error: 'Internal server error' });
  } finally {
    client.release();
  }
});

// ── GET /api/player/profile — Basic profile info ──
router.get('/profile', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT id, username, email, faction, score, relics, is_premium, created_at, last_login FROM players WHERE id = $1',
      [req.user.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Player not found' });
    res.json({ player: result.rows[0] });
  } catch (err) {
    console.error('Profile error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ── GET /api/player/:id/public — Public profile ──
router.get('/:id/public', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;

    const result = await pool.query(
      `SELECT p.id, p.username, p.faction, p.score, p.victory_points, p.relics, p.created_at,
              a.name as alliance_name, a.tag as alliance_tag
       FROM players p
       LEFT JOIN alliances a ON p.alliance_id = a.id
       WHERE p.id = $1`,
      [id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Player not found' });

    const player = result.rows[0];

    // Prestige level
    const prestige = await pool.query('SELECT level FROM prestige WHERE player_id = $1', [id]);
    const prestigeLevel = prestige.rows[0]?.level || 0;

    // Achievements count
    const achievements = await pool.query(
      'SELECT COUNT(*) as count FROM player_achievements WHERE player_id = $1 AND unlocked = true', [id]
    );
    const achievementsCount = parseInt(achievements.rows[0]?.count || 0);

    // Circles count
    const circles = await pool.query('SELECT COUNT(*) as count FROM circles WHERE player_id = $1', [id]);
    const circlesCount = parseInt(circles.rows[0]?.count || 0);

    res.json({
      id: player.id,
      username: player.username,
      faction: player.faction,
      score: player.score,
      victory_points: player.victory_points,
      relics: player.relics,
      created_at: player.created_at,
      alliance: player.alliance_name ? { name: player.alliance_name, tag: player.alliance_tag } : null,
      prestigeLevel,
      achievementsCount,
      circlesCount,
    });
  } catch (err) {
    console.error('Public profile error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
