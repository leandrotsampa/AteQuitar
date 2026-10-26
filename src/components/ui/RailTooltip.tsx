import React, { useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'motion/react';
import { DURATION, EASE_OUT } from '../../lib/motion';

// Dica à direita de um item do menu recolhido. Posição fixa (portal) para não ser cortada
// pela largura do menu nem pela borda da janela.
export const RailTooltip: React.FC<{
  enabled: boolean;
  label: React.ReactNode;
  detail?: React.ReactNode;
  children: React.ReactElement;
}> = ({ enabled, label, detail, children }) => {
  const anchorRef = useRef<HTMLSpanElement>(null);
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);

  const show = () => {
    const r = anchorRef.current?.getBoundingClientRect();
    if (r) setPos({ x: r.right + 10, y: r.top + r.height / 2 });
  };
  const hide = () => setPos(null);

  return (
    <span
      ref={anchorRef}
      className="block"
      onMouseEnter={enabled ? show : undefined}
      onMouseLeave={hide}
      onFocus={enabled ? show : undefined}
      onBlur={hide}
    >
      {children}
      {createPortal(
        <AnimatePresence>
          {enabled && pos && (
            <motion.div
              role="tooltip"
              initial={{ opacity: 0, x: -4 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: DURATION.micro, ease: EASE_OUT }}
              className="fixed z-[60] -translate-y-1/2 pointer-events-none px-2.5 py-1.5 rounded-md bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900 shadow-lg text-xs whitespace-nowrap"
              style={{ left: pos.x, top: pos.y }}
            >
              <div className="font-semibold">{label}</div>
              {detail && <div className="text-[11px] opacity-75">{detail}</div>}
            </motion.div>
          )}
        </AnimatePresence>,
        document.body
      )}
    </span>
  );
};
