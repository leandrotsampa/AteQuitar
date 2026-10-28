// Importa o Documento Descritivo do Crédito: monta o cadastro, as faturas pagas (como check-ins) e
// as amortizações extras, e confere o resultado antes de gravar. O documento é a palavra do banco:
// nos meses que ele cobre, substitui o que estava no app

import type { BankDocument, DocumentInstallment } from './bankDocument';
import type { BalanceCheckpoint, CheckIn, Contract, ExtraPayment } from '../types/finance';
import type { AppData } from './store';
import { balanceOnDate, lastDueBefore } from './finance';
import { businessDaysBetween } from './businessDays';
import { nominalToEffective } from './format';
import { computeModel } from './model';

const cents = (v: number) => Math.round(v * 100) / 100;
const ymOf = (date: string) => date.slice(0, 7);
const at = (date: string, hour: number) => {
  const [y, m, d] = date.split('-').map(Number);
  return new Date(y, m - 1, d, hour).toISOString();
};

// Id fixo por mês e por evento: importar de novo substitui, sem duplicar
const checkinId = (ym: string) => `doc-${ym}`;
const isDocExtra = (e: ExtraPayment) => e.id.startsWith('doc-ex-');
export const isFromDocument = (id: string) => id.startsWith('doc-');

export interface ContractChange {
  label: string;
  from: string;
  to: string;
}

export interface ImportPlan {
  doc: BankDocument;
  isNew: boolean;
  contract: Contract;
  contractChanges: ContractChange[];
  checkins: CheckIn[];
  extras: ExtraPayment[];
  // Registros da pessoa (não de um documento anterior) substituídos pelo documento
  replacedCheckins: number;
  // Já havia um documento importado: este atualiza aquele
  updatesDocument: boolean;
  replacedExtras: ExtraPayment[];
  removedCheckpoints: BalanceCheckpoint[];
  // Amortizações do app em meses que o documento cobre e que ele não mostra
  conflictingExtras: ExtraPayment[];
  // Prazo total: o documento só diz o que falta, e o contrato original pode ter sido maior
  minTerm: number;
}

export interface ImportOptions {
  nickname?: string;
  propertyValue?: number;
  termMonths?: number;
  removeConflicting?: boolean;
}

// Parcelas que faltavam antes desta, pelo saldo corrigido ÷ amortização (SAC): só quando fecha
// num número inteiro (a primeira parcela, com juros de mais de um mês, não fecha)
function remainingAfter(r: DocumentInstallment): number | undefined {
  if (!(r.amortization > 0)) return undefined;
  const n = (r.balanceAfter + r.amortization) / r.amortization;
  const whole = Math.round(n);
  return Math.abs(n - whole) < 0.05 && whole > 1 ? whole - 1 : undefined;
}

const fmtRate = (v: number) => `${v.toLocaleString('pt-BR', { maximumFractionDigits: 4 })}% a.a.`;
const fmtMoney = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const fmtMonth = (ym: string) => `${ym.slice(5)}/${ym.slice(0, 4)}`;

// No exemplo, o documento começa do zero: nada do exemplo se mistura com os dados do banco
const startingPoint = (data: AppData): AppData =>
  data.isDemo ? { ...data, contract: null, extras: [], checkpoints: [], checkins: [], celebrated: [], isDemo: false } : data;

