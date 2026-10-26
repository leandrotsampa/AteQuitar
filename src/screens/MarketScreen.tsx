import React from 'react';
import { motion, useReducedMotion } from 'motion/react';
import { ArrowDownRight, ArrowUpRight, ExternalLink, Minus, RefreshCw } from 'lucide-react';
import type { ScreenProps } from './types';
import { PageHeader } from '../components/ui/PageHeader';
import { Sparkline } from '../components/charts/Sparkline';
import { HelpTip } from '../components/ui/HelpTip';
import { card, tile } from '../components/ui/card';
import { RATE_INFO, SGS, poupancaAnnual, projectedTr, type RateKey } from '../lib/rates';
import { formatBRL, formatPct, monthlyToAnnual } from '../lib/format';
import { EASE_OUT } from '../lib/motion';
import type { ChartTone } from '../components/charts/tones';

const ORDER: { key: RateKey; tone: ChartTone; digits: number }[] = [
  { key: 'selic', tone: 'anil', digits: 2 },
  { key: 'cdi', tone: 'sky', digits: 2 },
  { key: 'trMonth', tone: 'sol', digits: 4 },
  { key: 'ipca12', tone: 'rose', digits: 2 },
  { key: 'poupancaMonth', tone: 'menta', digits: 4 },
  { key: 'ipcaMonth', tone: 'rose', digits: 2 },
];

const dateLabel = (iso: string, monthly: boolean) => {
  const d = new Date(`${iso}T12:00:00`);
  return monthly
    ? d.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })
    : d.toLocaleDateString('pt-BR', { day: 'numeric', month: 'short' });
};

