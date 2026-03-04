import { useState, useEffect, useRef, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import i18n from '../i18n';
import { useGameStore } from '../stores/gameStore';

const HEX_SIZE = 40;
const SQRT3 = Math.sqrt(3);

// Flat-top hex → pixel
function hexToPixel(q, r) {
  const x = HEX_SIZE * (3 / 2) * q;
  const y = HEX_SIZE * ((SQRT3 / 2) * q + SQRT3 * r);
  return { x, y };
}

// Flat-top hex corners
function hexCorners(cx, cy) {
  const pts = [];
  for (let i = 0; i < 6; i++) {
    const angle = (Math.PI / 180) * (60 * i);
    pts.push(`${cx + HEX_SIZE * Math.cos(angle)},${cy + HEX_SIZE * Math.sin(angle)}`);
  }
  return pts.join(' ');
}

const HEX_COLORS = {
  vide: '#0D0D14',
  terre_maudite: '#1A0A0A',
  faille: '#0A0A1A',
  cercle: '#111118',
};

const HEX_STROKES = {
  vide: '#1A1A25',
  terre_maudite: '#3A1515',
  faille: '#15153A',
  cercle: '#C9A84C',
};

function fmtTime(seconds) {
  if (seconds <= 0) return i18n.t('map.arrived');
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

export default function HexMap({ onSelectHex }) {
  const { t } = useTranslation();
  const mapHexes = useGameStore((s) => s.mapHexes);
  const mapLegions = useGameStore((s) => s.mapLegions);
  const mapCenter = useGameStore((s) => s.mapCenter);
  const mapLoading = useGameStore((s) => s.mapLoading);
  const loadMapSector = useGameStore((s) => s.loadMapSector);
  const circle = useGameStore((s) => s.circle);

  const [viewOffset, setViewOffset] = useState({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const [dragStart, setDragStart] = useState(null);
  const [selectedHex, setSelectedHex] = useState(null);
  const [now, setNow] = useState(Date.now());
  const svgRef = useRef(null);

  // Load map centered on player circle
  useEffect(() => {
    if (circle) {
      loadMapSector(circle.coord_q, circle.coord_r, 7);
    }
  }, [circle?.id]);

  // Tick for legion timers
  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, []);

  // Pan handlers
  const handleMouseDown = useCallback((e) => {
    if (e.button !== 0) return;
    setDragging(true);
    setDragStart({ x: e.clientX - viewOffset.x, y: e.clientY - viewOffset.y });
  }, [viewOffset]);

  const handleMouseMove = useCallback((e) => {
    if (!dragging || !dragStart) return;
    setViewOffset({ x: e.clientX - dragStart.x, y: e.clientY - dragStart.y });
  }, [dragging, dragStart]);

  const handleMouseUp = useCallback(() => {
    setDragging(false);
    setDragStart(null);
  }, []);

  // Navigate map by clicking edge arrows
  const navigate = useCallback((dq, dr) => {
    const newQ = mapCenter.q + dq;
    const newR = mapCenter.r + dr;
    loadMapSector(newQ, newR, 7);
    setViewOffset({ x: 0, y: 0 });
  }, [mapCenter, loadMapSector]);

  // Center on home
  const goHome = useCallback(() => {
    if (circle) {
      loadMapSector(circle.coord_q, circle.coord_r, 7);
      setViewOffset({ x: 0, y: 0 });
    }
  }, [circle, loadMapSector]);

  const handleHexClick = useCallback((hex) => {
    setSelectedHex(hex);
    if (onSelectHex) onSelectHex(hex);
  }, [onSelectHex]);

  return (
    <div className="flex flex-col h-full">
      {/* Map controls */}
      <div className="flex items-center gap-2 mb-3 flex-wrap">
        <button onClick={goHome} className="px-3 py-1 text-xs bg-surface border border-border rounded hover:border-gold text-parchment">
          {t('nav.circle')}
        </button>
        <div className="flex gap-1">
          <button onClick={() => navigate(-3, 0)} className="px-2 py-1 text-xs bg-surface border border-border rounded hover:border-gold/50 text-muted">&larr;</button>
          <button onClick={() => navigate(0, -3)} className="px-2 py-1 text-xs bg-surface border border-border rounded hover:border-gold/50 text-muted">&uarr;</button>
          <button onClick={() => navigate(0, 3)} className="px-2 py-1 text-xs bg-surface border border-border rounded hover:border-gold/50 text-muted">&darr;</button>
          <button onClick={() => navigate(3, 0)} className="px-2 py-1 text-xs bg-surface border border-border rounded hover:border-gold/50 text-muted">&rarr;</button>
        </div>
        <span className="text-muted text-xs ml-2">
          {t('map.center')}: ({mapCenter.q}, {mapCenter.r})
        </span>
        {mapLoading && <span className="text-gold text-xs animate-pulse ml-2">{t('common.loading')}</span>}
      </div>

      {/* SVG Map */}
      <div
        className="flex-1 bg-deep border border-border rounded-lg overflow-hidden cursor-grab"
        style={{ minHeight: 400 }}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      >
        <svg
          ref={svgRef}
          width="100%"
          height="100%"
          viewBox="-500 -400 1000 800"
          className="select-none"
        >
          <g transform={`translate(${viewOffset.x / 2}, ${viewOffset.y / 2})`}>
            {/* Hex tiles */}
            {mapHexes.map((hex) => {
              const { x, y } = hexToPixel(hex.q - mapCenter.q, hex.r - mapCenter.r);
              const isSelected = selectedHex?.q === hex.q && selectedHex?.r === hex.r;
              const isOwnCircle = hex.type === 'cercle' && hex.circle?.isOwn;
              const isEnemyCircle = hex.type === 'cercle' && !hex.circle?.isOwn;

              return (
                <g key={`${hex.q},${hex.r}`} onClick={() => handleHexClick(hex)} className="cursor-pointer">
                  {/* Hex shape */}
                  <polygon
                    points={hexCorners(x, y)}
                    fill={isOwnCircle ? '#0A1A0A' : isEnemyCircle ? '#1A0A0A' : HEX_COLORS[hex.type] || HEX_COLORS.vide}
                    stroke={isSelected ? '#C9A84C' : isOwnCircle ? '#3CA66B' : isEnemyCircle ? '#8B1A1A' : HEX_STROKES[hex.type] || HEX_STROKES.vide}
                    strokeWidth={isSelected ? 2.5 : 1}
                    opacity={0.9}
                  />

                  {/* Content */}
                  {hex.type === 'cercle' && hex.circle && (
                    <>
                      <circle cx={x} cy={y - 4} r={8} fill={isOwnCircle ? '#3CA66B' : '#8B1A1A'} opacity={0.6} />
                      <text x={x} y={y - 3} textAnchor="middle" dominantBaseline="middle"
                        fill={isOwnCircle ? '#7FE5A0' : '#E57F7F'} fontSize="8" fontWeight="bold">
                        {isOwnCircle ? '⬡' : '⬢'}
                      </text>
                      <text x={x} y={y + 14} textAnchor="middle" fill="#F0E6D2" fontSize="6.5"
                        className="pointer-events-none">
                        {hex.circle.username?.slice(0, 8)}
                      </text>
                      {hex.circle.alliance && (
                        <text x={x} y={y + 22} textAnchor="middle" fill="#6B2FA0" fontSize="5.5">
                          [{hex.circle.alliance.tag}]
                        </text>
                      )}
                    </>
                  )}

                  {hex.type === 'terre_maudite' && (
                    <text x={x} y={y + 2} textAnchor="middle" dominantBaseline="middle"
                      fill="#5A2020" fontSize="14" opacity={0.6}>
                      ☠
                    </text>
                  )}

                  {hex.type === 'faille' && (
                    <>
                      <text x={x} y={y + 2} textAnchor="middle" dominantBaseline="middle"
                        fill="#4A2FA0" fontSize="14" opacity={0.7}>
                        ◊
                      </text>
                      {hex.event && (
                        <text x={x} y={y + 18} textAnchor="middle" fill="#9B59B6" fontSize="5">
                          {Math.round((hex.event.hpRemaining / hex.event.hpMax) * 100)}%
                        </text>
                      )}
                    </>
                  )}

                  {/* Coordinates (subtle) */}
                  <text x={x} y={y + (hex.type === 'vide' ? 2 : -16)} textAnchor="middle"
                    fill="#333340" fontSize="5" className="pointer-events-none">
                    {hex.q},{hex.r}
                  </text>
                </g>
              );
            })}

            {/* Legion markers */}
            {mapLegions.map((leg) => {
              const { x, y } = hexToPixel(leg.toQ - mapCenter.q, leg.toR - mapCenter.r);
              const remaining = Math.max(0, (new Date(leg.arrivalTime).getTime() - now) / 1000);
              return (
                <g key={leg.id}>
                  <circle cx={x + 15} cy={y - 15} r={5} fill="#C9A84C" opacity={0.8}>
                    <animate attributeName="opacity" values="0.8;0.3;0.8" dur="2s" repeatCount="indefinite" />
                  </circle>
                  <text x={x + 15} y={y - 14} textAnchor="middle" dominantBaseline="middle"
                    fill="#111" fontSize="5" fontWeight="bold">
                    ⚔
                  </text>
                  <text x={x + 15} y={y - 7} textAnchor="middle" fill="#C9A84C" fontSize="4.5">
                    {fmtTime(remaining)}
                  </text>
                </g>
              );
            })}
          </g>
        </svg>
      </div>

      {/* Selected hex info */}
      {selectedHex && (
        <HexInfoPanel hex={selectedHex} onClose={() => setSelectedHex(null)} onSelectHex={onSelectHex} />
      )}
    </div>
  );
}

function HexInfoPanel({ hex, onClose, onSelectHex }) {
  const { t } = useTranslation();
  const typeLabels = {
    vide: t('map.empty_terrain'),
    terre_maudite: t('map.cursed_land'),
    faille: t('map.dimensional_rift'),
    cercle: t('map.circle'),
  };

  return (
    <div className="mt-3 bg-elevated border border-border rounded-lg p-4">
      <div className="flex justify-between items-start">
        <div>
          <h4 className="font-display text-sm text-gold">
            {hex.type === 'cercle' ? hex.circle?.name || hex.circle?.username : typeLabels[hex.type]}
          </h4>
          <p className="text-muted text-xs">{t('map.coordinates')}: ({hex.q}, {hex.r})</p>
        </div>
        <button onClick={onClose} className="text-muted hover:text-parchment">&times;</button>
      </div>

      {hex.type === 'cercle' && hex.circle && (
        <div className="mt-2 text-xs space-y-1">
          <p className="text-parchment">{t('common.lord')}: <span className={hex.circle.isOwn ? 'text-green-400' : 'text-blood-glow'}>{hex.circle.username}</span></p>
          <p className="text-muted">Score: {hex.circle.score?.toLocaleString()}</p>
          {hex.circle.alliance && (
            <p className="text-purple-400">[{hex.circle.alliance.tag}] {hex.circle.alliance.name}</p>
          )}
          {!hex.circle.isOwn && (
            <button
              onClick={() => onSelectHex && onSelectHex(hex)}
              className="mt-2 w-full py-1.5 bg-blood border border-gold/50 text-parchment text-xs rounded hover:bg-blood-light"
            >
              {t('map.send_legion')}
            </button>
          )}
        </div>
      )}

      {hex.type === 'terre_maudite' && (
        <p className="mt-2 text-xs text-muted">{t('map.cursed_land_desc')}</p>
      )}

      {hex.type === 'faille' && hex.event && (
        <div className="mt-2 text-xs space-y-1">
          <p className="text-purple-400">PV: {hex.event.hpRemaining} / {hex.event.hpMax}</p>
          <button className="mt-1 w-full py-1.5 bg-purple-900/50 border border-purple-500/50 text-parchment text-xs rounded hover:bg-purple-900/70">
            {t('map.attack_rift')}
          </button>
        </div>
      )}

      {hex.type === 'vide' && (
        <div className="mt-2">
          <button
            onClick={() => onSelectHex && onSelectHex(hex)}
            className="w-full py-1.5 bg-surface border border-border text-parchment text-xs rounded hover:border-gold/50"
          >
            {t('map.send_legion')}
          </button>
        </div>
      )}
    </div>
  );
}
