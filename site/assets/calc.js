// Cálculo do financiamento no site: as mesmas regras de src/lib/finance.ts do app (tabela SAC ou
// Price com TR, centavos como o banco, amortização extra reduzindo prazo ou parcela e seguros).
// Conferido contra as funções do app em scripts/site/calc.test.ts. Funciona no navegador
// (window.AteQuitarCalc) e no Node (module.exports), sem dependências.
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.AteQuitarCalc = api;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var EPS = 0.005;
  var cents = function (v) { return Math.round(v * 100) / 100; };

  function addMonths(ym, delta) {
    var p = ym.split('-').map(Number);
    var total = p[0] * 12 + (p[1] - 1) + delta;
    return Math.floor(total / 12) + '-' + String((total % 12) + 1).padStart(2, '0');
  }

  // Taxa do mês a partir da efetiva anual com 4 casas, como sai no contrato (% a.m.)
  function contractMonthlyRate(annualPct) {
    var a = Math.round(annualPct * 10000) / 10000;
    return (Math.pow(1 + a / 100, 1 / 12) - 1) * 100;
  }

  function monthsToPayOff(system, balance, i, reference) {
    if (balance <= EPS) return 0;
    if (system === 'SAC' || i === 0) return Math.ceil(balance / reference - 1e-9);
    var x = 1 - (balance * i) / reference;
    if (x <= 0) return Infinity;
    return Math.ceil(-Math.log(x) / Math.log(1 + i) - 1e-9);
  }

  // Seguros e taxa de cada mês a partir da fatura de referência (a primeira vale para trás).
  // MIP sobre o saldo logo depois da parcela, DFI corrigido pela TR; só o total segue a TR inteiro
  function applyFees(rows, ref) {
    if (!rows.length || !ref) return;
    var cum = [];
    rows.forEach(function (r, k) {
      cum.push((k > 0 ? cum[k - 1] : 1) * (r.openingBalance > 0 ? 1 + r.correction / r.openingBalance : 1));
    });
    var base = rows.map(function (r) { return r.closingBalance + r.extra; });
    var j = 0;
    for (var n = 0; n < rows.length; n++) if (rows[n].yearMonth === ref.yearMonth) { j = n; break; }
    var detailed = ref.mip !== undefined && ref.dfi !== undefined;
    rows.forEach(function (r, k) {
      var exact = ref.yearMonth === r.yearMonth;
      var tr = cum[k] / cum[j];
      var insurance;
      if (detailed) {
        var mip = exact ? ref.mip : cents(base[j] > 0 ? (ref.mip * base[k]) / base[j] : ref.mip);
        var dfi = exact ? ref.dfi : cents(ref.dfi * tr);
        insurance = cents(mip + dfi);
      } else {
        insurance = exact ? ref.insurance : cents(ref.insurance * tr);
      }
      r.insurance = insurance;
      r.fees = cents(insurance + (ref.adminFee || 0));
      r.payment = r.amortization + r.interest + r.fees;
    });
  }

  // contract: { financedAmount, annualRate (% a.a. efetiva), termMonths, system ('SAC' | 'PRICE'),
  //   firstDueMonth ('AAAA-MM'), trIndexed, feesRef? { yearMonth, insurance, mip?, dfi?, adminFee } }
  // opts: { extras?: [{ yearMonth, amount, mode ('prazo' | 'parcela') }], trFor?: (ym) => % a.m. }
  function buildSchedule(contract, opts) {
    opts = opts || {};
    var i = contractMonthlyRate(contract.annualRate) / 100;
    var extrasByMonth = {};
    (opts.extras || []).forEach(function (e) {
      if (!(e.amount > 0)) return;
      (extrasByMonth[e.yearMonth] = extrasByMonth[e.yearMonth] || []).push(e);
    });
    var rows = [];
    var balance = contract.financedAmount;
    var remaining = Math.max(1, Math.round(contract.termMonths));
    var guard = remaining * 2 + 24;

    for (var k = 0; balance > EPS && remaining > 0 && k < guard; k++) {
      var ym = addMonths(contract.firstDueMonth, k);
      var opening = balance;
      var tr = contract.trIndexed && opts.trFor ? Math.max(0, opts.trFor(ym)) / 100 : 0;
      var correction = cents(balance * tr);
      balance += correction;
      var interest = cents(balance * i);

      var amortization;
      if (remaining <= 1) amortization = balance;
      else if (contract.system === 'SAC') amortization = Math.floor((balance / remaining) * 100 + 1e-6) / 100;
      else {
        var pmt = i === 0 ? balance / remaining : (balance * i) / (1 - Math.pow(1 + i, -remaining));
        amortization = pmt - interest;
      }
      amortization = Math.min(amortization, balance);
      balance -= amortization;
      remaining -= 1;

      var extra = 0;
      var mode = null;
      var beforeExtras = null;
      (extrasByMonth[ym] || []).forEach(function (e) {
        if (beforeExtras === null) beforeExtras = balance;
        var applied = Math.min(e.amount, balance);
        extra += applied;
        balance -= applied;
        if (applied > 0 && (mode === null || e.mode === 'prazo')) mode = e.mode;
      });

      if (balance <= EPS) {
        balance = 0;
      } else if (mode === 'prazo' && remaining > 0) {
        if (contract.system === 'SAC' && beforeExtras !== null) {
          // Como a Caixa: corta o máximo de meses sem a prestação nova passar da de antes
          var before = beforeExtras;
          var payment = function (b, n) { return Math.floor((b / n) * 100 + 1e-6) / 100 + cents(b * i); };
          var limit = payment(before, remaining);
          var n = remaining;
          while (n > 1 && payment(balance, n - 1) <= limit + 1e-9) n--;
          remaining = n;
        } else {
          var reference = contract.system === 'SAC' ? amortization : amortization + interest;
          remaining = Math.min(remaining, monthsToPayOff(contract.system, balance, i, reference));
          if (remaining === 0) remaining = 1;
        }
      }

      rows.push({
        index: k + 1, yearMonth: ym, openingBalance: opening, correction: correction,
        interest: interest, amortization: amortization, fees: 0, insurance: 0,
        payment: amortization + interest, extra: extra, closingBalance: balance
      });
    }
    applyFees(rows, contract.feesRef);
    return rows;
  }

  function planToExtras(plan, untilYm) {
    if (!(plan.amount > 0)) return [];
    if (plan.frequency === 'once') return [{ yearMonth: plan.startYm, amount: plan.amount, mode: plan.mode }];
    var step = plan.frequency === 'monthly' ? 1 : 12;
    var out = [];
    for (var k = 0, ym = plan.startYm; ym <= untilYm; k++, ym = addMonths(plan.startYm, k * step)) {
      out.push({ yearMonth: ym, amount: plan.amount, mode: plan.mode });
    }
    return out;
  }

  // Mesmo resultado de simulateExtra do app: juros e seguros que somem, meses a menos e a parcela
  // logo depois da primeira amortização, com e sem ela
  function simulateExtra(contract, opts, plan) {
    opts = opts || {};
    var base = buildSchedule(contract, opts);
    var lastYm = base.length ? base[base.length - 1].yearMonth : plan.startYm;
    var planned = planToExtras(plan, lastYm);
    var simulated = buildSchedule(contract, { trFor: opts.trFor, extras: (opts.extras || []).concat(planned) });
    var cost = function (rows) { return rows.reduce(function (a, r) { return a + r.interest + r.fees; }, 0); };
    var interestOnly = function (rows) { return rows.reduce(function (a, r) { return a + r.interest; }, 0); };
    var afterYm = addMonths(plan.startYm, 1);
    var at = function (rows) {
      for (var n = 0; n < rows.length; n++) if (rows[n].yearMonth >= afterYm) return rows[n].payment;
      return 0;
    };
    var extras = function (rows) { return rows.reduce(function (a, r) { return a + r.extra; }, 0); };
    return {
      base: base,
      simulated: simulated,
      interestSaved: cost(base) - cost(simulated),
      onlyInterestSaved: interestOnly(base) - interestOnly(simulated),
      monthsSaved: base.length - simulated.length,
      totalExtra: extras(simulated) - extras(base),
      newEndYm: simulated.length ? simulated[simulated.length - 1].yearMonth : lastYm,
      paymentBefore: at(base),
      paymentAfter: at(simulated)
    };
  }

  // TR média dos últimos 12 meses (série 7811 do Banco Central, % a.m.), de nov/2025 a out/2026.
  // O site busca a série atualizada no Banco Central; esta é a cópia embutida para quando falhar
  var TR_FALLBACK = { from: '2025-11', to: '2026-10', values: [0.1634, 0.1742, 0.1718, 0.1207, 0.1735, 0.1679, 0.1687, 0.1709, 0.1729, 0.1693, 0.169, 0.1616] };
  var average = function (list) { return list.reduce(function (a, v) { return a + v; }, 0) / list.length; };

  return {
    addMonths: addMonths,
    contractMonthlyRate: contractMonthlyRate,
    buildSchedule: buildSchedule,
    simulateExtra: simulateExtra,
    TR_FALLBACK: TR_FALLBACK,
    trFallbackAverage: average(TR_FALLBACK.values),
    average: average
  };
});
