import { useState, useEffect, useCallback } from 'react';
import { useGameStore } from '../stores/gameStore';

const BUILDING_ICONS = {
  forge_damnes: { color: '#B0592A', letter: 'F' },
  sanctuaire_neant: { color: '#6B2FA0', letter: 'S' },
  puits_ames: { color: '#3CA66B', letter: 'P' },
  serre_tenebres: { color: '#4A6B3A', letter: 'T' },
  mur_ames: { color: '#6B6B6B', letter: 'M' },
  tour_chaos: { color: '#8B1A1A', letter: 'C' },
  portail_invocation: { color: '#9B59B6', letter: 'I' },
  bouclier_infernal: { color: '#C9A84C', letter: 'B' },
  crypte_souterraine: { color: '#4A4A5A', letter: 'Cr' },
  caserne_damnes: { color: '#8B4513', letter: 'Ca' },
  antre_betes: { color: '#5A3A5A', letter: 'A' },
  forge_ames_liees: { color: '#8B3A6B', letter: 'FL' },
  autel_sacrifice: { color: '#B22222', letter: 'Au' },
  bibliotheque_obscure: { color: '#3A4A6B', letter: 'Bi' },
  tour_vigie: { color: '#5A6B5A', letter: 'V' },
  marche_demoniaque: { color: '#6B5A3A', letter: 'Ma' },
  palais_infernal: { color: '#8B6B2A', letter: 'Pa' },
  entrepot_damnes: { color: '#5A4A3A', letter: 'E' },
};

function fmtNum(n) {
  if (n >= 1e6) return (n / 1e6).toFixed(1) + 'M';
  if (n >= 1e3) return (n / 1e3).toFixed(1) + 'K';
  return Math.round(n).toLocaleString('fr-FR');
}

function fmtTime(seconds) {
  if (seconds <= 0) return 'Termine';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0) return `${h}h ${m}m ${s}s`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

export default function BuildingGrid() {
  const buildings = useGameStore((s) => s.buildings);
  const resources = useGameStore((s) => s.resources);
  const upgradeBuilding = useGameStore((s) => s.upgradeBuilding);
  const completeBuilding = useGameStore((s) => s.completeBuilding);
  const [selected, setSelected] = useState(null);
  const [now, setNow] = useState(Date.now());

  // Tick timer every second
  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, []);

  // Auto-complete finished buildings
  useEffect(() => {
    for (const b of buildings) {
      if (b.upgrade_end && new Date(b.upgrade_end).getTime() <= now && b.isUpgrading !== false) {
        completeBuilding(b.type);
      }
    }
  }, [now, buildings]);

  const handleUpgrade = useCallback(async (type) => {
    try {
      await upgradeBuilding(type);
    } catch { /* error handled in store */ }
  }, [upgradeBuilding]);

  const selectedBuilding = buildings.find((b) => b.type === selected);

  return (
    <div>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
        {buildings.map((b) => {
          const icon = BUILDING_ICONS[b.type] || { color: '#555', letter: '?' };
          const isUpgrading = b.upgrade_end && new Date(b.upgrade_end).getTime() > now;
          const remaining = isUpgrading ? Math.max(0, (new Date(b.upgrade_end).getTime() - now) / 1000) : 0;
          const isSelected = selected === b.type;

          return (
            <div
              key={b.type}
              onClick={() => setSelected(isSelected ? null : b.type)}
              className={`bg-surface border rounded-lg p-4 cursor-pointer group transition-all duration-200 ${
                isSelected ? 'border-gold shadow-[0_0_12px_rgba(201,168,76,0.3)]' : 'border-border hover:border-gold/50'
              }`}
            >
              <svg viewBox="0 0 80 80" className="w-14 h-14 mx-auto mb-2">
                <polygon
                  points="40,4 72,20 72,56 40,72 8,56 8,20"
                  fill="#111118" stroke={icon.color} strokeWidth="2"
                  className="group-hover:stroke-gold transition-colors"
                />
                <circle cx="40" cy="36" r="14" fill={icon.color} opacity="0.3" />
                <text x="40" y="34" textAnchor="middle" dominantBaseline="middle"
                  fill={icon.color} fontSize="14" fontFamily="serif" fontWeight="bold">
                  {icon.letter}
                </text>
                <text x="40" y="52" textAnchor="middle" fill="#F0E6D2" fontSize="11" fontFamily="sans-serif">
                  Nv.{b.level}
                </text>
                {isUpgrading && (
                  <circle cx="64" cy="12" r="6" fill="#C9A84C">
                    <animate attributeName="opacity" values="1;0.4;1" dur="1.5s" repeatCount="indefinite" />
                  </circle>
                )}
              </svg>

              <p className="text-center text-xs text-parchment font-medium truncate">
                {b.name || b.type}
              </p>

              {isUpgrading && (
                <p className="text-center text-xs text-gold mt-1">{fmtTime(remaining)}</p>
              )}
            </div>
          );
        })}
      </div>

      {/* Detail panel */}
      {selectedBuilding && (
        <BuildingDetail
          building={selectedBuilding}
          resources={resources}
          now={now}
          onUpgrade={handleUpgrade}
          onClose={() => setSelected(null)}
        />
      )}
    </div>
  );
}

