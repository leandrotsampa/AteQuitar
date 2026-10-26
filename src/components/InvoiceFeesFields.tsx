import React from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Field } from './ui/HelpTip';
import { MoneyField } from './ui/Inputs';
import { HELP } from './help';
import { formatBRL } from '../lib/format';
import type { InvoiceFees, ScheduleRow } from '../types/finance';

// Seguros e taxa como a pessoa está preenchendo: separados (MIP e DFI) ou só o total
export interface FeesDraft {
  split: boolean;
  mip: number;
  dfi: number;
  insurance: number;
  adminFee: number;
}

const cents = (v: number) => Math.round(v * 100) / 100;

export const emptyFeesDraft = (split = true): FeesDraft => ({ split, mip: 0, dfi: 0, insurance: 0, adminFee: 0 });

export function draftFromFees(f: InvoiceFees | undefined, split = true): FeesDraft {
  if (!f) return emptyFeesDraft(split);
  const hasSplit = f.mip !== undefined && f.dfi !== undefined;
  return { split: hasSplit, mip: f.mip ?? 0, dfi: f.dfi ?? 0, insurance: f.insurance, adminFee: f.adminFee };
}

// Valores previstos para o mês, já corrigidos a partir da fatura anterior
export function draftFromRow(row: ScheduleRow | undefined, split = true): FeesDraft {
  if (!row || !(row.fees > 0)) return emptyFeesDraft(split);
  const hasSplit = row.mip !== undefined && row.dfi !== undefined;
  return { split: hasSplit, mip: row.mip ?? 0, dfi: row.dfi ?? 0, insurance: row.insurance, adminFee: row.adminFee };
}

// Nada preenchido: sem fatura
export function feesFromDraft(d: FeesDraft): InvoiceFees | undefined {
  const insurance = d.split ? cents(d.mip + d.dfi) : cents(d.insurance);
  if (!(insurance > 0) && !(d.adminFee > 0)) return undefined;
  return d.split && insurance > 0 ? { insurance, mip: d.mip, dfi: d.dfi, adminFee: d.adminFee } : { insurance, adminFee: d.adminFee };
}

export const draftTotal = (d: FeesDraft) => cents((d.split ? d.mip + d.dfi : d.insurance) + d.adminFee);

export const InvoiceFeesFields: React.FC<{
  value: FeesDraft;
  onChange: (d: FeesDraft) => void;
  hint?: React.ReactNode;
}> = ({ value: d, onChange, hint }) => {
  const set = (patch: Partial<FeesDraft>) => onChange({ ...d, ...patch });
  // Trocar o jeito de informar leva o que já foi digitado
  const setSplit = (split: boolean) => {
    if (split === d.split) return;
    if (!split) set({ split, insurance: d.mip + d.dfi > 0 ? cents(d.mip + d.dfi) : d.insurance });
    else set({ split });
  };
  return (
    <div className="space-y-4">
      <Field label="Seguros" help={HELP.insurance} hint={hint}>
        <div className="flex rounded-full bg-slate-100 dark:bg-slate-800 p-1 w-fit mb-2" role="group" aria-label="Como a fatura mostra os seguros">
          {[
            { v: true, l: 'MIP e DFI separados' },
            { v: false, l: 'Só o total' },
          ].map((o) => (
            <button
              key={o.l}
              type="button"
              aria-pressed={d.split === o.v}
              onClick={() => setSplit(o.v)}
              className={`h-8 px-3 rounded-full text-sm font-semibold cursor-pointer transition-colors ${
                d.split === o.v ? 'bg-white dark:bg-slate-950 text-slate-900 dark:text-white shadow-sm' : 'text-slate-500'
              }`}
            >
              {o.l}
            </button>
          ))}
        </div>
        {d.split ? (
          <div className="grid grid-cols-2 gap-3">
            <div>
              <div className="text-xs text-slate-500 mb-1">Seguro MIP</div>
              <MoneyField value={d.mip} onChange={(v) => set({ mip: v })} ariaLabel="Seguro MIP" />
            </div>
            <div>
              <div className="text-xs text-slate-500 mb-1">Seguro DFI</div>
              <MoneyField value={d.dfi} onChange={(v) => set({ dfi: v })} ariaLabel="Seguro DFI" />
            </div>
          </div>
        ) : (
          <MoneyField value={d.insurance} onChange={(v) => set({ insurance: v })} ariaLabel="Seguros" />
        )}
        <AnimatePresence initial={false}>
          {!d.split && (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
              <div className="mt-2 p-2.5 rounded-xl bg-sol-50 dark:bg-sol-400/10 text-xs text-sol-900 dark:text-sol-100 leading-relaxed">
                Só com o total, a previsão da próxima fatura pode ter alguns centavos de diferença: o MIP cai com o saldo e o DFI sobe com a TR,
                e o total não diz quanto é cada um.
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </Field>
      <Field label="Taxa de administração" help={HELP.adminFee} optional>
        <MoneyField value={d.adminFee} onChange={(v) => set({ adminFee: v })} ariaLabel="Taxa de administração" />
      </Field>
      {draftTotal(d) > 0 && (
        <div className="text-xs text-slate-500 dark:text-slate-400">
          Seguros e taxa somam <b className="font-num text-slate-700 dark:text-slate-200">{formatBRL(draftTotal(d))}</b> na parcela.
        </div>
      )}
    </div>
  );
};
