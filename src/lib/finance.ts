// Motor de cálculo do financiamento: tabela mês a mês (SAC ou Price), com TR, seguros,
// amortizações extras e saldos reais informados pelo usuário. Funções puras.
import type { BalanceCheckpoint, Contract, ExtraMode, ExtraPayment, ScheduleRow } from '../types/finance';
import { addMonths, annualToMonthly, currentYearMonth } from './format';

export interface ScheduleOptions {
  extras?: ExtraPayment[];
  checkpoints?: BalanceCheckpoint[];
  // TR do mês (% a.m.); sem a função, a TR é zero
  trFor?: (yearMonth: string) => number;
}

const EPS = 0.005;

// Parcelas que faltam para quitar `balance` mantendo o valor de referência do pagamento
function monthsToPayOff(system: Contract['system'], balance: number, i: number, reference: number): number {
  if (balance <= EPS) return 0;
  if (system === 'SAC' || i === 0) return Math.ceil(balance / reference - 1e-9);
  const x = 1 - (balance * i) / reference;
  if (x <= 0) return Infinity;
  return Math.ceil(-Math.log(x) / Math.log(1 + i) - 1e-9);
}

// Amortização simulada: sempre depois de qualquer saldo já informado
const PLANNED_AT = '9999-12-31T00:00:00.000Z';

// A amortização foi lançada depois do saldo real do mesmo mês? Sem data (registros antigos),
// o saldo vale como informado. O saldo do IR é o de 31/12 e já inclui tudo o que foi pago no ano
function extraAfterCheckpoint(e: ExtraPayment, cp: BalanceCheckpoint): boolean {
  if (!e.createdAt) return false;
  if (cp.source === 'ir') return e.createdAt === PLANNED_AT;
  return e.createdAt > (cp.createdAt ?? '');
}

export function buildSchedule(contract: Contract, opts: ScheduleOptions = {}): ScheduleRow[] {
  const i = annualToMonthly(contract.annualRate) / 100;
  const fees = (contract.monthlyInsurance || 0) + (contract.monthlyAdminFee || 0);
  const extrasByMonth = new Map<string, ExtraPayment[]>();
  for (const e of opts.extras ?? []) {
    if (!(e.amount > 0)) continue;
    extrasByMonth.set(e.yearMonth, [...(extrasByMonth.get(e.yearMonth) ?? []), e]);
  }
  const checkpointByMonth = new Map((opts.checkpoints ?? []).map((c) => [c.yearMonth, c]));

  const rows: ScheduleRow[] = [];
  let balance = contract.financedAmount;
  let remaining = Math.max(1, Math.round(contract.termMonths));
  const guard = remaining * 2 + 24;

  for (let k = 0; balance > EPS && remaining > 0 && k < guard; k++) {
    const ym = addMonths(contract.firstDueMonth, k);
    const opening = balance;
    const tr = contract.trIndexed && opts.trFor ? Math.max(0, opts.trFor(ym)) / 100 : 0;
    const correction = balance * tr;
    balance += correction;
    const interest = balance * i;

    let amortization: number;
    if (remaining <= 1) {
      amortization = balance;
    } else if (contract.system === 'SAC') {
      amortization = balance / remaining;
    } else {
      const pmt = i === 0 ? balance / remaining : (balance * i) / (1 - Math.pow(1 + i, -remaining));
      amortization = pmt - interest;
    }
    amortization = Math.min(amortization, balance);
    balance -= amortization;
    remaining -= 1;

    // Amortizações extras do mês, depois da parcela. Com saldo real informado no mesmo mês,
    // o saldo já inclui o que foi pago antes dele; o que veio depois abate em cima do saldo
    const cp = checkpointByMonth.get(ym);
    let extra = 0;
    let mode: ExtraMode | null = null;
    const apply = (e: ExtraPayment) => {
      const applied = Math.min(e.amount, balance);
      extra += applied;
      balance -= applied;
      if (applied > 0 && (mode === null || e.mode === 'prazo')) mode = e.mode;
    };
    const monthExtras = extrasByMonth.get(ym) ?? [];
    const afterCheckpoint = (e: ExtraPayment) => Boolean(cp && extraAfterCheckpoint(e, cp));
    monthExtras.filter((e) => !afterCheckpoint(e)).forEach(apply);

    // Saldo real informado: passa a valer daqui em diante
    if (cp) balance = Math.max(0, cp.balance);
    monthExtras.filter(afterCheckpoint).forEach(apply);

    if (balance <= EPS) {
      balance = 0;
    } else if (mode === 'prazo' && remaining > 0) {
      // Mantém o mesmo nível de pagamento: o prazo encolhe
      const reference = contract.system === 'SAC' ? amortization : amortization + interest;
      remaining = Math.min(remaining, monthsToPayOff(contract.system, balance, i, reference));
      if (remaining === 0) remaining = 1;
    }

    rows.push({
      index: k + 1,
      yearMonth: ym,
      openingBalance: opening,
      correction,
      interest,
      amortization,
      fees,
      payment: amortization + interest + fees,
      extra,
      closingBalance: balance,
      checkpoint: Boolean(cp),
    });
  }
  return rows;
}

