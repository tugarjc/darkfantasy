import { create } from 'zustand';

// Mock data for Phase 0 — will be replaced by API calls in Phase 1
const MOCK_RESOURCES = {
  iron: 500,
  essence: 300,
  souls: 0,
  iron_rate: 30,
  essence_rate: 20,
  souls_rate: 0,
  iron_cap: 10000,
  essence_cap: 10000,
  souls_cap: 5000,
};

const MOCK_BUILDINGS = [
  { type: 'forge_damnes', level: 1, upgrade_end: null },
  { type: 'sanctuaire_neant', level: 1, upgrade_end: null },
  { type: 'bibliotheque_obscure', level: 1, upgrade_end: null },
  { type: 'mur_ames', level: 0, upgrade_end: null },
  { type: 'entrepot_damnes', level: 1, upgrade_end: null },
];

const BUILDING_NAMES = {
  forge_damnes: 'Forge des Damnés',
  sanctuaire_neant: 'Sanctuaire du Néant',
  puits_ames: 'Puits des Âmes',
  serre_tenebres: 'Serre des Ténèbres',
  mur_ames: 'Mur des Âmes',
  tour_chaos: 'Tour du Chaos',
  portail_invocation: "Portail d'Invocation",
  bouclier_infernal: 'Bouclier Infernal',
  crypte_souterraine: 'Crypte Souterraine',
  caserne_damnes: 'Caserne des Damnés',
  antre_betes: 'Antre des Bêtes',
  forge_ames_liees: 'Forge des Âmes Liées',
  autel_sacrifice: "Autel du Sacrifice",
  bibliotheque_obscure: 'Bibliothèque Obscure',
  tour_vigie: 'Tour de Vigie',
  marche_demoniaque: 'Marché Démoniaque',
  palais_infernal: 'Palais Infernal',
  entrepot_damnes: 'Entrepôt des Damnés',
};

export const useGameStore = create((set) => ({
  circle: { name: 'Cercle Infernal', coord_q: 0, coord_r: 0 },
  resources: { ...MOCK_RESOURCES },
  buildings: [...MOCK_BUILDINGS],
  units: [],

  getBuildingName: (type) => BUILDING_NAMES[type] || type,

  // Simulate resource tick (called every second in the UI)
  tickResources: () => set((state) => {
    const r = state.resources;
    return {
      resources: {
        ...r,
        iron: Math.min(r.iron + r.iron_rate / 3600, r.iron_cap),
        essence: Math.min(r.essence + r.essence_rate / 3600, r.essence_cap),
        souls: Math.min(r.souls + r.souls_rate / 3600, r.souls_cap),
      },
    };
  }),
}));
