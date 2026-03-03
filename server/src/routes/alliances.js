const { Router } = require('express');
const { pool } = require('../db');
const { authenticateToken } = require('../middleware/auth');

const router = Router();
const SERVER_ID = '00000000-0000-0000-0000-000000000001';

// ── GET /api/alliances/mine ──
router.get('/mine', authenticateToken, async (req, res) => {
  try {
    const player = await pool.query('SELECT alliance_id FROM players WHERE id = $1', [req.user.id]);
    const allianceId = player.rows[0]?.alliance_id;

    if (!allianceId) {
      return res.json({ alliance: null });
    }

    const alliance = await pool.query(
      `SELECT a.*, p.username as leader_name FROM alliances a
       JOIN players p ON a.leader_id = p.id
       WHERE a.id = $1`,
      [allianceId]
    );

    const members = await pool.query(
      `SELECT am.role, am.joined_at, p.id, p.username, p.score, p.faction
       FROM alliance_members am
       JOIN players p ON am.player_id = p.id
       WHERE am.alliance_id = $1
       ORDER BY CASE am.role WHEN 'leader' THEN 0 WHEN 'officer' THEN 1 ELSE 2 END, p.score DESC`,
      [allianceId]
    );

    const diplomacyRes = await pool.query(
      `SELECT d.*,
              a1.name as alliance_a_name, a1.tag as alliance_a_tag,
              a2.name as alliance_b_name, a2.tag as alliance_b_tag
       FROM diplomacy d
       JOIN alliances a1 ON d.alliance_a = a1.id
       JOIN alliances a2 ON d.alliance_b = a2.id
       WHERE d.alliance_a = $1 OR d.alliance_b = $1`,
      [allianceId]
    );

    const myRole = members.rows.find((m) => m.id === req.user.id)?.role || 'member';

    res.json({
      alliance: {
        ...alliance.rows[0],
        myRole,
        members: members.rows.map((m) => ({
          id: m.id,
          username: m.username,
          role: m.role,
          score: m.score,
          faction: m.faction,
          joinedAt: m.joined_at,
        })),
        diplomacy: diplomacyRes.rows.map((d) => ({
          id: d.id,
          otherAlliance: d.alliance_a === allianceId
            ? { id: d.alliance_b, name: d.alliance_b_name, tag: d.alliance_b_tag }
            : { id: d.alliance_a, name: d.alliance_a_name, tag: d.alliance_a_tag },
          status: d.status,
          startedAt: d.started_at,
        })),
      },
    });
  } catch (err) {
    console.error('Alliance mine error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ── POST /api/alliances/create ──
router.post('/create', authenticateToken, async (req, res) => {
  const { name, tag } = req.body;

  if (!name || name.length < 3 || name.length > 64) {
    return res.status(400).json({ error: 'Name must be 3-64 characters' });
  }
  if (!tag || tag.length < 2 || tag.length > 8) {
    return res.status(400).json({ error: 'Tag must be 2-8 characters' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Check player not already in an alliance
    const player = await client.query('SELECT alliance_id FROM players WHERE id = $1 FOR UPDATE', [req.user.id]);
    if (player.rows[0]?.alliance_id) {
      await client.query('ROLLBACK');
      return res.status(409).json({ error: 'Already in an alliance' });
    }

    // Create alliance
    const alliance = await client.query(
      'INSERT INTO alliances (server_id, name, tag, leader_id) VALUES ($1, $2, $3, $4) RETURNING id',
      [SERVER_ID, name, tag.toUpperCase(), req.user.id]
    );
    const allianceId = alliance.rows[0].id;

    // Add creator as leader
    await client.query(
      "INSERT INTO alliance_members (alliance_id, player_id, role) VALUES ($1, $2, 'leader')",
      [allianceId, req.user.id]
    );

    // Update player
    await client.query('UPDATE players SET alliance_id = $2 WHERE id = $1', [req.user.id, allianceId]);

    await client.query('COMMIT');

    res.status(201).json({ allianceId, name, tag: tag.toUpperCase() });
  } catch (err) {
    await client.query('ROLLBACK');
    if (err.code === '23505') {
      return res.status(409).json({ error: 'Alliance name or tag already taken' });
    }
    console.error('Alliance create error:', err);
    res.status(500).json({ error: 'Internal server error' });
  } finally {
    client.release();
  }
});

// ── GET /api/alliances/search?q=term ──
router.get('/search', authenticateToken, async (req, res) => {
  const q = req.query.q || '';
  if (q.length < 2) {
    return res.status(400).json({ error: 'Search term must be at least 2 characters' });
  }

  try {
    const result = await pool.query(
      `SELECT a.id, a.name, a.tag, a.created_at, p.username as leader_name,
              (SELECT COUNT(*) FROM alliance_members am WHERE am.alliance_id = a.id) as member_count,
              (SELECT COALESCE(SUM(pl.score::int), 0) FROM alliance_members am2 JOIN players pl ON am2.player_id = pl.id WHERE am2.alliance_id = a.id) as total_score
       FROM alliances a
       JOIN players p ON a.leader_id = p.id
       WHERE a.server_id = $1 AND (a.name ILIKE $2 OR a.tag ILIKE $2)
       ORDER BY total_score DESC
       LIMIT 20`,
      [SERVER_ID, `%${q}%`]
    );

    res.json({ alliances: result.rows });
  } catch (err) {
    console.error('Alliance search error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ── POST /api/alliances/:id/join ──
router.post('/:id/join', authenticateToken, async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const player = await client.query('SELECT alliance_id FROM players WHERE id = $1 FOR UPDATE', [req.user.id]);
    if (player.rows[0]?.alliance_id) {
      await client.query('ROLLBACK');
      return res.status(409).json({ error: 'Already in an alliance' });
    }

    // Check alliance exists
    const alliance = await client.query('SELECT id, name FROM alliances WHERE id = $1', [req.params.id]);
    if (alliance.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Alliance not found' });
    }

    // Check member count (max 30)
    const count = await client.query(
      'SELECT COUNT(*) as c FROM alliance_members WHERE alliance_id = $1',
      [req.params.id]
    );
    if (parseInt(count.rows[0].c) >= 30) {
      await client.query('ROLLBACK');
      return res.status(409).json({ error: 'Alliance is full (max 30 members)' });
    }

    // Add member
    await client.query(
      "INSERT INTO alliance_members (alliance_id, player_id, role) VALUES ($1, $2, 'member')",
      [req.params.id, req.user.id]
    );
    await client.query('UPDATE players SET alliance_id = $2 WHERE id = $1', [req.user.id, req.params.id]);

    await client.query('COMMIT');
    res.json({ message: `Joined ${alliance.rows[0].name}` });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Alliance join error:', err);
    res.status(500).json({ error: 'Internal server error' });
  } finally {
    client.release();
  }
});

// ── POST /api/alliances/leave ──
router.post('/leave', authenticateToken, async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const player = await client.query('SELECT alliance_id FROM players WHERE id = $1', [req.user.id]);
    const allianceId = player.rows[0]?.alliance_id;
    if (!allianceId) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Not in an alliance' });
    }

    // Check if leader
    const alliance = await client.query('SELECT leader_id FROM alliances WHERE id = $1', [allianceId]);
    if (alliance.rows[0]?.leader_id === req.user.id) {
      // Count other members
      const memberCount = await client.query(
        'SELECT COUNT(*) as c FROM alliance_members WHERE alliance_id = $1 AND player_id != $2',
        [allianceId, req.user.id]
      );
      if (parseInt(memberCount.rows[0].c) > 0) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: 'Transfer leadership before leaving (use /api/alliances/promote)' });
      }
      // Last member — dissolve alliance
      await client.query('DELETE FROM alliance_members WHERE alliance_id = $1', [allianceId]);
      await client.query('UPDATE players SET alliance_id = NULL WHERE id = $1', [req.user.id]);
      await client.query('DELETE FROM diplomacy WHERE alliance_a = $1 OR alliance_b = $1', [allianceId]);
      await client.query('DELETE FROM alliances WHERE id = $1', [allianceId]);
      await client.query('COMMIT');
      return res.json({ message: 'Alliance dissolved' });
    }

    // Regular member leaves
    await client.query('DELETE FROM alliance_members WHERE alliance_id = $1 AND player_id = $2', [allianceId, req.user.id]);
    await client.query('UPDATE players SET alliance_id = NULL WHERE id = $1', [req.user.id]);

    await client.query('COMMIT');
    res.json({ message: 'Left alliance' });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Alliance leave error:', err);
    res.status(500).json({ error: 'Internal server error' });
  } finally {
    client.release();
  }
});

// ── POST /api/alliances/promote ──
router.post('/promote', authenticateToken, async (req, res) => {
  const { playerId, role } = req.body;
  if (!playerId || !['officer', 'member', 'leader'].includes(role)) {
    return res.status(400).json({ error: 'playerId and role (officer/member/leader) required' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const player = await client.query('SELECT alliance_id FROM players WHERE id = $1', [req.user.id]);
    const allianceId = player.rows[0]?.alliance_id;
    if (!allianceId) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Not in an alliance' });
    }

    // Check requester is leader or officer
    const myMembership = await client.query(
      'SELECT role FROM alliance_members WHERE alliance_id = $1 AND player_id = $2',
      [allianceId, req.user.id]
    );
    const myRole = myMembership.rows[0]?.role;
    if (myRole !== 'leader' && (role === 'leader' || role === 'officer')) {
      await client.query('ROLLBACK');
      return res.status(403).json({ error: 'Only the leader can promote' });
    }

    // Check target is in same alliance
    const targetMembership = await client.query(
      'SELECT role FROM alliance_members WHERE alliance_id = $1 AND player_id = $2',
      [allianceId, playerId]
    );
    if (targetMembership.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Player not in your alliance' });
    }

    if (role === 'leader') {
      // Transfer leadership
      await client.query(
        "UPDATE alliance_members SET role = 'officer' WHERE alliance_id = $1 AND player_id = $2",
        [allianceId, req.user.id]
      );
      await client.query('UPDATE alliances SET leader_id = $2 WHERE id = $1', [allianceId, playerId]);
    }

    await client.query(
      'UPDATE alliance_members SET role = $3 WHERE alliance_id = $1 AND player_id = $2',
      [allianceId, playerId, role]
    );

    await client.query('COMMIT');
    res.json({ message: `${playerId} promoted to ${role}` });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Alliance promote error:', err);
    res.status(500).json({ error: 'Internal server error' });
  } finally {
    client.release();
  }
});

// ── POST /api/alliances/kick ──
router.post('/kick', authenticateToken, async (req, res) => {
  const { playerId } = req.body;
  if (!playerId) return res.status(400).json({ error: 'playerId required' });

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const player = await client.query('SELECT alliance_id FROM players WHERE id = $1', [req.user.id]);
    const allianceId = player.rows[0]?.alliance_id;
    if (!allianceId) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Not in an alliance' });
    }

    // Check requester is leader or officer
    const myRole = await client.query(
      'SELECT role FROM alliance_members WHERE alliance_id = $1 AND player_id = $2',
      [allianceId, req.user.id]
    );
    if (!['leader', 'officer'].includes(myRole.rows[0]?.role)) {
      await client.query('ROLLBACK');
      return res.status(403).json({ error: 'Insufficient permissions' });
    }

    // Can't kick yourself or the leader
    if (playerId === req.user.id) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Cannot kick yourself' });
    }
    const targetRole = await client.query(
      'SELECT role FROM alliance_members WHERE alliance_id = $1 AND player_id = $2',
      [allianceId, playerId]
    );
    if (targetRole.rows[0]?.role === 'leader') {
      await client.query('ROLLBACK');
      return res.status(403).json({ error: 'Cannot kick the leader' });
    }

    await client.query('DELETE FROM alliance_members WHERE alliance_id = $1 AND player_id = $2', [allianceId, playerId]);
    await client.query('UPDATE players SET alliance_id = NULL WHERE id = $1', [playerId]);

    await client.query('COMMIT');
    res.json({ message: 'Player kicked' });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Alliance kick error:', err);
    res.status(500).json({ error: 'Internal server error' });
  } finally {
    client.release();
  }
});

