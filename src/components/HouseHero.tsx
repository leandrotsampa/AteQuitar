import React, { useId } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import { instantIf } from '../lib/motion';

// A casa que se enche conforme o financiamento é quitado. Cada 10% acende uma luz:
// a porta primeiro, depois as janelas de baixo para cima e, no fim, a janela redonda do sótão.
// De dia no tema claro; à noite, com estrelas, no escuro.

const BODY = { x: 108, y: 152, w: 184, h: 132 };
const BOTTOM = BODY.y + BODY.h; // 284
const TOP = 66; // cumeeira

type Light = { kind: 'door' | 'window' | 'round'; x: number; y: number; w: number; h: number };
const LIGHTS: Light[] = [
  { kind: 'door', x: 186, y: 236, w: 28, h: 48 },
  { kind: 'window', x: 128, y: 244, w: 34, h: 26 },
  { kind: 'window', x: 238, y: 244, w: 34, h: 26 },
  { kind: 'window', x: 128, y: 200, w: 34, h: 26 },
  { kind: 'window', x: 183, y: 200, w: 34, h: 26 },
  { kind: 'window', x: 238, y: 200, w: 34, h: 26 },
  { kind: 'window', x: 128, y: 162, w: 34, h: 24 },
  { kind: 'window', x: 183, y: 162, w: 34, h: 24 },
  { kind: 'window', x: 238, y: 162, w: 34, h: 24 },
  { kind: 'round', x: 200, y: 118, w: 26, h: 26 },
];

const STARS = [
  [40, 40], [74, 92], [330, 36], [362, 96], [300, 70], [24, 130], [120, 30], [376, 150], [250, 24], [60, 170],
];

// Uma onda larga (o dobro da largura) que desliza para os lados e parece infinita
const wavePath = (amp: number, len: number) => {
  let d = `M 0 0`;
  for (let x = 0; x <= 800; x += len) {
    d += ` Q ${x + len / 4} ${-amp} ${x + len / 2} 0 T ${x + len} 0`;
  }
  return `${d} L 800 400 L 0 400 Z`;
};

