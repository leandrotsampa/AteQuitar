import { createRequire } from 'node:module';
import { describe, expect, it } from 'vitest';

const require = createRequire(import.meta.url);
const { docToRows, rowsToDoc } = require('./dataMapping.cjs');

const contract = {
  nickname: 'Apartamento',
  bank: 'Caixa',
  propertyValue: 450000,
  financedAmount: 360000,
  annualRate: 10.49,
  cet: 11.32,
  termMonths: 360,
  system: 'SAC',
  firstDueMonth: '2022-07',
  dueDay: 10,
  trIndexed: true,
  feesRef: { yearMonth: '2026-09', insurance: 171.18, mip: 54.68, dfi: 116.5, adminFee: 25 },
};

const doc = {
  version: 1,
  contract,
  checkins: [{ id: 'a', yearMonth: '2026-10', paidAmount: 3971.78, balanceAfter: 329800, extraId: 'b', fees: { insurance: 171.37, adminFee: 25 }, amortization: 1051.7, interest: 2974.81, charges: 3.2, scheduled: true, balanceSource: 'fatura', createdAt: '2026-10-26T00:00:00.000Z' }],
  extras: [
    { id: 'b', yearMonth: '2026-10', amount: 1989.07, paid: 2000, date: '2026-10-26', mode: 'prazo', source: 'fgts', createdAt: '2026-10-26T00:00:00.000Z' },
    { id: 'd', yearMonth: '2025-03', amount: 2000, mode: 'parcela', source: 'proprio' },
  ],
  checkpoints: [
    { id: 'c', yearMonth: '2025-12', balance: 340000, source: 'banco' },
    { id: 'e', yearMonth: '2026-10', balance: 330000, source: 'banco', createdAt: '2026-10-20T00:00:00.000Z' },
  ],
  rates: {
    fetchedAt: '2026-10-26T00:20:00.000Z',
    latest: { selic: { date: '2026-10-26', value: 13.75 } },
    history: { selic: [{ date: '2026-10-01', value: 13.75 }] },
    trByMonth: { '2026-10': 0.1616 },
    trDue: { day: 5, byMonth: { '2026-09': 0.1725, '2026-10': 0.115 } },
  },
  celebrated: [0, 10],
  isDemo: false,
  createdAt: '2026-10-25T00:00:00.000Z',
};

// Simula o banco: o que entra nas tabelas é o que sai na leitura
const roundTrip = (d: unknown) => {
  const rows = docToRows(d);
  return rowsToDoc({ ...rows, milestones: rows.milestones.map((percent: number) => ({ percent })) });
};

describe('docToRows / rowsToDoc', () => {
  it('ida e volta preserva o documento', () => {
    expect(roundTrip(doc)).toEqual(doc);
  });

  it('lê o valor fixo de seguros das versões antigas para a interface migrar', () => {
    const rows = docToRows({ ...doc, contract: { ...contract, feesRef: undefined, monthlyInsurance: 98.4, monthlyAdminFee: 25 } });
    expect(rows.contract.fees_ref_month).toBeNull();
    const back = rowsToDoc({ ...rows, milestones: [] }).contract;
    expect(back.feesRef).toBeUndefined();
    expect(back).toMatchObject({ monthlyInsurance: 98.4, monthlyAdminFee: 25 });
  });

  it('descarta registros fora do formato', () => {
    const rows = docToRows({
      ...doc,
      checkins: [...doc.checkins, { yearMonth: '2026-10', paidAmount: 1 }, { yearMonth: 'out/26', paidAmount: 1 }],
      extras: [{ yearMonth: '2026-10', amount: -5 }],
      checkpoints: [{ yearMonth: '2026-01', balance: 'x' }],
      celebrated: [10, 10, 200, 'a'],
    });
    expect(rows.checkins).toHaveLength(1);
    expect(rows.extras).toHaveLength(0);
    expect(rows.checkpoints).toHaveLength(0);
    expect(rows.milestones).toEqual([10]);
  });

  it('guarda a preposição escolhida para o banco digitado', () => {
    const comNa = { ...doc, contract: { ...contract, bank: 'Credifoz', bankPreposition: 'na' } };
    expect(roundTrip(comNa).contract).toEqual(comNa.contract);
    expect(docToRows({ ...doc, contract: { ...contract, bankPreposition: 'xx' } }).contract.bank_preposition).toBeNull();
  });

  it('guarda como a taxa foi informada', () => {
    const nominal = { ...doc, contract: { ...contract, rateInput: 'nominal' } };
    expect(roundTrip(nominal).contract).toEqual(nominal.contract);
    expect(docToRows({ ...doc, contract: { ...contract, rateInput: 'anual' } }).contract.rate_input).toBeNull();
  });

  it('contrato incompleto não é gravado', () => {
    expect(docToRows({ contract: { ...contract, financedAmount: 0 } }).contract).toBeNull();
  });

  it('sem taxas guardadas o documento não traz taxas', () => {
    expect(roundTrip({ ...doc, rates: undefined }).rates).toBeUndefined();
  });
});
