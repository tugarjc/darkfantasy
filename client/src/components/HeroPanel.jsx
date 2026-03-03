import { useState, useEffect, useCallback } from 'react';
import { useGameStore } from '../stores/gameStore';

const CATEGORY_META = {
  combat: { label: 'Guerrier', color: '#8B1A1A' },
  special: { label: 'Special', color: '#6B2FA0' },
  economy: { label: 'Economie', color: '#B0592A' },
};

const BONUS_LABELS = {
  attackAll: 'ATK toutes unites',
  attackGround: 'ATK terrestres',
  defenseAll: 'DEF toutes unites',
  plunder: 'Pillage',
  espionage: 'Espionnage',
  lossReduction: 'Reduction pertes',
  wallBonus: 'Murs',
  productionIron: 'Prod. Fer',
  productionEssence: 'Prod. Essence',
  productionSouls: 'Prod. Ames',
  researchSpeed: 'Vitesse recherche',
};

function fmtNum(n) {
  if (n >= 1e6) return (n / 1e6).toFixed(1) + 'M';
  if (n >= 1e3) return (n / 1e3).toFixed(1) + 'K';
  return Math.round(n).toLocaleString('fr-FR');
}

function fmtPct(n) {
  return (n * 100).toFixed(0) + '%';
}

export default function HeroPanel() {
  const heroes = useGameStore((s) => s.heroes);
  const resources = useGameStore((s) => s.resources);
  const heroesLoading = useGameStore((s) => s.heroesLoading);
  const loadHeroes = useGameStore((s) => s.loadHeroes);
  const summonHero = useGameStore((s) => s.summonHero);
  const reviveHero = useGameStore((s) => s.reviveHero);

  const [selected, setSelected] = useState(null);
  const [error, setError] = useState(null);
  const [summoning, setSummoning] = useState(false);

  useEffect(() => {
    loadHeroes();
  }, []);

  const handleSummon = useCallback(async (type) => {
    setError(null);
    setSummoning(true);
    try {
      await summonHero(type);
    } catch (err) {
      setError(err.message);
    } finally {
      setSummoning(false);
    }
  }, [summonHero]);

  const handleRevive = useCallback(async (type) => {
    setError(null);
    try {
      await reviveHero(type);
    } catch (err) {
      setError(err.message);
    }
  }, [reviveHero]);

  const owned = heroes.filter((h) => h.owned);
  const available = heroes.filter((h) => !h.owned);
  const selectedHero = heroes.find((h) => h.type === selected);

  return (
    <div>
      <div className="text-center mb-4">
        <h2 className="font-display text-2xl text-gold mb-1">Heros</h2>
        <p className="text-muted text-sm">{owned.length}/6 heros invoques</p>
      </div>

      {error && (
        <div className="bg-blood/20 border border-blood rounded px-3 py-2 text-sm text-blood-glow mb-4 flex justify-between">
          <span>{error}</span>
          <button onClick={() => setError(null)} className="text-muted hover:text-parchment">&times;</button>
        </div>
      )}

      {heroesLoading && <p className="text-gold text-sm animate-pulse mb-4">Chargement...</p>}

      {/* Owned heroes */}
      {owned.length > 0 && (
        <div className="mb-6">
          <h3 className="text-sm text-parchment font-medium mb-3">Vos Heros</h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {owned.map((h) => (
              <HeroCard
                key={h.type}
                hero={h}
                isSelected={selected === h.type}
                onClick={() => setSelected(selected === h.type ? null : h.type)}
              />
            ))}
          </div>
        </div>
      )}

      {/* Available heroes */}
      {available.length > 0 && (
        <div className="mb-6">
          <h3 className="text-sm text-muted font-medium mb-3">Heros Disponibles</h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {available.map((h) => (
              <HeroCard
                key={h.type}
                hero={h}
                isSelected={selected === h.type}
                onClick={() => setSelected(selected === h.type ? null : h.type)}
              />
            ))}
          </div>
        </div>
      )}

      {/* Detail panel */}
      {selectedHero && (
        <HeroDetail
          hero={selectedHero}
          resources={resources}
          onSummon={handleSummon}
          onRevive={handleRevive}
          summoning={summoning}
          onClose={() => setSelected(null)}
        />
      )}
    </div>
  );
}

