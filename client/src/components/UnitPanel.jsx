import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useGameStore } from '../stores/gameStore';

function fmtNum(n) {
  if (n >= 1e6) return (n / 1e6).toFixed(1) + 'M';
  if (n >= 1e3) return (n / 1e3).toFixed(1) + 'K';
  return Math.round(n).toLocaleString('fr-FR');
}

function fmtTime(seconds) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

const CATEGORY_KEYS = {
  ground: 'units.ground',
  air: 'units.air',
};

const UNIT_COLORS = {
  ground: '#B0592A',
  air: '#6B2FA0',
};

export default function UnitPanel() {
  const { t } = useTranslation();
  const units = useGameStore((s) => s.units);
  const resources = useGameStore((s) => s.resources);
  const trainUnits = useGameStore((s) => s.trainUnits);
  const [selected, setSelected] = useState(null);
  const [qty, setQty] = useState(10);
  const [training, setTraining] = useState(false);

  const groundUnits = units.filter((u) => u.category === 'ground');
  const airUnits = units.filter((u) => u.category === 'air');

  const handleTrain = async (unitType) => {
    setTraining(true);
    try {
      await trainUnits(unitType, qty);
    } catch { /* error handled in store */ }
    setTraining(false);
  };

  const selectedUnit = units.find((u) => u.type === selected);

  return (
    <div>
      {[
        { key: 'ground', items: groundUnits },
        { key: 'air', items: airUnits },
      ].map(({ key, items }) => (
        <div key={key} className="mb-6">
          <h3 className="font-display text-lg text-gold mb-3">{t(CATEGORY_KEYS[key])}</h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
            {items.map((u) => (
              <UnitCard
                key={u.type}
                unit={u}
                isSelected={selected === u.type}
                onClick={() => setSelected(selected === u.type ? null : u.type)}
              />
            ))}
          </div>
        </div>
      ))}

      {/* Detail / Train panel */}
      {selectedUnit && (
        <div className="mt-4 bg-elevated border border-border rounded-lg p-6">
          <div className="flex justify-between items-start mb-4">
            <div>
              <h3 className="font-display text-xl" style={{ color: UNIT_COLORS[selectedUnit.category] }}>
                {selectedUnit.name}
              </h3>
              <p className="text-muted text-sm">
                {selectedUnit.unlocked ? t('units.owned', { count: selectedUnit.quantity }) : t('common.locked')}
              </p>
            </div>
            <button onClick={() => setSelected(null)} className="text-muted hover:text-parchment text-lg">&times;</button>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-3 gap-3 mb-4">
            <StatBox label={t('units.attack')} value={selectedUnit.attack} color="text-blood-glow" />
            <StatBox label={t('units.defense')} value={selectedUnit.defense} color="text-infernal-light" />
            <StatBox label={t('units.plunder')} value={selectedUnit.plunder} color="text-gold" />
          </div>

          {selectedUnit.unlocked ? (
            <>
              {/* Cost per unit */}
              <p className="text-sm text-muted mb-2">{t('units.unit_cost')}</p>
              <div className="grid grid-cols-3 gap-3 mb-4">
                <CostItem label={t('common.iron')} cost={selectedUnit.cost.iron * qty} available={resources?.iron} color="text-iron" />
                <CostItem label={t('common.essence')} cost={selectedUnit.cost.essence * qty} available={resources?.essence} color="text-essence" />
                <CostItem label={t('common.souls')} cost={selectedUnit.cost.souls * qty} available={resources?.souls} color="text-souls" />
              </div>

              {/* Quantity selector */}
              <div className="flex items-center gap-3 mb-4">
                <label className="text-sm text-muted">{t('common.quantity')} :</label>
                <div className="flex gap-1">
                  {[1, 5, 10, 50, 100].map((n) => (
                    <button
                      key={n}
                      onClick={() => setQty(n)}
                      className={`px-3 py-1 text-xs rounded ${
                        qty === n ? 'bg-gold text-deep' : 'bg-base text-muted hover:text-parchment'
                      }`}
                    >
                      {n}
                    </button>
                  ))}
                </div>
                <span className="text-sm text-parchment">= {fmtTime(selectedUnit.trainTime * qty)}</span>
              </div>

              <button
                onClick={() => handleTrain(selectedUnit.type)}
                disabled={training || !canAfford(selectedUnit, qty, resources)}
                className={`w-full py-2.5 rounded font-display text-base transition-all duration-300 ${
                  !training && canAfford(selectedUnit, qty, resources)
                    ? 'bg-blood border border-gold text-parchment hover:bg-blood-light'
                    : 'bg-base border border-border text-muted cursor-not-allowed'
                }`}
              >
                {training ? t('units.training') : t('units.train', { qty, name: selectedUnit.name })}
              </button>
            </>
          ) : (
            <p className="text-blood-light text-sm text-center py-4">
              {t('units.building_required')}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

function canAfford(unit, qty, resources) {
  if (!resources) return false;
  return (
    resources.iron >= unit.cost.iron * qty &&
    resources.essence >= unit.cost.essence * qty &&
    resources.souls >= unit.cost.souls * qty
  );
}

function UnitCard({ unit, isSelected, onClick }) {
  const { t } = useTranslation();
  const color = UNIT_COLORS[unit.category] || '#555';
  return (
    <div
      onClick={onClick}
      className={`bg-surface border rounded-lg p-3 cursor-pointer transition-all duration-200 ${
        isSelected ? 'border-gold shadow-[0_0_10px_rgba(201,168,76,0.2)]' :
        unit.unlocked ? 'border-border hover:border-gold/50' : 'border-border opacity-50'
      }`}
    >
      <div className="flex justify-between items-start mb-2">
        <span className="text-xs font-medium" style={{ color }}>{unit.name}</span>
        {unit.quantity > 0 && (
          <span className="text-xs text-gold bg-gold/10 px-1.5 rounded">{unit.quantity}</span>
        )}
      </div>
      <div className="flex gap-2 text-[10px] text-muted">
        <span>A:{unit.attack}</span>
        <span>D:{unit.defense}</span>
        <span>P:{unit.plunder}</span>
      </div>
      {!unit.unlocked && <p className="text-[10px] text-blood-light mt-1">{t('common.locked')}</p>}
    </div>
  );
}

function StatBox({ label, value, color }) {
  return (
    <div className="text-center p-2 bg-base rounded">
      <p className="text-xs text-muted">{label}</p>
      <p className={`text-lg font-bold ${color}`}>{value}</p>
    </div>
  );
}

function CostItem({ label, cost, available, color }) {
  if (!cost) return <div />;
  const enough = (available || 0) >= cost;
  return (
    <div className={`text-center p-2 rounded bg-base ${enough ? '' : 'border border-blood/30'}`}>
      <p className={`text-xs ${color}`}>{label}</p>
      <p className={`text-sm font-medium ${enough ? 'text-parchment' : 'text-blood-glow'}`}>
        {fmtNum(cost)}
      </p>
    </div>
  );
}
