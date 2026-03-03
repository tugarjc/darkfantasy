const { Router } = require('express');
const { pool } = require('../db');
const { authenticateToken } = require('../middleware/auth');
const { hexesInRadius, hexDistance } = require('../game/hex');

const router = Router();

// Seeded RNG for deterministic terrain generation
function seededRandom(q, r) {
  let h = (q * 374761393 + r * 668265263 + 1013904223) & 0xffffffff;
  h = ((h ^ (h >> 13)) * 1274126177) & 0xffffffff;
  h = (h ^ (h >> 16)) & 0xffffffff;
  return (h & 0x7fffffff) / 0x7fffffff;
}

function generateHexType(q, r) {
  const rand = seededRandom(q, r);
  // 5% Terre Maudite, 1% Faille, rest empty
  if (rand < 0.05) return 'terre_maudite';
  if (rand < 0.06) return 'faille';
  return 'vide';
}

// ── GET /api/map/sector?q=0&r=0&radius=5 ──
router.get('/sector', authenticateToken, async (req, res) => {
  const cq = parseInt(req.query.q) || 0;
  const cr = parseInt(req.query.r) || 0;
  const radius = Math.min(parseInt(req.query.radius) || 5, 15); // Max 15 radius

  try {
    const coords = hexesInRadius(cq, cr, radius);

    // Batch query: find all player circles in this area
    const circleResult = await pool.query(
      `SELECT c.id, c.player_id, c.name, c.coord_q, c.coord_r, c.is_primary,
              p.username, p.faction, p.score, p.alliance_id,
              a.name as alliance_name, a.tag as alliance_tag
       FROM circles c
       JOIN players p ON c.player_id = p.id
       LEFT JOIN alliances a ON p.alliance_id = a.id
       WHERE c.coord_q BETWEEN $1 AND $2
         AND c.coord_r BETWEEN $3 AND $4`,
      [cq - radius, cq + radius, cr - radius, cr + radius]
    );

    // Find active events in area
    const eventResult = await pool.query(
      `SELECT id, type, coord_q, coord_r, hp_remaining, hp_max, start_time, end_time
       FROM events
       WHERE coord_q BETWEEN $1 AND $2
         AND coord_r BETWEEN $3 AND $4
         AND end_time > NOW()`,
      [cq - radius, cq + radius, cr - radius, cr + radius]
    );

    // Find incoming/outgoing legions visible to the player
    const legionResult = await pool.query(
      `SELECT id, player_id, to_coord_q, to_coord_r, mission, status, arrival_time
       FROM legions
       WHERE player_id = $1
         AND status IN ('en_route', 'retour')`,
      [req.user.id]
    );

    // Build circle lookup by coords
    const circleMap = {};
    for (const c of circleResult.rows) {
      circleMap[`${c.coord_q},${c.coord_r}`] = c;
    }

    // Build event lookup
    const eventMap = {};
    for (const e of eventResult.rows) {
      eventMap[`${e.coord_q},${e.coord_r}`] = e;
    }

    // Build hex data
    const hexes = coords.map(([q, r]) => {
      const key = `${q},${r}`;
      const circle = circleMap[key];
      const event = eventMap[key];

      if (circle) {
        const isOwn = circle.player_id === req.user.id;
        return {
          q, r,
          type: 'cercle',
          circle: {
            id: circle.id,
            name: circle.name,
            username: circle.username,
            faction: circle.faction,
            score: circle.score,
            isPrimary: circle.is_primary,
            isOwn,
            alliance: circle.alliance_tag ? { name: circle.alliance_name, tag: circle.alliance_tag } : null,
          },
        };
      }

      if (event) {
        return {
          q, r,
          type: 'faille',
          event: {
            id: event.id,
            eventType: event.type,
            hpRemaining: event.hp_remaining,
            hpMax: event.hp_max,
            endTime: event.end_time,
          },
        };
      }

      const generated = generateHexType(q, r);
      return { q, r, type: generated };
    });

    // Legions on the map
    const legions = legionResult.rows.map((l) => ({
      id: l.id,
      toQ: l.to_coord_q,
      toR: l.to_coord_r,
      mission: l.mission,
      status: l.status,
      arrivalTime: l.arrival_time,
    }));

    res.json({ center: { q: cq, r: cr }, radius, hexes, legions });
  } catch (err) {
    console.error('Map sector error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
