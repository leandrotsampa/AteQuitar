import React, { useEffect, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { ArrowLeft, ArrowRight, CalendarDays, Check, HandCoins, Home, Percent, Sparkles, Target, X } from 'lucide-react';
import type { Contract, ScheduleCheckpoint } from '../types/finance';
import {
  addMonths,
  annualToMonthly,
  bankPreposition,
  currentYearMonth,
  effectiveToNominal,
  formatBRL,
  formatDuration,
  monthLong,
  monthlyToAnnual,
  nominalToEffective,
  withBank,
} from '../lib/format';
import { EASE_OUT, instantIf } from '../lib/motion';
import { playSound } from '../hooks/useSound';
import { Field } from './ui/HelpTip';
import { MoneyField, MonthField, NumberField } from './ui/Inputs';
import { btnGhost, btnPrimary, chip, inputBase } from './ui/card';
import { HouseHero } from './HouseHero';
import { StepTrack } from './ui/StepTrack';
import { HELP } from './help';
import { isTourRunning, runTour, screenStepIds } from '../tour/tour';
import { loadTourState, markSeen, saveTourState } from '../tour/tourState';

const BANKS = ['Caixa', 'Banco do Brasil', 'Itaú', 'Bradesco', 'Santander', 'Inter', 'Cooperativa'];

// A mesma taxa escrita de três jeitos: o app guarda sempre a efetiva ao ano e converte
type RateUnit = 'efetiva' | 'nominal' | 'mes';
const RATE_UNITS: { value: RateUnit; label: string; where: string }[] = [
  { value: 'efetiva', label: 'Efetiva ao ano', where: 'Como no contrato' },
  { value: 'nominal', label: 'Nominal ao ano', where: 'Como no app da Caixa' },
  { value: 'mes', label: 'Ao mês', where: 'Taxa mensal' },
];
const fmtRate = (n: number, digits: number) => n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: digits });

const blankContract = (): Contract => ({
  nickname: '',
  bank: '',
  propertyValue: 0,
  financedAmount: 0,
  annualRate: 0,
  cet: 0,
  termMonths: 360,
  system: 'SAC',
  firstDueMonth: addMonths(currentYearMonth(), -12),
  dueDay: 10,
  trIndexed: true,
});

export interface WizardResult {
  contract: Contract;
  // Saldo de hoje informado no último passo (opcional); 0 = não informado
  currentBalance: number;
  // Parcelas que faltam hoje, segundo o banco (opcional); 0 = não informado
  currentRemaining: number;
  // Havia saldo deste mês e a pessoa apagou o campo: remover
  balanceCleared: boolean;
}

const STEPS = [
  { title: 'O imóvel', hint: 'Para reconhecer o seu financiamento' },
  { title: 'O empréstimo', hint: 'Valor, prazo e sistema' },
  { title: 'Os juros', hint: 'Taxa do contrato e correção' },
  { title: 'As datas', hint: 'Quando tudo começou' },
  { title: 'Para ficar exato', hint: 'Opcional, mas recomendado' },
];

