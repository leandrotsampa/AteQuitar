// O driver.js (e o CSS dele) só carrega quando um tutorial abre: não pesa na abertura do app
import type { DriveStep, Driver } from 'driver.js';
import type { ScreenId } from '../screens/types';

// Passos do tutorial por tela, na ordem do uso real. O id é o que fica marcado como visto; passo com
// id novo numa versão futura aparece sozinho como novidade (ids já publicados nunca mudam).
interface TourStep {
  id: string;
  title: string;
  description: (ctx: { demo: boolean }) => string;
  side?: 'top' | 'right' | 'bottom' | 'left';
  align?: 'start' | 'center' | 'end';
}

const HOME_STEPS: TourStep[] = [
  {
    id: 'casa',
    title: 'Sua casa, enchendo',
    description: ({ demo }) =>
      'Conforme a dívida cai, a casa vai sendo preenchida. A cada <b>10% quitados</b>, uma luz acende e o app comemora com você.' +
      (demo ? '<br><span class="aq-tour-note">Este é o financiamento de exemplo. Quando quiser, clique em <b>Usar o meu</b> no topo.</span>' : ''),
    side: 'right',
    align: 'start',
  },
  {
    id: 'falta',
    title: 'Quanto falta',
    description: () =>
      'O saldo devedor de hoje, quantas parcelas faltam e quando acaba. O selo no topo diz se é uma <b>estimativa</b> ou se já usa o <b>saldo real</b> do banco.',
    side: 'left',
    align: 'start',
  },
  {
    id: 'marcos',
    title: 'O próximo marco',
    description: () => 'Quanto falta de dívida para chegar ao próximo 10% e acender mais uma luz da casa.',
    side: 'left',
    align: 'center',
  },
  {
    id: 'checkin',
    title: 'Check-in do mês',
    description: () =>
      'Todo mês, depois do vencimento, registre a parcela paga. Leva menos de um minuto e, se você informar o saldo do app do banco, os números ficam exatos.',
    side: 'bottom',
    align: 'center',
  },
  {
    id: 'indicadores',
    title: 'O resumo em números',
    description: () =>
      'A próxima parcela, quanto você já pagou, os <b>juros que ainda virão</b> (é isso que amortizar ataca) e quanto as suas amortizações extras já economizaram.',
    side: 'top',
    align: 'center',
  },
  {
    id: 'parcela',
    title: 'Para onde vai a parcela',
    description: () => 'Quanto da parcela abate a dívida, quanto é juros e quanto é seguro e taxa. No SAC, a fatia que abate a dívida cresce todo mês.',
    side: 'left',
    align: 'start',
  },
  {
    id: 'nav-decidir',
    title: 'Hora de decidir',
    description: () =>
      'Aqui ficam as simulações: quanto economiza <b>amortizando</b>, se vale mais <b>investir</b>, <b>SAC ou Price</b> e se a <b>sua taxa</b> está justa.',
    side: 'right',
    align: 'start',
  },
  {
    id: 'como-usar',
    title: 'Quando quiser rever',
    description: () =>
      'Em qualquer tela, este botão mostra o passo a passo dela. Cada tela também se apresenta na primeira vez que você entra.',
    side: 'right',
    align: 'end',
  },
];

const HISTORY_STEPS: TourStep[] = [
  {
    id: 'hist-anos',
    title: 'Ano a ano',
    description: () => 'Escolha o ano para ver as parcelas dele. A <b>próxima</b> parcela fica destacada em amarelo.',
    side: 'bottom',
    align: 'start',
  },
  {
    id: 'hist-tabela',
    title: 'Cada parcela por dentro',
    description: () =>
      'Valor, quanto abateu a dívida, juros, a <b>TR</b> do mês, seguros e o saldo depois. O selo verde marca os meses com check-in.',
    side: 'top',
    align: 'start',
  },
  {
    id: 'hist-abas',
    title: 'Seus registros',
    description: () =>
      'Em <b>Registros</b> ficam os check-ins, as amortizações extras e os saldos do banco e do <b>extrato do Imposto de Renda</b>. Dá para adicionar e excluir.',
    side: 'bottom',
    align: 'end',
  },
];

