import { useState, useEffect, useCallback } from 'react';
import { useGameStore } from '../stores/gameStore';

const ROLE_LABELS = { leader: 'Seigneur', officer: 'Officier', member: 'Membre' };
const ROLE_COLORS = { leader: 'text-gold', officer: 'text-essence', member: 'text-muted' };

const DIPLO_LABELS = {
  neutralite: 'Neutralite',
  guerre: 'Guerre',
  paix: 'Paix',
  alliance_militaire: 'Alliance Militaire',
};
const DIPLO_COLORS = {
  neutralite: 'text-muted',
  guerre: 'text-blood-glow',
  paix: 'text-green-400',
  alliance_militaire: 'text-gold',
};

export default function AlliancePanel() {
  const alliance = useGameStore((s) => s.alliance);
  const allianceLoading = useGameStore((s) => s.allianceLoading);
  const loadAlliance = useGameStore((s) => s.loadAlliance);

  useEffect(() => {
    loadAlliance();
  }, []);

  if (allianceLoading && !alliance) {
    return <p className="text-gold text-sm animate-pulse">Chargement...</p>;
  }

  return alliance ? <AllianceView /> : <NoAllianceView />;
}

// ── No Alliance: Create or Join ──
function NoAllianceView() {
  const [mode, setMode] = useState('search'); // 'search' | 'create'

  return (
    <div>
      <div className="text-center mb-6">
        <h2 className="font-display text-2xl text-gold mb-2">Alliances</h2>
        <p className="text-muted text-sm">Rejoignez une alliance ou fondez la votre</p>
      </div>

      <div className="flex gap-2 mb-4 justify-center">
        <button
          onClick={() => setMode('search')}
          className={`px-4 py-2 text-sm rounded border transition-colors ${
            mode === 'search' ? 'border-gold text-gold bg-gold/10' : 'border-border text-muted hover:text-parchment'
          }`}
        >
          Rechercher
        </button>
        <button
          onClick={() => setMode('create')}
          className={`px-4 py-2 text-sm rounded border transition-colors ${
            mode === 'create' ? 'border-gold text-gold bg-gold/10' : 'border-border text-muted hover:text-parchment'
          }`}
        >
          Creer une Alliance
        </button>
      </div>

      {mode === 'search' ? <SearchAlliance /> : <CreateAlliance />}
    </div>
  );
}

function CreateAlliance() {
  const createAlliance = useGameStore((s) => s.createAlliance);
  const [name, setName] = useState('');
  const [tag, setTag] = useState('');
  const [error, setError] = useState(null);
  const [creating, setCreating] = useState(false);

  const handleCreate = async (e) => {
    e.preventDefault();
    setError(null);
    setCreating(true);
    try {
      await createAlliance(name, tag);
    } catch (err) {
      setError(err.message);
    } finally {
      setCreating(false);
    }
  };

  return (
    <form onSubmit={handleCreate} className="max-w-md mx-auto bg-surface border border-border rounded-lg p-6">
      <h3 className="font-display text-lg text-gold mb-4">Fonder une Alliance</h3>

      {error && <p className="text-blood-glow text-sm mb-3">{error}</p>}

      <div className="mb-4">
        <label className="block text-xs text-muted mb-1">Nom (3-64 caracteres)</label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={64}
          className="w-full bg-base border border-border rounded px-3 py-2 text-sm text-parchment focus:border-gold focus:outline-none"
          placeholder="Les Seigneurs de l'Ombre"
        />
      </div>

      <div className="mb-4">
        <label className="block text-xs text-muted mb-1">Tag (2-8 caracteres)</label>
        <input
          type="text"
          value={tag}
          onChange={(e) => setTag(e.target.value.toUpperCase())}
          maxLength={8}
          className="w-full bg-base border border-border rounded px-3 py-2 text-sm text-parchment uppercase focus:border-gold focus:outline-none"
          placeholder="LSO"
        />
      </div>

      <button
        type="submit"
        disabled={creating || name.length < 3 || tag.length < 2}
        className="w-full py-2.5 rounded font-display text-base transition-all duration-300 bg-blood border border-gold text-parchment hover:bg-blood-light hover:shadow-[0_0_15px_rgba(139,26,26,0.4)] disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {creating ? 'Fondation...' : 'Fonder'}
      </button>
    </form>
  );
}

