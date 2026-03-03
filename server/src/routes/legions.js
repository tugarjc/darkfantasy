const { Router } = require('express');
const { pool } = require('../db');
const { authenticateToken } = require('../middleware/auth');
const { hexDistance } = require('../game/hex');
const { UNITS } = require('../game/units');
const { flushResources } = require('../game/resources');

const router = Router();

const SPEED_BASE = 10; // minutes per hex
const SOULS_PER_HEX = 5; // souls consumed per hex per unit group

// ── POST /api/legions/send ──
router.post('/send', authenticateToken, async (req, res) => {
  const { fromCircleId, toQ, toR, mission, units: unitComp } = req.body;

  // Validate mission type
  const validMissions = ['attaque', 'espionnage', 'transport', 'colonisation', 'farming', 'defense_alliee'];
  if (!validMissions.includes(mission)) {
    return res.status(400).json({ error: 'Invalid mission type' });
  }

  if (!fromCircleId || toQ === undefined || toR === undefined) {
    return res.status(400).json({ error: 'fromCircleId, toQ, toR required' });
  }

  if (!unitComp || typeof unitComp !== 'object' || Object.keys(unitComp).length === 0) {
    return res.status(400).json({ error: 'units composition required (e.g. {"squelette_soldat": 50})' });
  }

  // Validate unit types and quantities
  for (const [type, qty] of Object.entries(unitComp)) {
    if (!UNITS[type]) return res.status(400).json({ error: `Invalid unit type: ${type}` });
    if (!Number.isInteger(qty) || qty < 1) return res.status(400).json({ error: `Invalid quantity for ${type}` });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Verify circle ownership
    const circle = await client.query(
      'SELECT id, coord_q, coord_r FROM circles WHERE id = $1 AND player_id = $2',
      [fromCircleId, req.user.id]
    );
    if (circle.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Circle not found' });
    }

    const fromQ = circle.rows[0].coord_q;
    const fromR = circle.rows[0].coord_r;

    // Can't send to own location
    if (fromQ === toQ && fromR === toR) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Cannot send legion to own location' });
    }

    // Check max active legions (based on Palais level)
    const palais = await client.query(
      "SELECT level FROM buildings WHERE circle_id = $1 AND type = 'palais_infernal'",
      [fromCircleId]
    );
    const palaisLevel = palais.rows[0]?.level || 0;
    const maxLegions = 1 + Math.floor(palaisLevel / 2); // 1 base + 1 per 2 levels

    const activeLegions = await client.query(
      "SELECT COUNT(*) as count FROM legions WHERE player_id = $1 AND status IN ('en_route', 'combat')",
      [req.user.id]
    );
    if (parseInt(activeLegions.rows[0].count) >= maxLegions) {
      await client.query('ROLLBACK');
      return res.status(409).json({ error: `Max legions reached (${maxLegions}). Upgrade Palais Infernal.` });
    }

    // Check units available
    for (const [type, qty] of Object.entries(unitComp)) {
      const unitRow = await client.query(
        'SELECT quantity FROM units WHERE circle_id = $1 AND type = $2',
        [fromCircleId, type]
      );
      const available = unitRow.rows[0]?.quantity || 0;
      if (available < qty) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: `Not enough ${UNITS[type].name}: need ${qty}, have ${available}` });
      }
    }

    // Calculate distance and travel time
    const distance = hexDistance(fromQ, fromR, toQ, toR);
    if (distance === 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Invalid target' });
    }

    // Get speed research bonus
    const speedResearch = await client.query(
      "SELECT level FROM researches WHERE player_id = $1 AND type = 'vitesse_infernale'",
      [req.user.id]
    );
    const speedBonus = 1 + 0.10 * (speedResearch.rows[0]?.level || 0);
    const travelMinutes = (distance * SPEED_BASE) / speedBonus;
    const travelMs = travelMinutes * 60 * 1000;

    // Calculate souls cost
    const soulsCost = distance * SOULS_PER_HEX;

    // Flush and check souls
    await flushResources(fromCircleId, client);
    const resRow = await client.query(
      'SELECT souls FROM resources WHERE circle_id = $1 FOR UPDATE',
      [fromCircleId]
    );
    if ((resRow.rows[0]?.souls || 0) < soulsCost) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: `Not enough Ames Corrompues: need ${soulsCost}, have ${Math.floor(resRow.rows[0]?.souls || 0)}` });
    }

    // Deduct souls
    await client.query(
      'UPDATE resources SET souls = souls - $2 WHERE circle_id = $1',
      [fromCircleId, soulsCost]
    );

    // Deduct units
    for (const [type, qty] of Object.entries(unitComp)) {
      await client.query(
        'UPDATE units SET quantity = quantity - $3 WHERE circle_id = $1 AND type = $2',
        [fromCircleId, type, qty]
      );
    }

    // Create legion
    const now = new Date();
    const arrivalTime = new Date(now.getTime() + travelMs);

    const legion = await client.query(
      `INSERT INTO legions (player_id, from_circle_id, to_coord_q, to_coord_r, composition, mission, status, depart_time, arrival_time)
       VALUES ($1, $2, $3, $4, $5, $6, 'en_route', $7, $8) RETURNING id`,
      [req.user.id, fromCircleId, toQ, toR, JSON.stringify(unitComp), mission, now, arrivalTime]
    );

    await client.query('COMMIT');

    res.json({
      legionId: legion.rows[0].id,
      mission,
      from: { q: fromQ, r: fromR },
      to: { q: toQ, r: toR },
      distance,
      travelMinutes: Math.round(travelMinutes * 10) / 10,
      arrivalTime,
      soulsCost,
      composition: unitComp,
    });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Legion send error:', err);
    res.status(500).json({ error: 'Internal server error' });
  } finally {
    client.release();
  }
});

