import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '../stores/authStore';
import { useGameStore } from '../stores/gameStore';
import { useAudioStore } from '../stores/audioStore';
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
import SeasonPanel from '../components/SeasonPanel';
import ToastContainer from '../components/ui/Toast';
import LeaderboardPanel from '../components/LeaderboardPanel';
import StorePanel from '../components/StorePanel';
import MobileBottomBar from '../components/MobileBottomBar';
import AudioSettings from '../components/AudioSettings';
import AccountSettings from '../components/AccountSettings';

export default function Play() {
  const { t, i18n } = useTranslation();
  const { player, logout } = useAuthStore();
  const { circle, circles, loading, loadCircle, loadBuildings, loadUnits, switchCircle, tickResources, error, clearError } = useGameStore();
  const initAudio = useAudioStore((s) => s.init);
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

  // Init audio on first user interaction
  useEffect(() => {
    const handler = () => { initAudio(); window.removeEventListener('click', handler); };
    window.addEventListener('click', handler);
    return () => window.removeEventListener('click', handler);
  }, [initAudio]);

  if (loading && !circle) {
    return (
      <div className="min-h-screen bg-deep flex items-center justify-center">
        <p className="font-display text-xl text-gold animate-pulse">{t('play.summoning_circle')}</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-deep flex flex-col">
      {/* Skip navigation link */}
      <a href="#main-content" className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:bg-gold focus:text-deep focus:px-4 focus:py-2 focus:text-sm">
        {t('a11y.skip_to_content')}
      </a>

      {/* Top bar */}
      <header className="bg-base border-b border-border px-3 md:px-4 py-2 flex items-center justify-between" role="banner">
        <div className="flex items-center gap-2 md:gap-4">
          <h1 className="font-display text-lg md:text-xl text-gold">
            <span className="hidden md:inline">INFERNO DOMINI</span>
            <span className="md:hidden">ID</span>
          </h1>
          <span className="text-muted text-sm hidden md:inline">|</span>
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
        <div className="flex items-center gap-2 md:gap-4">
          <AudioSettings />
          <span className="text-muted text-sm hidden md:inline">{player?.username || 'Seigneur'}</span>
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
        <div role="alert" className="bg-blood/20 border-b border-blood px-4 py-2 text-sm text-blood-glow flex justify-between">
          <span>{error}</span>
          <button onClick={clearError} className="text-muted hover:text-parchment">&times;</button>
        </div>
      )}

      {/* Toasts */}
      <ToastContainer />

      {/* Tab navigation (desktop) */}
      <div role="tablist" aria-label={t('a11y.main_navigation')} className="hidden md:flex bg-surface border-b border-border px-4 gap-1 overflow-x-auto">
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
        <TabBtn label={t('nav.tutorial')} active={tab === 'tutorial'} onClick={() => setTab('tutorial')} />
        <TabBtn label={t('nav.leaderboard')} active={tab === 'leaderboard'} onClick={() => setTab('leaderboard')} />
        <TabBtn label={t('nav.store')} active={tab === 'store'} onClick={() => setTab('store')} />
        <TabBtn label={t('nav.seasons')} active={tab === 'seasons'} onClick={() => setTab('seasons')} />
        <TabBtn label={t('account.settings')} active={tab === 'account'} onClick={() => setTab('account')} />
        {player?.is_admin && <TabBtn label={t('nav.admin')} active={tab === 'admin'} onClick={() => setTab('admin')} />}
      </div>

      {/* Main content */}
      <main id="main-content" className="flex-1 p-4 md:p-8 overflow-auto pb-24 md:pb-8">
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
          {tab === 'tutorial' && <TutorialPanel />}
          {tab === 'leaderboard' && <LeaderboardPanel />}
          {tab === 'store' && <StorePanel />}
          {tab === 'seasons' && <SeasonPanel />}
          {tab === 'account' && <AccountSettings />}
          {tab === 'admin' && player?.is_admin && <AdminPanel />}
        </div>
      </main>

      {/* Bottom nav (mobile) */}
      <MobileBottomBar currentTab={tab} onTabChange={setTab} isAdmin={player?.is_admin} />
    </div>
  );
}

function TabBtn({ label, active, onClick }) {
  return (
    <button
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
        active ? 'border-gold text-gold' : 'border-transparent text-muted hover:text-parchment'
      }`}
    >
      {label}
    </button>
  );
}

function TutorialPanel() {
  const { t } = useTranslation();
  const [quests, setQuests] = useState([]);
  const [tutorialComplete, setTutorialComplete] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    try {
      const token = localStorage.getItem('accessToken');
      const res = await fetch('/api/tutorial', { headers: { Authorization: `Bearer ${token}` } });
      const data = await res.json();
      if (res.ok) {
        setQuests(data.quests || []);
        setTutorialComplete(data.tutorialComplete || false);
      }
    } catch { /* silent */ }
    setLoading(false);
  };

  const claim = async (questId) => {
    try {
      const token = localStorage.getItem('accessToken');
      const res = await fetch('/api/tutorial/claim', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ questId }),
      });
      if (res.ok) load();
    } catch { /* silent */ }
  };

  useEffect(() => { load(); }, []);

  if (loading) return <p className="text-muted">{t('common.loading')}</p>;

  const chapters = [1, 2, 3];

  return (
    <div>
      <h2 className="font-display text-2xl text-gold mb-4">{t('tutorial.title')}</h2>
      {tutorialComplete && (
        <div className="bg-gold/10 border border-gold rounded p-3 mb-4 text-gold text-sm">
          {t('tutorial.all_complete')}
        </div>
      )}
      {chapters.map((ch) => (
        <div key={ch} className="mb-6">
          <h3 className="font-display text-lg text-parchment mb-2">{t('tutorial.chapter')} {ch}</h3>
          <div className="space-y-2">
            {quests.filter(q => q.chapter === ch).map((q) => (
              <div key={q.id} className={`bg-surface border rounded p-3 flex items-center justify-between ${q.completed ? 'border-gold/30' : 'border-border'}`}>
                <div>
                  <div className="text-sm text-parchment font-medium">{q.name}</div>
                  <div className="text-xs text-muted">{q.description}</div>
                  {!q.completed && q.objective.type !== 'complete_all_previous' && (
                    <div className="mt-1 text-xs text-gold">{t('tutorial.progress')}: {q.progress || 0}/{q.objective.count || q.objective.level || 1}</div>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {q.completed && !q.claimed && (
                    <button onClick={() => claim(q.id)} className="px-3 py-1 bg-blood border border-gold rounded text-xs text-parchment hover:bg-blood-light">
                      {t('tutorial.claim')}
                    </button>
                  )}
                  {q.claimed && <span className="text-xs text-gold">{t('tutorial.claimed')}</span>}
                  {!q.completed && <span className="text-xs text-muted">{t('tutorial.in_progress')}</span>}
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
