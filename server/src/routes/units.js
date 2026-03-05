const { Router } = require('express');
const { pool } = require('../db');
const { authenticateToken } = require('../middleware/auth');
const { UNITS } = require('../game/units');
const { flushResources } = require('../game/resources');
const { checkAchievement } = require('../game/achievements');

const router = Router();

// ── GET /api/circles/:circleId/units ──
router.get('/:circleId/units', authenticateToken, async (req, res) => {
  try {
    const { circleId } = req.params;

    const circle = await pool.query(
      'SELECT id FROM circles WHERE id = $1 AND player_id = $2',
      [circleId, req.user.id]
    );
    if (circle.rows.length === 0) return res.status(404).json({ error: 'Circle not found' });

    const result = await pool.query(
      'SELECT type, quantity FROM units WHERE circle_id = $1 AND quantity > 0',
      [circleId]
    );

    // Get building levels to determine which units are available
    const buildings = await pool.query(
      'SELECT type, level FROM buildings WHERE circle_id = $1',
      [circleId]
    );
    const bMap = {};
    for (const b of buildings.rows) bMap[b.type] = b.level;

    const units = Object.entries(UNITS).map(([type, def]) => {
      const owned = result.rows.find((u) => u.type === type);
      const reqBuilding = bMap[def.requires.building] || 0;
      const unlocked = reqBuilding >= def.requires.level;

      return {
        type,
        name: def.name,
        category: def.category,
        quantity: owned?.quantity || 0,
        unlocked,
        attack: def.attack,
        defense: def.defense,
        plunder: def.plunder,
        cost: { iron: def.costFer, essence: def.costEssence, souls: def.costAmes },
        trainTime: def.trainTime,
      };
    });

    res.json({ units });
  } catch (err) {
    console.error('Units fetch error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ── POST /api/circles/:circleId/units/train ──
router.post('/:circleId/units/train', authenticateToken, async (req, res) => {
  const { circleId } = req.params;
  const { unitType, quantity } = req.body;

  if (!unitType || !UNITS[unitType]) {
    return res.status(400).json({ error: 'Invalid unit type' });
  }
  const qty = parseInt(quantity);
  if (!qty || qty < 1 || qty > 1000) {
    return res.status(400).json({ error: 'Quantity must be 1-1000' });
  }

  const def = UNITS[unitType];
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // Verify ownership
    const circle = await client.query(
      'SELECT id FROM circles WHERE id = $1 AND player_id = $2',
      [circleId, req.user.id]
    );
    if (circle.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Circle not found' });
    }

    // Check building requirement
    const reqBuilding = await client.query(
      'SELECT level FROM buildings WHERE circle_id = $1 AND type = $2',
      [circleId, def.requires.building]
    );
    const buildingLevel = reqBuilding.rows[0]?.level || 0;
    if (buildingLevel < def.requires.level) {
      await client.query('ROLLBACK');
      return res.status(400).json({
        error: `Requires ${def.requires.building} level ${def.requires.level} (current: ${buildingLevel})`,
      });
    }

    // Calculate total cost
    const totalFer = def.costFer * qty;
    const totalEssence = def.costEssence * qty;
    const totalAmes = def.costAmes * qty;

    // Flush resources
    await flushResources(circleId, client);

    // Check resources
    const resRow = await client.query(
      'SELECT iron, essence, souls FROM resources WHERE circle_id = $1 FOR UPDATE',
      [circleId]
    );
    const r = resRow.rows[0];

    if (r.iron < totalFer || r.essence < totalEssence || r.souls < totalAmes) {
      await client.query('ROLLBACK');
      return res.status(400).json({
        error: 'Not enough resources',
        required: { iron: totalFer, essence: totalEssence, souls: totalAmes },
        available: { iron: Math.floor(r.iron), essence: Math.floor(r.essence), souls: Math.floor(r.souls) },
      });
    }

    // Deduct resources
    await client.query(
      'UPDATE resources SET iron = iron - $2, essence = essence - $3, souls = souls - $4 WHERE circle_id = $1',
      [circleId, totalFer, totalEssence, totalAmes]
    );

    // Add units (upsert)
    await client.query(
      `INSERT INTO units (circle_id, type, quantity) VALUES ($1, $2, $3)
       ON CONFLICT (circle_id, type) DO UPDATE SET quantity = units.quantity + $3`,
      [circleId, unitType, qty]
    );

    // Update military score
    const allUnits = await client.query(
      `SELECT u.type, u.quantity FROM units u
       JOIN circles c ON u.circle_id = c.id
       WHERE c.player_id = $1 AND u.quantity > 0`,
      [req.user.id]
    );
    let militaryScore = 0;
    for (const u of allUnits.rows) {
      const uDef = UNITS[u.type];
      if (uDef) {
        const unitCost = uDef.costFer + uDef.costEssence + uDef.costAmes;
        militaryScore += Math.floor((unitCost * u.quantity) / 10);
      }
    }
    // Add to existing economic score
    const currentScore = await client.query(
      'SELECT score FROM players WHERE id = $1',
      [req.user.id]
    );
    // We only update military portion — simplified for Phase 1
    await client.query('COMMIT');

    // Achievement hook: dragon_slayer
    if (unitType === 'dragon_abyssal') {
      checkAchievement(req.user.id, 'dragon_slayer', 1).catch(() => {});
    }

    const totalTime = def.trainTime * qty;

    res.json({
      message: `Training ${qty}x ${def.name} started`,
      unitType,
      quantity: qty,
      cost: { iron: totalFer, essence: totalEssence, souls: totalAmes },
      totalTrainTime: totalTime,
    });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Unit train error:', err);
    res.status(500).json({ error: 'Internal server error' });
  } finally {
    client.release();
  }
});

module.exports = router;
