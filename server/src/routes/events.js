const { Router } = require('express');
const { pool } = require('../db');
const { authenticateToken } = require('../middleware/auth');
const { EVENT_TYPES, calculateEventDamage, calculateEventLosses } = require('../game/events');
const { UNITS } = require('../game/units');
const { spawnEvent } = require('../game/eventProcessor');

const router = Router();

// ── GET /api/events ── List active events
router.get('/', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT e.*,
              COALESCE(SUM(ec.damage), 0) as total_damage,
              COUNT(DISTINCT ec.player_id) as contributors
       FROM events e
       LEFT JOIN event_contributions ec ON ec.event_id = e.id
       WHERE e.end_time > NOW()
       GROUP BY e.id
       ORDER BY e.end_time ASC`
    );

    // Get player's own contributions
    const myContribs = await pool.query(
      `SELECT event_id, SUM(damage) as my_damage
       FROM event_contributions
       WHERE player_id = $1 AND event_id = ANY($2)
       GROUP BY event_id`,
      [req.user.id, result.rows.map(e => e.id)]
    );
    const myMap = {};
    for (const c of myContribs.rows) {
      myMap[c.event_id] = parseInt(c.my_damage);
    }

    const events = result.rows.map(e => ({
      id: e.id,
      type: e.type,
      name: EVENT_TYPES[e.type]?.name || e.type,
      description: EVENT_TYPES[e.type]?.description || '',
      coordQ: e.coord_q,
      coordR: e.coord_r,
      hpMax: e.hp_max,
      hpRemaining: e.hp_remaining,
      startTime: e.start_time,
      endTime: e.end_time,
      totalDamage: parseInt(e.total_damage),
      contributors: parseInt(e.contributors),
      myDamage: myMap[e.id] || 0,
    }));

    res.json({ events });
  } catch (err) {
    console.error('Events list error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ── GET /api/events/:id ── Event detail with leaderboard
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const event = await pool.query('SELECT * FROM events WHERE id = $1', [req.params.id]);
    if (event.rows.length === 0) return res.status(404).json({ error: 'Evenement non trouve' });
    const e = event.rows[0];

    // Leaderboard
    const leaderboard = await pool.query(
      `SELECT ec.player_id, p.username, p.faction, SUM(ec.damage) as total_damage
       FROM event_contributions ec
       JOIN players p ON ec.player_id = p.id
       WHERE ec.event_id = $1
       GROUP BY ec.player_id, p.username, p.faction
       ORDER BY total_damage DESC
       LIMIT 20`,
      [req.params.id]
    );

    res.json({
      event: {
        id: e.id,
        type: e.type,
        name: EVENT_TYPES[e.type]?.name || e.type,
        description: EVENT_TYPES[e.type]?.description || '',
        coordQ: e.coord_q,
        coordR: e.coord_r,
        hpMax: e.hp_max,
        hpRemaining: e.hp_remaining,
        startTime: e.start_time,
        endTime: e.end_time,
      },
      leaderboard: leaderboard.rows.map(l => ({
        playerId: l.player_id,
        username: l.username,
        faction: l.faction,
        damage: parseInt(l.total_damage),
      })),
    });
  } catch (err) {
    console.error('Event detail error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ── POST /api/events/:id/attack ── Send units to attack an event
router.post('/:id/attack', authenticateToken, async (req, res) => {
  const { units } = req.body; // { squelette_soldat: 50, diablotin: 20 }
  if (!units || typeof units !== 'object' || Object.keys(units).length === 0) {
    return res.status(400).json({ error: 'Unites requises' });
  }

  // Validate unit types
  for (const [type, qty] of Object.entries(units)) {
    if (!UNITS[type]) return res.status(400).json({ error: `Type invalide: ${type}` });
    if (!Number.isInteger(qty) || qty <= 0) return res.status(400).json({ error: `Quantite invalide pour ${type}` });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Check event is still active
    const event = await client.query(
      'SELECT * FROM events WHERE id = $1 AND end_time > NOW() AND hp_remaining > 0 FOR UPDATE',
      [req.params.id]
    );
    if (event.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Evenement termine ou inexistant' });
    }
    const ev = event.rows[0];

    // Get player's primary circle
    const circle = await client.query(
      'SELECT id FROM circles WHERE player_id = $1 AND is_primary = true',
      [req.user.id]
    );
    if (circle.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Cercle non trouve' });
    }
    const circleId = circle.rows[0].id;

    // Check player has enough units
    for (const [type, qty] of Object.entries(units)) {
      const available = await client.query(
        'SELECT quantity FROM units WHERE circle_id = $1 AND type = $2',
        [circleId, type]
      );
      const have = available.rows[0]?.quantity || 0;
      if (have < qty) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: `Pas assez de ${UNITS[type].name}: ${have} disponibles, ${qty} demandes` });
      }
    }

    // Get faille mastery level
    const failleMastery = await client.query(
      "SELECT level FROM researches WHERE player_id = $1 AND type = 'maitrise_failles'",
      [req.user.id]
    );
    const masteryLevel = failleMastery.rows[0]?.level || 0;

    // Calculate damage
    const damage = calculateEventDamage(units, masteryLevel);
    const effectiveDamage = Math.min(damage, ev.hp_remaining);

    // Calculate losses
    const difficulty = EVENT_TYPES[ev.type]?.difficulty || 1.0;
    const { losses, survivors } = calculateEventLosses(units, difficulty);

    // Deduct all sent units, then return survivors
    for (const [type, qty] of Object.entries(units)) {
      const lost = losses[type] || 0;
      await client.query(
        'UPDATE units SET quantity = quantity - $3 WHERE circle_id = $1 AND type = $2',
        [circleId, type, lost]
      );
    }

    // Apply damage to event
    await client.query(
      'UPDATE events SET hp_remaining = GREATEST(0, hp_remaining - $2) WHERE id = $1',
      [req.params.id, effectiveDamage]
    );

    // Record contribution
    await client.query(
      `INSERT INTO event_contributions (event_id, player_id, damage, units_lost)
       VALUES ($1, $2, $3, $4)`,
      [req.params.id, req.user.id, effectiveDamage, JSON.stringify(losses)]
    );

    await client.query('COMMIT');

    res.json({
      damage: effectiveDamage,
      losses,
      survivors,
      eventHpRemaining: Math.max(0, ev.hp_remaining - effectiveDamage),
      eventDefeated: ev.hp_remaining - effectiveDamage <= 0,
    });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Event attack error:', err);
    res.status(500).json({ error: 'Internal server error' });
  } finally {
    client.release();
  }
});

// ── POST /api/events/spawn ── Admin: manually spawn an event
router.post('/spawn', authenticateToken, async (req, res) => {
  try {
    // Check admin
    const admin = await pool.query('SELECT is_admin FROM players WHERE id = $1', [req.user.id]);
    if (!admin.rows[0]?.is_admin) return res.status(403).json({ error: 'Acces refuse' });

    const { type } = req.body;
    if (type && !EVENT_TYPES[type]) return res.status(400).json({ error: 'Type invalide' });

    const eventId = await spawnEvent(type || null);
    if (!eventId) return res.status(400).json({ error: 'Impossible de creer un evenement (limite atteinte ou collision)' });

    res.json({ message: 'Evenement cree', eventId });
  } catch (err) {
    console.error('Event spawn error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
