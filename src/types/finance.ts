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
  // Amortização efetiva: o que abate o saldo
  amount: number;
  // Valor pago, com os juros pro rata desde o último vencimento, e a data do pagamento (AAAA-MM-DD)
  paid?: number;
  date?: string;
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
  source: 'banco';
  // Quando o saldo foi informado
  createdAt?: string;
}

// Saldo real usado na tabela: os informados e os calculados pela fatura do check-in ('fatura')
export interface ScheduleCheckpoint extends Omit<BalanceCheckpoint, 'source'> {
  source: BalanceCheckpoint['source'] | 'fatura';
}

// Registro do mês: a fatura da parcela, linha a linha como no app do banco
export interface CheckIn {
  id: string;
  yearMonth: string;
  // Total pago: prestação + atraso − FGTS
  paidAmount: number;
  amortization?: number;
  interest?: number;
  // Multa e juros de mora: entram no total pago, não mexem no saldo nem nos seguros
  charges?: number;
  // FGTS usado na prestação: abate do que a pessoa pagou
  fgts?: number;
  // Parcela adiantada só agendada no débito automático: conta como paga no vencimento
  scheduled?: boolean;
  // Saldo depois da parcela; 'fatura' = calculado pelos juros e pela amortização da fatura
  balanceAfter?: number;
  balanceSource?: 'fatura' | 'banco';
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
  // Saldo ajustado por um valor real: do banco ou calculado pela fatura
  checkpoint: ScheduleCheckpoint['source'] | null;
  // Amortização e juros copiados da fatura do check-in (não previstos)
  fromInvoice: boolean;
}
