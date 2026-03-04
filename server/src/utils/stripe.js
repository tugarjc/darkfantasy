// ============================================================
// INFERNO DOMINI — Stripe Client (conditional)
// Only loads if STRIPE_SECRET_KEY is set
// ============================================================

let stripe = null;

if (process.env.STRIPE_SECRET_KEY) {
  try {
    stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
    console.log('Stripe initialized');
  } catch (err) {
    console.warn('Stripe module not available:', err.message);
  }
}

function isStripeEnabled() {
  return !!stripe;
}

module.exports = { stripe, isStripeEnabled };
