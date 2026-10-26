// Tudo o que as telas precisam calculado uma vez a partir dos dados salvos
import { useMemo } from 'react';
import type { Contract, ScheduleRow } from '../types/finance';
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
}

function completenessOf(data: AppData): { score: number; missing: string[] } {
  const c = data.contract;
  if (!c) return { score: 0, missing: ['contrato'] };
  const checks: [boolean, string][] = [
    [c.financedAmount > 0 && c.annualRate > 0 && c.termMonths > 0, 'dados do contrato'],
    [Boolean(c.feesRef) || data.checkins.some((ci) => ci.fees), 'seguros e taxa da fatura'],
    [c.cet > 0, 'CET do contrato'],
    [data.checkpoints.length > 0, 'saldo devedor atual (app do banco)'],
    [data.checkpoints.some((cp) => cp.source === 'ir'), 'saldo do extrato do IR'],
    [data.checkins.length > 0, 'primeiro check-in do mês'],
  ];
  const done = checks.filter(([ok]) => ok).length;
  return { score: done / checks.length, missing: checks.filter(([ok]) => !ok).map(([, label]) => label) };
}

export function useFinanceModel(data: AppData): FinanceModel | null {
  return useMemo(() => {
    const contract = data.contract;
    if (!contract) return null;
    const trFor = trFunction(data.rates, contract.dueDay);
    // Saldos informados no check-in também calibram a projeção
    const checkpoints = [
      ...data.checkpoints,
      ...data.checkins
        .filter((ci) => ci.balanceAfter && ci.balanceAfter > 0)
        .filter((ci) => !data.checkpoints.some((cp) => cp.yearMonth === ci.yearMonth))
        .map((ci) => ({ id: `ci-${ci.id}`, yearMonth: ci.yearMonth, balance: ci.balanceAfter!, source: 'banco' as const, createdAt: ci.createdAt })),
    ];
    // Seguros e taxa das faturas informadas no check-in: base da previsão dos meses seguintes
    const invoices = data.checkins.filter((ci) => ci.fees).map((ci) => ({ ...ci.fees!, yearMonth: ci.yearMonth }));
    const trOfficial = trIsOfficial(data.rates, contract.dueDay);
    const options: ScheduleOptions = { extras: data.extras, checkpoints, trFor, invoices, trOfficial };
    const rows = buildSchedule(contract, options);
    const originalRows = buildSchedule(contract, { trFor, invoices });
    const summary = summarize(contract, rows);
    return {
      contract,
      rows,
      originalRows,
      summary,
      trFor,
      options,
      completeness: completenessOf(data),
      calibrated: checkpoints.length > 0,
    };
  }, [data]);
}
