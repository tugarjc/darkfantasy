const { Router } = require('express');
const { pool } = require('../db');
const { authenticateToken } = require('../middleware/auth');
const { BUILDINGS } = require('../game/buildings');
const { buildingCost, buildingTime } = require('../game/formulas');
const { recalcRates, flushResources } = require('../game/resources');

const router = Router();

// ── GET /api/circles/:circleId/buildings ──
router.get('/:circleId/buildings', authenticateToken, async (req, res) => {
  try {
    const { circleId } = req.params;

    // Verify ownership
    const circle = await pool.query(
      'SELECT id FROM circles WHERE id = $1 AND player_id = $2',
      [circleId, req.user.id]
    );
    if (circle.rows.length === 0) return res.status(404).json({ error: 'Circle not found' });

    const result = await pool.query(
      'SELECT type, level, upgrade_end FROM buildings WHERE circle_id = $1 ORDER BY type',
      [circleId]
    );

    // Enrich with definitions and cost for next level
    const buildings = result.rows.map((b) => {
      const def = BUILDINGS[b.type];
      if (!def) return b;

      const nextLevel = b.level + 1;
      const isMaxed = nextLevel > def.maxLevel;
      const isUpgrading = b.upgrade_end && new Date(b.upgrade_end) > new Date();

      return {
        ...b,
        name: def.name,
        category: def.category,
        maxLevel: def.maxLevel,
        isUpgrading,
        isMaxed,
        nextLevel: isMaxed ? null : {
          level: nextLevel,
          costFer: buildingCost(def.baseFer, nextLevel),
          costEssence: buildingCost(def.baseEssence, nextLevel),
          costAmes: buildingCost(def.baseAmes, nextLevel),
          // Time will be calculated with biblio level on upgrade
        },
      };
    });

    res.json({ buildings });
  } catch (err) {
    console.error('Buildings fetch error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ── POST /api/circles/:circleId/buildings/upgrade ──
router.post('/:circleId/buildings/upgrade', authenticateToken, async (req, res) => {
  const { circleId } = req.params;
  const { buildingType } = req.body;

  if (!buildingType || !BUILDINGS[buildingType]) {
    return res.status(400).json({ error: 'Invalid building type' });
  }

  const def = BUILDINGS[buildingType];
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // Verify ownership
    const circle = await client.query(
      'SELECT id, player_id FROM circles WHERE id = $1 AND player_id = $2 FOR UPDATE',
      [circleId, req.user.id]
    );
    if (circle.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Circle not found' });
    }

    // Check if player is premium (2 build queues) or free (1 queue)
    const playerResult = await client.query(
      'SELECT is_premium FROM players WHERE id = $1',
      [req.user.id]
    );
    const isPremium = playerResult.rows[0]?.is_premium || false;
    const maxQueues = isPremium ? 2 : 1;

    // Check active constructions
    const activeBuilds = await client.query(
      "SELECT COUNT(*) as count FROM buildings WHERE circle_id = $1 AND upgrade_end IS NOT NULL AND upgrade_end > NOW()",
      [circleId]
    );
    if (parseInt(activeBuilds.rows[0].count) >= maxQueues) {
      await client.query('ROLLBACK');
      return res.status(409).json({ error: `Build queue full (${maxQueues}/${maxQueues})` });
    }

    // Get current building level
    const buildingRow = await client.query(
      'SELECT level, upgrade_end FROM buildings WHERE circle_id = $1 AND type = $2 FOR UPDATE',
      [circleId, buildingType]
    );

    let currentLevel = 0;
    if (buildingRow.rows.length > 0) {
      const b = buildingRow.rows[0];
      if (b.upgrade_end && new Date(b.upgrade_end) > new Date()) {
        await client.query('ROLLBACK');
        return res.status(409).json({ error: 'Building already upgrading' });
      }
      currentLevel = b.level;
    }

    const nextLevel = currentLevel + 1;
    if (nextLevel > def.maxLevel) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Building at max level' });
    }

    // Check prerequisites
    for (const prereq of def.prerequisites) {
      const prereqRow = await client.query(
        'SELECT level FROM buildings WHERE circle_id = $1 AND type = $2',
        [circleId, prereq.building]
      );
      const prereqLevel = prereqRow.rows[0]?.level || 0;
      if (prereqLevel < prereq.level) {
        await client.query('ROLLBACK');
        const prereqDef = BUILDINGS[prereq.building];
        return res.status(400).json({
          error: `Requires ${prereqDef?.name || prereq.building} level ${prereq.level} (current: ${prereqLevel})`,
        });
      }
    }

    // Calculate costs
    const costFer = buildingCost(def.baseFer, nextLevel);
    const costEssence = buildingCost(def.baseEssence, nextLevel);
    const costAmes = buildingCost(def.baseAmes, nextLevel);

    // Flush resources to get current amounts
    await flushResources(circleId, client);

    // Check resources
    const resRow = await client.query(
      'SELECT iron, essence, souls FROM resources WHERE circle_id = $1 FOR UPDATE',
      [circleId]
    );
    const r = resRow.rows[0];

    if (r.iron < costFer || r.essence < costEssence || r.souls < costAmes) {
      await client.query('ROLLBACK');
      return res.status(400).json({
        error: 'Not enough resources',
        required: { iron: costFer, essence: costEssence, souls: costAmes },
        available: { iron: Math.floor(r.iron), essence: Math.floor(r.essence), souls: Math.floor(r.souls) },
      });
    }

    // Deduct resources
    await client.query(
      'UPDATE resources SET iron = iron - $2, essence = essence - $3, souls = souls - $4 WHERE circle_id = $1',
      [circleId, costFer, costEssence, costAmes]
    );

    // Get biblio level for time calculation
    const biblioRow = await client.query(
      "SELECT level FROM buildings WHERE circle_id = $1 AND type = 'bibliotheque_obscure'",
      [circleId]
    );
    const biblioLevel = biblioRow.rows[0]?.level || 0;

    let timeSeconds = buildingTime(def.baseTime, nextLevel, biblioLevel);
    // Premium bonus: -10% build time
    if (isPremium) timeSeconds = Math.floor(timeSeconds * 0.9);
    const upgradeEnd = new Date(Date.now() + timeSeconds * 1000);

    // Upsert building
    if (buildingRow.rows.length > 0) {
      await client.query(
        'UPDATE buildings SET upgrade_end = $3 WHERE circle_id = $1 AND type = $2',
        [circleId, buildingType, upgradeEnd]
      );
    } else {
      await client.query(
        'INSERT INTO buildings (circle_id, type, level, upgrade_end) VALUES ($1, $2, 0, $3)',
        [circleId, buildingType, upgradeEnd]
      );
    }

    await client.query('COMMIT');

    res.json({
      message: `${def.name} upgrade to level ${nextLevel} started`,
      buildingType,
      nextLevel,
      cost: { iron: costFer, essence: costEssence, souls: costAmes },
      timeSeconds,
      upgradeEnd,
    });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Building upgrade error:', err);
    res.status(500).json({ error: 'Internal server error' });
  } finally {
    client.release();
  }
});

// ── POST /api/circles/:circleId/buildings/complete ──
// Called by client when timer finishes (server validates)
router.post('/:circleId/buildings/complete', authenticateToken, async (req, res) => {
  const { circleId } = req.params;
  const { buildingType } = req.body;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Find building with expired upgrade_end
    const result = await client.query(
      'SELECT level, upgrade_end FROM buildings WHERE circle_id = $1 AND type = $2 FOR UPDATE',
      [circleId, buildingType]
    );

    if (result.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Building not found' });
    }

    const b = result.rows[0];
    if (!b.upgrade_end || new Date(b.upgrade_end) > new Date()) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Upgrade not yet complete' });
    }

    const newLevel = b.level + 1;

    await client.query(
      'UPDATE buildings SET level = $3, upgrade_end = NULL WHERE circle_id = $1 AND type = $2',
      [circleId, buildingType, newLevel]
    );

    // Recalculate production rates
    await recalcRates(circleId, client);

    // Update player score
    const allBuildings = await client.query(
      'SELECT level FROM buildings WHERE circle_id IN (SELECT id FROM circles WHERE player_id = $1)',
      [req.user.id]
    );
    const totalLevels = allBuildings.rows.reduce((s, row) => s + row.level, 0);
    await client.query('UPDATE players SET score = $2 WHERE id = $1', [req.user.id, totalLevels * 100]);

    await client.query('COMMIT');

    res.json({
      message: `${BUILDINGS[buildingType]?.name || buildingType} upgraded to level ${newLevel}`,
      buildingType,
      newLevel,
    });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Building complete error:', err);
    res.status(500).json({ error: 'Internal server error' });
  } finally {
    client.release();
  }
});

module.exports = router;
