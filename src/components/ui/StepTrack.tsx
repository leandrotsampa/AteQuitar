import React from 'react';
import { motion, useReducedMotion } from 'motion/react';
import { AlertTriangle, Check, type LucideIcon } from 'lucide-react';
import { EASE_OUT } from '../../lib/motion';

// Trilho de etapas em círculos ligados por uma linha: as concluídas com check, a atual em
// destaque com um anel girando (carregando) e as futuras apagadas. Ao avançar, os trechos
// da linha se preenchem em sequência. Etapas alcançáveis são botões; as outras, desabilitadas
export const StepTrack: React.FC<{
  steps: string[];
  icons?: LucideIcon[];
  current: number;
  done: (k: number) => boolean;
  // Etapa com dado obrigatório faltando: alerta em vez de check
  invalid?: (k: number) => boolean;
  reachable: (k: number) => boolean;
  onSelect: (k: number) => void;
  numbered?: boolean;
  size?: 'sm' | 'md';
  ariaLabel: string;
  className?: string;
}> = ({ steps, icons, current, done, invalid, reachable, onSelect, numbered = false, size = 'md', ariaLabel, className = '' }) => {
  const reduce = Boolean(useReducedMotion());
  const n = steps.length;
  const circle = size === 'sm' ? 'w-8 h-8' : 'w-10 h-10';
  const icon = size === 'sm' ? 'w-4 h-4' : 'w-[18px] h-[18px]';
  // Centro do círculo k, em % da largura (cada etapa ocupa uma coluna igual)
  const center = (k: number) => ((k + 0.5) / n) * 100;
  const isBad = (k: number) => Boolean(invalid?.(k));
  const isDone = (k: number) => k !== current && !isBad(k) && done(k);

  return (
    <nav aria-label={ariaLabel} className={className}>
      <ol className="relative flex">
        {/* Trechos da linha entre os círculos: cheio quando os dois lados já foram vencidos */}
        {steps.slice(0, -1).map((_, k) => {
          const filled = (isDone(k) || k === current) && (isDone(k + 1) || k + 1 === current);
          return (
            <span
              key={`seg-${k}`}
              aria-hidden
              className={`absolute ${size === 'sm' ? 'top-4' : 'top-5'} -translate-y-1/2 h-1 rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden`}
              style={{ left: `calc(${center(k)}% + ${size === 'sm' ? 20 : 24}px)`, width: `calc(${100 / n}% - ${size === 'sm' ? 40 : 48}px)` }}
            >
              <motion.span
                className="block h-full rounded-full bg-gradient-to-r from-anil-500 to-anil-400"
                initial={false}
                animate={{ width: filled ? '100%' : '0%' }}
                transition={reduce ? { duration: 0 } : { duration: 0.45, ease: EASE_OUT, delay: filled ? k * 0.08 : 0 }}
              />
            </span>
          );
        })}

        {steps.map((title, k) => {
          const isCurrent = k === current;
          const finished = isDone(k);
          const bad = isBad(k);
          const canGo = !isCurrent && reachable(k);
          const Icon = icons?.[k];
          return (
            <li key={title} className="relative flex-1 min-w-0 flex justify-center">
              <button
                type="button"
                onClick={() => canGo && onSelect(k)}
                disabled={!canGo && !isCurrent}
                aria-current={isCurrent ? 'step' : undefined}
                aria-label={`${numbered ? `Etapa ${k + 1}: ` : ''}${title}${bad ? ', falta preencher' : finished ? ', concluída' : isCurrent ? ', atual' : ''}`}
                className={`group flex flex-col items-center gap-2 max-w-full rounded-xl transition-opacity disabled:opacity-45 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-anil-500/40 ${
                  canGo ? 'cursor-pointer' : isCurrent ? 'cursor-default' : 'cursor-not-allowed'
                }`}
              >
                <span className={`relative ${circle} shrink-0`}>
                  {/* Atual: halo suave e um arco girando em volta, como carregando */}
                  {isCurrent && (
                    <>
                      <span className="absolute -inset-1.5 rounded-full bg-anil-500/15 dark:bg-anil-400/15 blur-[2px]" aria-hidden />
                      <motion.span
                        aria-hidden
                        className="absolute -inset-1 rounded-full border-2 border-transparent border-t-anil-500 border-r-anil-300 dark:border-t-anil-300 dark:border-r-anil-500/60"
                        animate={reduce ? undefined : { rotate: 360 }}
                        transition={reduce ? undefined : { repeat: Infinity, duration: 1.4, ease: 'linear' }}
                      />
                    </>
                  )}
                  <motion.span
                    className={`absolute inset-0 rounded-full flex items-center justify-center transition-colors ${
                      bad && !isCurrent
                        ? `bg-rose-50 text-rose-600 ring-2 ring-rose-400 dark:bg-rose-500/10 dark:text-rose-300 dark:ring-rose-500/70 ${canGo ? 'group-hover:bg-rose-100' : ''}`
                        : finished
                        ? `bg-anil-500 text-white shadow-[0_6px_14px_-6px_rgba(79,70,229,0.7)] ${canGo ? 'group-hover:bg-anil-600' : ''}`
                        : isCurrent
                          ? 'bg-white text-anil-600 ring-2 ring-anil-500 shadow-[0_8px_20px_-8px_rgba(79,70,229,0.6)] dark:bg-slate-950 dark:text-anil-300 dark:ring-anil-400'
                          : `bg-white text-slate-400 ring-1 ring-slate-300 dark:bg-slate-900 dark:text-slate-500 dark:ring-slate-700 ${
                              canGo ? 'group-hover:ring-anil-400 group-hover:text-anil-500' : ''
                            }`
                    }`}
                    initial={false}
                    animate={{ scale: isCurrent ? 1.06 : 1 }}
                    transition={reduce ? { duration: 0 } : { type: 'spring', stiffness: 380, damping: 22 }}
                  >
                    {bad && !isCurrent ? (
                      <AlertTriangle className={icon} />
                    ) : finished ? (
                      <motion.span
                        key="check"
                        initial={reduce ? false : { scale: 0.4, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        transition={reduce ? { duration: 0 } : { type: 'spring', stiffness: 500, damping: 24, delay: 0.15 }}
                      >
                        <Check className={icon} strokeWidth={3} />
                      </motion.span>
                    ) : Icon ? (
                      <Icon className={icon} />
                    ) : (
                      <span className="font-num text-sm font-bold">{k + 1}</span>
                    )}
                  </motion.span>
                </span>
                <span
                  className={`max-w-full px-2.5 py-0.5 rounded-full truncate ${size === 'sm' ? 'text-xs' : 'text-[13px]'} font-semibold transition-colors ${
                    isCurrent
                      ? 'bg-anil-50 text-anil-700 dark:bg-anil-500/15 dark:text-anil-200'
                      : bad
                        ? 'text-rose-600 dark:text-rose-300'
                        : finished
                        ? `text-slate-600 dark:text-slate-300 ${canGo ? 'group-hover:text-slate-900 dark:group-hover:text-white' : ''}`
                        : `text-slate-400 dark:text-slate-500 ${canGo ? 'group-hover:text-slate-700 dark:group-hover:text-slate-300' : ''}`
                  }`}
                >
                  {numbered ? `${k + 1}. ${title}` : title}
                </span>
              </button>
            </li>
          );
        })}
      </ol>
    </nav>
  );
};
