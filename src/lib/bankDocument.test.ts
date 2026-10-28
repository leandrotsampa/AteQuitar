import { describe, expect, it } from 'vitest';
import { parseBankDocument } from './bankDocument';
import { applyImport, checkImport, planImport } from './importDocument';
import { normalizeData } from './store';
import type { AppData } from './store';

// Linhas de um Documento Descritivo do Crédito da Caixa como o pdf.js as monta (sem nome, CPF,
// contrato ou agência): o cabeçalho, dois eventos, parcelas pagas de jan a out/2026 e duas projetadas
const LINES = [
  '#EXTERNO.CONFIDENCIAL',
  'Documento Descritivo do Crédito - Portabilidade - Resolução CMN nº 5.057/2022',
  'Data Referência: | 28/10/2026',
  'Dados do Financiamento:',
  'Produto: | 901 - SFH | Taxa de Juros Anual Nominal: | 9,3764 | Prazo de Amortização Contratado: | 370',
  'Sistema de Amortização: | SAC - SIST. AMORTIZACAO',
  'Taxa de Juros Anual Efetiva: | 9,7900 | Prazo de Amortização Remanescente: | 362',
  'CONSTANTE',
  'Data vencimento da última parcela do contrato: | 05/12/2056 | Custo Efetivo Total (CET):* | 10,80 | Contribuição ao FCVS: | 0,00',
  'Indexador: | TR | Funding: | 15 - SBPE',
  'Taxa de Juros Reduzida: | Valor do Evento: | Saldo Após:',
  '27/06/2024 | INCLUSAO DE FINANCIAMENTO A PESSOA FISICA',
  '9,3764 | 400.000,00 | 0,00',
  'Número do DAMP:',
  '27/06/2024 | INCLUSAO DE FINANCIAMENTO A PESSOA FISICA',
  '539201911922506',
  '7 | 05/01/2026 | 05/01/2026 | 1.031,24 | 3.013,60 43,25 114,99 | 158,24 | 25,00 | 0,00 | 0,00 | 4.228,08 | 0,00 | 4.228,08 | 4.228,12 | -0,02 | 632,23 | 384.654,30 1,00164194',
  '8 | 05/02/2026 | 05/02/2026 | 1.033,05 | 3.010,84 43,21 115,22 | 158,43 | 25,00 | 0,00 | 0,00 | 4.227,32 | 0,00 | 4.227,32 | 4.227,32 | 0,00 | 675,87 | 384.297,13 1,00175710',
  'Taxa de Juros Reduzida: | Valor do Evento: | Saldo Após:',
  '05/02/2026 | AMORT P/RED PRAZO - REC PROPRIOS',
  '9,3764 | -531,00 | 383.766,13',
  '1 | 05/03/2026 | 05/03/2026 | 1.038,47 | 3.002,27 43,07 115,35 | 158,42 | 25,00 | 0,00 | 0,00 | 4.224,16 | 0,00 | 4.224,16 | 4.224,19 | -0,03 | 469,26 | 383.196,92 1,00122279',
  '2 | 05/04/2026 | 06/04/2026 | 1.040,25 | 2.999,28 43,04 115,55 | 158,59 | 25,00 | 0,00 | 0,00 | 4.223,12 | 0,00 | 4.223,12 | 4.223,04 | 0,08 | 656,05 | 382.812,73 1,00171206',
  '3 | 05/05/2026 | 05/05/2026 | 1.041,61 | 2.995,08 42,97 115,69 | 158,66 | 25,00 | 0,00 | 0,00 | 4.220,35 | 0,00 | 4.220,35 | 4.220,38 | -0,03 | 501,43 | 382.272,56 1,00130987',
  '4 | 05/06/2026 | 05/06/2026 | 1.043,41 | 2.992,09 42,92 115,89 | 158,81 | 25,00 | 0,00 | 0,00 | 4.219,31 | 0,00 | 4.219,31 | 4.219,34 | -0,03 | 659,78 | 381.888,94 1,00172596',
  '5 | 05/07/2026 | 06/07/2026 | 1.045,19 | 2.989,04 42,89 116,10 | 158,99 | 25,00 | 0,00 | 0,00 | 4.218,22 | 0,00 | 4.218,22 | 4.218,16 | 0,06 | 652,23 | 381.495,98 1,00170791',
  '6 | 05/08/2026 | 05/08/2026 | 1.046,98 | 2.985,98 42,84 116,30 | 159,14 | 25,00 | 0,00 | 0,00 | 4.217,10 | 0,00 | 4.217,10 | 4.217,12 | -0,02 | 653,47 | 381.102,47 1,00171291',
  '7 | 05/09/2026 | 08/09/2026 | 1.048,79 | 2.982,93 54,68 116,50 | 171,18 | 25,00 | 0,00 | 0,00 | 4.227,90 | 0,00 | 4.227,90 | 4.227,92 | -0,02 | 657,40 | 380.711,09 1,00172501',
  '8 | 05/10/2026 | 05/10/2026 | 1.049,99 | 2.978,16 54,60 116,63 | 171,23 | 25,00 | 0,00 | 0,00 | 4.224,38 | 0,00 | 4.224,38 | 4.224,41 | -0,03 | 437,86 | 380.098,96 1,00115011',
  '9 | 05/11/2026 | 1.049,98 | 2.969,96 54,46 116,63 | 171,09 | 25,00 | 0,00 | 0,00 | 4.216,03 | 0,00 | 4.216,03 | 0,00 | 0,00 | 0,00 | 379.048,98 0,00000000',
  '10 | 05/12/2026 | 1.049,98 | 2.961,75 54,30 116,63 | 170,93 | 25,00 | 0,00 | 0,00 | 4.207,66 | 0,00 | 4.207,66 | 0,00 | 0,00 | 0,00 | 377.999,00 0,00000000',
];

