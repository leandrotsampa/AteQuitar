# Changelog

Todas as versões do Até Quitar e o que mudou em cada uma.

## v1.2.0 (2026-10-28)

### ✨ Novidades

- Ajuste do banco no check-in (2f83258)
- Avisa quando sai uma versão nova no GitHub (8c9cb9d)
- Importar o Documento Descritivo do Crédito do banco (78fb719)

### 🐛 Correções

- Cartões da tela inicial com os valores alinhados (b32d114)
- Check-in cabe na janela sem rolagem (5dd61f6)
- Selo do saldo no topo mostra que abre o check-in (556c68e)
- Contas como a Caixa (TR por dias úteis, taxa pela efetiva e MIP sobre o saldo depois da parcela) (5c8c4f9)

### 📝 Documentação

- README alinhado com a versão 1.2.0 (a5ac8a5)
- Regras de cálculo atualizadas e diferenças conhecidas (a55071a)

## v1.1.0 (2026-10-27)

### ✨ Novidades

- Simulador mostra quantas parcelas a amortização elimina (a5e6273)
- Seguro MIP no custo da dívida e dica do melhor dia para amortizar (96422c6)
- Prazo de quem já amortizou acertado pela fatura e prazo do contrato explicado (b283f7a)
- Etapas em círculos com ícones e saldo informado só em Registros (7e20b51)
- Check-in espelhando a fatura e saldo calculado pelos juros (5db26e3)
- Seguros pela fatura no check-in e TR de cada parcela igual à do banco (02fd85c)
- Grade de anos no seletor de mês (4c99286)
- Taxa nominal no cadastro e ajuda com o que aparece no contrato e no app do banco (a95cc0b)

### 🐛 Correções

- Simulador de amortização parte do mês atual e mostra centavos (cee9683)
- Resumo do check-in só com o saldo de hoje quando o banco informou (c838d58)
- Resumo do check-in mostra o saldo de hoje e o do vencimento (ba5fd22)
- Tela inicial mantém o saldo do banco do período depois da fatura (41c0e98)
- Seguros do check-in abertos em MIP e DFI por padrão (55a8f9d)
- Saldo da tela inicial igual ao do banco no dia de hoje (ce5a4c6)
- Botão com som próprio não toca o clique junto (c1d91ed)
- Som em todos os botões e exemplo mantido ao editar o contrato (06c58c7)
- Amortização extra calculada como a Caixa (ebdaa01)
- Próxima parcela batendo com a fatura no centavo (7fad1e5)
- Botões e opções visíveis no modo claro e tutorial atualizado (fd59654)
- Registros editáveis no histórico e amortização no mês do saldo informado (9fbd4bc)
- Dados salvos voltam preenchidos ao editar (8411c85)
- Check-in da próxima parcela, sugestão de seguros e frase dos marcos (6cb6c82)
- "no" ou "na" certo antes do nome do banco (4cd5a9d)

### ♻️ Melhorias internas

- Remove código sem uso (5cd0bac)

### 📝 Documentação

- Dica do dia de amortizar mais clara sobre o vencimento (1635b97)
- Demonstração mais fluida (6d02260)
- Demonstração animada no README (cd896ef)

### 📦 Build e distribuição

- Notas da release sem os commits de troca de versão (55936c5)

## v1.0.0 (2026-10-26)

### ✨ Novidades

- Mini-tutorial do cadastro e tutorial com os seus números ao sair do exemplo (44edeb1)
- Tela de carregamento do portátil (89387fb)
- Tutorial guiado na primeira abertura e em cada tela (5e8f45e)
- Exemplo com 11 anos de financiamento e percentual sempre para baixo (ea5a865)

### ⚡ Desempenho

- Pacote menor e abertura mais rápida (4fc01c0)

### 📝 Documentação

- README completo com banner e capturas (08bb4c5)

### 📦 Build e distribuição

- Action Gerar release e changelog automático (38cdf61)

### 📌 Outras mudanças

- Dica do botão de recolher não fica presa depois do clique (0505692)
- Corrige o botão de recolher o menu que não respondia ao clique (0c7c9c8)
- Botão de recolher o menu com a identidade do app (7805849)
- Exportar/importar em JSON e botão de recolher na borda do menu (b372ed1)
- Ajustes de layout (2a94ddb)
- Dados em SQLite (3226658)
- Seletor de mês no estilo da competência (71bda08)
- Até Quitar: acompanhamento de financiamento imobiliário (604a833)

