import React, { useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  BookOpen,
  Calculator,
  Gauge,
  Home,
  LineChart,
  ListOrdered,
  Moon,
  ChevronLeft,
  PiggyBank,
  Scale,
  Settings2,
  Sun,
  Database,
  Volume2,
  VolumeX,
} from 'lucide-react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { LiquidIndicator } from './ui/LiquidIndicator';
import { RailTooltip } from './ui/RailTooltip';
import { DURATION, EASE_OUT, instantIf } from '../lib/motion';
import { playSound } from '../hooks/useSound';
import { useUiPrefs } from '../hooks/useUiPrefs';
import type { ScreenId } from '../screens/types';

const WIDTH_EXPANDED = 272;
const WIDTH_COLLAPSED = 72;
const GUTTER = 12;
const widthSpring = { type: 'spring', stiffness: 400, damping: 40 } as const;

interface NavItem {
  id: ScreenId;
  label: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
}

const GROUPS: { title: string; items: NavItem[] }[] = [
  {
    title: 'Acompanhar',
    items: [
      { id: 'home', label: 'Minha casa', description: 'Onde estou e quanto falta', icon: Home },
      { id: 'history', label: 'Parcelas', description: 'Mês a mês e seus registros', icon: ListOrdered },
    ],
  },
  {
    title: 'Decidir',
    items: [
      { id: 'amortize', label: 'Amortizar', description: 'Quanto economizo pagando a mais', icon: Calculator },
      { id: 'invest', label: 'Amortizar ou investir?', description: 'O que rende mais para você', icon: PiggyBank },
      { id: 'systems', label: 'SAC ou Price', description: 'Compare os dois sistemas', icon: Scale },
      { id: 'rate', label: 'Minha taxa é justa?', description: 'Sua taxa contra o mercado', icon: Gauge },
    ],
  },
  {
    title: 'Entender',
    items: [
      { id: 'market', label: 'Taxas do mercado', description: 'TR, Selic, IPCA ao vivo', icon: LineChart },
      { id: 'learn', label: 'Aprender', description: 'Dicas em linguagem simples', icon: BookOpen },
    ],
  },
];

const Reveal: React.FC<{ show: boolean; children: React.ReactNode; className?: string }> = ({ show, children, className }) =>
  show ? (
    <motion.div className={className} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: DURATION.micro, delay: 0.06 }}>
      {children}
    </motion.div>
  ) : null;

