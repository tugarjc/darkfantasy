const { Router } = require('express');
const { pool } = require('../db');
const { authenticateToken } = require('../middleware/auth');
const { COSMETICS, RELIC_PACKS, SUBSCRIPTION } = require('../game/cosmetics');
const { stripe, isStripeEnabled } = require('../utils/stripe');

const router = Router();

// ── GET /api/store ── Store info (packs, cosmetics, subscription status)
router.get('/', authenticateToken, async (req, res) => {
  try {
    // Player info
    const player = await pool.query(
      'SELECT relics, is_premium FROM players WHERE id = $1',
      [req.user.id]
    );

    // Owned cosmetics
    const owned = await pool.query(
      'SELECT cosmetic_id, equipped FROM player_cosmetics WHERE player_id = $1',
      [req.user.id]
    );
    const ownedMap = {};
    for (const c of owned.rows) ownedMap[c.cosmetic_id] = c.equipped;

    // Subscription status
    const subRow = await pool.query(
      'SELECT subscription_status, subscription_end FROM stripe_customers WHERE player_id = $1',
      [req.user.id]
    );

    // Build cosmetics list with owned status
    const cosmetics = Object.entries(COSMETICS).map(([id, def]) => ({
      id,
      ...def,
      owned: id in ownedMap,
      equipped: ownedMap[id] || false,
    }));

    res.json({
      relics: player.rows[0]?.relics || 0,
      isPremium: player.rows[0]?.is_premium || false,
      stripeEnabled: isStripeEnabled(),
      packs: Object.entries(RELIC_PACKS).map(([id, p]) => ({ id, ...p })),
      subscription: {
        ...SUBSCRIPTION,
        status: subRow.rows[0]?.subscription_status || 'inactive',
        endsAt: subRow.rows[0]?.subscription_end || null,
      },
      cosmetics,
    });
  } catch (err) {
    console.error('Store info error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ── POST /api/store/checkout ── Create Stripe Checkout for relic pack
router.post('/checkout', authenticateToken, async (req, res) => {
  if (!isStripeEnabled()) {
    return res.status(503).json({ error: 'Stripe not configured' });
  }

  const { packId } = req.body;
  const pack = RELIC_PACKS[packId];
  if (!pack) return res.status(400).json({ error: 'Invalid pack' });

  try {
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      mode: 'payment',
      line_items: [{
        price_data: {
          currency: pack.currency,
          product_data: { name: `Inferno Domini — ${packId} (${pack.relics} relics)` },
          unit_amount: pack.price,
        },
        quantity: 1,
      }],
      metadata: { playerId: req.user.id, packId, relics: String(pack.relics) },
      success_url: `${req.headers.origin || 'http://localhost:5173'}/?payment=success`,
      cancel_url: `${req.headers.origin || 'http://localhost:5173'}/?payment=cancel`,
    });

    res.json({ url: session.url });
  } catch (err) {
    console.error('Checkout error:', err);
    res.status(500).json({ error: 'Checkout failed' });
  }
});

// ── POST /api/store/subscribe ── Create Stripe Subscription Checkout
router.post('/subscribe', authenticateToken, async (req, res) => {
  if (!isStripeEnabled()) {
    return res.status(503).json({ error: 'Stripe not configured' });
  }

  try {
    // Get or create Stripe customer
    let custRow = await pool.query(
      'SELECT stripe_customer_id FROM stripe_customers WHERE player_id = $1',
      [req.user.id]
    );

    let customerId;
    if (custRow.rows.length === 0) {
      const player = await pool.query('SELECT email, username FROM players WHERE id = $1', [req.user.id]);
      const customer = await stripe.customers.create({
        email: player.rows[0].email,
        metadata: { playerId: req.user.id, username: player.rows[0].username },
      });
      customerId = customer.id;
      await pool.query(
        'INSERT INTO stripe_customers (player_id, stripe_customer_id) VALUES ($1, $2)',
        [req.user.id, customerId]
      );
    } else {
      customerId = custRow.rows[0].stripe_customer_id;
    }

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      payment_method_types: ['card'],
      mode: 'subscription',
      line_items: [{
        price_data: {
          currency: SUBSCRIPTION.currency,
          product_data: { name: 'Inferno Domini — Abonnement Ombres' },
          unit_amount: SUBSCRIPTION.priceMonthly,
          recurring: { interval: 'month' },
        },
        quantity: 1,
      }],
      metadata: { playerId: req.user.id },
      success_url: `${req.headers.origin || 'http://localhost:5173'}/?subscription=success`,
      cancel_url: `${req.headers.origin || 'http://localhost:5173'}/?subscription=cancel`,
    });

    res.json({ url: session.url });
  } catch (err) {
    console.error('Subscribe error:', err);
    res.status(500).json({ error: 'Subscription failed' });
  }
});

