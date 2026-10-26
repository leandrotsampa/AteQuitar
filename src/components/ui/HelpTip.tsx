import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'motion/react';
import { HelpCircle, MapPin } from 'lucide-react';
import { DURATION, EASE_OUT } from '../../lib/motion';

export interface HelpContent {
  title: string;
  body: React.ReactNode;
  // Onde achar a informação (contrato, app do banco, extrato do IR)
  where?: React.ReactNode;
}

// Bolinha "?" que abre uma explicação curta ao clicar (ou passar o mouse)
export const HelpTip: React.FC<{ help: HelpContent; className?: string }> = ({ help, className = '' }) => {
  const btnRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ x: number; y: number; above: boolean } | null>(null);
  const [pinned, setPinned] = useState(false);
  const hoverTimer = useRef<number | undefined>(undefined);

  const open = () => {
    const r = btnRef.current?.getBoundingClientRect();
    if (!r) return;
    const above = r.bottom + 240 > window.innerHeight;
    const x = Math.min(Math.max(12, r.left + r.width / 2 - 160), window.innerWidth - 332);
    setPos({ x, y: above ? window.innerHeight - r.top + 8 : r.bottom + 8, above });
  };
  const close = () => {
    setPos(null);
    setPinned(false);
  };

  useEffect(() => {
    if (!pinned) return;
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node;
      if (!panelRef.current?.contains(t) && !btnRef.current?.contains(t)) close();
    };
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && close();
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [pinned]);

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        aria-label={`Ajuda: ${help.title}`}
        aria-expanded={Boolean(pos)}
        onClick={() => {
          if (pinned) close();
          else {
            open();
            setPinned(true);
          }
        }}
        onMouseEnter={() => {
          window.clearTimeout(hoverTimer.current);
          hoverTimer.current = window.setTimeout(() => !pinned && open(), 250);
        }}
        onMouseLeave={() => {
          window.clearTimeout(hoverTimer.current);
          if (!pinned) setPos(null);
        }}
        className={`inline-flex items-center justify-center w-5 h-5 rounded-full text-slate-400 hover:text-anil-600 hover:bg-anil-50 dark:hover:text-anil-300 dark:hover:bg-anil-500/15 transition-colors cursor-help align-middle ${className}`}
      >
        <HelpCircle className="w-4 h-4" />
      </button>
      {createPortal(
        <AnimatePresence>
          {pos && (
            <motion.div
              ref={panelRef}
              role="tooltip"
              initial={{ opacity: 0, y: pos.above ? 6 : -6, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: pos.above ? 6 : -6 }}
              transition={{ duration: DURATION.base, ease: EASE_OUT }}
              className="app-no-drag fixed z-[80] w-80 p-4 rounded-2xl bg-white dark:bg-slate-800 ring-1 ring-slate-900/10 dark:ring-white/10 shadow-[0_24px_48px_-16px_rgba(30,27,75,0.45)] text-sm"
              style={pos.above ? { left: pos.x, bottom: pos.y } : { left: pos.x, top: pos.y }}
            >
              <div>
                <div className="font-display font-semibold text-[15px] text-slate-900 dark:text-white">{help.title}</div>
                <div className="mt-1 text-slate-600 dark:text-slate-300 leading-relaxed">{help.body}</div>
                {help.where && (
                  <div className="mt-3 flex gap-2 p-2.5 rounded-xl bg-sol-50 text-sol-900 dark:bg-sol-400/10 dark:text-sol-200 text-[13px] leading-snug">
                    <MapPin className="w-4 h-4 shrink-0 mt-0.5 text-sol-600 dark:text-sol-300" />
                    <span>{help.where}</span>
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>,
        document.body
      )}
    </>
  );
};

// Rótulo + ajuda + campo + dica curta embaixo
export const Field: React.FC<{
  label: string;
  htmlFor?: string;
  help?: HelpContent;
  hint?: React.ReactNode;
  optional?: boolean;
  children: React.ReactNode;
  className?: string;
}> = ({ label, htmlFor, help, hint, optional, children, className = '' }) => (
  <div className={className}>
    <div className="flex items-center gap-1.5 mb-1.5">
      <label htmlFor={htmlFor} className="text-sm font-semibold text-slate-800 dark:text-slate-100">
        {label}
      </label>
      {optional && <span className="text-xs text-slate-400 dark:text-slate-500">opcional</span>}
      {help && <HelpTip help={help} />}
    </div>
    {children}
    {hint && <div className="mt-1.5 text-xs text-slate-500 dark:text-slate-400 leading-snug">{hint}</div>}
  </div>
);