export const Sidebar: React.FC<{
  active: ScreenId;
  onSelect: (id: ScreenId) => void;
  nickname: string;
  progress: number;
  theme: 'dark' | 'light';
  toggleTheme: (origin?: HTMLElement | null) => void;
  onOpenContract: () => void;
  onOpenData: () => void;
}> = ({ active, onSelect, nickname, progress, theme, toggleTheme, onOpenContract, onOpenData }) => {
  const [prefs, setPrefs] = useUiPrefs();
  const expanded = prefs.sidebar !== 'collapsed';
  const collapsed = !expanded;
  const reduce = Boolean(useReducedMotion());
  // Dica do botão de recolher: mouse em cima ou foco pelo teclado; some no clique e só volta
  // depois que o mouse sai e entra de novo
  const [tipHover, setTipHover] = useState(false);
  const [tipFocus, setTipFocus] = useState(false);
  const [tipHidden, setTipHidden] = useState(false);
  const showTip = (tipHover || tipFocus) && !tipHidden;
  const navRef = useRef<HTMLElement>(null);
  const pct = Math.round(progress * 100);

  const footerBtn = `w-full flex items-center rounded-xl text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer text-[13px] ${
    collapsed ? 'justify-center h-10' : 'justify-between px-3 py-2'
  }`;

  return (
    <motion.div
      className="shrink-0 h-screen sticky top-0 z-40"
      initial={false}
      animate={{ width: (expanded ? WIDTH_EXPANDED : WIDTH_COLLAPSED) + GUTTER }}
      transition={instantIf(reduce, widthSpring)}
    >
      {/* Recolher/expandir: botão redondo em anil apoiado na borda do menu, na altura do logo.
          O anel da cor do fundo "encaixa" o botão na borda; a seta gira e a dica aparece ao lado.
          Vai por portal para o fim da página: fica em cima das áreas de arrastar a janela (cabeçalho
          do menu e barra superior), que vêm depois no DOM e, no Windows, engoliriam o clique */}
      {createPortal(
      <motion.div
        className={`app-no-drag group fixed z-[45] ${window.electronAPI?.platform === 'darwin' ? 'top-[66px]' : 'top-[30px]'}`}
        initial={false}
        // Recolhido, sai um pouco mais para fora para não encostar no anel do logo
        animate={{ left: 12 + (expanded ? WIDTH_EXPANDED - 16 : WIDTH_COLLAPSED - 9) }}
        transition={instantIf(reduce, widthSpring)}
      >
        <motion.button
          type="button"
          onClick={() => {
            playSound('tick');
            setTipHidden(true);
            setPrefs({ sidebar: expanded ? 'collapsed' : 'expanded' });
          }}
          onMouseEnter={() => setTipHover(true)}
          onMouseLeave={() => {
            setTipHover(false);
            setTipHidden(false);
          }}
          onFocus={(e) => setTipFocus(e.currentTarget.matches(':focus-visible'))}
          onBlur={() => {
            setTipFocus(false);
            setTipHidden(false);
          }}
          aria-label={expanded ? 'Recolher menu' : 'Expandir menu'}
          aria-expanded={expanded}
          whileHover={reduce ? undefined : { scale: 1.1 }}
          whileTap={reduce ? undefined : { scale: 0.9 }}
          transition={{ type: 'spring', stiffness: 500, damping: 22 }}
          className="relative w-8 h-8 rounded-full flex items-center justify-center text-white bg-gradient-to-br from-anil-500 to-anil-700 dark:from-anil-400 dark:to-anil-600 shadow-[0_0_0_4px_var(--canvas),0_8px_18px_-6px_rgba(77,72,228,0.75)] group-hover:shadow-[0_0_0_4px_var(--canvas),0_0_0_7px_rgba(255,181,36,0.55),0_10px_22px_-6px_rgba(77,72,228,0.85)] transition-shadow duration-[var(--duration-base)] cursor-pointer"
        >
          <motion.span
            className="flex"
            initial={false}
            animate={{ rotate: expanded ? 0 : 180 }}
            transition={instantIf(reduce, { type: 'spring', stiffness: 380, damping: 24 } as const)}
          >
            <ChevronLeft className="w-[18px] h-[18px]" strokeWidth={2.75} />
          </motion.span>
        </motion.button>
        <span
          role="tooltip"
          className={`pointer-events-none absolute left-full top-1/2 ml-3 -translate-y-1/2 transition-[opacity,translate] duration-[var(--duration-micro)] whitespace-nowrap ${
            showTip ? 'opacity-100 translate-x-0' : 'opacity-0 -translate-x-1'
          } flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900 text-xs font-semibold shadow-lg`}
        >
          {expanded ? 'Recolher menu' : 'Expandir menu'}
          <kbd className="px-1.5 py-0.5 rounded-md bg-white/15 dark:bg-slate-900/10 font-num text-[10px]">Ctrl B</kbd>
        </span>
      </motion.div>,
      document.body
      )}

      <motion.aside
        className="absolute top-3 bottom-3 left-3 rounded-[26px] bg-white dark:bg-slate-900 ring-1 ring-slate-900/[0.05] dark:ring-white/[0.07] shadow-[0_1px_2px_rgba(30,34,80,0.05),0_20px_44px_-22px_rgba(45,40,140,0.35)] dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.05),0_24px_48px_-24px_rgba(0,0,0,0.9)] flex flex-col select-none overflow-hidden"
        initial={false}
        animate={{ width: expanded ? WIDTH_EXPANDED : WIDTH_COLLAPSED }}
        transition={instantIf(reduce, widthSpring)}
      >
        {/* Marca + anel de progresso da casa */}
        <div className={`app-drag ${collapsed ? 'px-2 py-3' : 'p-4'} ${window.electronAPI?.platform === 'darwin' ? 'pt-9' : ''}`}>
          <div className={`flex items-center ${collapsed ? 'flex-col gap-2' : 'gap-3'}`}>
            <RailTooltip enabled={collapsed} label={`${pct}% quitado`} detail={nickname}>
              <div className="relative w-11 h-11 shrink-0">
                <svg viewBox="0 0 44 44" className="absolute inset-0 -rotate-90" aria-hidden="true">
                  <circle cx="22" cy="22" r="19" fill="none" strokeWidth="4" className="stroke-anil-100 dark:stroke-slate-800" />
                  <motion.circle
                    cx="22"
                    cy="22"
                    r="19"
                    fill="none"
                    strokeWidth="4"
                    strokeLinecap="round"
                    className="stroke-sol-400"
                    initial={reduce ? false : { pathLength: 0 }}
                    animate={{ pathLength: Math.max(0.001, progress) }}
                    transition={instantIf(reduce, { duration: 1.2, ease: EASE_OUT, delay: 0.3 })}
                  />
                </svg>
                <img src="./icon.png" alt="" className="absolute inset-[7px] w-[30px] h-[30px] rounded-lg" draggable={false} />
              </div>
            </RailTooltip>
            <Reveal show={expanded} className="min-w-0 flex-1">
              <div className="font-display font-extrabold text-[17px] leading-tight text-slate-900 dark:text-white tracking-tight">
                Até Quitar
              </div>
              <div className="text-xs text-slate-500 dark:text-slate-400 truncate">
                <span className="text-sol-600 dark:text-sol-300 font-bold font-num">{pct}%</span> da dívida quitada
              </div>
            </Reveal>
          </div>
        </div>

        <nav ref={navRef} className={`relative flex-1 min-h-0 overflow-y-auto overflow-x-hidden ${collapsed ? 'px-2' : 'px-3'} pb-3`}>
          <LiquidIndicator
            containerRef={navRef}
            axis="y"
            activeKey={active}
            layoutKey={prefs.sidebar}
            className={`rounded-2xl ${
              collapsed
                ? 'bg-anil-600 shadow-[0_8px_18px_-6px_rgba(77,72,228,0.7)]'
                : 'bg-anil-50 ring-1 ring-inset ring-anil-200 dark:bg-anil-500/15 dark:ring-anil-500/30'
            }`}
          />
          {GROUPS.map((g) => (
            <div key={g.title} className="mt-3 first:mt-1">
              {expanded ? (
                <Reveal show className="px-3 pb-1.5 text-xs font-semibold text-slate-400 dark:text-slate-500">
                  {g.title}
                </Reveal>
              ) : (
                <div className="mx-3 mb-2 h-px bg-slate-900/[0.06] dark:bg-white/[0.06]" />
              )}
              <div className="space-y-0.5">
                {g.items.map((item) => {
                  const Icon = item.icon;
                  const isActive = active === item.id;
                  return (
                    <RailTooltip key={item.id} enabled={collapsed} label={item.label} detail={item.description}>
                      <button
                        onClick={() => {
                          if (!isActive) playSound('tick');
                          onSelect(item.id);
                        }}
                        aria-current={isActive ? 'page' : undefined}
                        aria-label={collapsed ? item.label : undefined}
                        data-liquid-active={isActive}
                        className={`group relative w-full flex items-center gap-3 rounded-2xl text-left transition-colors cursor-pointer ${
                          collapsed ? 'justify-center p-1.5' : 'px-2.5 py-2'
                        } ${isActive ? 'text-anil-900 dark:text-anil-100' : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100/80 dark:hover:bg-slate-800/60'}`}
                      >
                        <span
                          className={`relative shrink-0 flex items-center justify-center rounded-xl transition-[color,background-color,transform] duration-[var(--duration-base)] ${
                            collapsed ? 'w-10 h-10' : 'w-8 h-8'
                          } ${
                            isActive
                              ? collapsed
                                ? 'text-white'
                                : 'bg-anil-600 text-white shadow-[0_6px_14px_-6px_rgba(77,72,228,0.8)]'
                              : collapsed
                                ? 'text-slate-500 dark:text-slate-400 group-hover:text-slate-900 dark:group-hover:text-white'
                                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 group-hover:scale-105'
                          }`}
                        >
                          <Icon className="w-[18px] h-[18px]" />
                        </span>
                        <Reveal show={expanded} className="relative min-w-0">
                          <div className={`text-[13px] truncate ${isActive ? 'font-bold' : 'font-semibold'}`}>{item.label}</div>
                          <div className="text-xs text-slate-500 dark:text-slate-400 truncate">{item.description}</div>
                        </Reveal>
                      </button>
                    </RailTooltip>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        <div className={`border-t border-slate-900/[0.06] dark:border-white/[0.06] space-y-0.5 ${collapsed ? 'p-2' : 'p-3'}`}>
          <RailTooltip enabled={collapsed} label="Meu financiamento" detail="Editar os dados do contrato">
            <button onClick={onOpenContract} className={footerBtn} aria-label={collapsed ? 'Meu financiamento' : undefined}>
              <span className="flex items-center gap-2.5">
                <Settings2 className="w-4 h-4 text-anil-600 dark:text-anil-300" />
                {expanded && <span className="whitespace-nowrap font-semibold">Meu financiamento</span>}
              </span>
            </button>
          </RailTooltip>
          <RailTooltip enabled={collapsed} label="Tema" detail={theme === 'dark' ? 'Noite (clique para dia)' : 'Dia (clique para noite)'}>
            <button
              onClick={(e) => toggleTheme(e.currentTarget)}
              className={footerBtn}
              aria-label={`Tema ${theme === 'dark' ? 'escuro' : 'claro'}. Trocar`}
            >
              <span className="flex items-center gap-2.5">
                <span className="relative w-4 h-4">
                  <AnimatePresence initial={false}>
                    <motion.span
                      key={theme}
                      className="absolute inset-0 flex items-center justify-center"
                      initial={{ rotate: -90, scale: 0.4, opacity: 0 }}
                      animate={{ rotate: 0, scale: 1, opacity: 1 }}
                      exit={{ rotate: 90, scale: 0.4, opacity: 0 }}
                      transition={{ type: 'spring', stiffness: 420, damping: 24 }}
                    >
                      {theme === 'dark' ? <Moon className="w-4 h-4 text-anil-300" /> : <Sun className="w-4 h-4 text-sol-500" />}
                    </motion.span>
                  </AnimatePresence>
                </span>
                {expanded && <span className="whitespace-nowrap">Tema</span>}
              </span>
              {expanded && <span className="text-xs text-slate-500 dark:text-slate-400">{theme === 'dark' ? 'Noite' : 'Dia'}</span>}
            </button>
          </RailTooltip>
          <RailTooltip enabled={collapsed} label="Sons" detail={prefs.soundEnabled ? 'Ligados' : 'Desligados'}>
            <button
              onClick={() => {
                setPrefs({ soundEnabled: !prefs.soundEnabled });
                if (!prefs.soundEnabled) window.setTimeout(() => playSound('success'), 30);
              }}
              className={footerBtn}
              aria-label={`Sons ${prefs.soundEnabled ? 'ligados' : 'desligados'}`}
              role="switch"
              aria-checked={prefs.soundEnabled}
            >
              <span className="flex items-center gap-2.5">
                {prefs.soundEnabled ? <Volume2 className="w-4 h-4 text-slate-500" /> : <VolumeX className="w-4 h-4 text-slate-400" />}
                {expanded && <span>Sons</span>}
              </span>
              {expanded && (
                <span className={`relative w-8 h-[18px] rounded-full transition-colors ${prefs.soundEnabled ? 'bg-anil-500' : 'bg-slate-300 dark:bg-slate-700'}`}>
                  <motion.span
                    className="absolute top-[2px] w-[14px] h-[14px] rounded-full bg-white shadow"
                    animate={{ left: prefs.soundEnabled ? 16 : 2 }}
                    transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                  />
                </span>
              )}
            </button>
          </RailTooltip>
          <RailTooltip enabled={collapsed} label="Dados e backup" detail="Onde ficam e cópia de segurança">
            <button onClick={onOpenData} className={footerBtn} aria-label={collapsed ? 'Dados e backup' : undefined}>
              <span className="flex items-center gap-2.5">
                <Database className="w-4 h-4 text-slate-500" />
                {expanded && <span className="whitespace-nowrap">Dados e backup</span>}
              </span>
              {expanded && <span className="text-xs text-slate-400 font-num">v{__APP_VERSION__}</span>}
            </button>
          </RailTooltip>
        </div>
      </motion.aside>
    </motion.div>
  );
};