export function planImport(current: AppData, doc: BankDocument): ImportPlan {
  const data = startingPoint(current);
  const first = doc.paid[0];
  const last = doc.paid[doc.paid.length - 1];
  const old = data.contract;
  const minTerm = doc.paid.length + (doc.remaining ?? 0);
  const rate = doc.nominalRate ? nominalToEffective(doc.nominalRate) : doc.effectiveRate;

  const contract: Contract = {
    nickname: old?.nickname ?? 'Minha casa',
    bank: old?.bank || doc.bank,
    ...(old?.bankPreposition ? { bankPreposition: old.bankPreposition } : {}),
    propertyValue: old?.propertyValue ?? 0,
    financedAmount: doc.financedAmount ?? old?.financedAmount ?? 0,
    annualRate: rate ?? old?.annualRate ?? 0,
    rateInput: doc.nominalRate ? 'nominal' : doc.effectiveRate ? 'efetiva' : old?.rateInput,
    cet: doc.cet ?? old?.cet ?? 0,
    // O contrato original pode ter sido maior que o que o documento mostra (pagas + restantes)
    termMonths: Math.max(old?.termMonths ?? 0, doc.contractedTerm ?? 0, minTerm),
    system: doc.system ?? old?.system ?? 'SAC',
    firstDueMonth: ymOf(first.dueDate),
    dueDay: Number(first.dueDate.slice(8, 10)),
    trIndexed: doc.trIndexed ?? old?.trIndexed ?? true,
    ...(old?.feesRef ? { feesRef: old.feesRef } : {}),
  };

  const changes: ContractChange[] = [];
  if (old) {
    const check = (label: string, from: string, to: string) => from !== to && changes.push({ label, from, to });
    check('Valor financiado', fmtMoney(old.financedAmount), fmtMoney(contract.financedAmount));
    check('Taxa efetiva', fmtRate(Math.round(old.annualRate * 100) / 100), fmtRate(Math.round(contract.annualRate * 100) / 100));
    check('Sistema', old.system, contract.system);
    check('Primeira parcela', fmtMonth(old.firstDueMonth), fmtMonth(contract.firstDueMonth));
    check('Dia do vencimento', `dia ${old.dueDay}`, `dia ${contract.dueDay}`);
    check('Prazo total', `${old.termMonths} meses`, `${contract.termMonths} meses`);
    check('Correção pela TR', old.trIndexed ? 'sim' : 'não', contract.trIndexed ? 'sim' : 'não');
  }

  const checkins: CheckIn[] = doc.paid.map((r, k) => {
    const ym = ymOf(r.dueDate);
    const remaining = k === doc.paid.length - 1 && doc.remaining ? doc.remaining : remainingAfter(r);
    return {
      id: checkinId(ym),
      yearMonth: ym,
      paidAmount: r.paid,
      amortization: r.amortization,
      interest: r.interest,
      ...(r.charges > 0 ? { charges: r.charges } : {}),
      ...(r.fgts > 0 ? { fgts: r.fgts } : {}),
      fees: { insurance: cents(r.mip + r.dfi), mip: r.mip, dfi: r.dfi, adminFee: r.adminFee },
      // O saldo do documento é o de logo depois da parcela, no vencimento: exato
      balanceAfter: r.balanceAfter,
      balanceSource: 'banco',
      ...(remaining ? { remainingAfter: remaining } : {}),
      // No dia do vencimento, antes das amortizações extras do mesmo dia
      createdAt: at(r.dueDate, 9),
    };
  });

  const extras: ExtraPayment[] = doc.extras.map((e, k) => {
    // Entra depois da parcela do último vencimento; antes da primeira parcela, no mês dela
    // (lançada antes do saldo daquele mês, que já a desconta)
    const ym = lastDueBefore(contract, e.date).yearMonth;
    return {
      id: `doc-ex-${e.date}-${k}`,
      yearMonth: ym < contract.firstDueMonth ? contract.firstDueMonth : ym,
      amount: e.amount,
      date: e.date,
      mode: e.mode,
      source: e.source,
      createdAt: at(e.date, 10),
    };
  });

  const docMonths = new Set(checkins.map((c) => c.yearMonth));
  const lastYm = ymOf(last.dueDate);
  // Amortizações do app em meses cobertos pelo documento: as que ele também mostra são trocadas
  // pelas dele; as que ele não mostra ficam a critério da pessoa
  const covered = (e: ExtraPayment) => e.yearMonth <= lastYm && (!e.date || e.date <= doc.referenceDate);
  const userExtras = data.extras.filter((e) => !isDocExtra(e) && covered(e));
  const matches = (e: ExtraPayment) => extras.some((d) => d.yearMonth === e.yearMonth && Math.abs(d.amount - e.amount) <= 1);

  return {
    doc,
    isNew: !old,
    contract,
    contractChanges: changes,
    checkins,
    extras,
    replacedCheckins: data.checkins.filter((c) => docMonths.has(c.yearMonth) && !isFromDocument(c.id)).length,
    updatesDocument: data.checkins.some((c) => isFromDocument(c.id)) || data.extras.some(isDocExtra),
    replacedExtras: userExtras.filter(matches),
    conflictingExtras: userExtras.filter((e) => !matches(e)),
    removedCheckpoints: data.checkpoints.filter((cp) => cp.yearMonth <= lastYm),
    minTerm,
  };
}

