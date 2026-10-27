import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { BadgeCheck, CalendarCheck2, Info, Landmark, Pencil, Plus, Trash2, Wallet } from 'lucide-react';
import type { ScreenProps } from './types';
import { PageHeader } from '../components/ui/PageHeader';
import { SegmentedControl } from '../components/ui/SegmentedControl';
import { Field } from '../components/ui/HelpTip';
import { MoneyField, MonthField, NumberField } from '../components/ui/Inputs';
import { btnGhost, btnPrimary, card } from '../components/ui/card';
import { HELP } from '../components/help';
import { currentYearMonth, formatBRL, monthLong, monthName, monthShort, uid } from '../lib/format';
import { EASE_OUT } from '../lib/motion';
import { playSound } from '../hooks/useSound';
import type { ExtraMode, ExtraSource } from '../types/finance';
import { ExtraPaymentFields, draftFromExtra, extraEffective, type ExtraDraft } from '../components/ExtraPaymentFields';
import { lastDueBefore } from '../lib/finance';

type Tab = 'table' | 'records';
type AddKind = 'banco' | 'extra' | null;

export const HistoryScreen: React.FC<ScreenProps> = ({ model, data, update, openCheckin, historyTab }) => {
  const { rows, summary } = model;
  const [tab, setTab] = useState<Tab>(historyTab ?? 'table');
  // O saldo que o banco mostra hoje é o de depois da última parcela paga
  const paidYm = model.summary.paidCount > 0 ? model.rows[model.summary.paidCount - 1].yearMonth : model.contract.firstDueMonth;
  const years = useMemo(() => Array.from(new Set(rows.map((r) => r.yearMonth.slice(0, 4)))), [rows]);
  const currentYear = (summary.next?.yearMonth ?? rows[rows.length - 1]?.yearMonth ?? currentYearMonth()).slice(0, 4);
  const [year, setYear] = useState(years.includes(currentYear) ? currentYear : years[0]);
  // O ano escolhido sempre à vista no trilho
  const yearsRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = yearsRef.current?.querySelector<HTMLElement>('[aria-pressed="true"]');
    el?.scrollIntoView({ block: 'nearest', inline: 'center', behavior: 'smooth' });
  }, [year, tab]);
  // A roda do mouse (vertical) rola os anos de lado, sem rolar a página junto
  useEffect(() => {
    const el = yearsRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      if (Math.abs(e.deltaY) <= Math.abs(e.deltaX) || el.scrollWidth <= el.clientWidth) return;
      e.preventDefault();
      el.scrollLeft += e.deltaY;
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [tab]);
  const checkinMonths = new Set(data.checkins.map((c) => c.yearMonth));
  const balanceMonths = new Set(data.checkpoints.map((c) => c.yearMonth));
  const yearRows = rows.filter((r) => r.yearMonth.startsWith(year));
  // Parcelas já pagas (e a próxima) ainda sem a TR oficial do Banco Central
  // Parcelas pagas antes do primeiro dado real (fatura ou saldo do banco): só pelo contrato
  const firstRealYm = rows.find((r) => !r.estimated)?.yearMonth;
  const estimatedPaid = rows.filter((r) => r.estimated && r.index <= summary.paidCount).length;
  const lastEstimatedYm = firstRealYm ? rows[rows.findIndex((r) => r.yearMonth === firstRealYm) - 1]?.yearMonth : undefined;
  // A TR estimada só importa nas parcelas que já seguem dados reais
  const trEstimatedCount = rows.filter((r) => r.trEstimated && !r.estimated && r.index <= summary.paidCount + 1).length;
  const yearTotals = yearRows.reduce(
    (a, r) => ({ paid: a.paid + r.payment + r.extra, interest: a.interest + r.interest, amort: a.amort + r.amortization + r.extra }),
    { paid: 0, interest: 0, amort: 0 }
  );

  // Formulário rápido de registro (novo ou editando um já salvo)
  const [adding, setAdding] = useState<AddKind>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formYm, setFormYm] = useState(currentYearMonth());
  const [formValue, setFormValue] = useState(0);
  // Saldo do banco: as parcelas que faltam junto (opcional) acertam o prazo de quem já amortizou
  const [formRemaining, setFormRemaining] = useState(0);
  const [formMode, setFormMode] = useState<ExtraMode>('prazo');
  const [formSource, setFormSource] = useState<ExtraSource>('proprio');
  // Amortização extra: valor pago, data e efetiva (como no check-in)
  const [extraDraft, setExtraDraft] = useState<ExtraDraft>(() => draftFromExtra(model.contract, undefined));
  const extraEff = extraEffective(model.contract, extraDraft);
  const closeForm = () => {
    setAdding(null);
    setEditingId(null);
  };
  const openAdd = (k: AddKind) => {
    playSound('tick');
    setAdding(k);
    setEditingId(null);
    setFormValue(0);
    setFormRemaining(0);
    setFormMode('prazo');
    setFormSource('proprio');
    setExtraDraft(draftFromExtra(model.contract, undefined));
    setFormYm(k === 'banco' ? paidYm : currentYearMonth());
  };
  const saveAdd = () => {
    if (!adding) return;
    if (adding === 'extra') {
      if (!(extraEff > 0)) return;
      const id = editingId ?? uid();
      // Entra depois da última parcela vencida até a data do pagamento
      const due = lastDueBefore(model.contract, extraDraft.date).yearMonth;
      const yearMonth = due < model.contract.firstDueMonth ? model.contract.firstDueMonth : due;
      update((prev) => {
        // Editar não muda quando o pagamento foi lançado
        const createdAt = prev.extras.find((e) => e.id === id)?.createdAt ?? new Date().toISOString();
        return {
          ...prev,
          extras: [
            ...prev.extras.filter((e) => e.id !== id),
            { id, yearMonth, amount: extraEff, paid: extraDraft.paid > 0 ? extraDraft.paid : extraEff, date: extraDraft.date, mode: formMode, source: formSource, createdAt },
          ],
        };
      });
    } else {
      if (!(formValue > 0)) return;
      update((prev) => ({
        ...prev,
        checkpoints: [
          // Um saldo por mês e origem: o editado sai, e outro do mesmo mês e origem é substituído
          ...prev.checkpoints.filter((c) => c.id !== editingId && !(c.yearMonth === formYm && c.source === adding)),
          {
            id: editingId ?? uid(),
            yearMonth: formYm,
            balance: formValue,
            ...(formRemaining > 0 ? { remaining: Math.round(formRemaining) } : {}),
            source: adding,
            createdAt: new Date().toISOString(),
          },
        ],
      }));
    }
    playSound('success');
    closeForm();
  };

  type Rec = { id: string; ym: string; kind: 'checkin' | 'extra' | 'banco'; title: string; value: number; detail?: string };
  const records: Rec[] = [
    ...data.checkins.map((c) => ({
      id: c.id,
      ym: c.yearMonth,
      kind: 'checkin' as const,
      title: 'Check-in',
      value: c.paidAmount,
      detail: c.balanceAfter
        ? `saldo depois: ${formatBRL(c.balanceAfter)}${c.balanceSource === 'fatura' ? ' (pela fatura)' : ''}`
        : c.scheduled
          ? 'agendada no débito'
          : 'parcela paga',
    })),
    ...data.extras.map((e) => ({
      id: e.id,
      ym: e.yearMonth,
      kind: 'extra' as const,
      title: e.source === 'fgts' ? 'Amortização com FGTS' : e.source === 'decimo' ? 'Amortização com 13º' : 'Amortização extra',
      value: e.amount,
      detail: `${e.paid && e.paid > e.amount + 0.005 ? `pagou ${formatBRL(e.paid)}, ` : ''}${e.mode === 'prazo' ? 'reduziu o prazo' : 'reduziu a parcela'}`,
    })),
    ...data.checkpoints.map((c) => ({
      id: c.id,
      ym: c.yearMonth,
      kind: c.source,
      title: 'Saldo do banco',
      value: c.balance,
      detail: c.remaining ? `saldo devedor real, faltam ${c.remaining} parcelas` : 'saldo devedor real',
    })),
  ].sort((a, b) => b.ym.localeCompare(a.ym));

  const editRecord = (r: Rec) => {
    if (r.kind === 'checkin') {
      openCheckin(r.ym);
      return;
    }
    playSound('tick');
    const extra = r.kind === 'extra' ? data.extras.find((e) => e.id === r.id) : undefined;
    setAdding(r.kind);
    setEditingId(r.id);
    setFormYm(r.ym);
    setFormValue(r.value);
    setFormRemaining(r.kind === 'banco' ? data.checkpoints.find((c) => c.id === r.id)?.remaining ?? 0 : 0);
    setFormMode(extra?.mode ?? 'prazo');
    setFormSource(extra?.source ?? 'proprio');
    if (extra) setExtraDraft(draftFromExtra(model.contract, extra));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const removeRecord = (r: Rec) => {
    if (r.id === editingId) closeForm();
    update((prev) => ({
      ...prev,
      checkins:
        r.kind === 'checkin'
          ? prev.checkins.filter((c) => c.id !== r.id)
          : r.kind === 'extra'
            ? prev.checkins.map((c) => (c.extraId === r.id ? { ...c, extraId: undefined } : c))
            : prev.checkins,
      extras: r.kind === 'extra' ? prev.extras.filter((e) => e.id !== r.id) : prev.extras,
      checkpoints: r.kind === 'banco' ? prev.checkpoints.filter((c) => c.id !== r.id) : prev.checkpoints,
    }));
    playSound('delete');
  };

  const kindIcon = { checkin: CalendarCheck2, extra: Wallet, banco: Landmark } as const;
  const kindTone = {
    checkin: 'bg-anil-100 text-anil-700 dark:bg-anil-500/15 dark:text-anil-300',
    extra: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300',
    banco: 'bg-sky-100 text-sky-700 dark:bg-sky-500/15 dark:text-sky-300',
  } as const;

  return (
    <div className="space-y-6 page-stagger">
      <PageHeader
        context="Acompanhar"
        title="Parcelas mês a mês"
        description="A tabela completa do seu financiamento e tudo o que você já registrou."
        actions={
          <div data-tour="hist-abas">
          <SegmentedControl
            ariaLabel="Ver"
            layoutId="hist-tab"
            value={tab}
            onChange={setTab}
            className="w-72"
            options={[
              { value: 'table', label: 'Tabela' },
              { value: 'records', label: `Registros (${records.length})` },
            ]}
          />
          </div>
        }
      />

      {tab === 'table' ? (
        <>
          {/* Anos num trilho, como os outros seletores: soltos no fundo pareciam texto */}
          <div
            data-tour="hist-anos"
            className="rounded-full bg-white border border-slate-200 shadow-[0_1px_2px_rgba(30,34,80,0.06)] dark:bg-slate-900 dark:border-white/[0.06] dark:shadow-none"
          >
          <div
            ref={yearsRef}
            className="flex gap-1 overflow-x-auto p-1 px-3 scroll-quiet fade-edges"
          >
            {years.map((y) => (
              <button
                key={y}
                type="button"
                aria-pressed={y === year}
                onClick={() => {
                  playSound('tick');
                  setYear(y);
                }}
                className={`relative h-9 px-3.5 rounded-full text-sm font-num font-semibold shrink-0 cursor-pointer transition-colors ${
                  y === year ? 'text-white' : 'text-slate-600 dark:text-slate-300 hover:bg-anil-50 hover:text-anil-700 dark:hover:bg-slate-800 dark:hover:text-white'
                }`}
              >
                {y === year && <motion.span layoutId="year-pill" className="absolute inset-0 rounded-full bg-anil-600" transition={{ type: 'spring', stiffness: 420, damping: 34 }} />}
                <span className="relative">{y}</span>
              </button>
            ))}
          </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            {[
              { l: `Parcelas de ${year}`, v: yearTotals.paid },
              { l: 'Abate a dívida', v: yearTotals.amort },
              { l: 'Vai para juros', v: yearTotals.interest },
            ].map((s) => (
              <div key={s.l} className={`${card} p-4`}>
                <div className="text-xs text-slate-500 dark:text-slate-400">{s.l}</div>
                <div className="font-display text-xl font-bold text-slate-900 dark:text-white mt-0.5 tabular-nums">{formatBRL(s.v)}</div>
              </div>
            ))}
          </div>

          {/* Estimado x real, em palavras simples: o que o app sabe e o que ainda é conta do contrato */}
          {estimatedPaid > 0 && (
            <div className="p-4 rounded-2xl bg-anil-50 dark:bg-anil-500/10 text-sm text-anil-900 dark:text-anil-100 leading-relaxed flex gap-3">
              <Info className="w-5 h-5 shrink-0 mt-0.5 text-anil-600 dark:text-anil-300" />
              <div>
                {firstRealYm && lastEstimatedYm ? (
                  <>
                    <b>Até {monthLong(lastEstimatedYm)}, as parcelas são estimadas</b> pelo contrato: o app não sabe das amortizações feitas antes de você
                    começar a usá-lo. A partir de {monthLong(firstRealYm)}, os valores seguem a sua fatura ou o saldo do banco, e o saldo de hoje e as próximas
                    parcelas já estão certos.
                    <button
                      type="button"
                      onClick={() => setTab('records')}
                      className="mt-1.5 block font-semibold text-anil-700 dark:text-anil-300 hover:underline cursor-pointer"
                    >
                      Quer o histórico exato? Lance as amortizações antigas em Registros
                    </button>
                  </>
                ) : (
                  <>
                    <b>Por enquanto, todas as parcelas são estimadas</b> pelo contrato. Se você já amortizou, o saldo, o número de parcelas e o valor delas
                    podem estar diferentes dos do banco. Faça o check-in com a sua última fatura: o app acerta tudo daqui para frente.
                    <div className="mt-2.5">
                      <button type="button" onClick={() => openCheckin()} className={`${btnPrimary} h-9`}>
                        <CalendarCheck2 className="w-4 h-4" /> Fazer check-in
                      </button>
                    </div>
                  </>
                )}
              </div>
            </div>
          )}

          {trEstimatedCount > 0 && (
            <div className="p-3.5 rounded-2xl bg-sol-50 dark:bg-sol-400/10 text-sm text-sol-900 dark:text-sol-100 leading-relaxed">
              A TR de <b>{trEstimatedCount} {trEstimatedCount === 1 ? 'parcela' : 'parcelas'}</b> ainda é estimada: falta buscar no Banco Central a TR
              oficial até o dia do vencimento. Até lá vale a TR do mês, que fica bem perto. O app tenta de novo sozinho e troca assim que conseguir.
            </div>
          )}

          <div data-tour="hist-tabela" className={`${card} overflow-hidden`}>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-slate-500 dark:text-slate-400 border-b border-slate-900/[0.06] dark:border-white/[0.06]">
                    <th className="font-semibold px-5 py-3">Parcela</th>
                    <th className="font-semibold px-3 py-3">Mês</th>
                    <th className="font-semibold px-3 py-3 text-right">Valor</th>
                    <th className="font-semibold px-3 py-3 text-right">Amortização</th>
                    <th className="font-semibold px-3 py-3 text-right">Juros</th>
                    <th className="font-semibold px-3 py-3 text-right">TR</th>
                    <th className="font-semibold px-3 py-3 text-right">Seguros</th>
                    <th className="font-semibold px-5 py-3 text-right">Saldo depois</th>
                  </tr>
                </thead>
                <motion.tbody key={year} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.3 }}>
                  {yearRows.map((r) => {
                    const paid = r.index <= summary.paidCount;
                    const isNext = r.index === summary.paidCount + 1;
                    const estimated = paid && r.estimated;
                    return (
                      <React.Fragment key={r.index}>
                      {/* Divisa entre o estimado pelo contrato e o que já segue dados reais */}
                      {r.yearMonth === firstRealYm && estimatedPaid > 0 && (
                        <tr>
                          <td colSpan={8} className="px-5 py-2 bg-emerald-50/70 dark:bg-emerald-500/[0.07] text-xs font-semibold text-emerald-800 dark:text-emerald-300">
                            A partir daqui: valores reais, da fatura ou do saldo do banco
                          </td>
                        </tr>
                      )}
                      <tr
                        className={`border-b last:border-0 border-slate-900/[0.04] dark:border-white/[0.04] ${
                          isNext ? 'bg-sol-50/70 dark:bg-sol-400/[0.07]' : paid ? '' : 'text-slate-500 dark:text-slate-400'
                        }`}
                      >
                        <td className="px-5 py-2.5">
                          <span className="inline-flex items-center gap-2">
                            <span className="font-num font-semibold text-slate-900 dark:text-white">{r.index}</span>
                            {paid && checkinMonths.has(r.yearMonth) && <BadgeCheck className="w-4 h-4 text-emerald-500" aria-label="Check-in feito" />}
                            {isNext && <span className="px-1.5 py-0.5 rounded-full bg-sol-400 text-slate-900 text-[10px] font-bold">próxima</span>}
                            {estimated && (
                              <span
                                className="px-1.5 py-0.5 rounded-full bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400 text-[10px] font-semibold"
                                title="Calculada só pelo contrato, sem as amortizações feitas antes de você usar o app"
                              >
                                estimada
                              </span>
                            )}
                          </span>
                        </td>
                        <td className="px-3 py-2.5 capitalize">{monthShort(r.yearMonth)}</td>
                        <td className="px-3 py-2.5 text-right font-num font-semibold text-slate-900 dark:text-white">{formatBRL(r.payment)}</td>
                        <td className="px-3 py-2.5 text-right font-num">
                          {formatBRL(r.amortization)}
                          {r.extra > 0 && <div className="text-[11px] text-emerald-600 dark:text-emerald-400 font-semibold">+ {formatBRL(r.extra)} extra</div>}
                        </td>
                        <td className="px-3 py-2.5 text-right font-num">{formatBRL(r.interest)}</td>
                        <td className="px-3 py-2.5 text-right font-num">
                          {r.correction > 0 ? formatBRL(r.correction) : '—'}
                          {r.trEstimated && !r.estimated && r.index <= summary.paidCount + 1 && (
                            <div className="text-[11px] text-sol-700 dark:text-sol-300 font-semibold" title="Ainda sem a TR oficial do Banco Central">
                              estimada
                            </div>
                          )}
                        </td>
                        <td className="px-3 py-2.5 text-right font-num">
                          {formatBRL(r.fees)}
                          {r.feesFromInvoice && <div className="text-[11px] text-sky-600 dark:text-sky-400 font-semibold">da fatura</div>}
                        </td>
                        <td className="px-5 py-2.5 text-right font-num font-semibold text-slate-900 dark:text-white">
                          {formatBRL(r.closingBalance)}
                          {r.checkpoint && (
                            <div className="text-[11px] text-sky-600 dark:text-sky-400 font-semibold">
                              {r.checkpoint === 'fatura' ? 'pela fatura' : 'valor do banco'}
                            </div>
                          )}
                        </td>
                      </tr>
                      </React.Fragment>
                    );
                  })}
                </motion.tbody>
              </table>
            </div>
          </div>
        </>
      ) : (
        <>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => openCheckin()} className={btnPrimary}>
              <CalendarCheck2 className="w-4 h-4" /> Fazer check-in
            </button>
            <button type="button" onClick={() => openAdd('banco')} className={btnGhost}>
              <Landmark className="w-4 h-4" /> Saldo do banco
            </button>
            <button type="button" onClick={() => openAdd('extra')} className={btnGhost}>
              <Plus className="w-4 h-4" /> Amortização extra
            </button>
          </div>

          <AnimatePresence>
            {adding && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.3, ease: EASE_OUT }}
                className="overflow-hidden"
              >
                <div className={`${card} p-5 lg:p-6`}>
                  <h3 className="font-display text-lg font-bold text-slate-900 dark:text-white">
                    {editingId
                      ? adding === 'extra'
                        ? 'Editar amortização extra'
                        : 'Editar saldo devedor do banco'
                      : adding === 'extra'
                        ? 'Registrar amortização extra'
                        : 'Saldo devedor do banco'}
                  </h3>
                  {adding === 'extra' ? (
                    <div className="mt-4 space-y-4 max-w-3xl">
                      <ExtraPaymentFields contract={model.contract} value={extraDraft} onChange={setExtraDraft} showMonth />
                      <div className="flex flex-wrap gap-x-6 gap-y-4">
                        <Field label="De onde veio o dinheiro">
                          <SegmentedControl
                            ariaLabel="De onde veio o dinheiro"
                            layoutId="add-source"
                            value={formSource}
                            onChange={setFormSource}
                            className="w-64"
                            options={[
                              { value: 'proprio', label: 'Próprio' },
                              { value: 'fgts', label: 'FGTS' },
                              { value: 'decimo', label: '13º' },
                            ]}
                          />
                        </Field>
                        <Field label="O que você reduziu">
                          <SegmentedControl
                            ariaLabel="O que você reduziu"
                            layoutId="add-mode"
                            value={formMode}
                            onChange={setFormMode}
                            className="w-52"
                            options={[
                              { value: 'prazo', label: 'Prazo' },
                              { value: 'parcela', label: 'Parcela' },
                            ]}
                          />
                        </Field>
                      </div>
                    </div>
                  ) : (
                    <div className="mt-4 max-w-3xl">
                      {/* Três colunas iguais com os rótulos numa linha; a explicação fica uma só, embaixo */}
                      <div className="grid sm:grid-cols-3 gap-4 items-start">
                        <Field label="Depois da parcela de">
                          <MonthField
                            value={formYm}
                            onChange={setFormYm}
                            ariaLabel="Saldo depois da parcela de"
                            min={model.contract.firstDueMonth}
                            max={paidYm > currentYearMonth() ? paidYm : currentYearMonth()}
                            marked={balanceMonths}
                            markedLabel="saldo registrado"
                          />
                        </Field>
                        <Field label="Saldo devedor" help={HELP.currentBalance}>
                          <MoneyField value={formValue} onChange={setFormValue} ariaLabel="Saldo devedor" />
                        </Field>
                        <Field label="Parcelas que faltam" help={HELP.remaining} optional>
                          <NumberField value={formRemaining} onChange={setFormRemaining} digits={0} ariaLabel="Parcelas que faltam" />
                        </Field>
                      </div>
                      <p className="mt-2.5 text-xs leading-relaxed text-slate-500 dark:text-slate-400">
                        {formYm === paidYm
                          ? `${monthName(formYm)[0].toUpperCase()}${monthName(formYm).slice(1)} foi a última parcela paga: copie o saldo e o prazo que o app do banco mostra agora, no mesmo dia. O saldo muda um pouco a cada dia pela TR, e o app usa a data de hoje para descontar isso.`
                          : `Use o saldo e o prazo que o banco mostrava logo depois da parcela de ${monthLong(formYm)}.`}{' '}
                        As parcelas que faltam são opcionais e acertam o prazo de quem já amortizou.
                      </p>
                    </div>
                  )}
                  <div className="flex gap-2 mt-5">
                    <button type="button" onClick={saveAdd} disabled={adding === 'extra' ? !(extraEff > 0) : !(formValue > 0)} className={btnPrimary}>
                      {editingId ? 'Salvar alteração' : 'Salvar'}
                    </button>
                    <button type="button" onClick={closeForm} className={btnGhost}>
                      Cancelar
                    </button>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {records.length === 0 ? (
            <div className={`${card} p-10 text-center`}>
              <CalendarCheck2 className="w-10 h-10 mx-auto text-anil-400" />
              <h3 className="font-display text-xl font-bold text-slate-900 dark:text-white mt-3">Nenhum registro ainda</h3>
              <p className="text-slate-500 dark:text-slate-400 mt-1 max-w-md mx-auto">
                Faça o check-in da parcela deste mês. Leva menos de um minuto e já deixa os números mais próximos dos do banco.
              </p>
              <button type="button" onClick={() => openCheckin()} className={`${btnPrimary} mt-5`}>
                Fazer o primeiro check-in
              </button>
            </div>
          ) : (
            <ul className={`${card} divide-y divide-slate-900/[0.05] dark:divide-white/[0.05] overflow-hidden`}>
              <AnimatePresence initial={false}>
                {records.map((r) => {
                  const Icon = kindIcon[r.kind];
                  return (
                    <motion.li
                      key={`${r.kind}-${r.id}`}
                      layout
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: 30, height: 0 }}
                      className="group flex items-center gap-4 px-5 py-3.5"
                    >
                      <span className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${kindTone[r.kind]}`}>
                        <Icon className="w-5 h-5" />
                      </span>
                      <div className="flex-1 min-w-0">
                        <div className="font-semibold text-slate-900 dark:text-white">{r.title}</div>
                        <div className="text-sm text-slate-500 dark:text-slate-400">
                          {monthLong(r.ym)}
                          {r.detail ? `, ${r.detail}` : ''}
                        </div>
                      </div>
                      <div className="font-num font-bold text-slate-900 dark:text-white">{formatBRL(r.value)}</div>
                      <button
                        type="button"
                        onClick={() => editRecord(r)}
                        aria-label={`Editar ${r.title} de ${monthLong(r.ym)}`}
                        title="Editar"
                        className="w-9 h-9 -mr-2 rounded-full flex items-center justify-center text-slate-400 hover:text-anil-600 hover:bg-anil-50 dark:hover:bg-anil-500/10 opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity cursor-pointer"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => removeRecord(r)}
                        aria-label={`Excluir ${r.title} de ${monthLong(r.ym)}`}
                        title="Excluir"
                        className="w-9 h-9 rounded-full flex items-center justify-center text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-500/10 opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity cursor-pointer"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </motion.li>
                  );
                })}
              </AnimatePresence>
            </ul>
          )}
        </>
      )}
    </div>
  );
};

