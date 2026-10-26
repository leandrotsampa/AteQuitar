export type AmortSystem = 'SAC' | 'PRICE';

// Amortização extra: reduz o prazo (mantém a parcela) ou reduz a parcela (mantém o prazo)
export type ExtraMode = 'prazo' | 'parcela';
export type ExtraSource = 'proprio' | 'fgts' | 'decimo';

export interface Contract {
  nickname: string;
  bank: string;
  // "no" ou "na" antes do nome do banco digitado (ex.: "na Credifoz"); vazio = regra automática
  bankPreposition?: 'no' | 'na';
  propertyValue: number;
  financedAmount: number;
  // Taxa de juros efetiva anual do contrato (% a.a.)
  annualRate: number;
  // Como a pessoa informou a taxa (o valor guardado é sempre a efetiva ao ano): para o cadastro
  // reabrir do mesmo jeito, ex.: a nominal do app da Caixa
  rateInput?: 'efetiva' | 'nominal' | 'mes';
  // Custo efetivo total informado no contrato (% a.a.), opcional
  cet: number;
  termMonths: number;
  system: AmortSystem;
  // Mês da 1ª parcela (AAAA-MM) e dia do vencimento
  firstDueMonth: string;
  dueDay: number;
  // Saldo corrigido pela TR todo mês (padrão em Caixa, BB e no SFH)
  trIndexed: boolean;
  // Seguros e taxa da última fatura informada no cadastro: base da previsão até o primeiro
  // check-in com a fatura
  feesRef?: FeesReference;
}

// Seguros e taxa de administração de uma fatura. Com MIP e DFI separados a previsão das
// próximas é exata; só o total ("Seguros") também serve, com alguns centavos de diferença
export interface InvoiceFees {
  insurance: number; // MIP + DFI
  mip?: number;
  dfi?: number;
  adminFee: number;
}

export interface FeesReference extends InvoiceFees {
  yearMonth: string;
}

export interface ExtraPayment {
  id: string;
  yearMonth: string;
  amount: number;
  mode: ExtraMode;
  source: ExtraSource;
  note?: string;
  // Quando foi lançada: decide se entra antes ou depois de um saldo real informado no mesmo mês
  createdAt?: string;
}

// Saldo devedor real informado (app do banco ou extrato anual do IR)
export interface BalanceCheckpoint {
  id: string;
  yearMonth: string;
  balance: number;
  source: 'banco' | 'ir';
  // Quando o saldo foi informado (o do IR é sempre o de 31 de dezembro)
  createdAt?: string;
}

// Registro do mês: parcela paga (e, se quiser, o saldo depois dela)
export interface CheckIn {
  id: string;
  yearMonth: string;
  paidAmount: number;
  balanceAfter?: number;
  // Amortização extra registrada junto neste check-in (para reabrir e editar sem duplicar)
  extraId?: string;
  // Seguros e taxa da fatura do mês: passam a ser a base da previsão dos meses seguintes
  fees?: InvoiceFees;
  createdAt: string;
}

export interface ScheduleRow {
  index: number; // 1 = primeira parcela
  yearMonth: string;
  openingBalance: number;
  correction: number; // TR aplicada ao saldo
  // A TR do mês não é a oficial do vencimento (a do mês, a embutida ou a média): o saldo é estimado
  trEstimated: boolean;
  interest: number;
  amortization: number;
  fees: number; // seguros + taxa de administração
  insurance: number; // MIP + DFI
  mip?: number; // só quando a fatura de referência separa MIP e DFI
  dfi?: number;
  adminFee: number;
  // Seguros e taxa copiados de uma fatura deste mês (não previstos)
  feesFromInvoice: boolean;
  payment: number; // parcela total
  extra: number;
  closingBalance: number;
  checkpoint: boolean; // saldo ajustado pelo valor real informado
}
