// Site do Até Quitar. Sem este arquivo, tudo continua funcionando: os links de download levam à
// página da última versão no GitHub e o simulador mostra o exemplo escrito na página.
(function () {
  'use strict';
  document.documentElement.classList.add('js');

  var REPO = 'leandrotsampa/AteQuitar';
  var C = window.AteQuitarCalc;
  var root = document.documentElement;
  var $ = function (sel, ctx) { return (ctx || document).querySelector(sel); };
  var $$ = function (sel, ctx) { return Array.prototype.slice.call((ctx || document).querySelectorAll(sel)); };
  function setText(sel, text, ctx) { $$(sel, ctx).forEach(function (el) { el.textContent = text; }); }
  var reduzMovimento = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // ---------- Tema: segue o sistema; a troca no botão fica salva neste navegador ----------
  var sistemaEscuro = window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)') : null;
  function temaAtual() {
    var t = root.getAttribute('data-theme');
    return t || (sistemaEscuro && sistemaEscuro.matches ? 'dark' : 'light');
  }
  // As capturas com versão escura (<picture>) acompanham a escolha, não só o sistema
  function sincronizarCapturas() {
    var escolhido = root.getAttribute('data-theme');
    $$('picture source[media*="prefers-color-scheme"], picture source[data-media-tema]').forEach(function (s) {
      if (!s.hasAttribute('data-media-tema')) s.setAttribute('data-media-tema', s.getAttribute('media'));
      s.setAttribute('media', escolhido === 'dark' ? 'all' : escolhido === 'light' ? 'not all' : s.getAttribute('data-media-tema'));
    });
  }
  function rotularBotoes() {
    var proximo = temaAtual() === 'dark' ? 'claro' : 'escuro';
    $$('[data-theme-toggle]').forEach(function (b) {
      b.setAttribute('aria-label', 'Usar o tema ' + proximo);
      b.setAttribute('title', 'Usar o tema ' + proximo);
    });
  }
  sincronizarCapturas();
  rotularBotoes();
  if (sistemaEscuro && sistemaEscuro.addEventListener) sistemaEscuro.addEventListener('change', rotularBotoes);
  $$('[data-theme-toggle]').forEach(function (b) {
    b.addEventListener('click', function () {
      var novo = temaAtual() === 'dark' ? 'light' : 'dark';
      if (!reduzMovimento) root.classList.add('theme-anim');
      root.setAttribute('data-theme', novo);
      try { localStorage.setItem('aq-tema', novo); } catch (e) { /* navegação privada: vale só nesta página */ }
      sincronizarCapturas();
      rotularBotoes();
      if (!reduzMovimento) setTimeout(function () { root.classList.remove('theme-anim'); }, 350);
    });
  });

  // ---------- Formatos ----------
  var brl = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
  var brl0 = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });
  var MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
  function mesAno(ym) { var p = ym.split('-'); return MESES[Number(p[1]) - 1] + ' de ' + p[0]; }
  function duracao(n) {
    var a = Math.floor(n / 12), m = n % 12, s = [];
    if (a) s.push(a + (a > 1 ? ' anos' : ' ano'));
    if (m) s.push(m + (m > 1 ? ' meses' : ' mês'));
    return s.join(' e ') || 'nenhum mês';
  }
  // Mês da próxima parcela (o mês que vem)
  function proximoMes() {
    var d = new Date();
    return C ? C.addMonths(d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0'), 1) : '';
  }

  // ---------- TR: média dos últimos 12 meses no Banco Central, com a cópia embutida se falhar ----------
  var trMedia = C ? C.trFallbackAverage : 0;
  var trOrigem = 'embutida';
  var aoMudarTr = [];
  if (C && window.fetch) {
    fetch('https://api.bcb.gov.br/dados/serie/bcdata.sgs.7811/dados/ultimos/12?formato=json')
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (lista) {
        if (!Array.isArray(lista) || lista.length < 12) return;
        var valores = lista.map(function (p) { return Number(String(p.valor).replace(',', '.')); }).filter(function (v) { return isFinite(v) && v >= 0; });
        if (valores.length < 12) return;
        trMedia = C.average(valores);
        trOrigem = 'banco-central';
        aoMudarTr.forEach(function (f) { f(); });
      })
      .catch(function () { /* sem rede: continua a TR embutida */ });
  }

  // ---------- Sistema de quem visita: só marca o cartão, não escolhe pela pessoa ----------
  function detectOS() {
    var ua = navigator.userAgent.toLowerCase();
    var p = ((navigator.userAgentData && navigator.userAgentData.platform) || navigator.platform || '').toLowerCase();
    if (/android|iphone|ipad|ipod/.test(ua) || (navigator.userAgentData && navigator.userAgentData.mobile)) return 'mobile';
    if (p.indexOf('mac') === 0 && navigator.maxTouchPoints > 1) return 'mobile'; // iPad que se diz Mac
    if (p.indexOf('win') === 0 || ua.indexOf('windows') !== -1) return 'windows';
    if (p.indexOf('mac') === 0 || ua.indexOf('mac os') !== -1) return 'mac';
    if (p.indexOf('linux') !== -1 || ua.indexOf('linux') !== -1) return 'linux';
    return 'other';
  }
  var os = detectOS();
  $$('.dl[data-os]').forEach(function (card) {
    if (card.getAttribute('data-os') !== os) return;
    card.classList.add('current');
    var badge = $('.badge', card);
    if (badge) badge.hidden = false;
  });

  // No celular o app não roda: o simulador online vira a ação principal e o download vira
  // "enviar o link para o computador"
  if (os === 'mobile') {
    $$('[data-cta-row]').forEach(function (row) {
      var dl = $('[data-cta-download]', row);
      var calc = $('[data-cta-calc]', row);
      if (!dl || !calc) return;
      var primary = dl.className;
      calc.className = primary;
      dl.className = primary.replace('btn-primary', 'btn-ghost');
      row.insertBefore(calc, dl);
      var label = $('[data-cta-download-label]', dl);
      if (label) label.textContent = 'Enviar o link para o computador';
      // O ícone de download vira o de compartilhar
      var ico = $('svg', dl);
      if (ico) ico.innerHTML = '<circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="M8.6 13.5l6.8 4M15.4 6.5l-6.8 4"/>';
      dl.addEventListener('click', function (e) {
        var url = location.origin + location.pathname.replace(/[^/]*$/, '');
        var data = { title: 'Até Quitar', text: 'Baixar o Até Quitar no computador', url: url };
        if (navigator.share) {
          e.preventDefault();
          navigator.share(data).catch(function () {});
        } else {
          dl.href = 'mailto:?subject=' + encodeURIComponent('Até Quitar') + '&body=' + encodeURIComponent(data.text + ': ' + url);
        }
      });
    });
    $$('.nav [data-nav-download]').forEach(function (a) {
      a.textContent = a.getAttribute('data-mobile-label') || 'Simular';
      a.href = a.getAttribute('data-mobile-href');
    });
  }

  // ---------- Última versão: links, tamanhos e número da versão vêm sempre do GitHub ----------
  var ASSETS = {
    'win-setup': /setup\.exe$/i,
    'win-portable': /portable\.exe$/i,
    'mac-arm': /mac-arm64\.dmg$/i,
    'mac-intel': /mac-x64\.dmg$/i,
    'linux': /\.appimage$/i
  };
  function mb(bytes) { return (bytes / 1048576).toLocaleString('pt-BR', { maximumFractionDigits: 0 }) + ' MB'; }

  if (window.fetch && $('[data-asset], [data-version], [data-version-long]')) {
    fetch('https://api.github.com/repos/' + REPO + '/releases/latest', { headers: { Accept: 'application/vnd.github+json' } })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (rel) {
        if (!rel) return;
        var version = String(rel.tag_name || '').replace(/^v/, '');
        if (version) setText('[data-version]', 'versão ' + version);
        if (version && rel.published_at) {
          var date = new Date(rel.published_at).toLocaleDateString('pt-BR', { day: 'numeric', month: 'long', year: 'numeric' });
          setText('[data-version-long]', 'Versão atual: ' + version + ', de ' + date + '.');
        }
        $$('[data-asset]').forEach(function (link) {
          var re = ASSETS[link.getAttribute('data-asset')];
          var asset = re && (rel.assets || []).filter(function (a) { return re.test(a.name); })[0];
          if (!asset) return;
          link.href = asset.browser_download_url;
          link.setAttribute('download', '');
          var size = $('[data-size]', link);
          if (size) size.textContent = mb(asset.size);
        });
      })
      .catch(function () { /* sem rede ou limite da API: os links da página de releases continuam valendo */ });
  }

  // Depois de clicar num arquivo: o cartão confirma o download e destaca o que fazer na primeira
  // abertura (o aviso do SmartScreen ou do Gatekeeper), que é onde a pessoa costuma travar
  $$('.dl-opt').forEach(function (link) {
    link.addEventListener('click', function () {
      if (!link.hasAttribute('download')) return; // sem a API, o link abre a página da versão
      var card = link.closest('.dl');
      if (!card) return;
      $$('.dl.started').forEach(function (c) { c.classList.remove('started'); setText('[data-dl-status]', '', c); });
      card.classList.add('started');
      var nome = link.getAttribute('data-dl-name') || 'o arquivo'; // "o instalador" vira "do instalador"
      setText('[data-dl-status]', 'Começou o download d' + nome + '. Quando terminar, siga o passo abaixo: o aviso é normal para um app de código aberto sem assinatura paga.', card);
      var help = $('.dl-help', card);
      if (help) {
        var r = help.getBoundingClientRect();
        if (r.bottom > window.innerHeight || r.top < 0) help.scrollIntoView({ behavior: reduzMovimento ? 'auto' : 'smooth', block: 'center' });
      }
    });
  });

  // ---------- Simulador do topo: a casa que se enche ----------
  // Contrato de exemplo: 10,49% ao ano + TR, SAC, 20 anos restantes. Amortização reduzindo o prazo
  // comparada com reduzir a parcela, com as mesmas contas do app (assets/calc.js). A TR é a média
  // fixa de nov/2025 a out/2026, para o exemplo bater com o título e o texto da página
  var sim = document.getElementById('sim');
  if (sim && C) {
    var saldo = $('[data-in="saldo"]', sim);
    var extra = $('[data-in="extra"]', sim);
    var voltar = $('[data-sim-reset]', sim);
    var agua = $('[data-water]');
    var janelas = $$('[data-win]').sort(function (a, b) { return Number(a.getAttribute('data-win')) - Number(b.getAttribute('data-win')); });
    var r = function (k, v) { setText('[data-r="' + k + '"]', v, sim); };
    var render = function () {
      var inicio = proximoMes();
      var s = Number(saldo.value);
      // Dá para amortizar até o saldo menos R$ 1.000 (o resto é a parcela do mês): o controle mostra o teto
      extra.max = String(Math.min(100000, s - 1000));
      var amt = Number(extra.value);
      if (voltar) voltar.hidden = saldo.value === saldo.defaultValue && extra.value === extra.defaultValue;
      var contrato = { financedAmount: s, annualRate: 10.49, termMonths: 240, system: 'SAC', firstDueMonth: inicio, trIndexed: true };
      var trFor = function () { return C.trFallbackAverage; };
      var prazo = C.simulateExtra(contrato, { trFor: trFor }, { amount: amt, startYm: inicio, frequency: 'once', mode: 'prazo' });
      var parcela = C.simulateExtra(contrato, { trFor: trFor }, { amount: amt, startYm: inicio, frequency: 'once', mode: 'parcela' });
      [saldo, extra].forEach(function (el) { el.style.setProperty('--fill', ((el.value - el.min) / (el.max - el.min) * 100) + '%'); });
      $('[data-out="saldo"]', sim).textContent = brl0.format(s);
      $('[data-out="extra"]', sim).textContent = brl0.format(amt);
      saldo.setAttribute('aria-valuetext', brl0.format(s));
      extra.setAttribute('aria-valuetext', brl0.format(amt));
      r('juros', brl.format(prazo.interestSaved));
      r('meses', duracao(prazo.monthsSaved));
      r('fim', mesAno(prazo.newEndYm));
      r('prazo-juros', brl0.format(prazo.interestSaved));
      r('prazo-sub', prazo.monthsSaved + (prazo.monthsSaved === 1 ? ' parcela' : ' parcelas') + ' a menos');
      r('parcela-juros', brl0.format(parcela.interestSaved));
      r('parcela-sub', 'parcela ' + brl0.format(parcela.paymentBefore - parcela.paymentAfter) + ' menor');
      // Uma janela acesa por ano a menos de parcelas; a água sobe junto
      var anos = Math.floor(prazo.monthsSaved / 12);
      janelas.forEach(function (w, k) { w.classList.toggle('lit', k < anos); });
      r('janelas', anos === 0 ? 'Amortize mais para acender a primeira.' : anos === 1 ? 'Agora: 1 acesa.' : 'Agora: ' + Math.min(anos, janelas.length) + ' acesas.');
      if (agua) {
        var nivel = 0.22 + 0.62 * Math.min(1, prazo.monthsSaved / (janelas.length * 12));
        agua.style.transform = 'translateY(' + (348 - 262 * nivel).toFixed(1) + 'px)';
      }
    };
    saldo.addEventListener('input', render);
    extra.addEventListener('input', render);
    if (voltar) voltar.addEventListener('click', function () {
      saldo.value = saldo.defaultValue;
      extra.value = extra.defaultValue;
      render();
      extra.focus();
    });
    render();
  }

  // ---------- Simulador de amortização (página simulador-de-amortizacao/) ----------
  // Três cenários lado a lado com o mesmo cálculo do app: sem amortizar, reduzindo o prazo e
  // reduzindo a parcela. Sem os seguros da parcela, o que depende deles leva o marcador ≈
  function parseBRL(s) {
    s = String(s || '').replace(/[^\d,.-]/g, '');
    if (s.indexOf(',') !== -1) s = s.replace(/\./g, '').replace(',', '.');
    else if (/\.\d{3}(\.|$)/.test(s)) s = s.replace(/\./g, '');
    var n = parseFloat(s);
    return isFinite(n) && n > 0 ? n : 0;
  }
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  var plain = new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  var amort = document.getElementById('amort');
  if (amort && C) {
    var campo = function (id) { return document.getElementById(id); };
    var escolha = function (name) { var el = $('input[name="' + name + '"]:checked', amort); return el ? el.value : ''; };
    var saida = function (k) { return $('[data-r="' + k + '"]', amort); };
    var custo = function (rows) { return rows.reduce(function (a, row) { return a + row.interest + row.fees; }, 0); };
    var abrirSeguros = function () {
      var det = saida('extra-box');
      det.open = true;
      campo('seguros').focus();
    };

    // Tabela das parcelas mês a mês do cenário escolhido (recolhida; as 24 primeiras e, se pedir, todas)
    var ultimo = null;
    var todas = false;
    var MES_CURTO = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
    var mesCurto = function (ym) { var p = ym.split('-'); return MES_CURTO[Number(p[1]) - 1] + '/' + p[0]; };
    var desenharParcelas = function () {
      var box = saida('parcelas-box');
      if (!box) return;
      box.hidden = !ultimo;
      if (!ultimo || !box.open) return;
      var qual = escolha('cenario') || 'prazo';
      var rows = qual === 'base' ? ultimo.prazo.base : ultimo[qual].simulated;
      var nome = qual === 'base' ? 'sem amortizar' : qual === 'prazo' ? 'reduzindo o prazo' : 'reduzindo a parcela';
      var limite = todas ? rows.length : Math.min(24, rows.length);
      var html = '';
      for (var k = 0; k < limite; k++) {
        var row = rows[k];
        html += '<tr' + (row.extra > 0 ? ' class="extra"' : '') + '><td class="hide-xs">' + row.index + '</td><td>' + mesCurto(row.yearMonth) + '</td>'
          + '<td class="r">' + plain.format(row.payment) + (row.extra > 0 ? '<small>+ ' + plain.format(row.extra) + ' amortizados</small>' : '') + '</td>'
          + '<td class="r hide-sm">' + plain.format(row.amortization) + '</td>'
          + '<td class="r hide-sm">' + plain.format(row.interest) + '</td>'
          + '<td class="r">' + plain.format(row.closingBalance) + '</td></tr>';
      }
      saida('parcelas-linhas').innerHTML = html;
      saida('parcelas-caption').textContent = 'Parcelas mês a mês, ' + nome;
      var primeira = rows[0], ultima = rows[rows.length - 1];
      saida('parcelas-resumo').innerHTML = esc(rows.length + (rows.length === 1 ? ' parcela' : ' parcelas') + ' ' + nome + ', de ' + mesCurto(primeira.yearMonth) + ' a ' + mesCurto(ultima.yearMonth) + '. ')
        + (ultimo.exato ? 'As parcelas incluem seguros e taxas.' : '<span class="aprox" title="Estimado: sem os seguros da parcela">≈</span> Sem os seguros, as parcelas mostram só amortização e juros.');
      var mais = saida('parcelas-mais');
      mais.hidden = rows.length <= 24;
      mais.textContent = todas ? 'Mostrar só as 24 primeiras' : 'Mostrar todas as ' + rows.length + ' parcelas';
    };

    var limpar = function (msg) {
      ultimo = null;
      desenharParcelas();
      saida('selo').className = 'selo';
      saida('selo').innerHTML = '';
      saida('veredito').textContent = msg;
      saida('cenarios').innerHTML = '';
      saida('nota').textContent = '';
    };

    var atualizar = function () {
      var saldo = parseBRL(campo('saldo').value);
      var meses = Math.round(parseBRL(campo('meses').value));
      var taxa = parseBRL(campo('taxa').value);
      var valor = parseBRL(campo('valor').value);
      var seguros = parseBRL(campo('seguros').value);
      var sistema = escolha('sistema') || 'SAC';
      var comTr = escolha('tr') !== 'nao';
      var freq = escolha('freq') || 'once';
      saida('tr').textContent = comTr
        ? trMedia.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + '% ao mês' + (trOrigem === 'banco-central' ? '' : ', cópia embutida')
        : 'sem TR neste contrato';

      if (!saldo || !meses || !taxa) return limpar('Preencha o saldo devedor, as parcelas que faltam e a taxa de juros.');
      if (meses > 600) return limpar('O prazo vai até 600 meses (50 anos).');
      if (taxa > 60) return limpar('Confira a taxa: ela é a efetiva ao ano, por exemplo 10,49.');
      if (!valor) return limpar('Informe quanto você quer amortizar.');

      var inicio = proximoMes();
      var exato = seguros > 0;
      var contrato = {
        financedAmount: saldo, annualRate: taxa, termMonths: meses, system: sistema,
        firstDueMonth: inicio, trIndexed: comTr,
        feesRef: exato ? { yearMonth: inicio, insurance: seguros, adminFee: 0 } : undefined
      };
      var opts = { trFor: function () { return trMedia; } };
      var prazo = C.simulateExtra(contrato, opts, { amount: valor, startYm: inicio, frequency: freq, mode: 'prazo' });
      var parcela = C.simulateExtra(contrato, opts, { amount: valor, startYm: inicio, frequency: freq, mode: 'parcela' });
      var base = prazo.base;
      var fimBase = base[base.length - 1].yearMonth;

      // Sem os seguros, a economia e a parcela são estimadas (≈); prazo e datas não dependem deles
      var marca = '<span class="aprox" title="Estimado: sem os seguros da parcela">≈</span> ';
      var ap = function (v) { return exato ? v : '<span class="nowrap">' + marca + v + '</span>'; };

      var selo = saida('selo');
      selo.className = 'selo ' + (exato ? 'ok' : 'est');
      selo.innerHTML = exato
        ? '<b>Com os seguros</b><span>' + esc(brl.format(seguros)) + ' por mês de seguros e taxas, corrigidos pela TR.</span><button type="button" data-r="abrir">Editar</button>'
        : '<b>Sem os seguros</b><span>A conta usa só os juros. Os valores com ≈ mudam com os seguros e taxas da parcela, e reduzindo o prazo a economia real fica um pouco maior.</span><button type="button" data-r="abrir">Informar os seguros</button>';
      saida('abrir').addEventListener('click', abrirSeguros);

      // Mensagem principal: a diferença entre os dois caminhos, em reais
      var quitaTudo = prazo.simulated.length <= 1 && freq === 'once';
      var vence = prazo.interestSaved >= parcela.interestSaved ? 'prazo' : 'parcela';
      var dif = Math.abs(prazo.interestSaved - parcela.interestSaved);
      var alivio = parcela.paymentBefore - parcela.paymentAfter;
      var msg;
      var nota;
      if (quitaTudo) {
        msg = 'Esse valor quita o financiamento: você deixa de pagar <span class="hl">' + ap(esc(brl.format(prazo.interestSaved))) + '</span> de juros e seguros.';
        nota = 'Para quitar, peça ao banco o valor de quitação do dia, que já desconta os juros futuros.';
      } else if (vence === 'prazo') {
        msg = 'Reduzindo o prazo, você deixa de pagar <span class="hl">' + ap(esc(brl.format(prazo.interestSaved))) + '</span>'
          + (dif >= 1 ? ', ' + ap(esc(brl.format(dif))) + ' a mais do que reduzindo a parcela' : ', o mesmo que reduzindo a parcela')
          + (prazo.monthsSaved > 0 ? ', e termina ' + esc(duracao(prazo.monthsSaved)) + ' antes.' : '.');
        nota = 'Reduzindo a parcela, ela cai ' + ap(esc(brl.format(alivio))) + ' por mês logo depois da amortização: menos economia, mais folga no orçamento.';
      } else {
        msg = 'Reduzindo a parcela, você deixa de pagar <span class="hl">' + ap(esc(brl.format(parcela.interestSaved))) + '</span>, '
          + ap(esc(brl.format(dif))) + ' a mais do que reduzindo o prazo.';
        nota = 'A parcela cai ' + ap(esc(brl.format(alivio))) + ' por mês logo depois da amortização.';
      }
      saida('veredito').innerHTML = msg + '<small>' + nota + '</small>';

      var item = function (rotulo, valorHtml, sub) {
        return '<dt>' + esc(rotulo) + '</dt><dd>' + valorHtml + (sub ? '<small>' + esc(sub) + '</small>' : '') + '</dd>';
      };
      var parcelas = function (n) { return n + (n === 1 ? ' parcela' : ' parcelas'); };
      var cartao = function (tipo, sim) {
        var melhor = tipo === vence && !quitaTudo;
        var rows = tipo === 'base' ? base : sim.simulated;
        var fim = rows.length ? rows[rows.length - 1].yearMonth : inicio;
        var titulo = tipo === 'base' ? 'Sem amortizar' : tipo === 'prazo' ? 'Reduzindo o prazo' : 'Reduzindo a parcela';
        var total = tipo === 'base'
          ? '<small>Juros e seguros até o fim</small><b>' + ap(esc(brl.format(custo(base)))) + '</b>'
          : '<small>Você deixa de pagar</small><b>' + ap(esc(brl.format(sim.interestSaved))) + '</b>';
        var proxima = tipo === 'base' ? prazo.paymentBefore : sim.paymentAfter;
        var mesesAntes = tipo === 'base' ? 0 : sim.monthsSaved;
        return '<article class="sc' + (melhor ? ' best' : tipo === 'base' ? ' base' : '') + '">'
          + (melhor ? '<span class="tag">economiza mais</span>' : '')
          + '<h3>' + titulo + '</h3>'
          + '<div class="sc-total">' + total + '</div>'
          + '<dl>'
          + (tipo === 'base' ? '' : item('Juros e seguros', ap(esc(brl.format(custo(rows)))), 'até a última parcela'))
          + (tipo === 'base' ? '' : item(freq === 'once' ? 'Amortizado' : 'Amortizado no total', esc(brl.format(sim.totalExtra)), freq === 'monthly' ? brl.format(valor) + ' por mês' : freq === 'yearly' ? brl.format(valor) + ' por ano' : ''))
          + item('Última parcela', esc(mesAno(fim)), mesesAntes > 0 ? duracao(mesesAntes) + ' antes' : tipo === 'base' ? 'como está hoje' : 'mesmo prazo')
          + item('Parcelas que faltam', esc(parcelas(rows.length)), '')
          + item('Parcela seguinte', ap(esc(brl.format(proxima))), tipo === 'base' ? (exato ? 'com seguros e taxas' : 'sem seguros e taxas') : 'era ' + brl.format(prazo.paymentBefore))
          + '</dl></article>';
      };
      saida('cenarios').innerHTML = cartao('base') + cartao('prazo', prazo) + cartao('parcela', parcela);
      ultimo = { prazo: prazo, parcela: parcela, exato: exato };
      desenharParcelas();
      saida('nota').textContent = sistema === 'SAC'
        ? 'No SAC, reduzindo o prazo, o banco corta o máximo de meses sem que a parcela nova passe da de antes, como a Caixa faz.'
        : 'Na Price, reduzindo o prazo, a parcela continua a mesma e o número de parcelas diminui.';
      if (fimBase && !quitaTudo && prazo.monthsSaved === 0 && vence === 'prazo') saida('nota').textContent += ' Com esse valor, ainda não dá para cortar uma parcela inteira.';
    };

    ['saldo', 'meses', 'taxa', 'valor', 'seguros'].forEach(function (id) {
      var el = campo(id);
      el.addEventListener('input', atualizar);
      el.addEventListener('blur', function () {
        var n = parseBRL(el.value);
        el.value = !n ? '' : id === 'meses' ? String(Math.round(n)) : plain.format(n);
      });
    });
    $$('input[type="radio"]', amort).forEach(function (el) {
      el.addEventListener('change', el.name === 'cenario' ? desenharParcelas : atualizar);
    });
    saida('parcelas-box').addEventListener('toggle', desenharParcelas);
    saida('parcelas-mais').addEventListener('click', function () { todas = !todas; desenharParcelas(); });
    aoMudarTr.push(atualizar);
    atualizar();
  }

  // ---------- Entrada suave das seções ----------
  var items = $$('.reveal');
  if ('IntersectionObserver' in window && !reduzMovimento) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (en.isIntersecting) { en.target.classList.add('in'); io.unobserve(en.target); }
      });
    }, { rootMargin: '0px 0px -8% 0px' });
    items.forEach(function (el) { io.observe(el); });
  } else {
    items.forEach(function (el) { el.classList.add('in'); });
  }
})();
