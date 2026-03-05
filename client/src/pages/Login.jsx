import { useState, useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '../stores/authStore';

export default function Login() {
  const { t } = useTranslation();
  const [searchParams] = useSearchParams();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [mode, setMode] = useState('login'); // login | forgot | reset | resetSuccess
  const [forgotSent, setForgotSent] = useState(false);
  const { login, forgotPassword, resetPassword, loading, error, clearError } = useAuthStore();

  const resetToken = searchParams.get('reset');

  useEffect(() => {
    if (resetToken) setMode('reset');
  }, [resetToken]);

  const handleLogin = (e) => {
    e.preventDefault();
    login(email, password);
  };

  const handleForgot = async (e) => {
    e.preventDefault();
    const ok = await forgotPassword(email);
    if (ok) setForgotSent(true);
  };

  const handleReset = async (e) => {
    e.preventDefault();
    if (password !== confirmPassword) {
      useAuthStore.setState({ error: t('auth.password_mismatch') });
      return;
    }
    const ok = await resetPassword(resetToken, password);
    if (ok) setMode('resetSuccess');
  };

  return (
    <div className="min-h-screen bg-deep flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <Link to="/" className="block text-center mb-8">
          <h1 className="font-display text-3xl text-gold">INFERNO DOMINI</h1>
        </Link>

        <form onSubmit={mode === 'login' ? handleLogin : mode === 'forgot' ? handleForgot : handleReset} className="bg-surface border border-border rounded-lg p-8">
          {/* Title */}
          <h2 className="font-display text-2xl text-parchment mb-6 text-center">
            {mode === 'login' && t('auth.login_title')}
            {mode === 'forgot' && t('auth.forgot_password')}
            {mode === 'reset' && t('auth.reset_password')}
            {mode === 'resetSuccess' && t('auth.reset_password')}
          </h2>

          {/* Error */}
          {error && (
            <div role="alert" className="bg-blood/20 border border-blood rounded p-3 mb-4 text-sm text-blood-glow">
              {error}
              <button onClick={clearError} className="float-right text-muted hover:text-parchment" aria-label={t('common.close')}>&times;</button>
            </div>
          )}

          {/* Reset success */}
          {mode === 'resetSuccess' && (
            <div className="text-center">
              <div className="bg-gold/10 border border-gold rounded p-4 mb-4 text-sm text-gold">
                {t('auth.reset_success')}
              </div>
              <button type="button" onClick={() => { setMode('login'); clearError(); }} className="text-gold hover:text-gold-light transition-colors">
                {t('auth.login_button')}
              </button>
            </div>
          )}

          {/* Login form */}
          {mode === 'login' && (
            <>
              <label className="block mb-4">
                <span className="text-muted text-sm">{t('auth.email')}</span>
                <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required
                  className="mt-1 w-full bg-base border border-border rounded px-4 py-2 text-parchment focus:border-blood focus:outline-none transition-colors"
                  placeholder="seigneur@inferno.com" />
              </label>
              <label className="block mb-4">
                <span className="text-muted text-sm">{t('auth.password')}</span>
                <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={8}
                  className="mt-1 w-full bg-base border border-border rounded px-4 py-2 text-parchment focus:border-blood focus:outline-none transition-colors"
                  placeholder="••••••••" />
              </label>
              <div className="mb-6 text-right">
                <button type="button" onClick={() => { setMode('forgot'); clearError(); }}
                  className="text-xs text-muted hover:text-gold transition-colors">
                  {t('auth.forgot_password')}
                </button>
              </div>
              <button type="submit" disabled={loading}
                className="w-full py-3 bg-blood border border-gold rounded font-display text-lg text-parchment hover:bg-blood-light disabled:opacity-50 transition-all duration-300">
                {loading ? t('auth.login_loading') : t('auth.login_button')}
              </button>
              <p className="mt-6 text-center text-sm text-muted">
                {t('auth.no_account')}{' '}
                <Link to="/register" className="text-gold hover:text-gold-light transition-colors">{t('landing.join')}</Link>
              </p>
            </>
          )}

          {/* Forgot password form */}
          {mode === 'forgot' && !forgotSent && (
            <>
              <label className="block mb-6">
                <span className="text-muted text-sm">{t('auth.email')}</span>
                <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required
                  className="mt-1 w-full bg-base border border-border rounded px-4 py-2 text-parchment focus:border-blood focus:outline-none transition-colors"
                  placeholder="seigneur@inferno.com" />
              </label>
              <button type="submit" disabled={loading}
                className="w-full py-3 bg-blood border border-gold rounded font-display text-lg text-parchment hover:bg-blood-light disabled:opacity-50 transition-all duration-300">
                {loading ? t('common.loading') : t('common.send')}
              </button>
              <p className="mt-4 text-center">
                <button type="button" onClick={() => { setMode('login'); clearError(); }} className="text-sm text-muted hover:text-gold transition-colors">
                  {t('common.back')}
                </button>
              </p>
            </>
          )}

          {/* Forgot password sent */}
          {mode === 'forgot' && forgotSent && (
            <div className="text-center">
              <div className="bg-gold/10 border border-gold rounded p-4 mb-4 text-sm text-gold">
                {t('auth.forgot_email_sent')}
              </div>
              <button type="button" onClick={() => { setMode('login'); setForgotSent(false); clearError(); }}
                className="text-sm text-muted hover:text-gold transition-colors">
                {t('common.back')}
              </button>
            </div>
          )}

          {/* Reset password form */}
          {mode === 'reset' && (
            <>
              <label className="block mb-4">
                <span className="text-muted text-sm">{t('auth.new_password')}</span>
                <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={8}
                  className="mt-1 w-full bg-base border border-border rounded px-4 py-2 text-parchment focus:border-blood focus:outline-none transition-colors"
                  placeholder="••••••••" />
              </label>
              <label className="block mb-6">
                <span className="text-muted text-sm">{t('auth.confirm_new_password')}</span>
                <input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} required minLength={8}
                  className="mt-1 w-full bg-base border border-border rounded px-4 py-2 text-parchment focus:border-blood focus:outline-none transition-colors"
                  placeholder="••••••••" />
              </label>
              <button type="submit" disabled={loading}
                className="w-full py-3 bg-blood border border-gold rounded font-display text-lg text-parchment hover:bg-blood-light disabled:opacity-50 transition-all duration-300">
                {loading ? t('common.loading') : t('auth.reset_password')}
              </button>
            </>
          )}
        </form>
      </div>
    </div>
  );
}
