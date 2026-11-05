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
      a.textContent = 'Simular';
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

  // ---------- Simulador do topo: a casa que se enche ----------
  // Contrato de exemplo: 10,49% ao ano + TR, SAC, 20 anos restantes. Amortização reduzindo o prazo
  // comparada com reduzir a parcela, com as mesmas contas do app (assets/calc.js)
  var sim = document.getElementById('sim');
  if (sim && C) {
    var saldo = $('[data-in="saldo"]', sim);
    var extra = $('[data-in="extra"]', sim);
    var agua = $('[data-water]');
    var janelas = $$('[data-win]').sort(function (a, b) { return Number(a.getAttribute('data-win')) - Number(b.getAttribute('data-win')); });
    var r = function (k, v) { setText('[data-r="' + k + '"]', v, sim); };
    var render = function () {
      var inicio = proximoMes();
      var s = Number(saldo.value);
      var amt = Math.min(Number(extra.value), s - 1000);
      var contrato = { financedAmount: s, annualRate: 10.49, termMonths: 240, system: 'SAC', firstDueMonth: inicio, trIndexed: true };
      var trFor = function () { return trMedia; };
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
      r('tr', (trMedia).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + '% ao mês' + (trOrigem === 'banco-central' ? '' : ' (cópia embutida)'));
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
    aoMudarTr.push(render);
    render();
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
