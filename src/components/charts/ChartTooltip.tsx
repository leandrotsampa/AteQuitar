import React from 'react';

// Caixa de detalhes ao lado do cursor; passa para a esquerda perto da borda direita
export const ChartTooltip: React.FC<{ x: number; y: number; containerWidth: number; children: React.ReactNode }> = ({
  x,
  y,
  containerWidth,
  children,
}) => {
  const flip = x > containerWidth * 0.6;
  return (
    <div
      role="tooltip"
      className="pointer-events-none absolute z-10 min-w-40 whitespace-nowrap px-3 py-2 rounded-xl bg-white/95 dark:bg-slate-800/95 border border-slate-200 dark:border-slate-700 shadow-lg text-xs backdrop-blur-sm"
      style={{
        left: x,
        top: y,
        transform: `translate(${flip ? 'calc(-100% - 12px)' : '12px'}, -50%)`,
      }}
    >
      {children}
    </div>
  );
};
