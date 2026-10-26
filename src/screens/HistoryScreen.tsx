import React, { useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { BadgeCheck, CalendarCheck2, FileText, Landmark, Pencil, Plus, Trash2, Wallet } from 'lucide-react';
import type { ScreenProps } from './types';
import { PageHeader } from '../components/ui/PageHeader';
import { SegmentedControl } from '../components/ui/SegmentedControl';
import { Field } from '../components/ui/HelpTip';
import { MoneyField, MonthField } from '../components/ui/Inputs';
import { btnGhost, btnPrimary, card, tile } from '../components/ui/card';
import { HELP } from '../components/help';
import { currentYearMonth, formatBRL, monthLong, monthShort, uid } from '../lib/format';
import { EASE_OUT } from '../lib/motion';
import { playSound } from '../hooks/useSound';
import type { ExtraMode, ExtraSource } from '../types/finance';

type Tab = 'table' | 'records';
type AddKind = 'banco' | 'ir' | 'extra' | null;

export const HistoryScreen: React.FC<ScreenProps> = ({ model, data, update, openCheckin }) => {
  const { rows, summary } = model;
  const [tab, setTab] = useState<Tab>('table');
  const years = useMemo(() => Array.from(new Set(rows.map((r) => r.yearMonth.slice(0, 4)))), [rows]);
  const currentYear = (summary.next?.yearMonth ?? rows[rows.length - 1]?.yearMonth ?? currentYearMonth()).slice(0, 4);
  const [year, setYear] = useState(years.includes(currentYear) ? currentYear : years[0]);
  const checkinMonths = new Set(data.checkins.map((c) => c.yearMonth));
  const extraMonths = new Set(data.extras.map((e) => e.yearMonth));
  const balanceMonths = new Set(data.checkpoints.map((c) => c.yearMonth));
  const yearRows = rows.filter((r) => r.yearMonth.startsWith(year));
  // Parcelas já pagas (e a próxima) ainda sem a TR oficial do Banco Central
  const trEstimatedCount = rows.filter((r) => r.trEstimated && r.index <= summary.paidCount + 1).length;
  const yearTotals = yearRows.reduce(
    (a, r) => ({ paid: a.paid + r.payment + r.extra, interest: a.interest + r.interest, amort: a.amort + r.amortization + r.extra }),
    { paid: 0, interest: 0, amort: 0 }
  );

  // Formulário rápido de registro (novo ou editando um já salvo)
  const [adding, setAdding] = useState<AddKind>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formYm, setFormYm] = useState(currentYearMonth());
  const [formValue, setFormValue] = useState(0);
  const [formMode, setFormMode] = useState<ExtraMode>('prazo');
  const [formSource, setFormSource] = useState<ExtraSource>('proprio');
  const closeForm = () => {
    setAdding(null);
    setEditingId(null);
  };
  const openAdd = (k: AddKind) => {
    playSound('tick');
    setAdding(k);
    setEditingId(null);
    setFormValue(0);
    setFormMode('prazo');
    setFormSource('proprio');
    setFormYm(k === 'ir' ? `${Number(currentYearMonth().slice(0, 4)) - 1}-12` : currentYearMonth());
  };
  const saveAdd = () => {
    if (!(formValue > 0) || !adding) return;
    if (adding === 'extra') {
      const id = editingId ?? uid();
      update((prev) => {
        // Editar não muda quando o pagamento foi lançado
        const createdAt = prev.extras.find((e) => e.id === id)?.createdAt ?? new Date().toISOString();
        return {
          ...prev,
          extras: [...prev.extras.filter((e) => e.id !== id), { id, yearMonth: formYm, amount: formValue, mode: formMode, source: formSource, createdAt }],
        };
      });
    } else {
      update((prev) => ({
        ...prev,
        checkpoints: [
          // Um saldo por mês e origem: o editado sai, e outro do mesmo mês e origem é substituído
          ...prev.checkpoints.filter((c) => c.id !== editingId && !(c.yearMonth === formYm && c.source === adding)),
          { id: editingId ?? uid(), yearMonth: formYm, balance: formValue, source: adding, createdAt: new Date().toISOString() },
        ],
      }));
    }
    playSound('success');
    closeForm();
  };

  type Rec = { id: string; ym: string; kind: 'checkin' | 'extra' | 'banco' | 'ir'; title: string; value: number; detail?: string };
  const records: Rec[] = [
    ...data.checkins.map((c) => ({
      id: c.id,
      ym: c.yearMonth,
      kind: 'checkin' as const,
      title: 'Check-in',
      value: c.paidAmount,
      detail: c.balanceAfter ? `saldo informado ${formatBRL(c.balanceAfter)}` : 'parcela paga',
    })),
    ...data.extras.map((e) => ({
      id: e.id,
      ym: e.yearMonth,
      kind: 'extra' as const,
      title: e.source === 'fgts' ? 'Amortização com FGTS' : e.source === 'decimo' ? 'Amortização com 13º' : 'Amortização extra',
      value: e.amount,
      detail: e.mode === 'prazo' ? 'reduziu o prazo' : 'reduziu a parcela',
    })),
    ...data.checkpoints.map((c) => ({
      id: c.id,
      ym: c.yearMonth,
      kind: c.source,
      title: c.source === 'ir' ? 'Saldo do extrato do IR' : 'Saldo do banco',
      value: c.balance,
      detail: 'saldo devedor real',
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
    setFormMode(extra?.mode ?? 'prazo');
    setFormSource(extra?.source ?? 'proprio');
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
      checkpoints: r.kind === 'banco' || r.kind === 'ir' ? prev.checkpoints.filter((c) => c.id !== r.id) : prev.checkpoints,
    }));
    playSound('delete');
  };

  const kindIcon = { checkin: CalendarCheck2, extra: Wallet, banco: Landmark, ir: FileText } as const;
  const kindTone = {
    checkin: 'bg-anil-100 text-anil-700 dark:bg-anil-500/15 dark:text-anil-300',
    extra: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300',
    banco: 'bg-sky-100 text-sky-700 dark:bg-sky-500/15 dark:text-sky-300',
    ir: 'bg-sol-100 text-sol-700 dark:bg-sol-400/15 dark:text-sol-300',
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
          <div data-tour="hist-anos" className="flex gap-1.5 overflow-x-auto pb-1 -mx-1 px-1">
            {years.map((y) => (
              <button
                key={y}
                type="button"
                onClick={() => {
                  playSound('tick');
                  setYear(y);
                }}
                className={`relative h-9 px-3.5 rounded-full text-sm font-num font-semibold shrink-0 cursor-pointer transition-colors ${
                  y === year ? 'text-white' : 'text-slate-600 dark:text-slate-300 hover:bg-white dark:hover:bg-slate-800'
                }`}
              >
                {y === year && <motion.span layoutId="year-pill" className="absolute inset-0 rounded-full bg-anil-600" transition={{ type: 'spring', stiffness: 420, damping: 34 }} />}
                <span className="relative">{y}</span>
              </button>
            ))}
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
                    return (
                      <tr
                        key={r.index}
                        className={`border-b last:border-0 border-slate-900/[0.04] dark:border-white/[0.04] ${
                          isNext ? 'bg-sol-50/70 dark:bg-sol-400/[0.07]' : paid ? '' : 'text-slate-500 dark:text-slate-400'
                        }`}
                      >
                        <td className="px-5 py-2.5">
                          <span className="inline-flex items-center gap-2">
                            <span className="font-num font-semibold text-slate-900 dark:text-white">{r.index}</span>
                            {paid && checkinMonths.has(r.yearMonth) && <BadgeCheck className="w-4 h-4 text-emerald-500" aria-label="Check-in feito" />}
                            {isNext && <span className="px-1.5 py-0.5 rounded-full bg-sol-400 text-slate-900 text-[10px] font-bold">próxima</span>}
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
                          {r.trEstimated && r.index <= summary.paidCount + 1 && (
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
                          {r.checkpoint && <div className="text-[11px] text-sky-600 dark:text-sky-400 font-semibold">valor do banco</div>}
                        </td>
                      </tr>
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
            <button type="button" onClick={() => openAdd('ir')} className={btnGhost}>
              <FileText className="w-4 h-4" /> Saldo do extrato do IR
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
                        : adding === 'ir'
                          ? 'Editar saldo do extrato do Imposto de Renda'
                          : 'Editar saldo devedor do banco'
                      : adding === 'extra'
                        ? 'Registrar amortização extra'
                        : adding === 'ir'
                          ? 'Saldo do extrato do Imposto de Renda'
                          : 'Saldo devedor do banco'}
                  </h3>
                  <div className="grid sm:grid-cols-[220px_minmax(0,240px)] xl:grid-cols-[220px_minmax(0,240px)_auto_auto] gap-4 items-start mt-4">
                    <Field label={adding === 'ir' ? 'Mês de referência' : 'Mês'}>
                      <MonthField
                        value={formYm}
                        onChange={setFormYm}
                        ariaLabel={adding === 'ir' ? 'Mês de referência' : 'Mês'}
                        min={model.contract.firstDueMonth}
                        max={currentYearMonth()}
                        marked={adding === 'extra' ? extraMonths : balanceMonths}
                        markedLabel={adding === 'extra' ? 'já amortizou' : 'saldo registrado'}
                      />
                    </Field>
                    <Field
                      label={adding === 'extra' ? 'Valor amortizado' : 'Saldo devedor'}
                      help={adding === 'ir' ? HELP.irBalance : adding === 'banco' ? HELP.currentBalance : undefined}
                    >
                      <MoneyField value={formValue} onChange={setFormValue} />
                    </Field>
                    {adding === 'extra' && (
                      <Field label="De onde veio">
                        <SegmentedControl
                          ariaLabel="De onde veio"
                          layoutId="add-source"
                          value={formSource}
                          onChange={setFormSource}
                          className="w-60"
                          options={[
                            { value: 'proprio', label: 'Próprio' },
                            { value: 'fgts', label: 'FGTS' },
                            { value: 'decimo', label: '13º' },
                          ]}
                        />
                      </Field>
                    )}
                    {adding === 'extra' && (
                      <Field label="Reduziu">
                        <SegmentedControl
                          ariaLabel="Reduziu"
                          layoutId="add-mode"
                          value={formMode}
                          onChange={setFormMode}
                          className="w-48"
                          options={[
                            { value: 'prazo', label: 'Prazo' },
                            { value: 'parcela', label: 'Parcela' },
                          ]}
                        />
                      </Field>
                    )}
                  </div>
                  {adding === 'ir' && (
                    <div className={`${tile} p-3 mt-4 text-sm text-slate-600 dark:text-slate-300`}>
                      O extrato do IR mostra o saldo em 31 de dezembro. Por isso já deixamos <b>dezembro de {formYm.slice(0, 4)}</b> selecionado.
                    </div>
                  )}
                  <div className="flex gap-2 mt-5">
                    <button type="button" onClick={saveAdd} disabled={!(formValue > 0)} className={btnPrimary}>
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

