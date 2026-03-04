const { Router } = require('express');
const { pool } = require('../db');
const { authenticateToken } = require('../middleware/auth');
const { RESEARCHES } = require('../game/researches');
const { researchCost, researchTime } = require('../game/formulas');
const { flushResources, recalcRates } = require('../game/resources');
const { LEGENDARY_EFFECTS, hasLegendary, isOnCooldown, isEffectActive, getLegendaryStatus } = require('../game/legendaryEffects');
const { notify } = require('../game/notify');

const router = Router();

// ── GET /api/researches ──
router.get('/', authenticateToken, async (req, res) => {
  try {
    // Get player's current researches
    const result = await pool.query(
      'SELECT type, level, research_end FROM researches WHERE player_id = $1',
      [req.user.id]
    );
    const playerResearches = {};
    for (const r of result.rows) {
      playerResearches[r.type] = { level: r.level, researchEnd: r.research_end };
    }

    // Get player's buildings (for prerequisite checks)
    const circleRes = await pool.query(
      'SELECT id FROM circles WHERE player_id = $1 AND is_primary = true',
      [req.user.id]
    );
    const circleId = circleRes.rows[0]?.id;

    let buildingLevels = {};
    if (circleId) {
      const bResult = await pool.query(
        'SELECT type, level FROM buildings WHERE circle_id = $1',
        [circleId]
      );
      for (const b of bResult.rows) buildingLevels[b.type] = b.level;
    }

    // Get biblio level for time calculation
    const biblioLevel = buildingLevels.bibliotheque_obscure || 0;

    // Build research list with costs and status
    const researches = Object.entries(RESEARCHES).map(([type, def]) => {
      const current = playerResearches[type] || { level: 0, researchEnd: null };
      const nextLevel = current.level + 1;
      const isMaxed = current.level >= def.maxLevel;
      const isResearching = current.researchEnd && new Date(current.researchEnd).getTime() > Date.now();

      // Check prerequisites
      let prereqsMet = true;
      const prereqDetails = [];
      for (const prereq of def.prerequisites) {
        if (prereq.building) {
          const have = buildingLevels[prereq.building] || 0;
          const met = have >= prereq.level;
          prereqsMet = prereqsMet && met;
          prereqDetails.push({ type: 'building', key: prereq.building, need: prereq.level, have, met });
        }
        if (prereq.research) {
          const have = playerResearches[prereq.research]?.level || 0;
          const met = have >= prereq.level;
          prereqsMet = prereqsMet && met;
          prereqDetails.push({ type: 'research', key: prereq.research, need: prereq.level, have, met });
        }
      }

      const nextLevel_ = isMaxed ? null : {
        level: nextLevel,
        costFer: researchCost(def.baseFer, nextLevel),
        costEssence: researchCost(def.baseEssence, nextLevel),
        costAmes: researchCost(def.baseAmes, nextLevel),
        time: researchTime(def.baseTime, nextLevel, biblioLevel),
      };

      return {
        type,
        name: def.name,
        category: def.category,
        description: def.description,
        level: current.level,
        maxLevel: def.maxLevel,
        isMaxed,
        isResearching,
        researchEnd: current.researchEnd,
        prereqsMet,
        prerequisites: prereqDetails,
        nextLevel: nextLevel_,
      };
    });

    res.json({ researches, biblioLevel });
  } catch (err) {
    console.error('Researches list error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ── POST /api/researches/start ──
router.post('/start', authenticateToken, async (req, res) => {
  const { researchType } = req.body;

  if (!researchType || !RESEARCHES[researchType]) {
    return res.status(400).json({ error: 'Invalid research type' });
  }

  const def = RESEARCHES[researchType];
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // Get player's primary circle
    const circleRes = await client.query(
      'SELECT id FROM circles WHERE player_id = $1 AND is_primary = true',
      [req.user.id]
    );
    if (circleRes.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'No circle found' });
    }
    const circleId = circleRes.rows[0].id;

    // Check no other research in progress
    const inProgress = await client.query(
      "SELECT type FROM researches WHERE player_id = $1 AND research_end IS NOT NULL AND research_end > NOW()",
      [req.user.id]
    );
    if (inProgress.rows.length > 0) {
      await client.query('ROLLBACK');
      return res.status(409).json({ error: `Research already in progress: ${inProgress.rows[0].type}` });
    }

    // Get current level
    const currentRes = await client.query(
      'SELECT level FROM researches WHERE player_id = $1 AND type = $2',
      [req.user.id, researchType]
    );
    const currentLevel = currentRes.rows[0]?.level || 0;
    const nextLevel = currentLevel + 1;

    if (currentLevel >= def.maxLevel) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Research already at max level' });
    }

    // Check building prerequisites
    const buildings = await client.query(
      'SELECT type, level FROM buildings WHERE circle_id = $1',
      [circleId]
    );
    const buildingMap = {};
    for (const b of buildings.rows) buildingMap[b.type] = b.level;

    // Check research prerequisites
    const researches = await client.query(
      'SELECT type, level FROM researches WHERE player_id = $1',
      [req.user.id]
    );
    const researchMap = {};
    for (const r of researches.rows) researchMap[r.type] = r.level;

    for (const prereq of def.prerequisites) {
      if (prereq.building && (buildingMap[prereq.building] || 0) < prereq.level) {
        await client.query('ROLLBACK');
        return res.status(400).json({
          error: `Requires ${prereq.building} level ${prereq.level} (current: ${buildingMap[prereq.building] || 0})`,
        });
      }
      if (prereq.research && (researchMap[prereq.research] || 0) < prereq.level) {
        await client.query('ROLLBACK');
        return res.status(400).json({
          error: `Requires ${prereq.research} level ${prereq.level} (current: ${researchMap[prereq.research] || 0})`,
        });
      }
    }

    // Calculate costs
    const costFer = researchCost(def.baseFer, nextLevel);
    const costEssence = researchCost(def.baseEssence, nextLevel);
    const costAmes = researchCost(def.baseAmes, nextLevel);

    // Flush and check resources
    await flushResources(circleId, client);
    const resRow = await client.query(
      'SELECT iron, essence, souls FROM resources WHERE circle_id = $1 FOR UPDATE',
      [circleId]
    );
    const r = resRow.rows[0];

    if (r.iron < costFer || r.essence < costEssence || r.souls < costAmes) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Insufficient resources' });
    }

    // Deduct resources
    await client.query(
      'UPDATE resources SET iron = iron - $2, essence = essence - $3, souls = souls - $4 WHERE circle_id = $1',
      [circleId, costFer, costEssence, costAmes]
    );

    // Calculate research time
    const biblioLevel = buildingMap.bibliotheque_obscure || 0;
    const timeSeconds = researchTime(def.baseTime, nextLevel, biblioLevel);
    const endTime = new Date(Date.now() + timeSeconds * 1000);

    // Upsert research
    await client.query(
      `INSERT INTO researches (player_id, type, level, research_end)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (player_id, type) DO UPDATE SET research_end = $4`,
      [req.user.id, researchType, currentLevel, endTime]
    );

    await client.query('COMMIT');

    res.json({
      researchType,
      level: nextLevel,
      costFer,
      costEssence,
      costAmes,
      timeSeconds,
      researchEnd: endTime,
    });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Research start error:', err);
    res.status(500).json({ error: 'Internal server error' });
  } finally {
    client.release();
  }
});