export interface Summary {
  paidCount: number;
  remainingCount: number;
  totalCount: number;
  currentBalance: number;
  // Fração do valor financiado já quitada (0 a 1)
  progress: number;
  paidTotal: number; // parcelas + extras já pagos
  paidInterest: number;
  paidFees: number;
  paidExtras: number;
  remainingInterest: number;
  remainingTotal: number; // tudo o que ainda vai pagar (parcelas)
  totalInterest: number;
  next: ScheduleRow | null;
  last: ScheduleRow | null;
  endYearMonth: string;
  // Meses a menos que o prazo original do contrato
  monthsAhead: number;
}

// A parcela do mês conta como paga depois do dia do vencimento
function paidUntilIndex(contract: Contract, rows: ScheduleRow[], today = new Date()): number {
  const ym = currentYearMonth(today);
  const passedDue = today.getDate() >= contract.dueDay;
  let count = 0;
  for (const r of rows) {
    if (r.yearMonth < ym || (r.yearMonth === ym && passedDue)) count++;
    else break;
  }
  return count;
}

export function summarize(contract: Contract, rows: ScheduleRow[], today = new Date()): Summary {
  const paidCount = paidUntilIndex(contract, rows, today);
  const paid = rows.slice(0, paidCount);
  const future = rows.slice(paidCount);
  const sum = (list: ScheduleRow[], f: (r: ScheduleRow) => number) => list.reduce((acc, r) => acc + f(r), 0);
  const currentBalance = paidCount > 0 ? rows[paidCount - 1].closingBalance : contract.financedAmount;
  const progress = contract.financedAmount > 0 ? Math.min(1, Math.max(0, 1 - currentBalance / contract.financedAmount)) : 0;
  const last = rows[rows.length - 1] ?? null;
  return {
    paidCount,
    remainingCount: future.length,
    totalCount: rows.length,
    currentBalance,
    progress,
    paidTotal: sum(paid, (r) => r.payment + r.extra),
    paidInterest: sum(paid, (r) => r.interest),
    paidFees: sum(paid, (r) => r.fees),
    paidExtras: sum(paid, (r) => r.extra),
    remainingInterest: sum(future, (r) => r.interest),
    remainingTotal: sum(future, (r) => r.payment),
    totalInterest: sum(rows, (r) => r.interest),
    next: future[0] ?? null,
    last,
    endYearMonth: last?.yearMonth ?? contract.firstDueMonth,
    monthsAhead: Math.max(0, contract.termMonths - rows.length),
  };
}

export type ExtraFrequency = 'once' | 'monthly' | 'yearly';

export interface ExtraPlan {
  amount: number;
  startYm: string;
  frequency: ExtraFrequency;
  mode: ExtraMode;
}