function SearchAlliance() {
  const searchAlliances = useGameStore((s) => s.searchAlliances);
  const joinAlliance = useGameStore((s) => s.joinAlliance);
  const results = useGameStore((s) => s.allianceSearchResults);

  const [query, setQuery] = useState('');
  const [joining, setJoining] = useState(null);
  const [error, setError] = useState(null);

  const handleSearch = useCallback(async () => {
    if (query.length >= 2) await searchAlliances(query);
  }, [query, searchAlliances]);

  const handleJoin = async (id) => {
    setError(null);
    setJoining(id);
    try {
      await joinAlliance(id);
    } catch (err) {
      setError(err.message);
    } finally {
      setJoining(null);
    }
  };

  return (
    <div className="max-w-lg mx-auto">
      <div className="flex gap-2 mb-4">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
          className="flex-1 bg-base border border-border rounded px-3 py-2 text-sm text-parchment focus:border-gold focus:outline-none"
          placeholder="Nom ou tag de l'alliance..."
        />
        <button
          onClick={handleSearch}
          disabled={query.length < 2}
          className="px-4 py-2 text-sm bg-surface border border-border rounded text-parchment hover:border-gold transition-colors disabled:opacity-50"
        >
          Chercher
        </button>
      </div>

      {error && <p className="text-blood-glow text-sm mb-3">{error}</p>}

      {results.length > 0 && (
        <div className="space-y-2">
          {results.map((a) => (
            <div key={a.id} className="bg-surface border border-border rounded-lg p-3 flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-gold font-display text-sm">[{a.tag}]</span>
                  <span className="text-parchment text-sm">{a.name}</span>
                </div>
                <div className="flex gap-3 text-xs text-muted mt-1">
                  <span>Chef: {a.leader_name}</span>
                  <span>Membres: {a.member_count}</span>
                  <span>Score: {Number(a.total_score).toLocaleString('fr-FR')}</span>
                </div>
              </div>
              <button
                onClick={() => handleJoin(a.id)}
                disabled={joining === a.id}
                className="px-3 py-1.5 text-xs bg-blood border border-gold rounded text-parchment hover:bg-blood-light transition-colors disabled:opacity-50"
              >
                {joining === a.id ? '...' : 'Rejoindre'}
              </button>
            </div>
          ))}
        </div>
      )}

      {results.length === 0 && query.length >= 2 && (
        <p className="text-muted text-sm text-center">Aucune alliance trouvee</p>
      )}
    </div>
  );
}

