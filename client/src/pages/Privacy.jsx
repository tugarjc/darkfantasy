import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';

export default function Privacy() {
  const { t } = useTranslation();

  return (
    <div className="min-h-screen bg-deep text-parchment">
      <header className="bg-base border-b border-border px-4 py-3 flex items-center justify-between">
        <Link to="/" className="font-display text-xl text-gold hover:text-gold-light">INFERNO DOMINI</Link>
        <nav className="flex gap-4 text-sm">
          <Link to="/privacy" className="text-gold">{t('legal.privacy_link')}</Link>
          <Link to="/terms" className="text-muted hover:text-parchment">{t('legal.terms_link')}</Link>
          <Link to="/legal" className="text-muted hover:text-parchment">{t('legal.legal_link')}</Link>
        </nav>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-12">
        <h1 className="font-display text-3xl text-gold mb-8">{t('legal.privacy_title')}</h1>

        <Section title={t('legal.privacy_data_collected')}>
          <p>{t('legal.privacy_data_text')}</p>
        </Section>

        <Section title={t('legal.privacy_purpose')}>
          <p>{t('legal.privacy_purpose_text')}</p>
        </Section>

        <Section title={t('legal.privacy_retention')}>
          <p>{t('legal.privacy_retention_text')}</p>
        </Section>

        <Section title={t('legal.privacy_rights')}>
          <p>{t('legal.privacy_rights_text')}</p>
        </Section>

        <Section title={t('legal.privacy_storage')}>
          <p>{t('legal.privacy_storage_text')}</p>
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
