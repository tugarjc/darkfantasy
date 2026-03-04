import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useGameStore } from '../stores/gameStore';
import { useToastStore } from './ui/Toast';

const MISSION_ICONS = {
  build: 'missions.types.build',
  build_multi: 'missions.types.build_multi',
  train: 'missions.types.train',
  train_heavy: 'missions.types.train_heavy',
  attack: 'missions.types.attack',
  trade: 'missions.types.trade',
  research: 'missions.types.research',
  event: 'missions.types.event',
  chat: 'missions.types.chat',
  spy: 'missions.types.spy',
};

export default function MissionPanel() {
  const { t } = useTranslation();
  const { missionsData, missionsLoading, loadMissions, claimMission } = useGameStore();
  const addToast = useToastStore((s) => s.addToast);

  useEffect(() => { loadMissions(); }, []);

  if (missionsLoading && !missionsData) {
    return <p className="text-muted animate-pulse">{t('common.loading')}</p>;
  }

  if (!missionsData) return null;

  const { missions, completed, bonuses, bonusClaimed = {} } = missionsData;

  const claim = async (index) => {
    try {
      const result = await claimMission(index);
      addToast(`+${result.reward.iron} ${t('common.iron')}, +${result.reward.essence} ${t('common.essence')}, +${result.reward.souls} ${t('common.souls')}`, 'success');
    } catch (err) {
      addToast(err.message, 'error');
    }
  };

  return (
    <div>
      <h2 className="font-display text-2xl text-gold mb-2">{t('missions.title')}</h2>
      <p className="text-xs text-muted mb-4">{t('missions.completed_count', { count: completed })}</p>


      {/* Mission list */}
      <div className="space-y-2 mb-6">
        {missions.filter(m => typeof m === 'object' && m.type).map((m, i) => (
          <div key={i} className={`flex items-center justify-between p-4 rounded-lg border ${
            m.completed ? 'bg-green-900/10 border-green-800/30' : 'bg-surface border-border'
          }`}>
            <div className="flex items-center gap-3 flex-1">
              <span className="text-xs bg-deep rounded px-2 py-1 text-muted font-medium min-w-[80px] text-center">
                {t(MISSION_ICONS[m.type] || m.type)}
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
                  <span className="text-xs text-muted/60">({Math.min(100, Math.round((m.progress / m.target) * 100))}%)</span>
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
                  {t('missions.claim')}
                </button>
              )}
              {m.claimed && (
                <span className="text-xs text-green-400 px-3 py-1.5">{t('missions.claimed')}</span>
              )}
              {!m.completed && (
                <span className="text-xs text-muted px-3 py-1.5">{t('missions.in_progress')}</span>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Completion bonuses */}
      <h3 className="font-display text-lg text-parchment mb-3">{t('missions.completion_bonus')}</h3>
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
                    {t('missions.claim')}
                  </button>
                )}
                {claimed && <span className="text-xs text-green-400">{t('missions.claimed')}</span>}
                {!unlocked && <span className="text-xs text-muted">{completed}/{needed}</span>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
