import React, { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { ArrowLeft, ArrowRight, Check, X } from 'lucide-react';
import { ModalShell } from './ui/ModalShell';
import { Field } from './ui/HelpTip';
import { MoneyField, MonthField } from './ui/Inputs';
import { btnGhost, btnPrimary, tile } from './ui/card';
import { celebrate } from './ui/Confetti';
import { HELP } from './help';
import { InvoiceFeesFields, draftFromFees, draftFromRow, draftTotal, feesFromDraft, type FeesDraft } from './InvoiceFeesFields';
import type { FinanceModel } from '../lib/model';
import type { AppData } from '../lib/store';
import type { ExtraMode, ExtraSource } from '../types/finance';
import { buildSchedule, summarize } from '../lib/finance';
import { currentYearMonth, formatBRL, formatPct, monthLong, monthName, uid } from '../lib/format';
import { pendingCheckinMonth } from '../lib/insights';
import { EASE_OUT } from '../lib/motion';
import { playSound } from '../hooks/useSound';

const SOURCES: { v: ExtraSource; l: string }[] = [
  { v: 'proprio', l: 'Dinheiro próprio' },
  { v: 'fgts', l: 'FGTS' },
  { v: 'decimo', l: '13º salário' },
];

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
  const [paid, setPaid] = useState(existing?.paidAmount ?? row?.payment ?? 0);
  const [balance, setBalance] = useState(existing?.balanceAfter ?? 0);
  // Faturas já informadas (cadastro e check-ins): a mais recente decide se vêm separados
  const refs = useMemo(
    () => [...(model.contract.feesRef ? [model.contract.feesRef] : []), ...(model.options.invoices ?? [])].sort((a, b) => a.yearMonth.localeCompare(b.yearMonth)),
    [model.contract.feesRef, model.options.invoices]
  );
  const lastSplit = refs.length > 0 ? refs[refs.length - 1].mip !== undefined : true;
  // Seguros do mês: os da fatura já informada, ou os previstos a partir da anterior
  const feesFor = (month: string): FeesDraft => {
    const ci = data.checkins.find((c) => c.yearMonth === month);
    return ci?.fees ? draftFromFees(ci.fees) : draftFromRow(model.rows.find((r) => r.yearMonth === month), lastSplit);
  };
  const [fees, setFees] = useState<FeesDraft>(() => feesFor(ym));
  // Amortização extra que este check-in já registrou: reabre preenchida e é alterada, não duplicada
  const extraOf = (month: string) => {
    const ci = data.checkins.find((c) => c.yearMonth === month);
    return ci?.extraId ? data.extras.find((e) => e.id === ci.extraId) : undefined;
  };
  const initialExtra = extraOf(ym);
  const [hasExtra, setHasExtra] = useState(Boolean(initialExtra));
  const [extra, setExtra] = useState(initialExtra?.amount ?? 0);
  const [mode, setMode] = useState<ExtraMode>(initialExtra?.mode ?? 'prazo');
  const [source, setSource] = useState<ExtraSource>(initialExtra?.source ?? 'proprio');
  const linkedExtra = extraOf(ym);
  // As outras amortizações (sem a deste check-in), para as prévias não contarem duas vezes
  const otherExtras = data.extras.filter((e) => e.id !== linkedExtra?.id);
  const [step, setStep] = useState(0);
  const [dir, setDir] = useState(1);
  const [done, setDone] = useState<{ before: number; after: number } | null>(null);

  // Parcela que ainda não venceu (registro adiantado)
  const ahead = Boolean(lastDueYm ? ym > lastDueYm : nextYm && ym >= nextYm);
  // Fatura de onde vêm os valores previstos deste mês (a última antes dele, ou a primeira)
  const refFor = (month: string) => [...refs].reverse().find((f) => f.yearMonth <= month) ?? refs.find((f) => f.yearMonth > month);
  const feesSource = existing?.fees ? null : refFor(ym);
  // Nenhuma fatura informada ainda: a diferença entre o pago e a parcela sem seguros quase sempre são eles
  const feesGap = refs.length === 0 && draftTotal(fees) === 0 && row ? paid - (row.amortization + row.interest) : 0;
  const showFeesGap = feesGap > 1 && row ? feesGap < row.payment * 0.2 : false;

  const changeMonth = (v: string) => {
    setYm(v);
    const r = model.rows.find((x) => x.yearMonth === v);
    const ex = data.checkins.find((c) => c.yearMonth === v);
    setPaid(ex?.paidAmount ?? r?.payment ?? 0);
    setBalance(ex?.balanceAfter ?? 0);
    setFees(feesFor(v));
    const e = extraOf(v);
    setHasExtra(Boolean(e));
    setExtra(e?.amount ?? 0);
    setMode(e?.mode ?? 'prazo');
    setSource(e?.source ?? 'proprio');
  };

  // Data deste check-in: a amortização dele entra depois de saldos informados antes,
  // e o saldo informado aqui (com a mesma data) já inclui a amortização
  const [stamp] = useState(() => new Date().toISOString());
  const extraAt = existing?.createdAt ?? stamp;

  // Estimativa do saldo do mês já com a amortização extra que a pessoa disse ter feito
  const estimate = useMemo(() => {
    if (!(hasExtra && extra > 0)) return row?.closingBalance ?? model.summary.currentBalance;
    const rows = buildSchedule(model.contract, {
      ...model.options,
      extras: [...otherExtras, { id: 'x', yearMonth: ym, amount: extra, mode, source, createdAt: extraAt }],
    });
    return rows.find((r) => r.yearMonth === ym)?.closingBalance ?? model.summary.currentBalance;
  }, [hasExtra, extra, row, model, otherExtras, ym, mode, source, extraAt]);
  const diff = balance > 0 ? balance - estimate : 0;

  const go = (d: number) => {
    playSound('tick');
    setDir(d);
    setStep((s) => s + d);
  };

  // Progresso depois de salvar, para mostrar a casa subindo
  const afterProgress = useMemo(() => {
    const checkpoints = [...data.checkpoints, ...(balance > 0 ? [{ id: 'x', yearMonth: ym, balance, source: 'banco' as const, createdAt: extraAt }] : [])];
    const extras = hasExtra && extra > 0 ? [...otherExtras, { id: 'x', yearMonth: ym, amount: extra, mode, source, createdAt: extraAt }] : otherExtras;
    const rows = buildSchedule(model.contract, { extras, checkpoints, trFor: model.trFor, invoices: model.options.invoices });
    return summarize(model.contract, rows).progress;
  }, [data.checkpoints, otherExtras, balance, ym, hasExtra, extra, mode, source, extraAt, model.contract, model.trFor]);

  const save = () => {
    const before = model.summary.progress;
    const keepExtra = hasExtra && extra > 0;
    const extraId = keepExtra ? linkedExtra?.id ?? uid() : undefined;
    const invoice = feesFromDraft(fees);
    update((prev) => ({
      ...prev,
      checkins: [
        ...prev.checkins.filter((c) => c.yearMonth !== ym),
        {
          id: existing?.id ?? uid(),
          yearMonth: ym,
          paidAmount: paid,
          balanceAfter: balance > 0 ? balance : undefined,
          ...(extraId ? { extraId } : {}),
          ...(invoice ? { fees: invoice } : {}),
          createdAt: extraAt,
        },
      ],
      // Troca (ou remove) a amortização deste check-in; as outras ficam como estão
      extras: [
        ...prev.extras.filter((e) => e.id !== linkedExtra?.id),
        ...(keepExtra && extraId ? [{ id: extraId, yearMonth: ym, amount: extra, mode, source, createdAt: extraAt }] : []),
      ],
    }));
    setDone({ before, after: afterProgress });
    playSound('celebrate');
    window.setTimeout(() => celebrate(), 150);
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const steps = ['Parcela', 'Seguros', 'Extra', 'Saldo'];

  return (
    <ModalShell
      ariaLabel="Check-in do mês"
      panelClassName="bg-white dark:bg-slate-900 rounded-[28px] w-full max-w-xl shadow-2xl ring-1 ring-slate-900/[0.06] dark:ring-white/[0.08] overflow-hidden"
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
              {done.after > done.before
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
            <div className="flex gap-1.5 mt-3 mb-6 pr-10">
              {steps.map((s, k) => (
                <div key={s} className="flex-1">
                  <div className="h-1.5 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                    <motion.div className="h-full bg-anil-500 rounded-full" initial={false} animate={{ width: k <= step ? '100%' : '0%' }} transition={{ duration: 0.35, ease: EASE_OUT }} />
                  </div>
                  <div className={`text-xs mt-1.5 font-semibold ${k === step ? 'text-slate-900 dark:text-white' : 'text-slate-400'}`}>{s}</div>
                </div>
              ))}
            </div>

            <div className="relative min-h-[330px] overflow-x-clip">
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
                      <h2 className="text-2xl font-bold text-slate-900 dark:text-white">
                        {ahead ? `Parcela de ${monthName(ym)}, adiantada` : `Quanto você pagou em ${monthName(ym)}?`}
                      </h2>
                      {ahead && (
                        <p className="-mt-3 text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                          Ela vence dia {String(model.contract.dueDay).padStart(2, '0')}/{ym.slice(5)}. Registre agora se já pagou ou se está agendada no débito automático.
                        </p>
                      )}
                      <Field label="Mês da parcela">
                        <MonthField
                          value={ym}
                          onChange={changeMonth}
                          ariaLabel="Mês da parcela"
                          min={model.contract.firstDueMonth}
                          max={maxYm}
                          marked={checkedMonths}
                          markedLabel="check-in feito"
                        />
                      </Field>
                      <Field
                        label="Valor pago"
                        hint="Já preenchemos com o valor previsto. Se o boleto veio diferente, corrija."
                        help={{ title: 'Valor pago', body: 'O valor total do boleto ou do débito em conta, com seguros e taxas.', where: 'No comprovante de pagamento ou no extrato da conta.' }}
                      >
                        <MoneyField value={paid} onChange={setPaid} />
                      </Field>
                      {row && (
                        <div className={`${tile} p-4 grid grid-cols-3 gap-2 text-sm`}>
                          <div>
                            <div className="text-xs text-slate-500">Abate a dívida</div>
                            <div className="font-num font-semibold text-slate-900 dark:text-white">{formatBRL(row.amortization)}</div>
                          </div>
                          <div>
                            <div className="text-xs text-slate-500">Juros</div>
                            <div className="font-num font-semibold text-slate-900 dark:text-white">{formatBRL(row.interest)}</div>
                          </div>
                          <div>
                            <div className="text-xs text-slate-500">Seguros e taxa</div>
                            <div className="font-num font-semibold text-slate-900 dark:text-white">{formatBRL(draftTotal(fees))}</div>
                          </div>
                        </div>
                      )}
                    </>
                  )}

                  {step === 1 && (
                    <>
                      <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Seguros e taxa da fatura</h2>
                      <p className="-mt-3 text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                        {existing?.fees
                          ? 'Os valores que você informou neste check-in.'
                          : feesSource?.yearMonth === ym
                            ? 'Os valores da fatura informada no cadastro. Confira e corrija o que vier diferente.'
                            : feesSource
                            ? `Já preenchemos com a fatura de ${monthName(feesSource.yearMonth)}, corrigida: o MIP acompanha o saldo e o DFI, a TR. Confira na fatura e corrija o que vier diferente.`
                            : 'Copie do detalhe da parcela no app do banco. A partir destes valores o app prevê as próximas faturas.'}
                      </p>
                      <InvoiceFeesFields value={fees} onChange={setFees} />
                      {/* Sem nenhuma fatura ainda, a diferença para o valor pago quase sempre são os seguros e a taxa */}
                      {showFeesGap && (
                        <div className="p-3 rounded-2xl bg-sol-50 dark:bg-sol-400/10 text-sm text-sol-900 dark:text-sol-100 leading-relaxed">
                          Faltam <b>{formatBRL(feesGap)}</b> para chegar ao valor pago. Quase sempre são os seguros (MIP e DFI) e a taxa de administração.
                          <button
                            type="button"
                            onClick={() => {
                              setFees({ ...fees, split: false, insurance: Math.round(feesGap * 100) / 100, adminFee: 0 });
                              playSound('success');
                            }}
                            className="mt-2 flex items-center gap-1.5 h-8 px-3 rounded-full bg-sol-400 hover:bg-sol-300 text-slate-900 text-xs font-bold cursor-pointer"
                          >
                            Usar {formatBRL(feesGap)} como total dos seguros
                          </button>
                        </div>
                      )}
                    </>
                  )}

                  {step === 3 && (
                    <>
                      <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Quanto o banco diz que falta?</h2>
                      <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                        Opcional, mas é o que deixa o app exato. Abra o app do banco e copie o saldo devedor de agora
                        {hasExtra && extra > 0 ? ', que já inclui a amortização extra' : ''}.
                      </p>
                      <Field label="Saldo devedor" help={HELP.currentBalance} optional>
                        <MoneyField value={balance} onChange={setBalance} />
                      </Field>
                      <div className={`${tile} p-4 text-sm`}>
                        <div className="flex justify-between">
                          <span className="text-slate-500">Nossa estimativa para {monthLong(ym)}</span>
                          <span className="font-num font-semibold text-slate-900 dark:text-white">{formatBRL(estimate)}</span>
                        </div>
                        <AnimatePresence>
                          {balance > 0 && (
                            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}>
                              <div className="flex justify-between mt-2 pt-2 border-t border-slate-200 dark:border-slate-800">
                                <span className="text-slate-500">Diferença</span>
                                <span className={`font-num font-semibold ${Math.abs(diff) < estimate * 0.01 ? 'text-emerald-600 dark:text-emerald-400' : 'text-sol-700 dark:text-sol-300'}`}>
                                  {diff >= 0 ? '+' : '−'}
                                  {formatBRL(Math.abs(diff))}
                                </span>
                              </div>
                              <div className="text-xs text-slate-500 mt-1.5">
                                {Math.abs(diff) < estimate * 0.01
                                  ? 'Bem perto! A partir de agora usamos o valor do banco.'
                                  : 'Diferenças acontecem por TR, seguros ou arredondamentos. A partir de agora usamos o valor do banco.'}
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    </>
                  )}

                  {step === 2 && (
                    <>
                      <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Pagou algo a mais este mês?</h2>
                      <div className="flex gap-2">
                        {[
                          { v: false, l: 'Não, só a parcela' },
                          { v: true, l: 'Sim, amortizei' },
                        ].map((o) => (
                          <button
                            key={o.l}
                            type="button"
                            onClick={() => setHasExtra(o.v)}
                            aria-pressed={hasExtra === o.v}
                            className={`h-10 px-4 rounded-full text-sm font-semibold cursor-pointer transition-colors ${
                              hasExtra === o.v ? 'bg-anil-600 text-white' : 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200'
                            }`}
                          >
                            {o.l}
                          </button>
                        ))}
                      </div>
                      <AnimatePresence>
                        {hasExtra && (
                          <motion.div className="space-y-4" initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }}>
                            <Field label="Valor amortizado">
                              <MoneyField value={extra} onChange={setExtra} />
                            </Field>
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
                                  <button
                                    key={m}
                                    type="button"
                                    onClick={() => setMode(m)}
                                    aria-pressed={mode === m}
                                    className={`h-10 px-4 rounded-full text-sm font-semibold cursor-pointer ${
                                      mode === m ? 'bg-anil-600 text-white' : 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200'
                                    }`}
                                  >
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
                                    onClick={() => setSource(s.v)}
                                    aria-pressed={source === s.v}
                                    className={`h-9 px-3.5 rounded-full text-sm font-semibold cursor-pointer ${
                                      source === s.v ? 'bg-sol-400 text-slate-900' : 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200'
                                    }`}
                                  >
                                    {s.l}
                                  </button>
                                ))}
                              </div>
                            </Field>
                          </motion.div>
                        )}
                      </AnimatePresence>
                      {afterProgress > model.summary.progress && (
                        <div className="p-3 rounded-2xl bg-emerald-50 dark:bg-emerald-500/10 text-sm text-emerald-800 dark:text-emerald-200">
                          Depois deste check-in: <b>{formatPct(afterProgress * 100, 1)}</b> quitado.
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
                <button type="button" onClick={() => go(1)} className={btnPrimary} disabled={step === 0 && !(paid > 0)}>
                  Continuar <ArrowRight className="w-4 h-4" />
                </button>
              ) : (
                <button type="button" onClick={save} className={`${btnPrimary} bg-emerald-600 hover:bg-emerald-500 shadow-[0_8px_20px_-8px_rgba(5,150,105,0.8)]`}>
                  <Check className="w-4 h-4" /> {balance > 0 ? 'Concluir check-in' : 'Concluir sem o saldo'}
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </ModalShell>
  );
};
