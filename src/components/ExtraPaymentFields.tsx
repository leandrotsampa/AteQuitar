import React from 'react';
import { Field } from './ui/HelpTip';
import { MoneyField } from './ui/Inputs';
import { inputBase } from './ui/card';
import { effectiveExtra, lastDueBefore } from '../lib/finance';
import { formatBRL, monthName } from '../lib/format';
import type { Contract, ExtraPayment } from '../types/finance';

// Amortização extra como a pessoa está preenchendo: o valor pago e a data; a efetiva (o que
// abate o saldo) é estimada pelos juros pro rata, ou copiada do comprovante do banco
export interface ExtraDraft {
  paid: number;
  date: string; // AAAA-MM-DD
  eff: number;
  effEdited: boolean;
}

const cents = (v: number) => Math.round(v * 100) / 100;
export const todayIso = () => new Date().toLocaleDateString('sv-SE');

export function draftFromExtra(contract: Contract, e: ExtraPayment | undefined, fallbackDate = todayIso()): ExtraDraft {
  if (!e) return { paid: 0, date: fallbackDate, eff: 0, effEdited: false };
  // Registros antigos sem data: o dia do vencimento do mês (sem juros pro rata)
  const date = e.date ?? `${e.yearMonth}-${String(contract.dueDay).padStart(2, '0')}`;
  const paid = e.paid ?? e.amount;
  return { paid, date, eff: e.amount, effEdited: Math.abs(effectiveExtra(contract, paid, date) - e.amount) > 0.005 };
}

export const extraEffective = (contract: Contract, d: ExtraDraft) => (d.effEdited ? d.eff : effectiveExtra(contract, d.paid, d.date));

// Dias desde o último vencimento até o pagamento
export function extraDays(contract: Contract, date: string): number {
  const [y, m, d] = date.split('-').map(Number);
  if (!y) return 0;
  return Math.max(0, Math.round((new Date(y, m - 1, d).getTime() - lastDueBefore(contract, date).date.getTime()) / 86400000));
}

export const ExtraPaymentFields: React.FC<{
  contract: Contract;
  value: ExtraDraft;
  onChange: (d: ExtraDraft) => void;
  // Mostra depois de qual parcela a amortização entra (nos Registros, onde não há mês escolhido)
  showMonth?: boolean;
}> = ({ contract, value: d, onChange, showMonth = false }) => {
  const set = (patch: Partial<ExtraDraft>) => onChange({ ...d, ...patch });
  const estimated = effectiveExtra(contract, d.paid, d.date);
  const eff = extraEffective(contract, d);
  const days = extraDays(contract, d.date);
  const interest = cents(d.paid - estimated);
  return (
    <div className="space-y-2">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-start">
        <Field label="Data do pagamento">
          <input
            type="date"
            className={`${inputBase} font-num`}
            value={d.date}
            max={todayIso()}
            onChange={(e) => e.target.value && set({ date: e.target.value })}
            aria-label="Data do pagamento"
          />
        </Field>
        <Field label="Valor pago">
          <MoneyField value={d.paid} onChange={(v) => set({ paid: v })} ariaLabel="Valor pago na amortização" />
        </Field>
        <Field
          label="Amortização efetiva"
          help={{
            title: 'Amortização efetiva',
            body: 'O que de fato abate o saldo. Do valor pago, o banco desconta os juros desde o último vencimento sobre o valor amortizado.',
            where: 'No app da Caixa: Reduzir saldo ou quitar → "Amortização efetiva" (e "Juros diários").',
          }}
        >
          <MoneyField value={eff} onChange={(v) => set({ eff: v, effEdited: true })} ariaLabel="Amortização efetiva" />
        </Field>
      </div>
      <p className="text-xs leading-relaxed text-slate-500 dark:text-slate-400">
        {d.effEdited ? (
          <>
            Valor do comprovante.{' '}
            <button type="button" onClick={() => set({ effEdited: false })} className="font-semibold text-anil-700 dark:text-anil-300 hover:underline cursor-pointer">
              Usar a estimativa ({formatBRL(estimated)})
            </button>
          </>
        ) : d.paid > 0 && interest > 0 ? (
          <>
            Estimada: <b className="font-num text-slate-700 dark:text-slate-200">{formatBRL(interest)}</b> são juros de {days} {days === 1 ? 'dia' : 'dias'} desde
            o vencimento. Se o comprovante mostrar outro valor, corrija.
          </>
        ) : d.paid > 0 ? (
          'Pago no dia do vencimento: todo o valor abate o saldo.'
        ) : null}
        {showMonth && <>{d.paid > 0 || d.effEdited ? ' ' : ''}Entra depois da parcela de {monthName(lastDueBefore(contract, d.date).yearMonth)}.</>}
      </p>
    </div>
  );
};
