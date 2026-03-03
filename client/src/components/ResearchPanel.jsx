import { useState, useEffect, useCallback } from 'react';
import { useGameStore } from '../stores/gameStore';

const CATEGORY_META = {
  production: { label: 'Forge Infernale', color: '#B0592A', icon: '⚒' },
  combat: { label: 'Arts Martiaux', color: '#8B1A1A', icon: '⚔' },
  mobility: { label: 'Propulsion', color: '#3CA66B', icon: '🌀' },
  special: { label: 'Occultisme', color: '#6B2FA0', icon: '👁' },
  legendary: { label: 'Arcanes Legendaires', color: '#C9A84C', icon: '✦' },
};

function fmtNum(n) {
  if (n >= 1e6) return (n / 1e6).toFixed(1) + 'M';
  if (n >= 1e3) return (n / 1e3).toFixed(1) + 'K';
  return Math.round(n).toLocaleString('fr-FR');
}

function fmtTime(seconds) {
  if (seconds <= 0) return 'Termine';
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (d > 0) return `${d}j ${h}h ${m}m`;
  if (h > 0) return `${h}h ${m}m ${s}s`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

export default function ResearchPanel() {
  const researches = useGameStore((s) => s.researches);
  const resources = useGameStore((s) => s.resources);
  const researchLoading = useGameStore((s) => s.researchLoading);
  const loadResearches = useGameStore((s) => s.loadResearches);
  const startResearch = useGameStore((s) => s.startResearch);
  const completeResearch = useGameStore((s) => s.completeResearch);

  const [selectedCategory, setSelectedCategory] = useState('production');
  const [selected, setSelected] = useState(null);
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    loadResearches();
  }, []);

  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, []);

  // Auto-complete finished researches
  useEffect(() => {
    for (const r of researches) {
      if (r.isResearching && r.researchEnd && new Date(r.researchEnd).getTime() <= now) {
        completeResearch(r.type);
      }
    }
  }, [now, researches]);

  const handleStart = useCallback(async (type) => {
    try {
      await startResearch(type);
    } catch { /* error handled in store */ }
  }, [startResearch]);

  // Currently researching
  const activeResearch = researches.find((r) => r.isResearching && r.researchEnd && new Date(r.researchEnd).getTime() > now);

  // Group by category
  const categories = {};
  for (const r of researches) {
    if (!categories[r.category]) categories[r.category] = [];
    categories[r.category].push(r);
  }

  const filtered = categories[selectedCategory] || [];
  const selectedResearch = researches.find((r) => r.type === selected);

  return (
    <div>
      {/* Active research banner */}
      {activeResearch && (
        <div className="mb-4 bg-elevated border border-gold/30 rounded-lg p-3 flex items-center gap-3">
          <div className="w-10 h-10 rounded-full flex items-center justify-center text-lg"
            style={{ backgroundColor: CATEGORY_META[activeResearch.category]?.color + '30' }}>
            {CATEGORY_META[activeResearch.category]?.icon}
          </div>
          <div className="flex-1">
            <p className="text-sm text-gold font-medium">
              {activeResearch.name} → Nv.{activeResearch.level + 1}
            </p>
            <p className="text-xs text-muted">En cours de recherche</p>
          </div>
          <p className="text-gold text-sm font-display">
            {fmtTime(Math.max(0, (new Date(activeResearch.researchEnd).getTime() - now) / 1000))}
          </p>
        </div>
      )}

      {/* Category tabs */}
      <div className="flex gap-1 mb-4 flex-wrap">
        {Object.entries(CATEGORY_META).map(([key, meta]) => (
          <button
            key={key}
            onClick={() => { setSelectedCategory(key); setSelected(null); }}
            className={`px-3 py-1.5 text-xs rounded border transition-colors ${
              selectedCategory === key
                ? 'border-gold text-gold bg-gold/10'
                : 'border-border text-muted hover:text-parchment hover:border-gold/30'
            }`}
          >
            {meta.icon} {meta.label}
          </button>
        ))}
      </div>

      {researchLoading && <p className="text-gold text-sm animate-pulse mb-4">Chargement...</p>}

      {/* Research grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
        {filtered.map((r) => {
          const isResearching = r.isResearching && r.researchEnd && new Date(r.researchEnd).getTime() > now;
          const remaining = isResearching ? Math.max(0, (new Date(r.researchEnd).getTime() - now) / 1000) : 0;
          const meta = CATEGORY_META[r.category];
          const isSelected = selected === r.type;

          return (
            <div
              key={r.type}
              onClick={() => setSelected(isSelected ? null : r.type)}
              className={`bg-surface border rounded-lg p-3 cursor-pointer transition-all duration-200 ${
                isSelected ? 'border-gold shadow-[0_0_10px_rgba(201,168,76,0.2)]' :
                r.prereqsMet ? 'border-border hover:border-gold/50' : 'border-border opacity-50'
              }`}
            >
              <div className="flex items-center gap-2 mb-2">
                <span className="text-sm" style={{ color: meta?.color }}>{meta?.icon}</span>
                <span className="text-xs font-medium text-parchment truncate">{r.name}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-xs text-muted">
                  Nv.{r.level}{r.isMaxed ? ' (MAX)' : ` / ${r.maxLevel}`}
                </span>
                {isResearching && (
                  <span className="text-[10px] text-gold animate-pulse">{fmtTime(remaining)}</span>
                )}
              </div>
              {!r.prereqsMet && !r.isMaxed && (
                <p className="text-[10px] text-blood-light mt-1">Prerequis manquants</p>
              )}
            </div>
          );
        })}
      </div>

      {/* Detail panel */}
      {selectedResearch && (
        <ResearchDetail
          research={selectedResearch}
          resources={resources}
          now={now}
          activeResearch={activeResearch}
          onStart={handleStart}
          onClose={() => setSelected(null)}
        />
      )}
    </div>
  );
}

