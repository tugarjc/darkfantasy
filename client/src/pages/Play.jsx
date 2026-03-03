import { useEffect, useState } from 'react';
import { useAuthStore } from '../stores/authStore';
import { useGameStore } from '../stores/gameStore';
import ResourceBar from '../components/ResourceBar';
import BuildingGrid from '../components/BuildingGrid';
import UnitPanel from '../components/UnitPanel';

export default function Play() {
  const { player, logout } = useAuthStore();
  const { circle, loading, loadCircle, loadBuildings, loadUnits, tickResources, error, clearError } = useGameStore();
  const [tab, setTab] = useState('buildings');

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
        <p className="font-display text-xl text-gold animate-pulse">Invocation du Cercle...</p>
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
          <span className="text-parchment text-sm">{circle?.name || 'Cercle'}</span>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-muted text-sm">{player?.username || 'Seigneur'}</span>
          <button onClick={logout} className="text-sm text-muted hover:text-blood-glow transition-colors">
            Deconnexion
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
        <TabBtn label="Structures" active={tab === 'buildings'} onClick={() => setTab('buildings')} />
        <TabBtn label="Legions" active={tab === 'units'} onClick={() => setTab('units')} />
      </div>

      {/* Main content */}
      <main className="flex-1 p-4 md:p-8 overflow-auto">
        <div className="max-w-6xl mx-auto">
          {tab === 'buildings' && <BuildingGrid />}
          {tab === 'units' && <UnitPanel />}
        </div>
      </main>

      {/* Bottom nav (mobile) */}
      <nav className="md:hidden bg-base border-t border-border flex justify-around py-2">
        <NavBtn label="Cercle" active={tab === 'buildings'} onClick={() => setTab('buildings')} />
        <NavBtn label="Legions" active={tab === 'units'} onClick={() => setTab('units')} />
        <NavBtn label="Carte" />
        <NavBtn label="Alliance" />
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
