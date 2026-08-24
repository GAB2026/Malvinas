import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Flame } from 'lucide-react';
import { useTranslations } from '@/lib/i18n';

interface Props {
  open: boolean;
  onDismiss: () => void;
}

const STORAGE_KEY = 'warm_welcome_v1';

export function useWelcomeSheet() {
  const [open, setOpen] = React.useState<boolean>(() => {
    try { return localStorage.getItem(STORAGE_KEY) !== '1'; } catch { return false; }
  });

  const dismiss = React.useCallback(() => {
    try { localStorage.setItem(STORAGE_KEY, '1'); } catch { /* ignore */ }
    setOpen(false);
  }, []);

  return { open, dismiss };
}

export default function WelcomeSheet({ open, onDismiss }: Props) {
  const t = useTranslations();
  const w = t.welcome;

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop — no tap-to-dismiss so user reads the text */}
          <motion.div
            key="welcome-backdrop"
            className="fixed inset-0 bg-black/70 z-40 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          />

          {/* Sheet */}
          <motion.div
            key="welcome-sheet"
            className="fixed bottom-0 left-0 right-0 z-50 bg-[#1a1008] border-t border-white/10 rounded-t-3xl px-6 pb-10 pt-5 flex flex-col gap-5 max-h-[90dvh] overflow-y-auto"
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 28, stiffness: 280 }}
          >
            {/* Handle */}
            <div className="w-10 h-1 rounded-full bg-white/20 self-center shrink-0" />

            {/* Icon + title */}
            <div className="flex flex-col items-center gap-2 pt-1 shrink-0">
              <div className="w-12 h-12 rounded-full bg-primary/20 flex items-center justify-center">
                <Flame size={24} className="text-primary" />
              </div>
              <h2 className="text-lg font-semibold text-foreground text-center">
                {w.title}
              </h2>
            </div>

            {/* Body paragraphs */}
            <div className="flex flex-col gap-4 text-sm text-muted-foreground leading-relaxed">
              <p>{w.body1}</p>
              <p>{w.body2}</p>
              <p>{w.body3}</p>
              <p>{w.body4}</p>
            </div>

            {/* CTA */}
            <button
              onClick={onDismiss}
              className="w-full py-4 rounded-2xl bg-primary text-primary-foreground font-semibold text-base active:scale-95 transition-transform shrink-0"
            >
              {w.cta}
            </button>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
