// Taxas do mercado pela API pública do Banco Central (SGS). Sem chave e com CORS liberado.
// Se a internet faltar, valem os últimos valores guardados ou os de referência abaixo.
import { addMonths, currentYearMonth, diffMonths, monthlyToAnnual } from './format';
import { TR_HISTORY, TR_HISTORY_START } from './trHistory';

export const SGS = {
  selic: 432, // meta Selic, % a.a.
  cdi: 4389, // CDI anualizado, % a.a.
  trMonth: 7811, // TR do 1º dia do mês, % a.m.
  ipcaMonth: 433, // IPCA do mês, %
  ipca12: 13522, // IPCA acumulado em 12 meses, %
  poupancaMonth: 195, // rendimento da poupança no mês, %
  mortgageMarket: 20772, // financiamento imobiliário com taxas de mercado, % a.a.
  mortgageRegulated: 20773, // financiamento imobiliário com taxas reguladas (SFH), % a.a.
  mortgageAll: 20774, // financiamento imobiliário total, % a.a.
} as const;

export type RateKey = keyof typeof SGS;

// TR por dia de início do período de um mês, % (só para a TR de cada parcela, não é mostrada)
const SGS_TR_DAILY = 226;

export interface RatePoint {
  date: string; // AAAA-MM-DD
  value: number;
}

export interface MarketRates {
  fetchedAt: string | null; // ISO; null = valores de referência embutidos
  latest: Record<RateKey, RatePoint>;
  // Histórico curto para os mini gráficos
  history: Partial<Record<RateKey, RatePoint[]>>;
  // TR mensal por mês (AAAA-MM → % a.m.), desde o início do contrato
  trByMonth: Record<string, number>;
  // TR que o banco aplica em cada parcela: a do período que termina no dia do vencimento
  // (AAAA-MM da parcela → %), para o dia de vencimento `day`
  trDue?: { day: number; byMonth: Record<string, number> };
}

// Referência de out/2026 (Banco Central), usada até a primeira atualização
export const FALLBACK_RATES: MarketRates = {
  fetchedAt: null,
  latest: {
    selic: { date: '2026-10-22', value: 13.75 },
    cdi: { date: '2026-10-22', value: 13.65 },
    trMonth: { date: '2026-10-01', value: 0.1616 },
    ipcaMonth: { date: '2026-09-01', value: 0.82 },
    ipca12: { date: '2026-09-01', value: 4.58 },
    poupancaMonth: { date: '2026-10-22', value: 0.6267 },
    mortgageMarket: { date: '2026-08-01', value: 14.24 },
    mortgageRegulated: { date: '2026-08-01', value: 10.91 },
    mortgageAll: { date: '2026-08-01', value: 11.28 },
  },
  history: {},
  trByMonth: { '2026-09': 0.169, '2026-10': 0.1616 },
};

const toIso = (br: string) => {
  const [d, m, y] = br.split('/');
  return `${y}-${m}-${d}`;
};

const toBr = (ym: string) => `01/${ym.slice(5, 7)}/${ym.slice(0, 4)}`;

const sleep = (ms: number, signal?: AbortSignal) =>
  new Promise<void>((resolve, reject) => {
    const t = setTimeout(resolve, ms);
    signal?.addEventListener('abort', () => {
      clearTimeout(t);
      reject(new DOMException('Cancelado', 'AbortError'));
    });
  });

// A API do Banco Central às vezes recusa pedidos seguidos (e a recusa vem sem CORS, como erro de
// rede): tenta de novo com espera crescente antes de desistir
const RETRY_DELAYS = [1000, 3000, 9000];
const QUICK_RETRY = [1000];

export async function fetchJson(url: string, signal?: AbortSignal, delays = RETRY_DELAYS): Promise<unknown[]> {
  for (let attempt = 0; ; attempt++) {
    try {
      const res = await fetch(url, { signal });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const raw = await res.json();
      if (!Array.isArray(raw)) throw new Error('resposta inesperada');
      return raw;
    } catch (err) {
      if (signal?.aborted || attempt >= delays.length) throw err;
      await sleep(delays[attempt], signal);
    }
  }
}

