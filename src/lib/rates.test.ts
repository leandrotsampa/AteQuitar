import { afterEach, describe, expect, it, vi } from 'vitest';
import { FALLBACK_RATES, embeddedTr, fetchJson, missingTrMonths, pickDueTr, projectedTr, trFunction, trIsOfficial } from './rates';

// Trecho real da série 226 (início do período, fim e TR %)
const raw = [
  { data: '01/09/2026', dataFim: '01/10/2026', valor: '0.1690' },
  { data: '04/09/2026', dataFim: '04/10/2026', valor: '0.1467' },
  { data: '05/08/2026', dataFim: '05/09/2026', valor: '0.1725' },
  { data: '05/09/2026', dataFim: '05/10/2026', valor: '0.1150' },
  { data: '01/10/2026', dataFim: '31/10/2026', valor: '0.1616' },
  { data: '01/10/2026', dataFim: '01/11/2026', valor: '0.1616' },
];

describe('pickDueTr', () => {
  it('pega o período que termina no dia do vencimento, pelo mês da parcela', () => {
    expect(pickDueTr(raw, 5)).toEqual({ '2026-09': 0.1725, '2026-10': 0.115 });
  });

  it('ignora o período do mês calendário que termina em outro dia', () => {
    expect(pickDueTr(raw, 1)).toEqual({ '2026-10': 0.169, '2026-11': 0.1616 });
  });
});

describe('trFunction', () => {
  const rates = { ...FALLBACK_RATES, trByMonth: { '2026-10': 0.1616, '2026-11': 0.15 }, trDue: { day: 5, byMonth: { '2026-10': 0.115 } } };

  it('usa a TR até o vencimento quando o dia bate', () => {
    expect(trFunction(rates, 5)('2026-10')).toBe(0.115);
  });

  it('sem ela (ou com outro dia de vencimento), usa a TR do mês', () => {
    expect(trFunction(rates, 5)('2026-11')).toBe(0.15);
    expect(trFunction(rates, 10)('2026-10')).toBe(0.1616);
  });

  it('sem nada buscado, usa a TR embutida do mês (e não uma média)', () => {
    const empty = { ...FALLBACK_RATES, trByMonth: {} };
    expect(trFunction(empty, 5)('2019-06')).toBe(0);
    expect(trFunction(empty, 5)('2016-03')).toBe(embeddedTr('2016-03'));
  });
});

describe('TR embutida', () => {
  it('cobre de 1991 até a versão do app', () => {
    expect(embeddedTr('1991-03')).toBe(8.5);
    expect(embeddedTr('2026-10')).toBe(0.1616);
    expect(embeddedTr('1990-12')).toBeUndefined();
  });

  it('completa a média da projeção quando há poucos meses buscados', () => {
    const p = projectedTr({ ...FALLBACK_RATES, trByMonth: { '2026-10': 0.1616 } });
    expect(p).toBeGreaterThan(0.14);
    expect(p).toBeLessThan(0.18);
  });
});

describe('missingTrMonths', () => {
  const contract = { firstDueMonth: '2026-08', dueDay: 5, termMonths: 420 };
  const today = new Date(2026, 9, 26); // 26/10/2026

  it('lista as parcelas cuja TR do vencimento já saiu e não foi buscada', () => {
    const rates = { ...FALLBACK_RATES, trDue: { day: 5, byMonth: { '2026-08': 0.1713, '2026-10': 0.115 } } };
    // Novembro: o período começou em 05/10, já saiu
    expect(missingTrMonths(rates, contract, today)).toEqual(['2026-09', '2026-11']);
  });

  it('com outro dia de vencimento guardado, falta tudo', () => {
    const rates = { ...FALLBACK_RATES, trDue: { day: 10, byMonth: { '2026-08': 0.17 } } };
    expect(missingTrMonths(rates, contract, today)).toHaveLength(4);
  });

  it('vencimento em dia 29 a 31 usa a TR do mês como oficial', () => {
    const rates = { ...FALLBACK_RATES, trByMonth: { '2026-08': 0.1693, '2026-09': 0.169, '2026-10': 0.1616 } };
    expect(missingTrMonths(rates, { ...contract, dueDay: 30 }, today)).toEqual([]);
    expect(trIsOfficial(rates, 30)('2026-09')).toBe(true);
    expect(trIsOfficial(rates, 5)('2026-09')).toBe(false);
  });
});

describe('fetchJson', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('tenta de novo quando a API recusa e devolve a resposta que chegar', async () => {
    const fetchMock = vi
      .fn()
      .mockRejectedValueOnce(new TypeError('Failed to fetch'))
      .mockResolvedValueOnce({ ok: true, json: async () => ({ erro: 'html' }) })
      .mockResolvedValueOnce({ ok: true, json: async () => [{ data: '01/10/2026', valor: '0.1616' }] });
    vi.stubGlobal('fetch', fetchMock);
    await expect(fetchJson('u', undefined, [0, 0, 0])).resolves.toHaveLength(1);
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it('desiste depois das novas tentativas', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: false, status: 503 });
    vi.stubGlobal('fetch', fetchMock);
    await expect(fetchJson('u', undefined, [0, 0])).rejects.toThrow('HTTP 503');
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });
});
