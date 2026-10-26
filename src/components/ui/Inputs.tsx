import React, { useState } from 'react';
import { inputBase } from './card';

// "30.000,50" / "30000.5" / "30000" -> 30000.5
export const parseBrNumber = (text: string): number => {
  const clean = text.replace(/[^\d.,-]/g, '');
  if (!clean) return 0;
  const normalized = clean.includes(',')
    ? clean.replace(/\./g, '').replace(',', '.')
    : /^-?\d+\.\d{1,4}$/.test(clean)
      ? clean
      : clean.replace(/\./g, '');
  const value = parseFloat(normalized);
  return isNaN(value) ? 0 : value;
};

const fmt = (value: number, digits: number) =>
  value !== 0 ? value.toLocaleString('pt-BR', { minimumFractionDigits: digits, maximumFractionDigits: digits }) : '';

interface NumberFieldProps {
  id?: string;
  value: number;
  onChange: (value: number) => void;
  prefix?: string;
  suffix?: string;
  digits?: number;
  placeholder?: string;
  ariaLabel?: string;
  className?: string;
  size?: 'md' | 'lg';
}

// Campo numérico só por digitação (sem setas nem rolagem do mouse); formata ao sair do campo
export const NumberField: React.FC<NumberFieldProps> = ({
  id,
  value,
  onChange,
  prefix,
  suffix,
  digits = 2,
  placeholder,
  ariaLabel,
  className = '',
  size = 'md',
}) => {
  const [draft, setDraft] = useState<string | null>(null);
  return (
    <div className={`relative ${className}`}>
      {prefix && (
        <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500 dark:text-slate-400 text-sm font-medium">
          {prefix}
        </span>
      )}
      <input
        id={id}
        type="text"
        inputMode="decimal"
        autoComplete="off"
        aria-label={ariaLabel}
        placeholder={placeholder ?? (digits > 0 ? `0,${'0'.repeat(digits)}` : '0')}
        value={draft ?? fmt(value, digits)}
        onFocus={(e) => {
          setDraft(fmt(value, digits));
          e.target.select();
        }}
        onChange={(e) => {
          setDraft(e.target.value);
          onChange(parseBrNumber(e.target.value));
        }}
        onBlur={() => setDraft(null)}
        className={`${inputBase} font-num font-semibold text-right ${size === 'lg' ? 'h-14 text-xl' : ''} ${prefix ? 'pl-11' : ''} ${
          suffix ? (suffix.length > 4 ? 'pr-16' : 'pr-11') : ''
        }`}
      />
      {suffix && (
        <span className="absolute inset-y-0 right-0 pr-3.5 flex items-center pointer-events-none text-slate-500 dark:text-slate-400 text-sm font-medium">
          {suffix}
        </span>
      )}
    </div>
  );
};

export const MoneyField: React.FC<Omit<NumberFieldProps, 'prefix' | 'digits'>> = (props) => (
  <NumberField {...props} prefix="R$" digits={2} />
);

// Mês e ano (AAAA-MM): o mesmo seletor da competência, com grade flutuante
export { MonthField } from './MonthPicker';