// ── Alliance View ──
function AllianceView() {
  const alliance = useGameStore((s) => s.alliance);
  const leaveAlliance = useGameStore((s) => s.leaveAlliance);
  const kickMember = useGameStore((s) => s.kickMember);
  const promoteMember = useGameStore((s) => s.promoteMember);
  const setDiplomacy = useGameStore((s) => s.setDiplomacy);
  const loadAlliance = useGameStore((s) => s.loadAlliance);

  const [section, setSection] = useState('members'); // 'members' | 'diplomacy'
  const [confirmLeave, setConfirmLeave] = useState(false);
  const [error, setError] = useState(null);

  const myRole = alliance.myRole;
  const isLeader = myRole === 'leader';
  const isOfficer = myRole === 'officer';

  const handleLeave = async () => {
    try {
      await leaveAlliance();
    } catch (err) {
      setError(err.message);
    }
  };

  const handleKick = async (playerId) => {
    try {
      await kickMember(playerId);
    } catch (err) {
      setError(err.message);
    }
  };

  const handlePromote = async (playerId, role) => {
    try {
      await promoteMember(playerId, role);
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div>
      {/* Alliance header */}
      <div className="bg-surface border border-border rounded-lg p-4 mb-4">
        <div className="flex items-center justify-between mb-2">
          <div>
            <h2 className="font-display text-xl text-gold">
              [{alliance.tag}] {alliance.name}
            </h2>
            <p className="text-muted text-sm">
              Chef: {alliance.leader_name} | {alliance.members?.length || 0}/30 membres
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className={`text-xs px-2 py-1 rounded bg-base ${ROLE_COLORS[myRole]}`}>
              {ROLE_LABELS[myRole]}
            </span>
          </div>
        </div>
      </div>

      {error && (
        <div className="bg-blood/20 border border-blood rounded px-3 py-2 text-sm text-blood-glow mb-4 flex justify-between">
          <span>{error}</span>
          <button onClick={() => setError(null)} className="text-muted hover:text-parchment">&times;</button>
        </div>
      )}

      {/* Section tabs */}
      <div className="flex gap-1 mb-4">
        <button
          onClick={() => setSection('members')}
          className={`px-3 py-1.5 text-xs rounded border transition-colors ${
            section === 'members' ? 'border-gold text-gold bg-gold/10' : 'border-border text-muted hover:text-parchment'
          }`}
        >
          Membres ({alliance.members?.length || 0})
        </button>
        <button
          onClick={() => setSection('diplomacy')}
          className={`px-3 py-1.5 text-xs rounded border transition-colors ${
            section === 'diplomacy' ? 'border-gold text-gold bg-gold/10' : 'border-border text-muted hover:text-parchment'
          }`}
        >
          Diplomatie ({alliance.diplomacy?.length || 0})
        </button>
      </div>

      {/* Members */}
      {section === 'members' && (
        <div className="space-y-2">
          {(alliance.members || []).map((m) => (
            <div key={m.id} className="bg-surface border border-border rounded-lg p-3 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <span className={`text-sm font-medium ${ROLE_COLORS[m.role]}`}>{m.username}</span>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded bg-base ${ROLE_COLORS[m.role]}`}>
                      {ROLE_LABELS[m.role]}
                    </span>
                  </div>
                  <div className="flex gap-3 text-xs text-muted mt-0.5">
                    <span>Score: {Number(m.score).toLocaleString('fr-FR')}</span>
                    <span className="capitalize">{m.faction}</span>
                  </div>
                </div>
              </div>

              {/* Actions (only for leader/officer, not on self or leader) */}
              {(isLeader || isOfficer) && m.role !== 'leader' && (
                <div className="flex gap-1">
                  {isLeader && m.role === 'member' && (
                    <button
                      onClick={() => handlePromote(m.id, 'officer')}
                      className="px-2 py-1 text-[10px] bg-base border border-border rounded text-essence hover:border-essence/50 transition-colors"
                      title="Promouvoir Officier"
                    >
                      Officier
                    </button>
                  )}
                  {isLeader && m.role === 'officer' && (
                    <button
                      onClick={() => handlePromote(m.id, 'member')}
                      className="px-2 py-1 text-[10px] bg-base border border-border rounded text-muted hover:border-gold/50 transition-colors"
                      title="Retrograder"
                    >
                      Retrograder
                    </button>
                  )}
                  {isLeader && (
                    <button
                      onClick={() => handlePromote(m.id, 'leader')}
                      className="px-2 py-1 text-[10px] bg-base border border-border rounded text-gold hover:border-gold/50 transition-colors"
                      title="Transferer le commandement"
                    >
                      Chef
                    </button>
                  )}
                  <button
                    onClick={() => handleKick(m.id)}
                    className="px-2 py-1 text-[10px] bg-base border border-border rounded text-blood-glow hover:border-blood transition-colors"
                    title="Expulser"
                  >
                    Expulser
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Diplomacy */}
      {section === 'diplomacy' && (
        <DiplomacySection
          diplomacy={alliance.diplomacy || []}
          isLeader={isLeader}
          onSetDiplomacy={async (targetId, status) => {
            try {
              await setDiplomacy(targetId, status);
            } catch (err) {
              setError(err.message);
            }
          }}
        />
      )}

      {/* Leave button */}
      <div className="mt-6 border-t border-border pt-4">
        {!confirmLeave ? (
          <button
            onClick={() => setConfirmLeave(true)}
            className="text-sm text-muted hover:text-blood-glow transition-colors"
          >
            Quitter l'alliance
          </button>
        ) : (
          <div className="flex items-center gap-3">
            <span className="text-sm text-blood-glow">Confirmer ?</span>
            <button
              onClick={handleLeave}
              className="px-3 py-1 text-xs bg-blood border border-blood rounded text-parchment hover:bg-blood-light"
            >
              Oui, quitter
            </button>
            <button
              onClick={() => setConfirmLeave(false)}
              className="px-3 py-1 text-xs border border-border rounded text-muted hover:text-parchment"
            >
              Annuler
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function DiplomacySection({ diplomacy, isLeader, onSetDiplomacy }) {
  const [targetId, setTargetId] = useState('');
  const [status, setStatus] = useState('neutralite');

  return (
    <div>
      {/* Existing diplomacy */}
      {diplomacy.length > 0 ? (
        <div className="space-y-2 mb-4">
          {diplomacy.map((d) => (
            <div key={d.id} className="bg-surface border border-border rounded-lg p-3 flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-gold font-display text-sm">[{d.otherAlliance.tag}]</span>
                  <span className="text-parchment text-sm">{d.otherAlliance.name}</span>
                </div>
                <span className={`text-xs ${DIPLO_COLORS[d.status]}`}>
                  {DIPLO_LABELS[d.status]}
                </span>
              </div>
              {isLeader && (
                <div className="flex gap-1">
                  {Object.entries(DIPLO_LABELS)
                    .filter(([key]) => key !== d.status)
                    .map(([key, label]) => (
                      <button
                        key={key}
                        onClick={() => onSetDiplomacy(d.otherAlliance.id, key)}
                        className={`px-2 py-1 text-[10px] bg-base border border-border rounded transition-colors hover:border-gold/50 ${DIPLO_COLORS[key]}`}
                      >
                        {label}
                      </button>
                    ))}
                </div>
              )}
            </div>
          ))}
        </div>
      ) : (
        <p className="text-muted text-sm mb-4">Aucune relation diplomatique</p>
      )}
    </div>
  );
}
