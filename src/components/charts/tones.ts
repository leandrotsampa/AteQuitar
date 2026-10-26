// Cores dos gráficos por tom, em classes Tailwind para acompanhar o tema claro/escuro.
// "color" alimenta o currentColor dos gradientes e das bolinhas.
export type ChartTone = 'anil' | 'sol' | 'menta' | 'rose' | 'sky' | 'slate';

export const TONES: Record<ChartTone, { stroke: string; color: string; fill: string; bg: string }> = {
  anil: {
    stroke: 'stroke-anil-500 dark:stroke-anil-400',
    color: 'text-anil-500 dark:text-anil-400',
    fill: 'fill-anil-500 dark:fill-anil-400',
    bg: 'bg-anil-500 dark:bg-anil-400',
  },
  sol: {
    stroke: 'stroke-sol-400 dark:stroke-sol-300',
    color: 'text-sol-400 dark:text-sol-300',
    fill: 'fill-sol-400 dark:fill-sol-300',
    bg: 'bg-sol-400 dark:bg-sol-300',
  },
  menta: {
    stroke: 'stroke-emerald-500 dark:stroke-emerald-400',
    color: 'text-emerald-500 dark:text-emerald-400',
    fill: 'fill-emerald-500 dark:fill-emerald-400',
    bg: 'bg-emerald-500 dark:bg-emerald-400',
  },
  rose: {
    stroke: 'stroke-rose-500 dark:stroke-rose-400',
    color: 'text-rose-500 dark:text-rose-400',
    fill: 'fill-rose-500 dark:fill-rose-400',
    bg: 'bg-rose-500 dark:bg-rose-400',
  },
  sky: {
    stroke: 'stroke-sky-500 dark:stroke-sky-400',
    color: 'text-sky-500 dark:text-sky-400',
    fill: 'fill-sky-500 dark:fill-sky-400',
    bg: 'bg-sky-500 dark:bg-sky-400',
  },
  slate: {
    stroke: 'stroke-slate-400 dark:stroke-slate-500',
    color: 'text-slate-400 dark:text-slate-500',
    fill: 'fill-slate-400 dark:fill-slate-500',
    bg: 'bg-slate-400 dark:bg-slate-500',
  },
};
