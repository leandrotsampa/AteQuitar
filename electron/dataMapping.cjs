/**
 * Conversão entre o documento que a interface usa (um objeto com contrato, registros e taxas)
 * e as linhas das tabelas do SQLite. Funções puras, testadas em dataMapping.test.ts.
 */

const num = (v, fallback = 0) => (typeof v === 'number' && Number.isFinite(v) ? v : fallback);
const str = (v, fallback = '') => (typeof v === 'string' ? v : fallback);
const ym = (v) => (typeof v === 'string' && /^\d{4}-\d{2}$/.test(v) ? v : null);
const list = (v) => (Array.isArray(v) ? v : []);

const SYSTEMS = ['SAC', 'PRICE'];
const MODES = ['prazo', 'parcela'];
const EXTRA_SOURCES = ['proprio', 'fgts', 'decimo'];
const BALANCE_SOURCES = ['banco', 'ir'];

function contractToRow(c) {
  if (!c || typeof c !== 'object') return null;
  const first = ym(c.firstDueMonth);
  if (!(num(c.financedAmount) > 0) || !(num(c.annualRate) > 0) || !(num(c.termMonths) > 0) || !first) return null;
  return {
    nickname: str(c.nickname, 'Minha casa') || 'Minha casa',
    bank: str(c.bank),
    bank_preposition: c.bankPreposition === 'no' || c.bankPreposition === 'na' ? c.bankPreposition : null,
    property_value: num(c.propertyValue),
    financed_amount: num(c.financedAmount),
    annual_rate: num(c.annualRate),
    cet: num(c.cet),
    term_months: Math.round(num(c.termMonths)),
    system: SYSTEMS.includes(c.system) ? c.system : 'SAC',
    first_due_month: first,
    due_day: Math.min(31, Math.max(1, Math.round(num(c.dueDay, 10)))),
    tr_indexed: c.trIndexed === false ? 0 : 1,
    monthly_insurance: num(c.monthlyInsurance),
    monthly_admin_fee: num(c.monthlyAdminFee),
  };
}

function rowToContract(r) {
  if (!r) return null;
  return {
    nickname: r.nickname,
    bank: r.bank,
    ...(r.bank_preposition ? { bankPreposition: r.bank_preposition } : {}),
    propertyValue: r.property_value,
    financedAmount: r.financed_amount,
    annualRate: r.annual_rate,
    cet: r.cet,
    termMonths: r.term_months,
    system: r.system,
    firstDueMonth: r.first_due_month,
    dueDay: r.due_day,
    trIndexed: Boolean(r.tr_indexed),
    monthlyInsurance: r.monthly_insurance,
    monthlyAdminFee: r.monthly_admin_fee,
  };
}