const SystemCard: React.FC<{
  value: 'SAC' | 'PRICE';
  selected: boolean;
  onSelect: () => void;
}> = ({ value, selected, onSelect }) => {
  // Mini gráfico das parcelas: caindo (SAC) ou retas (Price)
  const bars = value === 'SAC' ? [100, 88, 76, 64, 52, 40] : [70, 70, 70, 70, 70, 70];
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      className={`relative text-left p-4 rounded-2xl border-2 transition-colors cursor-pointer ${
        selected
          ? 'border-anil-500 bg-anil-50 dark:bg-anil-500/10'
          : 'border-slate-200 dark:border-slate-700 hover:border-anil-300 dark:hover:border-anil-500/50'
      }`}
    >
      {selected && (
        <motion.span
          layoutId="system-check"
          className="absolute top-3 right-3 w-6 h-6 rounded-full bg-anil-600 text-white flex items-center justify-center"
        >
          <Check className="w-3.5 h-3.5" />
        </motion.span>
      )}
      <div className="flex items-end gap-1 h-12 mb-3">
        {bars.map((h, k) => (
          <motion.span
            key={k}
            className={`w-3 rounded-t ${selected ? 'bg-anil-500' : 'bg-slate-300 dark:bg-slate-600'}`}
            initial={{ height: 0 }}
            animate={{ height: `${h}%` }}
            transition={{ delay: k * 0.05, duration: 0.4, ease: EASE_OUT }}
          />
        ))}
      </div>
      <div className="font-display font-bold text-lg text-slate-900 dark:text-white">{value === 'SAC' ? 'SAC' : 'Price'}</div>
      <div className="text-sm text-slate-600 dark:text-slate-400 leading-snug">
        {value === 'SAC' ? 'Parcela começa maior e cai todo mês' : 'Parcela quase igual do início ao fim'}
      </div>
    </button>
  );
};

