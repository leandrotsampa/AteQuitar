// Formatos no padrão brasileiro e contas de mês (AAAA-MM)

const brl = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
const brl0 = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });

export const formatBRL = (n: number): string => brl.format(Number.isFinite(n) ? n : 0);
export const formatBRL0 = (n: number): string => brl0.format(Number.isFinite(n) ? n : 0);

// R$ 1,2 mi / R$ 350 mil: para eixos e textos curtos
export function formatBRLShort(n: number): string {
  const abs = Math.abs(n);
  if (abs >= 1_000_000) return `R$ ${(n / 1_000_000).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} mi`;
  if (abs >= 1_000) return `R$ ${(n / 1_000).toLocaleString('pt-BR', { maximumFractionDigits: 0 })} mil`;
  return formatBRL0(n);
}

export const formatPct = (n: number, digits = 2): string =>
  `${(Number.isFinite(n) ? n : 0).toLocaleString('pt-BR', { minimumFractionDigits: digits, maximumFractionDigits: digits })}%`;

const MONTHS_SHORT = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
const MONTHS_LONG = [
  'janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',
  'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro',
];

export function currentYearMonth(date = new Date()): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

export function addMonths(ym: string, delta: number): string {
  const [y, m] = ym.split('-').map(Number);
  const total = y * 12 + (m - 1) + delta;
  return `${Math.floor(total / 12)}-${String((total % 12) + 1).padStart(2, '0')}`;
}

// Meses de a até b (b - a)
export function diffMonths(a: string, b: string): number {
  const [ya, ma] = a.split('-').map(Number);
  const [yb, mb] = b.split('-').map(Number);
  return (yb - ya) * 12 + (mb - ma);
}

export function monthShort(ym: string): string {
  const [y, m] = ym.split('-').map(Number);
  return `${MONTHS_SHORT[m - 1]}/${String(y).slice(2)}`;
}

export function monthLong(ym: string): string {
  const [y, m] = ym.split('-').map(Number);
  return `${MONTHS_LONG[m - 1]} de ${y}`;
}

export function monthName(ym: string): string {
  return MONTHS_LONG[Number(ym.split('-')[1]) - 1];
}

// "12 anos e 4 meses"
export function formatDuration(months: number): string {
  const m = Math.max(0, Math.round(months));
  const y = Math.floor(m / 12);
  const r = m % 12;
  const ys = y === 1 ? '1 ano' : `${y} anos`;
  const rs = r === 1 ? '1 mês' : `${r} meses`;
  if (y === 0) return rs;
  if (r === 0) return ys;
  return `${ys} e ${rs}`;
}

// Taxa anual ↔ mensal equivalentes (juros compostos), em %
export const annualToMonthly = (pctYear: number): number => (Math.pow(1 + pctYear / 100, 1 / 12) - 1) * 100;
export const monthlyToAnnual = (pctMonth: number): number => (Math.pow(1 + pctMonth / 100, 12) - 1) * 100;

export const uid = (): string => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
