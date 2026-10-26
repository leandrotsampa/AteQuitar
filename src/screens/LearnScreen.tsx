import React, { useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { ArrowRight, ChevronDown, Search } from 'lucide-react';
import type { ScreenId, ScreenProps } from './types';
import { PageHeader } from '../components/ui/PageHeader';
import { card, inputBase } from '../components/ui/card';
import { EASE_OUT } from '../lib/motion';
import { playSound } from '../hooks/useSound';

interface Topic {
  id: string;
  group: 'Básico' | 'Economizar' | 'Burocracia';
  title: string;
  summary: string;
  body: React.ReactNode;
  link?: { label: string; screen: ScreenId };
}

const TOPICS: Topic[] = [
  {
    id: 'saldo',
    group: 'Básico',
    title: 'Por que meu saldo cai tão devagar?',
    summary: 'Juros e TR comem boa parte da parcela no começo.',
    body: (
      <>
        <p>
          Cada parcela tem três partes: <b>juros</b> (o aluguel do dinheiro), <b>amortização</b> (o que realmente abate a dívida) e <b>seguros e taxas</b>. No começo o saldo é
          grande, então os juros também são, e sobra menos para amortizar.
        </p>
        <p>
          Se o contrato tem TR, todo mês o saldo é corrigido um pouquinho para cima antes do desconto da parcela. Por isso o saldo pode cair menos que o valor amortizado.
        </p>
      </>
    ),
    link: { label: 'Ver para onde vai sua parcela', screen: 'home' },
  },
  {
    id: 'sac-price',
    group: 'Básico',
    title: 'SAC e Price em uma frase',
    summary: 'SAC: parcela cai. Price: parcela fixa e mais juros no total.',
    body: (
      <p>
        No <b>SAC</b> você amortiza sempre o mesmo valor: a parcela começa alta e cai, e o total de juros é menor. Na <b>Price</b> a parcela é constante: no começo quase tudo é
        juros e a dívida demora mais a cair, então o total pago é maior.
      </p>
    ),
    link: { label: 'Comparar com os seus números', screen: 'systems' },
  },
  {
    id: 'tr',
    group: 'Básico',
    title: 'O que é a TR e por que ela importa',
    summary: 'É o índice que corrige o saldo de muitos contratos.',
    body: (
      <p>
        A Taxa Referencial é calculada pelo Banco Central a partir dos juros do mercado. Quando a Selic está alta, a TR fica acima de zero e aumenta o saldo devedor todo mês.
        Com a Selic baixa, ela pode ficar em zero. O app busca a TR oficial de cada mês desde a sua primeira parcela.
      </p>
    ),
    link: { label: 'Ver a TR de hoje', screen: 'market' },
  },
  {
    id: 'cet',
    group: 'Básico',
    title: 'Taxa de juros × CET',
    summary: 'O CET inclui seguros e tarifas: é o custo real.',
    body: (
      <p>
        A taxa de juros é só uma parte do custo. O <b>Custo Efetivo Total</b> soma juros, seguros obrigatórios (MIP e DFI) e tarifas. Para comparar bancos ou propostas de
        portabilidade, compare sempre o CET.
      </p>
    ),
  },
  {
    id: 'seguros',
    group: 'Básico',
    title: 'MIP e DFI: os seguros da parcela',
    summary: 'Morte e invalidez + danos ao imóvel. São obrigatórios.',
    body: (
      <p>
        O <b>MIP</b> quita a dívida (ou parte dela) se um dos compradores falecer ou ficar inválido. O <b>DFI</b> cobre danos ao imóvel, como incêndio. O MIP sobe com a sua
        idade; você pode pedir para trocar a seguradora por uma mais barata, desde que a cobertura seja equivalente.
      </p>
    ),
  },
  {
    id: 'prazo-parcela',
    group: 'Economizar',
    title: 'Reduzir prazo ou parcela?',
    summary: 'Prazo economiza mais; parcela alivia o mês.',
    body: (
      <p>
        Ao amortizar, o banco pergunta o que reduzir. <b>Reduzir o prazo</b> mantém a parcela e corta meses do fim: como você deixa de pagar juros por mais tempo, economiza
        mais. <b>Reduzir a parcela</b> é bom quando o orçamento está apertado.
      </p>
    ),
    link: { label: 'Simular as duas opções', screen: 'amortize' },
  },
  {
    id: 'fgts',
    group: 'Economizar',
    title: 'Usar o FGTS para amortizar',
    summary: 'A cada 2 anos, com 3 anos de carteira assinada.',
    body: (
      <>
        <p>Você pode usar o FGTS para abater o saldo, quitar ou pagar até 80% de 12 parcelas seguidas, se:</p>
        <ul className="list-disc pl-5 space-y-1">
          <li>somar pelo menos 3 anos de trabalho com FGTS (não precisa ser seguido);</li>
          <li>o imóvel for residencial e o financiamento do SFH;</li>
          <li>não tiver outro imóvel na mesma cidade em que mora ou trabalha;</li>
          <li>tiver passado 2 anos desde o último uso para amortização.</li>
        </ul>
        <p>O pedido é feito pelo app do FGTS ou no seu banco. Como o FGTS rende pouco, usar o saldo para amortizar quase sempre compensa.</p>
      </>
    ),
  },
  {
    id: 'decimo',
    group: 'Economizar',
    title: 'O 13º e a restituição do IR',
    summary: 'Dinheiro extra que o orçamento não espera.',
    body: (
      <p>
        Dinheiro que entra fora do salário, como o 13º, a restituição do IR ou um bônus, é o candidato ideal para amortizar: não aperta o mês e vai direto contra os juros.
        Antes, confira se a sua reserva de emergência já está montada.
      </p>
    ),
    link: { label: 'Ver quanto o 13º economizaria', screen: 'amortize' },
  },
  {
    id: 'portabilidade',
    group: 'Economizar',
    title: 'Portabilidade: levar a dívida para outro banco',
    summary: 'Troque por uma taxa menor sem pagar a dívida antes.',
    body: (
      <p>
        A portabilidade é um direito seu: outro banco quita o seu contrato e você passa a pagar a ele, com uma taxa menor. Compare o CET, considere custos de cartório e use a
        proposta para negociar com o seu banco atual, que muitas vezes cobre a oferta.
      </p>
    ),
    link: { label: 'Ver se sua taxa está alta', screen: 'rate' },
  },
  {
    id: 'ir',
    group: 'Burocracia',
    title: 'Como declarar no Imposto de Renda',
    summary: 'Imóvel em Bens e Direitos; a dívida não entra em Dívidas.',
    body: (
      <p>
        Declare o imóvel em <b>Bens e Direitos</b> pelo valor de compra e, a cada ano, some ao valor o que você pagou de amortização e juros (exceto seguros). O financiamento
        imobiliário <b>não</b> vai na ficha de Dívidas e Ônus. O banco publica o extrato anual com os valores: registre o saldo de 31/12 aqui no app também.
      </p>
    ),
    link: { label: 'Registrar saldo do IR', screen: 'history' },
  },
  {
    id: 'quitacao',
    group: 'Burocracia',
    title: 'Quitei! E agora?',
    summary: 'Termo de quitação e baixa da alienação no cartório.',
    body: (
      <p>
        Depois da última parcela, o banco emite o <b>termo de quitação</b> em até 30 dias. Leve-o ao Cartório de Registro de Imóveis para dar baixa na alienação fiduciária
        (paga-se uma taxa de averbação). Só então a matrícula fica 100% no seu nome, sem o banco.
      </p>
    ),
  },
];

export const LearnScreen: React.FC<ScreenProps> = ({ go }) => {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState<string | null>('saldo');
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return TOPICS;
    return TOPICS.filter((t) => `${t.title} ${t.summary}`.toLowerCase().includes(q));
  }, [query]);
  const groups = ['Básico', 'Economizar', 'Burocracia'] as const;

  return (
    <div className="space-y-6 page-stagger">
      <PageHeader context="Entender" title="Aprender sem economês" description="O essencial sobre financiamento imobiliário, em linguagem de gente." />

      <div className="relative max-w-md">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Procure: FGTS, TR, portabilidade…" className={`${inputBase} pl-10 rounded-full`} aria-label="Procurar" />
      </div>

      {groups.map((g) => {
        const items = filtered.filter((t) => t.group === g);
        if (items.length === 0) return null;
        return (
          <section key={g}>
            <h2 className="text-sm font-semibold text-slate-500 dark:text-slate-400 mb-2.5">{g}</h2>
            <div className={`${card} divide-y divide-slate-900/[0.06] dark:divide-white/[0.06] overflow-hidden`}>
              {items.map((t) => {
                const isOpen = open === t.id;
                return (
                  <div key={t.id}>
                    <button
                      type="button"
                      onClick={() => {
                        playSound('tick');
                        setOpen(isOpen ? null : t.id);
                      }}
                      aria-expanded={isOpen}
                      className="w-full flex items-center justify-between gap-4 px-5 lg:px-6 py-4 text-left cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors"
                    >
                      <span>
                        <span className="block font-display font-bold text-[17px] text-slate-900 dark:text-white">{t.title}</span>
                        <span className="block text-sm text-slate-500 dark:text-slate-400">{t.summary}</span>
                      </span>
                      <ChevronDown className={`w-5 h-5 text-slate-400 shrink-0 transition-transform duration-[var(--duration-base)] ${isOpen ? 'rotate-180' : ''}`} />
                    </button>
                    <AnimatePresence initial={false}>
                      {isOpen && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.3, ease: EASE_OUT }}
                          className="overflow-hidden"
                        >
                          <div className="px-5 lg:px-6 pb-5 space-y-3 text-[15px] text-slate-600 dark:text-slate-300 leading-relaxed max-w-3xl">
                            {t.body}
                            {t.link && (
                              <button
                                type="button"
                                onClick={() => go(t.link!.screen)}
                                className="inline-flex items-center gap-1.5 text-sm font-bold text-anil-700 hover:text-anil-600 dark:text-anil-300 cursor-pointer"
                              >
                                {t.link.label} <ArrowRight className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                );
              })}
            </div>
          </section>
        );
      })}
      {filtered.length === 0 && <p className="text-slate-500">Nada encontrado para "{query}". Tente outra palavra.</p>}
    </div>
  );
};
