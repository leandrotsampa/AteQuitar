import React, { useMemo, useState } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import { CalendarMinus, Check, HandCoins, Info, Plus, TrendingDown, Trophy } from 'lucide-react';
import type { ScreenProps } from './types';
import { PageHeader } from '../components/ui/PageHeader';
import { SegmentedControl } from '../components/ui/SegmentedControl';
import { AnimatedNumber } from '../components/ui/AnimatedNumber';
import { AreaChart } from '../components/charts/AreaChart';
import { Field } from '../components/ui/HelpTip';
import { MoneyField, MonthField } from '../components/ui/Inputs';
import { btnPrimary, card, tile } from '../components/ui/card';
import { effectiveExtra, simulateExtra, type ExtraFrequency } from '../lib/finance';
import type { ExtraMode } from '../types/finance';
import {
  addMonths,
  currentYearMonth,
  formatBRL,
  formatBRL0,
  formatBRLShort,
  formatDuration,
  monthLong,
  monthShort,
  uid,
} from '../lib/format';
import { EASE_OUT } from '../lib/motion';
import { playSound } from '../hooks/useSound';
import { celebrate } from '../components/ui/Confetti';

const PRESETS = [1000, 5000, 10000, 30000];

export const AmortizeScreen: React.FC<ScreenProps> = ({ model, data, update }) => {
  const reduce = Boolean(useReducedMotion());
  const { contract, summary } = model;
  const now = currentYearMonth();
  const [amount, setAmount] = useState(5000);
  const [frequency, setFrequency] = useState<ExtraFrequency>('once');
  const [mode, setMode] = useState<ExtraMode>('prazo');
  const [startYm, setStartYm] = useState(summary.next?.yearMonth ?? addMonths(now, 1));
  const extraMonths = useMemo(() => new Set((model.options.extras ?? []).map((e) => e.yearMonth)), [model.options.extras]);

  const maxSlider = Math.max(10000, Math.min(summary.currentBalance, frequency === 'monthly' ? 10000 : frequency === 'yearly' ? 60000 : 200000));

  const canRegister = frequency === 'once' && startYm <= now && amount > 0;
  // A mesma amortização (mês, valor e tipo) já registrada: não deixa lançar de novo, só desfazer
  const registered =
    frequency === 'once' ? data.extras.find((e) => e.yearMonth === startYm && Math.abs((e.paid ?? e.amount) - amount) < 0.005 && e.mode === mode) : undefined;
  // Pagando hoje, o banco desconta os juros desde o último vencimento: só o resto abate o saldo
  const today = new Date().toLocaleDateString('sv-SE');
  const payingNow = frequency === 'once' && startYm === now;
  const effectiveNow = payingNow ? effectiveExtra(contract, amount, today) : amount;
  // Depois de registrar, a simulação continua mostrando quanto essa amortização economiza
  // (sem descontar, ela já estaria nos dados e a economia apareceria zerada)
  const simOptions = useMemo(
    () => (registered ? { ...model.options, extras: (model.options.extras ?? []).filter((e) => e.id !== registered.id) } : model.options),
    [model.options, registered]
  );
  const sim = useMemo(
    () => simulateExtra(contract, simOptions, { amount, startYm, frequency, mode }),
    [contract, simOptions, amount, startYm, frequency, mode]
  );
  const other = useMemo(
    () => simulateExtra(contract, simOptions, { amount, startYm, frequency, mode: mode === 'prazo' ? 'parcela' : 'prazo' }),
    [contract, simOptions, amount, startYm, frequency, mode]
  );
  const byMode = mode === 'prazo' ? { prazo: sim, parcela: other } : { prazo: other, parcela: sim };
  const best = byMode.prazo.interestSaved >= byMode.parcela.interestSaved ? 'prazo' : 'parcela';
  const perReal = sim.totalExtra > 0 ? sim.interestSaved / sim.totalExtra : 0;

  const chart = useMemo(() => {
    const longest = sim.base.length;
    const step = longest > 120 ? 12 : 3;
    const start = Math.max(0, summary.paidCount - 1);
    const idx: number[] = [];
    for (let k = start; k < longest; k += step) idx.push(k);
    if (idx[idx.length - 1] !== longest - 1) idx.push(longest - 1);
    const at = (rows: typeof sim.base, k: number) => (k < rows.length ? rows[k].closingBalance : 0);
    return {
      labels: idx.map((k) => sim.base[k].yearMonth),
      base: idx.map((k) => at(sim.base, k)),
      simulated: idx.map((k) => at(sim.simulated, k)),
      step,
    };
  }, [sim, summary.paidCount]);

  const register = () => {
    if (registered) return;
    const paidNow = payingNow ? { paid: amount, date: today } : {};
    update((prev) => ({
      ...prev,
      extras: [...prev.extras, { id: uid(), yearMonth: startYm, amount: effectiveNow, ...paidNow, mode, source: 'proprio', createdAt: new Date().toISOString() }],
    }));
    playSound('celebrate');
    celebrate();
  };
  const undoRegister = () => {
    if (!registered) return;
    update((prev) => ({
      ...prev,
      extras: prev.extras.filter((e) => e.id !== registered.id),
      checkins: prev.checkins.map((c) => (c.extraId === registered.id ? { ...c, extraId: undefined } : c)),
    }));
    playSound('delete');
  };

  return (
    <div className="space-y-6 page-stagger">
      <PageHeader
        context="Decidir"
        title="Quanto você economiza pagando a mais"
        description="Toda amortização vai direto para a dívida, sem juros. Mexa nos valores e veja na hora quanto de juros deixa de existir."
      />

      <section className="grid lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)] gap-4">
        {/* Controles */}
        <div data-tour="amo-valor" className={`${card} p-5 lg:p-6 space-y-6`}>
          <Field label="Quanto você quer amortizar?">
            <MoneyField value={amount} onChange={setAmount} size="lg" />
            <input
              type="range"
              className="range w-full mt-4"
              min={0}
              max={maxSlider}
              step={maxSlider > 50000 ? 1000 : 100}
              value={Math.min(amount, maxSlider)}
              style={{ ['--fill' as string]: `${(Math.min(amount, maxSlider) / maxSlider) * 100}%` }}
              onChange={(e) => setAmount(Number(e.target.value))}
              aria-label="Valor da amortização"
            />
            <div className="flex flex-wrap gap-2 mt-3">
              {PRESETS.map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => {
                    playSound('tick');
                    setAmount(p);
                  }}
                  className={`h-8 px-3 rounded-full text-xs font-bold cursor-pointer transition-colors ${
                    amount === p ? 'bg-anil-600 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-200'
                  }`}
                >
                  {formatBRL0(p)}
                </button>
              ))}
            </div>
          </Field>

          <Field label="Com que frequência?">
            <SegmentedControl
              ariaLabel="Frequência"
              layoutId="freq"
              value={frequency}
              onChange={setFrequency}
              options={[
                { value: 'once', label: 'Uma vez' },
                { value: 'monthly', label: 'Todo mês' },
                { value: 'yearly', label: 'Todo ano' },
              ]}
            />
          </Field>

          <Field
            label="O que reduzir?"
            help={{
              title: 'Reduzir prazo ou parcela',
              body: 'Prazo: a parcela continua igual e o financiamento acaba antes (economiza mais). Parcela: o fim continua o mesmo e a parcela diminui (alivia o orçamento).',
            }}
          >
            <SegmentedControl
              ariaLabel="Reduzir prazo ou parcela"
              layoutId="mode"
              value={mode}
              onChange={setMode}
              options={[
                { value: 'prazo', label: 'Reduzir prazo' },
                { value: 'parcela', label: 'Reduzir parcela' },
              ]}
            />
          </Field>

          <Field label={frequency === 'once' ? 'Em que mês?' : 'A partir de'}>
            <MonthField
              value={startYm}
              onChange={setStartYm}
              ariaLabel="Mês da amortização"
              min={contract.firstDueMonth}
              max={summary.endYearMonth}
              marked={extraMonths}
              markedLabel="já amortizou"
            />
          </Field>
        </div>

        {/* Resultado */}
        <div className="space-y-4">
          <div data-tour="amo-resultado" className="relative overflow-hidden rounded-[22px] p-6 lg:p-7 bg-gradient-to-br from-emerald-600 to-emerald-500 dark:from-emerald-700 dark:to-emerald-600 text-white shadow-[0_24px_50px_-24px_rgba(5,150,105,0.8)]">
            <div className="absolute -right-12 -bottom-16 w-64 h-64 rounded-full bg-white/10" aria-hidden="true" />
            <div className="relative flex items-center gap-2 text-sm font-semibold text-white/85">
              <TrendingDown className="w-4 h-4" /> Você deixa de pagar
            </div>
            <AnimatedNumber
              value={Math.max(0, sim.interestSaved)}
              format={formatBRL}
              className="relative block font-display text-[2.8rem] leading-none font-extrabold tracking-tight mt-2 tabular-nums"
            />
            <div className="relative text-sm text-white/85 mt-2">
              em juros e seguros
              {sim.totalExtra > 0 && <> amortizando {formatBRL0(sim.totalExtra)} no total</>}
            </div>
            {perReal > 0 && (
              <div className="relative mt-4 inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/15 text-sm font-semibold">
                <HandCoins className="w-4 h-4" /> Cada R$ 1 amortizado evita R$ {perReal.toLocaleString('pt-BR', { maximumFractionDigits: 2 })} de custo
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className={`${card} p-5`}>
              <div className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
                <CalendarMinus className="w-4 h-4 text-anil-500" /> Fim do financiamento
              </div>
              <div className="font-display text-xl font-bold text-slate-900 dark:text-white mt-2">{monthLong(sim.newEndYm)}</div>
              <div className="text-sm mt-0.5 text-emerald-700 dark:text-emerald-400 font-semibold">
                {sim.monthsSaved > 0 ? `${formatDuration(sim.monthsSaved)} antes` : 'mesma data'}
              </div>
            </div>
            <div className={`${card} p-5`}>
              <div className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
                <Info className="w-4 h-4 text-anil-500" /> Parcela seguinte
              </div>
              <div className="font-display text-xl font-bold text-slate-900 dark:text-white mt-2 tabular-nums">
                <AnimatedNumber value={sim.paymentAfter} format={formatBRL} />
              </div>
              <div className="text-sm mt-0.5 text-slate-500 dark:text-slate-400">
                {Math.abs(sim.paymentBefore - sim.paymentAfter) > 1 ? `era ${formatBRL(sim.paymentBefore)}` : 'praticamente igual'}
              </div>
            </div>
          </div>

          {/* Prazo × parcela lado a lado */}
          <div data-tour="amo-comparar" className={`${card} p-5`}>
            <div className="text-sm font-semibold text-slate-900 dark:text-white mb-3">E se escolhesse a outra opção?</div>
            <div className="grid grid-cols-2 gap-3">
              {(['prazo', 'parcela'] as const).map((m) => {
                const r = byMode[m];
                const isBest = best === m && Math.abs(byMode.prazo.interestSaved - byMode.parcela.interestSaved) > 1;
                return (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setMode(m)}
                    className={`relative text-left p-4 rounded-2xl cursor-pointer transition-colors ${
                      mode === m ? 'bg-anil-50 ring-2 ring-anil-400 dark:bg-anil-500/10' : `${tile} hover:ring-anil-200`
                    }`}
                  >
                    {isBest && (
                      <span className="absolute -top-2.5 right-3 inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-sol-400 text-slate-900 text-[11px] font-bold">
                        <Trophy className="w-3 h-3" /> economiza mais
                      </span>
                    )}
                    <div className="text-xs text-slate-500 dark:text-slate-400">{m === 'prazo' ? 'Reduzindo o prazo' : 'Reduzindo a parcela'}</div>
                    <div className="font-num font-bold text-lg text-slate-900 dark:text-white mt-1">{formatBRL0(Math.max(0, r.interestSaved))}</div>
                    <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                      {m === 'prazo' ? `${r.monthsSaved} meses a menos` : `parcela ${formatBRL0(r.paymentBefore - r.paymentAfter)} menor`}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </section>

      <section className={`${card} p-5 lg:p-6`}>
        <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
          <div>
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">O saldo com e sem a amortização</h2>
            <p className="text-sm text-slate-500 dark:text-slate-400">A distância entre as linhas é dívida que some antes</p>
          </div>
          <div className="flex items-center gap-4 text-xs text-slate-500 dark:text-slate-400">
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" /> Com amortização
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-slate-400" /> Sem
            </span>
          </div>
        </div>
        <AreaChart
          labels={chart.labels.map((ym) => (chart.step >= 12 ? ym.slice(0, 4) : monthShort(ym)))}
          series={[
            { key: 'sim', label: 'Com amortização', tone: 'menta', kind: 'area', axis: 'left', values: chart.simulated },
            { key: 'base', label: 'Sem', tone: 'slate', kind: 'line', axis: 'left', values: chart.base },
          ]}
          formatLeft={formatBRLShort}
          formatRight={formatBRLShort}
          height={260}
        />
      </section>

      <section className="grid md:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)] gap-4">
        <div className={`${card} p-5 lg:p-6`}>
          <h2 className="text-lg font-bold text-slate-900 dark:text-white">Antes de amortizar</h2>
          <ul className="mt-3 space-y-2.5 text-[15px] text-slate-600 dark:text-slate-300 leading-relaxed">
            {[
              <>Tenha uma reserva de emergência (uns 6 meses de gastos). Dinheiro amortizado não volta.</>,
              <>
                Peça ao banco para reduzir o <b className="text-slate-900 dark:text-white">prazo</b>, a não ser que precise de folga no orçamento.
              </>,
              <>Compare com investir: na tela "Amortizar ou investir?" usamos as taxas de hoje.</>,
              <>Amortizar não tem multa: é um direito seu pelo Código de Defesa do Consumidor.</>,
            ].map((text, k) => (
              <li key={k} className="flex gap-2.5">
                <Check className="w-5 h-5 text-emerald-500 shrink-0 mt-0.5" />
                {/* O texto fica num bloco só: dentro do flex, o negrito viraria uma coluna separada */}
                <span>{text}</span>
              </li>
            ))}
          </ul>
        </div>
        <div data-tour="amo-registrar" className={`${card} p-5 lg:p-6 flex flex-col`}>
          <h2 className="text-lg font-bold text-slate-900 dark:text-white">Já fez essa amortização?</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
            Registre para os números da sua casa refletirem o pagamento. Funciona para uma amortização única num mês que já chegou.
          </p>
          {payingNow && amount > effectiveNow + 0.005 && (
            <p className="text-sm text-slate-600 dark:text-slate-300 mt-2 leading-relaxed">
              Pagando hoje, cerca de <b className="font-num text-slate-900 dark:text-white">{formatBRL(effectiveNow)}</b> abatem o saldo: o banco desconta{' '}
              {formatBRL(amount - effectiveNow)} de juros desde o último vencimento. Se o comprovante mostrar outro valor, corrija em Parcelas → Registros.
            </p>
          )}
          <div className="mt-5 flex flex-wrap items-center gap-x-4 gap-y-2">
            <button type="button" onClick={register} disabled={!canRegister || Boolean(registered)} className={`${btnPrimary} whitespace-nowrap`}>
              {registered ? (
                <motion.span className="inline-flex items-center gap-2" initial={reduce ? false : { scale: 0.8 }} animate={{ scale: 1 }} transition={{ ease: EASE_OUT }}>
                  <Check className="w-4 h-4" /> Registrada em {monthShort(startYm)}
                </motion.span>
              ) : (
                <>
                  <Plus className="w-4 h-4" /> Registrar {formatBRL0(amount)}
                </>
              )}
            </button>
            {registered && (
              <button type="button" onClick={undoRegister} className="text-sm font-semibold text-slate-500 hover:text-rose-600 dark:text-slate-400 dark:hover:text-rose-400 cursor-pointer">
                Desfazer
              </button>
            )}
          </div>
        </div>
      </section>
    </div>
  );
};