// ── POST /api/store/cancel-subscription ──
router.post('/cancel-subscription', authenticateToken, async (req, res) => {
  if (!isStripeEnabled()) {
    return res.status(503).json({ error: 'Stripe not configured' });
  }

  try {
    const custRow = await pool.query(
      'SELECT subscription_id FROM stripe_customers WHERE player_id = $1',
      [req.user.id]
    );
    if (!custRow.rows[0]?.subscription_id) {
      return res.status(400).json({ error: 'No active subscription' });
    }

    await stripe.subscriptions.update(custRow.rows[0].subscription_id, {
      cancel_at_period_end: true,
    });

    res.json({ message: 'Subscription will cancel at end of period' });
  } catch (err) {
    console.error('Cancel subscription error:', err);
    res.status(500).json({ error: 'Cancel failed' });
  }
});

// ── POST /api/store/webhook ── Stripe webhook (NO JWT auth, uses Stripe signature)
router.post('/webhook', async (req, res) => {
  if (!isStripeEnabled()) return res.status(503).send();

  let event;
  const sig = req.headers['stripe-signature'];
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  try {
    if (webhookSecret && sig) {
      event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret);
    } else {
      event = req.body;
    }
  } catch (err) {
    console.error('Webhook signature verification failed:', err.message);
    return res.status(400).send('Webhook Error');
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object;
        if (session.mode === 'payment' && session.metadata?.playerId) {
          // Credit relics
          const relics = parseInt(session.metadata.relics);
          await pool.query(
            'UPDATE players SET relics = relics + $2 WHERE id = $1',
            [session.metadata.playerId, relics]
          );
          await pool.query(
            `INSERT INTO relic_transactions (player_id, amount, type, source, stripe_session_id)
             VALUES ($1, $2, 'purchase', $3, $4)`,
            [session.metadata.playerId, relics, `pack_${session.metadata.packId}`, session.id]
          );
        }
        if (session.mode === 'subscription' && session.metadata?.playerId) {
          await pool.query(
            'UPDATE players SET is_premium = true WHERE id = $1',
            [session.metadata.playerId]
          );
          await pool.query(
            `UPDATE stripe_customers SET subscription_id = $2, subscription_status = 'active'
             WHERE player_id = $1`,
            [session.metadata.playerId, session.subscription]
          );
        }
        break;
      }

      case 'customer.subscription.deleted': {
        const sub = event.data.object;
        const custRow = await pool.query(
          'SELECT player_id FROM stripe_customers WHERE subscription_id = $1',
          [sub.id]
        );
        if (custRow.rows[0]) {
          await pool.query('UPDATE players SET is_premium = false WHERE id = $1', [custRow.rows[0].player_id]);
          await pool.query(
            "UPDATE stripe_customers SET subscription_status = 'cancelled', subscription_id = NULL WHERE player_id = $1",
            [custRow.rows[0].player_id]
          );
        }
        break;
      }
    }

    res.json({ received: true });
  } catch (err) {
    console.error('Webhook processing error:', err);
    res.status(500).send('Webhook processing error');
  }
});

