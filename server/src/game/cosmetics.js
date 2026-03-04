// ============================================================
// INFERNO DOMINI — Cosmetics, Relic Packs & Subscription
// Definitions for the monetization system (Phase 17)
// ============================================================

const COSMETICS = {
  // Legion skins (color on map)
  legion_flamme:    { type: 'legion_skin', cost: 50,  name: 'Flamme Infernale',    color: '#ff4400' },
  legion_ombre:     { type: 'legion_skin', cost: 50,  name: 'Ombre Spectrale',     color: '#7744bb' },
  legion_sang:      { type: 'legion_skin', cost: 75,  name: 'Pourpre Sanglant',    color: '#cc0033' },
  legion_void:      { type: 'legion_skin', cost: 75,  name: 'Vide Abyssal',        color: '#0044aa' },
  legion_or:        { type: 'legion_skin', cost: 100, name: 'Doré Impérial',       color: '#ffaa00' },

  // Circle borders (aura on hex map)
  circle_feu:       { type: 'circle_border', cost: 75,  name: 'Aura de Feu',       color: '#ff4400' },
  circle_glace:     { type: 'circle_border', cost: 75,  name: 'Aura de Glace',     color: '#44bbff' },
  circle_neant:     { type: 'circle_border', cost: 100, name: 'Aura du Néant',     color: '#7744bb' },
  circle_royal:     { type: 'circle_border', cost: 150, name: 'Aura Royale',       color: '#ffaa00' },

  // Alliance banners
  alliance_cendres: { type: 'alliance_banner', cost: 200, name: 'Bannière des Cendres', color: '#994400' },
  alliance_void:    { type: 'alliance_banner', cost: 200, name: 'Bannière du Vide',     color: '#4400aa' },
  alliance_sang:    { type: 'alliance_banner', cost: 200, name: 'Bannière de Sang',     color: '#cc0033' },
  alliance_or:      { type: 'alliance_banner', cost: 300, name: 'Bannière Impériale',   color: '#ffaa00' },
};

const RELIC_PACKS = {
  novice:   { relics: 100,  price: 499,  currency: 'eur', bonus: 0  },
  disciple: { relics: 550,  price: 1999, currency: 'eur', bonus: 10 },
  seigneur: { relics: 1200, price: 3499, currency: 'eur', bonus: 20 },
  despote:  { relics: 6500, price: 14999, currency: 'eur', bonus: 30 },
};

const SUBSCRIPTION = {
  priceMonthly: 999, // 9.99€
  currency: 'eur',
  benefits: {
    productionBonus: 1.25,
    buildingSpeedBonus: 0.90,
    marketTaxReduction: 0.05,
    marketExtraSlots: 10,
  },
};

module.exports = { COSMETICS, RELIC_PACKS, SUBSCRIPTION };
