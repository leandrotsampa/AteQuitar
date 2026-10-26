import React, { useEffect, useRef } from 'react';
import { prefersReducedMotion } from '../../lib/motion';

// Chuva de confete em tela cheia (canvas), disparada de qualquer lugar com celebrate()
const EVENT = 'atequitar:celebrate';
const COLORS = ['#6164f1', '#ffb524', '#ffca4d', '#34d399', '#f472b6', '#a4affc', '#ffffff'];

export function celebrate(origin?: { x: number; y: number }): void {
  window.dispatchEvent(new CustomEvent(EVENT, { detail: origin ?? null }));
}

interface Piece {
  x: number;
  y: number;
  vx: number;
  vy: number;
  w: number;
  h: number;
  rot: number;
  vr: number;
  color: string;
  life: number;
  shape: 'rect' | 'circle' | 'house';
}

export const ConfettiLayer: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const pieces = useRef<Piece[]>([]);
  const frame = useRef(0);

  useEffect(() => {
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext('2d')!;
    const resize = () => {
      const dpr = window.devicePixelRatio || 1;
      canvas.width = window.innerWidth * dpr;
      canvas.height = window.innerHeight * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    window.addEventListener('resize', resize);

    const drawHouse = (p: Piece) => {
      const s = p.w;
      ctx.beginPath();
      ctx.moveTo(-s / 2, 0);
      ctx.lineTo(0, -s / 2);
      ctx.lineTo(s / 2, 0);
      ctx.lineTo(s / 2, s / 2);
      ctx.lineTo(-s / 2, s / 2);
      ctx.closePath();
      ctx.fill();
    };

    const tick = () => {
      ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);
      pieces.current = pieces.current.filter((p) => p.life > 0 && p.y < window.innerHeight + 40);
      for (const p of pieces.current) {
        p.vy += 0.16;
        p.vx *= 0.99;
        p.x += p.vx;
        p.y += p.vy;
        p.rot += p.vr;
        p.life -= 1;
        ctx.save();
        ctx.globalAlpha = Math.min(1, p.life / 40);
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        ctx.fillStyle = p.color;
        if (p.shape === 'circle') {
          ctx.beginPath();
          ctx.arc(0, 0, p.w / 2, 0, Math.PI * 2);
          ctx.fill();
        } else if (p.shape === 'house') {
          drawHouse(p);
        } else {
          // "Papel" girando: a largura oscila para simular o giro em 3D
          ctx.fillRect(-p.w / 2, -p.h / 2, p.w * Math.abs(Math.cos(p.rot * 2)), p.h);
        }
        ctx.restore();
      }
      if (pieces.current.length > 0) frame.current = requestAnimationFrame(tick);
    };

    const onCelebrate = (e: Event) => {
      if (prefersReducedMotion()) return;
      const origin = (e as CustomEvent<{ x: number; y: number } | null>).detail;
      const bursts = origin
        ? [origin]
        : [
            { x: window.innerWidth * 0.25, y: window.innerHeight * 0.75 },
            { x: window.innerWidth * 0.75, y: window.innerHeight * 0.75 },
          ];
      for (const o of bursts) {
        for (let k = 0; k < 90; k++) {
          const angle = -Math.PI / 2 + (Math.random() - 0.5) * 1.4;
          const speed = 7 + Math.random() * 9;
          const r = Math.random();
          pieces.current.push({
            x: o.x,
            y: o.y,
            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed,
            w: 7 + Math.random() * 7,
            h: 10 + Math.random() * 8,
            rot: Math.random() * Math.PI,
            vr: (Math.random() - 0.5) * 0.3,
            color: COLORS[Math.floor(Math.random() * COLORS.length)],
            life: 160 + Math.random() * 80,
            shape: r < 0.12 ? 'house' : r < 0.4 ? 'circle' : 'rect',
          });
        }
      }
      cancelAnimationFrame(frame.current);
      frame.current = requestAnimationFrame(tick);
    };
    window.addEventListener(EVENT, onCelebrate);
    return () => {
      window.removeEventListener(EVENT, onCelebrate);
      window.removeEventListener('resize', resize);
      cancelAnimationFrame(frame.current);
    };
  }, []);

  return <canvas ref={canvasRef} aria-hidden="true" className="pointer-events-none fixed inset-0 z-[100] w-full h-full" />;
};
