import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

export default function Landing() {
  const { t } = useTranslation();
  return (
    <div className="min-h-screen bg-deep flex flex-col">
      {/* Hero Section */}
      <section className="relative flex-1 flex flex-col items-center justify-center px-4 py-20 overflow-hidden">
        {/* Background SVG mist */}
        <svg className="absolute inset-0 w-full h-full pointer-events-none opacity-20" preserveAspectRatio="none">
          <defs>
            <radialGradient id="mist1" cx="30%" cy="60%" r="50%">
              <stop offset="0%" stopColor="#8B1A1A" stopOpacity="0.3" />
              <stop offset="100%" stopColor="#0A0A0F" stopOpacity="0" />
            </radialGradient>
            <radialGradient id="mist2" cx="70%" cy="40%" r="40%">
              <stop offset="0%" stopColor="#6B2FA0" stopOpacity="0.2" />
              <stop offset="100%" stopColor="#0A0A0F" stopOpacity="0" />
            </radialGradient>
          </defs>
          <rect width="100%" height="100%" fill="url(#mist1)" />
          <rect width="100%" height="100%" fill="url(#mist2)" />
        </svg>

        {/* Pentagram decoration */}
        <svg className="w-32 h-32 mb-6 opacity-40" viewBox="0 0 100 100">
          <polygon
            points="50,5 61,40 97,40 68,60 79,95 50,73 21,95 32,60 3,40 39,40"
            fill="none" stroke="#C9A84C" strokeWidth="1"
          />
          <circle cx="50" cy="50" r="42" fill="none" stroke="#8B1A1A" strokeWidth="0.5" />
        </svg>

        <h1 className="font-display text-5xl md:text-7xl text-gold text-center mb-4 relative z-10 tracking-wide">
          INFERNO DOMINI
        </h1>
        <p className="font-display text-xl md:text-2xl text-blood-light text-center mb-2 relative z-10">
          {t('landing.subtitle')}
        </p>
        <p className="text-muted text-center max-w-xl mb-10 relative z-10">
          {t('landing.description')}
        </p>

        <div className="flex gap-4 relative z-10">
          <Link
            to="/register"
            className="px-8 py-3 bg-blood border border-gold rounded font-display text-lg text-parchment
                       hover:bg-blood-light hover:shadow-[0_0_20px_rgba(139,26,26,0.5)] transition-all duration-300"
          >
            {t('landing.join')}
          </Link>
          <Link
            to="/login"
            className="px-8 py-3 border border-border rounded font-body text-muted
                       hover:border-gold hover:text-parchment transition-all duration-300"
          >
            {t('auth.login_title')}
          </Link>
        </div>
      </section>

      {/* Features Section */}
      <section className="bg-base border-t border-border py-16 px-4">
        <div className="max-w-5xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-8">
          <FeatureCard
            icon={<IronIcon />}
            title={t('landing.feature_empire_title')}
            desc={t('landing.feature_empire_desc')}
          />
          <FeatureCard
            icon={<SwordsIcon />}
            title={t('landing.feature_pvp_title')}
            desc={t('landing.feature_pvp_desc')}
          />
          <FeatureCard
            icon={<AllianceIcon />}
            title={t('landing.feature_pact_title')}
            desc={t('landing.feature_pact_desc')}
          />
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-deep border-t border-border py-6 px-4 text-center text-sm text-muted">
        {t('landing.footer')}
      </footer>
    </div>
  );
}

function FeatureCard({ icon, title, desc }) {
  return (
    <div className="bg-surface border border-border rounded-lg p-6 hover:border-blood transition-colors duration-300">
      <div className="w-12 h-12 mb-4">{icon}</div>
      <h3 className="font-display text-xl text-gold mb-2">{title}</h3>
      <p className="text-muted text-sm">{desc}</p>
    </div>
  );
}

function IronIcon() {
  return (
    <svg viewBox="0 0 48 48" className="w-full h-full">
      <path d="M10 30 L14 22 L34 22 L38 30 L40 30 L40 34 L8 34 L8 30 Z" fill="#B0592A" stroke="#5A2A0A" strokeWidth="1.5"/>
      <path d="M14 22 L6 24 L8 28 L14 26" fill="#D4783C" stroke="#5A2A0A" strokeWidth="1"/>
      <path d="M20 20 Q22 12 24 16 Q26 10 28 18 Q26 14 24 20 Z" fill="#FF6633" opacity="0.8"/>
      <rect x="12" y="34" width="24" height="4" rx="1" fill="#3A1A08"/>
    </svg>
  );
}

function SwordsIcon() {
  return (
    <svg viewBox="0 0 48 48" className="w-full h-full">
      <line x1="8" y1="40" x2="36" y2="12" stroke="#C9A84C" strokeWidth="2" strokeLinecap="round"/>
      <line x1="40" y1="40" x2="12" y2="12" stroke="#B22222" strokeWidth="2" strokeLinecap="round"/>
      <circle cx="24" cy="26" r="3" fill="none" stroke="#C9A84C" strokeWidth="1"/>
      <line x1="34" y1="10" x2="38" y2="6" stroke="#C9A84C" strokeWidth="2" strokeLinecap="round"/>
      <line x1="10" y1="10" x2="6" y2="6" stroke="#B22222" strokeWidth="2" strokeLinecap="round"/>
    </svg>
  );
}

function AllianceIcon() {
  return (
    <svg viewBox="0 0 48 48" className="w-full h-full">
      <path d="M8 36 L8 20 Q8 8 24 4 Q40 8 40 20 L40 36 Q32 40 24 42 Q16 40 8 36 Z"
            fill="none" stroke="#6B2FA0" strokeWidth="1.5"/>
      <path d="M12 34 L12 22 Q12 12 24 8 Q36 12 36 22 L36 34 Q28 38 24 38 Q20 38 12 34 Z"
            fill="#1A1A24" stroke="#9B59B6" strokeWidth="0.5"/>
      <text x="24" y="27" textAnchor="middle" fill="#C9A84C" fontSize="14" fontFamily="serif">P</text>
    </svg>
  );
}
