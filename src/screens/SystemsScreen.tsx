import React, { useMemo, useState } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import { BadgeCheck, TrendingDown, Minus } from 'lucide-react';
import type { ScreenProps } from './types';
import { PageHeader } from '../components/ui/PageHeader';
import { SegmentedControl } from '../components/ui/SegmentedControl';
import { AreaChart } from '../components/charts/AreaChart';
import { AnimatedNumber } from '../components/ui/AnimatedNumber';
import { card, tile } from '../components/ui/card';
import { compareSystems } from '../lib/finance';
import { formatBRL, formatBRL0, formatBRLShort, monthLong } from '../lib/format';
import { EASE_OUT, instantIf } from '../lib/motion';

export const SystemsScreen: React.FC<ScreenProps> = ({ model }) => {
  const reduce = Boolean(useReducedMotion());
  const { contract } = model;
  const [view, setView] = useState<'payment' | 'balance'>('payment');
  const cmp = useMemo(() => compareSystems(contract, model.trFor), [contract, model.trFor]);
  const { sac, price } = cmp;
  const diff = price.totalInterest - sac.totalInterest;

  // Primeira parcela em que a Price fica mais cara que o SAC
  const crossover = sac.rows.findIndex((r, k) => price.rows[k] && price.rows[k].payment > r.payment);

  const chart = useMemo(() => {
    const n = Math.max(sac.rows.length, price.rows.length);
    const step = n > 120 ? 12 : 3;
    const idx: number[] = [];
    for (let k = 0; k < n; k += step) idx.push(k);
    const pick = (rows: typeof sac.rows, k: number) => (k < rows.length ? (view === 'payment' ? rows[k].payment : rows[k].closingBalance) : 0);
    return {
      labels: idx.map((k) => (sac.rows[k] ?? price.rows[k]).yearMonth.slice(0, 4)),
      sac: idx.map((k) => pick(sac.rows, k)),
      price: idx.map((k) => pick(price.rows, k)),
    };
  }, [sac, price, view]);

  const Col: React.FC<{ name: 'SAC' | 'PRICE'; t: typeof sac }> = ({ name, t }) => {
    const mine = contract.system === name;
    return (
      <div className={`${card} p-5 lg:p-6 relative ${mine ? 'ring-2 ring-anil-400 dark:ring-anil-500/60' : ''}`}>
        {mine && (
          <span className="absolute -top-3 left-5 inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-anil-600 text-white text-xs font-bold">
            <BadgeCheck className="w-3.5 h-3.5" /> O seu contrato
          </span>
        )}
        <div className="flex items-center gap-3">
          <span className={`w-11 h-11 rounded-2xl flex items-center justify-center ${name === 'SAC' ? 'bg-anil-100 text-anil-700 dark:bg-anil-500/15 dark:text-anil-300' : 'bg-sol-100 text-sol-700 dark:bg-sol-400/15 dark:text-sol-300'}`}>
            {name === 'SAC' ? <TrendingDown className="w-5 h-5" /> : <Minus className="w-5 h-5" />}
          </span>
          <div>
            <h2 className="font-display text-2xl font-bold text-slate-900 dark:text-white">{name === 'SAC' ? 'SAC' : 'Price'}</h2>
            <div className="text-sm text-slate-500 dark:text-slate-400">{name === 'SAC' ? 'Parcela começa alta e cai' : 'Parcela quase fixa'}</div>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2 mt-5">
          <div className={`${tile} p-3`}>
            <div className="text-xs text-slate-500">1ª parcela</div>
            <div className="font-num font-bold text-slate-900 dark:text-white">{formatBRL(t.firstPayment)}</div>
          </div>
          <div className={`${tile} p-3`}>
            <div className="text-xs text-slate-500">Última parcela</div>
            <div className="font-num font-bold text-slate-900 dark:text-white">{formatBRL(t.lastPayment)}</div>
          </div>
          <div className={`${tile} p-3`}>
            <div className="text-xs text-slate-500">Total de juros</div>
            <div className="font-num font-bold text-slate-900 dark:text-white">
              <AnimatedNumber value={t.totalInterest} format={formatBRL0} />
            </div>
          </div>
          <div className={`${tile} p-3`}>
            <div className="text-xs text-slate-500">Total pago</div>
            <div className="font-num font-bold text-slate-900 dark:text-white">
              <AnimatedNumber value={t.totalPaid} format={formatBRL0} />
            </div>
          </div>
        </div>
        <ul className="mt-4 space-y-1.5 text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
          {name === 'SAC' ? (
            <>
              <li>A dívida cai em ritmo constante desde o começo.</li>
              <li>Paga menos juros no total.</li>
              <li>Pede mais folga no orçamento nos primeiros anos.</li>
            </>
          ) : (
            <>
              <li>Parcela previsível, mais fácil de planejar.</li>
              <li>No começo, a maior parte da parcela é juros.</li>
              <li>Paga mais juros no total.</li>
            </>
          )}
        </ul>
      </div>
    );
  };

  const maxTotal = Math.max(sac.totalInterest, price.totalInterest);

  return (
    <div className="space-y-6 page-stagger">
      <PageHeader
        context="Decidir"
        title="SAC ou Price: qual compensa?"
        description={`Os dois sistemas com os mesmos dados do seu contrato: ${formatBRL0(contract.financedAmount)} em ${contract.termMonths} meses a ${contract.annualRate.toLocaleString('pt-BR')}% ao ano.`}
      />

      <section data-tour="sys-resumo" className={`${card} p-5 lg:p-6`}>
        <div className="grid md:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)] gap-6 items-center">
          <div>
            <div className="text-sm text-slate-500 dark:text-slate-400">No total, a Price custa</div>
            <AnimatedNumber value={Math.max(0, diff)} format={formatBRL} className="block font-display text-[2.6rem] leading-none font-extrabold text-slate-900 dark:text-white mt-1 tabular-nums" />
            <div className="text-[15px] text-slate-600 dark:text-slate-300 mt-2">a mais de juros que o SAC.</div>
            {crossover > 0 && (
              <div className="text-sm text-slate-500 dark:text-slate-400 mt-3 leading-relaxed">
                A parcela da Price começa menor, mas passa a ser maior que a do SAC a partir de <b className="text-slate-900 dark:text-white">{monthLong(sac.rows[crossover].yearMonth)}</b> (parcela {crossover + 1}).
              </div>
            )}
          </div>
          <div className="space-y-4">
            {[
              { name: 'SAC', v: sac.totalInterest, cls: 'bg-anil-500' },
              { name: 'Price', v: price.totalInterest, cls: 'bg-sol-400' },
            ].map((b, k) => (
              <div key={b.name}>
                <div className="flex justify-between text-sm mb-1.5">
                  <span className="font-semibold text-slate-900 dark:text-white">Juros no {b.name}</span>
                  <span className="font-num font-bold text-slate-900 dark:text-white">{formatBRL0(b.v)}</span>
                </div>
                <div className="h-5 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                  <motion.div
                    className={`h-full rounded-full ${b.cls}`}
                    initial={reduce ? false : { width: 0 }}
                    animate={{ width: `${(b.v / maxTotal) * 100}%` }}
                    transition={instantIf(reduce, { duration: 1, ease: EASE_OUT, delay: 0.2 + k * 0.15 })}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section data-tour="sys-cards" className="grid md:grid-cols-2 gap-4 pt-2">
        <Col name="SAC" t={sac} />
        <Col name="PRICE" t={price} />
      </section>

      <section className={`${card} p-5 lg:p-6`}>
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <div>
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">{view === 'payment' ? 'A parcela ao longo dos anos' : 'O saldo devedor ao longo dos anos'}</h2>
            <div className="flex items-center gap-4 text-xs text-slate-500 dark:text-slate-400 mt-1">
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-anil-500" /> SAC
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-sol-400" /> Price
              </span>
            </div>
          </div>
          <SegmentedControl
            ariaLabel="O que mostrar"
            layoutId="sys-view"
            value={view}
            onChange={setView}
            className="w-64"
            options={[
              { value: 'payment', label: 'Parcela' },
              { value: 'balance', label: 'Saldo' },
            ]}
          />
        </div>
        <AreaChart
          labels={chart.labels}
          series={[
            { key: 'sac', label: 'SAC', tone: 'anil', kind: view === 'balance' ? 'area' : 'line', axis: 'left', values: chart.sac },
            { key: 'price', label: 'Price', tone: 'sol', kind: 'line', axis: 'left', values: chart.price },
          ]}
          formatLeft={formatBRLShort}
          formatRight={formatBRLShort}
          height={270}
        />
      </section>

      <section className={`${card} p-5 lg:p-6`}>
        <h2 className="text-lg font-bold text-slate-900 dark:text-white">Dá para trocar de sistema?</h2>
        <p className="text-[15px] text-slate-600 dark:text-slate-300 mt-2 leading-relaxed max-w-3xl">
          Depois de assinado, o banco normalmente não troca o sistema do contrato. O caminho é a <b>portabilidade</b> para outro banco (que faz um contrato novo) ou
          amortizar com frequência: na Price, cada amortização extra corta justamente a parte de juros que pesa no começo.
        </p>
      </section>
    </div>
  );
};
