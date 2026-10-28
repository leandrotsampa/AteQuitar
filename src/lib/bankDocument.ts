// Documento Descritivo do Crédito (Resolução CMN nº 5.057/2022): o extrato que o banco é obrigado a
// dar para a portabilidade, com cada parcela paga, as amortizações extras e o saldo. Aqui ele é
// lido a partir das linhas de texto do PDF (as colunas de uma linha vêm separadas por "|").
// Por enquanto, o modelo da Caixa. Nome e CPF do documento nunca são lidos

import type { AmortSystem, ExtraMode, ExtraSource } from '../types/finance';

export interface DocumentInstallment {
  dueDate: string; // AAAA-MM-DD
  paidDate?: string; // sem data: parcela futura (projeção do banco)
  amortization: number;
  interest: number;
  mip: number;
  dfi: number;
  adminFee: number;
  fgts: number;
  // Multa e juros de atraso
  charges: number;
  due: number; // valor devido
  paid: number; // valor pago
  correction: number; // atualização monetária (TR) do mês
  balanceAfter: number; // saldo devedor logo depois da parcela
  index: number; // índice de correção do mês (1 + TR)
}

export interface DocumentEvent {
  date: string; // AAAA-MM-DD
  description: string;
  amount: number; // valor do evento, sem sinal
  balanceAfter: number;
}

export interface BankDocument {
  layout: 'caixa';
  bank: string;
  referenceDate: string; // AAAA-MM-DD: a data do extrato
  nominalRate?: number; // % a.a.
  effectiveRate?: number; // % a.a.
  cet?: number;
  system?: AmortSystem;
  trIndexed?: boolean;
  contractedTerm?: number;
  remaining?: number; // parcelas que faltam
  lastDueDate?: string;
  financedAmount?: number;
  startDate?: string; // inclusão do financiamento
  paid: DocumentInstallment[];
  projected: DocumentInstallment[];
  // Amortizações extras ("AMORT P/RED PRAZO", "AMORT P/RED PRESTACAO"...)
  extras: (DocumentEvent & { mode: ExtraMode; source: ExtraSource })[];
  // Outros eventos que o app não usa (só para mostrar no resumo)
  others: DocumentEvent[];
}

export type ParseResult = { ok: true; doc: BankDocument } | { ok: false; reason: 'nao-reconhecido' | 'sem-parcelas' };

const num = (s: string) => Number(s.replace(/\./g, '').replace(',', '.'));
const iso = (br: string) => {
  const [d, m, y] = br.split('/');
  return `${y}-${m}-${d}`;
};
const MONEY = /-?\d{1,3}(?:\.\d{3})*,\d{2}/g;

// Valor depois de um rótulo na mesma linha: "Rótulo: | 9,3764"
function field(lines: string[], label: string): string | undefined {
  for (const line of lines) {
    const k = line.indexOf(label);
    if (k < 0) continue;
    const rest = line.slice(k + label.length).replace(/^[:*\s|]+/, '');
    const value = rest.split('|')[0]?.trim();
    if (value) return value;
  }
  return undefined;
}

const numberField = (lines: string[], label: string) => {
  const v = field(lines, label);
  return v && /^-?[\d.]+(,\d+)?$/.test(v) ? num(v) : undefined;
};

// Linha de parcela: "1 | 05/08/2024 | 05/08/2024 | 130,11 | 3.950,45 44,65 112,48 | ... | 399.013,73 1,00031790"
const INSTALLMENT = /^\d+\s*\|\s*(\d{2}\/\d{2}\/\d{4})\s*\|\s*(?:(\d{2}\/\d{2}\/\d{4})\s*\|)?(.*?)\s(\d,\d{8})\s*$/;

