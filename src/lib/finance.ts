// Motor de cálculo do financiamento: tabela mês a mês (SAC ou Price), com TR, seguros,
// amortizações extras e saldos reais informados pelo usuário. Funções puras.
import type { Contract, ExtraMode, ExtraPayment, FeesReference, ScheduleCheckpoint, ScheduleRow } from '../types/finance';
import { addMonths, annualToMonthly, currentYearMonth } from './format';

export interface ScheduleOptions {
  extras?: ExtraPayment[];
  checkpoints?: ScheduleCheckpoint[];
  // TR do mês (% a.m.); sem a função, a TR é zero
  trFor?: (yearMonth: string) => number;
  // Seguros e taxa das faturas informadas no check-in (a do cadastro vem do contrato)
  invoices?: FeesReference[];
  // A TR do mês é a oficial que o banco aplica? Sem a função, nenhum mês é marcado como estimado
  trOfficial?: (yearMonth: string) => boolean;
  // Amortização e juros copiados da fatura do check-in: valem no lugar dos calculados
  actuals?: { yearMonth: string; amortization: number; interest: number }[];
}

const cents = (v: number) => Math.round(v * 100) / 100;

// Seguros e taxa de cada mês a partir da fatura de referência mais próxima (a última até o mês;
// antes da primeira, a primeira vale para trás). O MIP é uma taxa sobre o saldo corrigido, o DFI
// é corrigido pela TR como o saldo; só com o total, ele inteiro segue a TR. A taxa se repete.
// Fatura só com o total (como a Caixa mostra a em aberto) é dividida pela última fatura detalhada
// antes dela: o DFI é o dela corrigido pela TR, e o MIP, o resto do total.
// Os saldos não dependem dos seguros, por isso o cálculo vem depois da tabela pronta
function applyFees(rows: ScheduleRow[], refs: FeesReference[]): void {
  if (rows.length === 0 || refs.length === 0) return;
  const sorted = [...refs].sort((a, b) => a.yearMonth.localeCompare(b.yearMonth));
  const indexOf = new Map(rows.map((r, k) => [r.yearMonth, k]));
  const first = rows[0].yearMonth;
  const rowOf = (ym: string) => indexOf.get(ym) ?? (ym < first ? 0 : rows.length - 1);
  // Índice acumulado da TR e saldo corrigido (base do MIP) de cada mês
  const cum: number[] = [];
  rows.forEach((r, k) => cum.push((k > 0 ? cum[k - 1] : 1) * (r.openingBalance > 0 ? 1 + r.correction / r.openingBalance : 1)));
  // Em mês com saldo real, a base é ele (o de antes da parcela), não o estimado que vinha da tabela
  const base = rows.map((r) => (r.checkpoint ? r.closingBalance + r.amortization + r.extra : r.openingBalance + r.correction));

  // Divide os totais usando a última fatura detalhada antes deles
  const detailed = sorted.filter((f) => f.mip !== undefined && f.dfi !== undefined);
  for (let n = 0; n < sorted.length; n++) {
    const f = sorted[n];
    if (f.mip !== undefined && f.dfi !== undefined) continue;
    const from = [...detailed].reverse().find((d) => d.yearMonth < f.yearMonth);
    if (!from) continue;
    const dfi = cents(from.dfi! * (cum[rowOf(f.yearMonth)] / cum[rowOf(from.yearMonth)]));
    const mip = cents(f.insurance - dfi);
    // Total menor que o DFI: a divisão não serve (outro seguro, outra faixa); fica só o total
    if (mip > 0) sorted[n] = { ...f, mip, dfi };
  }

  let next = 0;
  rows.forEach((r, k) => {
    while (next < sorted.length && sorted[next].yearMonth <= r.yearMonth) next++;
    const ref = sorted[Math.max(0, next - 1)];
    const j = rowOf(ref.yearMonth);
    const exact = ref.yearMonth === r.yearMonth;
    const tr = cum[k] / cum[j];
    let mip: number | undefined;
    let dfi: number | undefined;
    let insurance: number;
    if (ref.mip !== undefined && ref.dfi !== undefined) {
      mip = exact ? ref.mip : cents(base[j] > 0 ? (ref.mip * base[k]) / base[j] : ref.mip);
      dfi = exact ? ref.dfi : cents(ref.dfi * tr);
      insurance = cents(mip + dfi);
    } else {
      insurance = exact ? ref.insurance : cents(ref.insurance * tr);
    }
    r.insurance = insurance;
    r.mip = mip;
    r.dfi = dfi;
    r.adminFee = ref.adminFee;
    r.fees = cents(insurance + ref.adminFee);
    r.feesFromInvoice = exact;
    r.payment = r.amortization + r.interest + r.fees;
  });
}

