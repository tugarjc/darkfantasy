import { useTranslation } from 'react-i18next';
import { useGameStore } from '../stores/gameStore';
import { useAuthStore } from '../stores/authStore';
import NotificationCenter from './NotificationCenter';

export default function ResourceBar() {
  const { t } = useTranslation();
  const resources = useGameStore((s) => s.resources);
  const player = useAuthStore((s) => s.player);

  if (!resources) return null;

  return (
    <div className="bg-surface border-b border-border px-4 py-2 flex flex-wrap items-center gap-6">
      <ResourceItem
        icon={<IronIcon />}
        name={t('resources.iron_name')}
        value={resources.iron}
        rate={resources.iron_rate}
        cap={resources.iron_cap}
        color="text-iron"
      />
      <ResourceItem
        icon={<EssenceIcon />}
        name={t('resources.essence_name')}
        value={resources.essence}
        rate={resources.essence_rate}
        cap={resources.essence_cap}
        color="text-essence"
      />
      <ResourceItem
        icon={<SoulsIcon />}
        name={t('resources.souls_name')}
        value={resources.souls}
        rate={resources.souls_rate}
        cap={resources.souls_cap}
        color="text-souls"
      />
      {/* Reliques — no rate, just flat counter */}
      <div className="flex items-center gap-2 min-w-[100px]">
        <div className="w-6 h-6 flex-shrink-0"><RelicIcon /></div>
        <div>
          <span className="text-sm font-medium text-gold">{(player?.relics || 0).toLocaleString('fr-FR')}</span>
          <div className="text-[10px] text-muted">{t('resources.relics_name')}</div>
        </div>
      </div>
      {/* Notifications bell */}
      <div className="ml-auto">
        <NotificationCenter />
      </div>
    </div>
  );
}

function ResourceItem({ icon, name, value, rate, cap, color }) {
  const pct = Math.min((value / cap) * 100, 100);
  const isFull = value >= cap * 0.95;

  return (
    <div className="flex items-center gap-2 min-w-[180px]">
      <div className="w-6 h-6 flex-shrink-0">{icon}</div>
      <div className="flex-1">
        <div className="flex items-baseline justify-between">
          <span className={`text-sm font-medium transition-all duration-300 ${color}`}>
            {Math.floor(value).toLocaleString('fr-FR')}
          </span>
          <span className="text-xs text-muted transition-all duration-300">
            +{rate}/h
          </span>
        </div>
        <div className="mt-1 h-1.5 bg-base rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-1000 ${isFull ? 'bg-blood' : 'bg-gold/60'}`}
            style={{ width: `${pct}%` }}
          />
        </div>
        <div className="flex justify-between">
          <span className="text-[10px] text-muted">{name}</span>
          <span className="text-[10px] text-muted">{Math.floor(cap).toLocaleString('fr-FR')}</span>
        </div>
      </div>
    </div>
  );
}

function IronIcon() {
  return (
    <svg viewBox="0 0 48 48" className="w-full h-full">
      <path d="M10 30 L14 22 L34 22 L38 30 L40 34 L8 34 Z" fill="#B0592A" stroke="#5A2A0A" strokeWidth="1.5"/>
      <path d="M20 20 Q22 12 24 16 Q26 10 28 18 Q26 14 24 20 Z" fill="#FF6633" opacity="0.8"/>
    </svg>
  );
}

function EssenceIcon() {
  return (
    <svg viewBox="0 0 48 48" className="w-full h-full">
      <path d="M4 24 Q14 8 24 8 Q34 8 44 24 Q34 40 24 40 Q14 40 4 24 Z" fill="#6B2FA0" stroke="#9B59B6" strokeWidth="1.5"/>
      <circle cx="24" cy="24" r="8" fill="#1B0A30" stroke="#B87FD8" strokeWidth="1"/>
      <circle cx="24" cy="24" r="3.5" fill="#D8A8F0"/>
    </svg>
  );
}

function SoulsIcon() {
  return (
    <svg viewBox="0 0 48 48" className="w-full h-full">
      <path d="M16 22 Q16 12 24 10 Q32 12 32 22 L32 28 L28 30 L20 30 L16 28 Z" fill="#E8E0D0" stroke="#3CA66B" strokeWidth="1.2"/>
      <ellipse cx="20" cy="20" rx="2.5" ry="3" fill="#2D5A3D"/>
      <ellipse cx="28" cy="20" rx="2.5" ry="3" fill="#2D5A3D"/>
      <ellipse cx="20" cy="20" rx="1" ry="1.5" fill="#5AE89A" opacity="0.8"/>
      <ellipse cx="28" cy="20" rx="1" ry="1.5" fill="#5AE89A" opacity="0.8"/>
    </svg>
  );
}

function RelicIcon() {
  return (
    <svg viewBox="0 0 48 48" className="w-full h-full">
      <polygon points="24,6 30,18 44,20 34,30 36,44 24,38 12,44 14,30 4,20 18,18" fill="#D4AF37" stroke="#8B6914" strokeWidth="1.2"/>
      <circle cx="24" cy="24" r="6" fill="#FFF8DC" opacity="0.5"/>
    </svg>
  );
}
