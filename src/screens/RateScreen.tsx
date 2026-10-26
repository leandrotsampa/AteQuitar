import React, { useMemo } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import { ArrowRightLeft, Info, RefreshCw } from 'lucide-react';
import type { ScreenProps } from './types';
import { PageHeader } from '../components/ui/PageHeader';
import { HelpTip } from '../components/ui/HelpTip';
import { card, tile } from '../components/ui/card';
import { interestWithRate } from '../lib/finance';
import { formatBRL0, formatPct } from '../lib/format';
import { EASE_OUT, instantIf } from '../lib/motion';

const MIN = 6;
const MAX = 18;
const pos = (v: number) => `${((Math.min(MAX, Math.max(MIN, v)) - MIN) / (MAX - MIN)) * 100}%`;

export const RateScreen: React.FC<ScreenProps> = ({ model, data, refreshRates, ratesLoading }) => {
  const reduce = Boolean(useReducedMotion());
  const { contract, summary } = model;
  const l = data.rates.latest;
  const mine = contract.annualRate;
  const refs = [
    { key: 'reg', label: 'Média SFH (reguladas)', value: l.mortgageRegulated.value, help: 'Contratos com recursos da poupança e do FGTS, com teto de juros (Caixa, Minha Casa Minha Vida).' },
    { key: 'all', label: 'Média geral', value: l.mortgageAll.value, help: 'Média de todos os financiamentos imobiliários contratados no mês.' },
    { key: 'mkt', label: 'Média de mercado', value: l.mortgageMarket.value, help: 'Contratos fora do SFH, com taxa livre (imóveis mais caros, bancos privados).' },
  ];
  const avg = l.mortgageAll.value;
  // Faixas dos rótulos: cada média vai para a primeira linha onde não encosta na anterior
  const lanes = (() => {
    const placed: { r: (typeof refs)[number]; lane: number; at: number }[] = [];
    for (const r of [...refs].sort((a, b) => a.value - b.value)) {
      const at = ((Math.min(MAX, Math.max(MIN, r.value)) - MIN) / (MAX - MIN)) * 100;
      let lane = 0;
      while (placed.some((p) => p.lane === lane && Math.abs(p.at - at) < 16)) lane++;
      placed.push({ r, lane, at });
    }
    return placed;
  })();
  const maxLane = Math.max(0, ...lanes.map((x) => x.lane));
  const gap = mine - avg;

  const verdict =
    mine <= l.mortgageRegulated.value + 0.3
      ? { title: 'Ótima taxa', text: 'Sua taxa está no nível das linhas mais baratas do país. Guarde esse contrato com carinho.', cls: 'text-emerald-600 dark:text-emerald-400' }
      : gap <= 0.5
        ? { title: 'Taxa na média', text: 'Sua taxa está perto da média dos contratos novos. Uma portabilidade dificilmente compensaria os custos.', cls: 'text-anil-600 dark:text-anil-300' }
        : gap <= 2
          ? { title: 'Acima da média', text: 'Você paga um pouco mais que a média. Vale pedir propostas de portabilidade a outros bancos e usar isso para negociar.', cls: 'text-sol-600 dark:text-sol-300' }
          : { title: 'Bem acima da média', text: 'Sua taxa está bem acima do que os bancos cobram hoje. Uma portabilidade pode economizar muito: simule em outros bancos.', cls: 'text-rose-600 dark:text-rose-400' };

  const impact = useMemo(() => {
    const months = summary.remainingCount;
    const own = interestWithRate(contract, summary.currentBalance, months, mine);
    const atAvg = interestWithRate(contract, summary.currentBalance, months, avg);
    return own - atAvg;
  }, [contract, summary.currentBalance, summary.remainingCount, mine, avg]);

  const refDate = l.mortgageAll.date;
  const refLabel = new Date(`${refDate}T12:00:00`).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });

  return (
    <div className="space-y-6 page-stagger">
      <PageHeader
        context="Decidir"
        title="Minha taxa é justa?"
        description="Sua taxa de juros comparada com as médias que o Banco Central publica todo mês para financiamento imobiliário."
        actions={
          <button
            type="button"
            onClick={refreshRates}
            className="inline-flex items-center gap-2 h-10 px-4 rounded-full bg-white dark:bg-slate-900 ring-1 ring-slate-900/[0.06] dark:ring-white/[0.08] text-sm font-semibold cursor-pointer"
          >
            <RefreshCw className={`w-4 h-4 ${ratesLoading ? 'animate-spin' : ''}`} /> Atualizar médias
          </button>
        }
      />

      <section data-tour="rate-termometro" className={`${card} p-6 lg:p-8`}>
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <div className="text-sm text-slate-500 dark:text-slate-400">Sua taxa</div>
            <div className="font-display text-[3rem] leading-none font-extrabold text-slate-900 dark:text-white tabular-nums">
              {formatPct(mine)} <span className="text-lg font-semibold text-slate-500">ao ano{contract.trIndexed ? ' + TR' : ''}</span>
            </div>
          </div>
          <div className="text-right">
            <div className={`font-display text-2xl font-bold ${verdict.cls}`}>{verdict.title}</div>
            <div className="text-sm text-slate-500 dark:text-slate-400">
              {gap >= 0 ? `${formatPct(gap)} acima` : `${formatPct(-gap)} abaixo`} da média geral
            </div>
          </div>
        </div>

        {/* Termômetro */}
        <div className="relative mt-14" style={{ marginBottom: 72 + maxLane * 40 }}>
          <div className="h-5 rounded-full bg-gradient-to-r from-emerald-400 via-sol-300 to-rose-500 opacity-90" />
          {/* Marcas das médias: rótulos próximos descem uma linha para não se sobrepor */}
          {lanes.map(({ r, lane }, k) => (
            <motion.div
              key={r.key}
              className="absolute top-0 -translate-x-1/2 flex flex-col items-center"
              style={{ left: pos(r.value), zIndex: 10 - lane }}
              initial={reduce ? false : { opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 + k * 0.1, duration: 0.4 }}
            >
              <span className="w-0.5 bg-slate-900/50 dark:bg-white/50 rounded-full" style={{ height: 28 + lane * 40 }} />
              <span className="text-xs font-semibold text-slate-600 dark:text-slate-300 whitespace-nowrap mt-1 text-center px-1.5 rounded-md bg-white dark:bg-slate-900">
                {r.label}
                <span className="block font-num text-slate-900 dark:text-white">{formatPct(r.value)}</span>
              </span>
            </motion.div>
          ))}
          {/* Pino da sua taxa: cai do alto com mola */}
          <motion.div
            className="absolute -top-12 -translate-x-1/2 flex flex-col items-center"
            style={{ left: pos(mine) }}
            initial={reduce ? false : { y: -40, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={instantIf(reduce, { type: 'spring', stiffness: 260, damping: 14, delay: 0.7 } as const)}
          >
            <span className="px-2.5 py-1 rounded-full bg-slate-900 text-white dark:bg-white dark:text-slate-900 text-xs font-bold whitespace-nowrap shadow-lg">
              Você
            </span>
            <span className="w-3 h-3 -mt-1.5 rotate-45 bg-slate-900 dark:bg-white" />
            <span className="w-6 h-6 mt-[11px] rounded-full bg-white border-[5px] border-slate-900 dark:border-white dark:bg-slate-900 shadow-lg" />
          </motion.div>
          <div className="absolute top-7 left-0 text-[11px] text-slate-400 font-num">{MIN}%</div>
          <div className="absolute top-7 right-0 text-[11px] text-slate-400 font-num">{MAX}%</div>
        </div>

        <p className="text-[15px] text-slate-600 dark:text-slate-300 leading-relaxed max-w-3xl">{verdict.text}</p>
      </section>

      <section data-tour="rate-impacto" className="grid md:grid-cols-3 gap-4">
        <div className={`${card} p-5`}>
          <div className="text-sm text-slate-500 dark:text-slate-400">
            {impact >= 0 ? 'Se sua taxa fosse a média, você pagaria' : 'Comparado com a média, você economiza'}
          </div>
          <div className={`font-display text-3xl font-extrabold mt-1 ${impact >= 0 ? 'text-sol-600 dark:text-sol-300' : 'text-emerald-600 dark:text-emerald-400'}`}>
            {formatBRL0(Math.abs(impact))}
          </div>
          <div className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            {impact >= 0 ? 'a menos de juros' : 'em juros'} até o fim, sobre o saldo de hoje.
          </div>
        </div>
        {refs
          .filter((r) => r.key !== 'all')
          .map((r) => (
          <div key={r.key} className={`${card} p-5`}>
            <div className="flex items-center gap-1 text-sm text-slate-500 dark:text-slate-400">
              {r.label}
              <HelpTip help={{ title: r.label, body: r.help }} />
            </div>
            <div className="font-display text-2xl font-bold text-slate-900 dark:text-white mt-1">{formatPct(r.value)}</div>
            <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">ao ano, contratos de {refLabel}</div>
          </div>
        ))}
      </section>

      <section className="grid md:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)] gap-4">
        <div data-tour="rate-portabilidade" className={`${card} p-5 lg:p-6`}>
          <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <ArrowRightLeft className="w-5 h-5 text-anil-500" /> Como fazer a portabilidade
          </h2>
          <ol className="mt-4 space-y-3">
            {[
              'Peça propostas a 2 ou 3 bancos informando o saldo devedor e o prazo que falta.',
              'Compare o CET das propostas, não só a taxa de juros.',
              'Leve a melhor proposta ao seu banco: ele pode cobrir a oferta para não perder você.',
              'Se aceitar a portabilidade, o banco novo quita o antigo. Não precisa ter o dinheiro.',
            ].map((t, k) => (
              <li key={t} className="flex gap-3 text-[15px] text-slate-600 dark:text-slate-300 leading-relaxed">
                <span className="w-7 h-7 shrink-0 rounded-full bg-anil-100 text-anil-700 dark:bg-anil-500/15 dark:text-anil-300 font-num font-bold text-sm flex items-center justify-center">
                  {k + 1}
                </span>
                {t}
              </li>
            ))}
          </ol>
        </div>
        <div className={`${card} p-5 lg:p-6`}>
          <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Info className="w-5 h-5 text-anil-500" /> Leia com calma
          </h2>
          <div className="mt-3 space-y-3 text-[15px] text-slate-600 dark:text-slate-300 leading-relaxed">
            <p>As médias são de contratos <b>novos</b> assinados em {refLabel}. Se você assinou quando os juros do país estavam diferentes, é normal estar acima ou abaixo.</p>
            {contract.cet > 0 ? (
              <div className={`${tile} p-3 text-sm`}>
                Seu CET é <b>{formatPct(contract.cet)}</b>, {formatPct(Math.max(0, contract.cet - mine))} acima da taxa de juros, por causa de seguros e tarifas.
              </div>
            ) : (
              <p className="text-sm">Dica: informe o CET do contrato em "Meu financiamento" para comparar o custo completo.</p>
            )}
          </div>
        </div>
      </section>
    </div>
  );
};
