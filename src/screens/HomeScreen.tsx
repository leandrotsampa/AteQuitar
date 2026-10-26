import React, { useMemo, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import {
  ArrowRight,
  BadgeCheck,
  CalendarCheck2,
  CalendarClock,
  Flame,
  Lightbulb,
  PiggyBank,
  Receipt,
  RefreshCw,
  Sparkles,
} from 'lucide-react';
import type { ScreenProps } from './types';
import { HouseHero } from '../components/HouseHero';
import { AnimatedNumber } from '../components/ui/AnimatedNumber';
import { AreaChart } from '../components/charts/AreaChart';
import { HelpTip } from '../components/ui/HelpTip';
import { btnPrimary, card, tile } from '../components/ui/card';
import { greeting } from '../components/TopBar';
import {
  formatBRL,
  formatBRL0,
  formatBRLShort,
  formatDuration,
  formatInt,
  monthLong,
  monthName,
  monthShort,
} from '../lib/format';
import { buildTips, checkinStreak, pendingCheckinMonth } from '../lib/insights';
import { EASE_OUT, instantIf } from '../lib/motion';
import { playSound } from '../hooks/useSound';

const MILESTONES = [10, 20, 30, 40, 50, 60, 70, 80, 90, 100];

export const HomeScreen: React.FC<ScreenProps> = ({ model, data, dark, go, openCheckin, openContract }) => {
  const reduce = Boolean(useReducedMotion());
  const { contract, summary, rows, originalRows } = model;
  const pct = summary.progress * 100;
  const pending = pendingCheckinMonth(model, data);
  const streak = checkinStreak(model, data);
  const nextMilestone = MILESTONES.find((m) => m > Math.floor(pct + 1e-9));
  const toNextMilestone = nextMilestone ? summary.currentBalance - contract.financedAmount * (1 - nextMilestone / 100) : 0;
  const equity = contract.propertyValue > 0 ? Math.max(0, Math.min(1, 1 - summary.currentBalance / contract.propertyValue)) : null;
  const next = summary.next;
  const monthsLeft = summary.remainingCount;

  // Economia que as amortizações extras já garantiram
  const originalInterest = originalRows.reduce((a, r) => a + r.interest + r.fees, 0);
  const currentInterest = rows.reduce((a, r) => a + r.interest + r.fees, 0);
  const extrasSaving = data.extras.length > 0 ? Math.max(0, originalInterest - currentInterest) : 0;
  const monthsSaved = Math.max(0, originalRows.length - rows.length);

  const tips = useMemo(() => buildTips(model, data), [model, data]);
  const [tipIndex, setTipIndex] = useState(() => new Date().getDate() % Math.max(1, tips.length));
  const tip = tips[tipIndex % tips.length];

  // Gráfico: saldo devedor ano a ano (plano atual × plano original)
  const chart = useMemo(() => {
    const step = rows.length > 120 ? 12 : rows.length > 36 ? 6 : 1;
    const longest = Math.max(rows.length, originalRows.length);
    const today = Math.max(0, summary.paidCount - 1);
    const set = new Set<number>([today, longest - 1]);
    for (let k = 0; k < longest; k += step) set.add(k);
    // O mês de hoje entra exato no gráfico; pontos colados nele saem para não amontoar
    const idx = [...set].sort((a, b) => a - b).filter((k) => k === today || Math.abs(k - today) >= step / 2);
    const at = (list: typeof rows, k: number) => (k < list.length ? list[k].closingBalance : 0);
    const labels = idx.map((k) => (originalRows[k] ?? rows[k]).yearMonth);
    const todayIdx = idx.indexOf(today);
    return {
      labels,
      labelsShort: labels.map((ym) => (step >= 12 ? ym.slice(0, 4) : monthShort(ym))),
      current: idx.map((k) => at(rows, k)),
      original: idx.map((k) => at(originalRows, k)),
      todayIdx,
    };
  }, [rows, originalRows, summary.paidCount]);

  // Composição da próxima parcela
  const comp = next
    ? [
        { key: 'amort', label: 'Abate a dívida', value: next.amortization, cls: 'bg-anil-500 dark:bg-anil-400', dot: 'bg-anil-500' },
        { key: 'juros', label: 'Juros', value: next.interest, cls: 'bg-sol-400', dot: 'bg-sol-400' },
        { key: 'fees', label: 'Seguros e taxas', value: next.fees, cls: 'bg-slate-300 dark:bg-slate-600', dot: 'bg-slate-400' },
      ]
    : [];
  const compTotal = comp.reduce((a, c) => a + c.value, 0);
  const per100 = next && compTotal > 0 ? Math.round((next.amortization / compTotal) * 100) : 0;

  const hello = greeting(new Date().getHours());

  return (
    <div className="space-y-6 page-stagger">
      <header>
        <div className="text-sm font-medium text-anil-700 dark:text-anil-300">
          {hello}! {streak >= 2 ? `${streak} meses seguidos acompanhando.` : 'Veja como está a sua casa.'}
        </div>
        <h1 className="text-[2.2rem] leading-[1.1] font-bold tracking-tight text-slate-900 dark:text-white mt-1">
          {summary.remainingCount === 0 ? 'Sua casa está quitada.' : `${formatInt(pct)}% da dívida já foi paga`}
        </h1>
      </header>

      {/* Hero: a casa + quanto falta */}
      <section className={`${card} p-3 grid md:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)] gap-2 overflow-hidden`}>
        <div className="relative rounded-[18px] overflow-hidden min-h-[300px]">
          <HouseHero progress={summary.progress} dark={dark} cover className="absolute inset-0 w-full h-full block" />
          {equity !== null && (
            <div className="absolute left-4 top-4 px-3 py-2 rounded-2xl bg-white/85 dark:bg-slate-950/70 backdrop-blur text-xs">
              <div className="text-slate-500 dark:text-slate-400">Contando a entrada, já é seu</div>
              <div className="font-display font-bold text-lg text-slate-900 dark:text-white tabular-nums">
                <AnimatedNumber value={equity * 100} format={(n) => `${Math.round(n)}% do imóvel`} />
              </div>
            </div>
          )}
        </div>

        <div className="p-4 lg:p-6 flex flex-col">
          <div className="flex items-center gap-1.5 text-sm text-slate-500 dark:text-slate-400">
            Ainda falta pagar
            <HelpTip
              help={{
                title: 'Saldo devedor',
                body: model.calibrated
                  ? 'Calculado a partir do último saldo real que você informou, aplicando TR, juros e as parcelas pagas desde então.'
                  : 'Estimado a partir do contrato. Para ficar exato, informe o saldo do app do banco no check-in.',
              }}
            />
          </div>
          <AnimatedNumber
            value={summary.currentBalance}
            format={formatBRL}
            durationMs={1100}
            className="font-display text-[2.6rem] xl:text-[3rem] leading-none font-extrabold tracking-tight text-slate-900 dark:text-white tabular-nums mt-1"
          />
          <div className="mt-2 text-[15px] text-slate-600 dark:text-slate-300">
            {monthsLeft > 0 ? (
              <>
                <b className="text-slate-900 dark:text-white">{monthsLeft} parcelas</b> até {monthLong(summary.endYearMonth)}
              </>
            ) : (
              'Nenhuma parcela restante'
            )}
          </div>

          {/* Régua dos marcos: cada 10% é uma conquista */}
          <div className="mt-6">
            <div className="relative h-4 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
              <motion.div
                className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-anil-600 via-anil-500 to-sol-400"
                initial={reduce ? false : { width: 0 }}
                animate={{ width: `${pct}%` }}
                transition={instantIf(reduce, { duration: 1.4, ease: EASE_OUT, delay: 0.2 })}
              >
                <span className="absolute inset-0 bar-shine rounded-full" />
              </motion.div>
              {MILESTONES.slice(0, -1).map((m) => (
                <span key={m} className="absolute inset-y-1 w-px bg-white/70 dark:bg-slate-950/50" style={{ left: `${m}%` }} />
              ))}
            </div>
            <div className="flex justify-between mt-1.5 text-[11px] font-num text-slate-400">
              <span>0%</span>
              <span>50%</span>
              <span>100%</span>
            </div>
          </div>

          {nextMilestone && monthsLeft > 0 && (
            <div className="mt-4 flex items-start gap-3 p-3 rounded-2xl bg-sol-50 dark:bg-sol-400/10">
              <Sparkles className="w-5 h-5 text-sol-600 dark:text-sol-300 shrink-0 mt-0.5" />
              <div className="text-sm text-sol-900 dark:text-sol-100 leading-snug">
                Faltam <b>{formatBRL0(Math.max(0, toNextMilestone))}</b> de dívida para chegar a <b>{nextMilestone}%</b> e acender mais uma
                luz da casa.
              </div>
            </div>
          )}

          <div className="mt-auto pt-5 grid grid-cols-2 gap-2">
            <div className={`${tile} p-3`}>
              <div className="text-xs text-slate-500 dark:text-slate-400">Quitação em</div>
              <div className="font-display font-bold text-slate-900 dark:text-white mt-0.5">{formatDuration(monthsLeft)}</div>
            </div>
            <div className={`${tile} p-3`}>
              <div className="text-xs text-slate-500 dark:text-slate-400">Parcelas pagas</div>
              <div className="font-display font-bold text-slate-900 dark:text-white mt-0.5 tabular-nums">
                {summary.paidCount} de {summary.totalCount}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Check-in do mês */}
      <AnimatePresence>
        {pending && (
          <motion.section
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="relative overflow-hidden rounded-[22px] p-5 lg:p-6 bg-gradient-to-br from-anil-700 via-anil-600 to-anil-500 text-white flex flex-col md:flex-row md:items-center gap-4 shadow-[0_24px_50px_-24px_rgba(65,57,201,0.8)]">
              <div className="absolute -right-10 -top-12 w-56 h-56 rounded-full bg-sol-400/25 blur-2xl" aria-hidden="true" />
              <span className="relative w-12 h-12 shrink-0 rounded-2xl bg-white/15 flex items-center justify-center">
                <CalendarCheck2 className="w-6 h-6" />
              </span>
              <div className="relative flex-1 min-w-0">
                <div className="font-display text-xl font-bold">
                  A parcela de {monthName(pending)} já venceu. Vamos registrar?
                </div>
                <div className="text-sm text-white/80 mt-0.5">
                  Leva menos de um minuto: confirme o valor pago e, se quiser, o saldo que aparece no app do banco.
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  playSound('tick');
                  openCheckin();
                }}
                className="relative ring-breathe inline-flex items-center justify-center gap-2 h-11 px-5 rounded-full bg-sol-400 hover:bg-sol-300 text-slate-900 font-bold text-sm cursor-pointer shrink-0"
              >
                Fazer check-in <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </motion.section>
        )}
      </AnimatePresence>

      {/* Indicadores rápidos */}
      <section className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        <Stat
          icon={CalendarClock}
          label="Próxima parcela"
          value={next ? <AnimatedNumber value={next.payment} format={formatBRL} /> : '—'}
          detail={next ? `vence em ${String(contract.dueDay).padStart(2, '0')}/${next.yearMonth.slice(5)}` : 'nenhuma pendente'}
        />
        <Stat
          icon={Receipt}
          label="Você já pagou"
          value={<AnimatedNumber value={summary.paidTotal} format={formatBRL0} />}
          detail={`${formatBRL0(summary.paidInterest)} foram juros`}
        />
        <Stat
          icon={Flame}
          label="Juros que ainda virão"
          value={<AnimatedNumber value={summary.remainingInterest} format={formatBRL0} />}
          detail="é isso que amortizar ataca"
          tone="sol"
          onClick={() => go('amortize')}
        />
        <Stat
          icon={PiggyBank}
          label="Suas amortizações extras"
          value={extrasSaving > 0 ? <AnimatedNumber value={extrasSaving} format={formatBRL0} /> : 'Nenhuma ainda'}
          detail={extrasSaving > 0 ? `de juros evitados${monthsSaved > 0 ? ` e ${monthsSaved} meses a menos` : ''}` : 'veja quanto economizaria'}
          tone="menta"
          onClick={() => go('amortize')}
        />
      </section>

      <section className="grid lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)] gap-4">
        {/* Evolução do saldo */}
        <div className={`${card} p-5 lg:p-6`}>
          <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
            <div>
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">A dívida caindo ao longo do tempo</h2>
              <p className="text-sm text-slate-500 dark:text-slate-400">Saldo devedor previsto até a última parcela</p>
            </div>
            <div className="flex items-center gap-4 text-xs text-slate-500 dark:text-slate-400">
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-anil-500" /> Com seus pagamentos
              </span>
              {(data.extras.length > 0 || model.calibrated) && (
                <span className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-slate-400" /> Plano original
                </span>
              )}
            </div>
          </div>
          <AreaChart
            labels={chart.labelsShort}
            series={[
              { key: 'cur', label: 'Com seus pagamentos', tone: 'anil', kind: 'area', axis: 'left', values: chart.current },
              ...(data.extras.length > 0 || model.calibrated
                ? [{ key: 'orig', label: 'Plano original', tone: 'slate' as const, kind: 'line' as const, axis: 'left' as const, values: chart.original }]
                : []),
            ]}
            formatLeft={formatBRLShort}
            formatRight={formatBRLShort}
            marker={chart.todayIdx >= 0 ? { index: chart.todayIdx, label: 'hoje' } : undefined}
            tooltip={(i) => (
              <>
                <div className="font-semibold text-slate-900 dark:text-white mb-1">{monthLong(chart.labels[i])}</div>
                <div className="flex justify-between gap-4">
                  <span className="text-slate-500">Saldo</span>
                  <span className="font-num font-semibold">{formatBRL0(chart.current[i])}</span>
                </div>
                {(data.extras.length > 0 || model.calibrated) && (
                  <div className="flex justify-between gap-4">
                    <span className="text-slate-500">Plano original</span>
                    <span className="font-num font-semibold">{formatBRL0(chart.original[i])}</span>
                  </div>
                )}
              </>
            )}
            height={270}
          />
        </div>

        {/* Para onde vai a parcela */}
        <div className={`${card} p-5 lg:p-6 flex flex-col`}>
          <h2 className="text-lg font-bold text-slate-900 dark:text-white">Para onde vai sua parcela</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            {next ? `Parcela de ${monthName(next.yearMonth)}: ${formatBRL(next.payment)}` : 'Sem parcelas futuras'}
          </p>
          {next && (
            <>
              <div className="mt-5 flex h-5 rounded-full overflow-hidden gap-0.5">
                {comp.map((c, k) => (
                  <motion.div
                    key={c.key}
                    className={`${c.cls} h-full first:rounded-l-full last:rounded-r-full`}
                    initial={reduce ? false : { width: 0 }}
                    animate={{ width: `${(c.value / compTotal) * 100}%` }}
                    transition={instantIf(reduce, { duration: 0.9, ease: EASE_OUT, delay: 0.3 + k * 0.12 })}
                  />
                ))}
              </div>
              <div className="mt-4 space-y-2.5">
                {comp.map((c) => (
                  <div key={c.key} className="flex items-center justify-between text-sm">
                    <span className="flex items-center gap-2 text-slate-600 dark:text-slate-300">
                      <span className={`w-2.5 h-2.5 rounded-full ${c.dot}`} />
                      {c.label}
                    </span>
                    <span className="font-num font-semibold text-slate-900 dark:text-white">{formatBRL(c.value)}</span>
                  </div>
                ))}
              </div>
              <div className="mt-auto pt-5">
                <div className={`${tile} p-4 flex gap-3 items-center`}>
                  <span className="font-display text-3xl font-extrabold text-anil-600 dark:text-anil-300 tabular-nums">{per100}</span>
                  <span className="text-sm text-slate-600 dark:text-slate-300 leading-snug">
                    de cada R$ 100 pagos abatem a dívida.{' '}
                    {contract.system === 'SAC' ? 'No SAC essa fatia cresce todo mês.' : 'Na Price essa fatia cresce devagar com o tempo.'}
                  </span>
                </div>
              </div>
            </>
          )}
        </div>
      </section>

      <section className="grid lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)] gap-4">
        {/* Dica do momento */}
        {tip && (
          <div className={`${card} p-5 lg:p-6 relative overflow-hidden`}>
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-sm font-semibold text-slate-500 dark:text-slate-400">
                <Lightbulb className="w-4 h-4 text-sol-500" /> Dica para você
              </div>
              {tips.length > 1 && (
                <button
                  type="button"
                  onClick={() => {
                    playSound('tick');
                    setTipIndex((k) => k + 1);
                  }}
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-anil-600 dark:hover:text-anil-300 cursor-pointer"
                >
                  <RefreshCw className="w-3.5 h-3.5" /> Outra dica
                </button>
              )}
            </div>
            <AnimatePresence mode="wait">
              <motion.div
                key={tip.id}
                initial={reduce ? false : { opacity: 0, x: 16 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -16 }}
                transition={{ duration: 0.28, ease: EASE_OUT }}
              >
                <h3 className="font-display text-xl font-bold text-slate-900 dark:text-white mt-3">{tip.title}</h3>
                <p className="text-[15px] text-slate-600 dark:text-slate-300 mt-1.5 leading-relaxed max-w-2xl">{tip.text}</p>
                {tip.action && (
                  <button
                    type="button"
                    onClick={() => {
                      playSound('tick');
                      if (tip.action?.checkin) openCheckin();
                      else if (tip.action?.screen) go(tip.action.screen);
                    }}
                    className="mt-4 inline-flex items-center gap-1.5 text-sm font-bold text-anil-700 hover:text-anil-600 dark:text-anil-300 dark:hover:text-anil-200 cursor-pointer"
                  >
                    {tip.action.label} <ArrowRight className="w-4 h-4" />
                  </button>
                )}
              </motion.div>
            </AnimatePresence>
          </div>
        )}

        {/* Cadastro completo */}
        <Completeness model={model} onCheckin={openCheckin} onHistory={() => go('history')} onContract={() => openContract()} />
      </section>
    </div>
  );
};

