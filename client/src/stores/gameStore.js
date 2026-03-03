import { create } from 'zustand';

const API = '/api';

function authHeaders() {
  const token = localStorage.getItem('accessToken');
  return { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
}

export const useGameStore = create((set, get) => ({
  circleId: null,
  circle: null,
  resources: null,
  buildings: [],
  units: [],
  loading: false,
  error: null,

  // ── Load circle data from API ──
  loadCircle: async () => {
    set({ loading: true, error: null });
    try {
      // Get player's circles
      const listRes = await fetch(`${API}/circles`, { headers: authHeaders() });
      const listData = await listRes.json();
      if (!listRes.ok) throw new Error(listData.error);

      const primary = listData.circles.find((c) => c.is_primary) || listData.circles[0];
      if (!primary) throw new Error('No circle found');

      // Get full circle data
      const detailRes = await fetch(`${API}/circles/${primary.id}`, { headers: authHeaders() });
      const detailData = await detailRes.json();
      if (!detailRes.ok) throw new Error(detailData.error);

      set({
        circleId: primary.id,
        circle: detailData.circle,
        resources: detailData.resources,
        buildings: detailData.buildings,
        units: detailData.units,
        loading: false,
      });
    } catch (err) {
      set({ error: err.message, loading: false });
    }
  },

  // ── Load buildings with costs ──
  loadBuildings: async () => {
    const { circleId } = get();
    if (!circleId) return;
    try {
      const res = await fetch(`${API}/circles/${circleId}/buildings`, { headers: authHeaders() });
      const data = await res.json();
      if (res.ok) set({ buildings: data.buildings });
    } catch { /* silent */ }
  },

  // ── Load units ──
  loadUnits: async () => {
    const { circleId } = get();
    if (!circleId) return;
    try {
      const res = await fetch(`${API}/circles/${circleId}/units`, { headers: authHeaders() });
      const data = await res.json();
      if (res.ok) set({ units: data.units });
    } catch { /* silent */ }
  },

  // ── Upgrade building ──
  upgradeBuilding: async (buildingType) => {
    const { circleId } = get();
    if (!circleId) return;
    try {
      const res = await fetch(`${API}/circles/${circleId}/buildings/upgrade`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ buildingType }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      // Reload circle data
      await get().loadCircle();
      await get().loadBuildings();
      return data;
    } catch (err) {
      set({ error: err.message });
      throw err;
    }
  },

  // ── Complete building upgrade ──
  completeBuilding: async (buildingType) => {
    const { circleId } = get();
    if (!circleId) return;
    try {
      const res = await fetch(`${API}/circles/${circleId}/buildings/complete`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ buildingType }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      await get().loadCircle();
      await get().loadBuildings();
      return data;
    } catch (err) {
      set({ error: err.message });
    }
  },

  // ── Train units ──
  trainUnits: async (unitType, quantity) => {
    const { circleId } = get();
    if (!circleId) return;
    try {
      const res = await fetch(`${API}/circles/${circleId}/units/train`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ unitType, quantity }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      await get().loadCircle();
      await get().loadUnits();
      return data;
    } catch (err) {
      set({ error: err.message });
      throw err;
    }
  },

  // ── Map state ──
  mapHexes: [],
  mapLegions: [],
  mapCenter: { q: 0, r: 0 },
  mapLoading: false,

  loadMapSector: async (q = 0, r = 0, radius = 7) => {
    set({ mapLoading: true });
    try {
      const res = await fetch(`${API}/map/sector?q=${q}&r=${r}&radius=${radius}`, { headers: authHeaders() });
      const data = await res.json();
      if (res.ok) {
        set({ mapHexes: data.hexes, mapLegions: data.legions, mapCenter: data.center, mapLoading: false });
      } else {
        set({ mapLoading: false });
      }
    } catch {
      set({ mapLoading: false });
    }
  },

  // ── Legions state ──
  legions: [],

  loadLegions: async () => {
    try {
      const res = await fetch(`${API}/legions`, { headers: authHeaders() });
      const data = await res.json();
      if (res.ok) set({ legions: data.legions });
    } catch { /* silent */ }
  },

  sendLegion: async (fromCircleId, toQ, toR, mission, units) => {
    try {
      const res = await fetch(`${API}/legions/send`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ fromCircleId, toQ, toR, mission, units }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      await get().loadLegions();
      await get().loadCircle();
      return data;
    } catch (err) {
      set({ error: err.message });
      throw err;
    }
  },

  recallLegion: async (legionId) => {
    try {
      const res = await fetch(`${API}/legions/${legionId}/recall`, {
        method: 'POST',
        headers: authHeaders(),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      await get().loadLegions();
      return data;
    } catch (err) {
      set({ error: err.message });
      throw err;
    }
  },

  // ── Reports state ──
  battleReports: [],
  spyReports: [],
  reportsSummary: null,

  loadBattleReports: async () => {
    try {
      const res = await fetch(`${API}/reports/battles`, { headers: authHeaders() });
      const data = await res.json();
      if (res.ok) set({ battleReports: data.reports });
    } catch { /* silent */ }
  },

  loadSpyReports: async () => {
    try {
      const res = await fetch(`${API}/reports/espionage`, { headers: authHeaders() });
      const data = await res.json();
      if (res.ok) set({ spyReports: data.reports });
    } catch { /* silent */ }
  },

  loadReportsSummary: async () => {
    try {
      const res = await fetch(`${API}/reports/summary`, { headers: authHeaders() });
      const data = await res.json();
      if (res.ok) set({ reportsSummary: data });
    } catch { /* silent */ }
  },

  // ── Tick resources locally (visual interpolation) ──
  tickResources: () => set((state) => {
    if (!state.resources) return {};
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

  clearError: () => set({ error: null }),
}));
