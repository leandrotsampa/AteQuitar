// Dicas contextuais e o mês que está esperando check-in
import type { FinanceModel } from './model';
import type { AppData } from './store';
import { addMonths, currentYearMonth, diffMonths, formatBRL, formatPct, monthName } from './format';
import { simulateExtra } from './finance';
import type { ScreenId } from '../screens/types';

// Último mês com parcela vencida que ainda não foi registrado no check-in
export function pendingCheckinMonth(model: FinanceModel, data: AppData): string | null {
  const { paidCount } = model.summary;
  if (paidCount === 0) return null;
  const ym = model.rows[paidCount - 1].yearMonth;
  if (diffMonths(ym, currentYearMonth()) > 1) return null; // financiamento já terminou
  return data.checkins.some((c) => c.yearMonth === ym) ? null : ym;
}

// Meses seguidos com check-in (contando para trás a partir do último mês vencido)
export function checkinStreak(model: FinanceModel, data: AppData): number {
  const done = new Set(data.checkins.map((c) => c.yearMonth));
  let streak = 0;
  for (let k = model.summary.paidCount - 1; k >= 0; k--) {
    if (done.has(model.rows[k].yearMonth)) streak++;
    else if (k === model.summary.paidCount - 1) continue; // o mês atual ainda pode ser registrado
    else break;
  }
  return streak;
}

export interface Tip {
  id: string;
  title: string;
  text: string;
  action?: { label: string; screen?: ScreenId; checkin?: boolean };
  tone: 'anil' | 'sol' | 'menta';
}

export function buildTips(model: FinanceModel, data: AppData): Tip[] {
  const { contract, summary } = model;
  const tips: Tip[] = [];
  const now = currentYearMonth();
  const month = Number(now.slice(5, 7));

  if (!model.calibrated) {
    tips.push({
      id: 'calibrar',
      title: 'Deixe os números exatos',
      text: 'Hoje o saldo é uma estimativa. Abra o app do banco, copie o saldo devedor e registre no check-in: o resto se ajusta sozinho.',
      action: { label: 'Fazer check-in', checkin: true },
      tone: 'sol',
    });
  }

  if (summary.remainingCount > 12) {
    const sim = simulateExtra(contract, { extras: data.extras, trFor: model.trFor, invoices: model.options.invoices }, {
      amount: 1000,
      startYm: addMonths(now, 1),
      frequency: 'once',
      mode: 'prazo',
    });
    if (sim.interestSaved > 0) {
      tips.push({
        id: 'mil',
        title: 'Cada R$ 1.000 a mais faz diferença',
        text: `Uma amortização de R$ 1.000 no mês que vem tira cerca de ${formatBRL(sim.interestSaved)} de juros e ${sim.monthsSaved} ${
          sim.monthsSaved === 1 ? 'parcela' : 'parcelas'
        } do fim do financiamento.`,
        action: { label: 'Simular outros valores', screen: 'amortize' },
        tone: 'menta',
      });
    }
  }

  if (month >= 10) {
    tips.push({
      id: 'decimo',
      title: 'O 13º está chegando',
      text: 'Se a reserva de emergência já está montada, usar parte do 13º para amortizar costuma ser um dos melhores "investimentos" garantidos.',
      action: { label: 'Ver quanto economiza', screen: 'amortize' },
      tone: 'sol',
    });
  }
  if (month <= 4) {
    tips.push({
      id: 'ir',
      title: 'Época do Imposto de Renda',
      text: 'O banco já publicou o extrato com o saldo de 31/12. Registre esse saldo: vira um ponto real no seu gráfico e você declara o imóvel com o valor certo.',
      action: { label: 'Registrar saldo do IR', screen: 'history' },
      tone: 'anil',
    });
  }

  const market = contract.system && data.rates.latest.mortgageAll.value;
  if (market && contract.annualRate > market + 1) {
    tips.push({
      id: 'portabilidade',
      title: 'Sua taxa está acima da média',
      text: `Você paga ${formatPct(contract.annualRate)} ao ano e a média do mercado está em ${formatPct(market)}. Vale pedir uma proposta de portabilidade.`,
      action: { label: 'Ver a comparação', screen: 'rate' },
      tone: 'sol',
    });
  }

  tips.push({
    id: 'fgts',
    title: 'Seu FGTS pode amortizar',
    text: 'Com 3 anos de carteira assinada (somando todos os empregos), dá para usar o FGTS a cada 2 anos para abater o saldo ou parte das parcelas.',
    action: { label: 'Entender as regras', screen: 'learn' },
    tone: 'anil',
  });

  tips.push({
    id: 'prazo',
    title: 'Reduzir o prazo economiza mais',
    text: 'Ao amortizar, escolher "reduzir prazo" corta mais juros do que "reduzir parcela". Prefira reduzir a parcela só se o orçamento estiver apertado.',
    action: { label: 'Comparar na simulação', screen: 'amortize' },
    tone: 'menta',
  });

  if (contract.trIndexed) {
    tips.push({
      id: 'tr',
      title: `A TR de ${monthName(now)}`,
      text: `A TR está em ${formatPct(data.rates.latest.trMonth.value, 4)} ao mês. É ela que faz o seu saldo cair um pouco menos do que a amortização da parcela.`,
      action: { label: 'Ver as taxas', screen: 'market' },
      tone: 'anil',
    });
  }
  return tips;
}
