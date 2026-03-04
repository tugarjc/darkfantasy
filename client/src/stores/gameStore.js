import { create } from 'zustand';

const API = '/api';

function authHeaders() {
  const token = localStorage.getItem('accessToken');
  return { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
}

export const useGameStore = create((set, get) => ({
  circleId: null,
  circle: null,
  circles: [], // all player circles
  resources: null,
  buildings: [],
  units: [],
  loading: false,
  error: null,

  // ── Load circle data from API ──
  loadCircle: async (targetCircleId) => {
    set({ loading: true, error: null });
    try {
      // Get player's circles
      const listRes = await fetch(`${API}/circles`, { headers: authHeaders() });
      const listData = await listRes.json();
      if (!listRes.ok) throw new Error(listData.error);

      // Pick target circle, or current, or primary
      const currentId = targetCircleId || get().circleId;
      const selected = (currentId && listData.circles.find((c) => c.id === currentId))
        || listData.circles.find((c) => c.is_primary)
        || listData.circles[0];
      if (!selected) throw new Error('No circle found');

      // Get full circle data
      const detailRes = await fetch(`${API}/circles/${selected.id}`, { headers: authHeaders() });
      const detailData = await detailRes.json();
      if (!detailRes.ok) throw new Error(detailData.error);

      set({
        circleId: selected.id,
        circle: detailData.circle,
        circles: listData.circles,
        resources: detailData.resources,
        buildings: detailData.buildings,
        units: detailData.units,
        loading: false,
      });
    } catch (err) {
      set({ error: err.message, loading: false });
    }
  },

  // ── Switch to another circle ──
  switchCircle: async (circleId) => {
    await get().loadCircle(circleId);
    await get().loadBuildings();
    await get().loadUnits();
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

  // ── Researches state ──
  researches: [],
  researchLoading: false,

  loadResearches: async () => {
    set({ researchLoading: true });
    try {
      const res = await fetch(`${API}/researches`, { headers: authHeaders() });
      const data = await res.json();
      if (res.ok) set({ researches: data.researches, researchLoading: false });
      else set({ researchLoading: false });
    } catch {
      set({ researchLoading: false });
    }
  },

  startResearch: async (researchType) => {
    try {
      const res = await fetch(`${API}/researches/start`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ researchType }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      await get().loadResearches();
      await get().loadCircle();
      return data;
    } catch (err) {
      set({ error: err.message });
      throw err;
    }
  },

  completeResearch: async (researchType) => {
    try {
      const res = await fetch(`${API}/researches/complete`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ researchType }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      await get().loadResearches();
      await get().loadCircle();
      return data;
    } catch (err) {
      set({ error: err.message });
    }
  },

  // ── Alliance state ──
  alliance: null,
  allianceLoading: false,
  allianceSearchResults: [],

  loadAlliance: async () => {
    set({ allianceLoading: true });
    try {
      const res = await fetch(`${API}/alliances/mine`, { headers: authHeaders() });
      const data = await res.json();
      if (res.ok) set({ alliance: data.alliance, allianceLoading: false });
      else set({ allianceLoading: false });
    } catch {
      set({ allianceLoading: false });
    }
  },

  createAlliance: async (name, tag) => {
    const res = await fetch(`${API}/alliances/create`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({ name, tag }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);
    await get().loadAlliance();
    return data;
  },

  searchAlliances: async (q) => {
    try {
      const res = await fetch(`${API}/alliances/search?q=${encodeURIComponent(q)}`, { headers: authHeaders() });
      const data = await res.json();
      if (res.ok) set({ allianceSearchResults: data.alliances });
    } catch { /* silent */ }
  },

  joinAlliance: async (allianceId) => {
    const res = await fetch(`${API}/alliances/${allianceId}/join`, {
      method: 'POST',
      headers: authHeaders(),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);
    await get().loadAlliance();
    return data;
  },

  leaveAlliance: async () => {
    const res = await fetch(`${API}/alliances/leave`, {
      method: 'POST',
      headers: authHeaders(),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);
    set({ alliance: null });
    return data;
  },

  kickMember: async (playerId) => {
    const res = await fetch(`${API}/alliances/kick`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({ playerId }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);
    await get().loadAlliance();
    return data;
  },

  promoteMember: async (playerId, role) => {
    const res = await fetch(`${API}/alliances/promote`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({ playerId, role }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);
    await get().loadAlliance();
    return data;
  },

  setDiplomacy: async (targetAllianceId, status) => {
    const res = await fetch(`${API}/alliances/diplomacy`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({ targetAllianceId, status }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);
    await get().loadAlliance();
    return data;
  },

  // ── Alliance Research ──
  allianceResearches: [],

  loadAllianceResearch: async () => {
    try {
      const res = await fetch(`${API}/alliances/research`, { headers: authHeaders() });
      const data = await res.json();
      if (res.ok) set({ allianceResearches: data.researches || [] });
    } catch { /* silent */ }
  },

  contributeAllianceResearch: async (techType, iron, essence, souls) => {
    const res = await fetch(`${API}/alliances/research/contribute`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({ techType, iron, essence, souls }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);
    await get().loadAllianceResearch();
    await get().loadCircle();
    return data;
  },

  // ── Fortress ──
  fortress: null,

  loadFortress: async () => {
    try {
      const res = await fetch(`${API}/alliances/fortress`, { headers: authHeaders() });
      const data = await res.json();
      if (res.ok) set({ fortress: data.fortress });
    } catch { /* silent */ }
  },

  buildFortress: async (coordQ, coordR) => {
    const res = await fetch(`${API}/alliances/fortress/build`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({ coordQ, coordR }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);
    await get().loadFortress();
    return data;
  },

  declareWar: async (targetAllianceId) => {
    const res = await fetch(`${API}/alliances/war/declare`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({ targetAllianceId }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);
    await get().loadAlliance();
    return data;
  },

  // ── Heroes state ──
  heroes: [],
  heroesLoading: false,

  loadHeroes: async () => {
    set({ heroesLoading: true });
    try {
      const res = await fetch(`${API}/heroes`, { headers: authHeaders() });
      const data = await res.json();
      if (res.ok) set({ heroes: data.heroes, heroesLoading: false });
      else set({ heroesLoading: false });
    } catch {
      set({ heroesLoading: false });
    }
  },

  summonHero: async (heroType) => {
    const res = await fetch(`${API}/heroes/summon`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({ heroType }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);
    await get().loadHeroes();
    await get().loadCircle();
    return data;
  },

  reviveHero: async (heroType) => {
    const res = await fetch(`${API}/heroes/revive`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({ heroType }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);
    await get().loadHeroes();
    await get().loadCircle();
    return data;
  },

  assignHero: async (heroType, legionId) => {
    const res = await fetch(`${API}/heroes/assign`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({ heroType, legionId }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);
    await get().loadHeroes();
    await get().loadLegions();
    return data;
  },

  // ── Market state ──
  marketData: null,
  marketLoading: false,

  loadMarket: async () => {
    set({ marketLoading: true });
    try {
      const res = await fetch(`${API}/market`, { headers: authHeaders() });
      const data = await res.json();
      if (res.ok) set({ marketData: data, marketLoading: false });
      else set({ marketLoading: false });
    } catch {
      set({ marketLoading: false });
    }
  },

  createOffer: async (resourceFrom, resourceTo, amount, ratio, targetUsername) => {
    const res = await fetch(`${API}/market/create`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({ resourceFrom, resourceTo, amount, ratio, targetUsername: targetUsername || undefined }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);
    await get().loadMarket();
    await get().loadCircle();
    return data;
  },

  acceptOffer: async (offerId) => {
    const res = await fetch(`${API}/market/${offerId}/accept`, {
      method: 'POST',
      headers: authHeaders(),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);
    await get().loadMarket();
    await get().loadCircle();
    return data;
  },

  cancelOffer: async (offerId) => {
    const res = await fetch(`${API}/market/${offerId}/cancel`, {
      method: 'POST',
      headers: authHeaders(),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);
    await get().loadMarket();
    await get().loadCircle();
    return data;
  },

  convertMarket: async (resourceFrom, resourceTo, amount) => {
    const res = await fetch(`${API}/market/convert`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({ resourceFrom, resourceTo, amount }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);
    await get().loadMarket();
    await get().loadCircle();
    return data;
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

  // ── Admin state ──
  adminStats: null,
  adminPlayers: null,
  adminPlayerDetail: null,
  adminAudit: null,
  adminLoading: false,

  loadAdminStats: async () => {
    set({ adminLoading: true });
    try {
      const res = await fetch(`${API}/admin/stats`, { headers: authHeaders() });
      const data = await res.json();
      if (res.ok) set({ adminStats: data, adminLoading: false });
      else set({ adminLoading: false });
    } catch {
      set({ adminLoading: false });
    }
  },

  loadAdminPlayers: async (q = '', page = 1) => {
    try {
      const params = new URLSearchParams({ page });
      if (q) params.set('q', q);
      const res = await fetch(`${API}/admin/players?${params}`, { headers: authHeaders() });
      const data = await res.json();
      if (res.ok) set({ adminPlayers: data });
    } catch { /* silent */ }
  },

  loadAdminPlayerDetail: async (playerId) => {
    try {
      const res = await fetch(`${API}/admin/players/${playerId}`, { headers: authHeaders() });
      const data = await res.json();
      if (res.ok) set({ adminPlayerDetail: data });
    } catch { /* silent */ }
  },

  adminBanPlayer: async (playerId, banned) => {
    const res = await fetch(`${API}/admin/players/${playerId}/ban`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({ banned }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);
    return data;
  },

  adminSetResources: async (playerId, resources) => {
    const res = await fetch(`${API}/admin/players/${playerId}/resources`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify(resources),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);
    return data;
  },

  adminAnnounce: async (message) => {
    const res = await fetch(`${API}/admin/announce`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({ message }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);
    return data;
  },

  loadAdminAudit: async (page = 1) => {
    try {
      const res = await fetch(`${API}/admin/audit?page=${page}`, { headers: authHeaders() });
      const data = await res.json();
      if (res.ok) set({ adminAudit: data });
    } catch { /* silent */ }
  },

  // ── Events state ──
  events: [],
  eventDetail: null,
  eventsLoading: false,

  loadEvents: async () => {
    set({ eventsLoading: true });
    try {
      const res = await fetch(`${API}/events`, { headers: authHeaders() });
      const data = await res.json();
      if (res.ok) set({ events: data.events, eventsLoading: false });
      else set({ eventsLoading: false });
    } catch {
      set({ eventsLoading: false });
    }
  },

  loadEventDetail: async (eventId) => {
    try {
      const res = await fetch(`${API}/events/${eventId}`, { headers: authHeaders() });
      const data = await res.json();
      if (res.ok) set({ eventDetail: data });
    } catch { /* silent */ }
  },

  attackEvent: async (eventId, units) => {
    const res = await fetch(`${API}/events/${eventId}/attack`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({ units }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);
    await get().loadEvents();
    await get().loadCircle();
    await get().loadUnits();
    return data;
  },

  // ── Missions state ──
  missionsData: null,
  missionsLoading: false,

  loadMissions: async () => {
    set({ missionsLoading: true });
    try {
      const res = await fetch(`${API}/missions`, { headers: authHeaders() });
      const data = await res.json();
      if (res.ok) set({ missionsData: data, missionsLoading: false });
      else set({ missionsLoading: false });
    } catch {
      set({ missionsLoading: false });
    }
  },

  claimMission: async (index) => {
    const res = await fetch(`${API}/missions/claim`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({ index }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);
    await get().loadMissions();
    await get().loadCircle();
    return data;
  },

  // ── Leaderboard ──
  leaderboard: [],
  leaderboardLoading: false,

  loadLeaderboard: async (type = 'score') => {
    set({ leaderboardLoading: true });
    try {
      const res = await fetch(`${API}/leaderboard?type=${type}`, { headers: authHeaders() });
      const data = await res.json();
      if (res.ok) set({ leaderboard: data.entries || [], leaderboardLoading: false });
      else set({ leaderboardLoading: false });
    } catch {
      set({ leaderboardLoading: false });
    }
  },

  // ── Notifications ──
  notifications: [],
  unreadCount: 0,

  loadNotifications: async () => {
    try {
      const res = await fetch(`${API}/notifications`, { headers: authHeaders() });
      const data = await res.json();
      if (res.ok) set({ notifications: data.notifications || [], unreadCount: data.unreadCount || 0 });
    } catch { /* silent */ }
  },

  markNotificationsRead: async (ids) => {
    try {
      await fetch(`${API}/notifications/read`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ ids }),
      });
      await get().loadNotifications();
    } catch { /* silent */ }
  },

  markAllNotificationsRead: async () => {
    try {
      await fetch(`${API}/notifications/read-all`, {
        method: 'POST',
        headers: authHeaders(),
      });
      await get().loadNotifications();
    } catch { /* silent */ }
  },

  // ── Legendary Activations ──
  legendaryStatus: {},

  loadLegendaryStatus: async () => {
    try {
      const res = await fetch(`${API}/researches/legendary/status`, { headers: authHeaders() });
      const data = await res.json();
      if (res.ok) set({ legendaryStatus: data.status || {} });
    } catch { /* silent */ }
  },

  activateLegendary: async (researchType, extraData = {}) => {
    const res = await fetch(`${API}/researches/activate`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({ researchType, ...extraData }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);
    await get().loadLegendaryStatus();
    await get().loadCircle();
    return data;
  },

  // ── Store / Monetization ──
  storeData: null,
  myCosmetics: [],

  loadStore: async () => {
    try {
      const res = await fetch(`${API}/store`, { headers: authHeaders() });
      if (res.ok) {
        const data = await res.json();
        set({ storeData: data });
      }
    } catch (e) { console.error('loadStore error:', e); }
  },

  loadMyCosmetics: async () => {
    try {
      const res = await fetch(`${API}/store/cosmetics/mine`, { headers: authHeaders() });
      if (res.ok) {
        const data = await res.json();
        set({ myCosmetics: data.cosmetics || [] });
      }
    } catch (e) { console.error('loadMyCosmetics error:', e); }
  },

  purchaseCosmetic: async (cosmeticId) => {
    const res = await fetch(`${API}/store/cosmetics/purchase`, {
      method: 'POST', headers: authHeaders(), body: JSON.stringify({ cosmeticId }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);
    return data;
  },

  equipCosmetic: async (cosmeticId, equipped) => {
    const res = await fetch(`${API}/store/cosmetics/equip`, {
      method: 'POST', headers: authHeaders(), body: JSON.stringify({ cosmeticId, equipped }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);
    return data;
  },

  startCheckout: async (packId) => {
    const res = await fetch(`${API}/store/checkout`, {
      method: 'POST', headers: authHeaders(), body: JSON.stringify({ packId }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);
    if (data.url) window.location.href = data.url;
    return data;
  },

  startSubscription: async () => {
    const res = await fetch(`${API}/store/subscribe`, {
      method: 'POST', headers: authHeaders(),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);
    if (data.url) window.location.href = data.url;
    return data;
  },

  cancelSubscription: async () => {
    const res = await fetch(`${API}/store/cancel-subscription`, {
      method: 'POST', headers: authHeaders(),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);
    return data;
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

  // ── Seasons ──
  seasons: [],
  seasonLeaderboard: [],
  seasonsLoading: false,

  loadSeasons: async () => {
    set({ seasonsLoading: true });
    try {
      const res = await fetch(`${API}/seasons`, { headers: authHeaders() });
      const data = await res.json();
      if (res.ok) set({ seasons: data.seasons || [], seasonsLoading: false });
      else set({ seasonsLoading: false });
    } catch { set({ seasonsLoading: false }); }
  },

  loadSeasonLeaderboard: async (seasonId) => {
    try {
      const res = await fetch(`${API}/seasons/${seasonId}/leaderboard`, { headers: authHeaders() });
      const data = await res.json();
      if (res.ok) set({ seasonLeaderboard: data.entries || [] });
    } catch { /* silent */ }
  },

  // ── Prestige ──
  prestige: null,

  loadPrestige: async () => {
    try {
      const res = await fetch(`${API}/seasons/prestige`, { headers: authHeaders() });
      const data = await res.json();
      if (res.ok) set({ prestige: data });
    } catch { /* silent */ }
  },

  clearError: () => set({ error: null }),
}));
