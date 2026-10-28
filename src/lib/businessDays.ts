// Dias úteis bancários: a TR de um período corre por eles (sem fins de semana e feriados
// nacionais). Conferido no saldo da Caixa: de 05/10 a 05/11/2026 são 21 dias úteis, e em 26/10
// tinham passado 14

// Domingo de Páscoa (algoritmo de Meeus/Jones/Butcher)
function easter(year: number): Date {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(year, month - 1, day);
}

const key = (d: Date) => `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
const cache = new Map<number, Set<string>>();

function holidays(year: number): Set<string> {
  const known = cache.get(year);
  if (known) return known;
  const fixed = ['1-1', '4-21', '5-1', '9-7', '10-12', '11-2', '11-15', '12-25'];
  // Consciência Negra é feriado nacional desde 2024
  if (year >= 2024) fixed.push('11-20');
  const set = new Set(fixed.map((md) => `${year}-${md}`));
  const e = easter(year);
  // Carnaval (segunda e terça), Sexta-feira Santa e Corpus Christi
  for (const offset of [-48, -47, -2, 60]) set.add(key(new Date(e.getFullYear(), e.getMonth(), e.getDate() + offset)));
  cache.set(year, set);
  return set;
}

export function isBusinessDay(d: Date): boolean {
  const w = d.getDay();
  return w !== 0 && w !== 6 && !holidays(d.getFullYear()).has(key(d));
}

// Dias úteis de `from` (incluído) até `to` (excluído), contando só as datas
export function businessDaysBetween(from: Date, to: Date): number {
  let n = 0;
  const d = new Date(from.getFullYear(), from.getMonth(), from.getDate());
  const end = new Date(to.getFullYear(), to.getMonth(), to.getDate());
  while (d < end) {
    if (isBusinessDay(d)) n++;
    d.setDate(d.getDate() + 1);
  }
  return n;
}
