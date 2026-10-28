import React from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { ChevronDown } from 'lucide-react';
import { HelpTip, type HelpContent } from './ui/HelpTip';
import { MoneyField } from './ui/Inputs';
import { HELP } from './help';
import { formatBRL } from '../lib/format';
import type { InvoiceFees, ScheduleRow } from '../types/finance';

// Seguros e taxa como a pessoa está preenchendo: o total (como a fatura em aberto mostra) e,
// se quiser, o detalhe em MIP e DFI (como a fatura paga mostra)
export interface FeesDraft {
  split: boolean;
  mip: number;
  dfi: number;
  insurance: number;
  adminFee: number;
}

const cents = (v: number) => Math.round(v * 100) / 100;

export const emptyFeesDraft = (split = false): FeesDraft => ({ split, mip: 0, dfi: 0, insurance: 0, adminFee: 0 });

export function draftFromFees(f: InvoiceFees | undefined, split = false): FeesDraft {
  if (!f) return emptyFeesDraft(split);
  const hasSplit = f.mip !== undefined && f.dfi !== undefined;
  return { split: hasSplit, mip: f.mip ?? 0, dfi: f.dfi ?? 0, insurance: f.insurance, adminFee: f.adminFee };
}

// Valores previstos para o mês, já corrigidos a partir da fatura anterior. Abre com MIP e DFI
// separados, como a fatura paga mostra; só o total quando a previsão não tem o detalhe
export function draftFromRow(row: ScheduleRow | undefined): FeesDraft {
  if (!row || !(row.fees > 0)) return emptyFeesDraft(true);
  const hasSplit = row.mip !== undefined && row.dfi !== undefined;
  return { split: hasSplit, mip: row.mip ?? 0, dfi: row.dfi ?? 0, insurance: row.insurance, adminFee: row.adminFee };
}

export const draftInsurance = (d: FeesDraft) => cents(d.split ? d.mip + d.dfi : d.insurance);

// Nada preenchido: sem fatura
export function feesFromDraft(d: FeesDraft): InvoiceFees | undefined {
  const insurance = draftInsurance(d);
  if (!(insurance > 0) && !(d.adminFee > 0)) return undefined;
  return d.split && insurance > 0 ? { insurance, mip: d.mip, dfi: d.dfi, adminFee: d.adminFee } : { insurance, adminFee: d.adminFee };
}

export const draftTotal = (d: FeesDraft) => cents(draftInsurance(d) + d.adminFee);

// Uma linha do detalhe da fatura, como no app do banco: rótulo à esquerda, valor à direita
export const LedgerRow: React.FC<{
  label: React.ReactNode;
  help?: HelpContent;
  sign?: '+' | '−';
  // Ação ao lado do rótulo (ex.: detalhar os seguros)
  action?: React.ReactNode;
  note?: React.ReactNode;
  sub?: boolean;
  children: React.ReactNode;
}> = ({ label, help, sign = '+', action, note, sub = false, children }) => (
  <div className={`flex items-center gap-3 ${sub ? 'py-1 pl-4 ml-1 border-l border-slate-200 dark:border-slate-700' : 'py-1.5'}`}>
    <div className="flex-1 min-w-0">
      <div className={`flex items-center gap-1.5 ${sub ? 'text-[13px] text-slate-500 dark:text-slate-400' : 'text-sm font-medium text-slate-800 dark:text-slate-100'}`}>
        {label}
        {/* As partes de uma linha (MIP e DFI) não levam sinal: somam no total dela */}
        {!sub && (
          <span className="text-slate-400 dark:text-slate-500 font-normal" aria-hidden>
            ({sign})
          </span>
        )}
        {help && <HelpTip help={help} />}
        {action}
      </div>
      {note && <div className="mt-0.5 text-[11px] leading-snug text-slate-500 dark:text-slate-400">{note}</div>}
    </div>
    <div className="w-36 sm:w-40 shrink-0">{children}</div>
  </div>
);

// Valor calculado (não editável), alinhado com os campos
export const LedgerValue: React.FC<{ value: number }> = ({ value }) => (
  <div className="h-10 px-3 flex items-center justify-end font-num font-semibold text-slate-900 dark:text-white tabular-nums">{formatBRL(value)}</div>
);

// Seguros (total, com o detalhe em MIP e DFI) e taxas, como linhas do detalhe da fatura
export const InvoiceFeesRows: React.FC<{
  value: FeesDraft;
  onChange: (d: FeesDraft) => void;
}> = ({ value: d, onChange }) => {
  const set = (patch: Partial<FeesDraft>) => onChange({ ...d, ...patch });
  // Detalhar parte do total: com um DFI previsto, ele fica e o MIP é o resto (o detalhe soma o
  // total digitado); sem previsão, o total vai para o DFI até a pessoa digitar o MIP
  const toggle = () =>
    d.split
      ? set({ split: false, insurance: draftInsurance(d) })
      : set(d.dfi > 0 && d.dfi < d.insurance ? { split: true, mip: cents(d.insurance - d.dfi) } : { split: true, mip: 0, dfi: d.insurance });
  return (
    <>
      <LedgerRow
        label="Seguros"
        action={
            <button
              type="button"
              onClick={toggle}
              aria-expanded={d.split}
              className="ml-1 inline-flex items-center gap-0.5 h-6 px-2 rounded-full whitespace-nowrap text-[11px] font-semibold text-anil-700 dark:text-anil-300 bg-anil-50 dark:bg-anil-500/10 hover:bg-anil-100 dark:hover:bg-anil-500/20 cursor-pointer transition-colors"
            >
              {d.split ? 'só o total' : 'MIP e DFI'}
              <ChevronDown className={`w-3 h-3 transition-transform ${d.split ? 'rotate-180' : ''}`} />
            </button>
        }
        help={HELP.insurance}
        note={!d.split && d.insurance > 0 ? 'Só com o total, a previsão das próximas pode variar alguns centavos.' : undefined}
      >
        {d.split ? <LedgerValue value={draftInsurance(d)} /> : <MoneyField size="sm" value={d.insurance} onChange={(v) => set({ insurance: v })} ariaLabel="Seguros" />}
      </LedgerRow>
      <AnimatePresence initial={false}>
        {d.split && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
            <LedgerRow label="Seguro MIP" sub>
              <MoneyField size="sm" value={d.mip} onChange={(v) => set({ mip: v })} ariaLabel="Seguro MIP" />
            </LedgerRow>
            <LedgerRow label="Seguro DFI" sub>
              <MoneyField size="sm" value={d.dfi} onChange={(v) => set({ dfi: v })} ariaLabel="Seguro DFI" />
            </LedgerRow>
          </motion.div>
        )}
      </AnimatePresence>
      <LedgerRow label="Taxas" help={HELP.adminFee}>
        <MoneyField size="sm" value={d.adminFee} onChange={(v) => set({ adminFee: v })} ariaLabel="Taxa de administração" />
      </LedgerRow>
    </>
  );
};
