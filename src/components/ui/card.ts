// Superfície padrão: branca sobre o fundo azulado, sombra com um toque de anil;
// no escuro, um tom acima da noite com aresta de cima levemente iluminada
export const card =
  'bg-white dark:bg-slate-900 border border-slate-900/[0.05] dark:border-white/[0.07] rounded-[22px] shadow-[0_1px_2px_rgba(30,34,80,0.05),0_16px_40px_-20px_rgba(45,40,140,0.25)] dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.05),0_18px_40px_-24px_rgba(0,0,0,0.85)]';

// Bloco interno (indicador dentro de um card)
export const tile = 'bg-slate-50 ring-1 ring-inset ring-slate-900/[0.04] dark:bg-slate-950/70 dark:ring-white/[0.04] rounded-2xl';

export const btnPrimary =
  'inline-flex items-center justify-center gap-2 h-10 px-5 rounded-full bg-anil-600 hover:bg-anil-500 text-white text-sm font-semibold shadow-[0_8px_20px_-8px_rgba(77,72,228,0.7)] transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed';

// Secundário: no claro, branco com borda e sombra leve (o cinza claro sumia no fundo azulado);
// no escuro, um tom acima da noite
export const btnGhost =
  'inline-flex items-center justify-center gap-2 h-10 px-4 rounded-full bg-white border border-slate-300/90 shadow-[0_1px_2px_rgba(30,34,80,0.08)] hover:border-anil-300 hover:bg-anil-50 text-slate-800 dark:bg-slate-800 dark:border-transparent dark:shadow-none dark:hover:bg-slate-700 dark:text-slate-100 text-sm font-semibold transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed';

// Opção que se escolhe (banco, prazo/parcela, valor rápido): escolhida, cheia na cor; as outras,
// como o botão secundário, para parecerem clicáveis também no claro. Tamanho e texto ficam com quem usa
export const chip = (active: boolean, tone: 'anil' | 'sol' = 'anil') =>
  `rounded-full border font-semibold transition-colors cursor-pointer ${
    active
      ? tone === 'sol'
        ? 'bg-sol-400 border-sol-400 text-slate-900'
        : 'bg-anil-600 border-anil-600 text-white shadow-[0_6px_14px_-8px_rgba(77,72,228,0.8)]'
      : 'bg-white border-slate-300/90 text-slate-700 hover:border-anil-300 hover:bg-anil-50 dark:bg-slate-800 dark:border-transparent dark:text-slate-200 dark:hover:bg-slate-700'
  }`;

export const inputBase =
  'w-full h-12 px-3 bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl text-[15px] text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-600 focus:outline-none focus:border-anil-500 focus:ring-2 focus:ring-anil-500/25 transition-shadow';
