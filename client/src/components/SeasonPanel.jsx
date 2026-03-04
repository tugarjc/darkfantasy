import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useGameStore } from '../stores/gameStore';

export default function SeasonPanel() {
  const { t } = useTranslation();
  const { seasons, seasonLeaderboard, prestige, seasonsLoading, loadSeasons, loadSeasonLeaderboard, loadPrestige } = useGameStore();
  const [selectedSeason, setSelectedSeason] = useState(null);
  const [showPast, setShowPast] = useState(false);

  useEffect(() => { loadSeasons(); loadPrestige(); }, []);

  const activeSeason = seasons.find(s => s.status === 'active');
  const upcomingSeasons = seasons.filter(s => s.status === 'upcoming');
  const pastSeasons = seasons.filter(s => s.status === 'ended');

  useEffect(() => {
    if (activeSeason && !selectedSeason) {
      setSelectedSeason(activeSeason.id);
      loadSeasonLeaderboard(activeSeason.id);
    }
  }, [activeSeason]);

  const handleSelectSeason = (id) => {
    setSelectedSeason(id);
    loadSeasonLeaderboard(id);
  };

  return (
    <div>
      <h2 className="font-display text-2xl text-gold mb-4">{t('seasons.title')}</h2>

      {/* Active Season */}
      {activeSeason ? (
        <div className="bg-surface border border-gold/30 rounded-lg p-4 mb-6">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-display text-lg text-gold">{activeSeason.name}</h3>
            <span className="text-xs bg-gold/10 text-gold px-2 py-1 rounded">{t('seasons.active')}</span>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
            <div>
              <span className="text-muted">{t('seasons.time_remaining')}</span>
              <div className="text-parchment font-medium"><Countdown endDate={activeSeason.end_date} /></div>
            </div>
            {activeSeason.my_rank && (
              <div>
                <span className="text-muted">{t('seasons.my_rank')}</span>
                <div className="text-gold font-display text-lg">#{activeSeason.my_rank}</div>
              </div>
            )}
            {activeSeason.my_score != null && (
              <div>
                <span className="text-muted">{t('seasons.my_score')}</span>
                <div className="text-parchment font-medium">{parseInt(activeSeason.my_score).toLocaleString('fr-FR')}</div>
              </div>
            )}
            <div>
              <span className="text-muted">{t('seasons.participants')}</span>
              <div className="text-parchment">{activeSeason.participant_count || 0}</div>
            </div>
          </div>
        </div>
      ) : (
        <div className="bg-surface border border-border rounded-lg p-4 mb-6 text-sm text-muted">
          {t('seasons.no_active_season')}
        </div>
      )}

      {/* Upcoming */}
      {upcomingSeasons.length > 0 && (
        <div className="mb-6">
          {upcomingSeasons.map(s => (
            <div key={s.id} className="bg-surface border border-border rounded-lg p-3 mb-2 flex items-center justify-between">
              <div>
                <span className="text-parchment text-sm font-medium">{s.name}</span>
                <span className="text-xs text-muted ml-2">— {t('seasons.upcoming')}</span>
              </div>
              <span className="text-xs text-muted">{new Date(s.start_date).toLocaleDateString()}</span>
            </div>
          ))}
        </div>
      )}

      {/* Leaderboard */}
      {selectedSeason && (
        <div className="bg-surface border border-border rounded-lg p-4 mb-6">
          <h3 className="font-display text-sm text-gold mb-3">{t('seasons.leaderboard')}</h3>
          {seasonLeaderboard.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-muted text-xs border-b border-border">
                    <th className="text-left py-2 w-12">{t('seasons.rank')}</th>
                    <th className="text-left py-2">{t('seasons.player')}</th>
                    <th className="text-right py-2">{t('seasons.score')}</th>
                    <th className="text-right py-2">{t('seasons.relics_earned')}</th>
                  </tr>
                </thead>
                <tbody>
                  {seasonLeaderboard.map((e, i) => (
                    <tr key={i} className="border-b border-border/50">
                      <td className={`py-1.5 ${e.rank <= 3 ? 'text-gold font-display' : 'text-muted'}`}>
                        {e.rank <= 3 ? ['', t('seasons.first_place'), t('seasons.second_place'), t('seasons.third_place')][e.rank] : `#${e.rank}`}
                      </td>
                      <td className="py-1.5 text-parchment">
                        {e.username}
                        {e.alliance_tag && <span className="text-xs text-muted ml-1">[{e.alliance_tag}]</span>}
                      </td>
                      <td className="py-1.5 text-right text-parchment">{parseInt(e.score).toLocaleString('fr-FR')}</td>
                      <td className="py-1.5 text-right text-gold">{e.relics_earned || '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-muted text-xs">{t('leaderboard.empty')}</p>
          )}
        </div>
      )}

      {/* Prestige */}
      <PrestigeSection prestige={prestige} t={t} />

      {/* Past seasons */}
      {pastSeasons.length > 0 && (
        <div>
          <button
            onClick={() => setShowPast(!showPast)}
            className="text-sm text-muted hover:text-parchment transition-colors mb-2"
          >
            {t('seasons.past_seasons')} ({pastSeasons.length}) {showPast ? '▲' : '▼'}
          </button>
          {showPast && (
            <div className="space-y-2">
              {pastSeasons.map(s => (
                <button
                  key={s.id}
                  onClick={() => handleSelectSeason(s.id)}
                  className={`w-full bg-surface border rounded-lg p-3 text-left text-sm transition-colors ${
                    selectedSeason === s.id ? 'border-gold/30' : 'border-border hover:border-border/80'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-parchment font-medium">{s.name}</span>
                    <span className="text-xs text-muted">{t('seasons.ended')}</span>
                  </div>
                  <div className="text-xs text-muted mt-1">
                    {s.my_rank ? `${t('seasons.my_rank')}: #${s.my_rank}` : ''} — {s.participant_count || 0} {t('seasons.participants')}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function PrestigeSection({ prestige, t }) {
  if (!prestige) return null;

  const { level, totalXp, bonuses, nextLevel, allLevels } = prestige;
  const xpProgress = nextLevel ? (totalXp / nextLevel.xpRequired) * 100 : 100;

  return (
    <div className="bg-surface border border-border rounded-lg p-4 mb-6">
      <h3 className="font-display text-sm text-gold mb-3">{t('seasons.prestige_title')}</h3>

      {level > 0 ? (
        <>
          <div className="flex items-center gap-3 mb-3">
            <PrestigeIcon level={level} />
            <div>
              <div className="text-parchment font-display text-lg">P{level}</div>
              <div className="text-xs text-muted">{t('seasons.prestige_level', { level })}</div>
            </div>
          </div>

          {/* XP Progress */}
          {nextLevel ? (
            <div className="mb-3">
              <div className="flex justify-between text-xs text-muted mb-1">
                <span>{t('seasons.prestige_xp')}</span>
                <span>{t('seasons.xp_needed', { current: totalXp.toLocaleString('fr-FR'), needed: nextLevel.xpRequired.toLocaleString('fr-FR') })}</span>
              </div>
              <div className="h-2 bg-base rounded-full overflow-hidden">
                <div className="h-full bg-gold/60 rounded-full transition-all" style={{ width: `${Math.min(xpProgress, 100)}%` }} />
              </div>
            </div>
          ) : (
            <p className="text-xs text-gold mb-3">{t('seasons.max_prestige')}</p>
          )}

          {/* Active bonuses */}
          <div>
            <div className="text-xs text-muted mb-1">{t('seasons.bonuses')}</div>
            <div className="flex flex-wrap gap-2">
              {bonuses.production && (
                <span className="text-xs bg-gold/10 text-gold px-2 py-0.5 rounded">
                  {t('seasons.bonus_production', { value: Math.round(bonuses.production * 100) })}
                </span>
              )}
              {bonuses.combat && (
                <span className="text-xs bg-blood/20 text-blood-glow px-2 py-0.5 rounded">
                  {t('seasons.bonus_combat', { value: Math.round(bonuses.combat * 100) })}
                </span>
              )}
              {bonuses.buildTime && (
                <span className="text-xs bg-essence/20 text-essence px-2 py-0.5 rounded">
                  {t('seasons.bonus_build_time', { value: Math.round(Math.abs(bonuses.buildTime) * 100) })}
                </span>
              )}
              {bonuses.maxLegion && (
                <span className="text-xs bg-souls/20 text-souls px-2 py-0.5 rounded">
                  {t('seasons.bonus_max_legion', { value: bonuses.maxLegion })}
                </span>
              )}
            </div>
          </div>
        </>
      ) : (
        <p className="text-xs text-muted">{t('seasons.no_prestige')}</p>
      )}

      {/* All levels preview */}
      <div className="mt-4 grid grid-cols-5 gap-2">
        {(allLevels || []).map(lv => (
          <div key={lv.level} className={`text-center p-2 rounded border text-xs ${
            level >= lv.level ? 'border-gold/30 bg-gold/5 text-gold' : 'border-border text-muted'
          }`}>
            <div className="font-display">P{lv.level}</div>
            <div className="text-[10px]">{(lv.xpRequired / 1000).toFixed(0)}K</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function Countdown({ endDate }) {
  const [remaining, setRemaining] = useState('');

  useEffect(() => {
    const update = () => {
      const diff = new Date(endDate) - Date.now();
      if (diff <= 0) { setRemaining('00:00:00'); return; }
      const d = Math.floor(diff / 86400000);
      const h = Math.floor((diff % 86400000) / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      const s = Math.floor((diff % 60000) / 1000);
      setRemaining(d > 0
        ? `${d}j ${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
        : `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
      );
    };
    update();
    const iv = setInterval(update, 1000);
    return () => clearInterval(iv);
  }, [endDate]);

  return <span>{remaining}</span>;
}

function PrestigeIcon({ level }) {
  const colors = ['', '#CD7F32', '#C0C0C0', '#FFD700', '#E5C158', '#FF4500'];
  const color = colors[level] || '#C9A84C';
  return (
    <svg viewBox="0 0 32 32" className="w-8 h-8">
      <polygon points="16,2 20,12 30,12 22,19 25,30 16,23 7,30 10,19 2,12 12,12" fill={color} opacity="0.9" />
      <text x="16" y="19" textAnchor="middle" fontSize="10" fill="#0A0A0F" fontWeight="bold">{level}</text>
    </svg>
  );
}
