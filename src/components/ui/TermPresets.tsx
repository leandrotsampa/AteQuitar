import React from 'react';
import { chip } from './card';
import { playSound } from '../../hooks/useSound';

// Prazos redondos mais comuns, de 35 a 15 anos: um toque preenche o campo. Os rótulos seguem a
// unidade do campo (a outra aparece ao passar o mouse). Abaixo do mínimo (ex.: o que o documento
// do banco já mostra), ficam desativados
const TERMS = [420, 360, 300, 240, 180];

export type TermUnit = 'meses' | 'anos';

export const TermPresets: React.FC<{ value: number; onPick: (months: number) => void; unit: TermUnit; min?: number }> = ({
  value,
  onPick,
  unit,
  min = 0,
}) => (
  <div className="mt-2 flex flex-wrap gap-1.5" role="group" aria-label="Prazos comuns">
    {TERMS.map((m) => {
      const [label, other] = unit === 'anos' ? [`${m / 12} anos`, `${m} meses`] : [`${m} meses`, `${m / 12} anos`];
      return (
        <button
          key={m}
          type="button"
          disabled={m < min}
          aria-pressed={value === m}
          title={other}
          onClick={() => {
            playSound('tick');
            onPick(m);
          }}
          className={`h-8 px-3 text-xs ${chip(value === m)} disabled:opacity-40 disabled:cursor-not-allowed`}
        >
          {label}
        </button>
      );
    })}
  </div>
);