const AMORTIZE_STEPS: TourStep[] = [
  {
    id: 'amo-valor',
    title: 'Monte a simulação',
    description: () => 'Quanto quer pagar a mais, se é uma vez, todo mês ou todo ano, e se prefere reduzir o prazo ou a parcela.',
    side: 'right',
    align: 'start',
  },
  {
    id: 'amo-resultado',
    title: 'Quanto de juros some',
    description: () => 'O que você deixa de pagar até o fim do financiamento. Muda na hora, conforme você mexe nos valores.',
    side: 'left',
    align: 'start',
  },
  {
    id: 'amo-comparar',
    title: 'Prazo ou parcela?',
    description: () => 'As duas opções lado a lado. Reduzir o prazo quase sempre economiza mais; reduzir a parcela alivia o orçamento.',
    side: 'left',
    align: 'center',
  },
  {
    id: 'amo-registrar',
    title: 'Já amortizou?',
    description: () => 'Registre aqui para os números da sua casa já contarem com o pagamento.',
    side: 'top',
    align: 'start',
  },
];

const INVEST_STEPS: TourStep[] = [
  {
    id: 'inv-produtos',
    title: 'Com o que comparar',
    description: () =>
      'Poupança, CDB, LCI/LCA e Tesouro, com as taxas de hoje do Banco Central e o rendimento <b>já sem o Imposto de Renda</b>.',
    side: 'right',
    align: 'start',
  },
  {
    id: 'inv-veredito',
    title: 'A resposta',
    description: () => 'Compara o custo da sua dívida (juros + TR) com o rendimento líquido do investimento no tempo escolhido.',
    side: 'left',
    align: 'start',
  },
  {
    id: 'inv-corrida',
    title: 'Em reais',
    description: () => 'Quanto o seu dinheiro valeria em cada caminho no fim do período.',
    side: 'left',
    align: 'start',
  },
];

const SYSTEMS_STEPS: TourStep[] = [
  {
    id: 'sys-resumo',
    title: 'A diferença no total',
    description: () => 'Com os mesmos valores do seu contrato, quanto a Price custa a mais de juros que o SAC.',
    side: 'bottom',
    align: 'start',
  },
  {
    id: 'sys-cards',
    title: 'Os dois lado a lado',
    description: () => 'Primeira e última parcela, juros e total pago em cada sistema. O seu contrato fica destacado.',
    side: 'top',
    align: 'center',
  },
];

const RATE_STEPS: TourStep[] = [
  {
    id: 'rate-termometro',
    title: 'Sua taxa no termômetro',
    description: () =>
      'Sua taxa comparada às médias que o Banco Central publica para financiamento imobiliário: reguladas (SFH), de mercado e geral.',
    side: 'bottom',
    align: 'center',
  },
  {
    id: 'rate-impacto',
    title: 'Quanto isso pesa',
    description: () => 'Quanto você pagaria a mais ou a menos de juros, até o fim, se a sua taxa fosse a média.',
    side: 'top',
    align: 'start',
  },
  {
    id: 'rate-portabilidade',
    title: 'Se estiver alta',
    description: () => 'O passo a passo para levar o financiamento a outro banco com uma taxa menor, a <b>portabilidade</b>.',
    side: 'top',
    align: 'start',
  },
];

const MARKET_STEPS: TourStep[] = [
  {
    id: 'mkt-voce',
    title: 'O que muda para você',
    description: () => 'Quanto a TR somou ao seu saldo neste mês, quanto a sua dívida custa por ano e quanto rende a poupança.',
    side: 'bottom',
    align: 'start',
  },
  {
    id: 'mkt-cards',
    title: 'As taxas de hoje',
    description: () =>
      'Selic, CDI, TR, IPCA e poupança, direto do Banco Central. Passe o mouse no <b>?</b> para entender cada uma.',
    side: 'top',
    align: 'start',
  },
  {
    id: 'mkt-atualizar',
    title: 'Sempre em dia',
    description: () => 'O app atualiza as taxas sozinho ao abrir. Este botão busca de novo na hora.',
    side: 'left',
    align: 'center',
  },
];

const LEARN_STEPS: TourStep[] = [
  {
    id: 'learn-busca',
    title: 'Procure um assunto',
    description: () => 'FGTS, TR, portabilidade, Imposto de Renda: digite e os temas aparecem.',
    side: 'bottom',
    align: 'start',
  },
  {
    id: 'learn-lista',
    title: 'Sem economês',
    description: () => 'Clique num tema para abrir. Vários têm um atalho para a tela do app que usa aquele assunto.',
    side: 'top',
    align: 'start',
  },
];