const parsed = () => {
  const r = parseBankDocument(LINES);
  if (!r.ok) throw new Error(r.reason);
  return r.doc;
};

// TR oficial das parcelas (período até o vencimento do dia 5), como a do Banco Central
const withTr = (d: AppData): AppData => ({ ...d, rates: { ...d.rates, trDue: { day: 5, byMonth: { '2026-11': 0.163 } } } });

describe('Documento Descritivo do Crédito', () => {
  it('lê o contrato, as parcelas pagas, as projetadas e as amortizações', () => {
    const doc = parsed();
    expect(doc).toMatchObject({
      bank: 'Caixa',
      referenceDate: '2026-10-28',
      nominalRate: 9.3764,
      effectiveRate: 9.79,
      cet: 10.8,
      system: 'SAC',
      trIndexed: true,
      remaining: 362,
      financedAmount: 400000,
      startDate: '2024-06-27',
    });
    expect(doc.paid).toHaveLength(10);
    expect(doc.projected).toHaveLength(2);
    expect(doc.paid[9]).toMatchObject({
      dueDate: '2026-10-05',
      paidDate: '2026-10-05',
      amortization: 1049.99,
      interest: 2978.16,
      mip: 54.6,
      dfi: 116.63,
      adminFee: 25,
      paid: 4224.41,
      balanceAfter: 380098.96,
      index: 1.00115011,
    });
    expect(doc.extras).toEqual([
      expect.objectContaining({ date: '2026-02-05', amount: 531, balanceAfter: 383766.13, mode: 'prazo', source: 'proprio' }),
    ]);
  });

  it('não reconhece outro tipo de arquivo', () => {
    expect(parseBankDocument(['Extrato de conta corrente', '01/10/2026 | PIX | 100,00'])).toEqual({ ok: false, reason: 'nao-reconhecido' });
  });
});

