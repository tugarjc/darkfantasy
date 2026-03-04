const { Router } = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { pool } = require('../db');
const { redis } = require('../redis');
const { recalcRates } = require('../game/resources');

const router = Router();

const JWT_SECRET = process.env.JWT_SECRET || 'dev_secret_change_me';
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'dev_refresh_secret_change_me';
const ACCESS_EXPIRY = '15m';
const REFRESH_EXPIRY_SECONDS = 30 * 24 * 3600; // 30 days

function generateTokens(player) {
  const payload = { id: player.id, username: player.username };
  const accessToken = jwt.sign(payload, JWT_SECRET, { expiresIn: ACCESS_EXPIRY });
  const refreshToken = jwt.sign(payload, JWT_REFRESH_SECRET, { expiresIn: REFRESH_EXPIRY_SECONDS });
  return { accessToken, refreshToken };
}

// ── POST /api/auth/register ──
router.post('/register', async (req, res) => {
  const { username, email, password, faction } = req.body;

  if (!username || !email || !password) {
    return res.status(400).json({ error: 'username, email and password required' });
  }
  if (username.length < 3 || username.length > 32) {
    return res.status(400).json({ error: 'Username must be 3-32 characters' });
  }
  if (password.length < 8) {
    return res.status(400).json({ error: 'Password must be at least 8 characters' });
  }

  try {
    // Check for existing user
    const existing = await pool.query(
      'SELECT id FROM players WHERE (username = $1 OR email = $2) AND server_id = $3',
      [username, email, '00000000-0000-0000-0000-000000000001']
    );
    if (existing.rows.length > 0) {
      return res.status(409).json({ error: 'Username or email already taken' });
    }

    const passwordHash = await bcrypt.hash(password, 12);

    // Validate faction
    const validFactions = ['none', 'legion_cendres', 'ordre_vide', 'pacte_chaines', 'culte_sang'];
    const playerFaction = validFactions.includes(faction) ? faction : 'none';

    // Create player
    const result = await pool.query(
      `INSERT INTO players (server_id, username, email, password_hash, faction)
       VALUES ($1, $2, $3, $4, $5) RETURNING id, username, email, faction, score, relics, created_at`,
      ['00000000-0000-0000-0000-000000000001', username, email, passwordHash, playerFaction]
    );
    const player = result.rows[0];

    // Create primary circle at random coords
    const q = Math.floor(Math.random() * 200) - 100;
    const r = Math.floor(Math.random() * 200) - 100;
    const circle = await pool.query(
      `INSERT INTO circles (player_id, name, coord_q, coord_r, is_primary)
       VALUES ($1, $2, $3, $4, true) RETURNING id`,
      [player.id, `Cercle de ${username}`, q, r]
    );
    const circleId = circle.rows[0].id;

    // Init resources
    await pool.query(
      `INSERT INTO resources (circle_id) VALUES ($1)`,
      [circleId]
    );

    // Init starting buildings (Forge lv1, Sanctuaire lv1, Biblio lv1, Mur lv0, Entrepot lv1)
    const startBuildings = [
      ['forge_damnes', 1], ['sanctuaire_neant', 1], ['bibliotheque_obscure', 1],
      ['mur_ames', 0], ['entrepot_damnes', 1],
    ];
    for (const [type, level] of startBuildings) {
      await pool.query(
        'INSERT INTO buildings (circle_id, type, level) VALUES ($1, $2, $3)',
        [circleId, type, level]
      );
    }

    // Recalculate production rates based on starting buildings
    await recalcRates(circleId);

    // Init tutorial progress
    const tutorialQuests = [
      { id: 'premiere_flamme', completed: false, claimed: false, progress: 0 },
      { id: 'essence_vie', completed: false, claimed: false, progress: 0 },
      { id: 'premiers_soldats', completed: false, claimed: false, progress: 0 },
      { id: 'connais_ennemi', completed: false, claimed: false, progress: 0 },
      { id: 'murs_sang', completed: false, claimed: false, progress: 0 },
      { id: 'premiere_conquete', completed: false, claimed: false, progress: 0 },
      { id: 'maitre_ombres', completed: false, claimed: false, progress: 0 },
    ];
    await pool.query(
      'INSERT INTO tutorial_progress (player_id, quests) VALUES ($1, $2) ON CONFLICT (player_id) DO NOTHING',
      [player.id, JSON.stringify(tutorialQuests)]
    );

    const tokens = generateTokens(player);

    // Store refresh token in Redis
    await redis.set(`refresh:${player.id}`, tokens.refreshToken, { EX: REFRESH_EXPIRY_SECONDS });

    res.status(201).json({ player, ...tokens });
  } catch (err) {
    console.error('Register error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ── POST /api/auth/login ──
router.post('/login', async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'email and password required' });
  }

  try {
    const result = await pool.query(
      'SELECT id, username, email, password_hash, faction, score, relics, is_banned, is_admin FROM players WHERE email = $1 AND server_id = $2',
      [email, '00000000-0000-0000-0000-000000000001']
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const player = result.rows[0];

    if (player.is_banned) {
      return res.status(403).json({ error: 'Account banned' });
    }

    const valid = await bcrypt.compare(password, player.password_hash);
    if (!valid) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Update last login
    await pool.query('UPDATE players SET last_login = now() WHERE id = $1', [player.id]);

    const tokens = generateTokens(player);
    await redis.set(`refresh:${player.id}`, tokens.refreshToken, { EX: REFRESH_EXPIRY_SECONDS });

    const { password_hash, ...safePlayer } = player;
    res.json({ player: safePlayer, ...tokens });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ── POST /api/auth/refresh ──
router.post('/refresh', async (req, res) => {
  const { refreshToken } = req.body;

  if (!refreshToken) {
    return res.status(400).json({ error: 'refreshToken required' });
  }

  try {
    const payload = jwt.verify(refreshToken, JWT_REFRESH_SECRET);

    // Check token matches stored token
    const stored = await redis.get(`refresh:${payload.id}`);
    if (stored !== refreshToken) {
      return res.status(403).json({ error: 'Token revoked' });
    }

    const result = await pool.query('SELECT id, username FROM players WHERE id = $1', [payload.id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Player not found' });
    }

    const tokens = generateTokens(result.rows[0]);
    await redis.set(`refresh:${payload.id}`, tokens.refreshToken, { EX: REFRESH_EXPIRY_SECONDS });

    res.json(tokens);
  } catch {
    return res.status(403).json({ error: 'Invalid refresh token' });
  }
});

// ── POST /api/auth/logout ──
router.post('/logout', async (req, res) => {
  const header = req.headers.authorization;
  const token = header && header.split(' ')[1];

  if (token) {
    try {
      const payload = jwt.verify(token, JWT_SECRET);
      await redis.del(`refresh:${payload.id}`);
    } catch {
      // Token expired or invalid — still logout
    }
  }

  res.json({ message: 'Logged out' });
});

module.exports = router;