const Stat: React.FC<{
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: React.ReactNode;
  detail: string;
  tone?: 'anil' | 'sol' | 'menta';
  onClick?: () => void;
}> = ({ icon: Icon, label, value, detail, tone = 'anil', onClick }) => {
  const toneCls =
    tone === 'sol'
      ? 'bg-sol-100 text-sol-700 dark:bg-sol-400/15 dark:text-sol-300'
      : tone === 'menta'
        ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300'
        : 'bg-anil-100 text-anil-700 dark:bg-anil-500/15 dark:text-anil-300';
  const Tag = onClick ? 'button' : 'div';
  return (
    <Tag
      {...(onClick ? { type: 'button' as const, onClick } : {})}
      className={`${card} p-5 text-left group ${onClick ? 'cursor-pointer hover:-translate-y-0.5 transition-transform duration-[var(--duration-base)]' : ''}`}
    >
      <div className="flex items-center gap-2.5">
        <span className={`w-9 h-9 rounded-xl flex items-center justify-center ${toneCls}`}>
          <Icon className="w-[18px] h-[18px]" />
        </span>
        <span className="text-sm text-slate-500 dark:text-slate-400">{label}</span>
      </div>
      <div className="font-display text-2xl font-bold text-slate-900 dark:text-white mt-3 tabular-nums">{value}</div>
      <div className="text-xs text-slate-500 dark:text-slate-400 mt-1 flex items-center gap-1">
        {detail}
        {onClick && <ArrowRight className="w-3 h-3 opacity-0 -translate-x-1 group-hover:opacity-100 group-hover:translate-x-0 transition-all" />}
      </div>
    </Tag>
  );
};

