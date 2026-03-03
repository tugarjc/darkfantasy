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

export default function BuildingGrid() {
  const buildings = useGameStore((s) => s.buildings);
  const getBuildingName = useGameStore((s) => s.getBuildingName);

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
      {buildings.map((b) => {
        const icon = BUILDING_ICONS[b.type] || { color: '#555', letter: '?' };
        const isUpgrading = b.upgrade_end && new Date(b.upgrade_end) > new Date();

        return (
          <div
            key={b.type}
            className="bg-surface border border-border rounded-lg p-4 hover:border-gold/50 transition-colors cursor-pointer group"
          >
            {/* Building SVG icon */}
            <svg viewBox="0 0 80 80" className="w-16 h-16 mx-auto mb-3">
              {/* Hex base */}
              <polygon
                points="40,4 72,20 72,56 40,72 8,56 8,20"
                fill="#111118"
                stroke={icon.color}
                strokeWidth="2"
                className="group-hover:stroke-gold transition-colors"
              />
              {/* Level badge */}
              <circle cx="40" cy="36" r="14" fill={icon.color} opacity="0.3" />
              <text
                x="40" y="34" textAnchor="middle" dominantBaseline="middle"
                fill={icon.color} fontSize="14" fontFamily="serif" fontWeight="bold"
              >
                {icon.letter}
              </text>
              <text
                x="40" y="52" textAnchor="middle"
                fill="#F0E6D2" fontSize="11" fontFamily="sans-serif"
              >
                Nv.{b.level}
              </text>
              {/* Upgrading indicator */}
              {isUpgrading && (
                <circle cx="64" cy="12" r="6" fill="#C9A84C">
                  <animate attributeName="opacity" values="1;0.4;1" dur="1.5s" repeatCount="indefinite" />
                </circle>
              )}
            </svg>

            {/* Name */}
            <p className="text-center text-sm text-parchment font-medium truncate">
              {getBuildingName(b.type)}
            </p>
            <p className="text-center text-xs text-muted mt-1">
              Niveau {b.level}
            </p>

            {isUpgrading && (
              <p className="text-center text-xs text-gold mt-1 animate-pulse">
                En construction...
              </p>
            )}
          </div>
        );
      })}
    </div>
  );
}
