// ============================================================
// INFERNO DOMINI — Legendary Research Effects
// Definitions + helpers for endgame legendary activations
// ============================================================

const LEGENDARY_EFFECTS = {
  teleportation_infernale: {
    cooldown: 7 * 24 * 3600,  // 7 days
    type: 'instant',
    description: 'Déplace un cercle vers des coordonnées choisies',
  },
  bouclier_absolu: {
    duration: 24 * 3600,      // 24h shield
    cooldown: 7 * 24 * 3600,  // 7 days
    type: 'timed',
    description: 'Bouclier 24h contre toutes les attaques',
  },
  vision_pandemonium: {
    cooldown: 0,
    type: 'passive',
    description: 'Révèle tous les cercles sur la carte',
  },
  portail_permanent: {
    cooldown: 0,
    type: 'passive',
    description: 'Légions instantanées entre vos cercles',
  },
  invocation_primordiale: {
    cooldown: 0,
    type: 'passive',
    description: 'Débloque le Dragon Abyssal',
  },
  economie_absolue: {
    cooldown: 0,
    type: 'passive',
    description: '+50% production toutes ressources',
  },
  drain_dimensionnel: {
    cooldown: 24 * 3600,      // 24h
    type: 'instant',
    description: 'Vole 5% des ressources d\'une cible',
  },
};

// Check if a player has a legendary research at level >= 1
async function hasLegendary(playerId, researchType, db) {
  const r = await db.query(
    'SELECT level FROM researches WHERE player_id = $1 AND type = $2',
    [playerId, researchType]
  );
  return (r.rows[0]?.level || 0) >= 1;
}

// Check if an activation is on cooldown
async function isOnCooldown(playerId, researchType, db) {
  const r = await db.query(
    `SELECT cooldown_end FROM legendary_activations
     WHERE player_id = $1 AND research_type = $2
     ORDER BY activated_at DESC LIMIT 1`,
    [playerId, researchType]
  );
  if (r.rows.length === 0) return false;
  return new Date(r.rows[0].cooldown_end) > new Date();
}

// Check if a timed effect is currently active (e.g., shield)
async function isEffectActive(playerId, researchType, db) {
  const r = await db.query(
    `SELECT expires_at FROM legendary_activations
     WHERE player_id = $1 AND research_type = $2
       AND expires_at > NOW()
     ORDER BY activated_at DESC LIMIT 1`,
    [playerId, researchType]
  );
  return r.rows.length > 0 ? r.rows[0].expires_at : null;
}

// Get activation status for all legendary researches of a player
async function getLegendaryStatus(playerId, db) {
  const researches = await db.query(
    "SELECT type, level FROM researches WHERE player_id = $1 AND type IN ('teleportation_infernale','bouclier_absolu','vision_pandemonium','portail_permanent','invocation_primordiale','economie_absolue','drain_dimensionnel')",
    [playerId]
  );

  const activations = await db.query(
    `SELECT research_type, expires_at, cooldown_end, activated_at
     FROM legendary_activations
     WHERE player_id = $1
     ORDER BY activated_at DESC`,
    [playerId]
  );

  const status = {};
  const now = new Date();

  for (const [type, def] of Object.entries(LEGENDARY_EFFECTS)) {
    const research = researches.rows.find(r => r.type === type);
    const level = research?.level || 0;
    const latestActivation = activations.rows.find(a => a.research_type === type);

    status[type] = {
      level,
      effectType: def.type,
      description: def.description,
      unlocked: level >= 1,
      isActive: false,
      expiresAt: null,
      onCooldown: false,
      cooldownEnd: null,
    };

    if (level >= 1 && def.type === 'passive') {
      status[type].isActive = true;
    }

    if (latestActivation) {
      if (def.type === 'timed' && latestActivation.expires_at && new Date(latestActivation.expires_at) > now) {
        status[type].isActive = true;
        status[type].expiresAt = latestActivation.expires_at;
      }
      if (latestActivation.cooldown_end && new Date(latestActivation.cooldown_end) > now) {
        status[type].onCooldown = true;
        status[type].cooldownEnd = latestActivation.cooldown_end;
      }
    }
  }

  return status;
}

module.exports = { LEGENDARY_EFFECTS, hasLegendary, isOnCooldown, isEffectActive, getLegendaryStatus };