const Completeness: React.FC<{
  model: ScreenProps['model'];
  onCheckin: () => void;
  onHistory: () => void;
  onContract: () => void;
}> = ({ model, onCheckin, onHistory, onContract }) => {
  const reduce = Boolean(useReducedMotion());
  const { score, missing } = model.completeness;
  const pct = Math.round(score * 100);
  const r = 34;
  const circ = 2 * Math.PI * r;
  return (
    <div className={`${card} p-5 lg:p-6`}>
      <div className="flex items-center gap-4">
        <div className="relative w-20 h-20 shrink-0">
          <svg viewBox="0 0 80 80" className="-rotate-90 w-full h-full" aria-hidden="true">
            <circle cx="40" cy="40" r={r} fill="none" strokeWidth="8" className="stroke-slate-100 dark:stroke-slate-800" />
            <motion.circle
              cx="40"
              cy="40"
              r={r}
              fill="none"
              strokeWidth="8"
              strokeLinecap="round"
              className={pct === 100 ? 'stroke-emerald-500' : 'stroke-anil-500'}
              strokeDasharray={circ}
              initial={reduce ? false : { strokeDashoffset: circ }}
              animate={{ strokeDashoffset: circ * (1 - score) }}
              transition={instantIf(reduce, { duration: 1, ease: EASE_OUT, delay: 0.4 })}
            />
          </svg>
          <span className="absolute inset-0 flex items-center justify-center font-display font-bold text-lg text-slate-900 dark:text-white">
            {pct}%
          </span>
        </div>
        <div>
          <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
            {pct === 100 ? (
              <>
                Cadastro completo <BadgeCheck className="w-5 h-5 text-emerald-500" />
              </>
            ) : (
              'Seu cadastro'
            )}
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 leading-snug">
            {pct === 100 ? 'Tudo o que o app precisa para ser exato.' : 'Quanto mais completo, mais exatos os números.'}
          </p>
        </div>
      </div>
      {missing.length > 0 && (
        <ul className="mt-4 space-y-1.5">
          {missing.slice(0, 3).map((m) => (
            <li key={m}>
              <button
                type="button"
                onClick={
                  m.includes('check-in') || m.includes('saldo devedor') ? onCheckin : m.includes('IR') ? onHistory : onContract
                }
                className="w-full flex items-center justify-between gap-2 px-3 py-2 rounded-xl text-left text-sm text-slate-700 dark:text-slate-200 bg-slate-50 hover:bg-anil-50 dark:bg-slate-950/60 dark:hover:bg-anil-500/10 cursor-pointer transition-colors"
              >
                <span className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-anil-500" />
                  Adicionar {m}
                </span>
                <ArrowRight className="w-4 h-4 text-slate-400" />
              </button>
            </li>
          ))}
        </ul>
      )}
      {missing.length === 0 && (
        <button type="button" onClick={onHistory} className={`${btnPrimary} mt-4 w-full`}>
          Ver parcelas mês a mês
        </button>
      )}
    </div>
  );
};