// TR de cada parcela pela série diária: o período que começa no dia do vencimento do mês
// anterior e termina no dia do vencimento da parcela. A API recusa períodos longos: vai de 5 em 5 anos
export function pickDueTr(raw: { data: string; dataFim?: string; valor: string }[], day: number): Record<string, number> {
  const out: Record<string, number> = {};
  for (const p of raw) {
    if (!p.dataFim) continue;
    const [d1, m1, y1] = p.data.split('/').map(Number);
    const [d2, m2, y2] = p.dataFim.split('/').map(Number);
    const value = Number(p.valor);
    if (d1 !== day || d2 !== day || !Number.isFinite(value)) continue;
    if (y2 * 12 + m2 - (y1 * 12 + m1) !== 1) continue;
    out[`${y2}-${String(m2).padStart(2, '0')}`] = value;
  }
  return out;
}

async function fetchDueTr(sinceYm: string, day: number, signal?: AbortSignal, delays = RETRY_DELAYS): Promise<Record<string, number>> {
  const out: Record<string, number> = {};
  const until = currentYearMonth();
  for (let start = addMonths(sinceYm, -1); start <= until; start = addMonths(start, 60)) {
    const end = addMonths(start, 59);
    const query = `?dataInicial=${toBr(start)}&dataFinal=${toBr(end > until ? addMonths(until, 1) : addMonths(end, 1))}`;
    const raw = await fetchJson(`https://api.bcb.gov.br/dados/serie/bcdata.sgs.${SGS_TR_DAILY}/dados${query}&formato=json`, signal, delays);
    Object.assign(out, pickDueTr(raw as { data: string; dataFim?: string; valor: string }[], day));
  }
  return out;
}

async function fetchSeries(code: number, query: string, signal?: AbortSignal, delays = RETRY_DELAYS): Promise<RatePoint[]> {
  const url = `https://api.bcb.gov.br/dados/serie/bcdata.sgs.${code}/dados${query}${query.includes('?') ? '&' : '?'}formato=json`;
  const raw = (await fetchJson(url, signal, delays)) as { data: string; valor: string }[];
  const today = new Date().toISOString().slice(0, 10);
  return raw
    .map((p) => ({ date: toIso(p.data), value: Number(p.valor) }))
    .filter((p) => Number.isFinite(p.value) && p.date <= today)
    .sort((a, b) => a.date.localeCompare(b.date));
}

