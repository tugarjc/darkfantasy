import { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useGameStore } from '../stores/gameStore';

const NOTIF_ICONS = {
  attack_result: '⚔',
  drain_received: '🌀',
  legendary_activated: '✦',
  war_declared: '🔥',
  research_complete: '📜',
  building_complete: '🏗',
  shield_expired: '🛡',
};

export default function NotificationCenter() {
  const { t } = useTranslation();
  const notifications = useGameStore((s) => s.notifications);
  const unreadCount = useGameStore((s) => s.unreadCount);
  const loadNotifications = useGameStore((s) => s.loadNotifications);
  const markAllRead = useGameStore((s) => s.markAllNotificationsRead);
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => { loadNotifications(); }, []);
  useEffect(() => {
    const interval = setInterval(loadNotifications, 30000);
    return () => clearInterval(interval);
  }, []);

  // Close on click outside
  useEffect(() => {
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleOpen = () => {
    setOpen(!open);
    if (!open) loadNotifications();
  };

  return (
    <div ref={ref} className="relative">
      <button onClick={handleOpen} className="relative text-muted hover:text-gold transition-colors">
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
        </svg>
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 bg-blood text-parchment text-[9px] rounded-full w-4 h-4 flex items-center justify-center font-bold">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-8 w-80 bg-elevated border border-border rounded-lg shadow-xl z-50 max-h-96 overflow-auto">
          <div className="flex items-center justify-between px-3 py-2 border-b border-border">
            <span className="text-sm font-display text-gold">{t('notifications.title')}</span>
            {unreadCount > 0 && (
              <button onClick={markAllRead} className="text-[10px] text-muted hover:text-gold">
                {t('notifications.mark_all_read')}
              </button>
            )}
          </div>
          {notifications.length === 0 ? (
            <p className="px-3 py-4 text-xs text-muted text-center">{t('notifications.empty')}</p>
          ) : (
            notifications.map((n) => (
              <div key={n.id} className={`px-3 py-2 border-b border-border/50 ${!n.read ? 'bg-gold/5' : ''}`}>
                <div className="flex items-start gap-2">
                  <span className="text-sm">{NOTIF_ICONS[n.type] || '📢'}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-parchment">{t(`notifications.types.${n.type}`, n.data)}</p>
                    <p className="text-[10px] text-muted">{new Date(n.created_at).toLocaleString()}</p>
                  </div>
                  {!n.read && <span className="w-2 h-2 bg-gold rounded-full mt-1 shrink-0" />}
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
