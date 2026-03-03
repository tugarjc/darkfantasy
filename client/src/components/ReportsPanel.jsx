import { useState, useEffect } from 'react';
import { useGameStore } from '../stores/gameStore';

function fmtNum(n) {
  if (n >= 1e6) return (n / 1e6).toFixed(1) + 'M';
  if (n >= 1e3) return (n / 1e3).toFixed(1) + 'K';
  return Math.round(n).toLocaleString('fr-FR');
}

function fmtDate(d) {
  const date = new Date(d);
  return date.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
}

export default function ReportsPanel() {
  const battleReports = useGameStore((s) => s.battleReports);
  const spyReports = useGameStore((s) => s.spyReports);
  const reportsSummary = useGameStore((s) => s.reportsSummary);
  const loadBattleReports = useGameStore((s) => s.loadBattleReports);
  const loadSpyReports = useGameStore((s) => s.loadSpyReports);
  const loadReportsSummary = useGameStore((s) => s.loadReportsSummary);

  const [tab, setTab] = useState('battles');
  const [selectedReport, setSelectedReport] = useState(null);

  useEffect(() => {
    loadBattleReports();
    loadSpyReports();
    loadReportsSummary();
  }, []);

  return (
    <div>
      {/* Summary */}
      {reportsSummary && (
        <div className="grid grid-cols-3 gap-3 mb-6">
          <div className="bg-surface border border-border rounded-lg p-3 text-center">
            <p className="text-xs text-muted">Batailles</p>
            <p className="text-xl font-display text-parchment">{reportsSummary.battles.total}</p>
          </div>
          <div className="bg-surface border border-border rounded-lg p-3 text-center">
            <p className="text-xs text-muted">Victoires</p>
            <p className="text-xl font-display text-green-400">{reportsSummary.battles.wins}</p>
          </div>
          <div className="bg-surface border border-border rounded-lg p-3 text-center">
            <p className="text-xs text-muted">Espionnages</p>
            <p className="text-xl font-display text-purple-400">{reportsSummary.espionage.total}</p>
          </div>
        </div>
      )}

      {/* Tab nav */}
      <div className="flex gap-1 mb-4">
        <button
          onClick={() => { setTab('battles'); setSelectedReport(null); }}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            tab === 'battles' ? 'border-blood text-blood-glow' : 'border-transparent text-muted hover:text-parchment'
          }`}
        >
          Combats ({battleReports.length})
        </button>
        <button
          onClick={() => { setTab('espionage'); setSelectedReport(null); }}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            tab === 'espionage' ? 'border-purple-500 text-purple-400' : 'border-transparent text-muted hover:text-parchment'
          }`}
        >
          Espionnage ({spyReports.length})
        </button>
      </div>

      {/* Reports list */}
      {tab === 'battles' && (
        <div className="space-y-2">
          {battleReports.length === 0 ? (
            <p className="text-muted text-sm text-center py-8 bg-surface rounded-lg border border-border">
              Aucun rapport de combat
            </p>
          ) : (
            battleReports.map((r) => (
              <BattleReportRow key={r.id} report={r} isSelected={selectedReport === r.id}
                onClick={() => setSelectedReport(selectedReport === r.id ? null : r.id)} />
            ))
          )}
        </div>
      )}

      {tab === 'espionage' && (
        <div className="space-y-2">
          {spyReports.length === 0 ? (
            <p className="text-muted text-sm text-center py-8 bg-surface rounded-lg border border-border">
              Aucun rapport d'espionnage
            </p>
          ) : (
            spyReports.map((r) => (
              <SpyReportRow key={r.id} report={r} isSelected={selectedReport === r.id}
                onClick={() => setSelectedReport(selectedReport === r.id ? null : r.id)} />
            ))
          )}
        </div>
      )}
    </div>
  );
}

