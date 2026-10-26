import React, { useEffect, useState } from 'react';
import { BadgeCheck, CircleDashed, Copy, Minus, RefreshCw, Square, X } from 'lucide-react';
import { motion } from 'motion/react';

const WEEKDAYS = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'];
const MONTHS = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
export const greeting = (hour: number) => (hour < 12 ? 'Bom dia' : hour < 18 ? 'Boa tarde' : 'Boa noite');

const pill =
  'h-9 rounded-full bg-white/80 dark:bg-slate-900/80 backdrop-blur ring-1 ring-slate-900/[0.05] dark:ring-white/[0.07] shadow-[0_1px_2px_rgba(30,34,80,0.05),0_8px_20px_-12px_rgba(45,40,140,0.3)]';

const WindowControls: React.FC = () => {
  const api = window.electronAPI;
  const [maximized, setMaximized] = useState(false);
  useEffect(() => {
    api?.isWindowMaximized?.().then(setMaximized);
    return api?.onWindowMaximized?.(setMaximized);
  }, [api]);
  if (!api?.windowControl || api.platform === 'darwin') return null;
  const b = 'w-8 h-7 flex items-center justify-center rounded-full text-slate-600 dark:text-slate-300 transition-colors cursor-pointer';
  return (
    <div className={`${pill} flex items-center gap-0.5 px-1 shrink-0`} role="group" aria-label="Janela">
      <button type="button" onClick={() => api.windowControl?.('minimize')} className={`${b} hover:bg-slate-900/[0.06] dark:hover:bg-white/10`} title="Minimizar" aria-label="Minimizar">
        <Minus className="w-3.5 h-3.5" />
      </button>
      <button
        type="button"
        onClick={() => api.windowControl?.('toggle-maximize')}
        className={`${b} hover:bg-slate-900/[0.06] dark:hover:bg-white/10`}
        title={maximized ? 'Restaurar' : 'Maximizar'}
        aria-label={maximized ? 'Restaurar' : 'Maximizar'}
      >
        {maximized ? <Copy className="w-3 h-3 -scale-x-100" /> : <Square className="w-3 h-3" />}
      </button>
      <button type="button" onClick={() => api.windowControl?.('close')} className={`${b} hover:bg-rose-500 hover:text-white`} title="Fechar" aria-label="Fechar">
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  );
};

export const TopBar: React.FC<{
  title?: string;
  calibrated?: boolean;
  onCalibrate?: () => void;
  ratesUpdatedAt: string | null;
  ratesLoading: boolean;
  onRefreshRates: () => void;
  isDemo?: boolean;
  onLeaveDemo?: () => void;
  onEditContract?: () => void;
}> = ({ title, calibrated, onCalibrate, ratesUpdatedAt, ratesLoading, onRefreshRates, isDemo, onLeaveDemo, onEditContract }) => {
  const now = new Date();
  const updated = ratesUpdatedAt ? new Date(ratesUpdatedAt) : null;
  const updatedLabel = updated
    ? updated.toDateString() === now.toDateString()
      ? `hoje, ${updated.getHours()}h${String(updated.getMinutes()).padStart(2, '0')}`
      : `${updated.getDate()} de ${MONTHS[updated.getMonth()]}`
    : 'valores de referência';

  return (
    <header className="app-drag h-14 shrink-0 pl-4 sm:pl-6 pr-3 flex items-center justify-between gap-3 z-30">
      <div className="flex items-center gap-2 min-w-0">
        {title && (
          <div className={`${pill} flex items-center gap-1 pl-1 pr-1.5 min-w-0`}>
            <button
              type="button"
              onClick={onEditContract}
              title="Editar meu financiamento"
              className="min-w-0 h-7 px-2.5 rounded-full text-[13px] font-bold text-slate-900 dark:text-white truncate hover:bg-slate-900/[0.05] dark:hover:bg-white/10 transition-colors cursor-pointer"
            >
              {title}
            </button>
            {calibrated !== undefined && (
              <button
                type="button"
                onClick={onCalibrate}
                title={calibrated ? 'Projeção calibrada com o saldo real' : 'Informe o saldo do banco para os números ficarem exatos'}
                className={`shrink-0 whitespace-nowrap inline-flex items-center gap-1 h-6 px-2 rounded-full text-[11px] font-bold cursor-pointer transition-colors ${
                  calibrated
                    ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-300'
                    : 'bg-sol-100 text-sol-800 hover:bg-sol-200 dark:bg-sol-400/15 dark:text-sol-200'
                }`}
              >
                {calibrated ? <BadgeCheck className="w-3.5 h-3.5" /> : <CircleDashed className="w-3.5 h-3.5" />}
                {calibrated ? 'Saldo real' : 'Estimado'}
              </button>
            )}
          </div>
        )}
        {isDemo && (
          <div className={`${pill} shrink-0 flex items-center gap-2 pl-3.5 pr-1 text-[13px] whitespace-nowrap`}>
            <span className="font-semibold text-sol-700 dark:text-sol-300">Exemplo</span>
            <button type="button" onClick={onLeaveDemo} className="h-7 px-3 rounded-full bg-anil-600 hover:bg-anil-500 text-white text-xs font-bold cursor-pointer">
              Usar o meu
            </button>
          </div>
        )}
      </div>

      <div className="flex items-center gap-2 shrink-0">
        <button
          type="button"
          onClick={onRefreshRates}
          title="Atualizar as taxas do Banco Central"
          className={`${pill} hidden md:flex items-center gap-2 px-3.5 text-xs whitespace-nowrap cursor-pointer hover:bg-white dark:hover:bg-slate-900 transition-colors`}
        >
          <motion.span animate={ratesLoading ? { rotate: 360 } : { rotate: 0 }} transition={ratesLoading ? { repeat: Infinity, duration: 1, ease: 'linear' } : { duration: 0 }}>
            <RefreshCw className="w-3.5 h-3.5 text-anil-600 dark:text-anil-300" />
          </motion.span>
          <span className="text-slate-600 dark:text-slate-300">
            {ratesLoading ? 'Atualizando taxas…' : <>Taxas: {updatedLabel}</>}
          </span>
        </button>
        <div className={`${pill} hidden xl:flex items-center gap-2 px-3.5 text-xs whitespace-nowrap`}>
          <span className="font-semibold text-slate-800 dark:text-slate-100">{greeting(now.getHours())}</span>
          <span className="text-slate-500 dark:text-slate-400">
            {WEEKDAYS[now.getDay()]}, {now.getDate()} de {MONTHS[now.getMonth()]}
          </span>
        </div>
        <WindowControls />
      </div>
    </header>
  );
};
