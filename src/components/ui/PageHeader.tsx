import React from 'react';
import { motion, useReducedMotion } from 'motion/react';
import { EASE_OUT, instantIf } from '../../lib/motion';

// Abertura de cada tela: contexto curto, título revelado da esquerda para a direita e ações
export const PageHeader: React.FC<{
  context?: React.ReactNode;
  title: React.ReactNode;
  description?: React.ReactNode;
  actions?: React.ReactNode;
}> = ({ context, title, description, actions }) => {
  const reduceMotion = Boolean(useReducedMotion());
  return (
    <header className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
      <div className="min-w-0">
        {context && <div className="text-sm font-medium text-anil-700 dark:text-anil-300">{context}</div>}
        <motion.h1
          className="text-[2.1rem] leading-[1.1] font-bold tracking-tight text-slate-900 dark:text-white mt-1"
          initial={reduceMotion ? false : { clipPath: 'inset(0 100% 0 0)' }}
          animate={{ clipPath: 'inset(0 0% 0 0)' }}
          transition={instantIf(reduceMotion, { duration: 0.6, ease: EASE_OUT, delay: 0.05 })}
        >
          {title}
        </motion.h1>
        {description && <p className="text-[15px] text-slate-600 dark:text-slate-400 mt-2 max-w-2xl leading-relaxed">{description}</p>}
      </div>
      {actions && <div className="flex items-center gap-2 flex-wrap shrink-0">{actions}</div>}
    </header>
  );
};
