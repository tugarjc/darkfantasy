import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '../stores/authStore';

export default function AccountSettings() {
  const { t } = useTranslation();
  const { player, logout } = useAuthStore();
  const [profile, setProfile] = useState(null);
  const [exporting, setExporting] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deletePassword, setDeletePassword] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    const load = async () => {
      try {
        const token = localStorage.getItem('accessToken');
        const res = await fetch('/api/player/profile', { headers: { Authorization: `Bearer ${token}` } });
        if (res.ok) setProfile((await res.json()).player);
      } catch { /* silent */ }
    };
    load();
  }, []);

  const handleExport = async () => {
    setExporting(true);
    try {
      const token = localStorage.getItem('accessToken');
      const res = await fetch('/api/player/export', { headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) throw new Error('Export failed');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'inferno-domini-data-export.json';
      a.click();
      URL.revokeObjectURL(url);
    } catch { setError(t('common.error')); }
    setExporting(false);
  };

  const handleDelete = async () => {
    if (!deletePassword) { setError(t('account.password_required')); return; }
    setError('');
    try {
      const token = localStorage.getItem('accessToken');
      const res = await fetch('/api/player/account', {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: deletePassword }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error); return; }
      logout();
    } catch { setError(t('common.error')); }
  };

  return (
    <div>
      <h2 className="font-display text-2xl text-gold mb-6">{t('account.title')}</h2>

      {/* Profile info */}
      {profile && (
        <div className="bg-surface border border-border rounded-lg p-4 mb-6">
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div><span className="text-muted">{t('auth.username')}:</span> <span className="text-parchment">{profile.username}</span></div>
            <div><span className="text-muted">{t('auth.email')}:</span> <span className="text-parchment">{profile.email}</span></div>
            <div><span className="text-muted">{t('account.created')}:</span> <span className="text-parchment">{new Date(profile.created_at).toLocaleDateString()}</span></div>
            <div><span className="text-muted">{t('account.last_login')}:</span> <span className="text-parchment">{profile.last_login ? new Date(profile.last_login).toLocaleDateString() : '-'}</span></div>
          </div>
        </div>
      )}

      {/* GDPR Export */}
      <div className="bg-surface border border-border rounded-lg p-4 mb-6">
        <h3 className="font-display text-sm text-gold mb-2">{t('account.export')}</h3>
        <p className="text-xs text-muted mb-3">{t('account.export_desc')}</p>
        <button
          onClick={handleExport}
          disabled={exporting}
          className="px-4 py-2 bg-gold/10 border border-gold/30 rounded text-sm text-gold hover:bg-gold/20 disabled:opacity-50"
        >
          {exporting ? t('account.export_loading') : t('account.export')}
        </button>
      </div>

      {/* GDPR Delete */}
      <div className="bg-surface border border-blood/30 rounded-lg p-4">
        <h3 className="font-display text-sm text-blood-glow mb-2">{t('account.delete')}</h3>
        <p className="text-xs text-muted mb-3">{t('account.delete_warning')}</p>

        {!deleting ? (
          <button
            onClick={() => setDeleting(true)}
            className="px-4 py-2 bg-blood/20 border border-blood rounded text-sm text-blood-glow hover:bg-blood/30"
          >
            {t('account.delete')}
          </button>
        ) : (
          <div className="space-y-3">
            <p className="text-xs text-blood-glow">{t('account.delete_confirm')}</p>
            <input
              type="password"
              value={deletePassword}
              onChange={(e) => setDeletePassword(e.target.value)}
              placeholder={t('auth.password')}
              className="w-full px-3 py-2 bg-base border border-border rounded text-sm text-parchment outline-none focus:border-blood"
            />
            {error && <p className="text-xs text-blood-glow" role="alert">{error}</p>}
            <div className="flex gap-2">
              <button
                onClick={handleDelete}
                className="px-4 py-2 bg-blood border border-blood-glow rounded text-sm text-parchment hover:bg-blood-light"
              >
                {t('account.confirm_delete')}
              </button>
              <button
                onClick={() => { setDeleting(false); setDeletePassword(''); setError(''); }}
                className="px-4 py-2 bg-surface border border-border rounded text-sm text-muted hover:text-parchment"
              >
                {t('common.cancel')}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
