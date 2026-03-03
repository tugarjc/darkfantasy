import { useEffect, useState } from 'react';
import { useGameStore } from '../stores/gameStore';

const UNIT_NAMES = {
  squelette_soldat: 'Squelette Soldat',
  diablotin: 'Diablotin',
  golem_cendres: 'Golem de Cendres',
  seigneur_guerre: 'Seigneur de Guerre',
  gardien_abime: "Gardien de l'Abime",
  imp_volant: 'Imp Volant',
  drake_ombres: 'Drake des Ombres',
  liche_aerienne: 'Liche Aerienne',
  dragon_abyssal: 'Dragon Abyssal',
};

const EVENT_COLORS = {
  faille: 'text-purple-400',
  invasion: 'text-blood-glow',
  raid: 'text-gold',
};

export default function EventPanel() {
  const { events, eventsLoading, loadEvents, eventDetail, loadEventDetail, units } = useGameStore();
  const [selectedId, setSelectedId] = useState(null);
  const [showAttack, setShowAttack] = useState(false);

  useEffect(() => { loadEvents(); }, []);

  const selectEvent = (id) => {
    setSelectedId(id);
    loadEventDetail(id);
    setShowAttack(false);
  };

  // Refresh every 30s
  useEffect(() => {
    const timer = setInterval(loadEvents, 30000);
    return () => clearInterval(timer);
  }, []);

  if (eventsLoading && events.length === 0) {
    return <p className="text-muted animate-pulse">Recherche d'evenements...</p>;
  }

  return (
    <div>
      <h2 className="font-display text-2xl text-gold mb-4">Evenements Mondiaux</h2>

      {events.length === 0 ? (
        <div className="bg-surface border border-border rounded-lg p-8 text-center">
          <p className="text-muted">Aucun evenement actif pour le moment.</p>
          <p className="text-xs text-muted/60 mt-2">Les evenements apparaissent periodiquement sur la carte.</p>
        </div>
      ) : (
        <div className="flex flex-col lg:flex-row gap-4">
          {/* Event list */}
          <div className="lg:w-1/2 space-y-2">
            {events.map((ev) => (
              <EventCard
                key={ev.id}
                event={ev}
                selected={selectedId === ev.id}
                onClick={() => selectEvent(ev.id)}
              />
            ))}
          </div>

          {/* Detail panel */}
          <div className="lg:w-1/2">
            {selectedId && eventDetail ? (
              <div className="space-y-4">
                <EventDetailView detail={eventDetail} />
                {eventDetail.event.hpRemaining > 0 && (
                  <>
                    <button
                      onClick={() => setShowAttack(!showAttack)}
                      className="w-full bg-blood/20 text-blood-glow py-2 rounded hover:bg-blood/30 transition-colors text-sm font-medium"
                    >
                      {showAttack ? 'Annuler' : 'Attaquer cet evenement'}
                    </button>
                    {showAttack && <AttackForm eventId={selectedId} onDone={() => { setShowAttack(false); selectEvent(selectedId); }} />}
                  </>
                )}
              </div>
            ) : (
              <div className="bg-surface border border-border rounded-lg p-8 text-center text-muted text-sm">
                Selectionnez un evenement pour voir les details
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function EventCard({ event, selected, onClick }) {
  const hpPercent = event.hpMax > 0 ? (event.hpRemaining / event.hpMax) * 100 : 0;
  const timeLeft = Math.max(0, new Date(event.endTime) - Date.now());
  const hoursLeft = Math.floor(timeLeft / 3600000);
  const minsLeft = Math.floor((timeLeft % 3600000) / 60000);

  return (
    <div
      onClick={onClick}
      className={`p-4 rounded-lg border cursor-pointer transition-colors ${
        selected ? 'bg-gold/10 border-gold/30' : 'bg-surface border-border hover:border-border/80'
      }`}
    >
      <div className="flex items-center justify-between mb-2">
        <span className={`font-display text-sm ${EVENT_COLORS[event.type] || 'text-parchment'}`}>
          {event.name}
        </span>
        <span className="text-xs text-muted">({event.coordQ}, {event.coordR})</span>
      </div>

      {/* HP bar */}
      <div className="w-full bg-deep rounded-full h-3 mb-2 overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${
            hpPercent > 50 ? 'bg-green-600' : hpPercent > 20 ? 'bg-yellow-600' : 'bg-blood'
          }`}
          style={{ width: `${hpPercent}%` }}
        />
      </div>
      <div className="flex justify-between text-xs text-muted">
        <span>PV: {event.hpRemaining.toLocaleString()} / {event.hpMax.toLocaleString()}</span>
        <span>{hoursLeft}h {minsLeft}m restant</span>
      </div>

      <div className="flex justify-between text-xs text-muted mt-2">
        <span>{event.contributors} participant(s)</span>
        {event.myDamage > 0 && <span className="text-gold">Mes degats: {event.myDamage.toLocaleString()}</span>}
      </div>
    </div>
  );
}

function EventDetailView({ detail }) {
  const { event, leaderboard } = detail;
  const hpPercent = event.hpMax > 0 ? (event.hpRemaining / event.hpMax) * 100 : 0;
  const defeated = event.hpRemaining <= 0;

  return (
    <div className="bg-surface border border-border rounded-lg p-4">
      <h3 className={`font-display text-lg ${EVENT_COLORS[event.type] || 'text-parchment'} mb-1`}>
        {event.name}
      </h3>
      <p className="text-xs text-muted mb-3">{event.description}</p>

      {defeated ? (
        <div className="bg-green-900/20 border border-green-800 rounded p-3 mb-3 text-center">
          <span className="text-green-400 font-medium">Evenement vaincu !</span>
          <p className="text-xs text-muted mt-1">Les recompenses sont distribuees automatiquement.</p>
        </div>
      ) : (
        <>
          <div className="w-full bg-deep rounded-full h-4 mb-2 overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${
                hpPercent > 50 ? 'bg-green-600' : hpPercent > 20 ? 'bg-yellow-600' : 'bg-blood'
              }`}
              style={{ width: `${hpPercent}%` }}
            />
          </div>
          <p className="text-xs text-muted text-center mb-3">
            {event.hpRemaining.toLocaleString()} / {event.hpMax.toLocaleString()} PV
          </p>
        </>
      )}

      <div className="grid grid-cols-2 gap-2 text-xs mb-4">
        <div className="bg-deep rounded p-2">
          <span className="text-muted">Position</span>
          <div className="text-parchment">({event.coordQ}, {event.coordR})</div>
        </div>
        <div className="bg-deep rounded p-2">
          <span className="text-muted">Fin</span>
          <div className="text-parchment">{new Date(event.endTime).toLocaleString('fr-FR')}</div>
        </div>
      </div>

      {/* Leaderboard */}
      {leaderboard?.length > 0 && (
        <div>
          <h4 className="text-sm font-medium text-parchment mb-2">Classement</h4>
          <div className="space-y-1">
            {leaderboard.map((entry, i) => (
              <div key={entry.playerId} className="flex items-center justify-between bg-deep rounded px-3 py-1.5">
                <div className="flex items-center gap-2">
                  <span className={`text-xs font-medium ${i === 0 ? 'text-gold' : i === 1 ? 'text-gray-400' : i === 2 ? 'text-orange-400' : 'text-muted'}`}>
                    #{i + 1}
                  </span>
                  <span className="text-sm text-parchment">{entry.username}</span>
                </div>
                <span className="text-xs text-gold">{entry.damage.toLocaleString()} degats</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function AttackForm({ eventId, onDone }) {
  const { units, loadUnits, attackEvent } = useGameStore();
  const [selected, setSelected] = useState({});
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => { loadUnits(); }, []);

  const available = (units || []).filter(u => u.quantity > 0);

  const updateUnit = (type, val) => {
    const num = parseInt(val) || 0;
    setSelected(prev => {
      if (num <= 0) {
        const next = { ...prev };
        delete next[type];
        return next;
      }
      return { ...prev, [type]: num };
    });
  };

  const totalSelected = Object.values(selected).reduce((s, v) => s + v, 0);

  const doAttack = async () => {
    if (totalSelected === 0) return;
    setLoading(true);
    setError('');
    setResult(null);
    try {
      const res = await attackEvent(eventId, selected);
      setResult(res);
      setSelected({});
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-surface border border-border rounded-lg p-4">
      <h4 className="text-sm font-medium text-parchment mb-3">Envoyer des troupes</h4>

      {available.length === 0 ? (
        <p className="text-xs text-muted">Aucune unite disponible.</p>
      ) : (
        <div className="space-y-2 mb-4">
          {available.map(u => (
            <div key={u.type} className="flex items-center justify-between gap-2">
              <div className="flex-1">
                <span className="text-sm text-parchment">{UNIT_NAMES[u.type] || u.type}</span>
                <span className="text-xs text-muted ml-2">({u.quantity})</span>
              </div>
              <input
                type="number"
                min={0}
                max={u.quantity}
                value={selected[u.type] || ''}
                onChange={(e) => updateUnit(u.type, e.target.value)}
                placeholder="0"
                className="w-24 bg-deep border border-border rounded px-2 py-1 text-sm text-parchment text-right outline-none focus:border-gold/50"
              />
            </div>
          ))}
        </div>
      )}

      {error && <p className="text-sm text-blood-glow mb-2">{error}</p>}

      {result && (
        <div className="bg-deep rounded p-3 mb-3 text-sm space-y-1">
          <p className="text-gold">Degats infliges: {result.damage.toLocaleString()}</p>
          {Object.keys(result.losses).length > 0 && (
            <p className="text-blood-glow">
              Pertes: {Object.entries(result.losses).map(([t, q]) => `${UNIT_NAMES[t] || t} x${q}`).join(', ')}
            </p>
          )}
          {result.eventDefeated && (
            <p className="text-green-400 font-medium">Evenement vaincu !</p>
          )}
          <button onClick={onDone} className="text-xs text-muted hover:text-parchment mt-2">Fermer</button>
        </div>
      )}

      {!result && (
        <button
          onClick={doAttack}
          disabled={totalSelected === 0 || loading}
          className="w-full bg-blood/30 text-blood-glow py-2 rounded hover:bg-blood/40 transition-colors text-sm font-medium disabled:opacity-30 disabled:cursor-not-allowed"
        >
          {loading ? 'Attaque en cours...' : `Attaquer (${totalSelected} unites)`}
        </button>
      )}
    </div>
  );
}