function installment(line: string): DocumentInstallment | null {
  const m = INSTALLMENT.exec(line);
  if (!m) return null;
  // Os valores podem vir colados ("3.950,45 44,65 112,48"): cada um termina em vírgula e 2 casas
  const v = (m[3].match(MONEY) ?? []).map(num);
  // Amortização, juros, MIP, DFI, seguros, taxas, FCVS, FGTS, encargo líquido, atraso, devido,
  // pago, diferença, atualização, saldo
  if (v.length !== 15) return null;
  return {
    dueDate: iso(m[1]),
    ...(m[2] ? { paidDate: iso(m[2]) } : {}),
    amortization: v[0],
    interest: v[1],
    mip: v[2],
    dfi: v[3],
    adminFee: v[5],
    fgts: v[7],
    charges: v[9],
    due: v[10],
    paid: v[11],
    correction: v[13],
    balanceAfter: v[14],
    index: num(m[4]),
  };
}

export function parseBankDocument(lines: string[]): ParseResult {
  const text = lines.join('\n');
  if (!/Documento Descritivo do Cr[ée]dito/i.test(text) || !/Prazo de Amortiza[çc][ãa]o Remanescente/i.test(text)) {
    return { ok: false, reason: 'nao-reconhecido' };
  }

  const paid: DocumentInstallment[] = [];
  const projected: DocumentInstallment[] = [];
  const extras: BankDocument['extras'] = [];
  const others: DocumentEvent[] = [];
  let financedAmount: number | undefined;
  let startDate: string | undefined;

  for (let k = 0; k < lines.length; k++) {
    const line = lines[k].trim();
    const row = installment(line);
    if (row) {
      (row.paidDate ? paid : projected).push(row);
      continue;
    }
    // Evento: "17/07/2024 | AMORT P/RED PRAZO - REC PROPRIOS" e, na linha seguinte,
    // "9,3764 | -1.215,91 | 399.016,99" (taxa, valor do evento, saldo depois)
    const ev = /^(\d{2}\/\d{2}\/\d{4})\s*\|\s*([A-ZÇÃÕÁÉÍÓÚÂÊÔ][^|]*)$/.exec(line);
    if (!ev) continue;
    const values = (lines[k + 1] ?? '').match(MONEY);
    const description = ev[2].trim();
    if (!values || values.length < 2) continue;
    const amount = Math.abs(num(values[values.length - 2]));
    const balanceAfter = num(values[values.length - 1]);
    const date = iso(ev[1]);
    if (/^INCLUS/.test(description)) {
      financedAmount ??= amount;
      startDate ??= date;
    } else if (/^AMORT/.test(description) && amount > 0) {
      extras.push({
        date,
        description,
        amount,
        balanceAfter,
        mode: /PREST/.test(description) ? 'parcela' : 'prazo',
        source: /FGTS/.test(description) ? 'fgts' : 'proprio',
      });
    } else {
      others.push({ date, description, amount, balanceAfter });
    }
    k++;
  }

  if (paid.length === 0) return { ok: false, reason: 'sem-parcelas' };

  const systemText = field(lines, 'Sistema de Amortização') ?? '';
  const indexer = field(lines, 'Indexador');
  const reference = field(lines, 'Data Referência');
  const lastDue = field(lines, 'Data vencimento da última parcela do contrato');
  return {
    ok: true,
    doc: {
      layout: 'caixa',
      bank: 'Caixa',
      referenceDate: reference && /\d{2}\/\d{2}\/\d{4}/.test(reference) ? iso(reference) : paid[paid.length - 1].paidDate!,
      nominalRate: numberField(lines, 'Taxa de Juros Anual Nominal'),
      effectiveRate: numberField(lines, 'Taxa de Juros Anual Efetiva'),
      cet: numberField(lines, 'Custo Efetivo Total (CET)'),
      system: /SAC/i.test(systemText) ? 'SAC' : /PRICE|FRANC/i.test(systemText) ? 'PRICE' : undefined,
      trIndexed: indexer ? /^TR\b/i.test(indexer) : undefined,
      contractedTerm: numberField(lines, 'Prazo de Amortização Contratado'),
      remaining: numberField(lines, 'Prazo de Amortização Remanescente'),
      lastDueDate: lastDue && /\d{2}\/\d{2}\/\d{4}/.test(lastDue) ? iso(lastDue) : undefined,
      financedAmount,
      startDate,
      paid,
      projected,
      extras,
      others,
    },
  };
}
