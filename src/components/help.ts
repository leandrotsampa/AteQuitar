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
    where: 'No contrato: quadro-resumo, "Valor do financiamento".\nNo app da Caixa: Habitação → seu contrato → Detalhes do contrato → "Valor financiado".',
  },
  termMonths: {
    title: 'Prazo em meses',
    body: 'Em quantas parcelas o financiamento foi dividido. 30 anos são 360 meses; 35 anos, 420.',
    where: 'No contrato: quadro-resumo, "Prazo de amortização" (em meses).\nNo app da Caixa: Detalhes do contrato → "Prazo contratado".',
  },
  system: {
    title: 'SAC ou Price?',
    body: 'No SAC a parcela começa mais alta e vai caindo todo mês. Na Price (Tabela Price) a parcela fica quase igual do começo ao fim. A maioria dos financiamentos da Caixa é SAC.',
    where: 'No contrato: quadro-resumo, "Sistema de amortização".\nNo app da Caixa: Detalhes do contrato → "Sistema de amortização" (ex.: "SAC - Sist. Amortização Constante").\nDica: se a sua parcela cai um pouco todo mês, é SAC.',
  },
  annualRate: {
    title: 'Qual taxa usar',
    body: 'O banco escreve a mesma taxa de três jeitos e qualquer um serve, desde que você escolha a opção certa acima do campo:\n• Efetiva ao ano: os juros de 12 meses com juros sobre juros (ex.: 9,79%).\n• Nominal ao ano: a taxa do mês × 12 (ex.: 9,3764%).\n• Ao mês: a taxa de cada parcela (ex.: 0,7814%).\nSe o contrato traz duas taxas, "balcão" e "reduzida", use a que está valendo hoje (a reduzida, se você mantém os benefícios de relacionamento).',
    where: 'No contrato: quadro-resumo, "Taxa de juros", com a nominal e a efetiva lado a lado.\nNo app da Caixa: Detalhes do contrato → "Juros nominais vigente" → escolha Nominal ao ano.',
  },
  cet: {
    title: 'CET: custo efetivo total',
    body: 'A taxa que inclui tudo: juros, seguros e tarifas. É o número certo para comparar bancos. Opcional, mas ajuda no "Minha taxa é justa?".',
    where: 'No contrato: quadro-resumo, "Custo Efetivo Total (CET)", em % ao ano.\nO app da Caixa não mostra o CET; ele só aparece no contrato.',
  },
  trIndexed: {
    title: 'O saldo é corrigido pela TR?',
    body: 'Na Caixa e na maioria dos contratos do SFH, sim: todo mês a TR aumenta um pouco o saldo antes de calcular os juros. Contratos com taxa fixa não têm correção. Se o seu for corrigido pelo IPCA, informe o saldo real todo mês para manter os números certos.',
    where: 'No contrato: cláusula "Atualização monetária" ou "Índice de atualização do saldo devedor".\nNo app da Caixa: Detalhes do contrato → "Indexador" (TR = Sim).',
  },
  firstDueMonth: {
    title: 'Mês da primeira parcela',
    body: 'O mês em que você pagou a parcela número 1. É a partir dele que contamos quantas já foram pagas.',
    where: 'No contrato: quadro-resumo, "Data de vencimento do primeiro encargo".\nSem o contrato: prazo − meses restantes = parcelas já pagas. No app da Caixa, com 420 de prazo e 362 restantes, foram 58; conte 58 meses para trás a partir da próxima parcela.',
  },
  dueDay: {
    title: 'Dia do vencimento',
    body: 'O dia do mês em que a parcela vence. Depois dele, consideramos a parcela do mês como paga.',
    where: 'No app da Caixa: Minhas prestações → "Vencimento" (ex.: 05 NOV = dia 5).\nNo contrato: quadro-resumo, junto da data do primeiro encargo.',
  },
  insurance: {
    title: 'Seguros obrigatórios',
    body: 'Todo financiamento tem dois seguros na parcela: MIP (morte e invalidez), que acompanha o saldo devedor, e DFI (danos ao imóvel), corrigido pela TR. Com os dois separados, a previsão das próximas faturas fica exata.',
    where: 'No detalhe da parcela no app do banco: linhas "Seguro MIP" e "Seguro DFI". Faturas em aberto às vezes mostram só "Seguros": aí use o total.',
  },
  adminFee: {
    title: 'Taxa de administração',
    body: 'Tarifa mensal cobrada por alguns bancos (na Caixa costuma ser R$ 25). Se não aparecer na fatura, deixe zero.',
    where: 'No detalhe da parcela: "Taxas", "Taxa de administração" ou "TA".',
  },
  currentBalance: {
    title: 'Saldo devedor de hoje',
    body: 'Quanto você ainda deve, segundo o banco. Com ele os números do app ficam exatos em vez de estimados.',
    where: 'No app da Caixa: Habitação → seu contrato → "Saldo devedor".\nNos outros bancos: Habitação (ou Financiamento) → "Saldo devedor". Não use o "valor para quitação", que pode vir com desconto.',
  },
  irBalance: {
    title: 'Saldo do extrato do IR',
    body: 'Todo início de ano o banco publica o extrato para o Imposto de Renda com o saldo devedor em 31 de dezembro. Cadastre um por ano: vira um ponto real no gráfico.',
    where: 'App ou site do banco → Habitação → "Extrato para Imposto de Renda" (ou "Informe de rendimentos").',
  },
} satisfies Record<string, HelpContent>;
