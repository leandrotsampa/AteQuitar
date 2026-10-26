// Superfície padrão: branca sobre o fundo azulado, sombra com um toque de anil;
// no escuro, um tom acima da noite com aresta de cima levemente iluminada
export const card =
  'bg-white dark:bg-slate-900 border border-slate-900/[0.05] dark:border-white/[0.07] rounded-[22px] shadow-[0_1px_2px_rgba(30,34,80,0.05),0_16px_40px_-20px_rgba(45,40,140,0.25)] dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.05),0_18px_40px_-24px_rgba(0,0,0,0.85)]';

// Bloco interno (indicador dentro de um card)
export const tile = 'bg-slate-50 ring-1 ring-inset ring-slate-900/[0.04] dark:bg-slate-950/70 dark:ring-white/[0.04] rounded-2xl';

export const btnPrimary =
  'inline-flex items-center justify-center gap-2 h-10 px-5 rounded-full bg-anil-600 hover:bg-anil-500 text-white text-sm font-semibold shadow-[0_8px_20px_-8px_rgba(77,72,228,0.7)] transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed';

export const btnGhost =
  'inline-flex items-center justify-center gap-2 h-10 px-4 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-800 dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-slate-100 text-sm font-semibold transition-colors cursor-pointer disabled:opacity-50';

export const inputBase =
  'w-full h-11 px-3 bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl text-[15px] text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-600 focus:outline-none focus:border-anil-500 focus:ring-2 focus:ring-anil-500/25 transition-shadow';
