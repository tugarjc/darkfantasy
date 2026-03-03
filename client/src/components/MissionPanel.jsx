import { useEffect, useState } from 'react';
import { useGameStore } from '../stores/gameStore';

const MISSION_ICONS = {
  build: 'Batiment',
  build_multi: 'Batiments',
  train: 'Entrainement',
  train_heavy: 'Aerien',
  attack: 'Attaque',
  trade: 'Commerce',
  research: 'Recherche',
  event: 'Evenement',
  chat: 'Social',
  spy: 'Espionnage',
};

export default function MissionPanel() {
  const { missionsData, missionsLoading, loadMissions, claimMission } = useGameStore();
  const [msg, setMsg] = useState('');

  useEffect(() => { loadMissions(); }, []);

  if (missionsLoading && !missionsData) {
    return <p className="text-muted animate-pulse">Chargement des missions...</p>;
  }

  if (!missionsData) return null;

  const { missions, completed, bonuses, bonusClaimed = {} } = missionsData;

  const claim = async (index) => {
    setMsg('');
    try {
      const result = await claimMission(index);
      setMsg(`+${result.reward.iron} Fer, +${result.reward.essence} Ess, +${result.reward.souls} Ames, +${result.reward.score} Score`);
    } catch (err) {
      setMsg(err.message);
    }
  };

  return (
    <div>
      <h2 className="font-display text-2xl text-gold mb-2">Missions Journalieres</h2>
      <p className="text-xs text-muted mb-4">{completed}/5 missions completees</p>

      {msg && <div className="text-sm text-gold bg-gold/10 border border-gold/30 rounded p-2 mb-4">{msg}</div>}

      {/* Mission list */}
      <div className="space-y-2 mb-6">
        {missions.filter(m => typeof m === 'object' && m.type).map((m, i) => (
          <div key={i} className={`flex items-center justify-between p-4 rounded-lg border ${
            m.completed ? 'bg-green-900/10 border-green-800/30' : 'bg-surface border-border'
          }`}>
            <div className="flex items-center gap-3 flex-1">
              <span className="text-xs bg-deep rounded px-2 py-1 text-muted font-medium min-w-[80px] text-center">
                {MISSION_ICONS[m.type] || m.type}
              </span>
              <div>
                <p className="text-sm text-parchment">{m.description}</p>
                <div className="flex items-center gap-2 mt-1">
                  {/* Progress bar */}
                  <div className="w-32 bg-deep rounded-full h-2 overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${m.completed ? 'bg-green-500' : 'bg-gold/60'}`}
                      style={{ width: `${Math.min(100, (m.progress / m.target) * 100)}%` }}
                    />
                  </div>
                  <span className="text-xs text-muted">{m.progress}/{m.target}</span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="text-xs text-muted text-right">
                <div>{m.rewardIron} Fe</div>
                <div>{m.rewardEssence} Es</div>
              </div>
              {m.completed && !m.claimed && (
                <button onClick={() => claim(i)} className="bg-gold/20 text-gold px-3 py-1.5 rounded text-xs hover:bg-gold/30 transition-colors">
                  Reclamer
                </button>
              )}
              {m.claimed && (
                <span className="text-xs text-green-400 px-3 py-1.5">Recu</span>
              )}
              {!m.completed && (
                <span className="text-xs text-muted px-3 py-1.5">En cours</span>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Completion bonuses */}
      <h3 className="font-display text-lg text-parchment mb-3">Bonus de completion</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {Object.entries(bonuses).map(([count, bonus]) => {
          const needed = parseInt(count);
          const unlocked = completed >= needed;
          const claimed = bonusClaimed[`bonus_${count}`];

          return (
            <div key={count} className={`p-4 rounded-lg border ${
              unlocked ? 'bg-gold/5 border-gold/30' : 'bg-surface border-border'
            }`}>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-parchment">{bonus.label}</p>
                  <p className="text-xs text-muted mt-1">
                    +{bonus.iron} Fe, +{bonus.essence} Es, +{bonus.souls} Am, +{bonus.score} Score
                  </p>
                </div>
                {unlocked && !claimed && (
                  <button onClick={() => claim(`bonus_${count}`)} className="bg-gold/20 text-gold px-3 py-1.5 rounded text-xs hover:bg-gold/30 transition-colors">
                    Reclamer
                  </button>
                )}
                {claimed && <span className="text-xs text-green-400">Recu</span>}
                {!unlocked && <span className="text-xs text-muted">{completed}/{needed}</span>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
