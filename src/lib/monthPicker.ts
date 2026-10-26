import { addMonths } from './format';

export const MONTH_SHORT_NAMES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
const MONTH_LONG_NAMES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
];

// "2026-10" -> "Outubro"
export function monthLongName(yearMonth: string): string {
  return MONTH_LONG_NAMES[Number(yearMonth.slice(5, 7)) - 1] ?? '';
}

// Mantém o mês dentro dos limites (min e max opcionais, no formato AAAA-MM)
export function clampMonth(yearMonth: string, min?: string, max?: string): string {
  if (min && yearMonth < min) return min;
  if (max && yearMonth > max) return max;
  return yearMonth;
}

export function isOutside(yearMonth: string, min?: string, max?: string): boolean {
  return Boolean((min && yearMonth < min) || (max && yearMonth > max));
}

// Navegação pelo teclado na grade de meses (3 colunas): devolve o novo mês ou null se a tecla não navega.
// Nunca passa dos limites
export function navigateMonth(yearMonth: string, key: string, min?: string, max?: string): string | null {
  const next = stepByKey(yearMonth, key);
  if (next === null) return null;
  const clamped = clampMonth(next, min, max);
  return clamped === yearMonth ? null : clamped;
}

function stepByKey(yearMonth: string, key: string): string | null {
  const month = Number(yearMonth.slice(5, 7));
  switch (key) {
    case 'ArrowLeft':
      return addMonths(yearMonth, -1);
    case 'ArrowRight':
      return addMonths(yearMonth, 1);
    case 'ArrowUp':
      return addMonths(yearMonth, -3);
    case 'ArrowDown':
      return addMonths(yearMonth, 3);
    case 'Home':
      return addMonths(yearMonth, 1 - month);
    case 'End':
      return addMonths(yearMonth, 12 - month);
    case 'PageUp':
      return addMonths(yearMonth, -12);
    case 'PageDown':
      return addMonths(yearMonth, 12);
    default:
      return null;
  }
}
