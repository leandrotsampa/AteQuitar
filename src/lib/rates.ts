// Taxas do mercado pela API pública do Banco Central (SGS). Sem chave e com CORS liberado.
// Se a internet faltar, valem os últimos valores guardados ou os de referência abaixo.
import { addMonths, currentYearMonth, monthlyToAnnual } from './format';

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

async function fetchSeries(code: number, query: string, signal?: AbortSignal): Promise<RatePoint[]> {
  const url = `https://api.bcb.gov.br/dados/serie/bcdata.sgs.${code}/dados${query}${query.includes('?') ? '&' : '?'}formato=json`;
  const res = await fetch(url, { signal });
  if (!res.ok) throw new Error(`SGS ${code}: HTTP ${res.status}`);
  const raw = (await res.json()) as { data: string; valor: string }[];
  if (!Array.isArray(raw)) throw new Error(`SGS ${code}: resposta inesperada`);
  const today = new Date().toISOString().slice(0, 10);
  return raw
    .map((p) => ({ date: toIso(p.data), value: Number(p.valor) }))
    .filter((p) => Number.isFinite(p.value) && p.date <= today)
    .sort((a, b) => a.date.localeCompare(b.date));
}

// Busca tudo; uma série que falhar mantém o valor anterior
export async function fetchMarketRates(
  previous: MarketRates,
  trSinceYm: string | null,
  signal?: AbortSignal
): Promise<{ rates: MarketRates; failed: RateKey[] }> {
  const keys = Object.keys(SGS) as RateKey[];
  const failed: RateKey[] = [];
  const latest = { ...previous.latest };
  const history = { ...previous.history };

  await Promise.all(
    keys.map(async (key) => {
      try {
        // Por período (o modo "últimos N" da API aceita no máximo 20 valores):
        // séries diárias, os últimos 6 meses; mensais, os últimos 2 anos
        const daily = key === 'selic' || key === 'cdi' || key === 'poupancaMonth';
        const since = addMonths(currentYearMonth(), daily ? -6 : -24);
        const points = await fetchSeries(SGS[key], `?dataInicial=${toBr(since)}`, signal);
        if (points.length === 0) throw new Error('vazia');
        latest[key] = points[points.length - 1];
        // Diárias: um ponto por semana para o mini gráfico
        history[key] = daily ? points.filter((_, i) => i % 5 === 0 || i === points.length - 1) : points;
      } catch {
        failed.push(key);
      }
    })
  );

  // TR mês a mês desde a 1ª parcela (a série mensal não tem limite de 10 anos)
  let trByMonth = { ...previous.trByMonth };
  if (trSinceYm) {
    try {
      const pts = await fetchSeries(SGS.trMonth, `?dataInicial=${toBr(addMonths(trSinceYm, -1))}`, signal);
      trByMonth = { ...trByMonth };
      for (const p of pts) trByMonth[p.date.slice(0, 7)] = p.value;
    } catch {
      if (!failed.includes('trMonth')) failed.push('trMonth');
    }
  }

  const ok = failed.length < keys.length;
  return {
    rates: { fetchedAt: ok ? new Date().toISOString() : previous.fetchedAt, latest, history, trByMonth },
    failed,
  };
}

// TR média dos últimos 12 meses conhecidos (% a.m.): a projeção para os meses futuros
export function projectedTr(rates: MarketRates): number {
  const months = Object.keys(rates.trByMonth).sort().slice(-12);
  if (months.length === 0) return rates.latest.trMonth.value;
  return months.reduce((a, m) => a + rates.trByMonth[m], 0) / months.length;
}

export function trFunction(rates: MarketRates): (ym: string) => number {
  const proj = projectedTr(rates);
  const now = currentYearMonth();
  return (ym) => rates.trByMonth[ym] ?? (ym <= now ? proj : proj);
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
