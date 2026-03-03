const { Router } = require('express');
const { pool } = require('../db');
const { authenticateToken } = require('../middleware/auth');
const { flushResources } = require('../game/resources');

const router = Router();
const VALID_RESOURCES = ['iron', 'essence', 'souls'];
const MAX_AMOUNT = 50000;
const OFFER_DURATION_HOURS = 24;

// Tax rate per marche level: base 15%, -0.5% per level (min 2%)
function taxRate(marcheLevel) {
  return Math.max(0.02, 0.15 - 0.005 * marcheLevel);
}

// Max simultaneous offers based on marche level
function maxOffers(marcheLevel) {
  return Math.min(20, 2 + Math.floor(marcheLevel / 2));
}

// ── GET /api/market ── List public offers + own offers
router.get('/', authenticateToken, async (req, res) => {
  try {
    // Get marche level
    const circleRes = await pool.query(
      `SELECT c.id, COALESCE(b.level, 0) as marche_level
       FROM circles c
       LEFT JOIN buildings b ON b.circle_id = c.id AND b.type = 'marche_demoniaque'
       WHERE c.player_id = $1 AND c.is_primary = true`,
      [req.user.id]
    );
    const marcheLevel = circleRes.rows[0]?.marche_level || 0;

    // Public offers (not expired, not accepted, not own)
    const publicOffers = await pool.query(
      `SELECT mo.*, p.username as seller_name
       FROM market_offers mo
       JOIN players p ON mo.seller_id = p.id
       WHERE mo.is_accepted = false
         AND mo.target_id IS NULL
         AND mo.expires_at > NOW()
         AND mo.seller_id != $1
       ORDER BY mo.created_at DESC
       LIMIT 50`,
      [req.user.id]
    );

    // Own offers
    const myOffers = await pool.query(
      `SELECT mo.*, p.username as target_name
       FROM market_offers mo
       LEFT JOIN players p ON mo.target_id = p.id
       WHERE mo.seller_id = $1
         AND mo.is_accepted = false
         AND mo.expires_at > NOW()
       ORDER BY mo.created_at DESC`,
      [req.user.id]
    );

    // Offers targeted to me
    const incomingOffers = await pool.query(
      `SELECT mo.*, p.username as seller_name
       FROM market_offers mo
       JOIN players p ON mo.seller_id = p.id
       WHERE mo.target_id = $1
         AND mo.is_accepted = false
         AND mo.expires_at > NOW()
       ORDER BY mo.created_at DESC`,
      [req.user.id]
    );

    res.json({
      publicOffers: publicOffers.rows,
      myOffers: myOffers.rows,
      incomingOffers: incomingOffers.rows,
      marcheLevel,
      taxRate: taxRate(marcheLevel),
      maxOffers: maxOffers(marcheLevel),
    });
  } catch (err) {
    console.error('Market list error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ── POST /api/market/create ── Create a trade offer
router.post('/create', authenticateToken, async (req, res) => {
  const { resourceFrom, resourceTo, amount, ratio, targetUsername } = req.body;

  // Validate inputs
  if (!VALID_RESOURCES.includes(resourceFrom) || !VALID_RESOURCES.includes(resourceTo)) {
    return res.status(400).json({ error: 'Ressource invalide (iron, essence, souls)' });
  }
  if (resourceFrom === resourceTo) {
    return res.status(400).json({ error: 'Impossible d\'echanger la meme ressource' });
  }
  if (!amount || amount < 1 || amount > MAX_AMOUNT) {
    return res.status(400).json({ error: `Quantite entre 1 et ${MAX_AMOUNT}` });
  }
  if (!ratio || ratio < 0.1 || ratio > 10) {
    return res.status(400).json({ error: 'Ratio entre 0.1 et 10' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Get circle + marche level
    const circleRes = await client.query(
      `SELECT c.id, COALESCE(b.level, 0) as marche_level
       FROM circles c
       LEFT JOIN buildings b ON b.circle_id = c.id AND b.type = 'marche_demoniaque'
       WHERE c.player_id = $1 AND c.is_primary = true`,
      [req.user.id]
    );
    const circle = circleRes.rows[0];
    if (!circle || circle.marche_level < 1) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Marche Demoniaque requis (niveau 1 minimum)' });
    }

    // Check offer count
    const countRes = await client.query(
      `SELECT COUNT(*) as c FROM market_offers
       WHERE seller_id = $1 AND is_accepted = false AND expires_at > NOW()`,
      [req.user.id]
    );
    if (parseInt(countRes.rows[0].c) >= maxOffers(circle.marche_level)) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: `Maximum ${maxOffers(circle.marche_level)} offres actives` });
    }

    // Resolve target player if private offer
    let targetId = null;
    if (targetUsername) {
      const targetRes = await client.query(
        'SELECT id FROM players WHERE username = $1',
        [targetUsername]
      );
      if (targetRes.rows.length === 0) {
        await client.query('ROLLBACK');
        return res.status(404).json({ error: 'Joueur cible non trouve' });
      }
      targetId = targetRes.rows[0].id;
      if (targetId === req.user.id) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: 'Impossible de s\'envoyer une offre a soi-meme' });
      }
    }

    // Flush resources & check seller has enough
    await flushResources(circle.id, client);
    const resRes = await client.query(
      'SELECT iron, essence, souls FROM resources WHERE circle_id = $1 FOR UPDATE',
      [circle.id]
    );
    const resources = resRes.rows[0];
    if (resources[resourceFrom] < amount) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Ressources insuffisantes' });
    }

    // Deduct resources from seller
    await client.query(
      `UPDATE resources SET ${resourceFrom} = ${resourceFrom} - $2 WHERE circle_id = $1`,
      [circle.id, amount]
    );

    // Create offer
    const expiresAt = new Date(Date.now() + OFFER_DURATION_HOURS * 3600 * 1000);
    const offerRes = await client.query(
      `INSERT INTO market_offers (seller_id, target_id, resource_from, resource_to, amount, ratio, expires_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id`,
      [req.user.id, targetId, resourceFrom, resourceTo, amount, ratio, expiresAt]
    );

    await client.query('COMMIT');
    res.status(201).json({
      offerId: offerRes.rows[0].id,
      message: 'Offre creee',
      expiresAt,
    });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Market create error:', err);
    res.status(500).json({ error: 'Internal server error' });
  } finally {
    client.release();
  }
});

