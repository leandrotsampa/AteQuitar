import { createRequire } from 'node:module';
import { describe, expect, it } from 'vitest';

const require = createRequire(import.meta.url);
const { exportDocument, parseImport } = require('./dataTransfer.cjs');

const doc = {
  version: 1,
  contract: { nickname: 'Casa', financedAmount: 300000 },
  checkins: [{ id: 'a', yearMonth: '2026-10', paidAmount: 3000, createdAt: '2026-10-11T00:00:00.000Z' }],
  extras: [],
  checkpoints: [],
  rates: { fetchedAt: '2026-10-26T00:00:00.000Z', latest: {}, history: {}, trByMonth: {} },
  celebrated: [0, 10],
  isDemo: false,
  createdAt: '2026-01-01T00:00:00.000Z',
};

describe('exportDocument', () => {
  it('identifica o formato e deixa as taxas de fora', () => {
    const out = exportDocument(doc, new Date('2026-10-26T12:00:00.000Z'));
    expect(out.formato).toBe('ate-quitar');
    expect(out.versao).toBe(1);
    expect(out.exportadoEm).toBe('2026-10-26T12:00:00.000Z');
    expect(out).not.toHaveProperty('rates');
    expect(out.checkins).toEqual(doc.checkins);
  });
});

describe('parseImport', () => {
  it('lê de volta o que foi exportado', () => {
    const back = parseImport(JSON.stringify(exportDocument(doc)));
    expect(back.contract).toEqual(doc.contract);
    expect(back.checkins).toEqual(doc.checkins);
    expect(back).not.toHaveProperty('formato');
  });

  it('aceita o JSON das primeiras versões (sem cabeçalho)', () => {
    expect(parseImport(JSON.stringify(doc)).contract).toEqual(doc.contract);
  });

  it('explica o problema quando o arquivo não serve', () => {
    expect(() => parseImport('{ nada')).toThrow('não é um JSON válido');
    expect(() => parseImport('[]')).toThrow('não tem dados');
    expect(() => parseImport(JSON.stringify({ formato: 'outro', contract: {} }))).toThrow('outro aplicativo');
    expect(() => parseImport(JSON.stringify({ formato: 'ate-quitar', versao: 9, contract: {} }))).toThrow('versão mais nova');
    expect(() => parseImport(JSON.stringify({ checkins: [] }))).toThrow('não tem um financiamento');
  });
});
