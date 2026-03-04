import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import i18n from 'i18next';
import { useGameStore } from '../stores/gameStore';
import ConfirmDialog from './ui/ConfirmDialog';
import { useToastStore } from './ui/Toast';

const RES_LABELS = { iron: 'common.iron', essence: 'common.essence', souls: 'common.souls' };
const RES_COLORS = { iron: 'text-iron', essence: 'text-essence', souls: 'text-souls' };

function fmtNum(n) {
  if (n >= 1e6) return (n / 1e6).toFixed(1) + 'M';
  if (n >= 1e3) return (n / 1e3).toFixed(1) + 'K';
  return Math.round(n).toLocaleString('fr-FR');
}

function timeLeft(expiresAt) {
  const ms = new Date(expiresAt).getTime() - Date.now();
  if (ms <= 0) return i18n.t('market.expired');
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  return `${h}h ${m}m`;
}

export default function MarketPanel() {
  const { t } = useTranslation();
  const marketData = useGameStore((s) => s.marketData);
  const marketLoading = useGameStore((s) => s.marketLoading);
  const loadMarket = useGameStore((s) => s.loadMarket);

  const [section, setSection] = useState('public'); // 'public' | 'create' | 'mine' | 'incoming'

  useEffect(() => {
    loadMarket();
  }, []);

  const marcheLevel = marketData?.marcheLevel || 0;

  return (
    <div>
      <div className="text-center mb-4">
        <h2 className="font-display text-2xl text-gold mb-1">{t('market.title')}</h2>
        <p className="text-muted text-sm">
          Nv.{marcheLevel} | {t('market.tax')}: {((marketData?.taxRate || 0.15) * 100).toFixed(1)}% | {t('market.max_offers')}: {marketData?.maxOffers || 0}
        </p>
      </div>

      {marcheLevel < 1 && (
        <p className="text-muted text-sm text-center mb-4">
          {t('market.build_market')}
        </p>
      )}

      {/* Section tabs */}
      <div className="flex gap-1 mb-4 flex-wrap justify-center">
        <SectionBtn label={t('market.public_offers')} active={section === 'public'} onClick={() => setSection('public')}
          count={marketData?.publicOffers?.length} />
        <SectionBtn label={t('market.create_offer')} active={section === 'create'} onClick={() => setSection('create')} />
        <SectionBtn label={t('market.my_offers')} active={section === 'mine'} onClick={() => setSection('mine')}
          count={marketData?.myOffers?.length} />
        <SectionBtn label={t('market.incoming_offers')} active={section === 'incoming'} onClick={() => setSection('incoming')}
          count={marketData?.incomingOffers?.length} />
      </div>

      {marketLoading && <p className="text-gold text-sm animate-pulse mb-4">{t('common.loading')}</p>}

      {section === 'public' && <PublicOffers />}
      {section === 'create' && <CreateOffer />}
      {section === 'mine' && <MyOffers />}
      {section === 'incoming' && <IncomingOffers />}
    </div>
  );
}

function SectionBtn({ label, active, onClick, count }) {
  return (
    <button
      onClick={onClick}
      className={`px-3 py-1.5 text-xs rounded border transition-colors ${
        active ? 'border-gold text-gold bg-gold/10' : 'border-border text-muted hover:text-parchment hover:border-gold/30'
      }`}
    >
      {label}{count != null && count > 0 ? ` (${count})` : ''}
    </button>
  );
}

