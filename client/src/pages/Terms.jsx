import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';

export default function Terms() {
  const { t } = useTranslation();

  return (
    <div className="min-h-screen bg-deep text-parchment">
      <header className="bg-base border-b border-border px-4 py-3 flex items-center justify-between">
        <Link to="/" className="font-display text-xl text-gold hover:text-gold-light">INFERNO DOMINI</Link>
        <nav className="flex gap-4 text-sm">
          <Link to="/privacy" className="text-muted hover:text-parchment">{t('legal.privacy_link')}</Link>
          <Link to="/terms" className="text-gold">{t('legal.terms_link')}</Link>
          <Link to="/legal" className="text-muted hover:text-parchment">{t('legal.legal_link')}</Link>
        </nav>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-12">
        <h1 className="font-display text-3xl text-gold mb-8">{t('legal.terms_title')}</h1>

        <Section title={t('legal.terms_acceptance')}>
          <p>{t('legal.terms_acceptance_text')}</p>
        </Section>

        <Section title={t('legal.terms_rules')}>
          <p>{t('legal.terms_rules_text')}</p>
        </Section>

        <Section title={t('legal.terms_account')}>
          <p>{t('legal.terms_account_text')}</p>
        </Section>

        <Section title={t('legal.terms_virtual')}>
          <p>{t('legal.terms_virtual_text')}</p>
        </Section>

        <Section title={t('legal.terms_availability')}>
          <p>{t('legal.terms_availability_text')}</p>
        </Section>

        <p className="text-muted text-sm mt-8">{t('legal.last_updated')}: 2026-03-04</p>
      </main>
    </div>
  );
}

function Section({ title, children }) {
  return (
    <section className="mb-8">
      <h2 className="font-display text-lg text-gold-light mb-3">{title}</h2>
      <div className="text-sm leading-relaxed text-parchment/80 space-y-2">{children}</div>
    </section>
  );
}