describe('importar o documento', () => {
  it('no primeiro uso, monta o cadastro e a tabela chega no saldo e no prazo do documento', () => {
    const data = withTr(normalizeData({}));
    const plan = planImport(data, parsed());
    expect(plan.isNew).toBe(true);
    expect(plan.contract).toMatchObject({ financedAmount: 400000, system: 'SAC', firstDueMonth: '2026-01', dueDay: 5, trIndexed: true, cet: 10.8 });
    const after = applyImport(data, plan, { nickname: 'Apartamento', propertyValue: 450000 });
    expect(after.contract).toMatchObject({ nickname: 'Apartamento', propertyValue: 450000 });
    expect(after.checkins).toHaveLength(10);
    // Outubro: as linhas somam 4.224,38 e foram pagos 4.224,41
    expect(after.checkins.find((c) => c.yearMonth === '2026-10')).toMatchObject({ paidAmount: 4224.41, adjustment: 0.03 });
    expect(after.checkins.find((c) => c.yearMonth === '2026-02')?.adjustment).toBeUndefined();
    expect(after.extras).toEqual([expect.objectContaining({ yearMonth: '2026-02', amount: 531, mode: 'prazo' })]);

    // Em 28/10 o app do banco mostrava 380.570,92: o saldo do documento com a TR de 16 dos 21 dias úteis
    const check = checkImport(after, plan, new Date(2026, 9, 28, 12))!;
    expect(check.appBalance).toBe(380098.96);
    expect(check.remainingApp).toBe(362);
    expect(check.businessDays).toEqual({ done: 16, total: 21 });
    expect(check.today).toBe(380570.92);
  });

  it('depois, troca os registros dos mesmos meses e separa as amortizações que o banco não mostra', () => {
    const base = withTr(normalizeData({}));
    const data: AppData = {
      ...applyImport(base, planImport(base, parsed()), {}),
      checkins: [{ id: 'meu', yearMonth: '2026-10', paidAmount: 4224.38, createdAt: '2026-10-26T21:00:00.000Z' }],
      extras: [
        { id: 'mesma', yearMonth: '2026-02', amount: 531, mode: 'prazo', source: 'proprio' },
        { id: 'outra', yearMonth: '2026-04', amount: 2000, mode: 'prazo', source: 'proprio' },
        { id: 'nova', yearMonth: '2026-11', amount: 1000, date: '2026-11-10', mode: 'prazo', source: 'proprio' },
      ],
      checkpoints: [{ id: 'b', yearMonth: '2026-10', balance: 380511.89, source: 'banco', createdAt: '2026-10-26T21:00:00.000Z' }],
    };
    const plan = planImport(data, parsed());
    expect(plan.isNew).toBe(false);
    expect(plan.contractChanges).toEqual([]);
    expect(plan.replacedCheckins).toBe(1);
    expect(plan.replacedExtras.map((e) => e.id)).toEqual(['mesma']);
    expect(plan.conflictingExtras.map((e) => e.id)).toEqual(['outra']);
    expect(plan.removedCheckpoints.map((c) => c.id)).toEqual(['b']);

    const kept = applyImport(data, plan, { removeConflicting: false });
    expect(kept.extras.map((e) => e.id).sort()).toEqual(['doc-ex-2026-02-05-0', 'nova', 'outra']);
    const clean = applyImport(data, plan, { removeConflicting: true });
    expect(clean.extras.map((e) => e.id).sort()).toEqual(['doc-ex-2026-02-05-0', 'nova']);
    expect(clean.checkins.filter((c) => c.yearMonth === '2026-10')).toEqual([expect.objectContaining({ id: 'doc-2026-10', balanceAfter: 380098.96 })]);
    expect(clean.checkpoints).toEqual([]);
  });

  it('importar o mesmo documento de novo não repete nada', () => {
    const base = withTr(normalizeData({}));
    const once = applyImport(base, planImport(base, parsed()), {});
    const plan = planImport(once, parsed());
    expect(plan.updatesDocument).toBe(true);
    expect(plan.replacedCheckins).toBe(0);
    const twice = applyImport(once, plan, {});
    expect(twice.checkins).toHaveLength(once.checkins.length);
    expect(twice.extras).toHaveLength(once.extras.length);
  });

  it('a partir do exemplo, começa do zero', () => {
    const demo: AppData = {
      ...withTr(normalizeData({})),
      isDemo: true,
      extras: [{ id: 'demo-fgts', yearMonth: '2024-04', amount: 25000, mode: 'prazo', source: 'fgts' }],
    };
    const after = applyImport(demo, planImport(demo, parsed()), {});
    expect(after.isDemo).toBe(false);
    expect(after.extras.map((e) => e.id)).toEqual(['doc-ex-2026-02-05-0']);
  });
});