// ── POST /api/alliances/diplomacy ──
router.post('/diplomacy', authenticateToken, async (req, res) => {
  const { targetAllianceId, status } = req.body;
  const validStatuses = ['neutralite', 'guerre', 'paix', 'alliance_militaire'];
  if (!targetAllianceId || !validStatuses.includes(status)) {
    return res.status(400).json({ error: 'targetAllianceId and valid status required' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const player = await client.query('SELECT alliance_id FROM players WHERE id = $1', [req.user.id]);
    const allianceId = player.rows[0]?.alliance_id;
    if (!allianceId) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Not in an alliance' });
    }

    // Only leader can set diplomacy
    const myRole = await client.query(
      'SELECT role FROM alliance_members WHERE alliance_id = $1 AND player_id = $2',
      [allianceId, req.user.id]
    );
    if (myRole.rows[0]?.role !== 'leader') {
      await client.query('ROLLBACK');
      return res.status(403).json({ error: 'Only the leader can manage diplomacy' });
    }

    if (allianceId === targetAllianceId) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Cannot set diplomacy with yourself' });
    }

    // Ensure consistent ordering (alliance_a < alliance_b)
    const [aId, bId] = allianceId < targetAllianceId
      ? [allianceId, targetAllianceId]
      : [targetAllianceId, allianceId];

    await client.query(
      `INSERT INTO diplomacy (alliance_a, alliance_b, status)
       VALUES ($1, $2, $3)
       ON CONFLICT (alliance_a, alliance_b) DO UPDATE SET status = $3, started_at = NOW()`,
      [aId, bId, status]
    );

    await client.query('COMMIT');
    res.json({ message: `Diplomacy set to ${status}` });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Alliance diplomacy error:', err);
    res.status(500).json({ error: 'Internal server error' });
  } finally {
    client.release();
  }
});

module.exports = router;
