// Parâmetros de animação compartilhados (durações em segundos, no formato do motion)
export const DURATION = { micro: 0.15, base: 0.25, number: 0.45, chart: 0.7, theme: 0.6 } as const;
export const EASE_OUT = [0.22, 1, 0.36, 1] as const;

export function easeOutCubic(t: number): number {
  return 1 - Math.pow(1 - t, 3);
}

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

// Respeita a preferência do sistema por menos movimento (falso fora do navegador)
export function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

// MotionConfig reducedMotion="user" só corta transform e layout; largura, altura e pathLength
// passam por aqui para também ficarem instantâneos com movimento reduzido
export function instantIf<T extends object>(reduce: boolean, transition: T): T | { duration: 0 } {
  return reduce ? { duration: 0 } : transition;
}
