import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useGameStore } from '../stores/gameStore';

const CATEGORIES = ['progression', 'combat', 'economy', 'social', 'mastery'];

export default function AchievementPanel() {
  const { t } = useTranslation();
  const { achievements, achievementsLoading, loadAchievements, claimAchievement } = useGameStore();
  const [activeCat, setActiveCat] = useState('progression');

  useEffect(() => { loadAchievements(); }, []);

  if (achievementsLoading && achievements.length === 0) {
    return <p className="text-muted">{t('common.loading')}</p>;
  }

  const unlocked = achievements.filter(a => a.unlocked).length;
  const filtered = achievements.filter(a => a.category === activeCat);

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-display text-2xl text-gold">{t('achievements.title')}</h2>
        <span className="text-sm text-muted">
          {t('achievements.unlocked_count', { count: unlocked, total: achievements.length })}
        </span>
      </div>

      {/* Category tabs */}
      <div className="flex gap-1 mb-6 overflow-x-auto">
        {CATEGORIES.map(cat => (
          <button
            key={cat}
            onClick={() => setActiveCat(cat)}
            className={`px-3 py-1.5 text-sm rounded-lg whitespace-nowrap transition-colors ${
              activeCat === cat ? 'bg-gold/20 text-gold' : 'bg-surface text-muted hover:text-parchment'
            }`}
          >
            {t(`achievements.categories.${cat}`)}
          </button>
        ))}
      </div>

      {/* Achievement list */}
      <div className="space-y-3">
        {filtered.map(a => (
          <AchievementCard key={a.id} achievement={a} onClaim={claimAchievement} t={t} />
        ))}
      </div>
    </div>
  );
}

function AchievementCard({ achievement: a, onClaim, t }) {
  const pct = Math.min((a.progress / a.target) * 100, 100);
  const isUnlocked = a.unlocked;
  const isClaimed = a.claimed;

  return (
    <div className={`bg-surface border rounded-lg p-4 transition-colors ${
      isClaimed ? 'border-gold/30 opacity-70' : isUnlocked ? 'border-gold' : 'border-border'
    }`}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <AchievementIcon category={a.category} unlocked={isUnlocked} />
            <h3 className={`font-medium text-sm ${isUnlocked ? 'text-gold' : 'text-parchment'}`}>
              {t(`achievements.names.${a.id}`)}
            </h3>
          </div>
          <p className="text-xs text-muted mt-1">{t(`achievements.descs.${a.id}`)}</p>

          {/* Progress bar */}
          {!isClaimed && (
            <div className="mt-2">
              <div className="h-1.5 bg-base rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${isUnlocked ? 'bg-gold' : 'bg-gold/40'}`}
                  style={{ width: `${pct}%` }}
                />
              </div>
              <span className="text-[10px] text-muted mt-0.5 block">
                {a.progress}/{a.target}
              </span>
            </div>
          )}

          {/* Rewards preview */}
          <div className="flex gap-2 mt-2 text-[10px] text-muted">
            {a.rewardIron > 0 && <span className="text-iron">{a.rewardIron} Fer</span>}
            {a.rewardEssence > 0 && <span className="text-essence">{a.rewardEssence} Ess</span>}
            {a.rewardSouls > 0 && <span className="text-souls">{a.rewardSouls} Ames</span>}
            {a.rewardRelics > 0 && <span className="text-gold">{a.rewardRelics} Rel</span>}
            {a.rewardScore > 0 && <span>+{a.rewardScore} Score</span>}
          </div>
        </div>

        {/* Claim button */}
        <div className="flex-shrink-0">
          {isUnlocked && !isClaimed && (
            <button
              onClick={() => onClaim(a.id)}
              className="px-3 py-1.5 bg-blood border border-gold rounded text-xs text-parchment hover:bg-blood-light transition-colors"
            >
              {t('achievements.claim')}
            </button>
          )}
          {isClaimed && (
            <span className="text-xs text-gold">{t('achievements.claimed')}</span>
          )}
          {!isUnlocked && (
            <span className="text-xs text-muted">{t('achievements.locked')}</span>
          )}
        </div>
      </div>
    </div>
  );
}

function AchievementIcon({ category, unlocked }) {
  const cls = `w-5 h-5 ${unlocked ? 'text-gold' : 'text-muted'}`;
  switch (category) {
    case 'progression':
      return (
        <svg viewBox="0 0 24 24" className={cls} fill="none" stroke="currentColor" strokeWidth="1.5">
          <path d="M3 21V10l9-8 9 8v11H3z" /><path d="M9 21v-6h6v6" />
        </svg>
      );
    case 'combat':
      return (
        <svg viewBox="0 0 24 24" className={cls} fill="none" stroke="currentColor" strokeWidth="1.5">
          <path d="M14.5 2L19 8l-4.5 6M9.5 2L5 8l4.5 6" /><path d="M12 14v8M8 22h8" />
        </svg>
      );
    case 'economy':
      return (
        <svg viewBox="0 0 24 24" className={cls} fill="none" stroke="currentColor" strokeWidth="1.5">
          <path d="M4 7h16l-1.5 9H5.5L4 7z" /><circle cx="8" cy="21" r="1" /><circle cx="16" cy="21" r="1" />
        </svg>
      );
    case 'social':
      return (
        <svg viewBox="0 0 24 24" className={cls} fill="none" stroke="currentColor" strokeWidth="1.5">
          <circle cx="9" cy="7" r="3" /><circle cx="15" cy="7" r="3" /><path d="M3 21v-2a4 4 0 014-4h2M15 15h2a4 4 0 014 4v2" />
        </svg>
      );
    case 'mastery':
      return (
        <svg viewBox="0 0 24 24" className={cls} fill="none" stroke="currentColor" strokeWidth="1.5">
          <polygon points="12,2 15,9 22,9 16.5,14 18.5,21 12,17 5.5,21 7.5,14 2,9 9,9" />
        </svg>
      );
    default:
      return null;
  }
}
