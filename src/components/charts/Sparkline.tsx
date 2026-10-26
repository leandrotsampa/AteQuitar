import React from 'react';
import { motion, useReducedMotion } from 'motion/react';
import { linePath, linearScale } from '../../lib/chartGeometry';
import { DURATION, EASE_OUT, instantIf } from '../../lib/motion';
import { TONES, type ChartTone } from './tones';

// Mini gráfico de linha (tendência dos últimos meses); com menos de 2 valores não aparece
export const Sparkline: React.FC<{ values: number[]; tone: ChartTone; width?: number; height?: number }> = ({
  values,
  tone,
  width = 72,
  height = 24,
}) => {
  const reduceMotion = Boolean(useReducedMotion());
  const clean = values.filter((v) => Number.isFinite(v));
  if (clean.length < 2) return null;
  const pad = 2;
  const min = Math.min(...clean);
  const max = Math.max(...clean);
  const x = linearScale([0, clean.length - 1], [pad, width - pad]);
  const y = linearScale([min, max], [height - pad, pad]);
  const d = linePath(clean.map((v, i) => ({ x: x(i), y: y(v) })));
  const last = clean[clean.length - 1];
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} aria-hidden="true" className="overflow-visible">
      <motion.path
        d={d}
        fill="none"
        strokeWidth={1.75}
        strokeLinecap="round"
        strokeLinejoin="round"
        className={TONES[tone].stroke}
        initial={reduceMotion ? false : { pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={instantIf(reduceMotion, { duration: DURATION.chart, ease: EASE_OUT })}
      />
      <circle cx={x(clean.length - 1)} cy={y(last)} r={2.25} className={TONES[tone].fill} />
    </svg>
  );
};
