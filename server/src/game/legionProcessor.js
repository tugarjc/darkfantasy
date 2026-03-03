// ============================================================
// INFERNO DOMINI — Legion Arrival Processor
// Periodic job that resolves arrived legions
// ============================================================

const { pool } = require('../db');
const { resolveCombat, wallBonus, calculatePlunder } = require('./combat');
const { flushResources } = require('./resources');
const { hexDistance } = require('./hex');

const SPEED_BASE = 10;
const SOULS_PER_HEX = 5;

// Process all arrived legions
async function processArrivedLegions() {
  const client = await pool.connect();
  try {
    // Find all legions that have arrived
    const arrived = await client.query(
      `SELECT * FROM legions WHERE status = 'en_route' AND arrival_time <= NOW() FOR UPDATE`
    );

    for (const legion of arrived.rows) {
      try {
        await client.query('BEGIN');
        await processLegion(legion, client);
        await client.query('COMMIT');
      } catch (err) {
        await client.query('ROLLBACK');
        console.error(`Error processing legion ${legion.id}:`, err);
      }
    }

    // Process returning legions
    const returning = await client.query(
      `SELECT * FROM legions WHERE status IN ('retour', 'rappel') AND return_time <= NOW() FOR UPDATE`
    );

    for (const legion of returning.rows) {
      try {
        await client.query('BEGIN');
        await processReturn(legion, client);
        await client.query('COMMIT');
      } catch (err) {
        await client.query('ROLLBACK');
        console.error(`Error processing return ${legion.id}:`, err);
      }
    }
  } finally {
    client.release();
  }
}

// Process a single arrived legion based on mission type
async function processLegion(legion, client) {
  switch (legion.mission) {
    case 'attaque':
    case 'farming':
      await processAttack(legion, client);
      break;
    case 'espionnage':
      await processEspionage(legion, client);
      break;
    case 'transport':
      await processTransport(legion, client);
      break;
    case 'colonisation':
      await processColonisation(legion, client);
      break;
    case 'defense_alliee':
      await processDefenseAlliee(legion, client);
      break;
    default:
      console.warn(`Unknown mission: ${legion.mission}`);
  }
}

// ── ATTACK / FARMING ──
async function processAttack(legion, client) {
  const composition = legion.composition;

  // Find target circle at destination
  const targetCircle = await client.query(
    'SELECT c.id, c.player_id, c.name FROM circles c WHERE c.coord_q = $1 AND c.coord_r = $2',
    [legion.to_coord_q, legion.to_coord_r]
  );

  if (targetCircle.rows.length === 0) {
    // No circle at target — empty hex, return immediately
    await setReturn(legion, client, {});
    return;
  }

  const target = targetCircle.rows[0];

  // Get defender units
  const defUnits = await client.query(
    'SELECT type, quantity FROM units WHERE circle_id = $1 AND quantity > 0',
    [target.id]
  );
  const defenderComp = {};
  for (const u of defUnits.rows) {
    defenderComp[u.type] = u.quantity;
  }

  // Get defender wall levels
  const walls = await client.query(
    `SELECT type, level FROM buildings WHERE circle_id = $1 AND type IN ('mur_ames', 'tour_chaos')`,
    [target.id]
  );
  let murLevel = 0, tourLevel = 0;
  for (const w of walls.rows) {
    if (w.type === 'mur_ames') murLevel = w.level;
    if (w.type === 'tour_chaos') tourLevel = w.level;
  }

  const defBonus = wallBonus(murLevel, tourLevel);

  // Resolve combat
  const result = resolveCombat(composition, defenderComp, defBonus);

  // Apply defender losses
  for (const [type, losses] of Object.entries(result.defenderLosses)) {
    if (losses > 0) {
      await client.query(
        'UPDATE units SET quantity = GREATEST(0, quantity - $3) WHERE circle_id = $1 AND type = $2',
        [target.id, type, losses]
      );
    }
  }

  // Calculate plunder if attacker wins
  let plunder = { iron: 0, essence: 0, souls: 0 };
  if (result.attackerWins) {
    // Flush target resources to get current amounts
    await flushResources(target.id, client);
    const targetRes = await client.query(
      'SELECT iron, essence, souls FROM resources WHERE circle_id = $1',
      [target.id]
    );

    // Get crypte level
    const crypte = await client.query(
      `SELECT level FROM buildings WHERE circle_id = $1 AND type = 'crypte_souterraine'`,
      [target.id]
    );
    const crypteLevel = crypte.rows[0]?.level || 0;

    plunder = calculatePlunder(result.plunderCapacity, targetRes.rows[0], crypteLevel);

    // Deduct plundered resources from defender
    if (plunder.iron > 0 || plunder.essence > 0 || plunder.souls > 0) {
      await client.query(
        `UPDATE resources SET
           iron = GREATEST(0, iron - $2),
           essence = GREATEST(0, essence - $3),
           souls = GREATEST(0, souls - $4)
         WHERE circle_id = $1`,
        [target.id, plunder.iron, plunder.essence, plunder.souls]
      );
    }
  }

  // Create battle report
  const outcome = {
    attackerWins: result.attackerWins,
    ratio: result.ratio,
    attackerComp: composition,
    defenderComp,
    attackerLosses: result.attackerLosses,
    defenderLosses: result.defenderLosses,
    attackerSurvivors: result.attackerSurvivors,
    defenderSurvivors: result.defenderSurvivors,
    plunder,
    defenseBonus: defBonus,
    targetName: target.name,
  };

  await client.query(
    'INSERT INTO battle_reports (attacker_id, defender_id, circle_id, outcome) VALUES ($1, $2, $3, $4)',
    [legion.player_id, target.player_id, target.id, JSON.stringify(outcome)]
  );

  // Set return with surviving units and loot
  await setReturn(legion, client, plunder, result.attackerSurvivors);
}

