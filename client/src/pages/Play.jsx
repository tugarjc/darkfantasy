import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '../stores/authStore';
import { useGameStore } from '../stores/gameStore';
import ResourceBar from '../components/ResourceBar';
import BuildingGrid from '../components/BuildingGrid';
import UnitPanel from '../components/UnitPanel';
import HexMap from '../components/HexMap';
import LegionPanel from '../components/LegionPanel';
import ReportsPanel from '../components/ReportsPanel';
import ResearchPanel from '../components/ResearchPanel';
import AlliancePanel from '../components/AlliancePanel';
import HeroPanel from '../components/HeroPanel';
import MarketPanel from '../components/MarketPanel';
import ChatPanel from '../components/ChatPanel';
import AdminPanel from '../components/AdminPanel';
import EventPanel from '../components/EventPanel';
import MissionPanel from '../components/MissionPanel';

export default function Play() {
  const { t, i18n } = useTranslation();
  const { player, logout } = useAuthStore();
  const { circle, circles, loading, loadCircle, loadBuildings, loadUnits, switchCircle, tickResources, error, clearError } = useGameStore();
  const [tab, setTab] = useState('buildings');
  const [legionTarget, setLegionTarget] = useState(null);

  // Load data on mount
  useEffect(() => {
    loadCircle().then(() => {
      loadBuildings();
      loadUnits();
    });
  }, []);

  // Tick resources every second
  useEffect(() => {
    const interval = setInterval(tickResources, 1000);
    return () => clearInterval(interval);
  }, [tickResources]);

  if (loading && !circle) {
    return (
      <div className="min-h-screen bg-deep flex items-center justify-center">
        <p className="font-display text-xl text-gold animate-pulse">{t('play.summoning_circle')}</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-deep flex flex-col">
      {/* Top bar */}
      <header className="bg-base border-b border-border px-4 py-2 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <h1 className="font-display text-xl text-gold">INFERNO DOMINI</h1>
          <span className="text-muted text-sm">|</span>
          {circles.length > 1 ? (
            <select
              value={circle?.id || ''}
              onChange={(e) => switchCircle(e.target.value)}
              className="bg-surface border border-border rounded px-2 py-1 text-sm text-parchment outline-none focus:border-gold/50"
            >
              {circles.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} ({c.coord_q},{c.coord_r}){c.is_primary ? ' *' : ''}
                </option>
              ))}
            </select>
          ) : (
            <span className="text-parchment text-sm">{circle?.name || 'Cercle'}</span>
          )}
        </div>
        <div className="flex items-center gap-4">
          <span className="text-muted text-sm">{player?.username || 'Seigneur'}</span>
          <button onClick={() => { const next = i18n.language === 'fr' ? 'en' : 'fr'; i18n.changeLanguage(next); localStorage.setItem('lang', next); }} className="text-xs text-muted hover:text-gold transition-colors px-2">
            {i18n.language === 'fr' ? 'EN' : 'FR'}
          </button>
          <button onClick={logout} className="text-sm text-muted hover:text-blood-glow transition-colors">
            {t('common.disconnection')}
          </button>
        </div>
      </header>

      {/* Resource bar */}
      <ResourceBar />

      {/* Error banner */}
      {error && (
        <div className="bg-blood/20 border-b border-blood px-4 py-2 text-sm text-blood-glow flex justify-between">
          <span>{error}</span>
          <button onClick={clearError} className="text-muted hover:text-parchment">&times;</button>
        </div>
      )}

      {/* Tab navigation */}
      <div className="bg-surface border-b border-border px-4 flex gap-1">
        <TabBtn label={t('nav.structures')} active={tab === 'buildings'} onClick={() => setTab('buildings')} />
        <TabBtn label={t('nav.units')} active={tab === 'units'} onClick={() => setTab('units')} />
        <TabBtn label={t('nav.map')} active={tab === 'map'} onClick={() => setTab('map')} />
        <TabBtn label={t('nav.legions')} active={tab === 'legions'} onClick={() => setTab('legions')} />
        <TabBtn label={t('nav.research')} active={tab === 'research'} onClick={() => setTab('research')} />
        <TabBtn label={t('nav.heroes')} active={tab === 'heroes'} onClick={() => setTab('heroes')} />
        <TabBtn label={t('nav.market')} active={tab === 'market'} onClick={() => setTab('market')} />
        <TabBtn label={t('nav.alliance')} active={tab === 'alliance'} onClick={() => setTab('alliance')} />
        <TabBtn label={t('nav.events')} active={tab === 'events'} onClick={() => setTab('events')} />
        <TabBtn label={t('nav.missions')} active={tab === 'missions'} onClick={() => setTab('missions')} />
        <TabBtn label={t('nav.chat')} active={tab === 'chat'} onClick={() => setTab('chat')} />
        <TabBtn label={t('nav.reports')} active={tab === 'reports'} onClick={() => setTab('reports')} />
        {player?.is_admin && <TabBtn label={t('nav.admin')} active={tab === 'admin'} onClick={() => setTab('admin')} />}
      </div>

      {/* Main content */}
      <main className="flex-1 p-4 md:p-8 overflow-auto">
        <div className="max-w-6xl mx-auto">
          {tab === 'buildings' && <BuildingGrid />}
          {tab === 'units' && <UnitPanel />}
          {tab === 'research' && <ResearchPanel />}
          {tab === 'map' && (
            <div className="flex flex-col lg:flex-row gap-4" style={{ minHeight: 500 }}>
              <div className="flex-1">
                <HexMap onSelectHex={(hex) => {
                  if (hex && !hex.circle?.isOwn) {
                    setLegionTarget(hex);
                  }
                }} />
              </div>
              {legionTarget && (
                <div className="lg:w-96">
                  <LegionPanel targetHex={legionTarget} onClearTarget={() => setLegionTarget(null)} />
                </div>
              )}
            </div>
          )}
          {tab === 'legions' && (
            <LegionPanel targetHex={null} onClearTarget={() => {}} />
          )}
          {tab === 'heroes' && <HeroPanel />}
          {tab === 'market' && <MarketPanel />}
          {tab === 'alliance' && <AlliancePanel />}
          {tab === 'events' && <EventPanel />}
          {tab === 'missions' && <MissionPanel />}
          {tab === 'chat' && <ChatPanel />}
          {tab === 'reports' && <ReportsPanel />}
          {tab === 'admin' && player?.is_admin && <AdminPanel />}
        </div>
      </main>

      {/* Bottom nav (mobile) */}
      <nav className="md:hidden bg-base border-t border-border flex justify-around py-2">
        <NavBtn label={t('nav.circle')} active={tab === 'buildings'} onClick={() => setTab('buildings')} />
        <NavBtn label={t('nav.units')} active={tab === 'units'} onClick={() => setTab('units')} />
        <NavBtn label={t('nav.map')} active={tab === 'map'} onClick={() => setTab('map')} />
        <NavBtn label={t('nav.legions')} active={tab === 'legions'} onClick={() => setTab('legions')} />
        <NavBtn label={t('nav.research')} active={tab === 'research'} onClick={() => setTab('research')} />
        <NavBtn label={t('nav.heroes')} active={tab === 'heroes'} onClick={() => setTab('heroes')} />
        <NavBtn label={t('nav.market')} active={tab === 'market'} onClick={() => setTab('market')} />
        <NavBtn label={t('nav.alliance')} active={tab === 'alliance'} onClick={() => setTab('alliance')} />
        <NavBtn label={t('nav.events')} active={tab === 'events'} onClick={() => setTab('events')} />
        <NavBtn label={t('nav.missions')} active={tab === 'missions'} onClick={() => setTab('missions')} />
        <NavBtn label={t('nav.chat')} active={tab === 'chat'} onClick={() => setTab('chat')} />
        <NavBtn label={t('nav.reports')} active={tab === 'reports'} onClick={() => setTab('reports')} />
        {player?.is_admin && <NavBtn label={t('nav.admin')} active={tab === 'admin'} onClick={() => setTab('admin')} />}
      </nav>
    </div>
  );
}

function TabBtn({ label, active, onClick }) {
  return (
    <button
      onClick={onClick}
      className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
        active ? 'border-gold text-gold' : 'border-transparent text-muted hover:text-parchment'
      }`}
    >
      {label}
    </button>
  );
}

function NavBtn({ label, active, onClick }) {
  return (
    <button
      onClick={onClick}
      className={`text-xs px-3 py-1 rounded ${active ? 'text-gold bg-surface' : 'text-muted'}`}
    >
      {label}
    </button>
  );
}
