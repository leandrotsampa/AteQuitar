import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { CalendarDays, ChevronDown, ChevronLeft, ChevronRight } from 'lucide-react';
import { addMonths, currentYearMonth } from '../../lib/format';
import { clampMonth, isOutside, MONTH_SHORT_NAMES, monthLongName, navigateMonth } from '../../lib/monthPicker';
import { DURATION, EASE_OUT, instantIf } from '../../lib/motion';
import { playSound } from '../../hooks/useSound';

const pad = (m: number) => String(m).padStart(2, '0');

interface Limits {
  min?: string;
  max?: string;
  // Meses com um pontinho (ex.: check-in feito) e o que o ponto significa
  marked?: Set<string>;
  markedLabel?: string;
}

// Grade de meses: ano com setas, 12 meses (o escolhido em anil, os marcados com um ponto,
// o mês atual com contorno) e atalho para o mês atual. Teclado: setas, Home/End, PageUp/PageDown e Enter.
// Meses fora dos limites ficam bloqueados.
export const MonthPickerPanel: React.FC<Limits & { value: string; onSelect: (yearMonth: string) => void }> = ({
  value,
  onSelect,
  min,
  max,
  marked,
  markedLabel,
}) => {
  const reduce = Boolean(useReducedMotion());
  const [viewYear, setViewYear] = useState(() => Number(value.slice(0, 4)));
  const [focused, setFocused] = useState(value);
  const gridRef = useRef<HTMLDivElement>(null);
  const today = currentYearMonth();
  const minYear = min ? Number(min.slice(0, 4)) : -Infinity;
  const maxYear = max ? Number(max.slice(0, 4)) : Infinity;

  // Foco segue o mês navegado pelo teclado (inclusive ao abrir o painel)
  useEffect(() => {
    gridRef.current?.querySelector<HTMLButtonElement>(`[data-month="${focused}"]`)?.focus();
  }, [focused, viewYear]);

  const onKeyDown = (e: React.KeyboardEvent) => {
    const next = navigateMonth(focused, e.key, min, max);
    if (!next) return;
    e.preventDefault();
    setFocused(next);
    setViewYear(Number(next.slice(0, 4)));
  };

  const changeYear = (delta: number) => {
    const y = Math.min(maxYear, Math.max(minYear, viewYear + delta));
    setViewYear(y);
    setFocused(clampMonth(`${y}-${focused.slice(5, 7)}`, min, max));
    playSound('tick');
  };

  const todayAllowed = !isOutside(today, min, max);
  const navBtn =
    'w-8 h-8 flex items-center justify-center rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-100 dark:text-slate-400 dark:hover:text-white dark:hover:bg-slate-800 transition-colors cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:bg-transparent';

  return (
    <div className="w-64">
      <div className="flex items-center justify-between mb-2">
        <button type="button" onClick={() => changeYear(-1)} disabled={viewYear <= minYear} className={navBtn} aria-label="Ano anterior">
          <ChevronLeft className="w-4 h-4" />
        </button>
        <span className="text-sm font-bold font-num text-slate-900 dark:text-white" aria-live="polite">
          {viewYear}
        </span>
        <button type="button" onClick={() => changeYear(1)} disabled={viewYear >= maxYear} className={navBtn} aria-label="Próximo ano">
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>

      <div ref={gridRef} role="group" aria-label={`Meses de ${viewYear}`} className="grid grid-cols-3 gap-1" onKeyDown={onKeyDown}>
        {MONTH_SHORT_NAMES.map((short, i) => {
          const ym = `${viewYear}-${pad(i + 1)}`;
          const selected = ym === value;
          const dot = marked?.has(ym);
          const isToday = ym === today;
          const blocked = isOutside(ym, min, max);
          return (
            <button
              key={ym}
              type="button"
              data-month={ym}
              tabIndex={ym === focused ? 0 : -1}
              aria-pressed={selected}
              disabled={blocked}
              aria-label={`${monthLongName(ym)} de ${viewYear}${dot && markedLabel ? `, ${markedLabel}` : ''}${isToday ? ', mês atual' : ''}`}
              onClick={() => onSelect(ym)}
              onFocus={() => setFocused(ym)}
              className={`relative h-11 rounded-lg text-sm capitalize transition-colors ${
                selected
                  ? 'text-white font-semibold cursor-pointer'
                  : blocked
                    ? 'text-slate-300 dark:text-slate-600 cursor-not-allowed'
                    : 'text-slate-700 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800 cursor-pointer'
              } ${isToday && !selected ? 'ring-1 ring-inset ring-anil-500/60' : ''}`}
            >
              {selected && (
                <motion.span
                  layoutId="month-pick"
                  className="absolute inset-0 rounded-lg bg-anil-600 dark:bg-anil-500"
                  transition={instantIf(reduce, { type: 'spring', stiffness: 420, damping: 34 } as const)}
                />
              )}
              <span className="relative">{short}</span>
              {dot && (
                <span
                  className={`absolute bottom-1.5 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full ${selected ? 'bg-white' : 'bg-sol-500'}`}
                />
              )}
            </button>
          );
        })}
      </div>

      <div className="flex items-center justify-between mt-3 pt-2.5 border-t border-slate-200 dark:border-slate-800 text-[11px]">
        {markedLabel ? (
          <span className="flex items-center gap-1.5 text-slate-500 dark:text-slate-400">
            <span className="w-1.5 h-1.5 rounded-full bg-sol-500" /> {markedLabel}
          </span>
        ) : (
          <span />
        )}
        {todayAllowed && (
          <button
            type="button"
            onClick={() => onSelect(today)}
            className="font-semibold text-anil-700 hover:text-anil-600 dark:text-anil-300 dark:hover:text-anil-200 cursor-pointer"
          >
            Mês atual
          </button>
        )}
      </div>
    </div>
  );
};