// ── ESPIONAGE ──
async function processEspionage(legion, client) {
  const targetCircle = await client.query(
    'SELECT c.id, c.player_id, c.name FROM circles c WHERE c.coord_q = $1 AND c.coord_r = $2',
    [legion.to_coord_q, legion.to_coord_r]
  );

  if (targetCircle.rows.length === 0) {
    await setReturn(legion, client, {});
    return;
  }

  const target = targetCircle.rows[0];

  // Spy level based on tour_vigie
  const spyTower = await client.query(
    `SELECT level FROM buildings WHERE circle_id = $1 AND type = 'tour_vigie'`,
    [legion.from_circle_id]
  );
  const spyLevel = spyTower.rows[0]?.level || 0;

  // Counter-espionage from defender
  const defTower = await client.query(
    `SELECT level FROM buildings WHERE circle_id = $1 AND type = 'tour_vigie'`,
    [target.id]
  );
  const counterLevel = defTower.rows[0]?.level || 0;

  // Chance of detection: higher counter = more likely to lose spies
  const detectionChance = Math.max(0, (counterLevel - spyLevel) * 0.1);
  const detected = Math.random() < detectionChance;

  // Gather intel based on spy level
  const spyData = {};

  // Level 0+: basic info
  await flushResources(target.id, client);
  const targetRes = await client.query(
    'SELECT iron, essence, souls FROM resources WHERE circle_id = $1',
    [target.id]
  );
  spyData.resources = {
    iron: Math.floor(targetRes.rows[0]?.iron || 0),
    essence: Math.floor(targetRes.rows[0]?.essence || 0),
    souls: Math.floor(targetRes.rows[0]?.souls || 0),
  };
  spyData.playerName = target.name;

  // Level 3+: see buildings
  if (spyLevel >= 3) {
    const buildings = await client.query(
      'SELECT type, level FROM buildings WHERE circle_id = $1 AND level > 0',
      [target.id]
    );
    spyData.buildings = buildings.rows;
  }

  // Level 5+: see units
  if (spyLevel >= 5) {
    const units = await client.query(
      'SELECT type, quantity FROM units WHERE circle_id = $1 AND quantity > 0',
      [target.id]
    );
    spyData.units = units.rows;
  }

  // Level 8+: see researches
  if (spyLevel >= 8) {
    const researches = await client.query(
      'SELECT type, level FROM researches WHERE player_id = $1 AND level > 0',
      [target.player_id]
    );
    spyData.researches = researches.rows;
  }

  // Save spy report
  await client.query(
    'INSERT INTO spy_reports (spy_player_id, target_circle_id, level, data) VALUES ($1, $2, $3, $4)',
    [legion.player_id, target.id, spyLevel, JSON.stringify(spyData)]
  );

  // If detected, lose spies
  if (detected) {
    await setReturn(legion, client, {}, {}); // All units lost
  } else {
    await setReturn(legion, client, {});
  }
}