// ── POST /api/legions/:id/recall ──
router.post('/:id/recall', authenticateToken, async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const legion = await client.query(
      "SELECT * FROM legions WHERE id = $1 AND player_id = $2 AND status = 'en_route' FOR UPDATE",
      [req.params.id, req.user.id]
    );

    if (legion.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Legion not found or not in transit' });
    }

    const l = legion.rows[0];
    const now = Date.now();
    const elapsed = now - new Date(l.depart_time).getTime();
    const returnTime = new Date(now + elapsed * 1.1); // 110% of elapsed time

    // Refund 50% of souls
    const fromCircle = await client.query('SELECT coord_q, coord_r FROM circles WHERE id = $1', [l.from_circle_id]);
    const distance = hexDistance(
      fromCircle.rows[0].coord_q, fromCircle.rows[0].coord_r,
      l.to_coord_q, l.to_coord_r
    );
    const soulsRefund = Math.floor(distance * SOULS_PER_HEX * 0.5);
    await client.query(
      'UPDATE resources SET souls = LEAST(souls + $2, souls_cap) WHERE circle_id = $1',
      [l.from_circle_id, soulsRefund]
    );

    // Update legion status
    await client.query(
      "UPDATE legions SET status = 'rappel', return_time = $2 WHERE id = $1",
      [req.params.id, returnTime]
    );

    await client.query('COMMIT');

    res.json({
      message: 'Legion recalled',
      legionId: req.params.id,
      returnTime,
      soulsRefunded: soulsRefund,
    });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Legion recall error:', err);
    res.status(500).json({ error: 'Internal server error' });
  } finally {
    client.release();
  }
});

// ── GET /api/legions ──
router.get('/', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT l.*, c.name as from_circle_name, c.coord_q as from_q, c.coord_r as from_r
       FROM legions l
       JOIN circles c ON l.from_circle_id = c.id
       WHERE l.player_id = $1
         AND l.status IN ('en_route', 'retour', 'rappel')
       ORDER BY l.arrival_time ASC`,
      [req.user.id]
    );

    const legions = result.rows.map((l) => ({
      id: l.id,
      mission: l.mission,
      status: l.status,
      from: { q: l.from_q, r: l.from_r, name: l.from_circle_name },
      to: { q: l.to_coord_q, r: l.to_coord_r },
      composition: l.composition,
      departTime: l.depart_time,
      arrivalTime: l.arrival_time,
      returnTime: l.return_time,
    }));

    res.json({ legions });
  } catch (err) {
    console.error('Legions list error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