// Referências de seguros: a fatura do cadastro e as dos check-ins (a do check-in vale no mesmo mês)
function feeReferences(contract: Contract, invoices: FeesReference[] = []): FeesReference[] {
  const months = new Set(invoices.map((f) => f.yearMonth));
  return [...(contract.feesRef && !months.has(contract.feesRef.yearMonth) ? [contract.feesRef] : []), ...invoices];
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
// o saldo vale como informado
function extraAfterCheckpoint(e: ExtraPayment, cp: ScheduleCheckpoint): boolean {
  if (!e.createdAt) return false;
  return e.createdAt > (cp.createdAt ?? '');
}

export function buildSchedule(contract: Contract, opts: ScheduleOptions = {}): ScheduleRow[] {
  const i = annualToMonthly(contract.annualRate) / 100;
  const extrasByMonth = new Map<string, ExtraPayment[]>();
  for (const e of opts.extras ?? []) {
    if (!(e.amount > 0)) continue;
    extrasByMonth.set(e.yearMonth, [...(extrasByMonth.get(e.yearMonth) ?? []), e]);
  }
  const checkpointByMonth = new Map((opts.checkpoints ?? []).map((c) => [c.yearMonth, c]));
  const actualByMonth = new Map((opts.actuals ?? []).map((a) => [a.yearMonth, a]));
  // Primeiro mês com dado real: antes dele a tabela é só a do contrato
  const firstReal = [...checkpointByMonth.keys(), ...actualByMonth.keys()].sort()[0];

  const rows: ScheduleRow[] = [];
  let balance = contract.financedAmount;
  let remaining = Math.max(1, Math.round(contract.termMonths));
  const guard = remaining * 2 + 24;

  for (let k = 0; balance > EPS && remaining > 0 && k < guard; k++) {
    const ym = addMonths(contract.firstDueMonth, k);
    const opening = balance;
    const tr = contract.trIndexed && opts.trFor ? Math.max(0, opts.trFor(ym)) / 100 : 0;
    // Centavos como o banco: atualização e juros arredondados, amortização do SAC truncada
    // (conferido nas faturas da Caixa: 1.049,9971 vira 1.049,99, e 2.985,9784 de juros, 2.985,98)
    const correction = cents(balance * tr);
    balance += correction;
    const actual = actualByMonth.get(ym);
    const interest = actual ? actual.interest : cents(balance * i);

    let amortization: number;
    if (actual) {
      amortization = actual.amortization;
    } else if (remaining <= 1) {
      amortization = balance;
    } else if (contract.system === 'SAC') {
      amortization = Math.floor((balance / remaining) * 100 + 1e-6) / 100;
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
    let beforeExtras: number | null = null;
    const apply = (e: ExtraPayment) => {
      if (beforeExtras === null) beforeExtras = balance;
      const applied = Math.min(e.amount, balance);
      extra += applied;
      balance -= applied;
      if (applied > 0 && (mode === null || e.mode === 'prazo')) mode = e.mode;
    };
    const monthExtras = extrasByMonth.get(ym) ?? [];
    const afterCheckpoint = (e: ExtraPayment) => Boolean(cp && extraAfterCheckpoint(e, cp));
    monthExtras.filter((e) => !afterCheckpoint(e)).forEach(apply);

    // Saldo real informado: passa a valer daqui em diante. Com o prazo real junto, ele também:
    // o saldo já inclui as amortizações de antes, e só as lançadas depois mexem no prazo de novo
    if (cp) balance = Math.max(0, cp.balance);
    if (cp?.remaining && cp.remaining > 0) {
      remaining = Math.round(cp.remaining);
      mode = null;
    }
    monthExtras.filter(afterCheckpoint).forEach(apply);

    if (balance <= EPS) {
      balance = 0;
    } else if (mode === 'prazo' && remaining > 0) {
      if (contract.system === 'SAC' && beforeExtras !== null) {
        // Como a Caixa: corta o máximo de meses sem que a prestação nova (amortização + juros)
        // passe da que o saldo de antes daria com o prazo de agora (conferido em seis simulações)
        const before: number = beforeExtras;
        const payment = (b: number, n: number) => Math.floor((b / n) * 100 + 1e-6) / 100 + cents(b * i);
        const limit = payment(before, remaining);
        let n = remaining;
        while (n > 1 && payment(balance, n - 1) <= limit + 1e-9) n--;
        remaining = n;
      } else {
        // Price: mantém a prestação; o prazo encolhe
        const reference = contract.system === 'SAC' ? amortization : amortization + interest;
        remaining = Math.min(remaining, monthsToPayOff(contract.system, balance, i, reference));
        if (remaining === 0) remaining = 1;
      }
    }

    rows.push({
      index: k + 1,
      yearMonth: ym,
      openingBalance: opening,
      correction,
      trEstimated: contract.trIndexed && Boolean(opts.trOfficial) && !opts.trOfficial!(ym),
      interest,
      amortization,
      fees: 0,
      insurance: 0,
      adminFee: 0,
      feesFromInvoice: false,
      payment: amortization + interest,
      extra,
      closingBalance: balance,
      checkpoint: cp?.source ?? null,
      fromInvoice: Boolean(actual),
      estimated: !firstReal || ym < firstReal,
    });
  }
  applyFees(rows, feeReferences(contract, opts.invoices));
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

// A parcela do mês conta como paga depois do dia do vencimento, ou antes dele se o check-in
// disse que já foi paga (adiantada, não só agendada)
function paidUntilIndex(contract: Contract, rows: ScheduleRow[], today: Date, paidMonths?: ReadonlySet<string>): number {
  const ym = currentYearMonth(today);
  const passedDue = today.getDate() >= contract.dueDay;
  let count = 0;
  for (const r of rows) {
    if (r.yearMonth < ym || (r.yearMonth === ym && passedDue) || paidMonths?.has(r.yearMonth)) count++;
    else break;
  }
  return count;
}

export function summarize(contract: Contract, rows: ScheduleRow[], today = new Date(), paidMonths?: ReadonlySet<string>): Summary {
  const paidCount = paidUntilIndex(contract, rows, today, paidMonths);
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
export function compareSystems(
  contract: Contract,
  trFor?: (ym: string) => number,
  invoices?: FeesReference[]
): { sac: SystemTotals; price: SystemTotals } {
  return {
    sac: totals(buildSchedule({ ...contract, system: 'SAC' }, { trFor, invoices })),
    price: totals(buildSchedule({ ...contract, system: 'PRICE' }, { trFor, invoices })),
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
    feesRef: undefined,
  });
  return rows.reduce((a, r) => a + r.interest, 0);
}

// Saldo depois da parcela pelas linhas da fatura: os juros do mês são a taxa sobre o saldo
// corrigido, então saldo corrigido = juros ÷ taxa, e o saldo depois = esse − amortização.
// Os juros vêm arredondados nos centavos: a conta erra poucos reais
export function balanceFromInvoice(contract: Contract, interest: number, amortization: number): number | null {
  const i = annualToMonthly(contract.annualRate) / 100;
  if (!(i > 0) || !(interest > 0)) return null;
  return Math.max(0, interest / i - amortization);
}

const daysInMonth = (y: number, m: number) => new Date(y, m, 0).getDate();

// Último vencimento até a data (AAAA-MM-DD): o mês da parcela e o dia, ajustado a meses curtos
export function lastDueBefore(contract: Contract, date: string): { yearMonth: string; date: Date } {
  const [y, m, d] = date.split('-').map(Number);
  const dueThis = Math.min(contract.dueDay, daysInMonth(y, m));
  if (d >= dueThis) return { yearMonth: date.slice(0, 7), date: new Date(y, m - 1, dueThis) };
  const prev = addMonths(date.slice(0, 7), -1);
  const [py, pm] = prev.split('-').map(Number);
  return { yearMonth: prev, date: new Date(py, pm - 1, Math.min(contract.dueDay, daysInMonth(py, pm))) };
}

// Amortização extra: do valor pago, uma parte são os juros desde o último vencimento ("juros
// diários"); o resto abate o saldo. Como a Caixa: valor pago × taxa do mês × dias ÷ 30, truncado
// (conferido em seis simulações: R$ 1.000 em 21 dias dão 5,4696 de juros, que viram 5,46)
export function effectiveExtra(contract: Contract, paid: number, date: string): number {
  if (!(paid > 0)) return 0;
  const i = annualToMonthly(contract.annualRate) / 100;
  const [y, m, d] = date.split('-').map(Number);
  const days = Math.max(0, Math.round((new Date(y, m - 1, d).getTime() - lastDueBefore(contract, date).date.getTime()) / 86400000));
  const interest = Math.floor(((paid * i * days) / 30) * 100 + 1e-6) / 100;
  return Math.round((paid - interest) * 100) / 100;
}

// Mês da última parcela paga hoje (pela data ou pelo check-in que disse que já pagou): o saldo
// que o banco mostra hoje é o de depois dela. Null antes da primeira parcela
export function lastPaidMonth(contract: Contract, paidMonths: ReadonlySet<string>, today = new Date()): string | null {
  const now = currentYearMonth(today);
  let ym = today.getDate() >= contract.dueDay ? now : addMonths(now, -1);
  while (paidMonths.has(addMonths(ym, 1))) ym = addMonths(ym, 1);
  return ym < contract.firstDueMonth ? null : ym;
}

// Parcelas que faltam depois desta, pela fatura: no SAC a amortização é o saldo corrigido dividido
// pelas parcelas que faltam (contando esta); no Price, pela fórmula da prestação. Os valores da
// fatura vêm arredondados: só vale se a conta der um número (quase) inteiro
export function remainingFromInvoice(contract: Contract, interest: number, amortization: number): number | null {
  const i = annualToMonthly(contract.annualRate) / 100;
  if (!(i > 0) || !(interest > 0) || !(amortization > 0)) return null;
  const corrected = interest / i;
  let n: number;
  if (contract.system === 'SAC') {
    n = corrected / amortization;
  } else {
    const x = 1 - (corrected * i) / (amortization + interest);
    if (!(x > 0)) return null;
    n = -Math.log(x) / Math.log(1 + i);
  }
  const whole = Math.round(n);
  if (Math.abs(n - whole) > 0.1 || whole < 1 || whole > contract.termMonths) return null;
  return whole - 1;
}

// O saldo que o banco mostra num dia qualquer já tem a TR desde o último vencimento (o saldo é
// corrigido dia a dia). O app precisa do saldo logo depois da parcela: desconta a TR proporcional
// do vencimento até o dia em que o saldo foi visto. Fora do mês da parcela (ou sem data), fica igual
export function balanceAtDue(
  contract: Contract,
  cp: { yearMonth: string; balance: number; createdAt?: string },
  trFor?: (yearMonth: string) => number
): number {
  if (!contract.trIndexed || !trFor || !cp.createdAt) return cp.balance;
  const seen = new Date(cp.createdAt);
  if (Number.isNaN(seen.getTime())) return cp.balance;
  const dueOf = (ym: string) => {
    const [y, m] = ym.split('-').map(Number);
    return new Date(y, m - 1, Math.min(contract.dueDay, new Date(y, m, 0).getDate()));
  };
  const due = dueOf(cp.yearMonth);
  const nextYm = addMonths(cp.yearMonth, 1);
  const nextDue = dueOf(nextYm);
  const day = new Date(seen.getFullYear(), seen.getMonth(), seen.getDate());
  if (day <= due || day >= nextDue) return cp.balance;
  const share = (day.getTime() - due.getTime()) / (nextDue.getTime() - due.getTime());
  const tr = Math.max(0, trFor(nextYm)) / 100;
  return Math.round((cp.balance / Math.pow(1 + tr, share)) * 100) / 100;
}
