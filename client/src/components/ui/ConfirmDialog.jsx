import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';

export default function ConfirmDialog({ message, onConfirm, onCancel, confirmLabel, danger = true }) {
  const { t } = useTranslation();
  const btnRef = useRef(null);

  useEffect(() => {
    btnRef.current?.focus();
    const handleKey = (e) => { if (e.key === 'Escape') onCancel(); };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [onCancel]);

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/60" onClick={onCancel}>
      <div
        className="bg-elevated border border-border rounded-lg p-6 max-w-sm mx-4 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <p className="text-parchment text-sm mb-5">{message}</p>
        <div className="flex gap-3 justify-end">
          <button
            onClick={onCancel}
            className="px-4 py-2 text-sm border border-border rounded text-muted hover:text-parchment hover:border-gold/30 transition-colors"
          >
            {t('common.cancel')}
          </button>
          <button
            ref={btnRef}
            onClick={onConfirm}
            className={`px-4 py-2 text-sm rounded font-medium transition-colors ${
              danger
                ? 'bg-blood border border-blood text-parchment hover:bg-blood-light'
                : 'bg-blood border border-gold text-parchment hover:bg-blood-light'
            }`}
          >
            {confirmLabel || t('common.confirm')}
          </button>
        </div>
      </div>
    </div>
  );
}
