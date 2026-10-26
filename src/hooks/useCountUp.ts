import { useEffect, useRef, useState } from 'react';
import { easeOutCubic, lerp, prefersReducedMotion } from '../lib/motion';

// Valor exibido num instante da contagem; no fim devolve exatamente o alvo
export function countUpFrame(from: number, to: number, elapsedMs: number, durationMs: number): number {
  if (durationMs <= 0 || elapsedMs >= durationMs) return to;
  return lerp(from, to, easeOutCubic(Math.max(0, elapsedMs) / durationMs));
}

// A contagem acabou (alvo inválido também encerra, para o rAF não rodar para sempre)
export function isFinalFrame(shown: number, to: number): boolean {
  return shown === to || !Number.isFinite(to);
}

// Só na abertura do app os números contam a partir do zero; depois, uma tela que volta
// mostra o valor direto e só as mudanças animam
export const INTRO_WINDOW_MS = 1500;
let introStartedAt: number | null = null;

export function startValueFor(value: number, msSinceIntro: number): number {
  return msSinceIntro < INTRO_WINDOW_MS ? 0 : value;
}

function initialShown(value: number): number {
  if (prefersReducedMotion() || !Number.isFinite(value)) return value;
  const now = performance.now();
  if (introStartedAt === null) introStartedAt = now;
  return startValueFor(value, now - introStartedAt);
}

// Número que conta até `value`. Se o valor mudar no meio (ex.: digitando o faturamento),
// recomeça a partir do que está na tela, nunca do zero.
export function useCountUp(value: number, durationMs = 450): number {
  const [shown, setShown] = useState(() => initialShown(value));
  const shownRef = useRef(shown);

  useEffect(() => {
    if (prefersReducedMotion() || !Number.isFinite(value)) {
      shownRef.current = value;
      setShown(value);
      return;
    }
    const from = shownRef.current;
    if (isFinalFrame(from, value)) return;
    let frame = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const v = countUpFrame(from, value, now - start, durationMs);
      shownRef.current = v;
      setShown(v);
      if (!isFinalFrame(v, value)) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [value, durationMs]);

  return shown;
}
