import { useEffect, useState } from 'react';

const dayKey = (d: Date) => d.toDateString();

// A data de hoje, que muda sozinha na virada do dia (e ao voltar para o app): o saldo de hoje
// ganha a TR de cada dia útil, como no app do banco, mesmo com o app aberto há dias
export function useToday(): Date {
  const [today, setToday] = useState(() => new Date());
  useEffect(() => {
    const check = () => setToday((prev) => (dayKey(prev) === dayKey(new Date()) ? prev : new Date()));
    const timer = window.setInterval(check, 60_000);
    window.addEventListener('focus', check);
    document.addEventListener('visibilitychange', check);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener('focus', check);
      document.removeEventListener('visibilitychange', check);
    };
  }, []);
  return today;
}