const WIZARD_STEPS: TourStep[] = [
  {
    id: 'cad-passos',
    title: 'Cinco passos curtos',
    description: () =>
      'Imóvel, empréstimo, juros, datas e, por último, os dados que deixam tudo exato. Dá para voltar a qualquer passo clicando no nome dele.',
    side: 'bottom',
    align: 'start',
  },
  {
    id: 'cad-ajuda',
    title: 'Não sabe onde achar?',
    description: () =>
      'Todo campo tem um <b>?</b> que explica o que é e <b>onde encontrar</b>: no quadro-resumo do contrato, no boleto ou no app do banco.',
    side: 'bottom',
    align: 'start',
  },
  {
    id: 'cad-previa',
    title: 'A casa reage ao que você digita',
    description: () => 'Aqui você confere o resumo do financiamento enquanto preenche.',
    side: 'left',
    align: 'start',
  },
  {
    id: 'cad-avancar',
    title: 'Sem pressa',
    description: () =>
      'Os campos marcados como <b>opcional</b> podem ficar para depois. Você completa quando quiser em <b>Meu financiamento</b>, no menu.',
    side: 'top',
    align: 'center',
  },
];

export type TourScreen = ScreenId | 'wizard';

const TOUR_SCREENS: Record<TourScreen, TourStep[]> = {
  home: HOME_STEPS,
  history: HISTORY_STEPS,
  amortize: AMORTIZE_STEPS,
  invest: INVEST_STEPS,
  systems: SYSTEMS_STEPS,
  rate: RATE_STEPS,
  market: MARKET_STEPS,
  learn: LEARN_STEPS,
  wizard: WIZARD_STEPS,
};

export const screenStepIds = (screen: TourScreen) => TOUR_SCREENS[screen].map((s) => s.id);
export const ALL_TOUR_STEP_IDS = Object.values(TOUR_SCREENS).flat().map((s) => s.id);

/**
 * Roda o tutorial com os passos pedidos (todos, ou só as novidades). Passo cujo elemento não está
 * na tela é pulado. onDone recebe os ids mostrados, para marcar como vistos.
 */
export async function runTour(opts: {
  screen: TourScreen;
  ids?: string[];
  news?: boolean;
  demo: boolean;
  reduceMotion: boolean;
  onDone: (ids: string[]) => void;
}) {
  const chosen = TOUR_SCREENS[opts.screen]
    .filter((s) => !opts.ids || opts.ids.includes(s.id))
    // Só os passos com o elemento na tela agora (ex.: sem check-in pendente, o passo dele não aparece)
    .filter((s) => document.querySelector(`[data-tour="${s.id}"]`));
  if (chosen.length === 0 || starting) return;
  starting = true;
  const [{ driver }] = await Promise.all([import('driver.js'), import('driver.js/dist/driver.css')]).finally(() => {
    starting = false;
  });

  const steps: DriveStep[] = chosen.map((s) => ({
    element: `[data-tour="${s.id}"]`,
    popover: {
      title: opts.news ? `Novidade: ${s.title}` : s.title,
      description: s.description({ demo: opts.demo }),
      side: s.side,
      align: s.align,
    },
  }));

  const tour = driver({
    steps,
    animate: !opts.reduceMotion,
    smoothScroll: !opts.reduceMotion,
    showProgress: chosen.length > 1,
    progressText: '{{current}} de {{total}}',
    nextBtnText: 'Próximo',
    prevBtnText: 'Voltar',
    doneBtnText: chosen.length > 1 ? 'Concluir' : 'Entendi',
    popoverClass: 'aq-tour',
    overlayColor: 'rgb(10 13 28)',
    overlayOpacity: 0.6,
    stagePadding: 6,
    stageRadius: 18,
    popoverOffset: 12,
    allowKeyboardControl: true,
    overlayClickBehavior: 'none',
    closeBtnLabel: 'Fechar o tutorial',
    onDestroyed: () => opts.onDone(chosen.map((s) => s.id)),
  });
  current = tour;
  tour.drive();
  return tour;
}

// Um tutorial por vez: a entrada numa tela não abre outro por cima do que está rodando (nem enquanto carrega)
let current: Driver | null = null;
let starting = false;
export const isTourRunning = () => starting || (current?.isActive() ?? false);
