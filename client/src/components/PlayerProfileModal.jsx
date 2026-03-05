import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useGameStore } from '../stores/gameStore';

const FACTION_COLORS = {
  none: 'text-muted',
  legion_cendres: 'text-orange-400',
  ordre_vide: 'text-purple-400',
  pacte_chaines: 'text-red-400',
  culte_sang: 'text-green-400',
};

export default function PlayerProfileModal({ playerId, onClose }) {
  const { t } = useTranslation();
  const { publicProfile, publicProfileLoading, loadPublicProfile } = useGameStore();
  const overlayRef = useRef(null);

  useEffect(() => {
    if (playerId) loadPublicProfile(playerId);
  }, [playerId]);

  useEffect(() => {
    const handleKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [onClose]);

  if (!playerId) return null;

  const handleOverlayClick = (e) => {
    if (e.target === overlayRef.current) onClose();
  };

  return (
    <div ref={overlayRef} onClick={handleOverlayClick}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div className="bg-elevated border border-border rounded-xl p-6 w-full max-w-sm mx-4 relative">
        {/* Close */}
        <button onClick={onClose} className="absolute top-3 right-3 text-muted hover:text-parchment text-lg">&times;</button>

        {publicProfileLoading && (
          <p className="text-muted text-center py-8">{t('common.loading')}</p>
        )}

        {!publicProfileLoading && publicProfile && (
          <>
            {/* Header */}
            <div className="text-center mb-4">
              <div className="w-14 h-14 mx-auto bg-surface border border-border rounded-full flex items-center justify-center mb-2">
                <span className="font-display text-xl text-gold">
                  {publicProfile.username?.charAt(0).toUpperCase()}
                </span>
              </div>
              <h3 className="font-display text-lg text-gold">{publicProfile.username}</h3>
              <span className={`text-xs ${FACTION_COLORS[publicProfile.faction] || 'text-muted'}`}>
                {t(`factions.${publicProfile.faction}`)}
              </span>
            </div>

            {/* Stats grid */}
            <div className="grid grid-cols-2 gap-3 mb-4">
              <StatItem label={t('profile.score')} value={publicProfile.score?.toLocaleString('fr-FR')} />
              <StatItem label={t('profile.prestige')} value={publicProfile.prestigeLevel > 0 ? `P${publicProfile.prestigeLevel}` : '—'} />
              <StatItem label={t('profile.achievements')} value={`${publicProfile.achievementsCount}/20`} />
              <StatItem label={t('profile.circles')} value={publicProfile.circlesCount} />
            </div>

            {/* Alliance */}
            <div className="bg-surface rounded-lg p-3 mb-3">
              <span className="text-xs text-muted">{t('profile.alliance')}</span>
              <p className="text-sm text-parchment">
                {publicProfile.alliance
                  ? `[${publicProfile.alliance.tag}] ${publicProfile.alliance.name}`
                  : t('profile.no_alliance')}
              </p>
            </div>

            {/* Member since */}
            <div className="text-center text-xs text-muted">
              {t('profile.member_since')}: {new Date(publicProfile.created_at).toLocaleDateString('fr-FR')}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function StatItem({ label, value }) {
  return (
    <div className="bg-surface rounded-lg p-2 text-center">
      <div className="text-xs text-muted">{label}</div>
      <div className="text-sm font-medium text-parchment">{value}</div>
    </div>
  );
}
