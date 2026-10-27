// Tudo o que as telas precisam calculado uma vez a partir dos dados salvos
import { useMemo } from 'react';
import type { Contract, ScheduleCheckpoint, ScheduleRow } from '../types/finance';
import { balanceAtDue, buildSchedule, summarize, type ScheduleOptions, type Summary } from './finance';
import { trFunction, trIsOfficial } from './rates';
import type { AppData } from './store';

export interface FinanceModel {
  contract: Contract;
  rows: ScheduleRow[];
  // Mesmo contrato sem nenhuma amortização extra nem saldo informado: o "plano original"
  originalRows: ScheduleRow[];
  summary: Summary;
  trFor: (ym: string) => number;
  // Extras, saldos reais e TR: o mesmo usado na tabela (para as simulações partirem do real)
  options: ScheduleOptions;
  // Quão completo está o cadastro (0 a 1) e o que falta
  completeness: { score: number; missing: string[] };
  // O saldo projetado foi calibrado com um valor real informado?
  calibrated: boolean;
  // Último saldo real até hoje (do banco ou calculado pela fatura): de onde o atual parte
  lastRealBalance: ScheduleCheckpoint | null;
  // Parcelas que o check-in disse que já foram pagas (adiantadas contam antes do vencimento)
  paidMonths: ReadonlySet<string>;
}

function completenessOf(data: AppData): { score: number; missing: string[] } {
  const c = data.contract;
  if (!c) return { score: 0, missing: ['contrato'] };
  const checks: [boolean, string][] = [
    [c.financedAmount > 0 && c.annualRate > 0 && c.termMonths > 0, 'dados do contrato'],
    [c.cet > 0, 'CET do contrato'],
    [data.checkins.length > 0, 'primeiro check-in do mês'],
    // O saldo real vem da fatura do check-in (ou de um saldo do banco informado)
    [data.checkpoints.length > 0 || data.checkins.some((ci) => ci.balanceAfter), 'check-in com a fatura (saldo exato)'],
    [Boolean(c.feesRef) || data.checkins.some((ci) => ci.fees), 'seguros e taxa da fatura'],
  ];
  const done = checks.filter(([ok]) => ok).length;
  return { score: done / checks.length, missing: checks.filter(([ok]) => !ok).map(([, label]) => label) };
}

// Saldos reais que calibram a tabela: os do banco e os calculados pela fatura do check-in
export function realBalances(data: AppData, contract: Contract, trFor: (ym: string) => number): ScheduleCheckpoint[] {
  // Saldos do check-in também calibram a projeção. O calculado pela fatura é o de logo depois
  // da parcela, exato: no mesmo mês, vale mais que o saldo do banco (que é o do dia em que foi
  // visto). Uma amortização extra do mesmo mês sempre abate em cima dele
  const byInvoice = new Map(data.checkins.filter((ci) => ci.balanceSource === 'fatura' && ci.balanceAfter).map((ci) => [ci.yearMonth, ci]));
  const bankOf = (ym: string) => data.checkpoints.find((cp) => cp.yearMonth === ym);
  return [
    // O saldo do banco vira o de logo depois da parcela: sem a TR dos dias até ser visto
    ...data.checkpoints.filter((cp) => !byInvoice.has(cp.yearMonth)).map((cp) => ({ ...cp, balance: balanceAtDue(contract, cp, trFor) })),
    ...data.checkins
      .filter((ci) => ci.balanceAfter && ci.balanceAfter > 0)
      .filter((ci) => ci.balanceSource === 'fatura' || !bankOf(ci.yearMonth))
      .map((ci) => {
        // Prazo: o da fatura; sem ele, o do saldo do banco do mesmo mês
        const remaining = ci.remainingAfter ?? bankOf(ci.yearMonth)?.remaining;
        return {
          id: `ci-${ci.id}`,
          yearMonth: ci.yearMonth,
          balance: ci.balanceAfter!,
          source: ci.balanceSource === 'fatura' ? ('fatura' as const) : ('banco' as const),
          ...(remaining ? { remaining } : {}),
          createdAt: ci.balanceSource === 'fatura' ? '' : ci.createdAt,
        };
      }),
  ];
}

export function useFinanceModel(data: AppData): FinanceModel | null {
  return useMemo(() => {
    const contract = data.contract;
    if (!contract) return null;
    const trFor = trFunction(data.rates, contract.dueDay);
    const checkpoints = realBalances(data, contract, trFor);
    // Amortização e juros copiados da fatura valem no lugar dos calculados
    const actuals = data.checkins
      .filter((ci) => ci.amortization !== undefined && ci.interest !== undefined)
      .map((ci) => ({ yearMonth: ci.yearMonth, amortization: ci.amortization!, interest: ci.interest! }));
    const paidMonths = new Set(data.checkins.filter((ci) => !ci.scheduled).map((ci) => ci.yearMonth));
    // Seguros e taxa das faturas informadas no check-in: base da previsão dos meses seguintes
    const invoices = data.checkins.filter((ci) => ci.fees).map((ci) => ({ ...ci.fees!, yearMonth: ci.yearMonth }));
    const trOfficial = trIsOfficial(data.rates, contract.dueDay);
    const options: ScheduleOptions = { extras: data.extras, checkpoints, trFor, invoices, trOfficial, actuals };
    const rows = buildSchedule(contract, options);
    const originalRows = buildSchedule(contract, { trFor, invoices });
    const summary = summarize(contract, rows, new Date(), paidMonths);
    const paidYm = summary.paidCount > 0 ? rows[summary.paidCount - 1].yearMonth : '';
    const lastRealBalance = [...checkpoints].sort((a, b) => a.yearMonth.localeCompare(b.yearMonth)).filter((c) => c.yearMonth <= paidYm).at(-1) ?? null;
    return {
      contract,
      rows,
      originalRows,
      summary,
      trFor,
      options,
      completeness: completenessOf(data),
      calibrated: checkpoints.length > 0,
      lastRealBalance,
      paidMonths,
    };
  }, [data]);
}