export function applyImport(current: AppData, plan: ImportPlan, opts: ImportOptions = {}): AppData {
  const data = startingPoint(current);
  const docMonths = new Set(plan.checkins.map((c) => c.yearMonth));
  const replaced = new Set(plan.replacedExtras.map((e) => e.id));
  const conflicting = new Set(opts.removeConflicting ? plan.conflictingExtras.map((e) => e.id) : []);
  const removedCheckpoints = new Set(plan.removedCheckpoints.map((c) => c.id));
  return {
    ...data,
    contract: {
      ...plan.contract,
      ...(opts.nickname?.trim() ? { nickname: opts.nickname.trim() } : {}),
      ...(opts.propertyValue && opts.propertyValue > 0 ? { propertyValue: opts.propertyValue } : {}),
      ...(opts.termMonths && opts.termMonths >= plan.minTerm ? { termMonths: Math.round(opts.termMonths) } : {}),
    },
    checkins: [...data.checkins.filter((c) => !docMonths.has(c.yearMonth)), ...plan.checkins].sort((a, b) =>
      a.yearMonth.localeCompare(b.yearMonth)
    ),
    extras: [...data.extras.filter((e) => !isDocExtra(e) && !replaced.has(e.id) && !conflicting.has(e.id)), ...plan.extras],
    checkpoints: data.checkpoints.filter((c) => !removedCheckpoints.has(c.id)),
  };
}

export interface ImportCheck {
  // Saldo do documento: logo depois da última parcela paga, no vencimento
  docBalance: number;
  docDue: string; // AAAA-MM-DD
  // O mesmo saldo na tabela do app depois da importação
  appBalance: number | null;
  // Saldo de hoje no app (com a TR dos dias úteis desde o vencimento)
  today: number;
  businessDays: { done: number; total: number } | null;
  // A TR do período ainda não é a oficial: o saldo de hoje pode variar alguns reais
  trEstimated: boolean;
  remainingDoc?: number;
  remainingApp: number;
}

// Confere o resultado: a tabela do app tem de chegar no saldo e no prazo do documento
export function checkImport(after: AppData, plan: ImportPlan, today = new Date()): ImportCheck | null {
  const model = computeModel(after, today);
  if (!model) return null;
  const last = plan.doc.paid[plan.doc.paid.length - 1];
  const lastYm = ymOf(last.dueDate);
  const k = model.rows.findIndex((r) => r.yearMonth === lastYm);
  const { summary } = model;
  const paidRow = summary.paidCount > 0 ? model.rows[summary.paidCount - 1] : null;
  const todayBalance = paidRow
    ? balanceOnDate(model.contract, summary.currentBalance, paidRow.yearMonth, today, model.trFor)
    : summary.currentBalance;
  // Dias úteis do período corrente (de que parte da TR o saldo de hoje já tem)
  let businessDays: ImportCheck['businessDays'] = null;
  if (paidRow) {
    const due = new Date(`${paidRow.yearMonth}-${String(model.contract.dueDay).padStart(2, '0')}T12:00:00`);
    const next = new Date(due.getFullYear(), due.getMonth() + 1, due.getDate());
    if (today > due && today < next) businessDays = { done: businessDaysBetween(due, today), total: businessDaysBetween(due, next) };
  }
  return {
    docBalance: last.balanceAfter,
    docDue: last.dueDate,
    appBalance: k >= 0 ? model.rows[k].closingBalance : null,
    today: todayBalance,
    businessDays,
    trEstimated: Boolean(model.rows[summary.paidCount]?.trEstimated),
    remainingDoc: plan.doc.remaining,
    remainingApp: k >= 0 ? model.rows.length - 1 - k : summary.remainingCount,
  };
}
