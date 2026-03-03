const { Router } = require('express');
const { pool } = require('../db');
const { authenticateToken } = require('../middleware/auth');
const { HEROES, xpForLevel, summonCost, getHeroBonuses } = require('../game/heroes');
const { flushResources } = require('../game/resources');

const router = Router();

// ── GET /api/heroes ── List player's heroes + available types
router.get('/', authenticateToken, async (req, res) => {
  try {
    // Get player's heroes
    const heroRes = await pool.query(
      'SELECT * FROM heroes WHERE player_id = $1 ORDER BY type',
      [req.user.id]
    );

    // Get autel level
    const circleRes = await pool.query(
      `SELECT c.id, COALESCE(b.level, 0) as autel_level
       FROM circles c
       LEFT JOIN buildings b ON b.circle_id = c.id AND b.type = 'autel_sacrifice'
       WHERE c.player_id = $1 AND c.is_primary = true`,
      [req.user.id]
    );
    const autelLevel = circleRes.rows[0]?.autel_level || 0;

    // Build response
    const heroes = Object.entries(HEROES).map(([type, def]) => {
      const owned = heroRes.rows.find((h) => h.type === type);
      const cost = summonCost(type, autelLevel);
      const xpNeeded = owned ? xpForLevel(owned.level + 1) : null;

      return {
        type,
        name: def.name,
        title: def.title,
        description: def.description,
        category: def.category,
        maxLevel: def.maxLevel,
        // Owned info
        owned: !!owned,
        level: owned?.level || 0,
        xp: owned?.xp || 0,
        xpNext: xpNeeded,
        isDeployed: owned?.is_deployed || false,
        isDead: owned?.is_dead || false,
        // Summoning
        summonCost: cost,
        canSummon: autelLevel >= 1 && !owned,
        // Bonuses at current level
        bonuses: owned ? getHeroBonuses(type, owned.level) : getHeroBonuses(type, 1),
        bonusesDef: def.bonuses,
      };
    });

    res.json({ heroes, autelLevel });
  } catch (err) {
    console.error('Heroes list error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ── POST /api/heroes/summon ── Summon a new hero
router.post('/summon', authenticateToken, async (req, res) => {
  const { heroType } = req.body;
  if (!HEROES[heroType]) {
    return res.status(400).json({ error: 'Type de heros invalide' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Check if already owned
    const existing = await client.query(
      'SELECT id FROM heroes WHERE player_id = $1 AND type = $2',
      [req.user.id, heroType]
    );
    if (existing.rows.length > 0) {
      await client.query('ROLLBACK');
      return res.status(409).json({ error: 'Heros deja invoque' });
    }

    // Get primary circle + autel level
    const circleRes = await client.query(
      `SELECT c.id, COALESCE(b.level, 0) as autel_level
       FROM circles c
       LEFT JOIN buildings b ON b.circle_id = c.id AND b.type = 'autel_sacrifice'
       WHERE c.player_id = $1 AND c.is_primary = true`,
      [req.user.id]
    );
    const circle = circleRes.rows[0];
    if (!circle || circle.autel_level < 1) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Autel du Sacrifice requis (niveau 1 minimum)' });
    }

    // Calculate cost
    const cost = summonCost(heroType, circle.autel_level);

    // Flush & check resources
    await flushResources(circle.id, client);
    const resRes = await client.query(
      'SELECT iron, essence, souls FROM resources WHERE circle_id = $1 FOR UPDATE',
      [circle.id]
    );
    const r = resRes.rows[0];
    if (r.iron < cost.fer || r.essence < cost.essence || r.souls < cost.ames) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Ressources insuffisantes' });
    }

    // Deduct resources
    await client.query(
      'UPDATE resources SET iron = iron - $2, essence = essence - $3, souls = souls - $4 WHERE circle_id = $1',
      [circle.id, cost.fer, cost.essence, cost.ames]
    );

    // Create hero
    await client.query(
      'INSERT INTO heroes (player_id, type, level, xp, is_deployed, is_dead) VALUES ($1, $2, 1, 0, false, false)',
      [req.user.id, heroType]
    );

    // Score +200
    await client.query('UPDATE players SET score = score + 200 WHERE id = $1', [req.user.id]);

    await client.query('COMMIT');
    res.status(201).json({
      heroType,
      name: HEROES[heroType].name,
      message: `${HEROES[heroType].name} a ete invoque !`,
    });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Hero summon error:', err);
    res.status(500).json({ error: 'Internal server error' });
  } finally {
    client.release();
  }
});

// ── POST /api/heroes/revive ── Revive a dead hero
router.post('/revive', authenticateToken, async (req, res) => {
  const { heroType } = req.body;
  if (!HEROES[heroType]) {
    return res.status(400).json({ error: 'Type de heros invalide' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const heroRes = await client.query(
      'SELECT id, is_dead FROM heroes WHERE player_id = $1 AND type = $2 FOR UPDATE',
      [req.user.id, heroType]
    );
    if (heroRes.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Heros non trouve' });
    }
    if (!heroRes.rows[0].is_dead) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Ce heros n\'est pas mort' });
    }

    // Revive cost = 50% of summon cost
    const circleRes = await client.query(
      `SELECT c.id, COALESCE(b.level, 0) as autel_level
       FROM circles c
       LEFT JOIN buildings b ON b.circle_id = c.id AND b.type = 'autel_sacrifice'
       WHERE c.player_id = $1 AND c.is_primary = true`,
      [req.user.id]
    );
    const circle = circleRes.rows[0];
    const baseCost = summonCost(heroType, circle?.autel_level || 0);
    const cost = {
      fer: Math.floor(baseCost.fer * 0.5),
      essence: Math.floor(baseCost.essence * 0.5),
      ames: Math.floor(baseCost.ames * 0.5),
    };

    await flushResources(circle.id, client);
    const resRes = await client.query(
      'SELECT iron, essence, souls FROM resources WHERE circle_id = $1 FOR UPDATE',
      [circle.id]
    );
    const r = resRes.rows[0];
    if (r.iron < cost.fer || r.essence < cost.essence || r.souls < cost.ames) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Ressources insuffisantes' });
    }

    await client.query(
      'UPDATE resources SET iron = iron - $2, essence = essence - $3, souls = souls - $4 WHERE circle_id = $1',
      [circle.id, cost.fer, cost.essence, cost.ames]
    );

    await client.query(
      'UPDATE heroes SET is_dead = false WHERE id = $1',
      [heroRes.rows[0].id]
    );

    await client.query('COMMIT');
    res.json({ message: `${HEROES[heroType].name} a ete ressuscite !` });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Hero revive error:', err);
    res.status(500).json({ error: 'Internal server error' });
  } finally {
    client.release();
  }
});

// ── POST /api/heroes/assign ── Assign hero to a legion (before sending)
router.post('/assign', authenticateToken, async (req, res) => {
  const { heroType, legionId } = req.body;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    if (heroType === null && legionId) {
      // Unassign hero from legion
      await client.query('UPDATE legions SET hero_id = NULL WHERE id = $1', [legionId]);
      // Find hero that was on this legion and undeploy
      const heroOnLegion = await client.query(
        'SELECT h.id FROM heroes h JOIN legions l ON l.hero_id = h.id WHERE l.id = $1',
        [legionId]
      );
      if (heroOnLegion.rows[0]) {
        await client.query('UPDATE heroes SET is_deployed = false WHERE id = $1', [heroOnLegion.rows[0].id]);
      }
      await client.query('COMMIT');
      return res.json({ message: 'Heros retire de la legion' });
    }

    if (!HEROES[heroType]) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Type de heros invalide' });
    }

    // Get hero
    const heroRes = await client.query(
      'SELECT id, is_deployed, is_dead FROM heroes WHERE player_id = $1 AND type = $2 FOR UPDATE',
      [req.user.id, heroType]
    );
    if (heroRes.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Heros non trouve' });
    }
    const hero = heroRes.rows[0];
    if (hero.is_dead) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Ce heros est mort, ressuscitez-le d\'abord' });
    }
    if (hero.is_deployed) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Ce heros est deja deploye' });
    }

    // If legionId provided, assign to existing legion (must be stationnee)
    if (legionId) {
      const legionRes = await client.query(
        `SELECT l.id, l.hero_id FROM legions l
         JOIN circles c ON l.origin_circle = c.id
         WHERE l.id = $1 AND c.player_id = $2 AND l.status = 'stationnee'`,
        [legionId, req.user.id]
      );
      if (legionRes.rows.length === 0) {
        await client.query('ROLLBACK');
        return res.status(404).json({ error: 'Legion non trouvee ou en deplacement' });
      }
      if (legionRes.rows[0].hero_id) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: 'Cette legion a deja un heros' });
      }

      await client.query('UPDATE legions SET hero_id = $2 WHERE id = $1', [legionId, hero.id]);
      await client.query('UPDATE heroes SET is_deployed = true WHERE id = $1', [hero.id]);

      await client.query('COMMIT');
      return res.json({ message: `${HEROES[heroType].name} deploye avec la legion` });
    }

    await client.query('ROLLBACK');
    res.status(400).json({ error: 'legionId requis' });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Hero assign error:', err);
    res.status(500).json({ error: 'Internal server error' });
  } finally {
    client.release();
  }
});

module.exports = router;
