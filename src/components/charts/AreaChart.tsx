import React, { useEffect, useId, useRef, useState } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import { areaPath, linePath, linearScale, niceTicks, validIndex } from '../../lib/chartGeometry';
import { DURATION, EASE_OUT, instantIf } from '../../lib/motion';
import { ChartTooltip } from './ChartTooltip';
import { TONES, type ChartTone } from './tones';

export interface AreaSeries {
  key: string;
  label: string;
  tone: ChartTone;
  values: number[];
  kind: 'area' | 'line';
  axis: 'left' | 'right';
}

interface AreaChartProps {
  series: AreaSeries[];
  labels: string[];
  threshold?: { axis: 'right'; value: number; label: string };
  formatLeft: (n: number) => string;
  formatRight: (n: number) => string;
  // Conteúdo do tooltip do mês sob o cursor (padrão: cada série formatada)
  tooltip?: (index: number) => React.ReactNode;
  height?: number;
  // Linha vertical marcando um ponto (ex.: "hoje")
  marker?: { index: number; label: string };
}

const PAD = { left: 72, right: 28, top: 18, bottom: 28 };

// Gráfico de área/linha com dois eixos, meta tracejada e detalhes ao passar o mouse
export const AreaChart: React.FC<AreaChartProps> = ({
  series,
  labels,
  threshold,
  formatLeft,
  formatRight,
  tooltip,
  height = 260,
  marker,
}) => {
  const reduceMotion = Boolean(useReducedMotion());
  const uid = useId().replace(/:/g, '');
  const boxRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  const [rawHover, setHover] = useState<number | null>(null);

  useEffect(() => {
    const el = boxRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => setWidth(Math.round(entry.contentRect.width)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const n = labels.length;
  // O mês sob o mouse pode deixar de existir quando o intervalo encolhe (ex.: 12 → 6 meses)
  const hover = validIndex(rawHover, n);
  const innerW = Math.max(0, width - PAD.left - PAD.right);
  const bottom = height - PAD.bottom;

  const finite = (vs: number[]) => vs.filter((v) => Number.isFinite(v));
  const leftMax = Math.max(0, ...series.filter((s) => s.axis === 'left').flatMap((s) => finite(s.values)));
  const rightMax = Math.max(threshold?.value ?? 0, ...series.filter((s) => s.axis === 'right').flatMap((s) => finite(s.values)));
  const leftTicks = niceTicks(leftMax, 4);
  const hasRight = Boolean(threshold) || series.some((s) => s.axis === 'right');
  const rightTicks = hasRight ? niceTicks(rightMax * 1.1, 4) : [];
  const yLeft = linearScale([0, leftTicks[leftTicks.length - 1] || 1], [bottom, PAD.top]);
  const yRight = linearScale([0, rightTicks[rightTicks.length - 1] || 1], [bottom, PAD.top]);
  const x = n > 1 ? linearScale([0, n - 1], [PAD.left, PAD.left + innerW]) : () => PAD.left + innerW / 2;

  const pointsOf = (s: AreaSeries) =>
    s.values.map((v, i) => ({ x: x(i), y: (s.axis === 'left' ? yLeft : yRight)(Number.isFinite(v) ? v : 0) }));

  // Rótulos do eixo X sem encavalar (contados a partir do último mês, que sempre aparece)
  const labelEvery = Math.max(1, Math.ceil(n / Math.max(1, Math.floor(innerW / 56))));

  const onMove = (e: React.MouseEvent<SVGRectElement>) => {
    if (n === 0) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const px = e.clientX - rect.left;
    const i = n > 1 ? Math.round(((px / rect.width) * (n - 1))) : 0;
    setHover(Math.min(n - 1, Math.max(0, i)));
  };

  const draw = instantIf(reduceMotion, { duration: DURATION.chart, ease: EASE_OUT });
  // Mudar o conjunto de meses (ex.: 12 → 6) redesenha as curvas do zero
  const drawKey = labels.join('|');

  return (
    <div ref={boxRef} className="relative w-full" style={{ height }}>
      {width > 0 && (
        <svg width={width} height={height} className="block overflow-visible" aria-hidden="true">
          <defs>
            {series
              .filter((s) => s.kind === 'area')
              .map((s) => (
                <linearGradient key={s.key} id={`${uid}-${s.key}`} x1="0" y1="0" x2="0" y2="1" className={TONES[s.tone].color}>
                  <stop offset="0%" stopColor="currentColor" stopOpacity={0.28} />
                  <stop offset="100%" stopColor="currentColor" stopOpacity={0} />
                </linearGradient>
              ))}
          </defs>

          {/* Grade e eixos */}
          {leftTicks.map((t) => (
            <g key={`l${t}`}>
              <line x1={PAD.left} x2={PAD.left + innerW} y1={yLeft(t)} y2={yLeft(t)} className="stroke-slate-200/80 dark:stroke-white/5" strokeDasharray={t === 0 ? undefined : '3 4'} />
              <text x={PAD.left - 10} y={yLeft(t)} dy="0.32em" textAnchor="end" className="fill-slate-500 dark:fill-slate-400 text-[11px] font-num">
                {formatLeft(t)}
              </text>
            </g>
          ))}
          {rightTicks.map((t) => (
            <text key={`r${t}`} x={PAD.left + innerW + 10} y={yRight(t)} dy="0.32em" className="fill-slate-500 dark:fill-slate-400 text-[11px] font-num">
              {formatRight(t)}
            </text>
          ))}
          {labels.map((l, i) =>
            (n - 1 - i) % labelEvery === 0 ? (
              <text key={`x${i}`} x={x(i)} y={height - 8} textAnchor="middle" className="fill-slate-500 dark:fill-slate-400 text-[11px] font-num">
                {l}
              </text>
            ) : null
          )}

          <g key={drawKey}>
            {/* Áreas atrás, linhas na frente */}
            {series
              .filter((s) => s.kind === 'area')
              .map((s) => (
                <motion.path
                  key={`a${s.key}`}
                  d={areaPath(pointsOf(s), bottom)}
                  fill={`url(#${uid}-${s.key})`}
                  initial={reduceMotion ? false : { opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={instantIf(reduceMotion, { duration: DURATION.chart, delay: 0.15 })}
                />
              ))}
            {series.map((s) => (
              <motion.path
                key={`p${s.key}`}
                d={linePath(pointsOf(s))}
                fill="none"
                strokeWidth={s.kind === 'line' ? 2.25 : 2}
                strokeLinecap="round"
                strokeLinejoin="round"
                className={TONES[s.tone].stroke}
                initial={reduceMotion ? false : { pathLength: 0 }}
                animate={{ pathLength: 1 }}
                transition={draw}
              />
            ))}
            {n === 1 &&
              series.map((s) => (
                <circle key={`one${s.key}`} cx={x(0)} cy={pointsOf(s)[0]?.y ?? bottom} r={4} className={TONES[s.tone].fill} />
              ))}
          </g>

          {/* Meta tracejada no eixo da direita */}
          {threshold && (
            <g>
              <line
                x1={PAD.left}
                x2={PAD.left + innerW}
                y1={yRight(threshold.value)}
                y2={yRight(threshold.value)}
                strokeDasharray="6 5"
                strokeWidth={1.5}
                className="stroke-sky-500/70 dark:stroke-sky-400/70"
              />
              <text x={PAD.left + 6} y={yRight(threshold.value) - 6} className="fill-sky-600 dark:fill-sky-400 text-[11px] font-semibold">
                {threshold.label}
              </text>
            </g>
          )}

          {marker && marker.index >= 0 && marker.index < n && (
            <g>
              <line x1={x(marker.index)} x2={x(marker.index)} y1={PAD.top - 4} y2={bottom} strokeWidth={1.5} strokeDasharray="4 4" className="stroke-sol-500 dark:stroke-sol-300" />
              <rect x={x(marker.index) - 22} y={PAD.top - 16} width={44} height={18} rx={9} className="fill-sol-400 dark:fill-sol-300" />
              <text x={x(marker.index)} y={PAD.top - 7} dy="0.32em" textAnchor="middle" className="fill-slate-900 text-[11px] font-bold">
                {marker.label}
              </text>
            </g>
          )}

          {/* Cursor: linha vertical e pontos do mês */}
          {hover !== null && (
            <g>
              <line x1={x(hover)} x2={x(hover)} y1={PAD.top} y2={bottom} className="stroke-slate-300 dark:stroke-slate-600" strokeDasharray="3 3" />
              {series.map((s) => {
                const p = pointsOf(s)[hover];
                return p ? (
                  <circle key={`h${s.key}`} cx={p.x} cy={p.y} r={4} strokeWidth={2} className={`${TONES[s.tone].fill} stroke-white dark:stroke-slate-900`} />
                ) : null;
              })}
            </g>
          )}

          <rect
            x={PAD.left - 12}
            y={PAD.top}
            width={innerW + 24}
            height={bottom - PAD.top}
            fill="transparent"
            onMouseMove={onMove}
            onMouseLeave={() => setHover(null)}
          />
        </svg>
      )}

      {hover !== null && width > 0 && (
        <ChartTooltip x={x(hover)} y={(PAD.top + bottom) / 2} containerWidth={width}>
          {tooltip ? (
            tooltip(hover)
          ) : (
            <>
              <div className="font-semibold text-slate-900 dark:text-white mb-1">{labels[hover]}</div>
              {series.map((s) => (
                <div key={s.key} className="flex items-center justify-between gap-4">
                  <span className="flex items-center gap-1.5 text-slate-500 dark:text-slate-400">
                    <span className={`w-2 h-2 rounded-full bg-current ${TONES[s.tone].color}`} />
                    {s.label}
                  </span>
                  <span className="font-num font-semibold text-slate-900 dark:text-white">
                    {(s.axis === 'left' ? formatLeft : formatRight)(s.values[hover] ?? 0)}
                  </span>
                </div>
              ))}
            </>
          )}
        </ChartTooltip>
      )}
    </div>
  );
};