// Busca tudo; uma série que falhar mantém o valor anterior
export async function fetchMarketRates(
  previous: MarketRates,
  contract: { firstDueMonth: string; dueDay: number } | null,
  signal?: AbortSignal
): Promise<{ rates: MarketRates; failed: RateKey[] }> {
  const trSinceYm = contract?.firstDueMonth ?? null;
  const keys = Object.keys(SGS) as RateKey[];
  const failed: RateKey[] = [];
  const latest = { ...previous.latest };
  const history = { ...previous.history };

  // As TRs do contrato primeiro, com todas as novas tentativas. Depois de uma série que falhar de
  // vez (sem internet, API fora), as seguintes tentam só mais uma vez: a atualização não demora minutos
  let delays = RETRY_DELAYS;

  // TR mês a mês desde a 1ª parcela (a série mensal não tem limite de 10 anos)
  let trByMonth = { ...previous.trByMonth };
  if (trSinceYm) {
    try {
      const pts = await fetchSeries(SGS.trMonth, `?dataInicial=${toBr(addMonths(trSinceYm, -1))}`, signal, delays);
      trByMonth = { ...trByMonth };
      for (const p of pts) trByMonth[p.date.slice(0, 7)] = p.value;
    } catch (err) {
      if (signal?.aborted) throw err;
      failed.push('trMonth');
      delays = QUICK_RETRY;
    }
  }

  // TR de cada parcela pelo dia do vencimento: com o mesmo dia, a partir do primeiro mês que
  // falta (ou só o fim, para pegar os novos)
  let trDue = previous.trDue;
  if (contract && dueSeriesFits(contract.dueDay)) {
    const same = trDue?.day === contract.dueDay;
    const known = same ? Object.keys(trDue!.byMonth).sort() : [];
    const gap = same ? missingTrMonths(previous, contract)[0] : undefined;
    const since = !same || known.length === 0 ? contract.firstDueMonth : gap ?? addMonths(known[known.length - 1], -1);
    try {
      const byMonth = await fetchDueTr(since, contract.dueDay, signal, delays);
      trDue = { day: contract.dueDay, byMonth: { ...(same ? trDue!.byMonth : {}), ...byMonth } };
    } catch (err) {
      if (signal?.aborted) throw err;
      if (!failed.includes('trMonth')) failed.push('trMonth');
      delays = QUICK_RETRY;
    }
  }

  // Uma série de cada vez: pedidos em paralelo fazem a API recusar mais
  for (const key of keys) {
    try {
      // Por período (o modo "últimos N" da API aceita no máximo 20 valores):
      // séries diárias, os últimos 6 meses; mensais, os últimos 2 anos
      const daily = key === 'selic' || key === 'cdi' || key === 'poupancaMonth';
      const since = addMonths(currentYearMonth(), daily ? -6 : -24);
      const points = await fetchSeries(SGS[key], `?dataInicial=${toBr(since)}`, signal, delays);
      if (points.length === 0) throw new Error('vazia');
      latest[key] = points[points.length - 1];
      // Diárias: um ponto por semana para o mini gráfico
      history[key] = daily ? points.filter((_, i) => i % 5 === 0 || i === points.length - 1) : points;
    } catch (err) {
      if (signal?.aborted) throw err;
      if (!failed.includes(key)) failed.push(key);
      delays = QUICK_RETRY;
    }
  }

  const ok = failed.length < keys.length;
  return {
    rates: { fetchedAt: ok ? new Date().toISOString() : previous.fetchedAt, latest, history, trByMonth, ...(trDue ? { trDue } : {}) },
    failed,
  };
}

// TR do mês pela tabela embutida (undefined fora dela)
export function embeddedTr(ym: string): number | undefined {
  const k = diffMonths(TR_HISTORY_START, ym);
  return k >= 0 && k < TR_HISTORY.length ? TR_HISTORY[k] : undefined;
}

// TR média dos últimos 12 meses conhecidos (% a.m.): a projeção para os meses futuros
export function projectedTr(rates: MarketRates): number {
  const months = Object.keys(rates.trByMonth).sort().slice(-12);
  if (months.length >= 12) return months.reduce((a, m) => a + rates.trByMonth[m], 0) / months.length;
  // Poucos meses buscados: completa com a tabela embutida
  const last = [addMonths(TR_HISTORY_START, TR_HISTORY.length - 1), ...months].sort().at(-1)!;
  const vals = Array.from({ length: 12 }, (_, k) => addMonths(last, k - 11)).map((ym) => rates.trByMonth[ym] ?? embeddedTr(ym) ?? 0);
  return vals.reduce((a, v) => a + v, 0) / vals.length;
}

// A TR que o banco aplica na parcela é a do período até o dia do vencimento; em dias que nem
// todo mês tem (29 a 31), vale a do mês
const dueSeriesFits = (dueDay: number) => dueDay >= 1 && dueDay <= 28;

// A TR oficial da parcela do mês já saiu? A do vencimento sai no início do período (dia do
// vencimento do mês anterior); a do mês, no dia 1º. Um dia de folga para a publicação
function trPublished(ym: string, dueDay: number, today: Date): boolean {
  const [y, m] = ym.split('-').map(Number);
  const start = dueSeriesFits(dueDay) ? new Date(y, m - 2, dueDay + 1) : new Date(y, m - 1, 2);
  return start.getTime() <= today.getTime();
}

// A TR deste mês é a oficial que o banco aplica (e não a do mês, a embutida ou a média)?
export function trIsOfficial(rates: MarketRates, dueDay: number): (ym: string) => boolean {
  const due = rates.trDue?.day === dueDay ? rates.trDue.byMonth : {};
  return (ym) => ym in due || (!dueSeriesFits(dueDay) && ym in rates.trByMonth);
}

