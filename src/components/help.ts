// Textos de ajuda dos campos: o que é e onde encontrar, em linguagem simples
import type { HelpContent } from './ui/HelpTip';

export const HELP = {
  nickname: {
    title: 'Apelido do imóvel',
    body: 'Só para você reconhecer no app. Ex.: "Apartamento", "Casa da praia".',
  },
  bank: {
    title: 'Banco do financiamento',
    body: 'Quem emprestou o dinheiro. Serve para lembrar onde buscar o saldo e o extrato.',
  },
  propertyValue: {
    title: 'Valor do imóvel',
    body: 'Quanto o imóvel custou (ou o valor de avaliação do banco). Usamos para mostrar quanto da casa já é seu.',
    where: 'No contrato, no quadro-resumo da primeira página: "Valor de compra e venda" ou "Valor de avaliação".',
  },
  financedAmount: {
    title: 'Valor financiado',
    body: 'Quanto o banco emprestou, sem contar a entrada que você pagou. É a sua dívida no começo.',
    where: 'Quadro-resumo do contrato: "Valor do financiamento" ou "Valor total da dívida".',
  },
  termMonths: {
    title: 'Prazo em meses',
    body: 'Em quantas parcelas o financiamento foi dividido. 30 anos são 360 meses; 35 anos, 420.',
    where: 'Quadro-resumo: "Prazo de amortização" (em meses).',
  },
  system: {
    title: 'SAC ou Price?',
    body: 'No SAC a parcela começa mais alta e vai caindo todo mês. Na Price (Tabela Price) a parcela fica quase igual do começo ao fim. A maioria dos financiamentos da Caixa é SAC.',
    where: 'Quadro-resumo: "Sistema de amortização". Dica: se a sua parcela cai um pouco todo mês, é SAC.',
  },
  annualRate: {
    title: 'Taxa de juros efetiva',
    body: 'Os juros que o banco cobra por ano. Use a taxa efetiva (ela é um pouco maior que a nominal). Se só tiver a taxa mensal, troque a unidade para "ao mês".',
    where: 'Quadro-resumo: "Taxa de juros efetiva anual" (ex.: 10,49% a.a.).',
  },
  cet: {
    title: 'CET: custo efetivo total',
    body: 'A taxa que inclui tudo: juros, seguros e tarifas. É o número certo para comparar bancos. Opcional, mas ajuda no "Minha taxa é justa?".',
    where: 'Quadro-resumo: "CET - Custo Efetivo Total" (% a.a.).',
  },
  trIndexed: {
    title: 'O saldo é corrigido pela TR?',
    body: 'Na Caixa e na maioria dos contratos do SFH, sim: todo mês a TR aumenta um pouco o saldo antes de calcular os juros. Contratos com taxa fixa não têm correção. Se o seu for corrigido pelo IPCA, informe o saldo real todo mês para manter os números certos.',
    where: 'Cláusula "Atualização monetária" ou "Índice de atualização do saldo devedor".',
  },
  firstDueMonth: {
    title: 'Mês da primeira parcela',
    body: 'O mês em que você pagou a parcela número 1. É a partir dele que contamos quantas já foram pagas.',
    where: 'Quadro-resumo: "Data de vencimento do primeiro encargo".',
  },
  dueDay: {
    title: 'Dia do vencimento',
    body: 'O dia do mês em que a parcela vence. Depois dele, consideramos a parcela do mês como paga.',
    where: 'No boleto ou no app do banco, ao lado da próxima parcela.',
  },
  monthlyInsurance: {
    title: 'Seguros obrigatórios',
    body: 'Todo financiamento tem dois seguros embutidos na parcela: MIP (morte e invalidez) e DFI (danos ao imóvel). Some os dois.',
    where: 'No boleto ou no detalhe da parcela no app do banco: linhas "MIP", "DFI" ou "Seguros".',
  },
  monthlyAdminFee: {
    title: 'Taxa de administração',
    body: 'Tarifa mensal cobrada por alguns bancos (na Caixa costuma ser R$ 25). Se não aparecer no boleto, deixe zero.',
    where: 'No boleto: "Taxa de administração" ou "TA".',
  },
  currentBalance: {
    title: 'Saldo devedor de hoje',
    body: 'Quanto você ainda deve, segundo o banco. Com ele os números do app ficam exatos em vez de estimados.',
    where: 'App do banco → Habitação (ou Financiamento) → "Saldo devedor". Não use o "valor para quitação", que pode vir com desconto.',
  },
  irBalance: {
    title: 'Saldo do extrato do IR',
    body: 'Todo início de ano o banco publica o extrato para o Imposto de Renda com o saldo devedor em 31 de dezembro. Cadastre um por ano: vira um ponto real no gráfico.',
    where: 'App ou site do banco → Habitação → "Extrato para Imposto de Renda" (ou "Informe de rendimentos").',
  },
} satisfies Record<string, HelpContent>;
