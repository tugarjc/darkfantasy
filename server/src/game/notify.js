// ============================================================
// INFERNO DOMINI — Notification Helper
// ============================================================

const { pool } = require('../db');

async function notify(playerId, type, data = {}, client) {
  const db = client || pool;
  await db.query(
    'INSERT INTO notifications (player_id, type, data) VALUES ($1, $2, $3)',
    [playerId, type, JSON.stringify(data)]
  );
}

module.exports = { notify };
