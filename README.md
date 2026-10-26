# Até Quitar

Aplicativo desktop para acompanhar o financiamento imobiliário até a última parcela. Feito para quem financiou a casa e quer entender, sem economês, onde está, quanto falta e quais decisões fazem quitar mais cedo.

## O que ele faz

- **Minha casa**: saldo devedor, parcelas restantes, data da quitação e uma casa ilustrada que se enche conforme a dívida cai (uma luz acende a cada 10%).
- **Check-in do mês**: em menos de um minuto, registre a parcela paga, uma amortização extra e o saldo que o banco mostra. Com o saldo real, a projeção deixa de ser estimada.
- **Parcelas**: a tabela completa mês a mês (amortização, juros, TR, seguros e saldo) e todos os seus registros.
- **Amortizar**: quanto de juros some ao pagar a mais, uma vez, todo mês ou todo ano, reduzindo prazo ou parcela.
- **Amortizar ou investir?**: compara o custo da dívida com poupança, CDB, LCI/LCA e Tesouro, já descontado o IR.
- **SAC ou Price**: os dois sistemas com os dados do seu contrato.
- **Minha taxa é justa?**: sua taxa contra as médias de financiamento imobiliário publicadas pelo Banco Central.
- **Taxas do mercado**: Selic, CDI, TR, IPCA e poupança atualizados automaticamente.
- **Aprender**: TR, CET, seguros, FGTS, portabilidade, IR e quitação em linguagem simples.

Cada campo de cadastro tem um **?** que explica o que é e onde encontrar a informação no contrato, no boleto ou no app do banco.

## Taxas automáticas

As taxas vêm da API pública do Sistema Gerenciador de Séries Temporais (SGS) do Banco Central, sem chave de acesso:

| Série | Código SGS |
| --- | --- |
| Selic meta | 432 |
| CDI | 4389 |
| TR (1º dia do mês) | 7811 |
| IPCA do mês / 12 meses | 433 / 13522 |
| Poupança | 195 |
| Financiamento imobiliário: mercado / reguladas / geral | 20772 / 20773 / 20774 |

O app consulta ao abrir (no máximo a cada 12 horas) e guarda os últimos valores para funcionar sem internet. A TR é buscada mês a mês desde a primeira parcela do contrato.

## Seus dados

Tudo fica num banco SQLite local, `atequitar.sqlite`:

- versão portátil (`.exe` portátil ou AppImage): na mesma pasta do aplicativo;
- versão instalada: na pasta de dados do usuário do sistema.

Tabelas: `contract`, `checkins`, `extra_payments`, `balance_checkpoints`, `milestones`, `rate_latest`, `rate_points`, `tr_monthly` e `app_meta`. Cada gravação troca os dados numa única transação, e as restrições do esquema (valores positivos, sistema SAC/PRICE, um check-in por mês) barram registros inválidos.

Em **Dados e backup** dá para abrir a pasta e **exportar ou importar os dados em JSON** (contrato, check-ins, amortizações e saldos; as taxas do mercado ficam de fora porque o app as busca de novo). O arquivo exportado tem `"formato": "ate-quitar"` e um número de versão.

Quem usou a primeira versão, que guardava em `atequitar-dados.json`, tem os dados importados para o SQLite na primeira abertura; o arquivo antigo fica renomeado para `.importado`. Se o módulo nativo do SQLite não carregar, o app continua funcionando com esse arquivo JSON como reserva e avisa na tela de dados.

## Desenvolvimento

Requisitos: Node.js 20 ou mais novo. O `npm install` recompila o `better-sqlite3` para a versão do Electron (`postinstall`).

```bash
npm install
npm run dev            # interface no navegador em http://localhost:3100
npm run electron:dev   # janela do Electron (com o npm run dev rodando)
npm start              # build + Electron carregando o dist
npm test               # testes do motor de cálculo
npm run lint           # checagem de tipos
```

Gerar os instaladores:

```bash
npm run dist:portable  # Windows, .exe portátil
npm run dist:win       # Windows, portátil + instalador
npm run dist:mac
npm run dist:linux
```

Os ícones saem de `build/icon.svg` com `npm run icons`.

## Como as contas são feitas

- Taxa mensal equivalente à anual efetiva: `(1 + a)^(1/12) − 1`.
- A cada mês, o saldo é corrigido pela TR (quando o contrato tem TR), depois vêm os juros sobre o saldo corrigido e a amortização: no SAC, saldo ÷ parcelas restantes; na Price, a parcela pela fórmula sobre o saldo e o prazo restantes.
- Amortização extra reduzindo o prazo mantém o mesmo nível de pagamento e recalcula quantas parcelas faltam; reduzindo a parcela, mantém o prazo.
- Saldos reais informados (banco ou extrato do IR) substituem o saldo calculado naquele mês e a projeção segue a partir dele.
- Amortizar × investir compara o custo anual da dívida (juros + TR projetada) com o rendimento líquido de IR (tabela regressiva) no mesmo horizonte.

O motor de cálculo fica em `src/lib/finance.ts` e `src/lib/invest.ts`, com testes ao lado.

## Aviso

O Até Quitar é uma ferramenta de acompanhamento e simulação. Os valores são aproximações do que o banco calcula e não substituem o extrato oficial nem orientação financeira profissional.

## Licença

MIT