function PublicOffers() {
  const { t } = useTranslation();
  const offers = useGameStore((s) => s.marketData?.publicOffers || []);
  const acceptOffer = useGameStore((s) => s.acceptOffer);
  const [accepting, setAccepting] = useState(null);
  const [error, setError] = useState(null);

  const handleAccept = async (id) => {
    setError(null);
    setAccepting(id);
    try {
      await acceptOffer(id);
    } catch (err) {
      setError(err.message);
    } finally {
      setAccepting(null);
    }
  };

  if (offers.length === 0) {
    return <p className="text-muted text-sm text-center">{t('market.no_offers')}</p>;
  }

  return (
    <div>
      {error && <p className="text-blood-glow text-sm mb-3">{error}</p>}
      <div className="space-y-2">
        {offers.map((o) => (
          <div key={o.id} className="bg-surface border border-border rounded-lg p-3 flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2 text-sm">
                <span className={RES_COLORS[o.resource_from]}>{fmtNum(o.amount)} {t(RES_LABELS[o.resource_from])}</span>
                <span className="text-muted">→</span>
                <span className={RES_COLORS[o.resource_to]}>{fmtNum(Math.ceil(o.amount * o.ratio))} {t(RES_LABELS[o.resource_to])}</span>
              </div>
              <div className="flex gap-3 text-xs text-muted mt-1">
                <span>{t('market.seller')}: {o.seller_name}</span>
                <span>Ratio: {o.ratio}:1</span>
                <span>{timeLeft(o.expires_at)}</span>
              </div>
            </div>
            <button
              onClick={() => handleAccept(o.id)}
              disabled={accepting === o.id}
              className="px-3 py-1.5 text-xs bg-blood border border-gold rounded text-parchment hover:bg-blood-light transition-colors disabled:opacity-50"
            >
              {accepting === o.id ? '...' : t('common.accept')}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

function CreateOffer() {
  const { t } = useTranslation();
  const createOffer = useGameStore((s) => s.createOffer);
  const resources = useGameStore((s) => s.resources);

  const [from, setFrom] = useState('iron');
  const [to, setTo] = useState('essence');
  const [amount, setAmount] = useState('');
  const [ratio, setRatio] = useState('1');
  const [target, setTarget] = useState('');
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState(null);
  const addToast = useToastStore((s) => s.addToast);

  // Auto-switch to avoid same resource
  useEffect(() => {
    if (from === to) {
      const options = ['iron', 'essence', 'souls'].filter(r => r !== from);
      setTo(options[0]);
    }
  }, [from]);

  const handleCreate = async (e) => {
    e.preventDefault();
    setError(null);
    setCreating(true);
    try {
      await createOffer(from, to, parseInt(amount), parseFloat(ratio), target || undefined);
      addToast(t('market.offer_created'), 'success');
      setAmount('');
    } catch (err) {
      setError(err.message);
    } finally {
      setCreating(false);
    }
  };

  const youPay = parseInt(amount) || 0;
  const youReceive = Math.ceil(youPay * (parseFloat(ratio) || 0));

  return (
    <form onSubmit={handleCreate} className="max-w-md mx-auto bg-surface border border-border rounded-lg p-6">
      <h3 className="font-display text-lg text-gold mb-4">{t('market.new_offer')}</h3>

      {error && <p className="text-blood-glow text-sm mb-3">{error}</p>}

      <div className="grid grid-cols-2 gap-3 mb-4">
        <div>
          <label className="block text-xs text-muted mb-1">{t('market.you_sell')}</label>
          <select value={from} onChange={(e) => setFrom(e.target.value)}
            className="w-full bg-base border border-border rounded px-3 py-2 text-sm text-parchment focus:border-gold focus:outline-none">
            <option value="iron">{t('common.iron')}</option>
            <option value="essence">{t('common.essence')}</option>
            <option value="souls">{t('common.souls')}</option>
          </select>
          <p className="text-[10px] text-muted mt-1">{t('market.available_resource')}: {fmtNum(resources?.[from] || 0)}</p>
        </div>
        <div>
          <label className="block text-xs text-muted mb-1">{t('market.you_want')}</label>
          <select value={to} onChange={(e) => setTo(e.target.value)}
            className="w-full bg-base border border-border rounded px-3 py-2 text-sm text-parchment focus:border-gold focus:outline-none">
            {['iron', 'essence', 'souls'].filter(r => r !== from).map(r => (
              <option key={r} value={r}>{t(RES_LABELS[r])}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 mb-4">
        <div>
          <label className="block text-xs text-muted mb-1">{t('market.amount')}</label>
          <input type="number" value={amount} onChange={(e) => setAmount(e.target.value)}
            min="1" max="50000"
            className="w-full bg-base border border-border rounded px-3 py-2 text-sm text-parchment focus:border-gold focus:outline-none"
            placeholder="1000" />
        </div>
        <div>
          <label className="block text-xs text-muted mb-1">{t('market.ratio')}</label>
          <input type="number" value={ratio} onChange={(e) => setRatio(e.target.value)}
            min="0.1" max="10" step="0.1"
            className="w-full bg-base border border-border rounded px-3 py-2 text-sm text-parchment focus:border-gold focus:outline-none" />
        </div>
      </div>

      {youPay > 0 && (
        <div className="bg-base rounded p-2 mb-4 text-center text-xs">
          <span className={RES_COLORS[from]}>{fmtNum(youPay)} {t(RES_LABELS[from])}</span>
          <span className="text-muted mx-2">{t('market.against')}</span>
          <span className={RES_COLORS[to]}>{fmtNum(youReceive)} {t(RES_LABELS[to])}</span>
        </div>
      )}

      <div className="mb-4">
        <label className="block text-xs text-muted mb-1">{t('market.target_player')}</label>
        <input type="text" value={target} onChange={(e) => setTarget(e.target.value)}
          className="w-full bg-base border border-border rounded px-3 py-2 text-sm text-parchment focus:border-gold focus:outline-none"
          placeholder={t('market.player_name')} />
      </div>

      <button type="submit"
        disabled={creating || !amount || parseInt(amount) < 1}
        className="w-full py-2.5 rounded font-display text-base transition-all duration-300 bg-blood border border-gold text-parchment hover:bg-blood-light hover:shadow-[0_0_15px_rgba(139,26,26,0.4)] disabled:opacity-50 disabled:cursor-not-allowed">
        {creating ? t('market.creating') : t('market.publish')}
      </button>
    </form>
  );
}

function MyOffers() {
  const { t } = useTranslation();
  const offers = useGameStore((s) => s.marketData?.myOffers || []);
  const cancelOffer = useGameStore((s) => s.cancelOffer);
  const [cancelling, setCancelling] = useState(null);
  const [error, setError] = useState(null);
  const [confirmCancel, setConfirmCancel] = useState(null);

  const handleCancel = async (id) => {
    setError(null);
    setCancelling(id);
    try {
      await cancelOffer(id);
    } catch (err) {
      setError(err.message);
    } finally {
      setCancelling(null);
    }
  };

  if (offers.length === 0) {
    return <p className="text-muted text-sm text-center">{t('market.no_active')}</p>;
  }

  return (
    <div>
      {error && <p className="text-blood-glow text-sm mb-3">{error}</p>}
      {confirmCancel && (
        <ConfirmDialog
          message={t('market.confirm_cancel') || 'Annuler cette offre ?'}
          onConfirm={() => { handleCancel(confirmCancel); setConfirmCancel(null); }}
          onCancel={() => setConfirmCancel(null)}
        />
      )}
      <div className="space-y-2">
        {offers.map((o) => (
          <div key={o.id} className="bg-surface border border-border rounded-lg p-3 flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2 text-sm">
                <span className={RES_COLORS[o.resource_from]}>{fmtNum(o.amount)} {t(RES_LABELS[o.resource_from])}</span>
                <span className="text-muted">→</span>
                <span className={RES_COLORS[o.resource_to]}>{fmtNum(Math.ceil(o.amount * o.ratio))} {t(RES_LABELS[o.resource_to])}</span>
              </div>
              <div className="flex gap-3 text-xs text-muted mt-1">
                <span>{o.target_name ? `${t('market.private')}: ${o.target_name}` : t('market.public')}</span>
                <span>{timeLeft(o.expires_at)}</span>
              </div>
            </div>
            <button
              onClick={() => setConfirmCancel(o.id)}
              disabled={cancelling === o.id}
              className="px-3 py-1.5 text-xs border border-border rounded text-muted hover:text-blood-glow hover:border-blood transition-colors disabled:opacity-50"
            >
              {cancelling === o.id ? '...' : t('common.cancel')}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

function IncomingOffers() {
  const { t } = useTranslation();
  const offers = useGameStore((s) => s.marketData?.incomingOffers || []);
  const acceptOffer = useGameStore((s) => s.acceptOffer);
  const [accepting, setAccepting] = useState(null);
  const [error, setError] = useState(null);

  const handleAccept = async (id) => {
    setError(null);
    setAccepting(id);
    try {
      await acceptOffer(id);
    } catch (err) {
      setError(err.message);
    } finally {
      setAccepting(null);
    }
  };

  if (offers.length === 0) {
    return <p className="text-muted text-sm text-center">{t('market.no_incoming')}</p>;
  }

  return (
    <div>
      {error && <p className="text-blood-glow text-sm mb-3">{error}</p>}
      <div className="space-y-2">
        {offers.map((o) => (
          <div key={o.id} className="bg-surface border border-gold/20 rounded-lg p-3 flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2 text-sm">
                <span className={RES_COLORS[o.resource_from]}>{fmtNum(o.amount)} {t(RES_LABELS[o.resource_from])}</span>
                <span className="text-muted">→</span>
                <span className={RES_COLORS[o.resource_to]}>{fmtNum(Math.ceil(o.amount * o.ratio))} {t(RES_LABELS[o.resource_to])}</span>
              </div>
              <div className="flex gap-3 text-xs text-muted mt-1">
                <span>{t('market.from')}: {o.seller_name}</span>
                <span>Ratio: {o.ratio}:1</span>
                <span>{timeLeft(o.expires_at)}</span>
              </div>
            </div>
            <button
              onClick={() => handleAccept(o.id)}
              disabled={accepting === o.id}
              className="px-3 py-1.5 text-xs bg-blood border border-gold rounded text-parchment hover:bg-blood-light transition-colors disabled:opacity-50"
            >
              {accepting === o.id ? '...' : t('common.accept')}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
