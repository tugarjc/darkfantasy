import { useState, useEffect } from 'react';
import { useGameStore } from '../stores/gameStore';

const MISSION_LABELS = {
  attaque: { label: 'Attaque', color: '#8B1A1A', icon: '⚔' },
  espionnage: { label: 'Espionnage', color: '#6B2FA0', icon: '👁' },
  transport: { label: 'Transport', color: '#3CA66B', icon: '📦' },
  colonisation: { label: 'Colonisation', color: '#C9A84C', icon: '🏴' },
  farming: { label: 'Raid', color: '#B0592A', icon: '💀' },
  defense_alliee: { label: 'Defense Alliee', color: '#4A6B8B', icon: '🛡' },
};

function fmtTime(seconds) {
  if (seconds <= 0) return 'Arrive';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0) return `${h}h ${m}m ${s}s`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

export default function LegionPanel({ targetHex, onClearTarget }) {
  const units = useGameStore((s) => s.units);
  const circleId = useGameStore((s) => s.circleId);
  const legions = useGameStore((s) => s.legions);
  const loadLegions = useGameStore((s) => s.loadLegions);
  const sendLegion = useGameStore((s) => s.sendLegion);
  const recallLegion = useGameStore((s) => s.recallLegion);

  const [mission, setMission] = useState('attaque');
  const [composition, setComposition] = useState({});
  const [sending, setSending] = useState(false);
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    loadLegions();
  }, []);

  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, []);

  const availableUnits = units.filter((u) => u.unlocked && u.quantity > 0);

  const updateComp = (type, qty) => {
    const max = units.find((u) => u.type === type)?.quantity || 0;
    const val = Math.max(0, Math.min(qty, max));
    setComposition((prev) => {
      if (val === 0) {
        const { [type]: _, ...rest } = prev;
        return rest;
      }
      return { ...prev, [type]: val };
    });
  };

  const totalUnits = Object.values(composition).reduce((a, b) => a + b, 0);

  const handleSend = async () => {
    if (!targetHex || totalUnits === 0) return;
    setSending(true);
    try {
      await sendLegion(circleId, targetHex.q, targetHex.r, mission, composition);
      setComposition({});
      if (onClearTarget) onClearTarget();
    } catch { /* error handled in store */ }
    setSending(false);
  };

  const handleRecall = async (legionId) => {
    try {
      await recallLegion(legionId);
    } catch { /* error handled in store */ }
  };

  return (
    <div className="space-y-6">
      {/* Send Legion Form */}
      {targetHex && (
        <div className="bg-elevated border border-gold/30 rounded-lg p-4">
          <div className="flex justify-between items-start mb-4">
            <div>
              <h3 className="font-display text-lg text-gold">Envoyer une Legion</h3>
              <p className="text-muted text-xs">
                Destination: ({targetHex.q}, {targetHex.r})
                {targetHex.type === 'cercle' && targetHex.circle && (
                  <span className="text-blood-glow ml-1">- {targetHex.circle.username}</span>
                )}
              </p>
            </div>
            <button onClick={onClearTarget} className="text-muted hover:text-parchment">&times;</button>
          </div>

          {/* Mission type */}
          <div className="mb-4">
            <p className="text-xs text-muted mb-2">Type de mission :</p>
            <div className="flex flex-wrap gap-2">
              {Object.entries(MISSION_LABELS).map(([key, val]) => (
                <button
                  key={key}
                  onClick={() => setMission(key)}
                  className={`px-3 py-1.5 text-xs rounded border transition-colors ${
                    mission === key
                      ? 'border-gold text-gold bg-gold/10'
                      : 'border-border text-muted hover:text-parchment hover:border-gold/30'
                  }`}
                >
                  {val.icon} {val.label}
                </button>
              ))}
            </div>
          </div>

          {/* Unit composition */}
          <div className="mb-4">
            <p className="text-xs text-muted mb-2">Composition ({totalUnits} unites) :</p>
            {availableUnits.length === 0 ? (
              <p className="text-blood-light text-xs">Aucune unite disponible</p>
            ) : (
              <div className="space-y-2">
                {availableUnits.map((u) => (
                  <div key={u.type} className="flex items-center gap-3 bg-base rounded p-2">
                    <span className="text-xs text-parchment w-32 truncate">{u.name}</span>
                    <span className="text-xs text-muted">({u.quantity})</span>
                    <div className="flex items-center gap-1 ml-auto">
                      <button
                        onClick={() => updateComp(u.type, (composition[u.type] || 0) - 10)}
                        className="w-6 h-6 text-xs bg-surface border border-border rounded hover:border-gold/50 text-muted"
                      >
                        -
                      </button>
                      <input
                        type="number"
                        min={0}
                        max={u.quantity}
                        value={composition[u.type] || 0}
                        onChange={(e) => updateComp(u.type, parseInt(e.target.value) || 0)}
                        className="w-16 text-center text-xs bg-deep border border-border rounded py-1 text-parchment"
                      />
                      <button
                        onClick={() => updateComp(u.type, (composition[u.type] || 0) + 10)}
                        className="w-6 h-6 text-xs bg-surface border border-border rounded hover:border-gold/50 text-muted"
                      >
                        +
                      </button>
                      <button
                        onClick={() => updateComp(u.type, u.quantity)}
                        className="px-2 py-0.5 text-[10px] bg-surface border border-border rounded hover:border-gold/50 text-muted"
                      >
                        Max
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Send button */}
          <button
            onClick={handleSend}
            disabled={sending || totalUnits === 0}
            className={`w-full py-2.5 rounded font-display text-base transition-all duration-300 ${
              !sending && totalUnits > 0
                ? 'bg-blood border border-gold text-parchment hover:bg-blood-light hover:shadow-[0_0_15px_rgba(139,26,26,0.4)]'
                : 'bg-base border border-border text-muted cursor-not-allowed'
            }`}
          >
            {sending ? 'Envoi...' : `Envoyer ${totalUnits} unites en ${MISSION_LABELS[mission]?.label}`}
          </button>
        </div>
      )}

      {/* Active Legions */}
      <div>
        <h3 className="font-display text-lg text-gold mb-3">Legions en cours</h3>
        {legions.length === 0 ? (
          <p className="text-muted text-sm text-center py-6 bg-surface rounded-lg border border-border">
            Aucune legion active
          </p>
        ) : (
          <div className="space-y-2">
            {legions.map((leg) => {
              const missionInfo = MISSION_LABELS[leg.mission] || { label: leg.mission, color: '#555', icon: '?' };
              const arrival = leg.status === 'rappel' ? leg.returnTime : leg.arrivalTime;
              const remaining = Math.max(0, (new Date(arrival).getTime() - now) / 1000);
              const totalUnitsInLeg = Object.values(leg.composition || {}).reduce((a, b) => a + b, 0);

              return (
                <div key={leg.id} className="bg-surface border border-border rounded-lg p-3">
                  <div className="flex items-center gap-3">
                    <span className="text-lg">{missionInfo.icon}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-medium" style={{ color: missionInfo.color }}>
                          {missionInfo.label}
                        </span>
                        <span className="text-[10px] text-muted">
                          {leg.status === 'rappel' ? '(Rappel)' : leg.status === 'retour' ? '(Retour)' : ''}
                        </span>
                      </div>
                      <p className="text-[10px] text-muted truncate">
                        {leg.from?.name} → ({leg.to?.q}, {leg.to?.r}) | {totalUnitsInLeg} unites
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-gold">{fmtTime(remaining)}</p>
                      {leg.status === 'en_route' && (
                        <button
                          onClick={() => handleRecall(leg.id)}
                          className="text-[10px] text-muted hover:text-blood-glow mt-0.5"
                        >
                          Rappeler
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
