import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '../stores/authStore';

export default function Register() {
  const { t } = useTranslation();
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [localError, setLocalError] = useState('');
  const { register, loading, error, clearError } = useAuthStore();

  const handleSubmit = (e) => {
    e.preventDefault();
    setLocalError('');
    if (password !== confirm) {
      setLocalError(t('auth.password_mismatch'));
      return;
    }
    register(username, email, password);
  };

  const displayError = localError || error;

  return (
    <div className="min-h-screen bg-deep flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <Link to="/" className="block text-center mb-8">
          <h1 className="font-display text-3xl text-gold">INFERNO DOMINI</h1>
        </Link>

        <form onSubmit={handleSubmit} className="bg-surface border border-border rounded-lg p-8">
          <h2 className="font-display text-2xl text-parchment mb-6 text-center">{t('auth.register_title')}</h2>

          {displayError && (
            <div className="bg-blood/20 border border-blood rounded p-3 mb-4 text-sm text-blood-glow">
              {displayError}
              <button onClick={() => { clearError(); setLocalError(''); }} className="float-right text-muted hover:text-parchment">&times;</button>
            </div>
          )}

          <label className="block mb-4">
            <span className="text-muted text-sm">{t('auth.username')}</span>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
              minLength={3}
              maxLength={32}
              className="mt-1 w-full bg-base border border-border rounded px-4 py-2 text-parchment
                         focus:border-blood focus:outline-none transition-colors"
              placeholder="Maledictus"
            />
          </label>

          <label className="block mb-4">
            <span className="text-muted text-sm">{t('auth.email')}</span>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="mt-1 w-full bg-base border border-border rounded px-4 py-2 text-parchment
                         focus:border-blood focus:outline-none transition-colors"
              placeholder="seigneur@inferno.com"
            />
          </label>

          <label className="block mb-4">
            <span className="text-muted text-sm">{t('auth.password_min')}</span>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={8}
              className="mt-1 w-full bg-base border border-border rounded px-4 py-2 text-parchment
                         focus:border-blood focus:outline-none transition-colors"
              placeholder="••••••••"
            />
          </label>

          <label className="block mb-6">
            <span className="text-muted text-sm">{t('auth.confirm_password')}</span>
            <input
              type="password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              required
              minLength={8}
              className="mt-1 w-full bg-base border border-border rounded px-4 py-2 text-parchment
                         focus:border-blood focus:outline-none transition-colors"
              placeholder="••••••••"
            />
          </label>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 bg-blood border border-gold rounded font-display text-lg text-parchment
                       hover:bg-blood-light disabled:opacity-50 transition-all duration-300"
          >
            {loading ? t('auth.register_loading') : t('auth.register_button')}
          </button>

          <p className="mt-6 text-center text-sm text-muted">
            {t('auth.has_account')}{' '}
            <Link to="/login" className="text-gold hover:text-gold-light transition-colors">
              {t('auth.login_title')}
            </Link>
          </p>
        </form>
      </div>
    </div>
  );
}