function HeroCard({ hero: h, isSelected, onClick }) {
  const catMeta = CATEGORY_META[h.category];
  return (
    <div
      onClick={onClick}
      className={`bg-surface border rounded-lg p-3 cursor-pointer transition-all duration-200 ${
        isSelected ? 'border-gold shadow-[0_0_10px_rgba(201,168,76,0.2)]' :
        h.isDead ? 'border-blood/50 opacity-60' :
        h.owned ? 'border-border hover:border-gold/50' : 'border-border opacity-70 hover:border-gold/30'
      }`}
    >
      <div className="flex items-center gap-2 mb-2">
        <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-display"
          style={{ backgroundColor: (catMeta?.color || '#666') + '30', color: catMeta?.color }}>
          {h.name[0]}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-medium text-parchment truncate">{h.name}</p>
          <p className="text-[10px] text-muted truncate">{h.title}</p>
        </div>
      </div>

      {h.owned ? (
        <div className="flex justify-between items-center">
          <span className="text-xs text-muted">Nv.{h.level}</span>
          {h.isDead && <span className="text-[10px] text-blood-glow">Mort</span>}
          {h.isDeployed && !h.isDead && <span className="text-[10px] text-gold">Deploye</span>}
        </div>
      ) : (
        <div className="flex justify-between items-center">
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-base" style={{ color: catMeta?.color }}>
            {catMeta?.label}
          </span>
          {h.canSummon ? (
            <span className="text-[10px] text-green-400">Disponible</span>
          ) : (
            <span className="text-[10px] text-muted">Autel requis</span>
          )}
        </div>
      )}
    </div>
  );
}

