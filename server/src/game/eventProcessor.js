// ============================================================
// INFERNO DOMINI — Event Processor
// Periodic job: spawns new events, distributes rewards for completed ones
// ============================================================

const { pool } = require('../db');
const { EVENT_TYPES, calculateRewards, randomEventType } = require('./events');

const SERVER_ID = '00000000-0000-0000-0000-000000000001';
const MAX_ACTIVE_EVENTS = 5;
const SPAWN_CHANCE = 0.15; // 15% chance per tick to spawn a new event

// ── Spawn a new event at random coordinates ──
async function spawnEvent(type = null) {
  const client = await pool.connect();
  try {
    // Count active events
    const active = await client.query(
      "SELECT COUNT(*) as c FROM events WHERE server_id = $1 AND end_time > NOW()",
      [SERVER_ID]
    );
    if (parseInt(active.rows[0].c) >= MAX_ACTIVE_EVENTS) return null;

    // Pick type
    const eventType = type || randomEventType();
    const def = EVENT_TYPES[eventType];
    if (!def) return null;

    // Scale HP with player count
    const playerCount = await client.query("SELECT COUNT(*) as c FROM players WHERE server_id = $1", [SERVER_ID]);
    const players = Math.max(1, parseInt(playerCount.rows[0].c));
    const hp = def.hpBase + def.hpPerPlayer * players;

    // Random coordinates (away from center, radius 20-80)
    const angle = Math.random() * 2 * Math.PI;
    const dist = 20 + Math.floor(Math.random() * 60);
    const q = Math.round(dist * Math.cos(angle));
    const r = Math.round(dist * Math.sin(angle));

    // Check no circle or event already at this coord
    const occupied = await client.query(
      "SELECT 1 FROM circles WHERE coord_q = $1 AND coord_r = $2 UNION SELECT 1 FROM events WHERE coord_q = $1 AND coord_r = $2 AND end_time > NOW()",
      [q, r]
    );
    if (occupied.rows.length > 0) return null; // skip this tick

    const endTime = new Date(Date.now() + def.durationHours * 3600 * 1000);

    const result = await client.query(
      `INSERT INTO events (server_id, type, coord_q, coord_r, hp_max, hp_remaining, data, end_time)
       VALUES ($1, $2, $3, $4, $5, $5, $6, $7) RETURNING id`,
      [SERVER_ID, eventType, q, r, hp, JSON.stringify({ name: def.name }), endTime]
    );

    console.log(`[EVENT] Spawned ${eventType} at (${q},${r}) — HP: ${hp}, ends: ${endTime.toISOString()}`);
    return result.rows[0].id;
  } catch (err) {
    console.error('[EVENT] Spawn error:', err);
    return null;
  } finally {
    client.release();
  }
}

// ── Distribute rewards for completed/defeated events ──
async function processCompletedEvents() {
  const client = await pool.connect();
  try {
    // Find events that are either expired or defeated (hp_remaining <= 0)
    const completed = await client.query(
      `SELECT * FROM events
       WHERE server_id = $1
         AND (end_time <= NOW() OR hp_remaining <= 0)
         AND id NOT IN (
           SELECT DISTINCT event_id FROM event_contributions WHERE rewarded = true
         )
       ORDER BY end_time`,
      [SERVER_ID]
    );

    for (const event of completed.rows) {
      try {
        await client.query('BEGIN');

        const defeated = event.hp_remaining <= 0;

        // Get all contributions for this event
        const contribs = await client.query(
          `SELECT ec.*, r.level as faille_level
           FROM event_contributions ec
           LEFT JOIN researches r ON r.player_id = ec.player_id AND r.type = 'maitrise_failles'
           WHERE ec.event_id = $1 AND ec.rewarded = false`,
          [event.id]
        );

        if (contribs.rows.length === 0) {
          // No contributions — just mark event as done (set end_time to past)
          if (event.end_time > new Date()) {
            await client.query("UPDATE events SET end_time = NOW() WHERE id = $1", [event.id]);
          }
          await client.query('COMMIT');
          continue;
        }

        const totalDamage = contribs.rows.reduce((s, c) => s + parseInt(c.damage), 0);

        for (const contrib of contribs.rows) {
          const ratio = defeated
            ? parseInt(contrib.damage) / Math.max(1, totalDamage)
            : (parseInt(contrib.damage) / Math.max(1, totalDamage)) * 0.3; // 30% rewards if not defeated

          const rewards = calculateRewards(event.type, ratio, contrib.faille_level || 0);

          // Find primary circle
          const circle = await client.query(
            "SELECT id FROM circles WHERE player_id = $1 AND is_primary = true",
            [contrib.player_id]
          );
          if (circle.rows.length > 0) {
            await client.query(
              `UPDATE resources SET
                iron = iron + $2,
                essence = essence + $3,
                souls = souls + $4
               WHERE circle_id = $1`,
              [circle.rows[0].id, rewards.iron, rewards.essence, rewards.souls]
            );
          }

          // Add score + relics based on rank
          const relicsReward = defeated
            ? (ratio >= 0.3 ? 500 : ratio >= 0.1 ? 200 : ratio >= 0.02 ? 100 : 50)
            : Math.floor(50 * ratio);

          if (rewards.score > 0 || relicsReward > 0) {
            await client.query(
              "UPDATE players SET score = score + $2, relics = relics + $3 WHERE id = $1",
              [contrib.player_id, rewards.score, relicsReward]
            );
          }

          // Mark as rewarded
          await client.query(
            "UPDATE event_contributions SET rewarded = true WHERE id = $1",
            [contrib.id]
          );
        }

        // Ensure event is marked as ended
        if (event.end_time > new Date()) {
          await client.query("UPDATE events SET end_time = NOW() WHERE id = $1", [event.id]);
        }

        console.log(`[EVENT] Rewards distributed for ${event.type} (${event.id}) — defeated: ${defeated}, contributors: ${contribs.rows.length}`);
        await client.query('COMMIT');
      } catch (err) {
        await client.query('ROLLBACK');
        console.error('[EVENT] Reward error:', err);
      }
    }
  } catch (err) {
    console.error('[EVENT] Process completed error:', err);
  } finally {
    client.release();
  }
}

// ── Main processor tick ──
async function eventTick() {
  try {
    // 1. Maybe spawn a new event
    if (Math.random() < SPAWN_CHANCE) {
      await spawnEvent();
    }

    // 2. Process completed events
    await processCompletedEvents();
  } catch (err) {
    console.error('[EVENT] Tick error:', err);
  }
}

// ── Start the event processor ──
function startEventProcessor(intervalMs = 60000) {
  console.log(`[EVENT] Processor started (interval: ${intervalMs}ms)`);
  const timer = setInterval(eventTick, intervalMs);
  return timer;
}

module.exports = { startEventProcessor, spawnEvent, processCompletedEvents };
