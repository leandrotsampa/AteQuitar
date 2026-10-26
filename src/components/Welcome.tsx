import React, { useEffect, useState } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import { ArrowRight, Calculator, Gauge, LineChart, Moon, PiggyBank, Sun } from 'lucide-react';
import { HouseHero } from './HouseHero';
import { EASE_OUT } from '../lib/motion';
import { btnGhost, btnPrimary } from './ui/card';

const FEATURES = [
  { icon: LineChart, title: 'Quanto falta, de verdade', text: 'Saldo, parcelas restantes e a data da quitação, corrigidos pela TR.' },
  { icon: Calculator, title: 'Amortizar vale a pena?', text: 'Veja quanto de juros some ao pagar a mais, reduzindo prazo ou parcela.' },
  { icon: PiggyBank, title: 'Ou é melhor investir?', text: 'Comparamos sua dívida com poupança, CDB, LCI e Tesouro, com taxas de hoje.' },
  { icon: Gauge, title: 'Sua taxa é justa?', text: 'Sua taxa contra a média dos bancos, segundo o Banco Central.' },
];

export const Welcome: React.FC<{
  dark: boolean;
  onStart: () => void;
  onDemo: () => void;
  toggleTheme: (origin?: HTMLElement | null) => void;
}> = ({ dark, onStart, onDemo, toggleTheme }) => {
  const reduce = Boolean(useReducedMotion());
  // A casa da vitrine vai se enchendo sozinha, de pouco em pouco
  const [demo, setDemo] = useState(0.05);
  useEffect(() => {
    if (reduce) {
      setDemo(0.6);
      return;
    }
    const steps = [0.18, 0.32, 0.47, 0.63, 0.78, 1, 0.05];
    let k = 0;
    const t = window.setInterval(() => {
      setDemo(steps[k % steps.length]);
      k++;
    }, 2200);
    return () => window.clearInterval(t);
  }, [reduce]);

  return (
    <div className="max-w-6xl mx-auto px-6 lg:px-10 py-6 lg:py-12 grid lg:grid-cols-[1.05fr_1fr] gap-10 items-center">
      <div>
        <motion.h1
          className="text-[2.9rem] sm:text-[3.6rem] leading-[1.02] font-extrabold tracking-tight text-slate-900 dark:text-white"
          initial={reduce ? false : { opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: EASE_OUT }}
        >
          Acompanhe sua casa até a última parcela.
        </motion.h1>
        <motion.p
          className="mt-5 text-lg text-slate-600 dark:text-slate-300 max-w-xl leading-relaxed"
          initial={reduce ? false : { opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: EASE_OUT, delay: 0.1 }}
        >
          Cadastre o financiamento uma vez e veja, todo mês, quanto já é seu, quanto falta e quais decisões fazem você quitar mais
          cedo. As taxas do Banco Central se atualizam sozinhas.
        </motion.p>

        <motion.div
          className="mt-8 flex flex-wrap items-center gap-3"
          initial={reduce ? false : { opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: EASE_OUT, delay: 0.2 }}
        >
          <button type="button" onClick={onStart} className={`${btnPrimary} h-12 px-6 text-[15px] ring-breathe`}>
            Cadastrar meu financiamento <ArrowRight className="w-4 h-4" />
          </button>
          <button type="button" onClick={onDemo} className={`${btnGhost} h-12 px-5`}>
            Explorar com um exemplo
          </button>
        </motion.div>
        <p className="mt-3 text-sm text-slate-500 dark:text-slate-400 flex items-center gap-2">
          Leva uns 2 minutos. Seus dados ficam só neste computador.
          <button
            type="button"
            onClick={(e) => toggleTheme(e.currentTarget)}
            className="inline-flex items-center gap-1 h-7 px-2.5 rounded-full hover:bg-white/70 dark:hover:bg-slate-800 cursor-pointer"
            title="Trocar entre dia e noite"
          >
            {dark ? <Moon className="w-4 h-4 text-anil-300" /> : <Sun className="w-4 h-4 text-sol-500" />}
            {dark ? 'Noite' : 'Dia'}
          </button>
        </p>

        <div className="mt-10 grid sm:grid-cols-2 gap-x-6 gap-y-5">
          {FEATURES.map((f, k) => (
            <motion.div
              key={f.title}
              className="flex gap-3"
              initial={reduce ? false : { opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, ease: EASE_OUT, delay: 0.35 + k * 0.08 }}
            >
              <span className="w-10 h-10 shrink-0 rounded-2xl bg-white dark:bg-slate-900 ring-1 ring-slate-900/[0.06] dark:ring-white/[0.08] flex items-center justify-center text-anil-600 dark:text-anil-300 shadow-sm">
                <f.icon className="w-5 h-5" />
              </span>
              <div>
                <div className="font-semibold text-slate-900 dark:text-white text-[15px]">{f.title}</div>
                <div className="text-sm text-slate-600 dark:text-slate-400 leading-snug mt-0.5">{f.text}</div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>

      <motion.div
        className="relative"
        initial={reduce ? false : { opacity: 0, scale: 0.94, rotate: -1.5 }}
        animate={{ opacity: 1, scale: 1, rotate: 0 }}
        transition={{ type: 'spring', stiffness: 120, damping: 18, delay: 0.15 }}
      >
        <div className="rounded-[36px] overflow-hidden ring-1 ring-slate-900/[0.06] dark:ring-white/[0.08] shadow-[0_40px_80px_-40px_rgba(45,40,140,0.6)]">
          <HouseHero progress={demo} dark={dark} className="w-full block" />
        </div>
        <motion.div
          className="absolute -bottom-5 left-6 right-6 sm:left-auto sm:right-8 sm:w-64 p-4 rounded-3xl bg-white dark:bg-slate-900 ring-1 ring-slate-900/[0.06] dark:ring-white/[0.08] shadow-xl"
          initial={reduce ? false : { opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6, duration: 0.5, ease: EASE_OUT }}
        >
          <div className="text-sm text-slate-500 dark:text-slate-400">Já é seu</div>
          <div className="font-display text-4xl font-extrabold text-slate-900 dark:text-white tabular-nums">{Math.round(demo * 100)}%</div>
          <div className="mt-2 h-2 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
            <motion.div className="h-full rounded-full bg-gradient-to-r from-anil-500 to-sol-400" animate={{ width: `${demo * 100}%` }} transition={{ type: 'spring', stiffness: 40, damping: 14 }} />
          </div>
        </motion.div>
      </motion.div>
    </div>
  );
};
