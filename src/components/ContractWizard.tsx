import React, { useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { ArrowLeft, ArrowRight, Check, Home, Sparkles, X } from 'lucide-react';
import type { Contract } from '../types/finance';
import { addMonths, annualToMonthly, currentYearMonth, formatBRL, formatDuration, monthLong, monthlyToAnnual } from '../lib/format';
import { EASE_OUT, instantIf } from '../lib/motion';
import { playSound } from '../hooks/useSound';
import { Field } from './ui/HelpTip';
import { MoneyField, MonthField, NumberField } from './ui/Inputs';
import { btnGhost, btnPrimary, inputBase } from './ui/card';
import { HouseHero } from './HouseHero';
import { HELP } from './help';

const BANKS = ['Caixa', 'Banco do Brasil', 'Itaú', 'Bradesco', 'Santander', 'Inter', 'Cooperativa'];

export const blankContract = (): Contract => ({
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
  monthlyInsurance: 0,
  monthlyAdminFee: 0,
});

export interface WizardResult {
  contract: Contract;
  // Saldo de hoje informado no último passo (opcional)
  currentBalance: number;
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
  initialBalance?: number;
  onCancel?: () => void;
  onSave: (result: WizardResult) => void;
  dark: boolean;
}> = ({ initial, initialBalance = 0, onCancel, onSave, dark }) => {
  const reduce = Boolean(useReducedMotion());
  const [c, setC] = useState<Contract>(() => initial ?? blankContract());
  const [balance, setBalance] = useState(initialBalance);
  const [step, setStep] = useState(0);
  const [dir, setDir] = useState(1);
  const [rateUnit, setRateUnit] = useState<'ano' | 'mes'>('ano');
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
    [c.annualRate > 0 && c.annualRate < 40 ? '' : 'Informe a taxa de juros do contrato (ex.: 10,49% ao ano).'].filter(Boolean),
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
      contract: { ...c, nickname: c.nickname.trim() || 'Minha casa', bank: c.bank.trim() },
      currentBalance: balance,
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
        {/* Trilho dos passos: a casinha anda até o passo atual */}
        <div className="relative mb-7">
          <div className="flex items-center justify-between gap-2">
            {STEPS.map((s, k) => (
              <button
                key={s.title}
                type="button"
                onClick={() => {
                  if (k < step || problems.slice(0, k).every((p) => p.length === 0)) {
                    setDir(k > step ? 1 : -1);
                    setStep(k);
                    playSound('tick');
                  }
                }}
                className="flex-1 min-w-0 text-left cursor-pointer group"
              >
                <div className="h-1.5 rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden">
                  <motion.div
                    className="h-full rounded-full bg-anil-500"
                    initial={false}
                    animate={{ width: k < step ? '100%' : k === step ? '50%' : '0%' }}
                    transition={instantIf(reduce, { duration: 0.45, ease: EASE_OUT })}
                  />
                </div>
                <div
                  className={`mt-2 text-xs font-semibold truncate transition-colors ${
                    k === step ? 'text-anil-700 dark:text-anil-300' : 'text-slate-500 dark:text-slate-400 group-hover:text-slate-700'
                  }`}
                >
                  {k + 1}. {s.title}
                </div>
              </button>
            ))}
          </div>
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
              className="space-y-5"
            >
              <div>
                <h2 className="text-2xl font-bold text-slate-900 dark:text-white">{STEPS[step].title}</h2>
                <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">{STEPS[step].hint}</p>
              </div>

              {step === 0 && (
                <>
                  <Field label="Como quer chamar este imóvel?" htmlFor="f-nick" help={HELP.nickname} optional>
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
                          onClick={() => set('bank', b)}
                          aria-pressed={c.bank === b}
                          className={`h-9 px-4 rounded-full text-sm font-semibold transition-colors cursor-pointer ${
                            c.bank === b
                              ? 'bg-anil-600 text-white'
                              : 'bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700'
                          }`}
                        >
                          {b}
                        </button>
                      ))}
                      <input
                        className="h-9 w-44 px-4 rounded-full text-sm bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:border-anil-500 focus:ring-2 focus:ring-anil-500/25"
                        placeholder="Outro banco"
                        value={BANKS.includes(c.bank) ? '' : c.bank}
                        onChange={(e) => set('bank', e.target.value)}
                        aria-label="Outro banco"
                      />
                    </div>
                  </Field>
                  <Field label="Valor do imóvel" htmlFor="f-prop" help={HELP.propertyValue} optional hint="Usado para mostrar quanto da casa já é seu, contando a entrada.">
                    <MoneyField id="f-prop" value={c.propertyValue} onChange={(v) => set('propertyValue', v)} className="max-w-xs" />
                  </Field>
                </>
              )}

              {step === 1 && (
                <>
                  <Field label="Valor financiado" htmlFor="f-fin" help={HELP.financedAmount}>
                    <MoneyField id="f-fin" value={c.financedAmount} onChange={(v) => set('financedAmount', v)} size="lg" className="max-w-sm" />
                  </Field>
                  {c.propertyValue > 0 && c.financedAmount > 0 && c.financedAmount < c.propertyValue && (
                    <div className="text-sm text-slate-600 dark:text-slate-400 -mt-2">
                      Entrada de <b className="text-slate-900 dark:text-white">{formatBRL(c.propertyValue - c.financedAmount)}</b> (
                      {Math.round((1 - c.financedAmount / c.propertyValue) * 100)}% do imóvel).
                    </div>
                  )}
                  <Field label="Prazo" help={HELP.termMonths} hint={c.termMonths > 0 ? formatDuration(c.termMonths) : undefined}>
                    <div className="flex gap-2 items-center max-w-sm">
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
                    <div className="grid grid-cols-2 gap-3 max-w-lg">
                      <SystemCard value="SAC" selected={c.system === 'SAC'} onSelect={() => set('system', 'SAC')} />
                      <SystemCard value="PRICE" selected={c.system === 'PRICE'} onSelect={() => set('system', 'PRICE')} />
                    </div>
                  </Field>
                </>
              )}

              {step === 2 && (
                <>
                  <Field
                    label="Taxa de juros efetiva"
                    help={HELP.annualRate}
                    hint={
                      c.annualRate > 0
                        ? rateUnit === 'ano'
                          ? `Equivale a ${annualToMonthly(c.annualRate).toLocaleString('pt-BR', { maximumFractionDigits: 4 })}% ao mês`
                          : `Equivale a ${c.annualRate.toLocaleString('pt-BR', { maximumFractionDigits: 2 })}% ao ano`
                        : undefined
                    }
                  >
                    <div className="flex gap-2 items-center max-w-sm">
                      <NumberField
                        value={rateUnit === 'ano' ? c.annualRate : annualToMonthly(c.annualRate)}
                        onChange={(v) => set('annualRate', rateUnit === 'ano' ? v : monthlyToAnnual(v))}
                        digits={rateUnit === 'ano' ? 2 : 4}
                        suffix="%"
                        ariaLabel="Taxa de juros"
                        className="flex-1"
                        size="lg"
                      />
                      <div className="flex rounded-full bg-slate-100 dark:bg-slate-800 p-1">
                        {(['ano', 'mes'] as const).map((u) => (
                          <button
                            key={u}
                            type="button"
                            onClick={() => setRateUnit(u)}
                            className={`h-8 px-3 rounded-full text-sm font-semibold cursor-pointer whitespace-nowrap ${
                              rateUnit === u ? 'bg-white dark:bg-slate-950 text-slate-900 dark:text-white shadow-sm' : 'text-slate-500'
                            }`}
                          >
                            {u === 'ano' ? 'ao ano' : 'ao mês'}
                          </button>
                        ))}
                      </div>
                    </div>
                  </Field>
                  <Field label="CET (custo efetivo total)" help={HELP.cet} optional>
                    <NumberField value={c.cet} onChange={(v) => set('cet', v)} suffix="% a.a." ariaLabel="CET" className="max-w-[200px]" />
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
                          className={`h-10 px-4 rounded-full text-sm font-semibold transition-colors cursor-pointer ${
                            c.trIndexed === o.v
                              ? 'bg-anil-600 text-white'
                              : 'bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-200'
                          }`}
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
                  <Field label="Mês da primeira parcela" help={HELP.firstDueMonth}>
                    <MonthField
                      value={c.firstDueMonth}
                      onChange={(v) => set('firstDueMonth', v)}
                      ariaLabel="Mês da primeira parcela"
                      min="1990-01"
                      max={addMonths(currentYearMonth(), 12)}
                      className="max-w-[260px]"
                    />
                  </Field>
                  <Field label="Dia do vencimento" help={HELP.dueDay}>
                    <NumberField value={c.dueDay} onChange={(v) => set('dueDay', Math.round(v))} digits={0} ariaLabel="Dia do vencimento" className="max-w-[120px]" />
                  </Field>
                  {c.termMonths > 0 && (
                    <div className="p-4 rounded-2xl bg-anil-50 dark:bg-anil-500/10 text-sm text-anil-900 dark:text-anil-100 max-w-lg leading-relaxed">
                      Pelas datas, você já pagou cerca de <b>{paidSoFar} parcelas</b> e a última está prevista para{' '}
                      <b>{monthLong(addMonths(c.firstDueMonth, c.termMonths - 1))}</b>.
                    </div>
                  )}
                </>
              )}

              {step === 4 && (
                <>
                  <p className="text-sm text-slate-600 dark:text-slate-400 max-w-xl leading-relaxed">
                    Com estes dados o app sai da <b>estimativa</b> e passa a mostrar a sua situação <b>real</b>. Pode pular e completar depois.
                  </p>
                  <Field label="Saldo devedor de hoje" help={HELP.currentBalance} optional>
                    <MoneyField value={balance} onChange={setBalance} className="max-w-sm" size="lg" />
                  </Field>
                  <div className="grid sm:grid-cols-2 gap-4 max-w-lg">
                    <Field label="Seguros (MIP + DFI) por mês" help={HELP.monthlyInsurance} optional>
                      <MoneyField value={c.monthlyInsurance} onChange={(v) => set('monthlyInsurance', v)} />
                    </Field>
                    <Field label="Taxa de administração" help={HELP.monthlyAdminFee} optional>
                      <MoneyField value={c.monthlyAdminFee} onChange={(v) => set('monthlyAdminFee', v)} />
                    </Field>
                  </div>
                </>
              )}

              <AnimatePresence>
                {tried && stepProblems.length > 0 && (
                  <motion.div
                    initial={{ opacity: 0, y: -4 }}
                    animate={{ opacity: 1, y: 0, x: [0, -6, 6, -4, 4, 0] }}
                    exit={{ opacity: 0 }}
                    className="p-3 rounded-xl bg-rose-50 text-rose-800 dark:bg-rose-500/10 dark:text-rose-200 text-sm max-w-lg"
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

        <div className="flex items-center justify-between gap-3 mt-6 pt-5 border-t border-slate-900/[0.06] dark:border-white/[0.06]">
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
      <aside className="hidden lg:block sticky top-4">
        <div className="rounded-[28px] overflow-hidden ring-1 ring-slate-900/[0.06] dark:ring-white/[0.07] shadow-[0_24px_60px_-30px_rgba(45,40,140,0.5)]">
          <HouseHero progress={Math.max(0, Math.min(1, previewProgress))} dark={dark} className="w-full block" />
        </div>
        <div className="mt-4 p-4 rounded-2xl bg-white/70 dark:bg-slate-900/70 ring-1 ring-slate-900/[0.05] dark:ring-white/[0.06] text-sm space-y-1.5">
          <div className="flex items-center gap-2 font-semibold text-slate-900 dark:text-white">
            <Home className="w-4 h-4 text-anil-600 dark:text-anil-300" />
            {c.nickname.trim() || 'Minha casa'}
            {c.bank && <span className="font-normal text-slate-500 dark:text-slate-400">no {c.bank}</span>}
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
