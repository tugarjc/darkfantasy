import { useState } from 'react';
import { useTranslation } from 'react-i18next';

const MAIN_TABS = [
  { id: 'buildings', labelKey: 'mobile.base' },
  { id: 'units', labelKey: 'mobile.army' },
  { id: 'map', labelKey: 'mobile.map' },
  { id: 'alliance', labelKey: 'mobile.social' },
  { id: 'plus', labelKey: 'mobile.more' },
];

const PLUS_TABS = [
  'legions', 'heroes', 'research', 'market', 'events',
  'missions', 'chat', 'reports', 'store', 'leaderboard', 'seasons', 'achievements', 'tutorial', 'account',
];

function getActiveMainTab(tab) {
  if (tab === 'buildings') return 'buildings';
  if (tab === 'units') return 'units';
  if (tab === 'map') return 'map';
  if (tab === 'alliance') return 'alliance';
  return 'plus';
}

export default function MobileBottomBar({ currentTab, onTabChange, isAdmin }) {
  const { t } = useTranslation();
  const [plusOpen, setPlusOpen] = useState(false);
  const activeMain = getActiveMainTab(currentTab);

  const allPlusTabs = isAdmin ? [...PLUS_TABS, 'admin'] : PLUS_TABS;

  const handleTabClick = (tabId) => {
    if (tabId === 'plus') {
      setPlusOpen(!plusOpen);
    } else {
      onTabChange(tabId);
      setPlusOpen(false);
    }
  };

  const handlePlusSelect = (tabId) => {
    onTabChange(tabId);
    setPlusOpen(false);
  };

  return (
    <>
      {/* Plus overlay */}
      {plusOpen && (
        <div className="fixed inset-0 z-40 bg-black/60 md:hidden" onClick={() => setPlusOpen(false)}>
          <div
            className="absolute bottom-16 left-0 right-0 bg-elevated border-t border-border rounded-t-xl p-4 max-h-[60vh] overflow-auto"
            style={{ paddingBottom: 'calc(8px + env(safe-area-inset-bottom, 0px))' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="grid grid-cols-4 gap-3">
              {allPlusTabs.map((tabId) => (
                <button
                  key={tabId}
                  onClick={() => handlePlusSelect(tabId)}
                  className={`flex flex-col items-center gap-1.5 p-3 rounded-lg transition-colors ${
                    currentTab === tabId ? 'bg-gold/10 text-gold' : 'text-muted hover:text-parchment'
                  }`}
                >
                  <TabIcon tabId={tabId} />
                  <span className="text-[10px] leading-tight text-center">
                    {t(`nav.${tabId === 'legions' ? 'legions' : tabId}`)}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Bottom bar */}
      <nav
        role="navigation"
        aria-label={t('a11y.main_navigation')}
        className="md:hidden fixed bottom-0 left-0 right-0 z-30 bg-base border-t border-border flex"
        style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
      >
        {MAIN_TABS.map((tab) => {
          const isActive = tab.id === 'plus' ? plusOpen : activeMain === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => handleTabClick(tab.id)}
              aria-current={isActive && tab.id !== 'plus' ? 'page' : undefined}
              aria-expanded={tab.id === 'plus' ? plusOpen : undefined}
              className={`flex-1 flex flex-col items-center justify-center gap-1 min-h-[56px] transition-colors ${
                isActive ? 'text-gold' : 'text-muted'
              }`}
            >
              <MainTabIcon tabId={tab.id} />
              <span className="text-[10px] leading-none">{t(tab.labelKey)}</span>
            </button>
          );
        })}
      </nav>
    </>
  );
}

/* ── Main Tab Icons (5 principaux) ── */
function MainTabIcon({ tabId }) {
  const cls = "w-6 h-6";
  switch (tabId) {
    case 'buildings':
      return (
        <svg viewBox="0 0 24 24" className={cls} fill="none" stroke="currentColor" strokeWidth="1.5">
          <path d="M3 21V10l9-8 9 8v11H3z" />
          <path d="M9 21v-6h6v6" />
          <path d="M12 2v3" />
        </svg>
      );
    case 'units':
      return (
        <svg viewBox="0 0 24 24" className={cls} fill="none" stroke="currentColor" strokeWidth="1.5">
          <path d="M14.5 2L19 8l-4.5 6M9.5 2L5 8l4.5 6" />
          <path d="M12 14v8M8 22h8" />
        </svg>
      );
    case 'map':
      return (
        <svg viewBox="0 0 24 24" className={cls} fill="none" stroke="currentColor" strokeWidth="1.5">
          <path d="M3 6l6-3 6 3 6-3v15l-6 3-6-3-6 3V6z" />
          <path d="M9 3v15M15 6v15" />
        </svg>
      );
    case 'alliance':
      return (
        <svg viewBox="0 0 24 24" className={cls} fill="none" stroke="currentColor" strokeWidth="1.5">
          <circle cx="9" cy="7" r="3" />
          <circle cx="15" cy="7" r="3" />
          <path d="M3 21v-2a4 4 0 014-4h2M15 15h2a4 4 0 014 4v2" />
          <path d="M12 15v6" />
        </svg>
      );
    case 'plus':
      return (
        <svg viewBox="0 0 24 24" className={cls} fill="currentColor">
          <circle cx="5" cy="5" r="2" />
          <circle cx="12" cy="5" r="2" />
          <circle cx="19" cy="5" r="2" />
          <circle cx="5" cy="12" r="2" />
          <circle cx="12" cy="12" r="2" />
          <circle cx="19" cy="12" r="2" />
          <circle cx="5" cy="19" r="2" />
          <circle cx="12" cy="19" r="2" />
          <circle cx="19" cy="19" r="2" />
        </svg>
      );
    default:
      return null;
  }
}

/* ── Secondary Tab Icons (Plus overlay) ── */
function TabIcon({ tabId }) {
  const cls = "w-5 h-5";
  switch (tabId) {
    case 'legions':
      return (
        <svg viewBox="0 0 24 24" className={cls} fill="none" stroke="currentColor" strokeWidth="1.5">
          <path d="M12 2l3 7h7l-5.5 4 2 7L12 16l-6.5 4 2-7L2 9h7z" />
        </svg>
      );
    case 'heroes':
      return (
        <svg viewBox="0 0 24 24" className={cls} fill="none" stroke="currentColor" strokeWidth="1.5">
          <path d="M12 2a5 5 0 015 5v1a5 5 0 01-10 0V7a5 5 0 015-5z" />
          <path d="M7 21v-3a5 5 0 0110 0v3" />
          <path d="M12 12v3" />
        </svg>
      );
    case 'research':
      return (
        <svg viewBox="0 0 24 24" className={cls} fill="none" stroke="currentColor" strokeWidth="1.5">
          <circle cx="11" cy="11" r="7" />
          <path d="M21 21l-4.35-4.35" />
          <path d="M11 8v6M8 11h6" />
        </svg>
      );
    case 'market':
      return (
        <svg viewBox="0 0 24 24" className={cls} fill="none" stroke="currentColor" strokeWidth="1.5">
          <path d="M4 7h16l-1.5 9H5.5L4 7z" />
          <path d="M4 7l-1-4H1M8 21h.01M16 21h.01" />
          <circle cx="8" cy="21" r="1" /><circle cx="16" cy="21" r="1" />
        </svg>
      );
    case 'events':
      return (
        <svg viewBox="0 0 24 24" className={cls} fill="none" stroke="currentColor" strokeWidth="1.5">
          <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
        </svg>
      );
    case 'missions':
      return (
        <svg viewBox="0 0 24 24" className={cls} fill="none" stroke="currentColor" strokeWidth="1.5">
          <rect x="3" y="3" width="18" height="18" rx="2" />
          <path d="M9 12l2 2 4-4" />
        </svg>
      );
    case 'chat':
      return (
        <svg viewBox="0 0 24 24" className={cls} fill="none" stroke="currentColor" strokeWidth="1.5">
          <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2v10z" />
        </svg>
      );
    case 'reports':
      return (
        <svg viewBox="0 0 24 24" className={cls} fill="none" stroke="currentColor" strokeWidth="1.5">
          <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8l-6-6z" />
          <path d="M14 2v6h6M8 13h8M8 17h8M8 9h2" />
        </svg>
      );
    case 'store':
      return (
        <svg viewBox="0 0 24 24" className={cls} fill="none" stroke="currentColor" strokeWidth="1.5">
          <polygon points="12,2 15,9 22,9 16.5,14 18.5,21 12,17 5.5,21 7.5,14 2,9 9,9" />
        </svg>
      );
    case 'leaderboard':
      return (
        <svg viewBox="0 0 24 24" className={cls} fill="none" stroke="currentColor" strokeWidth="1.5">
          <path d="M8 21h8M12 17v4M6 12V4h4l2 3 2-3h4v8" />
          <path d="M6 8H2l2 4M18 8h4l-2 4" />
        </svg>
      );
    case 'tutorial':
      return (
        <svg viewBox="0 0 24 24" className={cls} fill="none" stroke="currentColor" strokeWidth="1.5">
          <path d="M2 3h6a4 4 0 014 4v14a3 3 0 00-3-3H2V3z" />
          <path d="M22 3h-6a4 4 0 00-4 4v14a3 3 0 013-3h7V3z" />
        </svg>
      );
    case 'seasons':
      return (
        <svg viewBox="0 0 24 24" className={cls} fill="none" stroke="currentColor" strokeWidth="1.5">
          <circle cx="12" cy="12" r="9" />
          <path d="M12 7v5l3 3" />
          <path d="M16 3l1.5 1.5M8 3L6.5 4.5" />
        </svg>
      );
    case 'achievements':
      return (
        <svg viewBox="0 0 24 24" className={cls} fill="none" stroke="currentColor" strokeWidth="1.5">
          <path d="M6 12V4h4l2 3 2-3h4v8" />
          <path d="M6 8H2l2 4M18 8h4l-2 4" />
          <path d="M8 21h8M12 17v4" />
        </svg>
      );
    case 'account':
      return (
        <svg viewBox="0 0 24 24" className={cls} fill="none" stroke="currentColor" strokeWidth="1.5">
          <circle cx="12" cy="8" r="4" />
          <path d="M5 21v-2a7 7 0 0114 0v2" />
        </svg>
      );
    case 'admin':
      return (
        <svg viewBox="0 0 24 24" className={cls} fill="none" stroke="currentColor" strokeWidth="1.5">
          <circle cx="12" cy="12" r="3" />
          <path d="M12 1v4M12 19v4M4.22 4.22l2.83 2.83M16.95 16.95l2.83 2.83M1 12h4M19 12h4M4.22 19.78l2.83-2.83M16.95 7.05l2.83-2.83" />
        </svg>
      );
    default:
      return <span className="text-lg">•</span>;
  }
}
