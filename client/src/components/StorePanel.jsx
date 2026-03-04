import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useGameStore } from '../stores/gameStore';

const PACK_ICONS = { novice: '🔮', disciple: '💎', seigneur: '👑', despote: '⚜' };
const TYPE_ICONS = { legion_skin: '⚔', circle_border: '🔵', alliance_banner: '🏴' };

export default function StorePanel() {
  const { t } = useTranslation();
  const storeData = useGameStore((s) => s.storeData);
  const loadStore = useGameStore((s) => s.loadStore);
  const myCosmetics = useGameStore((s) => s.myCosmetics);
  const loadMyCosmetics = useGameStore((s) => s.loadMyCosmetics);
  const purchaseCosmetic = useGameStore((s) => s.purchaseCosmetic);
  const equipCosmetic = useGameStore((s) => s.equipCosmetic);
  const startCheckout = useGameStore((s) => s.startCheckout);
  const startSubscription = useGameStore((s) => s.startSubscription);
  const cancelSubscription = useGameStore((s) => s.cancelSubscription);

  const [tab, setTab] = useState('relics');
  const [cosFilter, setCosFilter] = useState('all');
  const [loading, setLoading] = useState('');

  useEffect(() => { loadStore(); loadMyCosmetics(); }, []);

  if (!storeData) return <p className="text-muted text-center py-8">{t('common.loading')}</p>;

  const handleBuy = async (packId) => {
    setLoading(packId);
    await startCheckout(packId);
    setLoading('');
  };

  const handleSubscribe = async () => {
    setLoading('sub');
    await startSubscription();
    setLoading('');
  };

  const handleCancel = async () => {
    setLoading('cancel');
    await cancelSubscription();
    await loadStore();
    setLoading('');
  };

  const handlePurchaseCosmetic = async (cosmeticId) => {
    setLoading(cosmeticId);
    await purchaseCosmetic(cosmeticId);
    await loadStore();
    await loadMyCosmetics();
    setLoading('');
  };

  const handleEquip = async (cosmeticId, eq) => {
    await equipCosmetic(cosmeticId, eq);
    await loadStore();
    await loadMyCosmetics();
  };

  const filteredCosmetics = storeData.cosmetics?.filter(
    (c) => cosFilter === 'all' || c.type === cosFilter
  ) || [];

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-display text-gold">{t('store.title')}</h2>

      {/* Tabs */}
      <div className="flex gap-2">
        {['relics', 'subscription', 'cosmetics'].map((tb) => (
          <button key={tb} onClick={() => setTab(tb)}
            className={`px-3 py-1.5 rounded text-xs font-semibold transition-colors ${
              tab === tb ? 'bg-gold/20 text-gold border border-gold/40' : 'bg-elevated text-muted hover:text-parchment border border-border'
            }`}
          >
            {t(`store.${tb}_tab`)}
          </button>
        ))}
      </div>

      {/* Relics Tab */}
      {tab === 'relics' && (
        <div className="space-y-3">
          <p className="text-xs text-muted">
            {t('store.relics_count', { count: storeData.relics })}
          </p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {storeData.packs?.map((pack) => (
              <div key={pack.id} className="bg-elevated border border-border rounded-lg p-3 text-center space-y-2">
                <div className="text-2xl">{PACK_ICONS[pack.id] || '📦'}</div>
                <h3 className="text-sm font-display text-gold">{t(`store.pack_${pack.id}`)}</h3>
                <p className="text-lg font-bold text-parchment">{pack.relics} ★</p>
                {pack.bonus > 0 && (
                  <p className="text-[10px] text-green-400">{t('store.bonus', { percent: pack.bonus })}</p>
                )}
                <p className="text-xs text-muted">{(pack.price / 100).toFixed(2)}€</p>
                <button
                  onClick={() => handleBuy(pack.id)}
                  disabled={!storeData.stripeEnabled || loading === pack.id}
                  className="w-full py-1.5 text-xs rounded bg-gold/20 text-gold hover:bg-gold/30 disabled:opacity-40 transition-colors"
                >
                  {loading === pack.id ? '...' : !storeData.stripeEnabled ? t('store.stripe_unavailable') : t('store.buy')}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Subscription Tab */}
      {tab === 'subscription' && (
        <div className="bg-elevated border border-border rounded-lg p-4 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-display text-gold">{t('store.sub_title')}</h3>
            <span className={`text-[10px] px-2 py-0.5 rounded ${
              storeData.isPremium ? 'bg-gold/20 text-gold' : 'bg-border text-muted'
            }`}>
              {storeData.isPremium ? t('store.sub_active') : t('store.sub_inactive')}
            </span>
          </div>

          <p className="text-lg font-bold text-parchment">{t('store.sub_price')}</p>

          <ul className="space-y-1.5">
            {['production', 'building', 'tax', 'slots'].map((b) => (
              <li key={b} className="text-xs text-parchment flex items-center gap-2">
                <span className="text-gold">✦</span>
                {t(`store.sub_benefits.${b}`)}
              </li>
            ))}
          </ul>

          {storeData.isPremium ? (
            <button
              onClick={handleCancel}
              disabled={loading === 'cancel' || !storeData.stripeEnabled}
              className="px-4 py-2 text-xs rounded bg-blood/20 text-blood hover:bg-blood/30 disabled:opacity-40 transition-colors"
            >
              {loading === 'cancel' ? '...' : t('store.sub_cancel')}
            </button>
          ) : (
            <button
              onClick={handleSubscribe}
              disabled={loading === 'sub' || !storeData.stripeEnabled}
              className="px-4 py-2 text-xs rounded bg-gold/20 text-gold hover:bg-gold/30 disabled:opacity-40 transition-colors"
            >
              {loading === 'sub' ? '...' : !storeData.stripeEnabled ? t('store.stripe_unavailable') : t('store.sub_subscribe')}
            </button>
          )}
        </div>
      )}

      {/* Cosmetics Tab */}
      {tab === 'cosmetics' && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <p className="text-xs text-muted">{t('store.relics_count', { count: storeData.relics })}</p>
            <div className="flex gap-1 ml-auto">
              {[
                { key: 'all', label: '⊛' },
                { key: 'legion_skin', label: t('store.cosmetics_legion') },
                { key: 'circle_border', label: t('store.cosmetics_circle') },
                { key: 'alliance_banner', label: t('store.cosmetics_alliance') },
              ].map((f) => (
                <button key={f.key} onClick={() => setCosFilter(f.key)}
                  className={`px-2 py-0.5 rounded text-[10px] ${
                    cosFilter === f.key ? 'bg-gold/20 text-gold' : 'bg-elevated text-muted hover:text-parchment'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
            {filteredCosmetics.map((cos) => (
              <div key={cos.id} className="bg-elevated border border-border rounded-lg p-3 space-y-2">
                <div className="flex items-center gap-2">
                  <span className="text-sm">{TYPE_ICONS[cos.type] || '🎨'}</span>
                  <div
                    className="w-4 h-4 rounded-full border border-border"
                    style={{ backgroundColor: cos.color }}
                  />
                </div>
                <h4 className="text-xs font-semibold text-parchment">{cos.name}</h4>
                <p className="text-[10px] text-muted">{t('store.purchase_cost', { cost: cos.cost })}</p>

                {cos.owned ? (
                  <button
                    onClick={() => handleEquip(cos.id, !cos.equipped)}
                    className={`w-full py-1 text-[10px] rounded transition-colors ${
                      cos.equipped
                        ? 'bg-gold/20 text-gold hover:bg-gold/10'
                        : 'bg-elevated text-muted hover:text-parchment border border-border'
                    }`}
                  >
                    {cos.equipped ? t('store.equipped') : t('store.equip')}
                  </button>
                ) : (
                  <button
                    onClick={() => handlePurchaseCosmetic(cos.id)}
                    disabled={storeData.relics < cos.cost || loading === cos.id}
                    className="w-full py-1 text-[10px] rounded bg-gold/20 text-gold hover:bg-gold/30 disabled:opacity-40 transition-colors"
                  >
                    {loading === cos.id ? '...' : storeData.relics < cos.cost ? t('store.insufficient_relics') : t('store.buy_cosmetic')}
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