function ResearchDetail({ research: r, resources, now, activeResearch, onStart, onClose }) {
  const meta = CATEGORY_META[r.category];
  const isResearching = r.isResearching && r.researchEnd && new Date(r.researchEnd).getTime() > now;
  const remaining = isResearching ? Math.max(0, (new Date(r.researchEnd).getTime() - now) / 1000) : 0;
  const next = r.nextLevel;

  const canAfford = next && resources && (
    resources.iron >= next.costFer &&
    resources.essence >= next.costEssence &&
    resources.souls >= next.costAmes
  );

  const canStart = canAfford && r.prereqsMet && !activeResearch;

  return (
    <div className="mt-4 bg-elevated border border-border rounded-lg p-6">
      <div className="flex justify-between items-start mb-4">
        <div>
          <h3 className="font-display text-xl" style={{ color: meta?.color }}>
            {r.name}
          </h3>
          <p className="text-muted text-sm">
            Niveau {r.level}{r.isMaxed ? ' (MAX)' : ` / ${r.maxLevel}`}
          </p>
          <p className="text-muted text-xs mt-1">{r.description}</p>
        </div>
        <button onClick={onClose} className="text-muted hover:text-parchment text-lg">&times;</button>
      </div>

      {/* Prerequisites */}
      {r.prerequisites.length > 0 && (
        <div className="mb-4">
          <p className="text-xs text-muted mb-1">Prerequis :</p>
          <div className="flex flex-wrap gap-1">
            {r.prerequisites.map((p, i) => (
              <span key={i} className={`text-[10px] px-2 py-0.5 rounded ${p.met ? 'bg-green-900/30 text-green-400' : 'bg-blood/20 text-blood-glow'}`}>
                {p.key} Nv.{p.need} {p.met ? '✓' : `(${p.have})`}
              </span>
            ))}
          </div>
        </div>
      )}

      {isResearching && (
        <div className="mb-4">
          <div className="flex justify-between text-sm mb-1">
            <span className="text-gold">En recherche → Nv.{r.level + 1}</span>
            <span className="text-gold">{fmtTime(remaining)}</span>
          </div>
          <div className="h-2 bg-base rounded-full overflow-hidden">
            <div className="h-full bg-gold/60 rounded-full transition-all duration-1000 animate-pulse"
              style={{ width: '60%' }} />
          </div>
        </div>
      )}

      {next && !isResearching && (
        <div>
          <p className="text-sm text-parchment mb-3">
            Recherche niveau {next.level} ({fmtTime(next.time)}) :
          </p>
          <div className="grid grid-cols-3 gap-3 mb-4">
            <CostItem label="Fer" cost={next.costFer} available={resources?.iron} color="text-iron" />
            <CostItem label="Essence" cost={next.costEssence} available={resources?.essence} color="text-essence" />
            <CostItem label="Ames" cost={next.costAmes} available={resources?.souls} color="text-souls" />
          </div>

          {activeResearch && !isResearching && (
            <p className="text-xs text-gold mb-2 text-center">Une recherche est deja en cours</p>
          )}

          <button
            onClick={() => onStart(r.type)}
            disabled={!canStart}
            className={`w-full py-2.5 rounded font-display text-base transition-all duration-300 ${
              canStart
                ? 'bg-blood border border-gold text-parchment hover:bg-blood-light hover:shadow-[0_0_15px_rgba(139,26,26,0.4)]'
                : 'bg-base border border-border text-muted cursor-not-allowed'
            }`}
          >
            {!r.prereqsMet ? 'Prerequis manquants' :
             activeResearch ? 'Recherche en cours...' :
             canAfford ? 'Rechercher' : 'Ressources insuffisantes'}
          </button>
        </div>
      )}

      {r.isMaxed && !isResearching && (
        <p className="text-gold text-sm text-center">Recherche au niveau maximum</p>
      )}
    </div>
  );
}

function CostItem({ label, cost, available, color }) {
  if (!cost) return <div />;
  const enough = (available || 0) >= cost;
  return (
    <div className={`text-center p-2 rounded bg-base ${enough ? '' : 'border border-blood/30'}`}>
      <p className={`text-xs ${color}`}>{label}</p>
      <p className={`text-sm font-medium ${enough ? 'text-parchment' : 'text-blood-glow'}`}>
        {fmtNum(cost)}
      </p>
      <p className="text-[10px] text-muted">{fmtNum(available || 0)}</p>
    </div>
  );
}
