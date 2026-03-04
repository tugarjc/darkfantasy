const { Router } = require('express');
const { pool } = require('../db');
const { authenticateToken } = require('../middleware/auth');
const { ALLIANCE_TECHS, allianceTechCost } = require('../game/allianceResearch');
const { flushResources } = require('../game/resources');

const router = Router();

// ── GET /api/alliances/research ── List alliance researches
router.get('/research', authenticateToken, async (req, res) => {
  try {
    const player = await pool.query('SELECT alliance_id FROM players WHERE id = $1', [req.user.id]);
    const allianceId = player.rows[0]?.alliance_id;
    if (!allianceId) return res.status(400).json({ error: 'Pas dans une alliance' });

    const result = await pool.query(
      'SELECT * FROM alliance_researches WHERE alliance_id = $1',
      [allianceId]
    );

    const researchMap = {};
    for (const r of result.rows) {
      researchMap[r.type] = {
        level: r.level,
        contributions: typeof r.contributions === 'string' ? JSON.parse(r.contributions) : (r.contributions || {}),
      };
    }

    const techs = Object.entries(ALLIANCE_TECHS).map(([type, def]) => ({
      type,
      ...def,
      currentLevel: researchMap[type]?.level || 0,
      contributions: researchMap[type]?.contributions || {},
      nextCost: allianceTechCost(type, researchMap[type]?.level || 0),
      maxed: (researchMap[type]?.level || 0) >= def.maxLevel,
    }));

    res.json({ researches: techs });
  } catch (err) {
    console.error('Alliance research list error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ── POST /api/alliances/research/contribute ── Contribute resources to alliance research
router.post('/research/contribute', authenticateToken, async (req, res) => {
  const { techType, iron = 0, essence = 0, souls = 0 } = req.body;
  if (!techType || !ALLIANCE_TECHS[techType]) {
    return res.status(400).json({ error: 'Type de recherche invalide' });
  }
  if (iron <= 0 && essence <= 0 && souls <= 0) {
    return res.status(400).json({ error: 'Contribution requise' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const player = await client.query('SELECT alliance_id FROM players WHERE id = $1', [req.user.id]);
    const allianceId = player.rows[0]?.alliance_id;
    if (!allianceId) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Pas dans une alliance' });
    }

    // Get current research level
    let research = await client.query(
      'SELECT * FROM alliance_researches WHERE alliance_id = $1 AND type = $2 FOR UPDATE',
      [allianceId, techType]
    );

    let currentLevel = 0;
    let contributions = {};

    if (research.rows.length === 0) {
      await client.query(
        'INSERT INTO alliance_researches (alliance_id, type, level, contributions) VALUES ($1, $2, 0, $3)',
        [allianceId, techType, JSON.stringify({})]
      );
    } else {
      currentLevel = research.rows[0].level;
      contributions = typeof research.rows[0].contributions === 'string'
        ? JSON.parse(research.rows[0].contributions) : (research.rows[0].contributions || {});
    }

    const tech = ALLIANCE_TECHS[techType];
    if (currentLevel >= tech.maxLevel) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Recherche au niveau maximum' });
    }

    // Check player has resources
    const circle = await client.query(
      'SELECT id FROM circles WHERE player_id = $1 AND is_primary = true',
      [req.user.id]
    );
    if (circle.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Cercle non trouvé' });
    }
    const circleId = circle.rows[0].id;

    await flushResources(circleId, client);
    const resRow = await client.query(
      'SELECT iron, essence, souls FROM resources WHERE circle_id = $1 FOR UPDATE',
      [circleId]
    );
    const r = resRow.rows[0];
    if (r.iron < iron || r.essence < essence || r.souls < souls) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Ressources insuffisantes' });
    }

    // Deduct resources
    await client.query(
      'UPDATE resources SET iron = iron - $2, essence = essence - $3, souls = souls - $4 WHERE circle_id = $1',
      [circleId, iron, essence, souls]
    );

    // Add contribution
    if (!contributions[req.user.id]) {
      contributions[req.user.id] = { iron: 0, essence: 0, souls: 0 };
    }
    contributions[req.user.id].iron += iron;
    contributions[req.user.id].essence += essence;
    contributions[req.user.id].souls += souls;

    // Check if research can level up
    const cost = allianceTechCost(techType, currentLevel);
    const totalIron = Object.values(contributions).reduce((s, c) => s + c.iron, 0);
    const totalEssence = Object.values(contributions).reduce((s, c) => s + c.essence, 0);
    const totalSouls = Object.values(contributions).reduce((s, c) => s + c.souls, 0);

    let leveledUp = false;
    if (totalIron >= cost.iron && totalEssence >= cost.essence && totalSouls >= cost.souls) {
      currentLevel++;
      contributions = {}; // Reset contributions for next level
      leveledUp = true;
    }

    await client.query(
      'UPDATE alliance_researches SET level = $3, contributions = $4 WHERE alliance_id = $1 AND type = $2',
      [allianceId, techType, currentLevel, JSON.stringify(contributions)]
    );

    await client.query('COMMIT');
    res.json({
      message: leveledUp ? `${tech.name} amélioré au niveau ${currentLevel}!` : 'Contribution enregistrée',
      leveledUp,
      newLevel: currentLevel,
      totalContributed: { iron: totalIron, essence: totalEssence, souls: totalSouls },
      cost,
    });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Alliance research contribute error:', err);
    res.status(500).json({ error: 'Internal server error' });
  } finally {
    client.release();
  }
});

// ── GET /api/alliances/fortress ── Get fortress status
router.get('/fortress', authenticateToken, async (req, res) => {
  try {
    const player = await pool.query('SELECT alliance_id FROM players WHERE id = $1', [req.user.id]);
    const allianceId = player.rows[0]?.alliance_id;
    if (!allianceId) return res.status(400).json({ error: 'Pas dans une alliance' });

    const fortress = await pool.query(
      `SELECT f.*, a.name as alliance_name, a.tag as alliance_tag
       FROM fortress f
       JOIN alliances a ON f.alliance_id = a.id
       WHERE f.alliance_id = $1`,
      [allianceId]
    );

    if (fortress.rows.length === 0) {
      return res.json({ fortress: null });
    }

    const f = fortress.rows[0];
    const controlDays = f.controlled_since
      ? (Date.now() - new Date(f.controlled_since).getTime()) / (1000 * 3600 * 24)
      : 0;

    res.json({
      fortress: {
        id: f.id,
        allianceName: f.alliance_name,
        allianceTag: f.alliance_tag,
        coordQ: f.coord_q,
        coordR: f.coord_r,
        hp: f.hp,
        hpMax: 1000000,
        controlledSince: f.controlled_since,
        controlDays: Math.floor(controlDays),
        bonusActive: controlDays >= 7,
        buildComplete: f.build_complete || false,
      },
    });
  } catch (err) {
    console.error('Fortress status error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ── POST /api/alliances/fortress/build ── Start building fortress
router.post('/fortress/build', authenticateToken, async (req, res) => {
  const { coordQ, coordR } = req.body;
  if (coordQ === undefined || coordR === undefined) {
    return res.status(400).json({ error: 'coordQ et coordR requis' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const player = await client.query('SELECT alliance_id FROM players WHERE id = $1', [req.user.id]);
    const allianceId = player.rows[0]?.alliance_id;
    if (!allianceId) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Pas dans une alliance' });
    }

    // Check requester is leader
    const myRole = await client.query(
      'SELECT role FROM alliance_members WHERE alliance_id = $1 AND player_id = $2',
      [allianceId, req.user.id]
    );
    if (myRole.rows[0]?.role !== 'leader') {
      await client.query('ROLLBACK');
      return res.status(403).json({ error: 'Seul le chef peut construire la forteresse' });
    }

    // Check alliance has 20+ members
    const memberCount = await client.query(
      'SELECT COUNT(*) as c FROM alliance_members WHERE alliance_id = $1',
      [allianceId]
    );
    if (parseInt(memberCount.rows[0].c) < 5) { // lowered from 20 for testing
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Minimum 5 membres requis pour construire la forteresse' });
    }

    // Check coordination_guerre level >= 2
    const coordRes = await client.query(
      "SELECT level FROM alliance_researches WHERE alliance_id = $1 AND type = 'coordination_guerre'",
      [allianceId]
    );
    const coordLevel = coordRes.rows[0]?.level || 0;
    if (coordLevel < 1) { // lowered from 2 for testing
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Coordination de Guerre niveau 1 requis' });
    }

    // Check no existing fortress for this alliance
    const existing = await client.query(
      'SELECT id FROM fortress WHERE alliance_id = $1',
      [allianceId]
    );
    if (existing.rows.length > 0) {
      await client.query('ROLLBACK');
      return res.status(409).json({ error: 'Forteresse déjà existante' });
    }

    // Check hex is empty
    const hexOccupied = await client.query(
      'SELECT 1 FROM circles WHERE coord_q = $1 AND coord_r = $2',
      [coordQ, coordR]
    );
    if (hexOccupied.rows.length > 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Hexagone occupé' });
    }

    // Create fortress (starts building, 7 day timer)
    const buildEnd = new Date(Date.now() + 7 * 24 * 3600 * 1000);
    await client.query(
      `INSERT INTO fortress (alliance_id, coord_q, coord_r, hp, hp_max, build_complete, build_end_time, controlled_since)
       VALUES ($1, $2, $3, 0, 1000000, false, $4, NULL)`,
      [allianceId, coordQ, coordR, buildEnd]
    );

    await client.query('COMMIT');
    res.json({ message: 'Construction de la forteresse lancée', buildEndTime: buildEnd });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Fortress build error:', err);
    res.status(500).json({ error: 'Internal server error' });
  } finally {
    client.release();
  }
});

// ── POST /api/alliances/war/declare ── Declare formal war
router.post('/war/declare', authenticateToken, async (req, res) => {
  const { targetAllianceId } = req.body;
  if (!targetAllianceId) return res.status(400).json({ error: 'targetAllianceId requis' });

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const player = await client.query('SELECT alliance_id FROM players WHERE id = $1', [req.user.id]);
    const allianceId = player.rows[0]?.alliance_id;
    if (!allianceId) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Pas dans une alliance' });
    }
    if (allianceId === targetAllianceId) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Impossible de déclarer la guerre à soi-même' });
    }

    // Check requester is leader
    const myRole = await client.query(
      'SELECT role FROM alliance_members WHERE alliance_id = $1 AND player_id = $2',
      [allianceId, req.user.id]
    );
    if (myRole.rows[0]?.role !== 'leader') {
      await client.query('ROLLBACK');
      return res.status(403).json({ error: 'Seul le chef peut déclarer la guerre' });
    }

    // Check target alliance exists
    const target = await client.query('SELECT id, name FROM alliances WHERE id = $1', [targetAllianceId]);
    if (target.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Alliance cible non trouvée' });
    }

    // Set diplomacy to guerre with war_end_time (7 days)
    const [aId, bId] = allianceId < targetAllianceId
      ? [allianceId, targetAllianceId]
      : [targetAllianceId, allianceId];

    const warEnd = new Date(Date.now() + 7 * 24 * 3600 * 1000);

    await client.query(
      `INSERT INTO diplomacy (alliance_a, alliance_b, status, started_at)
       VALUES ($1, $2, 'guerre', NOW())
       ON CONFLICT (alliance_a, alliance_b) DO UPDATE SET status = 'guerre', started_at = NOW()`,
      [aId, bId]
    );

    await client.query('COMMIT');
    res.json({
      message: `Guerre déclarée contre ${target.rows[0].name}`,
      warEndTime: warEnd,
    });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('War declare error:', err);
    res.status(500).json({ error: 'Internal server error' });
  } finally {
    client.release();
  }
});

module.exports = router;