// ── POST /api/researches/complete ──
router.post('/complete', authenticateToken, async (req, res) => {
  const { researchType } = req.body;

  if (!researchType || !RESEARCHES[researchType]) {
    return res.status(400).json({ error: 'Invalid research type' });
  }

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const result = await client.query(
      'SELECT level, research_end FROM researches WHERE player_id = $1 AND type = $2 FOR UPDATE',
      [req.user.id, researchType]
    );

    if (result.rows.length === 0 || !result.rows[0].research_end) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Research not in progress' });
    }

    const { level, research_end } = result.rows[0];
    if (new Date(research_end).getTime() > Date.now()) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Research not finished yet' });
    }

    const newLevel = level + 1;

    // Level up + clear timer
    await client.query(
      'UPDATE researches SET level = $3, research_end = NULL WHERE player_id = $1 AND type = $2',
      [req.user.id, researchType, newLevel]
    );

    // Recalc production rates if it's a production research
    const def = RESEARCHES[researchType];
    if (def.category === 'production') {
      const circleRes = await client.query(
        'SELECT id FROM circles WHERE player_id = $1 AND is_primary = true',
        [req.user.id]
      );
      if (circleRes.rows.length > 0) {
        await recalcRates(circleRes.rows[0].id, client);
      }
    }

    // Update score
    await client.query(
      'UPDATE players SET score = score + 150 WHERE id = $1',
      [req.user.id]
    );

    await client.query('COMMIT');

    res.json({
      researchType,
      newLevel,
      message: `${def.name} upgraded to level ${newLevel}`,
    });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Research complete error:', err);
    res.status(500).json({ error: 'Internal server error' });
  } finally {
    client.release();
  }
});

