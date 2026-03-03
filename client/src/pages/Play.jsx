import { useEffect } from 'react';
import { useAuthStore } from '../stores/authStore';
import { useGameStore } from '../stores/gameStore';
import ResourceBar from '../components/ResourceBar';
import BuildingGrid from '../components/BuildingGrid';

export default function Play() {
  const { player, logout } = useAuthStore();
  const { circle, tickResources } = useGameStore();

  // Tick resources every second
  useEffect(() => {
    const interval = setInterval(tickResources, 1000);
    return () => clearInterval(interval);
  }, [tickResources]);

  return (
    <div className="min-h-screen bg-deep flex flex-col">
      {/* Top bar */}
      <header className="bg-base border-b border-border px-4 py-2 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <h1 className="font-display text-xl text-gold">INFERNO DOMINI</h1>
          <span className="text-muted text-sm">|</span>
          <span className="text-parchment text-sm">{circle.name}</span>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-muted text-sm">{player?.username || 'Seigneur'}</span>
          <button
            onClick={logout}
            className="text-sm text-muted hover:text-blood-glow transition-colors"
          >
            Dconnexion
          </button>
        </div>
      </header>

      {/* Resource bar */}
      <ResourceBar />

      {/* Main content */}
      <main className="flex-1 p-4 md:p-8">
        <div className="max-w-6xl mx-auto">
          <h2 className="font-display text-2xl text-gold mb-6">Structures Infernales</h2>
          <BuildingGrid />
        </div>
      </main>

      {/* Bottom nav (mobile) */}
      <nav className="md:hidden bg-base border-t border-border flex justify-around py-2">
        <NavBtn label="Cercle" active />
        <NavBtn label="Carte" />
        <NavBtn label="Lgions" />
        <NavBtn label="Alliance" />
        <NavBtn label="Profil" />
      </nav>
    </div>
  );
}

function NavBtn({ label, active }) {
  return (
    <button className={`text-xs px-3 py-1 rounded ${active ? 'text-gold bg-surface' : 'text-muted'}`}>
      {label}
    </button>
  );
}