// ── POST /api/store/cosmetics/purchase ── Buy cosmetic with relics
router.post('/cosmetics/purchase', authenticateToken, async (req, res) => {
  const { cosmeticId } = req.body;
  const def = COSMETICS[cosmeticId];
  if (!def) return res.status(400).json({ error: 'Invalid cosmetic' });

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Check not already owned
    const existing = await client.query(
      'SELECT 1 FROM player_cosmetics WHERE player_id = $1 AND cosmetic_id = $2',
      [req.user.id, cosmeticId]
    );
    if (existing.rows.length > 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Already owned' });
    }

    // Check relics
    const player = await client.query(
      'SELECT relics FROM players WHERE id = $1 FOR UPDATE',
      [req.user.id]
    );
    if ((player.rows[0]?.relics || 0) < def.cost) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Insufficient relics' });
    }

    // Deduct relics
    await client.query('UPDATE players SET relics = relics - $2 WHERE id = $1', [req.user.id, def.cost]);

    // Add cosmetic
    await client.query(
      'INSERT INTO player_cosmetics (player_id, cosmetic_id) VALUES ($1, $2)',
      [req.user.id, cosmeticId]
    );

    // Transaction log
    await client.query(
      `INSERT INTO relic_transactions (player_id, amount, type, source)
       VALUES ($1, $2, 'spend', $3)`,
      [req.user.id, -def.cost, `cosmetic_${cosmeticId}`]
    );

    await client.query('COMMIT');
    res.json({ message: 'Cosmetic purchased', cosmeticId, relicsSpent: def.cost });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Cosmetic purchase error:', err);
    res.status(500).json({ error: 'Internal server error' });
  } finally {
    client.release();
  }
});

// ── POST /api/store/cosmetics/equip ── Equip/unequip cosmetic (one per type)
router.post('/cosmetics/equip', authenticateToken, async (req, res) => {
  const { cosmeticId, equipped } = req.body;
  const def = COSMETICS[cosmeticId];
  if (!def) return res.status(400).json({ error: 'Invalid cosmetic' });

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Check owned
    const owned = await client.query(
      'SELECT 1 FROM player_cosmetics WHERE player_id = $1 AND cosmetic_id = $2',
      [req.user.id, cosmeticId]
    );
    if (owned.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Cosmetic not owned' });
    }

    if (equipped) {
      // Unequip all of same type first
      const sameType = Object.entries(COSMETICS)
        .filter(([, d]) => d.type === def.type)
        .map(([id]) => id);

      await client.query(
        'UPDATE player_cosmetics SET equipped = false WHERE player_id = $1 AND cosmetic_id = ANY($2)',
        [req.user.id, sameType]
      );

      // Equip this one
      await client.query(
        'UPDATE player_cosmetics SET equipped = true WHERE player_id = $1 AND cosmetic_id = $2',
        [req.user.id, cosmeticId]
      );
    } else {
      await client.query(
        'UPDATE player_cosmetics SET equipped = false WHERE player_id = $1 AND cosmetic_id = $2',
        [req.user.id, cosmeticId]
      );
    }

    await client.query('COMMIT');
    res.json({ message: equipped ? 'Equipped' : 'Unequipped', cosmeticId });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Equip error:', err);
    res.status(500).json({ error: 'Internal server error' });
  } finally {
    client.release();
  }
});

// ── GET /api/store/cosmetics/mine ── List owned cosmetics
router.get('/cosmetics/mine', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT cosmetic_id, equipped, acquired_at FROM player_cosmetics WHERE player_id = $1 ORDER BY acquired_at DESC',
      [req.user.id]
    );

    const cosmetics = result.rows.map((r) => ({
      id: r.cosmetic_id,
      ...COSMETICS[r.cosmetic_id],
      equipped: r.equipped,
      acquiredAt: r.acquired_at,
    }));

    res.json({ cosmetics });
  } catch (err) {
    console.error('My cosmetics error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
