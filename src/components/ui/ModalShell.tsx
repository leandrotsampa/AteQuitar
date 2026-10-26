import React, { useEffect, useRef } from 'react';
import { motion } from 'motion/react';
import { DURATION, EASE_OUT } from '../../lib/motion';

// Fundo + painel de modal com entrada e saída animadas.
// A saída depende de o modal ser montado dentro de um <AnimatePresence> (ver App.tsx).
// Ao abrir, o foco entra no painel; ao fechar, volta para onde estava.
export const ModalShell: React.FC<{ children: React.ReactNode; panelClassName: string; ariaLabel: string }> = ({
  children,
  panelClassName,
  ariaLabel,
}) => {
  const panelRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    // Respeita um botão que já pegou o foco ao abrir (autoFocus)
    if (!panelRef.current?.contains(document.activeElement)) panelRef.current?.focus({ preventScroll: true });
    return () => previous?.focus?.({ preventScroll: true });
  }, []);

  return (
    <motion.div
      className="app-no-drag fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: DURATION.base, ease: EASE_OUT }}
    >
      <motion.div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={ariaLabel}
        tabIndex={-1}
        className={`${panelClassName} focus:outline-none`}
        initial={{ opacity: 0, scale: 0.97, y: 8 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.97, y: 8 }}
        transition={{ duration: DURATION.base, ease: EASE_OUT }}
      >
        {children}
      </motion.div>
    </motion.div>
  );
};