function HeroDetail({ hero: h, resources, onSummon, onRevive, summoning, onClose }) {
  const catMeta = CATEGORY_META[h.category];

  const cost = h.summonCost;
  const canAffordSummon = cost && resources && (
    resources.iron >= cost.fer &&
    resources.essence >= cost.essence &&
    resources.souls >= cost.ames
  );

  // Revive cost = 50% of summon
  const reviveCost = cost ? {
    fer: Math.floor(cost.fer * 0.5),
    essence: Math.floor(cost.essence * 0.5),
    ames: Math.floor(cost.ames * 0.5),
  } : null;
  const canAffordRevive = reviveCost && resources && (
    resources.iron >= reviveCost.fer &&
    resources.essence >= reviveCost.essence &&
    resources.souls >= reviveCost.ames
  );

  return (
    <div className="mt-4 bg-elevated border border-border rounded-lg p-6">
      <div className="flex justify-between items-start mb-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-full flex items-center justify-center text-lg font-display"
            style={{ backgroundColor: (catMeta?.color || '#666') + '30', color: catMeta?.color }}>
            {h.name[0]}
          </div>
          <div>
            <h3 className="font-display text-xl" style={{ color: catMeta?.color }}>
              {h.name}
            </h3>
            <p className="text-muted text-sm">{h.title}</p>
            {h.owned && (
              <p className="text-xs text-muted">
                Niveau {h.level} | XP: {h.xp}/{h.xpNext}
              </p>
            )}
          </div>
        </div>
        <button onClick={onClose} className="text-muted hover:text-parchment text-lg">&times;</button>
      </div>

      <p className="text-muted text-xs mb-4">{h.description}</p>

      {/* XP bar (if owned) */}
      {h.owned && h.xpNext && (
        <div className="mb-4">
          <div className="flex justify-between text-xs text-muted mb-1">
            <span>Experience</span>
            <span>{h.xp} / {h.xpNext}</span>
          </div>
          <div className="h-2 bg-base rounded-full overflow-hidden">
            <div className="h-full rounded-full transition-all duration-500"
              style={{
                width: `${Math.min(100, (h.xp / h.xpNext) * 100)}%`,
                backgroundColor: catMeta?.color || '#C9A84C',
              }} />
          </div>
        </div>
      )}

      {/* Bonuses */}
      <div className="mb-4">
        <p className="text-xs text-parchment mb-2">Bonus {h.owned ? `(Nv.${h.level})` : '(Nv.1)'} :</p>
        <div className="grid grid-cols-2 gap-2">
          {Object.entries(h.owned ? h.bonuses : h.bonusesDef).map(([key, value]) => (
            <div key={key} className="bg-base rounded px-2 py-1.5">
              <p className="text-[10px] text-muted">{BONUS_LABELS[key] || key}</p>
              <p className="text-sm text-gold font-medium">
                +{h.owned ? fmtPct(value) : fmtPct(value)}/nv
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* Summon button */}
      {!h.owned && h.canSummon && cost && (
        <div>
          <p className="text-sm text-parchment mb-3">Cout d'invocation :</p>
          <div className="grid grid-cols-3 gap-3 mb-4">
            <CostItem label="Fer" cost={cost.fer} available={resources?.iron} color="text-iron" />
            <CostItem label="Essence" cost={cost.essence} available={resources?.essence} color="text-essence" />
            <CostItem label="Ames" cost={cost.ames} available={resources?.souls} color="text-souls" />
          </div>
          <button
            onClick={() => onSummon(h.type)}
            disabled={!canAffordSummon || summoning}
            className={`w-full py-2.5 rounded font-display text-base transition-all duration-300 ${
              canAffordSummon && !summoning
                ? 'bg-blood border border-gold text-parchment hover:bg-blood-light hover:shadow-[0_0_15px_rgba(139,26,26,0.4)]'
                : 'bg-base border border-border text-muted cursor-not-allowed'
            }`}
          >
            {summoning ? 'Invocation...' : canAffordSummon ? 'Invoquer' : 'Ressources insuffisantes'}
          </button>
        </div>
      )}

      {!h.owned && !h.canSummon && (
        <p className="text-muted text-sm text-center">Construisez l'Autel du Sacrifice pour invoquer ce heros</p>
      )}

      {/* Revive button */}
      {h.owned && h.isDead && reviveCost && (
        <div>
          <p className="text-sm text-blood-glow mb-3">Ce heros est mort. Cout de resurrection :</p>
          <div className="grid grid-cols-3 gap-3 mb-4">
            <CostItem label="Fer" cost={reviveCost.fer} available={resources?.iron} color="text-iron" />
            <CostItem label="Essence" cost={reviveCost.essence} available={resources?.essence} color="text-essence" />
            <CostItem label="Ames" cost={reviveCost.ames} available={resources?.souls} color="text-souls" />
          </div>
          <button
            onClick={() => onRevive(h.type)}
            disabled={!canAffordRevive}
            className={`w-full py-2.5 rounded font-display text-base transition-all duration-300 ${
              canAffordRevive
                ? 'bg-blood border border-gold text-parchment hover:bg-blood-light hover:shadow-[0_0_15px_rgba(139,26,26,0.4)]'
                : 'bg-base border border-border text-muted cursor-not-allowed'
            }`}
          >
            {canAffordRevive ? 'Ressusciter' : 'Ressources insuffisantes'}
          </button>
        </div>
      )}

      {h.owned && !h.isDead && !h.isDeployed && (
        <p className="text-green-400 text-sm text-center">Pret au combat — Deployez-le avec une legion depuis l'onglet Carte</p>
      )}

      {h.owned && h.isDeployed && (
        <p className="text-gold text-sm text-center">Actuellement deploye avec une legion</p>
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
