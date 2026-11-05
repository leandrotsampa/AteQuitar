// O cálculo do site (site/assets/calc.js) tem de dar os mesmos números do app (src/lib/finance.ts).
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { buildSchedule, simulateExtra, type ExtraPlan } from '../../src/lib/finance';
import type { Contract } from '../../src/types/finance';

// O arquivo do site é um script de navegador: carrega como no Node, pelo module.exports
function loadSiteCalc() {
  const src = readFileSync(join(__dirname, '..', '..', 'site', 'assets', 'calc.js'), 'utf8');
  const mod: { exports: Record<string, unknown> } = { exports: {} };
  new Function('module', src)(mod);
  return mod.exports as {
    buildSchedule: (c: unknown, o?: unknown) => { payment: number; interest: number; closingBalance: number; fees: number }[];
    simulateExtra: (c: unknown, o: unknown, p: ExtraPlan) => ReturnType<typeof simulateExtra> & { onlyInterestSaved: number };
    trFallbackAverage: number;
  };
}
const site = loadSiteCalc();

const base: Contract = {
  nickname: 'Teste',
  bank: 'Caixa',
  propertyValue: 400000,
  financedAmount: 300000,
  annualRate: 10.49,
  cet: 0,
  termMonths: 240,
  system: 'SAC',
  firstDueMonth: '2026-12',
  dueDay: 10,
  trIndexed: true,
};

const trFor = () => site.trFallbackAverage;
const contracts: [string, Contract][] = [
  ['SAC com TR', base],
  ['Price com TR', { ...base, system: 'PRICE' }],
  ['SAC sem TR', { ...base, trIndexed: false, annualRate: 9.79, termMonths: 360, financedAmount: 520000 }],
  ['Price sem TR', { ...base, system: 'PRICE', trIndexed: false, annualRate: 12.5, termMonths: 180 }],
  ['SAC com seguros (total)', { ...base, feesRef: { yearMonth: '2026-12', insurance: 98.4, adminFee: 25 } }],
  ['SAC com MIP e DFI', { ...base, feesRef: { yearMonth: '2026-12', insurance: 98.4, mip: 38.4, dfi: 60, adminFee: 25 } }],
  ['Price com seguros', { ...base, system: 'PRICE', feesRef: { yearMonth: '2026-12', insurance: 120, adminFee: 0 } }],
];

const plans: ExtraPlan[] = [
  { amount: 10000, startYm: '2026-12', frequency: 'once', mode: 'prazo' },
  { amount: 10000, startYm: '2026-12', frequency: 'once', mode: 'parcela' },
  { amount: 500, startYm: '2026-12', frequency: 'monthly', mode: 'prazo' },
  { amount: 3000, startYm: '2027-12', frequency: 'yearly', mode: 'parcela' },
  { amount: 400000, startYm: '2026-12', frequency: 'once', mode: 'prazo' },
];

describe('cálculo do site igual ao do app', () => {
  it.each(contracts)('tabela mês a mês: %s', (_, contract) => {
    const app = buildSchedule(contract, { trFor });
    const web = site.buildSchedule(contract, { trFor });
    expect(web.length).toBe(app.length);
    web.forEach((r, k) => {
      expect(r.payment).toBeCloseTo(app[k].payment, 6);
      expect(r.interest).toBeCloseTo(app[k].interest, 6);
      expect(r.fees).toBeCloseTo(app[k].fees, 6);
      expect(r.closingBalance).toBeCloseTo(app[k].closingBalance, 6);
    });
  });

  for (const [name, contract] of contracts) {
    it.each(plans)(`simulação de amortização (${name}): %o`, (plan) => {
      const app = simulateExtra(contract, { trFor }, plan);
      const web = site.simulateExtra(contract, { trFor }, plan);
      expect(web.interestSaved).toBeCloseTo(app.interestSaved, 6);
      expect(web.monthsSaved).toBe(app.monthsSaved);
      expect(web.totalExtra).toBeCloseTo(app.totalExtra, 6);
      expect(web.newEndYm).toBe(app.newEndYm);
      expect(web.paymentBefore).toBeCloseTo(app.paymentBefore, 6);
      expect(web.paymentAfter).toBeCloseTo(app.paymentAfter, 6);
    });
  }
});
