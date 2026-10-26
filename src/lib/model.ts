// Tudo o que as telas precisam calculado uma vez a partir dos dados salvos
import { useMemo } from 'react';
import type { Contract, ScheduleCheckpoint, ScheduleRow } from '../types/finance';
import { buildSchedule, summarize, type ScheduleOptions, type Summary } from './finance';
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

export function useFinanceModel(data: AppData): FinanceModel | null {
  return useMemo(() => {
    const contract = data.contract;
    if (!contract) return null;
    const trFor = trFunction(data.rates, contract.dueDay);
    // Saldos do check-in também calibram a projeção. O calculado pela fatura é o de logo depois
    // da parcela: uma amortização extra do mesmo mês sempre abate em cima dele
    const checkpoints: ScheduleCheckpoint[] = [
      ...data.checkpoints,
      ...data.checkins
        .filter((ci) => ci.balanceAfter && ci.balanceAfter > 0)
        .filter((ci) => !data.checkpoints.some((cp) => cp.yearMonth === ci.yearMonth))
        .map((ci) => ({
          id: `ci-${ci.id}`,
          yearMonth: ci.yearMonth,
          balance: ci.balanceAfter!,
          source: ci.balanceSource === 'fatura' ? ('fatura' as const) : ('banco' as const),
          ...(ci.remainingAfter ? { remaining: ci.remainingAfter } : {}),
          createdAt: ci.balanceSource === 'fatura' ? '' : ci.createdAt,
        })),
    ];
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
