// ============================================================
// INFERNO DOMINI — Resource Production Engine
// Recalculates rates based on building levels + research
// ============================================================

const { productionRate, storageCap } = require('./formulas');
const { factionProductionBonus } = require('./factions');
const { pool } = require('../db');

const BASE_RATES = { iron: 30, essence: 20, souls: 10 };
const BASE_STORAGE = { iron: 10000, essence: 10000, souls: 5000 };

// Recalculate production rates and storage caps for a circle
// Called after any building upgrade that affects production
async function recalcRates(circleId, client) {
  const db = client || pool;

  // Get all building levels for this circle
  const bResult = await db.query(
    'SELECT type, level FROM buildings WHERE circle_id = $1',
    [circleId]
  );
  const bMap = {};
  for (const b of bResult.rows) bMap[b.type] = b.level;

  const forgeLv = bMap.forge_damnes || 0;
  const sanctLv = bMap.sanctuaire_neant || 0;
  const puitsLv = bMap.puits_ames || 0;
  const serreLv = bMap.serre_tenebres || 0;
  const entrepotLv = bMap.entrepot_damnes || 0;

  // Get research bonuses
  const circleRow = await db.query('SELECT player_id FROM circles WHERE id = $1', [circleId]);
  if (circleRow.rows.length === 0) return;
  const playerId = circleRow.rows[0].player_id;

  // Get player faction + premium for production bonuses
  const playerRow = await db.query('SELECT faction, is_premium FROM players WHERE id = $1', [playerId]);
  const faction = playerRow.rows[0]?.faction || 'none';
  const premiumBonus = playerRow.rows[0]?.is_premium ? 1.25 : 1;

  const rResult = await db.query(
    "SELECT type, level FROM researches WHERE player_id = $1 AND type IN ('metallurgie_maudite', 'extraction_essence', 'recolte_ames', 'entrepot_etendu', 'economie_absolue')",
    [playerId]
  );
  const rMap = {};
  for (const r of rResult.rows) rMap[r.type] = r.level;

  const metalResearch = rMap.metallurgie_maudite || 0;
  const essenceResearch = rMap.extraction_essence || 0;
  const soulsResearch = rMap.recolte_ames || 0;
  const storageResearch = rMap.entrepot_etendu || 0;

  // Legendary economie_absolue: +50% all production
  const ecoAbsBonus = (rMap.economie_absolue || 0) >= 1 ? 1.5 : 1;

  // Serre bonus: +5% per level on all production
  const serreBonus = 1 + 0.05 * serreLv;

  // Calculate rates (per hour) — include faction bonuses + legendary + premium
  const ironRate = productionRate(BASE_RATES.iron, forgeLv)
    * (1 + 0.05 * metalResearch) * serreBonus * factionProductionBonus(faction, 'iron') * ecoAbsBonus * premiumBonus;
  const essenceRate = productionRate(BASE_RATES.essence, sanctLv)
    * (1 + 0.05 * essenceResearch) * serreBonus * factionProductionBonus(faction, 'essence') * ecoAbsBonus * premiumBonus;
  const soulsRate = puitsLv > 0
    ? productionRate(BASE_RATES.souls, puitsLv) * (1 + 0.05 * soulsResearch) * serreBonus * factionProductionBonus(faction, 'souls') * ecoAbsBonus * premiumBonus
    : 0;

  // Storage caps
  const storageBonus = 1 + 0.20 * storageResearch;
  const ironCap = storageCap(BASE_STORAGE.iron, entrepotLv) * storageBonus;
  const essenceCap = storageCap(BASE_STORAGE.essence, entrepotLv) * storageBonus;
  const soulsCap = storageCap(BASE_STORAGE.souls, entrepotLv) * storageBonus;

  await db.query(
    `UPDATE resources SET
       iron_rate = $2, essence_rate = $3, souls_rate = $4,
       iron_cap = $5, essence_cap = $6, souls_cap = $7
     WHERE circle_id = $1`,
    [circleId, ironRate, essenceRate, soulsRate, ironCap, essenceCap, soulsCap]
  );
}

// Flush resources: compute accumulated resources since last update
async function flushResources(circleId, client) {
  const db = client || pool;
  await db.query('SELECT update_resources($1)', [circleId]);
}

module.exports = { recalcRates, flushResources };
