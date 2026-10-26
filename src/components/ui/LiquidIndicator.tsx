import React, { useEffect, useLayoutEffect, useRef } from 'react';
import { animate, motion, useMotionValue, useReducedMotion, useTransform } from 'motion/react';
import { crossScale, edgeSprings } from '../../lib/liquid';

// Destaque que "escorre" até o item ativo: a ponta da frente sai primeiro, o corpo estica e afina,
// e a ponta de trás alcança depois. Fica dentro de um container com position: relative e
// segue o elemento marcado com data-liquid-active="true".
export const LiquidIndicator: React.FC<{
  containerRef: React.RefObject<HTMLElement | null>;
  axis: 'x' | 'y';
  // Muda quando o item ativo muda: o destaque escorre até ele
  activeKey: string;
  // Muda quando o layout muda (ex.: menu expandindo): reposiciona sem escorrer
  layoutKey?: string;
  className?: string;
}> = ({ containerRef, axis, activeKey, layoutKey, className }) => {
  const reduceMotion = Boolean(useReducedMotion());
  const start = useMotionValue(0);
  const end = useMotionValue(0);
  const cross = useMotionValue(0);
  const crossSize = useMotionValue(0);
  const restSize = useRef(0);
  const placed = useRef(false);

  const length = useTransform(() => Math.max(0, end.get() - start.get()));
  const thinning = useTransform(() => crossScale(length.get(), restSize.current));

  const measure = (animated: boolean) => {
    const el = containerRef.current?.querySelector<HTMLElement>('[data-liquid-active="true"]');
    if (!el) return;
    const s = axis === 'y' ? el.offsetTop : el.offsetLeft;
    const size = axis === 'y' ? el.offsetHeight : el.offsetWidth;
    restSize.current = size;
    cross.set(axis === 'y' ? el.offsetLeft : el.offsetTop);
    crossSize.set(axis === 'y' ? el.offsetWidth : el.offsetHeight);
    if (!animated || !placed.current || reduceMotion) {
      start.stop();
      end.stop();
      start.set(s);
      end.set(s + size);
      placed.current = true;
      return;
    }
    const springs = edgeSprings(start.get(), s);
    animate(start, s, springs.start);
    animate(end, s + size, springs.end);
  };
  const measureRef = useRef(measure);
  measureRef.current = measure;

  // Troca de item: escorre
  useLayoutEffect(() => {
    measureRef.current(true);
  }, [activeKey]);

  // Troca de layout: reposiciona na hora e de novo quando as transições de tamanho assentarem
  useLayoutEffect(() => {
    measureRef.current(false);
    const t = window.setTimeout(() => measureRef.current(false), 450);
    return () => window.clearTimeout(t);
  }, [layoutKey]);

  // Container mudou de tamanho (janela, fontes carregando)
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const ro = new ResizeObserver(() => measureRef.current(false));
    ro.observe(container);
    let alive = true;
    document.fonts?.ready.then(() => alive && measureRef.current(false));
    return () => {
      alive = false;
      ro.disconnect();
      start.stop();
      end.stop();
    };
  }, [containerRef, start, end]);

  const style =
    axis === 'y'
      ? { top: start, height: length, left: cross, width: crossSize, scaleX: thinning }
      : { left: start, width: length, top: cross, height: crossSize, scaleY: thinning };

  return <motion.span aria-hidden="true" className={`pointer-events-none absolute ${className ?? ''}`} style={style} />;
};
