import { useEffect } from 'react';
import { create } from 'zustand';

export const useToastStore = create((set) => ({
  toasts: [],
  addToast: (message, type = 'success') => {
    const id = Date.now();
    set((s) => ({ toasts: [...s.toasts, { id, message, type }] }));
    setTimeout(() => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })), 3500);
  },
}));

const COLORS = {
  success: 'border-green-500/50 bg-green-900/30 text-green-400',
  error: 'border-blood bg-blood/20 text-blood-glow',
  info: 'border-gold/50 bg-gold/10 text-gold',
};

export default function ToastContainer() {
  const toasts = useToastStore((s) => s.toasts);

  if (toasts.length === 0) return null;

  return (
    <div aria-live="polite" className="fixed top-4 right-4 z-50 flex flex-col gap-2 pointer-events-none">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={`pointer-events-auto border rounded-lg px-4 py-2.5 text-sm shadow-lg animate-slide-in ${COLORS[t.type] || COLORS.info}`}
        >
          {t.message}
        </div>
      ))}
    </div>
  );
}