export const HouseHero: React.FC<{ progress: number; dark: boolean; className?: string }> = ({ progress, dark, className }) => {
  const reduce = Boolean(useReducedMotion());
  const uid = useId().replace(/:/g, '');
  const p = Math.min(1, Math.max(0, progress));
  const level = BOTTOM - p * (BOTTOM - TOP);
  const lit = Math.floor(p * 10 + 1e-9);
  const fill = { type: 'spring', stiffness: 40, damping: 14, mass: 1.2 } as const;

  return (
    <svg viewBox="0 0 400 320" className={className} role="img" aria-label={`Casa ${Math.round(p * 100)}% quitada`}>
      <defs>
        <linearGradient id={`${uid}-sky`} x1="0" y1="0" x2="0" y2="1">
          {dark ? (
            <>
              <stop offset="0%" stopColor="#141238" />
              <stop offset="100%" stopColor="#2b2a6b" />
            </>
          ) : (
            <>
              <stop offset="0%" stopColor="#b9c6ff" />
              <stop offset="100%" stopColor="#f3f0ff" />
            </>
          )}
        </linearGradient>
        <linearGradient id={`${uid}-water`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={dark ? '#7f86f8' : '#6164f1'} />
          <stop offset="100%" stopColor={dark ? '#3631a2' : '#4139c9'} />
        </linearGradient>
        <radialGradient id={`${uid}-glow`}>
          <stop offset="0%" stopColor="#ffca4d" stopOpacity="0.85" />
          <stop offset="100%" stopColor="#ffca4d" stopOpacity="0" />
        </radialGradient>
        <clipPath id={`${uid}-house`}>
          <path d={`M ${BODY.x} ${BODY.y} L 200 ${TOP} L ${BODY.x + BODY.w} ${BODY.y} L ${BODY.x + BODY.w} ${BOTTOM} L ${BODY.x} ${BOTTOM} Z`} />
        </clipPath>
        <clipPath id={`${uid}-frame`}>
          <rect x="0" y="0" width="400" height="320" rx="28" />
        </clipPath>
      </defs>

      <g clipPath={`url(#${uid}-frame)`}>
        <rect width="400" height="320" fill={`url(#${uid}-sky)`} />

        {/* Céu: estrelas e lua à noite; sol e nuvens de dia */}
        {dark ? (
          <>
            {STARS.map(([x, y], k) => (
              <circle key={k} cx={x} cy={y} r={k % 3 === 0 ? 1.8 : 1.2} fill="#fff" className="twinkle" style={{ animationDelay: `${k * 0.37}s` }} />
            ))}
            <circle cx="336" cy="62" r="20" fill="#fff6dc" />
            <circle cx="345" cy="55" r="18" fill="#141238" />
          </>
        ) : (
          <>
            <circle cx="334" cy="64" r="34" fill="#ffca4d" opacity="0.25" />
            <circle cx="334" cy="64" r="22" fill="#ffca4d" />
            <g className="drift" opacity="0.9">
              <ellipse cx="78" cy="70" rx="30" ry="11" fill="#fff" />
              <ellipse cx="96" cy="62" rx="20" ry="11" fill="#fff" />
            </g>
            <g className="drift" style={{ animationDelay: '-6s' }} opacity="0.75">
              <ellipse cx="262" cy="40" rx="24" ry="8" fill="#fff" />
            </g>
          </>
        )}

        {/* Morro */}
        <ellipse cx="200" cy="330" rx="300" ry="58" fill={dark ? '#1b1d45' : '#d9dcfb'} />
        <ellipse cx="60" cy="300" rx="90" ry="26" fill={dark ? '#22265a' : '#c9cdf7'} />

        {/* Chaminé com fumaça */}
        <rect x="248" y="88" width="20" height="40" rx="3" fill={dark ? '#3a3f72' : '#a6abe6'} />
        <circle cx="258" cy="82" r="6" fill={dark ? '#9aa0d8' : '#ffffff'} className="smoke" />
        <circle cx="258" cy="82" r="6" fill={dark ? '#9aa0d8' : '#ffffff'} className="smoke" style={{ animationDelay: '1.5s' }} />
        <circle cx="258" cy="82" r="6" fill={dark ? '#9aa0d8' : '#ffffff'} className="smoke" style={{ animationDelay: '3s' }} />

        {/* Casa vazia (o que falta pagar) */}
        <g clipPath={`url(#${uid}-house)`}>
          <rect x="90" y="60" width="220" height="230" fill={dark ? '#262b52' : '#ffffff'} />
          {/* O que já é seu: sobe como água, com ondas */}
          <motion.g initial={reduce ? false : { y: BOTTOM }} animate={{ y: level }} transition={instantIf(reduce, fill)}>
            <g className="wave-b" opacity="0.45">
              <path d={wavePath(5, 80)} fill={`url(#${uid}-water)`} transform="translate(0,-3)" />
            </g>
            <g className="wave-a">
              <path d={wavePath(4, 100)} fill={`url(#${uid}-water)`} />
            </g>
          </motion.g>
        </g>

        {/* Contorno: telhado e paredes */}
        <path
          d={`M ${BODY.x - 16} ${BODY.y + 4} L 200 ${TOP - 10} L ${BODY.x + BODY.w + 16} ${BODY.y + 4}`}
          fill="none"
          stroke={dark ? '#a4affc' : '#302e80'}
          strokeWidth="10"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <rect
          x={BODY.x}
          y={BODY.y}
          width={BODY.w}
          height={BODY.h}
          fill="none"
          stroke={dark ? '#a4affc' : '#302e80'}
          strokeWidth="5"
          rx="3"
        />

        {/* Luzes: uma a cada 10% */}
        {LIGHTS.map((l, k) => {
          const on = k < lit;
          const delay = reduce ? 0 : 0.8 + k * 0.12;
          const off = dark ? '#1a1d3d' : '#e5e8f4';
          const frame = dark ? '#a4affc' : '#302e80';
          return (
            <g key={k}>
              {on && (
                <motion.circle
                  cx={l.x + (l.kind === 'round' ? 0 : l.w / 2)}
                  cy={l.y + (l.kind === 'round' ? 0 : l.h / 2)}
                  r={l.kind === 'door' ? 36 : 28}
                  fill={`url(#${uid}-glow)`}
                  initial={reduce ? false : { opacity: 0 }}
                  animate={{ opacity: dark ? 0.9 : 0.55 }}
                  transition={{ delay, duration: 0.6 }}
                />
              )}
              {l.kind === 'round' ? (
                <motion.circle
                  cx={l.x}
                  cy={l.y}
                  r={l.w / 2}
                  stroke={frame}
                  strokeWidth="4"
                  initial={false}
                  animate={{ fill: on ? '#ffca4d' : off }}
                  transition={{ delay, duration: 0.5 }}
                  className={on ? 'window-glow' : undefined}
                />
              ) : (
                <>
                  <motion.rect
                    x={l.x}
                    y={l.y}
                    width={l.w}
                    height={l.h}
                    rx={l.kind === 'door' ? 10 : 4}
                    stroke={frame}
                    strokeWidth="3.5"
                    initial={false}
                    animate={{ fill: on ? '#ffca4d' : off }}
                    transition={{ delay, duration: 0.5 }}
                    className={on ? 'window-glow' : undefined}
                  />
                  {l.kind === 'window' ? (
                    <>
                      <line x1={l.x + l.w / 2} x2={l.x + l.w / 2} y1={l.y} y2={l.y + l.h} stroke={frame} strokeWidth="2.5" />
                      <line x1={l.x} x2={l.x + l.w} y1={l.y + l.h / 2} y2={l.y + l.h / 2} stroke={frame} strokeWidth="2.5" />
                    </>
                  ) : (
                    <circle cx={l.x + l.w - 7} cy={l.y + l.h / 2 + 2} r="2.2" fill={frame} />
                  )}
                </>
              )}
            </g>
          );
        })}
      </g>
    </svg>
  );
};
