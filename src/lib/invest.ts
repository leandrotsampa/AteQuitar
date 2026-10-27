// Amortizar ou investir? Compara o "rendimento" de quitar dívida (os juros que deixam de
// existir) com o rendimento líquido de um investimento pelo mesmo período.

export type ProductKey = 'poupanca' | 'cdb' | 'lci' | 'tesouroSelic' | 'tesouroIpca';

export interface Product {
  key: ProductKey;
  label: string;
  detail: string;
  // Rendimento bruto anual (%)
  grossAnnual: number;
  taxFree: boolean;
}

// Imposto de renda regressivo da renda fixa pelo tempo aplicado
export function incomeTaxRate(days: number): number {
  if (days <= 180) return 0.225;
  if (days <= 360) return 0.2;
  if (days <= 720) return 0.175;
  return 0.15;
}

// Rendimento líquido anual equivalente (%), descontado o IR no resgate
export function netAnnual(product: Product, months: number): number {
  const years = Math.max(months, 1) / 12;
  const grossFactor = Math.pow(1 + product.grossAnnual / 100, years);
  const tax = product.taxFree ? 0 : incomeTaxRate(months * 30);
  const netFactor = 1 + (grossFactor - 1) * (1 - tax);
  return (Math.pow(netFactor, 1 / years) - 1) * 100;
}

export interface InvestComparison {
  debtAnnual: number; // custo da dívida (juros + TR + seguro MIP), % a.a.
  investNetAnnual: number;
  futureIfAmortize: number; // valor equivalente do dinheiro "aplicado" na dívida
  futureIfInvest: number;
  gap: number; // investir - amortizar, em R$ no horizonte
  verdict: 'amortizar' | 'investir' | 'empate';
  realDebt: number; // custo real da dívida acima da inflação
  realInvest: number;
}

export function compareInvestment(params: {
  amount: number;
  months: number;
  contractAnnual: number;
  trAnnual: number;
  // Seguro MIP ao ano (% do saldo): ele acompanha o saldo, então amortizar também o corta
  insuranceAnnual?: number;
  product: Product;
  ipca12: number;
}): InvestComparison {
  const { amount, months, contractAnnual, trAnnual, insuranceAnnual = 0, product, ipca12 } = params;
  const years = Math.max(months, 1) / 12;
  const debtAnnual = ((1 + contractAnnual / 100) * (1 + trAnnual / 100) * (1 + insuranceAnnual / 100) - 1) * 100;
  const investNetAnnual = netAnnual(product, months);
  const futureIfAmortize = amount * Math.pow(1 + debtAnnual / 100, years);
  const futureIfInvest = amount * Math.pow(1 + investNetAnnual / 100, years);
  const gap = futureIfInvest - futureIfAmortize;
  // Diferença menor que 0,3 ponto ao ano não muda a decisão: vale o que der mais tranquilidade
  const diff = investNetAnnual - debtAnnual;
  const verdict = Math.abs(diff) < 0.3 ? 'empate' : diff > 0 ? 'investir' : 'amortizar';
  const real = (r: number) => ((1 + r / 100) / (1 + ipca12 / 100) - 1) * 100;
  return {
    debtAnnual,
    investNetAnnual,
    futureIfAmortize,
    futureIfInvest,
    gap,
    verdict,
    realDebt: real(debtAnnual),
    realInvest: real(investNetAnnual),
  };
}