function BattleReportRow({ report, isSelected, onClick }) {
  const o = report.outcome;
  const won = report.isAttacker ? o.attackerWins : !o.attackerWins;

  return (
    <div>
      <div
        onClick={onClick}
        className={`bg-surface border rounded-lg p-3 cursor-pointer transition-colors ${
          isSelected ? 'border-gold' : 'border-border hover:border-gold/30'
        }`}
      >
        <div className="flex items-center gap-3">
          <span className={`text-lg ${won ? 'text-green-400' : 'text-blood-glow'}`}>
            {won ? '⚔' : '💀'}
          </span>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className={`text-xs font-medium ${won ? 'text-green-400' : 'text-blood-glow'}`}>
                {won ? 'Victoire' : 'Defaite'}
              </span>
              <span className="text-[10px] text-muted">
                {report.isAttacker ? 'Attaque' : 'Defense'}
              </span>
            </div>
            <p className="text-[10px] text-muted truncate">
              {report.isAttacker ? `→ ${report.defenderName}` : `← ${report.attackerName}`}
              {report.circleName && ` (${report.circleName})`}
            </p>
          </div>
          <div className="text-right">
            <p className="text-[10px] text-muted">{fmtDate(report.createdAt)}</p>
            {o.plunder && (o.plunder.iron > 0 || o.plunder.essence > 0 || o.plunder.souls > 0) && (
              <p className="text-[10px] text-gold">
                Butin: {fmtNum((o.plunder.iron || 0) + (o.plunder.essence || 0) + (o.plunder.souls || 0))}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Detail */}
      {isSelected && (
        <div className="mt-1 bg-elevated border border-border rounded-lg p-4">
          <div className="grid grid-cols-2 gap-4 mb-3">
            <div>
              <p className="text-xs text-blood-glow font-medium mb-1">Attaquant: {report.attackerName}</p>
              <UnitList comp={o.attackerComp} losses={o.attackerLosses} />
            </div>
            <div>
              <p className="text-xs text-blue-400 font-medium mb-1">Defenseur: {report.defenderName}</p>
              <UnitList comp={o.defenderComp} losses={o.defenderLosses} />
            </div>
          </div>

          <div className="flex gap-3 text-xs">
            <span className="text-muted">Ratio: <span className="text-parchment">{Math.round(o.ratio * 100)}%</span></span>
            {o.defenseBonus > 1 && (
              <span className="text-muted">Bonus murs: <span className="text-parchment">x{o.defenseBonus.toFixed(2)}</span></span>
            )}
          </div>

          {o.plunder && (o.plunder.iron > 0 || o.plunder.essence > 0 || o.plunder.souls > 0) && (
            <div className="mt-2 pt-2 border-t border-border">
              <p className="text-xs text-gold mb-1">Butin :</p>
              <div className="flex gap-4 text-xs">
                {o.plunder.iron > 0 && <span className="text-iron">Fer: {fmtNum(o.plunder.iron)}</span>}
                {o.plunder.essence > 0 && <span className="text-essence">Essence: {fmtNum(o.plunder.essence)}</span>}
                {o.plunder.souls > 0 && <span className="text-souls">Ames: {fmtNum(o.plunder.souls)}</span>}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function SpyReportRow({ report, isSelected, onClick }) {
  const d = report.data;

  return (
    <div>
      <div
        onClick={onClick}
        className={`bg-surface border rounded-lg p-3 cursor-pointer transition-colors ${
          isSelected ? 'border-purple-500' : 'border-border hover:border-purple-500/30'
        }`}
      >
        <div className="flex items-center gap-3">
          <span className="text-lg text-purple-400">👁</span>
          <div className="flex-1 min-w-0">
            <p className="text-xs text-purple-400 font-medium">{report.targetPlayer}</p>
            <p className="text-[10px] text-muted">{report.targetName} ({report.coords?.q}, {report.coords?.r})</p>
          </div>
          <div className="text-right">
            <p className="text-[10px] text-muted">{fmtDate(report.createdAt)}</p>
            <p className="text-[10px] text-purple-400">Nv.{report.level}</p>
          </div>
        </div>
      </div>

      {isSelected && (
        <div className="mt-1 bg-elevated border border-border rounded-lg p-4 space-y-3">
          {/* Resources */}
          {d.resources && (
            <div>
              <p className="text-xs text-gold mb-1">Ressources :</p>
              <div className="flex gap-4 text-xs">
                <span className="text-iron">Fer: {fmtNum(d.resources.iron)}</span>
                <span className="text-essence">Essence: {fmtNum(d.resources.essence)}</span>
                <span className="text-souls">Ames: {fmtNum(d.resources.souls)}</span>
              </div>
            </div>
          )}

          {/* Buildings */}
          {d.buildings && (
            <div>
              <p className="text-xs text-gold mb-1">Structures :</p>
              <div className="flex flex-wrap gap-1">
                {d.buildings.map((b) => (
                  <span key={b.type} className="text-[10px] bg-base px-1.5 py-0.5 rounded text-muted">
                    {b.type} Nv.{b.level}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Units */}
          {d.units && (
            <div>
              <p className="text-xs text-gold mb-1">Unites :</p>
              <div className="flex flex-wrap gap-1">
                {d.units.map((u) => (
                  <span key={u.type} className="text-[10px] bg-base px-1.5 py-0.5 rounded text-muted">
                    {u.type}: {u.quantity}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Researches */}
          {d.researches && (
            <div>
              <p className="text-xs text-gold mb-1">Recherches :</p>
              <div className="flex flex-wrap gap-1">
                {d.researches.map((r) => (
                  <span key={r.type} className="text-[10px] bg-base px-1.5 py-0.5 rounded text-muted">
                    {r.type} Nv.{r.level}
                  </span>
                ))}
              </div>
            </div>
          )}

          {!d.buildings && report.level < 3 && (
            <p className="text-[10px] text-muted">Tour de Vigie Nv.3 requis pour voir les structures</p>
          )}
          {!d.units && report.level < 5 && (
            <p className="text-[10px] text-muted">Tour de Vigie Nv.5 requis pour voir les unites</p>
          )}
        </div>
      )}
    </div>
  );
}

function UnitList({ comp, losses }) {
  if (!comp || Object.keys(comp).length === 0) {
    return <p className="text-[10px] text-muted">Aucune unite</p>;
  }

  return (
    <div className="space-y-0.5">
      {Object.entries(comp).map(([type, qty]) => {
        const lost = losses?.[type] || 0;
        return (
          <div key={type} className="flex justify-between text-[10px]">
            <span className="text-muted">{type}</span>
            <span>
              <span className="text-parchment">{qty}</span>
              {lost > 0 && <span className="text-blood-glow ml-1">(-{lost})</span>}
            </span>
          </div>
        );
      })}
    </div>
  );
}