// ── POST /api/market/:id/accept ── Accept a trade offer
router.post('/:id/accept', authenticateToken, async (req, res) => {
  const offerId = req.params.id;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Get offer
    const offerRes = await client.query(
      'SELECT * FROM market_offers WHERE id = $1 FOR UPDATE',
      [offerId]
    );
    if (offerRes.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Offre non trouvee' });
    }
    const offer = offerRes.rows[0];

    if (offer.is_accepted) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Offre deja acceptee' });
    }
    if (new Date(offer.expires_at) <= new Date()) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Offre expiree' });
    }
    if (offer.seller_id === req.user.id) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Impossible d\'accepter sa propre offre' });
    }
    if (offer.target_id && offer.target_id !== req.user.id) {
      await client.query('ROLLBACK');
      return res.status(403).json({ error: 'Cette offre ne vous est pas destinee' });
    }

    // Get buyer circle + marche level
    const buyerCircle = await client.query(
      `SELECT c.id, COALESCE(b.level, 0) as marche_level
       FROM circles c
       LEFT JOIN buildings b ON b.circle_id = c.id AND b.type = 'marche_demoniaque'
       WHERE c.player_id = $1 AND c.is_primary = true`,
      [req.user.id]
    );
    const buyer = buyerCircle.rows[0];
    if (!buyer || buyer.marche_level < 1) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Marche Demoniaque requis pour accepter une offre' });
    }

    // Calculate what buyer pays
    const buyerPays = Math.ceil(offer.amount * offer.ratio);
    const tax = taxRate(buyer.marche_level);
    const sellerReceives = Math.floor(offer.amount * (1 - tax));

    // Check buyer has enough of resource_to
    await flushResources(buyer.id, client);
    const buyerRes = await client.query(
      'SELECT iron, essence, souls FROM resources WHERE circle_id = $1 FOR UPDATE',
      [buyer.id]
    );
    if (buyerRes.rows[0][offer.resource_to] < buyerPays) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Ressources insuffisantes pour payer' });
    }

    // Deduct from buyer (resource_to)
    await client.query(
      `UPDATE resources SET ${offer.resource_to} = ${offer.resource_to} - $2 WHERE circle_id = $1`,
      [buyer.id, buyerPays]
    );

    // Give buyer the offered resource (resource_from, after tax)
    await client.query(
      `UPDATE resources SET ${offer.resource_from} = LEAST(${offer.resource_from} + $2, ${offer.resource_from}_cap)
       WHERE circle_id = $1`,
      [buyer.id, sellerReceives]
    );

    // Give seller the payment (resource_to, after tax)
    const sellerCircle = await client.query(
      'SELECT c.id FROM circles c WHERE c.player_id = $1 AND c.is_primary = true',
      [offer.seller_id]
    );
    const sellerPayment = Math.floor(buyerPays * (1 - tax));
    if (sellerCircle.rows[0]) {
      await flushResources(sellerCircle.rows[0].id, client);
      await client.query(
        `UPDATE resources SET ${offer.resource_to} = LEAST(${offer.resource_to} + $2, ${offer.resource_to}_cap)
         WHERE circle_id = $1`,
        [sellerCircle.rows[0].id, sellerPayment]
      );
    }

    // Mark offer as accepted
    await client.query('UPDATE market_offers SET is_accepted = true WHERE id = $1', [offerId]);

    await client.query('COMMIT');
    res.json({
      message: 'Echange effectue',
      buyerPaid: buyerPays,
      buyerReceived: sellerReceives,
      sellerReceived: sellerPayment,
      taxApplied: tax,
    });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Market accept error:', err);
    res.status(500).json({ error: 'Internal server error' });
  } finally {
    client.release();
  }
});

// ── POST /api/market/:id/cancel ── Cancel own offer
router.post('/:id/cancel', authenticateToken, async (req, res) => {
  const offerId = req.params.id;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const offerRes = await client.query(
      'SELECT * FROM market_offers WHERE id = $1 AND seller_id = $2 FOR UPDATE',
      [offerId, req.user.id]
    );
    if (offerRes.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Offre non trouvee' });
    }
    const offer = offerRes.rows[0];
    if (offer.is_accepted) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Offre deja acceptee, annulation impossible' });
    }

    // Refund resources to seller
    const sellerCircle = await client.query(
      'SELECT c.id FROM circles c WHERE c.player_id = $1 AND c.is_primary = true',
      [req.user.id]
    );
    if (sellerCircle.rows[0]) {
      await client.query(
        `UPDATE resources SET ${offer.resource_from} = LEAST(${offer.resource_from} + $2, ${offer.resource_from}_cap)
         WHERE circle_id = $1`,
        [sellerCircle.rows[0].id, offer.amount]
      );
    }

    // Delete offer
    await client.query('DELETE FROM market_offers WHERE id = $1', [offerId]);

    await client.query('COMMIT');
    res.json({ message: 'Offre annulee, ressources remboursees' });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Market cancel error:', err);
    res.status(500).json({ error: 'Internal server error' });
  } finally {
    client.release();
  }
});

module.exports = router;
