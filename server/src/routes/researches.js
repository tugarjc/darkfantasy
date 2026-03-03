const { Router } = require('express');
const { pool } = require('../db');
const { authenticateToken } = require('../middleware/auth');
const { RESEARCHES } = require('../game/researches');
const { researchCost, researchTime } = require('../game/formulas');
const { flushResources, recalcRates } = require('../game/resources');

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

module.exports = router;
