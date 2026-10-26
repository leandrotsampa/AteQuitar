// Geometria pura dos gráficos SVG (escala, linhas, áreas, arcos e marcas do eixo)

type Point = { x: number; y: number };

// Arredonda para 2 casas e troca -0 por 0, para o "d" do path ficar curto e estável
const fmt = (v: number): string => String(Math.round(v * 100) / 100 || 0);

export function clamp(v: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, v));
}

export function linearScale(domain: [number, number], range: [number, number]): (v: number) => number {
  const [d0, d1] = domain;
  const [r0, r1] = range;
  if (d1 === d0) return () => (r0 + r1) / 2;
  return (v) => r0 + ((v - d0) / (d1 - d0)) * (r1 - r0);
}

// Curva cúbica monotônica (Fritsch–Carlson): passa por todos os pontos sem ultrapassar os dados
export function linePath(points: Point[]): string {
  const n = points.length;
  if (n === 0) return '';
  if (n === 1) return `M ${fmt(points[0].x)} ${fmt(points[0].y)}`;

  const dx: number[] = [];
  const slope: number[] = [];
  for (let i = 0; i < n - 1; i++) {
    dx[i] = points[i + 1].x - points[i].x;
    slope[i] = dx[i] === 0 ? 0 : (points[i + 1].y - points[i].y) / dx[i];
  }

  // Tangentes em cada ponto; zero onde a inclinação muda de sinal (evita "barrigas")
  const t: number[] = [slope[0]];
  for (let i = 1; i < n - 1; i++) {
    const a = slope[i - 1];
    const b = slope[i];
    if (a * b <= 0) {
      t[i] = 0;
    } else {
      const w1 = 2 * dx[i] + dx[i - 1];
      const w2 = dx[i] + 2 * dx[i - 1];
      t[i] = (w1 + w2) / (w1 / a + w2 / b);
    }
  }
  t[n - 1] = slope[n - 2];

  let d = `M ${fmt(points[0].x)} ${fmt(points[0].y)}`;
  for (let i = 0; i < n - 1; i++) {
    const p0 = points[i];
    const p1 = points[i + 1];
    const h = dx[i] / 3;
    d += ` C ${fmt(p0.x + h)} ${fmt(p0.y + h * t[i])} ${fmt(p1.x - h)} ${fmt(p1.y - h * t[i + 1])} ${fmt(p1.x)} ${fmt(p1.y)}`;
  }
  return d;
}

export function areaPath(points: Point[], baselineY: number): string {
  if (points.length === 0) return '';
  const first = points[0];
  const last = points[points.length - 1];
  return `${linePath(points)} L ${fmt(last.x)} ${fmt(baselineY)} L ${fmt(first.x)} ${fmt(baselineY)} Z`;
}

// Arco em graus no sistema da tela (0° = direita, 90° = baixo, 270° = cima)
export function arcPath(cx: number, cy: number, r: number, startDeg: number, endDeg: number): string {
  const rad = (deg: number) => (deg * Math.PI) / 180;
  const sx = cx + r * Math.cos(rad(startDeg));
  const sy = cy + r * Math.sin(rad(startDeg));
  const ex = cx + r * Math.cos(rad(endDeg));
  const ey = cy + r * Math.sin(rad(endDeg));
  const large = Math.abs(endDeg - startDeg) > 180 ? 1 : 0;
  const sweep = endDeg >= startDeg ? 1 : 0;
  return `M ${fmt(sx)} ${fmt(sy)} A ${fmt(r)} ${fmt(r)} 0 ${large} ${sweep} ${fmt(ex)} ${fmt(ey)}`;
}

// Marcas "redondas" do zero até cobrir o máximo (passo de 1, 2, 2,5 ou 5 × 10^k)
export function niceTicks(max: number, count = 4): number[] {
  if (!(max > 0) || count < 2) return [0];
  const raw = max / (count - 1);
  const magnitude = Math.pow(10, Math.floor(Math.log10(raw)));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * magnitude).find((s) => s >= raw) ?? 10 * magnitude;
  const ticks: number[] = [];
  for (let v = 0; v < max + step / 2 && ticks.length < 20; v += step) ticks.push(v);
  if (ticks[ticks.length - 1] < max) ticks.push(ticks[ticks.length - 1] + step);
  return ticks;
}

// Índice ainda válido para uma lista de n itens (o do mouse pode sobrar quando a lista encolhe)
export function validIndex(i: number | null, n: number): number | null {
  return i !== null && i >= 0 && i < n ? i : null;
}