// Documento → linhas de cada tabela (o que não tiver o formato certo fica de fora)
function docToRows(doc) {
  const d = doc && typeof doc === 'object' ? doc : {};

  const checkins = [];
  const seenCheckin = new Set();
  for (const c of list(d.checkins)) {
    const month = ym(c && c.yearMonth);
    if (!month || seenCheckin.has(month) || !(num(c.paidAmount) >= 0)) continue;
    seenCheckin.add(month);
    checkins.push({
      id: str(c.id) || `ci-${month}`,
      year_month: month,
      paid_amount: num(c.paidAmount),
      balance_after: num(c.balanceAfter) > 0 ? num(c.balanceAfter) : null,
      created_at: str(c.createdAt) || new Date().toISOString(),
    });
  }

  const extras = list(d.extras)
    .filter((e) => e && ym(e.yearMonth) && num(e.amount) > 0)
    .map((e, k) => ({
      id: str(e.id) || `ex-${k}`,
      year_month: e.yearMonth,
      amount: num(e.amount),
      mode: MODES.includes(e.mode) ? e.mode : 'prazo',
      source: EXTRA_SOURCES.includes(e.source) ? e.source : 'proprio',
      note: typeof e.note === 'string' && e.note ? e.note : null,
    }));

  const checkpoints = [];
  const seenCheckpoint = new Set();
  for (const c of list(d.checkpoints)) {
    const month = ym(c && c.yearMonth);
    const source = c && BALANCE_SOURCES.includes(c.source) ? c.source : 'banco';
    if (!month || !(num(c.balance, -1) >= 0) || seenCheckpoint.has(`${month}|${source}`)) continue;
    seenCheckpoint.add(`${month}|${source}`);
    checkpoints.push({ id: str(c.id) || `cp-${month}-${source}`, year_month: month, balance: num(c.balance), source });
  }

  const milestones = [...new Set(list(d.celebrated).filter((m) => Number.isInteger(m) && m >= 0 && m <= 100))];

  const rates = d.rates && typeof d.rates === 'object' ? d.rates : {};
  const rateLatest = Object.entries(rates.latest && typeof rates.latest === 'object' ? rates.latest : {})
    .filter(([, p]) => p && typeof p.date === 'string' && Number.isFinite(p.value))
    .map(([series, p]) => ({ series, date: p.date, value: p.value }));
  const ratePoints = [];
  for (const [series, points] of Object.entries(rates.history && typeof rates.history === 'object' ? rates.history : {})) {
    for (const p of list(points)) {
      if (p && typeof p.date === 'string' && Number.isFinite(p.value)) ratePoints.push({ series, date: p.date, value: p.value });
    }
  }
  const trMonthly = Object.entries(rates.trByMonth && typeof rates.trByMonth === 'object' ? rates.trByMonth : {})
    .filter(([month, v]) => ym(month) && Number.isFinite(v))
    .map(([month, value]) => ({ year_month: month, value }));

  const meta = {
    is_demo: d.isDemo ? '1' : '0',
    created_at: str(d.createdAt) || new Date().toISOString(),
    rates_fetched_at: typeof rates.fetchedAt === 'string' ? rates.fetchedAt : '',
  };

  return { contract: contractToRow(d.contract), checkins, extras, checkpoints, milestones, rateLatest, ratePoints, trMonthly, meta };
}

// Linhas das tabelas → documento da interface
function rowsToDoc(rows) {
  const latest = {};
  for (const r of rows.rateLatest) latest[r.series] = { date: r.date, value: r.value };
  const history = {};
  for (const r of [...rows.ratePoints].sort((a, b) => a.date.localeCompare(b.date))) {
    (history[r.series] = history[r.series] || []).push({ date: r.date, value: r.value });
  }
  const trByMonth = {};
  for (const r of rows.trMonthly) trByMonth[r.year_month] = r.value;
  const meta = rows.meta || {};
  return {
    version: 1,
    contract: rowToContract(rows.contract),
    checkins: rows.checkins.map((c) => ({
      id: c.id,
      yearMonth: c.year_month,
      paidAmount: c.paid_amount,
      ...(c.balance_after != null ? { balanceAfter: c.balance_after } : {}),
      createdAt: c.created_at,
    })),
    extras: rows.extras.map((e) => ({
      id: e.id,
      yearMonth: e.year_month,
      amount: e.amount,
      mode: e.mode,
      source: e.source,
      ...(e.note ? { note: e.note } : {}),
    })),
    checkpoints: rows.checkpoints.map((c) => ({ id: c.id, yearMonth: c.year_month, balance: c.balance, source: c.source })),
    // Sem taxas guardadas, a interface usa os valores de referência
    rates: rows.rateLatest.length > 0 ? { fetchedAt: meta.rates_fetched_at || null, latest, history, trByMonth } : undefined,
    celebrated: rows.milestones.map((m) => m.percent).sort((a, b) => a - b),
    isDemo: meta.is_demo === '1',
    createdAt: meta.created_at || new Date().toISOString(),
  };
}

module.exports = { docToRows, rowsToDoc };