// ── GET /api/researches/legendary/status ──
router.get('/legendary/status', authenticateToken, async (req, res) => {
  try {
    const status = await getLegendaryStatus(req.user.id, pool);
    res.json({ status });
  } catch (err) {
    console.error('Legendary status error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ── POST /api/researches/activate ──
router.post('/activate', authenticateToken, async (req, res) => {
  const { researchType, coordQ, coordR, targetCircleId } = req.body;

  if (!researchType || !LEGENDARY_EFFECTS[researchType]) {
    return res.status(400).json({ error: 'Invalid legendary research type' });
  }

  const def = LEGENDARY_EFFECTS[researchType];
  if (def.type === 'passive') {
    return res.status(400).json({ error: 'Passive effects are always active once researched' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Check research level
    const rRow = await client.query(
      'SELECT level FROM researches WHERE player_id = $1 AND type = $2',
      [req.user.id, researchType]
    );
    if ((rRow.rows[0]?.level || 0) < 1) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Research not completed' });
    }

    // Check cooldown
    const cdRow = await client.query(
      `SELECT cooldown_end FROM legendary_activations
       WHERE player_id = $1 AND research_type = $2
         AND cooldown_end > NOW()
       ORDER BY activated_at DESC LIMIT 1`,
      [req.user.id, researchType]
    );
    if (cdRow.rows.length > 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({
        error: 'On cooldown',
        cooldownEnd: cdRow.rows[0].cooldown_end,
      });
    }

    let result = {};
    const expiresAt = def.duration ? new Date(Date.now() + def.duration * 1000) : null;
    const cooldownEnd = def.cooldown ? new Date(Date.now() + def.cooldown * 1000) : null;

    // ── Apply effect by type ──
    switch (researchType) {
      case 'teleportation_infernale': {
        if (coordQ === undefined || coordR === undefined) {
          await client.query('ROLLBACK');
          return res.status(400).json({ error: 'coordQ and coordR required' });
        }
        const q = parseInt(coordQ), r = parseInt(coordR);
        if (isNaN(q) || isNaN(r) || q < -100 || q > 100 || r < -100 || r > 100) {
          await client.query('ROLLBACK');
          return res.status(400).json({ error: 'Invalid coordinates (range: -100 to 100)' });
        }
        // Check target hex is empty
        const occupied = await client.query(
          'SELECT id FROM circles WHERE coord_q = $1 AND coord_r = $2',
          [q, r]
        );
        if (occupied.rows.length > 0) {
          await client.query('ROLLBACK');
          return res.status(400).json({ error: 'Target hex is occupied' });
        }
        // Move primary circle
        const primary = await client.query(
          "SELECT id FROM circles WHERE player_id = $1 AND is_primary = true",
          [req.user.id]
        );
        if (primary.rows.length === 0) {
          await client.query('ROLLBACK');
          return res.status(400).json({ error: 'No primary circle' });
        }
        await client.query(
          'UPDATE circles SET coord_q = $2, coord_r = $3 WHERE id = $1',
          [primary.rows[0].id, q, r]
        );
        result = { movedTo: { q, r } };
        break;
      }

      case 'bouclier_absolu': {
        // Check not already active
        const active = await client.query(
          `SELECT id FROM legendary_activations
           WHERE player_id = $1 AND research_type = 'bouclier_absolu'
             AND expires_at > NOW()`,
          [req.user.id]
        );
        if (active.rows.length > 0) {
          await client.query('ROLLBACK');
          return res.status(400).json({ error: 'Shield already active' });
        }
        result = { shieldExpiresAt: expiresAt };
        break;
      }

      case 'drain_dimensionnel': {
        if (!targetCircleId) {
          await client.query('ROLLBACK');
          return res.status(400).json({ error: 'targetCircleId required' });
        }
        // Check target circle exists and belongs to another player
        const target = await client.query(
          'SELECT c.id, c.player_id FROM circles c WHERE c.id = $1',
          [targetCircleId]
        );
        if (target.rows.length === 0) {
          await client.query('ROLLBACK');
          return res.status(400).json({ error: 'Target circle not found' });
        }
        if (target.rows[0].player_id === req.user.id) {
          await client.query('ROLLBACK');
          return res.status(400).json({ error: 'Cannot drain own circle' });
        }
        // Flush target resources and steal 5%
        await client.query('SELECT update_resources($1)', [targetCircleId]);
        const targetRes = await client.query(
          'SELECT iron, essence, souls FROM resources WHERE circle_id = $1 FOR UPDATE',
          [targetCircleId]
        );
        const tr = targetRes.rows[0];
        const stolen = {
          iron: Math.floor(tr.iron * 0.05),
          essence: Math.floor(tr.essence * 0.05),
          souls: Math.floor(tr.souls * 0.05),
        };
        // Remove from target
        await client.query(
          'UPDATE resources SET iron = iron - $2, essence = essence - $3, souls = souls - $4 WHERE circle_id = $1',
          [targetCircleId, stolen.iron, stolen.essence, stolen.souls]
        );
        // Add to player's primary circle
        const myCircle = await client.query(
          "SELECT id FROM circles WHERE player_id = $1 AND is_primary = true",
          [req.user.id]
        );
        if (myCircle.rows.length > 0) {
          await client.query('SELECT update_resources($1)', [myCircle.rows[0].id]);
          await client.query(
            `UPDATE resources SET
               iron = LEAST(iron + $2, iron_cap),
               essence = LEAST(essence + $3, essence_cap),
               souls = LEAST(souls + $4, souls_cap)
             WHERE circle_id = $1`,
            [myCircle.rows[0].id, stolen.iron, stolen.essence, stolen.souls]
          );
        }
        // Notify target
        await notify(target.rows[0].player_id, 'drain_received', {
          stolenIron: stolen.iron, stolenEssence: stolen.essence, stolenSouls: stolen.souls,
        }, client);
        result = { stolen };
        break;
      }

      default:
        await client.query('ROLLBACK');
        return res.status(400).json({ error: 'Unknown activation type' });
    }

    // Record activation
    await client.query(
      `INSERT INTO legendary_activations (player_id, research_type, expires_at, cooldown_end, data)
       VALUES ($1, $2, $3, $4, $5)`,
      [req.user.id, researchType, expiresAt, cooldownEnd, JSON.stringify(result)]
    );

    // Notify player
    await notify(req.user.id, 'legendary_activated', {
      researchType, ...result,
    }, client);

    await client.query('COMMIT');

    res.json({ message: `${researchType} activated`, expiresAt, cooldownEnd, ...result });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Legendary activate error:', err);
    res.status(500).json({ error: 'Internal server error' });
  } finally {
    client.release();
  }
});

module.exports = router;