export const ContractWizard: React.FC<{
  initial: Contract | null;
  // Editando: o último saldo real, mostrado como resumo (o saldo se informa em Registros)
  realBalance?: ScheduleCheckpoint | null;
  onOpenRecords?: () => void;
  onCancel?: () => void;
  onSave: (result: WizardResult) => void;
  dark: boolean;
}> = ({ initial, realBalance, onOpenRecords, onCancel, onSave, dark }) => {
  const reduce = Boolean(useReducedMotion());
  const [c, setC] = useState<Contract>(() => initial ?? blankContract());

  // Mini-tutorial na primeira vez que o cadastro abre (marca como visto sem contar como as
  // boas-vindas do app, que vêm depois do cadastro)
  useEffect(() => {
    const ids = screenStepIds('wizard').filter((id) => !loadTourState().seen.includes(id));
    if (ids.length === 0) return;
    const t = window.setTimeout(() => {
      if (isTourRunning()) return;
      void runTour({
        screen: 'wizard',
        ids,
        demo: false,
        reduceMotion: reduce,
        onDone: (shown) => saveTourState(markSeen(loadTourState(), shown)),
      });
    }, 900);
    return () => window.clearTimeout(t);
    // Só ao abrir o cadastro
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  // Saldo de hoje: só no primeiro cadastro
  const [balance, setBalance] = useState(0);
  const [remainingNow, setRemainingNow] = useState(0);
  const [step, setStep] = useState(0);
  const [dir, setDir] = useState(1);
  const [rateUnit, setRateUnit] = useState<RateUnit>(() => initial?.rateInput ?? 'efetiva');
  const [termUnit, setTermUnit] = useState<'meses' | 'anos'>('meses');
  const [tried, setTried] = useState(false);
  const set = <K extends keyof Contract>(k: K, v: Contract[K]) => setC((prev) => ({ ...prev, [k]: v }));

  const problems: string[][] = [
    [],
    [
      c.financedAmount > 0 ? '' : 'Informe o valor financiado.',
      c.termMonths >= 12 && c.termMonths <= 600 ? '' : 'O prazo deve ficar entre 12 e 600 meses.',
      c.propertyValue > 0 && c.financedAmount > c.propertyValue ? 'O valor financiado está maior que o valor do imóvel.' : '',
    ].filter(Boolean),
    [c.annualRate > 0 && c.annualRate < 40 ? '' : 'Informe a taxa de juros do contrato (ex.: 9,79% efetiva ou 9,3764% nominal ao ano).'].filter(Boolean),
    [c.dueDay >= 1 && c.dueDay <= 31 ? '' : 'O dia do vencimento vai de 1 a 31.'].filter(Boolean),
    [],
  ];
  const stepProblems = problems[step];

  const go = (delta: number) => {
    if (delta > 0 && stepProblems.length > 0) {
      setTried(true);
      playSound('warning');
      return;
    }
    setTried(false);
    playSound('tick');
    setDir(delta);
    setStep((s) => Math.min(STEPS.length - 1, Math.max(0, s + delta)));
  };

  const finish = () => {
    const firstError = problems.findIndex((p) => p.length > 0);
    if (firstError >= 0) {
      setDir(-1);
      setStep(firstError);
      setTried(true);
      playSound('warning');
      return;
    }
    onSave({
      contract: {
        ...c,
        nickname: c.nickname.trim() || 'Minha casa',
        bank: c.bank.trim(),
        rateInput: rateUnit,
      },
      currentBalance: initial ? 0 : balance,
      currentRemaining: initial ? 0 : Math.round(remainingNow),
      balanceCleared: false,
    });
  };

  const paidSoFar = Math.max(0, Math.min(c.termMonths, (() => {
    const [y, m] = c.firstDueMonth.split('-').map(Number);
    const now = new Date();
    return (now.getFullYear() - y) * 12 + (now.getMonth() + 1 - m) + (now.getDate() >= c.dueDay ? 1 : 0);
  })()));

  const previewProgress =
    balance > 0 && c.financedAmount > 0 ? 1 - balance / c.financedAmount : c.termMonths > 0 ? paidSoFar / c.termMonths / 1.6 : 0;

  return (
    <div className="grid lg:grid-cols-[minmax(0,1fr)_380px] gap-6 items-start">
      <div className="min-w-0">
        {/* Etapas: editando, todas já estão preenchidas; no primeiro cadastro, as anteriores */}
        <div data-tour="cad-passos" className="relative mb-7">
          <StepTrack
            ariaLabel="Etapas do cadastro"
            steps={STEPS.map((x) => x.title)}
            icons={[Home, HandCoins, Percent, CalendarDays, Target]}
            numbered
            current={step}
            done={(k) => Boolean(initial) || k < step}
            // Etapas já vistas (ou todas, editando) com dado obrigatório faltando
            invalid={(k) => (Boolean(initial) || k < step) && problems[k].length > 0}
            reachable={(k) => k < step || problems.slice(0, k).every((p) => p.length === 0)}
            onSelect={(k) => {
              setTried(false);
              setDir(k > step ? 1 : -1);
              setStep(k);
              playSound('tick');
            }}
          />
        </div>

        <div className="relative overflow-hidden min-h-[380px]">
          <AnimatePresence mode="popLayout" initial={false} custom={dir}>
            <motion.div
              key={step}
              custom={dir}
              initial={reduce ? false : { x: dir * 60, opacity: 0, filter: 'blur(4px)' }}
              animate={{ x: 0, opacity: 1, filter: 'blur(0px)', transitionEnd: { filter: 'none' } }}
              exit={reduce ? { opacity: 0 } : { x: dir * -60, opacity: 0, filter: 'blur(4px)' }}
              transition={{ duration: 0.38, ease: EASE_OUT }}
              className="w-full max-w-xl space-y-5"
            >
              <div>
                <h2 className="text-2xl font-bold text-slate-900 dark:text-white">{STEPS[step].title}</h2>
                <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">{STEPS[step].hint}</p>
              </div>

              {step === 0 && (
                <>
                  <Field label="Como quer chamar este imóvel?" htmlFor="f-nick" help={HELP.nickname} optional tourId="cad-ajuda">
                    <input
                      id="f-nick"
                      className={inputBase}
                      placeholder="Ex.: Apartamento"
                      value={c.nickname}
                      onChange={(e) => set('nickname', e.target.value)}
                      autoFocus
                    />
                  </Field>
                  <Field label="Banco" help={HELP.bank} optional>
                    <div className="flex flex-wrap gap-2">
                      {BANKS.map((b) => (
                        <button
                          key={b}
                          type="button"
                          onClick={() => setC((prev) => ({ ...prev, bank: b, bankPreposition: undefined }))}
                          aria-pressed={c.bank === b}
                          className={`h-9 px-4 text-sm ${chip(c.bank === b)}`}
                        >
                          {b}
                        </button>
                      ))}
                      <input
                        className="h-9 w-44 px-4 rounded-full text-sm bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:border-anil-500 focus:ring-2 focus:ring-anil-500/25"
                        placeholder="Outro banco"
                        value={BANKS.includes(c.bank) ? '' : c.bank}
                        // Nome novo: volta para a sugestão automática até a pessoa escolher de novo
                        onChange={(e) => setC((prev) => ({ ...prev, bank: e.target.value, bankPreposition: undefined }))}
                        aria-label="Outro banco"
                      />
                    </div>
                    {/* Banco digitado: a regra sugere "no" ou "na" e a pessoa corrige se precisar */}
                    <AnimatePresence initial={false}>
                      {c.bank.trim() && !BANKS.includes(c.bank) && (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                          exit={{ opacity: 0, height: 0 }}
                          className="overflow-hidden"
                        >
                          <div className="flex flex-wrap items-center gap-2 mt-3 text-sm text-slate-600 dark:text-slate-300">
                            <span>Vai aparecer:</span>
                            <span className="font-semibold text-slate-900 dark:text-white">
                              {c.nickname.trim() || 'Minha casa'} {withBank(c.bank, c.bankPreposition)}
                            </span>
                            <span className="flex rounded-full bg-slate-100 dark:bg-slate-800 p-0.5 ml-1" role="group" aria-label="Preposição antes do banco">
                              {(['no', 'na'] as const).map((p) => {
                                const active = (c.bankPreposition ?? bankPreposition(c.bank)) === p;
                                return (
                                  <button
                                    key={p}
                                    type="button"
                                    aria-pressed={active}
                                    onClick={() => set('bankPreposition', p)}
                                    className={`h-7 px-3 rounded-full text-xs font-bold cursor-pointer transition-colors ${
                                      active ? 'bg-white dark:bg-slate-950 text-slate-900 dark:text-white shadow-sm' : 'text-slate-500'
                                    }`}
                                  >
                                    {p}
                                  </button>
                                );
                              })}
                            </span>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </Field>
                  <Field label="Valor do imóvel" htmlFor="f-prop" help={HELP.propertyValue} optional hint="Usado para mostrar quanto da casa já é seu, contando a entrada.">
                    <MoneyField id="f-prop" value={c.propertyValue} onChange={(v) => set('propertyValue', v)} />
                  </Field>
                </>
              )}

              {step === 1 && (
                <>
                  <Field label="Valor financiado" htmlFor="f-fin" help={HELP.financedAmount}>
                    <MoneyField id="f-fin" value={c.financedAmount} onChange={(v) => set('financedAmount', v)} />
                  </Field>
                  {c.propertyValue > 0 && c.financedAmount > 0 && c.financedAmount < c.propertyValue && (
                    <div className="text-sm text-slate-600 dark:text-slate-400 -mt-2">
                      Entrada de <b className="text-slate-900 dark:text-white">{formatBRL(c.propertyValue - c.financedAmount)}</b> (
                      {Math.round((1 - c.financedAmount / c.propertyValue) * 100)}% do imóvel).
                    </div>
                  )}
                  <Field label="Prazo" help={HELP.termMonths} hint={c.termMonths > 0 ? formatDuration(c.termMonths) : undefined}>
                    <div className="flex gap-2 items-center">
                      <NumberField
                        value={termUnit === 'meses' ? c.termMonths : c.termMonths / 12}
                        onChange={(v) => set('termMonths', Math.round(termUnit === 'meses' ? v : v * 12))}
                        digits={0}
                        ariaLabel="Prazo"
                        className="flex-1"
                      />
                      <div className="flex rounded-full bg-slate-100 dark:bg-slate-800 p-1">
                        {(['meses', 'anos'] as const).map((u) => (
                          <button
                            key={u}
                            type="button"
                            onClick={() => setTermUnit(u)}
                            className={`h-8 px-3 rounded-full text-sm font-semibold cursor-pointer ${
                              termUnit === u ? 'bg-white dark:bg-slate-950 text-slate-900 dark:text-white shadow-sm' : 'text-slate-500'
                            }`}
                          >
                            {u}
                          </button>
                        ))}
                      </div>
                    </div>
                  </Field>
                  <Field label="Sistema de amortização" help={HELP.system}>
                    <div className="grid grid-cols-2 gap-3">
                      <SystemCard value="SAC" selected={c.system === 'SAC'} onSelect={() => set('system', 'SAC')} />
                      <SystemCard value="PRICE" selected={c.system === 'PRICE'} onSelect={() => set('system', 'PRICE')} />
                    </div>
                  </Field>
                </>
              )}

              {step === 2 && (
                <>
                  <Field
                    label="Taxa de juros"
                    help={HELP.annualRate}
                    hint={
                      c.annualRate > 0
                        ? `Equivale a ${fmtRate(c.annualRate, 2)}% efetiva ao ano, ${fmtRate(effectiveToNominal(c.annualRate), 4)}% nominal ao ano e ${fmtRate(annualToMonthly(c.annualRate), 4)}% ao mês.`
                        : undefined
                    }
                  >
                    {/* Qual taxa a pessoa tem em mãos: a efetiva do contrato, a nominal do app do banco ou a mensal */}
                    <div className="grid grid-cols-3 gap-2 mb-2" role="group" aria-label="Tipo de taxa">
                      {RATE_UNITS.map((u) => (
                        <button
                          key={u.value}
                          type="button"
                          aria-pressed={rateUnit === u.value}
                          onClick={() => setRateUnit(u.value)}
                          className={`text-left px-3 py-2 rounded-xl border-2 cursor-pointer transition-colors ${
                            rateUnit === u.value
                              ? 'border-anil-500 bg-anil-50 dark:bg-anil-500/10'
                              : 'border-slate-200 dark:border-slate-700 hover:border-anil-300 dark:hover:border-anil-500/50'
                          }`}
                        >
                          <span className="block text-sm font-bold text-slate-900 dark:text-white">{u.label}</span>
                          <span className="block text-[11px] leading-snug text-slate-500 dark:text-slate-400">{u.where}</span>
                        </button>
                      ))}
                    </div>
                    <NumberField
                      value={rateUnit === 'efetiva' ? c.annualRate : rateUnit === 'nominal' ? effectiveToNominal(c.annualRate) : annualToMonthly(c.annualRate)}
                      onChange={(v) =>
                        set('annualRate', rateUnit === 'efetiva' ? v : rateUnit === 'nominal' ? nominalToEffective(v) : monthlyToAnnual(v))
                      }
                      digits={4}
                      suffix={rateUnit === 'mes' ? '% a.m.' : '% a.a.'}
                      ariaLabel="Taxa de juros"
                    />
                  </Field>
                  <Field label="CET (custo efetivo total)" help={HELP.cet} optional>
                    <NumberField value={c.cet} onChange={(v) => set('cet', v)} suffix="% a.a." ariaLabel="CET" />
                  </Field>
                  <Field label="O saldo é corrigido pela TR?" help={HELP.trIndexed}>
                    <div className="flex gap-2">
                      {[
                        { v: true, l: 'Sim, pela TR' },
                        { v: false, l: 'Não, taxa fixa' },
                      ].map((o) => (
                        <button
                          key={o.l}
                          type="button"
                          onClick={() => set('trIndexed', o.v)}
                          aria-pressed={c.trIndexed === o.v}
                          className={`h-10 px-4 text-sm ${chip(c.trIndexed === o.v)}`}
                        >
                          {o.l}
                        </button>
                      ))}
                    </div>
                    <div className="mt-1.5 text-xs text-slate-500 dark:text-slate-400">Na dúvida, deixe "Sim": é o caso da Caixa e da maioria dos contratos.</div>
                  </Field>
                </>
              )}

              {step === 3 && (
                <>
                  <div className="grid sm:grid-cols-2 gap-4 items-start">
                    <Field label="Mês da primeira parcela" help={HELP.firstDueMonth}>
                      <MonthField
                        value={c.firstDueMonth}
                        onChange={(v) => set('firstDueMonth', v)}
                        ariaLabel="Mês da primeira parcela"
                        min="1990-01"
                        max={addMonths(currentYearMonth(), 12)}
                      />
                    </Field>
                    <Field label="Dia do vencimento" help={HELP.dueDay} hint="De 1 a 31">
                      <NumberField value={c.dueDay} onChange={(v) => set('dueDay', Math.round(v))} digits={0} ariaLabel="Dia do vencimento" />
                    </Field>
                  </div>
                  {c.termMonths > 0 && (
                    <div className="p-4 rounded-2xl bg-anil-50 dark:bg-anil-500/10 text-sm text-anil-900 dark:text-anil-100 leading-relaxed">
                      Pelas datas, você já pagou cerca de <b>{paidSoFar} parcelas</b> e a última está prevista para{' '}
                      <b>{monthLong(addMonths(c.firstDueMonth, c.termMonths - 1))}</b>.
                    </div>
                  )}
                </>
              )}

              {step === 4 && (
                <>
                  <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                    Com estes dados o app sai da <b>estimativa</b> e passa a mostrar a sua situação <b>real</b>. Pode pular e completar depois.
                  </p>
                  {initial ? (
                    // Editando: o saldo real vive em Registros (e o check-in calcula pela fatura)
                    <div className="p-4 rounded-2xl bg-anil-50 dark:bg-anil-500/10 text-sm text-anil-900 dark:text-anil-100 leading-relaxed">
                      {realBalance ? (
                        <>
                          Último saldo real: <b className="font-num">{formatBRL(realBalance.balance)}</b> depois da parcela de {monthLong(realBalance.yearMonth)} (
                          {realBalance.source === 'fatura' ? 'calculado pela fatura' : 'do banco'}). Daí em diante o app aplica a TR, os juros e cada parcela paga.
                        </>
                      ) : (
                        'Ainda não há saldo real: o saldo é estimado pelo contrato. Faça o check-in com a fatura do mês ou informe o saldo do banco.'
                      )}
                      {onOpenRecords && (
                        <button
                          type="button"
                          onClick={onOpenRecords}
                          className="mt-2 flex items-center gap-1 font-semibold text-anil-700 dark:text-anil-300 hover:underline cursor-pointer"
                        >
                          Ver e informar saldos em Registros <ArrowRight className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {/* Para leigos: por que o saldo e o prazo de hoje importam num contrato que já anda */}
                      <div className="p-4 rounded-2xl bg-anil-50 dark:bg-anil-500/10 text-sm text-anil-900 dark:text-anil-100 leading-relaxed">
                        <b>Seu financiamento já tem um tempo?</b> Se você já amortizou, o saldo e o número de parcelas mudaram, e o contrato sozinho não sabe disso.
                        Com os dois números de hoje, o app acerta as próximas parcelas <b>sem você precisar lançar o passado</b>. Não tem agora? O primeiro check-in com a
                        fatura faz o mesmo.
                      </div>
                      <div className="grid sm:grid-cols-2 gap-4 items-start">
                        <Field label="Saldo devedor de hoje" help={HELP.currentBalance} optional hint="Copie do app do banco agora: o saldo muda um pouco a cada dia.">
                          <MoneyField value={balance} onChange={setBalance} />
                        </Field>
                        <Field
                          label="Parcelas que faltam"
                          help={HELP.remaining}
                          optional
                          hint={
                            remainingNow > 0 && !(balance > 0)
                              ? 'Informe também o saldo de hoje: os dois juntos acertam as próximas parcelas.'
                              : remainingNow > 0 && paidSoFar > 0 && Math.round(remainingNow) < c.termMonths - paidSoFar
                              ? `Pelo contrato seriam ${c.termMonths - paidSoFar}: as amortizações já tiraram ${c.termMonths - paidSoFar - Math.round(remainingNow)} do fim.`
                              : 'O "prazo atual" no app do banco.'
                          }
                        >
                          <NumberField value={remainingNow} onChange={setRemainingNow} digits={0} ariaLabel="Parcelas que faltam" />
                        </Field>
                      </div>
                    </div>
                  )}
                </>
              )}

              <AnimatePresence>
                {tried && stepProblems.length > 0 && (
                  <motion.div
                    initial={{ opacity: 0, y: -4 }}
                    animate={{ opacity: 1, y: 0, x: [0, -6, 6, -4, 4, 0] }}
                    exit={{ opacity: 0 }}
                    className="p-3 rounded-xl bg-rose-50 text-rose-800 dark:bg-rose-500/10 dark:text-rose-200 text-sm"
                    role="alert"
                  >
                    {stepProblems.map((p) => (
                      <div key={p}>{p}</div>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          </AnimatePresence>
        </div>

        <div data-tour="cad-avancar" className="flex items-center justify-between gap-3 mt-6 pt-5 border-t border-slate-900/[0.06] dark:border-white/[0.06]">
          <div className="flex gap-2">
            {onCancel && (
              <button type="button" onClick={onCancel} className={btnGhost}>
                <X className="w-4 h-4" /> Cancelar
              </button>
            )}
            {step > 0 && (
              <button type="button" onClick={() => go(-1)} className={btnGhost}>
                <ArrowLeft className="w-4 h-4" /> Voltar
              </button>
            )}
          </div>
          {step < STEPS.length - 1 ? (
            <div className="flex gap-2">
              {initial && (
                <button type="button" onClick={finish} className={btnGhost}>
                  <Check className="w-4 h-4" /> Salvar
                </button>
              )}
              <button type="button" onClick={() => go(1)} className={btnPrimary}>
                Continuar <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <button type="button" onClick={finish} className={`${btnPrimary} bg-sol-500 hover:bg-sol-400 shadow-[0_8px_20px_-8px_rgba(249,147,11,0.8)]`}>
              <Sparkles className="w-4 h-4" /> {initial ? 'Salvar alterações' : 'Ver minha casa'}
            </button>
          )}
        </div>
      </div>

      {/* Prévia viva: a casa reage ao que é digitado */}
      <aside data-tour="cad-previa" className="hidden lg:block sticky top-4">
        <div className="rounded-[28px] overflow-hidden ring-1 ring-slate-900/[0.06] dark:ring-white/[0.07] shadow-[0_24px_60px_-30px_rgba(45,40,140,0.5)]">
          <HouseHero progress={Math.max(0, Math.min(1, previewProgress))} dark={dark} className="w-full block" />
        </div>
        <div className="mt-4 p-4 rounded-2xl bg-white/70 dark:bg-slate-900/70 ring-1 ring-slate-900/[0.05] dark:ring-white/[0.06] text-sm space-y-1.5">
          <div className="flex items-center gap-2 font-semibold text-slate-900 dark:text-white">
            <Home className="w-4 h-4 text-anil-600 dark:text-anil-300" />
            {c.nickname.trim() || 'Minha casa'}
            {c.bank.trim() && <span className="font-normal text-slate-500 dark:text-slate-400">{withBank(c.bank, c.bankPreposition)}</span>}
          </div>
          {c.financedAmount > 0 && (
            <div className="text-slate-600 dark:text-slate-300">
              {formatBRL(c.financedAmount)} em {c.termMonths} meses, {c.system === 'SAC' ? 'SAC' : 'Price'}
            </div>
          )}
          {c.annualRate > 0 && (
            <div className="text-slate-600 dark:text-slate-300">
              {c.annualRate.toLocaleString('pt-BR', { maximumFractionDigits: 2 })}% ao ano{c.trIndexed ? ' + TR' : ''}
            </div>
          )}
        </div>
      </aside>
    </div>
  );
};