export const MarketScreen: React.FC<ScreenProps> = ({ model, data, refreshRates, ratesLoading }) => {
  const reduce = Boolean(useReducedMotion());
  const rates = data.rates;
  const { contract, summary } = model;
  const tr = rates.latest.trMonth.value;
  const trEffect = summary.currentBalance * (tr / 100);
  const trYear = monthlyToAnnual(projectedTr(rates));

  return (
    <div className="space-y-6 page-stagger">
      <PageHeader
        context="Entender"
        title="Taxas do mercado"
        description="Atualizadas direto do Banco Central sempre que você abre o app. Cada número vem com o que ele significa para o seu bolso."
        actions={
          <button
            type="button"
            onClick={refreshRates}
            className="inline-flex items-center gap-2 h-10 px-4 rounded-full bg-anil-600 hover:bg-anil-500 text-white text-sm font-semibold cursor-pointer"
          >
            <RefreshCw className={`w-4 h-4 ${ratesLoading ? 'animate-spin' : ''}`} /> Atualizar agora
          </button>
        }
      />

      {/* O que mexe com você este mês */}
      <section className="relative overflow-hidden rounded-[22px] p-6 lg:p-7 bg-gradient-to-br from-anil-800 via-anil-700 to-anil-600 text-white">
        <div className="absolute -right-16 -top-20 w-72 h-72 rounded-full bg-sol-400/20 blur-2xl" aria-hidden="true" />
        <h2 className="relative font-display text-xl font-bold">O que isso muda para você</h2>
        <div className="relative grid md:grid-cols-3 gap-4 mt-4">
          <div className="p-4 rounded-2xl bg-white/10">
            <div className="text-sm text-white/75">{contract.trIndexed ? 'A TR somou ao seu saldo este mês' : 'Seu contrato não tem TR'}</div>
            <div className="font-display text-2xl font-bold mt-1">{contract.trIndexed ? formatBRL(trEffect) : 'Taxa fixa'}</div>
            <div className="text-xs text-white/70 mt-1">
              {contract.trIndexed ? `${formatPct(tr, 4)} sobre ${formatBRL(summary.currentBalance)}` : 'Seu saldo só muda com juros e pagamentos'}
            </div>
          </div>
          <div className="p-4 rounded-2xl bg-white/10">
            <div className="text-sm text-white/75">Sua dívida custa</div>
            <div className="font-display text-2xl font-bold mt-1">
              {formatPct(((1 + contract.annualRate / 100) * (1 + (contract.trIndexed ? trYear : 0) / 100) - 1) * 100)} ao ano
            </div>
            <div className="text-xs text-white/70 mt-1">juros do contrato{contract.trIndexed ? ' + TR projetada' : ''}</div>
          </div>
          <div className="p-4 rounded-2xl bg-white/10">
            <div className="text-sm text-white/75">A poupança rende</div>
            <div className="font-display text-2xl font-bold mt-1">{formatPct(poupancaAnnual(rates))} ao ano</div>
            <div className="text-xs text-white/70 mt-1">
              {poupancaAnnual(rates) < contract.annualRate ? 'menos que sua dívida: amortizar ganha da poupança' : 'mais que sua dívida'}
            </div>
          </div>
        </div>
      </section>

      <section className="grid sm:grid-cols-2 xl:grid-cols-3 gap-4">
        {ORDER.map(({ key, tone, digits }, k) => {
          const info = RATE_INFO[key];
          const point = rates.latest[key];
          const hist = rates.history[key] ?? [];
          const first = hist[0]?.value;
          const trend = first === undefined ? 0 : point.value - first;
          const monthly = !(key === 'selic' || key === 'cdi' || key === 'poupancaMonth');
          const TrendIcon = Math.abs(trend) < 1e-6 ? Minus : trend > 0 ? ArrowUpRight : ArrowDownRight;
          return (
            <motion.div
              key={key}
              className={`${card} p-5 flex flex-col`}
              initial={reduce ? false : { opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 + k * 0.05, duration: 0.45, ease: EASE_OUT }}
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="flex items-center gap-1 font-display font-bold text-slate-900 dark:text-white">
                    {info.label}
                    <HelpTip help={{ title: info.label, body: info.explain }} />
                  </div>
                  <div className="text-xs text-slate-500 dark:text-slate-400">{info.short}</div>
                </div>
                <Sparkline values={hist.map((p) => p.value)} tone={tone} width={88} height={30} />
              </div>
              <div className="mt-4 flex items-baseline gap-2">
                <span className="font-display text-[2rem] leading-none font-extrabold text-slate-900 dark:text-white tabular-nums">
                  {point.value.toLocaleString('pt-BR', { minimumFractionDigits: digits, maximumFractionDigits: digits })}
                </span>
                <span className="text-sm text-slate-500 dark:text-slate-400">{info.unit}</span>
              </div>
              <div className="mt-auto pt-4 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
                <span>{dateLabel(point.date, monthly)}</span>
                {first !== undefined && (
                  <span
                    className={`inline-flex items-center gap-0.5 font-semibold ${
                      Math.abs(trend) < 1e-6 ? '' : trend > 0 ? 'text-rose-600 dark:text-rose-400' : 'text-emerald-600 dark:text-emerald-400'
                    }`}
                    title="Variação no período do gráfico"
                  >
                    <TrendIcon className="w-3.5 h-3.5" />
                    {Math.abs(trend) < 1e-6 ? 'estável' : `${trend > 0 ? '+' : '−'}${Math.abs(trend).toLocaleString('pt-BR', { maximumFractionDigits: digits })}`}
                  </span>
                )}
              </div>
            </motion.div>
          );
        })}
      </section>

      <section className={`${card} p-5 lg:p-6`}>
        <h2 className="text-lg font-bold text-slate-900 dark:text-white">De onde vêm os números</h2>
        <p className="text-sm text-slate-600 dark:text-slate-300 mt-1.5 leading-relaxed max-w-3xl">
          Todas as taxas vêm do Sistema Gerenciador de Séries Temporais (SGS) do Banco Central, uma fonte pública e gratuita. O app guarda a última consulta para funcionar sem
          internet.
        </p>
        <div className="flex flex-wrap gap-2 mt-4">
          {(Object.keys(SGS) as RateKey[]).map((k) => (
            <span key={k} className={`${tile} px-3 py-1.5 text-xs text-slate-600 dark:text-slate-300`}>
              {RATE_INFO[k].label}: série <span className="font-num font-semibold">{SGS[k]}</span>
            </span>
          ))}
        </div>
        <a
          href="https://www3.bcb.gov.br/sgspub/"
          target="_blank"
          rel="noreferrer"
          className="mt-4 inline-flex items-center gap-1.5 text-sm font-bold text-anil-700 dark:text-anil-300"
        >
          Abrir o SGS do Banco Central <ExternalLink className="w-3.5 h-3.5" />
        </a>
      </section>
    </div>
  );
};