// Lança o plano de amortização como extras mês a mês (até o fim do financiamento)
function planToExtras(plan: ExtraPlan, untilYm: string): ExtraPayment[] {
  if (!(plan.amount > 0)) return [];
  if (plan.frequency === 'once') {
    return [{ id: 'sim-0', yearMonth: plan.startYm, amount: plan.amount, mode: plan.mode, source: 'proprio', createdAt: PLANNED_AT }];
  }
  const step = plan.frequency === 'monthly' ? 1 : 12;
  const out: ExtraPayment[] = [];
  for (let k = 0, ym = plan.startYm; ym <= untilYm; k++, ym = addMonths(plan.startYm, k * step)) {
    out.push({ id: `sim-${k}`, yearMonth: ym, amount: plan.amount, mode: plan.mode, source: 'proprio', createdAt: PLANNED_AT });
  }
  return out;
}

export interface SimulationResult {
  base: ScheduleRow[];
  simulated: ScheduleRow[];
  interestSaved: number;
  monthsSaved: number;
  totalExtra: number;
  newEndYm: string;
  // Parcela logo depois da primeira amortização simulada
  paymentBefore: number;
  paymentAfter: number;
}

export function simulateExtra(contract: Contract, opts: ScheduleOptions, plan: ExtraPlan): SimulationResult {
  const base = buildSchedule(contract, opts);
  const lastYm = base[base.length - 1]?.yearMonth ?? plan.startYm;
  const planned = planToExtras(plan, lastYm);
  const simulated = buildSchedule(contract, { ...opts, extras: [...(opts.extras ?? []), ...planned] });
  const totalInterest = (rows: ScheduleRow[]) => rows.reduce((a, r) => a + r.interest + r.fees, 0);
  const afterYm = addMonths(plan.startYm, 1);
  const at = (rows: ScheduleRow[]) => rows.find((r) => r.yearMonth >= afterYm)?.payment ?? 0;
  const appliedExtras = simulated.reduce((a, r) => a + r.extra, 0) - base.reduce((a, r) => a + r.extra, 0);
  return {
    base,
    simulated,
    interestSaved: totalInterest(base) - totalInterest(simulated),
    monthsSaved: base.length - simulated.length,
    totalExtra: appliedExtras,
    newEndYm: simulated[simulated.length - 1]?.yearMonth ?? lastYm,
    paymentBefore: at(base),
    paymentAfter: at(simulated),
  };
}

export interface SystemTotals {
  rows: ScheduleRow[];
  firstPayment: number;
  lastPayment: number;
  maxPayment: number;
  totalPaid: number;
  totalInterest: number;
}

function totals(rows: ScheduleRow[]): SystemTotals {
  return {
    rows,
    firstPayment: rows[0]?.payment ?? 0,
    lastPayment: rows[rows.length - 1]?.payment ?? 0,
    maxPayment: Math.max(0, ...rows.map((r) => r.payment)),
    totalPaid: rows.reduce((a, r) => a + r.payment + r.extra, 0),
    totalInterest: rows.reduce((a, r) => a + r.interest, 0),
  };
}

// Os dois sistemas com os mesmos dados do contrato (sem extras, TR projetada)
export function compareSystems(contract: Contract, trFor?: (ym: string) => number): { sac: SystemTotals; price: SystemTotals } {
  return {
    sac: totals(buildSchedule({ ...contract, system: 'SAC' }, { trFor })),
    price: totals(buildSchedule({ ...contract, system: 'PRICE' }, { trFor })),
  };
}

// Juros totais que o saldo de hoje pagaria com outra taxa (mesmo prazo restante)
export function interestWithRate(contract: Contract, balance: number, months: number, annualRate: number): number {
  if (months <= 0 || balance <= 0) return 0;
  const rows = buildSchedule({
    ...contract,
    financedAmount: balance,
    termMonths: months,
    annualRate,
    trIndexed: false,
    monthlyInsurance: 0,
    monthlyAdminFee: 0,
  });
  return rows.reduce((a, r) => a + r.interest, 0);
}

