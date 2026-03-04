import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';

export default function CookieConsent() {
  const { t } = useTranslation();
  const [accepted, setAccepted] = useState(() => !!localStorage.getItem('cookieConsent'));

  if (accepted) return null;

  const handleAccept = () => {
    localStorage.setItem('cookieConsent', 'true');
    setAccepted(true);
  };

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 bg-elevated border-t border-border px-4 py-3 flex flex-wrap items-center justify-between gap-3 md:px-8">
      <p className="text-xs text-muted flex-1">
        {t('cookie.message')}{' '}
        <Link to="/privacy" className="text-gold underline">{t('legal.privacy_link')}</Link>.
      </p>
      <button
        onClick={handleAccept}
        className="px-4 py-1.5 bg-gold/10 border border-gold/30 rounded text-xs text-gold hover:bg-gold/20"
      >
        {t('cookie.accept')}
      </button>
    </div>
  );
}