// Parcelas do contrato cuja TR oficial já saiu mas ainda não foi buscada
export function missingTrMonths(
  rates: MarketRates,
  contract: { firstDueMonth: string; dueDay: number; termMonths?: number },
  today = new Date()
): string[] {
  const official = trIsOfficial(rates, contract.dueDay);
  const last = addMonths(contract.firstDueMonth, Math.max(1, contract.termMonths ?? 600) - 1);
  const out: string[] = [];
  for (let ym = contract.firstDueMonth; ym <= last && trPublished(ym, contract.dueDay, today); ym = addMonths(ym, 1)) {
    if (!official(ym)) out.push(ym);
  }
  return out;
}

// TR de cada parcela: a do período até o dia do vencimento (como o banco aplica); sem ela, a do
// mês pela série mensal (buscada ou embutida); meses futuros, a média dos últimos 12
export function trFunction(rates: MarketRates, dueDay?: number): (ym: string) => number {
  const proj = projectedTr(rates);
  const due = dueDay !== undefined && rates.trDue?.day === dueDay ? rates.trDue.byMonth : {};
  return (ym) => due[ym] ?? rates.trByMonth[ym] ?? embeddedTr(ym) ?? proj;
}

export const trAnnual = (rates: MarketRates) => monthlyToAnnual(projectedTr(rates));
export const poupancaAnnual = (rates: MarketRates) => monthlyToAnnual(rates.latest.poupancaMonth.value);

// Vale atualizar ao abrir: nunca buscou, ou a última busca foi há mais de 12 horas
export function shouldRefresh(rates: MarketRates, now = Date.now()): boolean {
  if (!rates.fetchedAt) return true;
  return now - new Date(rates.fetchedAt).getTime() > 12 * 60 * 60 * 1000;
}

export const RATE_INFO: Record<RateKey, { label: string; short: string; unit: string; explain: string }> = {
  selic: {
    label: 'Selic',
    short: 'Juros básicos da economia',
    unit: '% a.a.',
    explain:
      'A taxa que o Banco Central usa para controlar a inflação. Quando sobe, investimentos rendem mais e crédito novo fica mais caro.',
  },
  cdi: {
    label: 'CDI',
    short: 'Referência dos investimentos',
    unit: '% a.a.',
    explain: 'Anda colado na Selic. CDBs, LCIs e LCAs costumam render um percentual do CDI (ex.: 100% do CDI).',
  },
  trMonth: {
    label: 'TR',
    short: 'Corrige o seu saldo',
    unit: '% a.m.',
    explain:
      'A Taxa Referencial corrige o saldo devedor de muitos financiamentos (Caixa, SFH) todo mês. Por isso o saldo às vezes cai menos do que você esperava.',
  },
  ipcaMonth: {
    label: 'IPCA do mês',
    short: 'Inflação do mês',
    unit: '%',
    explain: 'A inflação oficial medida no último mês.',
  },
  ipca12: {
    label: 'IPCA 12 meses',
    short: 'Inflação acumulada',
    unit: '%',
    explain:
      'Quanto os preços subiram em 12 meses. Uma dívida corrigida só pela TR fica, na prática, mais "barata" quando a inflação é alta.',
  },
  poupancaMonth: {
    label: 'Poupança',
    short: 'Rendimento no mês',
    unit: '% a.m.',
    explain: 'Com a Selic acima de 8,5%, a poupança rende 0,5% ao mês + TR, sem imposto de renda.',
  },
  mortgageMarket: {
    label: 'Financiamento (mercado)',
    short: 'Taxa média dos bancos',
    unit: '% a.a.',
    explain: 'Média das taxas de financiamento imobiliário com taxas de mercado, contratadas no mês.',
  },
  mortgageRegulated: {
    label: 'Financiamento (SFH/reguladas)',
    short: 'Taxa média regulada',
    unit: '% a.a.',
    explain: 'Média das taxas reguladas (SFH, Minha Casa Minha Vida, recursos da poupança e FGTS).',
  },
  mortgageAll: {
    label: 'Financiamento (geral)',
    short: 'Média de todos os contratos',
    unit: '% a.a.',
    explain: 'Média ponderada de todo o financiamento imobiliário para pessoas físicas no mês.',
  },
};
