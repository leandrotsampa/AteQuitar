import React, { useRef } from 'react';
import { playSound } from '../../hooks/useSound';
import { LiquidIndicator } from './LiquidIndicator';

interface SegmentedOption<T extends string> {
  value: T;
  label: string;
  title?: string;
}

interface SegmentedControlProps<T extends string> {
  options: SegmentedOption<T>[];
  value: T;
  onChange: (value: T) => void;
  disabled?: boolean;
  ariaLabel: string;
  // Identificador único na tela: é o que faz a pílula deslizar entre as opções
  layoutId: string;
  className?: string;
}

// Seletor de opções com a pílula ativa deslizando até a opção escolhida
export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  disabled,
  ariaLabel,
  layoutId,
  className = '',
}: SegmentedControlProps<T>) {
  const groupRef = useRef<HTMLDivElement>(null);
  return (
    <div
      ref={groupRef}
      className={`relative grid h-10 bg-slate-100 dark:bg-slate-950 p-1 rounded-lg border border-slate-300 dark:border-slate-700 text-sm ${className}`}
      style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}
      role="group"
      aria-label={ariaLabel}
    >
      {/* Pílula da opção ativa: escorre até a opção escolhida */}
      <LiquidIndicator
        containerRef={groupRef}
        axis="x"
        activeKey={`${layoutId}:${value}`}
        className="rounded-md bg-anil-600 dark:bg-anil-500"
      />
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            onClick={() => {
              if (!active) playSound('tick');
              onChange(o.value);
            }}
            disabled={disabled}
            aria-pressed={active}
            data-liquid-active={active}
            title={o.title}
            className={`relative px-2 rounded-md cursor-pointer disabled:cursor-not-allowed transition-colors duration-[var(--duration-base)] ${
              active
                ? 'text-white font-semibold dark:text-anil-950'
                : 'text-slate-600 dark:text-slate-400 enabled:hover:text-slate-900 dark:enabled:hover:text-slate-200'
            }`}
          >
            <span className="relative">{o.label}</span>
          </button>
        );
      })}
    </div>
  );
}
