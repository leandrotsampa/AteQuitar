// Física do indicador "líquido": as duas pontas andam com molas diferentes,
// então ele estica a caminho do destino (como água passando de um pote para outro)
// e afina no meio para parecer que conserva o volume.

export const LEAD_SPRING = { type: 'spring', stiffness: 520, damping: 40, mass: 0.8 } as const;
export const TRAIL_SPRING = { type: 'spring', stiffness: 170, damping: 22, mass: 1 } as const;

type Spring = typeof LEAD_SPRING | typeof TRAIL_SPRING;

// Na direção do movimento a ponta da frente lidera; a de trás vem escorrendo
export function edgeSprings(fromStart: number, toStart: number): { start: Spring; end: Spring } {
  return toStart >= fromStart ? { start: TRAIL_SPRING, end: LEAD_SPRING } : { start: LEAD_SPRING, end: TRAIL_SPRING };
}

const MIN_CROSS_SCALE = 0.45;

// Espessura relativa quando o comprimento passa do tamanho de repouso (área constante, com limites)
export function crossScale(length: number, restSize: number): number {
  if (restSize <= 0 || length <= restSize) return 1;
  return Math.max(MIN_CROSS_SCALE, Math.sqrt(restSize / length));
}
