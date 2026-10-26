import React, { useMemo, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { Home, Landmark, PiggyBank, Scale, ShieldCheck, TrendingUp } from 'lucide-react';
import type { ScreenProps } from './types';
import { PageHeader } from '../components/ui/PageHeader';
import { AnimatedNumber } from '../components/ui/AnimatedNumber';
import { Field } from '../components/ui/HelpTip';
import { MoneyField, NumberField } from '../components/ui/Inputs';
import { card, tile } from '../components/ui/card';
import { compareInvestment, netAnnual, type Product, type ProductKey } from '../lib/invest';
import { poupancaAnnual, trAnnual } from '../lib/rates';
import { formatBRL, formatBRL0, formatDuration, formatPct } from '../lib/format';
import { EASE_OUT, instantIf } from '../lib/motion';
import { playSound } from '../hooks/useSound';

export const InvestScreen: React.FC<ScreenProps> = ({ model, data }) => {
  const reduce = Boolean(useReducedMotion());
  const { contract, summary } = model;
  const rates = data.rates;
  const cdi = rates.latest.cdi.value;
  const selic = rates.latest.selic.value;
  const ipca = rates.latest.ipca12.value;
  const tr = contract.trIndexed ? trAnnual(rates) : 0;

  const [amount, setAmount] = useState(10000);
  const [months, setMonths] = useState(Math.min(summary.remainingCount || 60, 120));
  const [productKey, setProductKey] = useState<ProductKey>('cdb');
  const [cdbPct, setCdbPct] = useState(100);
  const [lciPct, setLciPct] = useState(90);
  const [ipcaPlus, setIpcaPlus] = useState(6.5);

  const products: Product[] = [
    { key: 'poupanca', label: 'Poupança', detail: 'Isenta de IR, rende 0,5% a.m. + TR', grossAnnual: poupancaAnnual(rates), taxFree: true },
    { key: 'cdb', label: `CDB ${cdbPct}% do CDI`, detail: 'Tem IR regressivo e garantia do FGC', grossAnnual: (cdi * cdbPct) / 100, taxFree: false },
    { key: 'lci', label: `LCI/LCA ${lciPct}% do CDI`, detail: 'Isenta de IR, com garantia do FGC', grossAnnual: (cdi * lciPct) / 100, taxFree: true },
    { key: 'tesouroSelic', label: 'Tesouro Selic', detail: 'Segue a Selic, liquidez diária, tem IR', grossAnnual: selic - 0.1, taxFree: false },
    {
      key: 'tesouroIpca',
      label: `Tesouro IPCA+ ${ipcaPlus.toLocaleString('pt-BR')}%`,
      detail: 'Protege da inflação; vender antes do vencimento pode dar perda',
      grossAnnual: ((1 + ipca / 100) * (1 + ipcaPlus / 100) - 1) * 100,
      taxFree: false,
    },
  ];
  const product = products.find((p) => p.key === productKey)!;

  const result = useMemo(
    () => compareInvestment({ amount, months, contractAnnual: contract.annualRate, trAnnual: tr, product, ipca12: ipca }),
    [amount, months, contract.annualRate, tr, product, ipca]
  );
  const ranking = useMemo(
    () => products.map((p) => ({ p, net: netAnnual(p, months) })).sort((a, b) => b.net - a.net),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [months, cdi, selic, ipca, cdbPct, lciPct, ipcaPlus]
  );

  const maxFv = Math.max(result.futureIfAmortize, result.futureIfInvest);
  const verdictText = {
    amortizar: {
      title: 'Amortizar rende mais',
      text: `Sua dívida custa ${formatPct(result.debtAnnual)} ao ano e o investimento renderia ${formatPct(result.investNetAnnual)} já sem IR. Quitar juros caros é um "rendimento" garantido e sem risco.`,
      tone: 'from-emerald-600 to-emerald-500',
      icon: Home,
    },
    investir: {
      title: 'Investir rende mais',
      text: `O investimento rende ${formatPct(result.investNetAnnual)} ao ano livre de IR, mais que os ${formatPct(result.debtAnnual)} que a dívida custa. Mantendo o dinheiro aplicado, você ainda tem liquidez para emergências.`,
      tone: 'from-anil-700 to-anil-500',
      icon: TrendingUp,
    },
    empate: {
      title: 'Praticamente empatados',
      text: `A diferença é menor que 0,3 ponto ao ano. Escolha pelo que dá mais tranquilidade: amortizar reduz o risco, investir mantém o dinheiro disponível.`,
      tone: 'from-sol-600 to-sol-400',
      icon: Scale,
    },
  }[result.verdict];
  const VerdictIcon = verdictText.icon;

  return (
    <div className="space-y-6 page-stagger">
      <PageHeader
        context="Decidir"
        title="Amortizar ou investir?"
        description="Amortizar é como investir na taxa da sua dívida, sem risco. Comparamos com investimentos comuns usando as taxas de hoje do Banco Central."
      />

      <section className="grid lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)] gap-4">
        <div className={`${card} p-5 lg:p-6 space-y-5`}>
          <Field label="Quanto dinheiro você tem?">
            <MoneyField value={amount} onChange={setAmount} size="lg" />
          </Field>
          <Field
            label="Por quanto tempo?"
            hint={formatDuration(months)}
            help={{ title: 'Horizonte', body: 'Por quanto tempo o dinheiro ficaria investido. Começamos pelo que falta do seu financiamento (até 10 anos).' }}
          >
            <input
              type="range"
              className="range w-full"
              min={6}
              max={Math.max(12, Math.min(420, summary.remainingCount || 360))}
              step={6}
              value={months}
              style={{ ['--fill' as string]: `${((months - 6) / (Math.max(12, Math.min(420, summary.remainingCount || 360)) - 6)) * 100}%` }}
              onChange={(e) => setMonths(Number(e.target.value))}
              aria-label="Meses"
            />
          </Field>
          <Field label="Comparar com">
            <div className="space-y-2">
              {products.map((p) => (
                <button
                  key={p.key}
                  type="button"
                  onClick={() => {
                    playSound('tick');
                    setProductKey(p.key);
                  }}
                  aria-pressed={productKey === p.key}
                  className={`w-full flex items-center justify-between gap-3 p-3 rounded-2xl text-left cursor-pointer transition-colors ${
                    productKey === p.key ? 'bg-anil-50 ring-2 ring-anil-400 dark:bg-anil-500/10' : `${tile} hover:ring-anil-200 dark:hover:ring-anil-500/30`
                  }`}
                >
                  <span className="min-w-0">
                    <span className="block text-sm font-bold text-slate-900 dark:text-white">{p.label}</span>
                    <span className="block text-xs text-slate-500 dark:text-slate-400 truncate">{p.detail}</span>
                  </span>
                  <span className="text-right shrink-0">
                    <span className="block font-num font-bold text-sm text-slate-900 dark:text-white">{formatPct(netAnnual(p, months))}</span>
                    <span className="block text-[11px] text-slate-500">líquido a.a.</span>
                  </span>
                </button>
              ))}
            </div>
          </Field>
          <AnimatePresence initial={false}>
            {(productKey === 'cdb' || productKey === 'lci' || productKey === 'tesouroIpca') && (
              <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
                {productKey === 'cdb' && (
                  <Field label="Quanto do CDI o CDB paga?">
                    <NumberField value={cdbPct} onChange={setCdbPct} digits={0} suffix="% CDI" className="max-w-[200px]" />
                  </Field>
                )}
                {productKey === 'lci' && (
                  <Field label="Quanto do CDI a LCI/LCA paga?">
                    <NumberField value={lciPct} onChange={setLciPct} digits={0} suffix="% CDI" className="max-w-[200px]" />
                  </Field>
                )}
                {productKey === 'tesouroIpca' && (
                  <Field label="Taxa acima do IPCA" help={{ title: 'IPCA + taxa', body: 'O Tesouro IPCA+ paga a inflação mais uma taxa fixa, que aparece no site do Tesouro Direto (ex.: IPCA + 6,5%).' }}>
                    <NumberField value={ipcaPlus} onChange={setIpcaPlus} suffix="%" className="max-w-[200px]" />
                  </Field>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <div className="space-y-4">
          <AnimatePresence mode="wait">
            <motion.div
              key={result.verdict}
              initial={reduce ? false : { opacity: 0, y: 12, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.35, ease: EASE_OUT }}
              className={`relative overflow-hidden rounded-[22px] p-6 lg:p-7 bg-gradient-to-br ${verdictText.tone} text-white shadow-[0_24px_50px_-24px_rgba(30,27,75,0.6)]`}
            >
              <div className="absolute -right-10 -top-10 w-48 h-48 rounded-full bg-white/10" aria-hidden="true" />
              <span className="relative w-12 h-12 rounded-2xl bg-white/15 flex items-center justify-center">
                <VerdictIcon className="w-6 h-6" />
              </span>
              <h2 className="relative font-display text-[1.9rem] font-extrabold mt-4 leading-tight">{verdictText.title}</h2>
              <p className="relative text-white/90 mt-2 leading-relaxed max-w-xl">{verdictText.text}</p>
            </motion.div>
          </AnimatePresence>

          {/* Corrida: quanto o dinheiro vira em cada caminho */}
          <div className={`${card} p-5 lg:p-6`}>
            <h3 className="text-lg font-bold text-slate-900 dark:text-white">Em {formatDuration(months)}, seus {formatBRL0(amount)} valeriam</h3>
            <div className="mt-5 space-y-5">
              {[
                { key: 'a', label: 'Amortizando', sub: `${formatPct(contract.annualRate)} de juros${tr > 0 ? ` + ${formatPct(tr)} de TR` : ''}`, value: result.futureIfAmortize, color: 'bg-emerald-500', icon: Home },
                { key: 'i', label: 'Investindo', sub: `${product.label}, líquido de IR`, value: result.futureIfInvest, color: 'bg-anil-500', icon: PiggyBank },
              ].map((b) => (
                <div key={b.key}>
                  <div className="flex items-end justify-between gap-3 mb-1.5">
                    <span className="flex items-center gap-2 text-sm">
                      <b.icon className="w-4 h-4 text-slate-500" />
                      <span className="font-semibold text-slate-900 dark:text-white">{b.label}</span>
                      <span className="text-slate-500 dark:text-slate-400 hidden sm:inline">{b.sub}</span>
                    </span>
                    <AnimatedNumber value={b.value} format={formatBRL0} className="font-num font-bold text-slate-900 dark:text-white" />
                  </div>
                  <div className="h-4 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                    <motion.div
                      className={`h-full rounded-full ${b.color}`}
                      initial={reduce ? false : { width: 0 }}
                      animate={{ width: `${maxFv > 0 ? (b.value / maxFv) * 100 : 0}%` }}
                      transition={instantIf(reduce, { type: 'spring', stiffness: 60, damping: 16 } as const)}
                    />
                  </div>
                </div>
              ))}
            </div>
            <div className={`${tile} p-4 mt-5 text-sm text-slate-600 dark:text-slate-300`}>
              Diferença no período:{' '}
              <b className={result.gap >= 0 ? 'text-anil-700 dark:text-anil-300' : 'text-emerald-700 dark:text-emerald-400'}>
                {formatBRL(Math.abs(result.gap))} a favor de {result.gap >= 0 ? 'investir' : 'amortizar'}
              </b>
              .
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className={`${card} p-5`}>
              <div className="text-sm text-slate-500 dark:text-slate-400">Custo real da dívida</div>
              <div className="font-display text-2xl font-bold text-slate-900 dark:text-white mt-1">{formatPct(result.realDebt)}</div>
              <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">ao ano, acima da inflação ({formatPct(ipca)})</div>
            </div>
            <div className={`${card} p-5`}>
              <div className="text-sm text-slate-500 dark:text-slate-400">Ganho real do investimento</div>
              <div className="font-display text-2xl font-bold text-slate-900 dark:text-white mt-1">{formatPct(result.realInvest)}</div>
              <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">ao ano, acima da inflação</div>
            </div>
          </div>
        </div>
      </section>

      <section className="grid md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-4">
        <div className={`${card} p-5 lg:p-6`}>
          <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Landmark className="w-5 h-5 text-anil-500" /> Ranking para {formatDuration(months)}
          </h2>
          <ol className="mt-4 space-y-2">
            {[
              { name: 'Sua dívida (amortizar)', net: result.debtAnnual, debt: true },
              ...ranking.map((r) => ({ name: r.p.label, net: r.net, debt: false })),
            ]
              .sort((a, b) => b.net - a.net)
              .map((r, k) => (
                <motion.li
                  key={r.name}
                  layout
                  className={`flex items-center justify-between gap-3 px-3 py-2.5 rounded-xl text-sm ${
                    r.debt ? 'bg-emerald-50 dark:bg-emerald-500/10 ring-1 ring-emerald-200 dark:ring-emerald-500/30' : 'bg-slate-50 dark:bg-slate-950/60'
                  }`}
                >
                  <span className="flex items-center gap-3">
                    <span className="w-6 text-center font-num font-bold text-slate-400">{k + 1}</span>
                    <span className={`font-semibold ${r.debt ? 'text-emerald-800 dark:text-emerald-300' : 'text-slate-800 dark:text-slate-200'}`}>{r.name}</span>
                  </span>
                  <span className="font-num font-bold text-slate-900 dark:text-white">{formatPct(r.net)}</span>
                </motion.li>
              ))}
          </ol>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-3">Rendimentos líquidos de IR, ao ano. Taxas de referência: CDI {formatPct(cdi)}, Selic {formatPct(selic)}, IPCA {formatPct(ipca)}.</p>
        </div>
        <div className={`${card} p-5 lg:p-6`}>
          <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-emerald-500" /> O que os números não mostram
          </h2>
          <ul className="mt-3 space-y-3 text-[15px] text-slate-600 dark:text-slate-300 leading-relaxed">
            <li>
              <b className="text-slate-900 dark:text-white">Reserva primeiro.</b> Dinheiro amortizado não volta. Antes, guarde de 3 a 6 meses de gastos num investimento com resgate rápido.
            </li>
            <li>
              <b className="text-slate-900 dark:text-white">Taxas mudam.</b> Se a Selic cair, investir passa a render menos; a taxa do seu contrato não muda.
            </li>
            <li>
              <b className="text-slate-900 dark:text-white">FGTS rende pouco.</b> O FGTS rende cerca de 3% + TR ao ano: usá-lo para amortizar quase sempre compensa.
            </li>
            <li>
              <b className="text-slate-900 dark:text-white">Paz de espírito conta.</b> Ter a casa quitada mais cedo também é um retorno.
            </li>
          </ul>
        </div>
      </section>
    </div>
  );
};