// Campo de mês no estilo da competência: setas para o mês vizinho e, no meio, o mês
// que abre a grade flutuante. O mês desliza na direção da seta usada.
export const MonthField: React.FC<
  Limits & { value: string; onChange: (yearMonth: string) => void; ariaLabel?: string; className?: string }
> = ({ value, onChange, ariaLabel = 'Mês', className = '', min, max, marked, markedLabel }) => {
  const reduce = Boolean(useReducedMotion());
  const anchorRef = useRef<HTMLButtonElement>(null);
  const blockRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ x: number; y: number; above: boolean } | null>(null);
  const [step, setStep] = useState<{ n: number; dir: number }>({ n: 0, dir: 0 });

  const go = (next: string, fromArrow: boolean) => {
    if (next === value || isOutside(next, min, max)) return;
    playSound('tick');
    if (fromArrow) setStep((s) => ({ n: s.n + 1, dir: next > value ? 1 : -1 }));
    else setStep((s) => ({ n: s.n + 1, dir: 0 }));
    onChange(next);
  };

  const toggle = () => {
    if (pos) {
      setPos(null);
      return;
    }
    const r = blockRef.current?.getBoundingClientRect();
    if (!r) return;
    const panelH = 340;
    const above = r.bottom + panelH > window.innerHeight && r.top > panelH;
    setPos({ x: Math.min(r.left, window.innerWidth - 300), y: above ? window.innerHeight - r.top + 8 : r.bottom + 8, above });
  };

  useEffect(() => {
    if (!pos) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      e.stopPropagation();
      setPos(null);
      anchorRef.current?.focus();
    };
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node;
      if (!panelRef.current?.contains(t) && !blockRef.current?.contains(t)) setPos(null);
    };
    const onScroll = (e: Event) => {
      if (!panelRef.current?.contains(e.target as Node)) setPos(null);
    };
    window.addEventListener('keydown', onKey, true);
    document.addEventListener('mousedown', onDown);
    window.addEventListener('scroll', onScroll, true);
    window.addEventListener('resize', onScroll);
    return () => {
      window.removeEventListener('keydown', onKey, true);
      document.removeEventListener('mousedown', onDown);
      window.removeEventListener('scroll', onScroll, true);
      window.removeEventListener('resize', onScroll);
    };
  }, [pos]);

  const prev = addMonths(value, -1);
  const next = addMonths(value, 1);
  const stepBtn =
    'w-9 shrink-0 flex items-center justify-center rounded-lg text-slate-500 hover:text-slate-900 hover:bg-white dark:text-slate-400 dark:hover:text-white dark:hover:bg-slate-800 transition-colors cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:bg-transparent';

  return (
    <>
      <div
        ref={blockRef}
        className={`flex items-stretch gap-1 p-1 h-14 rounded-xl bg-slate-50 dark:bg-slate-950/60 ring-1 ring-slate-900/[0.08] dark:ring-white/[0.08] ${className}`}
      >
        <button type="button" onClick={() => go(prev, true)} disabled={isOutside(prev, min, max)} className={stepBtn} aria-label="Mês anterior">
          <ChevronLeft className="w-4 h-4" />
        </button>
        <button
          ref={anchorRef}
          type="button"
          onClick={toggle}
          aria-haspopup="dialog"
          aria-expanded={Boolean(pos)}
          aria-label={`${ariaLabel}: ${monthLongName(value)} de ${value.slice(0, 4)}. Escolher outro mês`}
          className="flex-1 min-w-0 rounded-lg hover:bg-white dark:hover:bg-slate-800/60 transition-colors cursor-pointer overflow-hidden active:transform-none"
        >
          <motion.div
            key={step.n}
            initial={step.n === 0 || step.dir === 0 || reduce ? false : { x: step.dir * 18, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            transition={{ duration: DURATION.base, ease: EASE_OUT }}
            className="flex flex-col items-center leading-tight"
          >
            <span className="flex items-center gap-1 text-sm font-bold text-slate-900 dark:text-white">
              {monthLongName(value)}
              <ChevronDown className={`w-3.5 h-3.5 text-slate-400 transition-transform duration-[var(--duration-base)] ${pos ? 'rotate-180' : ''}`} />
            </span>
            <span className="flex items-center gap-1 text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
              <CalendarDays className="w-3 h-3" />
              <span className="font-num">{value.slice(0, 4)}</span>
              {marked?.has(value) && markedLabel && (
                <>
                  <span className="w-1 h-1 rounded-full bg-sol-500" />
                  <span>{markedLabel}</span>
                </>
              )}
            </span>
          </motion.div>
        </button>
        <button type="button" onClick={() => go(next, true)} disabled={isOutside(next, min, max)} className={stepBtn} aria-label="Próximo mês">
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>

      {createPortal(
        <AnimatePresence>
          {pos && (
            <motion.div
              ref={panelRef}
              key="month-panel"
              role="dialog"
              aria-label={`Escolher: ${ariaLabel}`}
              className="app-no-drag fixed z-[85] p-3 rounded-2xl bg-white dark:bg-slate-900 ring-1 ring-slate-900/10 dark:ring-white/10 shadow-[0_24px_48px_-16px_rgba(30,27,75,0.45)]"
              style={pos.above ? { left: pos.x, bottom: pos.y } : { left: pos.x, top: pos.y }}
              initial={{ opacity: 0, y: pos.above ? 6 : -6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: pos.above ? 6 : -6 }}
              transition={{ duration: DURATION.base, ease: EASE_OUT }}
            >
              <MonthPickerPanel
                value={value}
                min={min}
                max={max}
                marked={marked}
                markedLabel={markedLabel}
                onSelect={(ym) => {
                  go(ym, false);
                  setPos(null);
                  anchorRef.current?.focus();
                }}
              />
            </motion.div>
          )}
        </AnimatePresence>,
        document.body
      )}
    </>
  );
};