function BuildingDetail({ building: b, resources, now, onUpgrade, onClose }) {
  const icon = BUILDING_ICONS[b.type] || { color: '#555' };
  const isUpgrading = b.upgrade_end && new Date(b.upgrade_end).getTime() > now;
  const remaining = isUpgrading ? Math.max(0, (new Date(b.upgrade_end).getTime() - now) / 1000) : 0;
  const next = b.nextLevel;

  const canAfford = next && resources && (
    resources.iron >= next.costFer &&
    resources.essence >= next.costEssence &&
    resources.souls >= next.costAmes
  );

  return (
    <div className="mt-6 bg-elevated border border-border rounded-lg p-6">
      <div className="flex justify-between items-start mb-4">
        <div>
          <h3 className="font-display text-xl" style={{ color: icon.color }}>
            {b.name || b.type}
          </h3>
          <p className="text-muted text-sm">
            Niveau {b.level}{b.isMaxed ? ' (MAX)' : ` / ${b.maxLevel}`}
          </p>
        </div>
        <button onClick={onClose} className="text-muted hover:text-parchment text-lg">&times;</button>
      </div>

      {isUpgrading && (
        <div className="mb-4">
          <div className="flex justify-between text-sm mb-1">
            <span className="text-gold">En construction → Nv.{b.level + 1}</span>
            <span className="text-gold">{fmtTime(remaining)}</span>
          </div>
          <div className="h-2 bg-base rounded-full overflow-hidden">
            <div className="h-full bg-gold/60 rounded-full transition-all duration-1000 animate-pulse"
                 style={{ width: '60%' }} />
          </div>
        </div>
      )}

      {next && !isUpgrading && (
        <div>
          <p className="text-sm text-parchment mb-3">Amelioration vers niveau {next.level} :</p>
          <div className="grid grid-cols-3 gap-3 mb-4">
            <CostItem label="Fer" cost={next.costFer} available={resources?.iron} color="text-iron" />
            <CostItem label="Essence" cost={next.costEssence} available={resources?.essence} color="text-essence" />
            <CostItem label="Ames" cost={next.costAmes} available={resources?.souls} color="text-souls" />
          </div>
          <button
            onClick={() => onUpgrade(b.type)}
            disabled={!canAfford}
            className={`w-full py-2.5 rounded font-display text-base transition-all duration-300 ${
              canAfford
                ? 'bg-blood border border-gold text-parchment hover:bg-blood-light hover:shadow-[0_0_15px_rgba(139,26,26,0.4)]'
                : 'bg-base border border-border text-muted cursor-not-allowed'
            }`}
          >
            {canAfford ? 'Ameliorer' : 'Ressources insuffisantes'}
          </button>
        </div>
      )}

      {b.isMaxed && !isUpgrading && (
        <p className="text-gold text-sm text-center">Structure au niveau maximum</p>
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
