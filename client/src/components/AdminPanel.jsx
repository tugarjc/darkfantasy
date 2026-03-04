import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useGameStore } from '../stores/gameStore';

const FACTION_LABELS = {
  none: 'factions.none',
  legion_cendres: 'factions.legion_cendres',
  ordre_vide: 'factions.ordre_vide',
  pacte_chaines: 'factions.pacte_chaines',
  culte_sang: 'factions.culte_sang',
};

export default function AdminPanel() {
  const { t } = useTranslation();
  const [view, setView] = useState('stats');

  return (
    <div>
      <h2 className="font-display text-2xl text-gold mb-4">{t('admin.title')}</h2>

      {/* Sub-navigation */}
      <div className="flex gap-2 mb-6 flex-wrap">
        {[
          ['stats', t('admin.stats')],
          ['players', t('admin.players')],
          ['announce', t('admin.announce')],
          ['audit', t('admin.audit')],
        ].map(([key, label]) => (
          <button
            key={key}
            onClick={() => setView(key)}
            className={`px-4 py-2 rounded text-sm font-medium transition-colors ${
              view === key ? 'bg-gold/20 text-gold border border-gold/40' : 'bg-surface text-muted hover:text-parchment border border-border'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {view === 'stats' && <StatsView />}
      {view === 'players' && <PlayersView />}
      {view === 'announce' && <AnnounceView />}
      {view === 'audit' && <AuditView />}
    </div>
  );
}

/* ── Stats View ── */
function StatsView() {
  const { t } = useTranslation();
  const { adminStats, adminLoading, loadAdminStats } = useGameStore();

  useEffect(() => { loadAdminStats(); }, []);

  if (adminLoading || !adminStats) {
    return <p className="text-muted animate-pulse">{t('admin.loading_stats')}</p>;
  }

  const stats = [
    [t('admin.total_players'), adminStats.totalPlayers],
    [t('admin.online_15min'), adminStats.onlinePlayers],
    [t('admin.banned'), adminStats.bannedPlayers],
    [t('admin.circles'), adminStats.totalCircles],
    [t('admin.alliances'), adminStats.totalAlliances],
    [t('admin.active_legions'), adminStats.activeLegions],
    [t('admin.market_offers'), adminStats.activeOffers],
    [t('admin.chat_messages'), adminStats.totalMessages],
  ];

  return (
    <div>
      {/* Stats grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
        {stats.map(([label, value]) => (
          <div key={label} className="bg-surface border border-border rounded-lg p-4 text-center">
            <div className="text-2xl font-display text-gold">{value}</div>
            <div className="text-xs text-muted mt-1">{label}</div>
          </div>
        ))}
      </div>

      {/* Top 10 */}
      {adminStats.topPlayers?.length > 0 && (
        <div>
          <h3 className="font-display text-lg text-parchment mb-3">{t('admin.top_10')}</h3>
          <div className="bg-surface border border-border rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-muted">
                  <th className="px-3 py-2 text-left">#</th>
                  <th className="px-3 py-2 text-left">{t('admin.player_header')}</th>
                  <th className="px-3 py-2 text-left">{t('admin.faction_header')}</th>
                  <th className="px-3 py-2 text-right">{t('admin.score_header')}</th>
                  <th className="px-3 py-2 text-center">{t('admin.status_header')}</th>
                </tr>
              </thead>
              <tbody>
                {adminStats.topPlayers.map((p, i) => (
                  <tr key={p.id} className="border-b border-border/50 hover:bg-deep/50">
                    <td className="px-3 py-2 text-muted">{i + 1}</td>
                    <td className="px-3 py-2 text-parchment">{p.username}</td>
                    <td className="px-3 py-2 text-muted">{t(FACTION_LABELS[p.faction] || p.faction)}</td>
                    <td className="px-3 py-2 text-right text-gold">{p.score?.toLocaleString()}</td>
                    <td className="px-3 py-2 text-center">
                      {p.is_admin && <span className="text-xs bg-gold/20 text-gold px-2 py-0.5 rounded">Admin</span>}
                      {p.is_banned && <span className="text-xs bg-blood/20 text-blood-glow px-2 py-0.5 rounded ml-1">Banni</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

/* ── Players View ── */
function PlayersView() {
  const { t } = useTranslation();
  const { adminPlayers, loadAdminPlayers, adminPlayerDetail, loadAdminPlayerDetail, adminBanPlayer, adminSetResources } = useGameStore();
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState(null);
  const [msg, setMsg] = useState('');

  useEffect(() => { loadAdminPlayers(); }, []);

  const doSearch = () => {
    loadAdminPlayers(search, 1);
  };

  const selectPlayer = (id) => {
    setSelectedId(id);
    loadAdminPlayerDetail(id);
    setMsg('');
  };

  const toggleBan = async (playerId, currentBanned) => {
    try {
      const result = await adminBanPlayer(playerId, !currentBanned);
      setMsg(result.message);
      loadAdminPlayers(search);
      if (selectedId === playerId) loadAdminPlayerDetail(playerId);
    } catch (err) {
      setMsg(err.message);
    }
  };

  return (
    <div className="flex flex-col lg:flex-row gap-4">
      {/* Player list */}
      <div className="lg:w-1/2">
        <div className="flex gap-2 mb-4">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && doSearch()}
            placeholder={t('admin.search_player')}
            className="flex-1 bg-deep border border-border rounded px-3 py-2 text-sm text-parchment placeholder:text-muted/50 focus:border-gold/50 outline-none"
          />
          <button onClick={doSearch} className="bg-gold/20 text-gold px-4 py-2 rounded text-sm hover:bg-gold/30 transition-colors">
            {t('common.search')}
          </button>
        </div>

        {adminPlayers && (
          <>
            <p className="text-xs text-muted mb-2">{t('admin.player_count', { count: adminPlayers.total })} — page {adminPlayers.page}/{adminPlayers.totalPages || 1}</p>
            <div className="space-y-1">
              {adminPlayers.players?.map((p) => (
                <div
                  key={p.id}
                  onClick={() => selectPlayer(p.id)}
                  className={`flex items-center justify-between p-3 rounded cursor-pointer border transition-colors ${
                    selectedId === p.id ? 'bg-gold/10 border-gold/30' : 'bg-surface border-border hover:border-border/80'
                  }`}
                >
                  <div>
                    <span className="text-parchment text-sm font-medium">{p.username}</span>
                    {p.alliance_tag && <span className="text-muted text-xs ml-2">[{p.alliance_tag}]</span>}
                    <div className="text-xs text-muted">{t(FACTION_LABELS[p.faction] || p.faction)} — Score: {p.score?.toLocaleString()}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    {p.is_admin && <span className="text-xs bg-gold/20 text-gold px-2 py-0.5 rounded">Admin</span>}
                    {p.is_banned && <span className="text-xs bg-blood/20 text-blood-glow px-2 py-0.5 rounded">Banni</span>}
                    {!p.is_admin && (
                      <button
                        onClick={(e) => { e.stopPropagation(); toggleBan(p.id, p.is_banned); }}
                        className={`text-xs px-2 py-1 rounded ${
                          p.is_banned ? 'bg-green-900/30 text-green-400 hover:bg-green-900/50' : 'bg-blood/20 text-blood-glow hover:bg-blood/30'
                        }`}
                      >
                        {p.is_banned ? t('admin.unban') : t('admin.ban')}
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* Pagination */}
            {adminPlayers.totalPages > 1 && (
              <div className="flex gap-2 mt-4 justify-center">
                {adminPlayers.page > 1 && (
                  <button onClick={() => loadAdminPlayers(search, adminPlayers.page - 1)} className="text-xs text-muted hover:text-parchment px-3 py-1 bg-surface rounded border border-border">
                    {t('common.previous')}
                  </button>
                )}
                <span className="text-xs text-muted py-1">{adminPlayers.page} / {adminPlayers.totalPages}</span>
                {adminPlayers.page < adminPlayers.totalPages && (
                  <button onClick={() => loadAdminPlayers(search, adminPlayers.page + 1)} className="text-xs text-muted hover:text-parchment px-3 py-1 bg-surface rounded border border-border">
                    {t('common.next')}
                  </button>
                )}
              </div>
            )}
          </>
        )}
      </div>

      {/* Player detail */}
      <div className="lg:w-1/2">
        {msg && <div className="text-sm text-gold bg-gold/10 border border-gold/30 rounded p-2 mb-3">{msg}</div>}
        {selectedId && adminPlayerDetail ? (
          <PlayerDetail detail={adminPlayerDetail} onMsg={setMsg} />
        ) : (
          <div className="text-muted text-sm bg-surface border border-border rounded-lg p-8 text-center">
            {t('admin.select_player')}
          </div>
        )}
      </div>
    </div>
  );
}

/* ── Player Detail ── */
function PlayerDetail({ detail, onMsg }) {
  const { t } = useTranslation();
  const { adminSetResources, loadAdminPlayerDetail } = useGameStore();
  const { player, circles, heroes, researches } = detail;
  const [iron, setIron] = useState('');
  const [essence, setEssence] = useState('');
  const [souls, setSouls] = useState('');

  const primaryCircle = circles?.find((c) => c.is_primary);

  useEffect(() => {
    if (primaryCircle) {
      setIron(primaryCircle.iron?.toString() || '');
      setEssence(primaryCircle.essence?.toString() || '');
      setSouls(primaryCircle.souls?.toString() || '');
    }
  }, [primaryCircle?.iron, primaryCircle?.essence, primaryCircle?.souls]);

  const saveResources = async () => {
    try {
      const result = await adminSetResources(player.id, {
        iron: parseInt(iron) || 0,
        essence: parseInt(essence) || 0,
        souls: parseInt(souls) || 0,
      });
      onMsg(result.message);
      loadAdminPlayerDetail(player.id);
    } catch (err) {
      onMsg(err.message);
    }
  };

  return (
    <div className="bg-surface border border-border rounded-lg p-4 space-y-4">
      <div>
        <h3 className="font-display text-lg text-gold">{player.username}</h3>
        <div className="text-xs text-muted space-y-1 mt-1">
          <div>Email: {player.email}</div>
          <div>Faction: {t(FACTION_LABELS[player.faction] || player.faction)}</div>
          <div>Score: {player.score?.toLocaleString()}</div>
          <div>{t('admin.registration') + ':'} {new Date(player.created_at).toLocaleDateString('fr-FR')}</div>
          <div>{t('admin.last_login') + ':'} {player.last_login ? new Date(player.last_login).toLocaleString('fr-FR') : t('admin.never')}</div>
          {player.alliance_name && <div>Alliance: [{player.alliance_tag}] {player.alliance_name}</div>}
          <div className="flex gap-2 mt-1">
            {player.is_premium && <span className="text-xs bg-purple-900/30 text-purple-400 px-2 py-0.5 rounded">Premium</span>}
            {player.is_admin && <span className="text-xs bg-gold/20 text-gold px-2 py-0.5 rounded">Admin</span>}
            {player.is_banned && <span className="text-xs bg-blood/20 text-blood-glow px-2 py-0.5 rounded">Banni</span>}
          </div>
        </div>
      </div>

      {/* Circles */}
      {circles?.length > 0 && (
        <div>
          <h4 className="text-sm font-medium text-parchment mb-1">{t('admin.circles_label')} ({circles.length})</h4>
          <div className="space-y-1">
            {circles.map((c) => (
              <div key={c.id} className="text-xs text-muted bg-deep rounded p-2">
                {c.name} ({c.coord_q},{c.coord_r}) {c.is_primary && `(${t('admin.primary')})`}
                <span className="ml-2">Fer:{Math.floor(c.iron)} Ess:{Math.floor(c.essence)} Ames:{Math.floor(c.souls)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Resource editor */}
      {primaryCircle && (
        <div>
          <h4 className="text-sm font-medium text-parchment mb-2">{t('admin.edit_resources')}</h4>
          <div className="grid grid-cols-3 gap-2">
            <div>
              <label className="text-xs text-muted">Fer</label>
              <input value={iron} onChange={(e) => setIron(e.target.value)} className="w-full bg-deep border border-border rounded px-2 py-1 text-sm text-parchment outline-none focus:border-gold/50" />
            </div>
            <div>
              <label className="text-xs text-muted">Essence</label>
              <input value={essence} onChange={(e) => setEssence(e.target.value)} className="w-full bg-deep border border-border rounded px-2 py-1 text-sm text-parchment outline-none focus:border-gold/50" />
            </div>
            <div>
              <label className="text-xs text-muted">Ames</label>
              <input value={souls} onChange={(e) => setSouls(e.target.value)} className="w-full bg-deep border border-border rounded px-2 py-1 text-sm text-parchment outline-none focus:border-gold/50" />
            </div>
          </div>
          <button onClick={saveResources} className="mt-2 bg-gold/20 text-gold px-4 py-1.5 rounded text-sm hover:bg-gold/30 transition-colors">
            {t('common.apply')}
          </button>
        </div>
      )}

      {/* Heroes */}
      {heroes?.length > 0 && (
        <div>
          <h4 className="text-sm font-medium text-parchment mb-1">{t('admin.heroes_label')} ({heroes.length})</h4>
          <div className="flex flex-wrap gap-2">
            {heroes.map((h) => (
              <div key={h.type} className="text-xs bg-deep rounded px-2 py-1 text-muted">
                {h.type} Nv.{h.level} (XP:{h.xp})
                {h.is_deployed && <span className="text-gold ml-1">Deploye</span>}
                {h.is_dead && <span className="text-blood-glow ml-1">Mort</span>}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Researches */}
      {researches?.length > 0 && (
        <div>
          <h4 className="text-sm font-medium text-parchment mb-1">{t('admin.researches_label')} ({researches.length})</h4>
          <div className="flex flex-wrap gap-2">
            {researches.map((r) => (
              <span key={r.type} className="text-xs bg-deep rounded px-2 py-1 text-muted">
                {r.type} Nv.{r.level}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/* ── Announce View ── */
function AnnounceView() {
  const { t } = useTranslation();
  const { adminAnnounce } = useGameStore();
  const [message, setMessage] = useState('');
  const [status, setStatus] = useState('');

  const send = async () => {
    if (!message.trim()) return;
    try {
      await adminAnnounce(message.trim());
      setStatus(t('admin.announce_sent'));
      setMessage('');
    } catch (err) {
      setStatus(err.message);
    }
  };

  return (
    <div className="max-w-lg">
      <h3 className="font-display text-lg text-parchment mb-3">{t('admin.system_announce')}</h3>
      <p className="text-xs text-muted mb-3">{t('admin.announce_desc')}</p>

      <textarea
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        maxLength={500}
        rows={4}
        placeholder={t('admin.your_announce')}
        className="w-full bg-deep border border-border rounded px-3 py-2 text-sm text-parchment placeholder:text-muted/50 focus:border-gold/50 outline-none resize-none"
      />
      <div className="flex items-center justify-between mt-2">
        <span className="text-xs text-muted">{message.length}/500</span>
        <button onClick={send} disabled={!message.trim()} className="bg-gold/20 text-gold px-6 py-2 rounded text-sm hover:bg-gold/30 transition-colors disabled:opacity-30 disabled:cursor-not-allowed">
          {t('common.send')}
        </button>
      </div>
      {status && <p className="text-sm text-gold mt-3">{status}</p>}
    </div>
  );
}

/* ── Audit View ── */
function AuditView() {
  const { t } = useTranslation();
  const { adminAudit, loadAdminAudit } = useGameStore();

  useEffect(() => { loadAdminAudit(); }, []);

  if (!adminAudit) return <p className="text-muted animate-pulse">Chargement...</p>;

  return (
    <div>
      <h3 className="font-display text-lg text-parchment mb-3">{t('admin.audit_log')}</h3>
      <p className="text-xs text-muted mb-3">{adminAudit.total} {t('admin.entries')} — page {adminAudit.page}</p>

      <div className="bg-surface border border-border rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-muted">
              <th className="px-3 py-2 text-left">{t('admin.date')}</th>
              <th className="px-3 py-2 text-left">{t('admin.admin_col')}</th>
              <th className="px-3 py-2 text-left">{t('admin.action')}</th>
              <th className="px-3 py-2 text-left">{t('admin.target')}</th>
              <th className="px-3 py-2 text-left">{t('admin.details')}</th>
            </tr>
          </thead>
          <tbody>
            {adminAudit.logs?.map((log) => (
              <tr key={log.id} className="border-b border-border/50">
                <td className="px-3 py-2 text-muted text-xs">{new Date(log.created_at).toLocaleString('fr-FR')}</td>
                <td className="px-3 py-2 text-parchment">{log.admin_name}</td>
                <td className="px-3 py-2">
                  <span className={`text-xs px-2 py-0.5 rounded ${
                    log.action === 'ban' ? 'bg-blood/20 text-blood-glow' :
                    log.action === 'unban' ? 'bg-green-900/30 text-green-400' :
                    'bg-surface text-muted'
                  }`}>
                    {log.action}
                  </span>
                </td>
                <td className="px-3 py-2 text-muted">{log.target || '-'}</td>
                <td className="px-3 py-2 text-muted text-xs max-w-48 truncate">
                  {log.details && Object.keys(log.details).length > 0 ? JSON.stringify(log.details) : '-'}
                </td>
              </tr>
            ))}
            {(!adminAudit.logs || adminAudit.logs.length === 0) && (
              <tr><td colSpan={5} className="px-3 py-6 text-center text-muted">{t('admin.no_entries')}</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <div className="flex gap-2 mt-4 justify-center">
        {adminAudit.page > 1 && (
          <button onClick={() => loadAdminAudit(adminAudit.page - 1)} className="text-xs text-muted hover:text-parchment px-3 py-1 bg-surface rounded border border-border">
            {t('common.previous')}
          </button>
        )}
        {adminAudit.logs?.length >= 30 && (
          <button onClick={() => loadAdminAudit(adminAudit.page + 1)} className="text-xs text-muted hover:text-parchment px-3 py-1 bg-surface rounded border border-border">
            {t('common.next')}
          </button>
        )}
      </div>
    </div>
  );
}
