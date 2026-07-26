import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Flame, Check, X, RotateCcw } from 'lucide-react';
import { usePremium } from '@/hooks/usePremium';
import { useTranslations } from '@/lib/i18n';

interface PremiumSheetProps {
  open: boolean;
  onClose: () => void;
}

export default function PremiumSheet({ open, onClose }: PremiumSheetProps) {
  const t = useTranslations();
  const { purchase, restore } = usePremium();
  const [loading, setLoading] = useState(false);
  const [restored, setRestored] = useState(false);

  const handlePurchase = async () => {
    setLoading(true);
    const ok = await purchase();
    setLoading(false);
    if (ok) onClose();
  };

  const handleRestore = async () => {
    setLoading(true);
    const ok = await restore();
    setLoading(false);
    if (ok) {
      onClose();
    } else {
      setRestored(true);
      setTimeout(() => setRestored(false), 3000);
    }
  };

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            key="backdrop"
            className="fixed inset-0 bg-black/60 z-40 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />

          {/* Sheet */}
          <motion.div
            key="sheet"
            className="fixed bottom-0 left-0 right-0 z-50 bg-[#1a1008] border-t border-white/10 rounded-t-3xl px-6 pb-10 pt-5 flex flex-col gap-6"
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 28, stiffness: 280 }}
          >
            {/* Handle */}
            <div className="w-10 h-1 rounded-full bg-white/20 self-center" />

            {/* Close */}
            <button
              onClick={onClose}
              className="absolute top-5 right-5 text-muted-foreground hover:text-foreground transition-colors"
            >
              <X size={20} />
            </button>

            {/* Header */}
            <div className="flex flex-col items-center gap-2 pt-2">
              <div className="w-14 h-14 rounded-full bg-primary/20 flex items-center justify-center">
                <Flame size={28} className="text-primary" />
              </div>
              <h2 className="text-xl font-semibold text-foreground text-center">
                {t.premium.title}
              </h2>
              <p className="text-sm text-muted-foreground text-center max-w-xs">
                {t.premium.subtitle}
              </p>
            </div>

            {/* Benefits */}
            <div className="flex flex-col gap-3 bg-white/5 rounded-2xl p-4">
              {[t.premium.benefit1, t.premium.benefit2].map((b) => (
                <div key={b} className="flex items-center gap-3">
                  <div className="w-5 h-5 rounded-full bg-primary/20 flex items-center justify-center shrink-0">
                    <Check size={12} className="text-primary" />
                  </div>
                  <span className="text-sm text-foreground">{b}</span>
                </div>
              ))}
            </div>

            {/* Price + CTA */}
            <div className="flex flex-col items-center gap-1">
              <span className="text-3xl font-bold text-foreground">
                {t.premium.price}
              </span>
              <span className="text-xs text-muted-foreground">
                {t.premium.priceNote}
              </span>
            </div>

            <button
              onClick={handlePurchase}
              disabled={loading}
              className="w-full py-4 rounded-2xl bg-primary text-primary-foreground font-semibold text-base transition-opacity active:scale-95 disabled:opacity-60"
            >
              {loading ? '…' : t.premium.buyBtn}
            </button>

            {/* Restore */}
            <button
              onClick={handleRestore}
              disabled={loading}
              className="flex items-center justify-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
            >
              <RotateCcw size={11} />
              {restored ? '—' : t.premium.restoreBtn}
            </button>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