// ── TRANSPORT ──
async function processTransport(legion, client) {
  // Find allied circle at destination
  const targetCircle = await client.query(
    'SELECT c.id, c.player_id FROM circles c WHERE c.coord_q = $1 AND c.coord_r = $2',
    [legion.to_coord_q, legion.to_coord_r]
  );

  // Loot in composition is transported resources (if any)
  // For now, transport just returns units
  await setReturn(legion, client, {});
}

// ── COLONISATION ──
async function processColonisation(legion, client) {
  // Check if hex is empty (no circle)
  const existing = await client.query(
    'SELECT id FROM circles WHERE coord_q = $1 AND coord_r = $2',
    [legion.to_coord_q, legion.to_coord_r]
  );

  if (existing.rows.length > 0) {
    // Hex occupied — return home
    await setReturn(legion, client, {});
    return;
  }

  // TODO: Create new circle at location (future phase)
  await setReturn(legion, client, {});
}

// ── DEFENSE ALLIEE ──
async function processDefenseAlliee(legion, client) {
  // Station units at allied circle — for now just return
  await setReturn(legion, client, {});
}

// ── Set legion to return status ──
async function setReturn(legion, client, loot, survivingComp) {
  // Calculate return trip time
  const fromCircle = await client.query(
    'SELECT coord_q, coord_r FROM circles WHERE id = $1',
    [legion.from_circle_id]
  );
  const fc = fromCircle.rows[0];
  const distance = hexDistance(fc.coord_q, fc.coord_r, legion.to_coord_q, legion.to_coord_r);

  // Get speed bonus
  const speedRes = await client.query(
    `SELECT level FROM researches WHERE player_id = $1 AND type = 'vitesse_infernale'`,
    [legion.player_id]
  );
  const speedBonus = 1 + 0.10 * (speedRes.rows[0]?.level || 0);
  const returnMs = (distance * SPEED_BASE * 60 * 1000) / speedBonus;
  const returnTime = new Date(Date.now() + returnMs);

  // Update composition to survivors if provided
  const newComp = survivingComp !== undefined ? survivingComp : legion.composition;

  await client.query(
    `UPDATE legions SET
       status = 'retour',
       composition = $2,
       loot = $3,
       return_time = $4
     WHERE id = $1`,
    [legion.id, JSON.stringify(newComp), JSON.stringify(loot || {}), returnTime]
  );
}

// ── Process returning legions ──
async function processReturn(legion, client) {
  const comp = legion.composition || {};
  const loot = legion.loot || {};

  // Return units to origin circle
  for (const [type, qty] of Object.entries(comp)) {
    if (qty > 0) {
      await client.query(
        `INSERT INTO units (circle_id, type, quantity)
         VALUES ($1, $2, $3)
         ON CONFLICT (circle_id, type) DO UPDATE SET quantity = units.quantity + $3`,
        [legion.from_circle_id, type, qty]
      );
    }
  }

  // Deposit plundered resources
  if (loot.iron > 0 || loot.essence > 0 || loot.souls > 0) {
    await client.query(
      `UPDATE resources SET
         iron = LEAST(iron + $2, iron_cap),
         essence = LEAST(essence + $3, essence_cap),
         souls = LEAST(souls + $4, souls_cap)
       WHERE circle_id = $1`,
      [legion.from_circle_id, loot.iron || 0, loot.essence || 0, loot.souls || 0]
    );
  }

  // Delete the legion (mission complete)
  await client.query('DELETE FROM legions WHERE id = $1', [legion.id]);
}

// Start the periodic processor
function startLegionProcessor(intervalMs = 5000) {
  console.log(`Legion processor started (every ${intervalMs}ms)`);
  const timer = setInterval(async () => {
    try {
      await processArrivedLegions();
    } catch (err) {
      console.error('Legion processor error:', err);
    }
  }, intervalMs);
  return timer;
}

module.exports = { processArrivedLegions, startLegionProcessor };
