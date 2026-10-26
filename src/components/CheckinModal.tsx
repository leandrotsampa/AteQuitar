import React, { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { AlertTriangle, ArrowLeft, ArrowRight, CalendarClock, CalendarDays, Check, CircleCheck, ClipboardCheck, PiggyBank, Receipt, X } from 'lucide-react';
import { ModalShell } from './ui/ModalShell';
import { StepTrack } from './ui/StepTrack';
import { Field } from './ui/HelpTip';
import { MoneyField, MonthField } from './ui/Inputs';
import { btnGhost, btnPrimary, chip, tile } from './ui/card';
import { celebrate } from './ui/Confetti';
import { InvoiceFeesRows, LedgerRow, draftFromFees, draftFromRow, draftTotal, feesFromDraft, type FeesDraft } from './InvoiceFeesFields';
import type { FinanceModel } from '../lib/model';
import type { AppData } from '../lib/store';
import type { ExtraMode, ExtraPayment, ExtraSource, ScheduleCheckpoint } from '../types/finance';
import { balanceFromInvoice, buildSchedule, effectiveExtra, summarize } from '../lib/finance';
import { ExtraPaymentFields, extraEffective, todayIso } from './ExtraPaymentFields';
import { currentYearMonth, formatBRL, formatPct, monthLong, monthName, uid } from '../lib/format';
import { pendingCheckinMonth } from '../lib/insights';
import { EASE_OUT } from '../lib/motion';
import { playSound } from '../hooks/useSound';

const SOURCES: { v: ExtraSource; l: string }[] = [
  { v: 'proprio', l: 'Dinheiro próprio' },
  { v: 'fgts', l: 'FGTS' },
  { v: 'decimo', l: '13º salário' },
];

const cents = (v: number) => Math.round(v * 100) / 100;
// Saldo calculado pela fatura muito longe do previsto: quase sempre é a taxa do cadastro
const FAR_FROM_FORECAST = 0.1;

const pill = (active: boolean) => `h-10 px-4 text-sm ${chip(active)}`;

export const CheckinModal: React.FC<{
  model: FinanceModel;
  data: AppData;
  update: (fn: (prev: AppData) => AppData) => void;
  dark: boolean;
  // Abre direto num mês já registrado (editar pelo Histórico)
  month?: string;
  onClose: () => void;
}> = ({ model, data, update, month, onClose }) => {
  const reduce = Boolean(useReducedMotion());
  const { contract } = model;
  // Último mês vencido e a próxima parcela: dá para registrar a próxima com antecedência
  // (paga adiantada ou já agendada no débito automático), mas não meses além dela
  const lastDueYm = model.summary.paidCount > 0 ? model.rows[model.summary.paidCount - 1].yearMonth : null;
  const nextYm = model.summary.next?.yearMonth ?? null;
  const maxYm = [currentYearMonth(), nextYm].filter((v): v is string => Boolean(v)).sort().at(-1)!;
  const defaultYm =
    month ??
    pendingCheckinMonth(model, data) ??
    // O mês vencido já tem check-in: abre direto na próxima parcela
    (lastDueYm && nextYm && data.checkins.some((c) => c.yearMonth === lastDueYm) ? nextYm : null) ??
    lastDueYm ??
    nextYm ??
    currentYearMonth();
  const [ym, setYm] = useState(defaultYm);
  const row = model.rows.find((r) => r.yearMonth === ym);
  const checkedMonths = useMemo(() => new Set(data.checkins.map((c) => c.yearMonth)), [data.checkins]);
  const existing = data.checkins.find((c) => c.yearMonth === ym);

  // Faturas já informadas: a mais recente decide se os seguros vêm detalhados
  const refs = useMemo(
    () => [...(contract.feesRef ? [contract.feesRef] : []), ...(model.options.invoices ?? [])].sort((a, b) => a.yearMonth.localeCompare(b.yearMonth)),
    [contract.feesRef, model.options.invoices]
  );
  const lastSplit = refs.length > 0 && refs[refs.length - 1].mip !== undefined;
  const extraOf = (m: string) => {
    const ci = data.checkins.find((c) => c.yearMonth === m);
    return ci?.extraId ? data.extras.find((e) => e.id === ci.extraId) : undefined;
  };

  // Tudo o que a tela mostra de um mês: a fatura já registrada ou a previsão
  const load = (m: string) => {
    const ci = data.checkins.find((c) => c.yearMonth === m);
    const r = model.rows.find((x) => x.yearMonth === m);
    const e = extraOf(m);
    return {
      amort: cents(ci?.amortization ?? r?.amortization ?? 0),
      interest: cents(ci?.interest ?? r?.interest ?? 0),
      fees: ci?.fees ? draftFromFees(ci.fees) : draftFromRow(r, lastSplit),
      charges: ci?.charges ?? 0,
      fgts: ci?.fgts ?? 0,
      // Adiantada sem registro: o comum é o débito automático agendado
      scheduled: ci ? Boolean(ci.scheduled) : true,
      hasExtra: Boolean(e),
      extraPaid: e?.paid ?? e?.amount ?? 0,
      extraDate: e?.date ?? todayIso(),
      extraEff: e?.amount ?? 0,
      // Amortização efetiva copiada do banco (diferente da estimativa): não recalcula sozinha
      effEdited: Boolean(e && (e.paid === undefined || Math.abs(effectiveExtra(contract, e.paid, e.date ?? todayIso()) - e.amount) > 0.005)),
      mode: e?.mode ?? ('prazo' as ExtraMode),
      source: e?.source ?? ('proprio' as ExtraSource),
    };
  };
  const [f, setF] = useState(() => load(ym));
  // O que veio preenchido ao abrir o mês: só o que for diferente disso foi copiado da fatura
  // (as taxas podem atualizar com a tela aberta e mudar a previsão por baixo)
  const [prefill, setPrefill] = useState(() => ({ amort: f.amort, interest: f.interest }));
  const set = (patch: Partial<typeof f>) => setF((prev) => ({ ...prev, ...patch }));
  const [moreLines, setMoreLines] = useState(f.charges > 0 || f.fgts > 0);
  const linkedExtra = extraOf(ym);
  // As outras amortizações (sem a deste check-in), para as prévias não contarem duas vezes
  const otherExtras = data.extras.filter((e) => e.id !== linkedExtra?.id);
  const [step, setStep] = useState(0);
  const [dir, setDir] = useState(1);
  const [done, setDone] = useState<{ before: number; after: number; scheduled: boolean } | null>(null);

  // Parcela que ainda não venceu (registro adiantado)
  const ahead = Boolean(lastDueYm ? ym > lastDueYm : nextYm && ym >= nextYm);

  const changeMonth = (v: string) => {
    setYm(v);
    const next = load(v);
    setF(next);
    setPrefill({ amort: next.amort, interest: next.interest });
    setMoreLines(next.charges > 0 || next.fgts > 0);
  };

  // Data deste check-in: a amortização dele entra depois de saldos informados antes
  const [stamp] = useState(() => new Date().toISOString());
  const at = existing?.createdAt ?? stamp;

  const installment = cents(f.amort + f.interest + draftTotal(f.fees));
  const paid = cents(installment + f.charges - f.fgts);

  // Saldo depois da parcela pela fatura: só quando os juros e a amortização são os da fatura
  // (alterados em relação à previsão, ou já vindos de uma fatura antes)
  const typed = Math.abs(f.amort - prefill.amort) > 0.005 || Math.abs(f.interest - prefill.interest) > 0.005;
  // Juros e amortização já vindos de uma fatura antes (reabrindo o mês) também valem
  const fromInvoice = typed || existing?.balanceSource === 'fatura' || (existing?.amortization !== undefined && existing.interest !== undefined);
  const computed = fromInvoice ? balanceFromInvoice(contract, f.interest, f.amort) : null;
  const forecast = row?.closingBalance ?? model.summary.currentBalance;
  const far = computed !== null && forecast > 0 && Math.abs(computed - forecast) / forecast > FAR_FROM_FORECAST;
  // Saldo do banco de um check-in antigo: continua valendo se a fatura não mudou
  const keptBank = existing?.balanceSource !== 'fatura' && existing?.balanceAfter && !typed ? existing.balanceAfter : undefined;
  const balanceAfter = computed !== null && !far ? cents(computed) : keptBank;
  const balanceSource: 'fatura' | 'banco' | undefined = computed !== null && !far ? 'fatura' : keptBank ? 'banco' : undefined;

  // Amortização extra: só o efetivo abate o saldo; o resto são juros pro rata
  const eff = extraEffective(contract, { paid: f.extraPaid, date: f.extraDate, eff: f.extraEff, effEdited: f.effEdited });
  const keepExtra = f.hasExtra && eff > 0;
  const extraRecord = (id: string): ExtraPayment => ({
    id,
    yearMonth: ym,
    amount: eff,
    paid: f.extraPaid > 0 ? f.extraPaid : eff,
    date: f.extraDate,
    mode: f.mode,
    source: f.source,
    createdAt: at,
  });

  // Prévia: a tabela como fica depois de salvar
  const preview = useMemo(() => {
    const checkpoints: ScheduleCheckpoint[] = [
      ...(model.options.checkpoints ?? []).filter((c) => c.id !== `ci-${existing?.id}`),
      ...(balanceAfter && !data.checkpoints.some((c) => c.yearMonth === ym)
        ? [{ id: 'x', yearMonth: ym, balance: balanceAfter, source: balanceSource!, createdAt: balanceSource === 'fatura' ? '' : at }]
        : []),
    ];
    const actuals = [
      ...(model.options.actuals ?? []).filter((a) => a.yearMonth !== ym),
      ...(fromInvoice ? [{ yearMonth: ym, amortization: f.amort, interest: f.interest }] : []),
    ];
    const extras = keepExtra ? [...otherExtras, extraRecord('x')] : otherExtras;
    const rows = buildSchedule(contract, { ...model.options, checkpoints, actuals, extras });
    const paidMonths = new Set(model.paidMonths);
    if (ahead && f.scheduled) paidMonths.delete(ym);
    else paidMonths.add(ym);
    const r = rows.find((x) => x.yearMonth === ym);
    return { progress: summarize(contract, rows, new Date(), paidMonths).progress, afterExtra: r?.closingBalance ?? forecast };
    // extraRecord depende só dos campos já listados
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [model, data.checkpoints, existing?.id, balanceAfter, balanceSource, ym, f, fromInvoice, keepExtra, eff, otherExtras, at, ahead, contract, forecast]);

  const go = (d: number) => {
    playSound('tick');
    setDir(d);
    setStep((s) => s + d);
  };

  const save = () => {
    const before = model.summary.progress;
    const extraId = keepExtra ? linkedExtra?.id ?? uid() : undefined;
    const invoice = feesFromDraft(f.fees);
    update((prev) => ({
      ...prev,
      checkins: [
        ...prev.checkins.filter((c) => c.yearMonth !== ym),
        {
          id: existing?.id ?? uid(),
          yearMonth: ym,
          paidAmount: paid,
          // Só os valores copiados da fatura: os previstos continuam vindo da tabela
          ...(fromInvoice ? { amortization: f.amort, interest: f.interest } : {}),
          ...(invoice ? { fees: invoice } : {}),
          ...(f.charges > 0 ? { charges: f.charges } : {}),
          ...(f.fgts > 0 ? { fgts: f.fgts } : {}),
          ...(ahead && f.scheduled ? { scheduled: true } : {}),
          ...(balanceAfter ? { balanceAfter, balanceSource } : {}),
          ...(extraId ? { extraId } : {}),
          createdAt: at,
        },
      ],
      // Troca (ou remove) a amortização deste check-in; as outras ficam como estão
      extras: [...prev.extras.filter((e) => e.id !== linkedExtra?.id), ...(keepExtra && extraId ? [extraRecord(extraId)] : [])],
    }));
    setDone({ before, after: preview.progress, scheduled: ahead && f.scheduled });
    playSound('celebrate');
    window.setTimeout(() => celebrate(), 150);
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const steps = ['Fatura', 'Extra', 'Resumo'];
  // Dia do vencimento deste mês (ajustado a meses curtos) e quantos dias faltam
  const [dueY, dueM] = ym.split('-').map(Number);
  const dueDate = new Date(dueY, dueM - 1, Math.min(contract.dueDay, new Date(dueY, dueM, 0).getDate()));
  const dueLabel = `${String(dueDate.getDate()).padStart(2, '0')}/${ym.slice(5)}`;
  const daysToDue = Math.ceil((dueDate.getTime() - new Date(new Date().toDateString()).getTime()) / 86400000);

  return (
    <ModalShell
      ariaLabel="Check-in do mês"
      panelClassName="bg-white dark:bg-slate-900 rounded-[28px] w-full max-w-2xl shadow-2xl ring-1 ring-slate-900/[0.06] dark:ring-white/[0.08] overflow-hidden"
    >
      <div className="relative">
        <button
          type="button"
          onClick={onClose}
          aria-label="Fechar"
          className="absolute right-4 top-4 z-10 w-9 h-9 rounded-full flex items-center justify-center text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
        >
          <X className="w-4 h-4" />
        </button>

        {done ? (
          <div className="p-8 text-center">
            <motion.div
              className="mx-auto w-20 h-20 rounded-full bg-emerald-500 text-white flex items-center justify-center shadow-[0_16px_40px_-12px_rgba(16,185,129,0.8)]"
              initial={reduce ? false : { scale: 0, rotate: -40 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ type: 'spring', stiffness: 300, damping: 16 }}
            >
              <motion.svg viewBox="0 0 24 24" className="w-10 h-10" fill="none" stroke="currentColor" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round">
                <motion.path d="M5 12.5l4.5 4.5L19 7.5" initial={reduce ? false : { pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ delay: 0.25, duration: 0.45 }} />
              </motion.svg>
            </motion.div>
            <h2 className="mt-5 text-2xl font-bold text-slate-900 dark:text-white">Check-in de {monthName(ym)} feito!</h2>
            <p className="mt-1 text-slate-600 dark:text-slate-300">
              {done.scheduled
                ? `A parcela está agendada: no dia ${dueLabel}, quando o banco debitar, ela conta como paga e a casa avança.`
                : done.after > done.before
                  ? `Sua casa foi de ${formatPct(done.before * 100, 1)} para ${formatPct(done.after * 100, 1)} quitada.`
                  : 'Tudo registrado. Mês que vem tem mais.'}
            </p>
            <div className="mt-6 h-4 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden text-left">
              <motion.div
                className="h-full rounded-full bg-gradient-to-r from-anil-600 to-sol-400"
                initial={{ width: `${done.before * 100}%` }}
                animate={{ width: `${done.after * 100}%` }}
                transition={{ delay: 0.5, duration: 1.2, ease: EASE_OUT }}
              />
            </div>
            <button type="button" onClick={onClose} className={`${btnPrimary} mt-7`}>
              Ver minha casa
            </button>
          </div>
        ) : (
          <div className="p-6 sm:p-7">
            <div className="text-sm font-semibold text-anil-700 dark:text-anil-300">Check-in do mês</div>
            <StepTrack
              ariaLabel="Etapas do check-in"
              className="mt-3 mb-6 pr-10"
              steps={steps}
              icons={[Receipt, PiggyBank, ClipboardCheck]}
              size="sm"
              current={step}
              done={(k) => k < step}
              // Voltar é sempre possível; avançar, só com a fatura preenchida
              reachable={(k) => k < step || installment > 0}
              onSelect={(k) => {
                playSound('tick');
                setDir(k > step ? 1 : -1);
                setStep(k);
              }}
            />

            <div className="relative min-h-[330px] max-h-[calc(100vh-15rem)] overflow-y-auto overflow-x-clip -mx-1 px-1">
              <AnimatePresence mode="popLayout" initial={false} custom={dir}>
                <motion.div
                  key={step}
                  initial={reduce ? false : { x: dir * 40, opacity: 0 }}
                  animate={{ x: 0, opacity: 1 }}
                  exit={reduce ? { opacity: 0 } : { x: dir * -40, opacity: 0 }}
                  transition={{ duration: 0.3, ease: EASE_OUT }}
                  className="space-y-5"
                >
                  {step === 0 && (
                    <>
                      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-x-4 gap-y-3">
                        <div className="min-w-0 flex-1">
                          <h2 className="text-2xl font-bold text-slate-900 dark:text-white text-balance">
                            Fatura de {monthName(ym)}
                          </h2>
                          <p className="mt-1 text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                            {existing ? 'Os valores que você registrou. Corrija o que precisar.' : 'Copie do detalhe da parcela no app do banco. Já vem com a previsão.'}
                          </p>
                        </div>
                        <div className="w-full sm:w-60 shrink-0">
                          <MonthField
                            value={ym}
                            onChange={changeMonth}
                            ariaLabel="Mês da parcela"
                            min={contract.firstDueMonth}
                            max={maxYm}
                            marked={checkedMonths}
                            markedLabel="check-in feito"
                          />
                        </div>
                      </div>

                      {/* Vencimento: antes dele, a pessoa diz se já pagou ou se está agendada; depois, já conta como paga */}
                      {ahead ? (
                        <div>
                          <div className="flex items-center gap-1.5 text-sm text-slate-600 dark:text-slate-300 mb-2">
                            <CalendarDays className="w-4 h-4 text-anil-600 dark:text-anil-300" />
                            Vence em <b className="font-num text-slate-900 dark:text-white">{dueLabel}</b>
                            {daysToDue > 0 && <span className="text-slate-500 dark:text-slate-400">· daqui a {daysToDue} {daysToDue === 1 ? 'dia' : 'dias'}</span>}
                          </div>
                          <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="A parcela já foi paga?">
                            {[
                              { v: true, icon: CalendarClock, l: 'Agendada no débito', d: `Conta como paga em ${dueLabel}, quando o banco debitar.` },
                              { v: false, icon: CircleCheck, l: 'Já paguei', d: 'Conta como paga a partir de hoje.' },
                            ].map((o) => {
                              const on = f.scheduled === o.v;
                              const Icon = o.icon;
                              return (
                                <button
                                  key={o.l}
                                  type="button"
                                  role="radio"
                                  aria-checked={on}
                                  onClick={() => set({ scheduled: o.v })}
                                  className={`flex items-start gap-2.5 p-3 rounded-2xl text-left cursor-pointer transition-colors ${
                                    on
                                      ? 'bg-anil-50 ring-2 ring-anil-500 dark:bg-anil-500/10'
                                      : 'ring-1 ring-slate-200 hover:ring-anil-300 dark:ring-slate-700 dark:hover:ring-anil-500/50'
                                  }`}
                                >
                                  <Icon className={`w-5 h-5 mt-0.5 shrink-0 ${on ? 'text-anil-600 dark:text-anil-300' : 'text-slate-400'}`} />
                                  <span>
                                    <span className="block text-sm font-semibold text-slate-900 dark:text-white">{o.l}</span>
                                    <span className="block text-xs leading-snug text-slate-500 dark:text-slate-400 mt-0.5">{o.d}</span>
                                  </span>
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1.5 text-sm text-slate-600 dark:text-slate-300">
                          <CircleCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                          Venceu em <b className="font-num text-slate-900 dark:text-white">{dueLabel}</b>
                          <span className="text-slate-500 dark:text-slate-400">· conta como paga</span>
                        </div>
                      )}

                      {/* Detalhe da parcela: as mesmas linhas, na mesma ordem, do app do banco */}
                      <div className={`${tile} px-4 pt-2`}>
                        <div className="divide-y divide-slate-200/70 dark:divide-slate-800">
                          <LedgerRow label="Amortização">
                            <MoneyField size="sm" value={f.amort} onChange={(v) => set({ amort: v })} ariaLabel="Amortização" />
                          </LedgerRow>
                          <LedgerRow label="Juros">
                            <MoneyField size="sm" value={f.interest} onChange={(v) => set({ interest: v })} ariaLabel="Juros" />
                          </LedgerRow>
                          <InvoiceFeesRows value={f.fees} onChange={(fees: FeesDraft) => set({ fees })} />
                          {moreLines && (
                            <>
                              <LedgerRow label="Atraso" note="Multa e juros de mora. Não mexem no saldo.">
                                <MoneyField size="sm" value={f.charges} onChange={(v) => set({ charges: v })} ariaLabel="Atraso" />
                              </LedgerRow>
                              <LedgerRow label="FGTS na prestação" sign="−">
                                <MoneyField size="sm" value={f.fgts} onChange={(v) => set({ fgts: v })} ariaLabel="FGTS na prestação" />
                              </LedgerRow>
                            </>
                          )}
                        </div>
                        <div className="sticky bottom-0 -mx-4 px-4 mt-1 pt-3 pb-2.5 rounded-b-2xl bg-slate-50 dark:bg-slate-950 border-t border-slate-400 dark:border-slate-600">
                          <div className="flex items-baseline justify-between gap-3">
                            <span className="text-sm font-semibold text-slate-900 dark:text-white">
                              Valor da prestação <span className="text-slate-400 dark:text-slate-500 font-normal">(=)</span>
                            </span>
                            <span className="font-num text-xl font-bold text-slate-900 dark:text-white tabular-nums">{formatBRL(installment)}</span>
                          </div>
                          {(f.charges > 0 || f.fgts > 0) && (
                            <div className="flex items-baseline justify-between gap-3 mt-1 text-sm">
                              <span className="text-slate-500">Você pagou</span>
                              <span className="font-num font-semibold text-slate-900 dark:text-white tabular-nums">{formatBRL(paid)}</span>
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 -mt-2 text-xs text-slate-500 dark:text-slate-400">
                        <span>Confira com o "Valor da prestação" da fatura: se não bater, falta alguma linha.</span>
                        {!moreLines && (
                          <button type="button" onClick={() => setMoreLines(true)} className="font-semibold text-anil-700 dark:text-anil-300 hover:underline cursor-pointer">
                            Teve atraso ou FGTS?
                          </button>
                        )}
                      </div>
                    </>
                  )}

                  {step === 1 && (
                    <>
                      <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Pagou algo a mais este mês?</h2>
                      <div className="flex gap-2">
                        <button type="button" onClick={() => set({ hasExtra: false })} aria-pressed={!f.hasExtra} className={pill(!f.hasExtra)}>
                          Não, só a parcela
                        </button>
                        <button type="button" onClick={() => set({ hasExtra: true })} aria-pressed={f.hasExtra} className={pill(f.hasExtra)}>
                          Sim, amortizei
                        </button>
                      </div>
                      <AnimatePresence>
                        {f.hasExtra && (
                          <motion.div className="space-y-4" initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }}>
                            <ExtraPaymentFields
                              contract={contract}
                              value={{ paid: f.extraPaid, date: f.extraDate, eff: f.extraEff, effEdited: f.effEdited }}
                              onChange={(d) => set({ extraPaid: d.paid, extraDate: d.date, extraEff: d.eff, effEdited: d.effEdited })}
                            />
                            <Field
                              label="O que você escolheu reduzir?"
                              help={{
                                title: 'Prazo ou parcela?',
                                body: 'Reduzir o prazo mantém a parcela e tira meses do fim: economiza mais juros. Reduzir a parcela mantém o prazo e alivia o orçamento todo mês.',
                                where: 'O banco pergunta isso na hora de amortizar; confira no comprovante.',
                              }}
                            >
                              <div className="flex gap-2">
                                {(['prazo', 'parcela'] as const).map((m) => (
                                  <button key={m} type="button" onClick={() => set({ mode: m })} aria-pressed={f.mode === m} className={pill(f.mode === m)}>
                                    {m === 'prazo' ? 'Reduzi o prazo' : 'Reduzi a parcela'}
                                  </button>
                                ))}
                              </div>
                            </Field>
                            <Field label="De onde veio o dinheiro?">
                              <div className="flex flex-wrap gap-2">
                                {SOURCES.map((s) => (
                                  <button
                                    key={s.v}
                                    type="button"
                                    onClick={() => set({ source: s.v })}
                                    aria-pressed={f.source === s.v}
                                    className={`h-9 px-3.5 text-sm ${chip(f.source === s.v, 'sol')}`}
                                  >
                                    {s.l}
                                  </button>
                                ))}
                              </div>
                            </Field>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </>
                  )}

                  {step === 2 && (
                    <>
                      <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Como fica</h2>
                      <div className={`${tile} p-4 space-y-3 text-sm`}>
                        <div className="flex justify-between gap-3">
                          <span className="text-slate-500">Prestação de {monthLong(ym)}</span>
                          <span className="font-num font-semibold text-slate-900 dark:text-white">{formatBRL(installment)}</span>
                        </div>
                        <div>
                          <div className="flex justify-between gap-3">
                            <span className="text-slate-500">Saldo depois da parcela</span>
                            <span className="font-num font-semibold text-slate-900 dark:text-white">{formatBRL(balanceAfter ?? forecast)}</span>
                          </div>
                          <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                            {balanceSource === 'fatura'
                              ? 'Calculado pelos juros e pela amortização da fatura: não precisa esperar o banco atualizar o saldo.'
                              : balanceSource === 'banco'
                                ? 'O saldo do banco que você informou neste mês.'
                                : 'Previsto. Com os juros e a amortização da fatura, o app calcula o saldo exato.'}
                          </div>
                        </div>
                        {keepExtra && (
                          <div className="flex justify-between gap-3 pt-3 border-t border-slate-200 dark:border-slate-800">
                            <span className="text-slate-500">Depois da amortização extra</span>
                            <span className="font-num font-semibold text-emerald-700 dark:text-emerald-400">{formatBRL(preview.afterExtra)}</span>
                          </div>
                        )}
                      </div>
                      {far && computed !== null && (
                        <div className="p-3 rounded-2xl bg-sol-50 dark:bg-sol-400/10 text-sm text-sol-900 dark:text-sol-100 leading-relaxed flex gap-2.5">
                          <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
                          <span>
                            Pela fatura, o saldo seria <b>{formatBRL(computed)}</b>, longe do previsto ({formatBRL(forecast)}). Confira os juros e a amortização
                            ou a taxa de juros do cadastro. Por enquanto, seguimos com a previsão.
                          </span>
                        </div>
                      )}
                      {ahead && f.scheduled && (
                        <div className="text-sm text-slate-600 dark:text-slate-400">A parcela conta como paga no dia {dueLabel}, quando o banco debitar.</div>
                      )}
                      {preview.progress > model.summary.progress && (
                        <div className="p-3 rounded-2xl bg-emerald-50 dark:bg-emerald-500/10 text-sm text-emerald-800 dark:text-emerald-200">
                          Depois deste check-in: <b>{formatPct(preview.progress * 100, 1)}</b> quitado.
                        </div>
                      )}
                    </>
                  )}
                </motion.div>
              </AnimatePresence>
            </div>

            <div className="flex justify-between gap-2 mt-6">
              {step > 0 ? (
                <button type="button" onClick={() => go(-1)} className={btnGhost}>
                  <ArrowLeft className="w-4 h-4" /> Voltar
                </button>
              ) : (
                <span />
              )}
              {step < steps.length - 1 ? (
                <button type="button" onClick={() => go(1)} className={btnPrimary} disabled={step === 0 && !(installment > 0)}>
                  Continuar <ArrowRight className="w-4 h-4" />
                </button>
              ) : (
                <button type="button" onClick={save} className={`${btnPrimary} bg-emerald-600 hover:bg-emerald-500 shadow-[0_8px_20px_-8px_rgba(5,150,105,0.8)]`}>
                  <Check className="w-4 h-4" /> Concluir check-in
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </ModalShell>
  );
};
