import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '../stores/authStore';
import { useGameStore } from '../stores/gameStore';
import PlayerProfileModal from './PlayerProfileModal';

const FACTION_COLORS = {
  none: '#999', legion_cendres: '#B0592A', ordre_vide: '#6B2FA0',
  pacte_chaines: '#8B1A1A', culte_sang: '#C41E3A',
};

export default function LeaderboardPanel() {
  const { t } = useTranslation();
  const player = useAuthStore((s) => s.player);
  const leaderboard = useGameStore((s) => s.leaderboard);
  const loading = useGameStore((s) => s.leaderboardLoading);
  const loadLeaderboard = useGameStore((s) => s.loadLeaderboard);
  const [category, setCategory] = useState('score');
  const [profileId, setProfileId] = useState(null);

  useEffect(() => { loadLeaderboard(category); }, [category]);

  const categories = [
    { key: 'score', label: t('leaderboard.score') },
    { key: 'military', label: t('leaderboard.military') },
    { key: 'relics', label: t('leaderboard.relics') },
  ];

  return (
    <div>
      <h2 className="font-display text-2xl text-gold mb-4">{t('leaderboard.title')}</h2>

      <div className="flex gap-1 mb-4">
        {categories.map((c) => (
          <button
            key={c.key}
            onClick={() => setCategory(c.key)}
            className={`px-3 py-1.5 text-xs rounded border transition-colors ${
              category === c.key
                ? 'border-gold text-gold bg-gold/10'
                : 'border-border text-muted hover:text-parchment hover:border-gold/30'
            }`}
          >
            {c.label}
          </button>
        ))}
      </div>

      {loading && <p className="text-gold text-sm animate-pulse">{t('common.loading')}</p>}

      <div className="bg-surface border border-border rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-xs text-muted">
              <th className="px-3 py-2 text-left">#</th>
              <th className="px-3 py-2 text-left">{t('leaderboard.player')}</th>
              <th className="px-3 py-2 text-left">{t('leaderboard.faction_col')}</th>
              <th className="px-3 py-2 text-left">{t('leaderboard.alliance_col')}</th>
              <th className="px-3 py-2 text-right">{t('leaderboard.value')}</th>
            </tr>
          </thead>
          <tbody>
            {leaderboard.map((entry) => {
              const isMe = entry.id === player?.id;
              const value = category === 'military' ? entry.militaryValue
                          : category === 'relics' ? entry.relics
                          : entry.score;
              return (
                <tr key={entry.id} className={`border-b border-border/50 ${isMe ? 'bg-gold/5' : ''}`}>
                  <td className="px-3 py-2 text-gold font-display">{entry.rank}</td>
                  <td className={`px-3 py-2 ${isMe ? 'text-gold font-medium' : 'text-parchment'}`}>
                    <button onClick={() => setProfileId(entry.id)} className="hover:underline hover:text-gold transition-colors">
                      {entry.username}
                    </button>
                  </td>
                  <td className="px-3 py-2">
                    <span className="text-xs" style={{ color: FACTION_COLORS[entry.faction] || '#999' }}>
                      {t(`factions.${entry.faction}`)}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-xs text-muted">
                    {entry.alliance ? `[${entry.alliance.tag}]` : '-'}
                  </td>
                  <td className="px-3 py-2 text-right text-parchment font-medium">
                    {value.toLocaleString()}
                  </td>
                </tr>
              );
            })}
            {leaderboard.length === 0 && !loading && (
              <tr><td colSpan={5} className="px-3 py-4 text-center text-muted">{t('leaderboard.empty')}</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {profileId && (
        <PlayerProfileModal playerId={profileId} onClose={() => setProfileId(null)} />
      )}
    </div>
  );
}
