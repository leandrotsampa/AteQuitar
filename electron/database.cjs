/**
 * Banco SQLite do app: esquema, leitura e gravação do documento inteiro numa transação,
 * e importação do arquivo JSON das primeiras versões.
 */

const fs = require('fs');
const { docToRows, rowsToDoc } = require('./dataMapping.cjs');

const SCHEMA_VERSION = 1;

const SCHEMA = `
  CREATE TABLE IF NOT EXISTS app_meta (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS contract (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    nickname TEXT NOT NULL,
    bank TEXT NOT NULL DEFAULT '',
    bank_preposition TEXT CHECK (bank_preposition IS NULL OR bank_preposition IN ('no', 'na')),
    property_value REAL NOT NULL DEFAULT 0,
    financed_amount REAL NOT NULL CHECK (financed_amount > 0),
    annual_rate REAL NOT NULL CHECK (annual_rate > 0),
    rate_input TEXT CHECK (rate_input IS NULL OR rate_input IN ('efetiva', 'nominal', 'mes')),
    cet REAL NOT NULL DEFAULT 0,
    term_months INTEGER NOT NULL CHECK (term_months > 0),
    system TEXT NOT NULL CHECK (system IN ('SAC', 'PRICE')),
    first_due_month TEXT NOT NULL,
    due_day INTEGER NOT NULL CHECK (due_day BETWEEN 1 AND 31),
    tr_indexed INTEGER NOT NULL CHECK (tr_indexed IN (0, 1)),
    monthly_insurance REAL NOT NULL DEFAULT 0,
    monthly_admin_fee REAL NOT NULL DEFAULT 0,
    -- Seguros e taxa da última fatura informada no cadastro
    fees_ref_month TEXT,
    fees_ref_insurance REAL,
    fees_ref_mip REAL,
    fees_ref_dfi REAL,
    fees_ref_admin_fee REAL,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

  -- Parcela registrada no check-in do mês (uma por mês)
  CREATE TABLE IF NOT EXISTS checkins (
    id TEXT PRIMARY KEY,
    year_month TEXT NOT NULL UNIQUE,
    paid_amount REAL NOT NULL CHECK (paid_amount >= 0),
    balance_after REAL CHECK (balance_after IS NULL OR balance_after > 0),
    extra_id TEXT,
    -- Seguros e taxa da fatura do mês (MIP e DFI só quando a fatura separa)
    insurance REAL,
    mip REAL,
    dfi REAL,
    admin_fee REAL,
    -- Linhas da fatura: amortização, juros, atraso e FGTS na prestação
    amortization REAL,
    interest REAL,
    charges REAL,
    fgts REAL,
    -- Ajuste de centavos do banco, com sinal (negativo = desconto)
    adjustment REAL,
    -- Adiantada só agendada no débito: conta como paga no vencimento
    scheduled INTEGER NOT NULL DEFAULT 0,
    -- De onde veio balance_after: 'fatura' (calculado pelos juros) ou 'banco'
    balance_source TEXT CHECK (balance_source IS NULL OR balance_source IN ('fatura', 'banco')),
    -- Parcelas que faltam depois desta, calculadas pela fatura
    remaining_after INTEGER,
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS extra_payments (
    id TEXT PRIMARY KEY,
    year_month TEXT NOT NULL,
    amount REAL NOT NULL CHECK (amount > 0),
    mode TEXT NOT NULL CHECK (mode IN ('prazo', 'parcela')),
    source TEXT NOT NULL CHECK (source IN ('proprio', 'fgts', 'decimo')),
    note TEXT,
    -- Valor pago (com os juros pro rata) e a data; amount é a amortização efetiva
    paid REAL,
    paid_date TEXT,
    created_at TEXT
  );
  CREATE INDEX IF NOT EXISTS idx_extra_payments_month ON extra_payments (year_month);

  -- Saldo devedor real informado no app do banco ('ir' só nos bancos das versões antigas)
  CREATE TABLE IF NOT EXISTS balance_checkpoints (
    id TEXT PRIMARY KEY,
    year_month TEXT NOT NULL,
    balance REAL NOT NULL CHECK (balance >= 0),
    -- Parcelas que faltam depois deste mês, segundo o banco (opcional)
    remaining INTEGER,
    source TEXT NOT NULL CHECK (source IN ('banco', 'ir')),
    created_at TEXT,
    UNIQUE (year_month, source)
  );

  -- Marcos de 10 em 10% já comemorados
  CREATE TABLE IF NOT EXISTS milestones (
    percent INTEGER PRIMARY KEY CHECK (percent BETWEEN 0 AND 100)
  );

  -- Taxas do Banco Central: último valor de cada série, histórico curto e TR mês a mês
  CREATE TABLE IF NOT EXISTS rate_latest (
    series TEXT PRIMARY KEY,
    date TEXT NOT NULL,
    value REAL NOT NULL
  );
  CREATE TABLE IF NOT EXISTS rate_points (
    series TEXT NOT NULL,
    date TEXT NOT NULL,
    value REAL NOT NULL,
    PRIMARY KEY (series, date)
  );
  CREATE TABLE IF NOT EXISTS tr_monthly (
    year_month TEXT PRIMARY KEY,
    value REAL NOT NULL
  );
  -- TR aplicada em cada parcela: período que termina no dia do vencimento (dia em app_meta)
  CREATE TABLE IF NOT EXISTS tr_due (
    year_month TEXT PRIMARY KEY,
    value REAL NOT NULL
  );
`;

// Colunas acrescentadas depois da primeira versão: entram nos bancos já existentes sem recriar a tabela
const ADDED_COLUMNS = [
  { table: 'contract', name: 'bank_preposition', ddl: "TEXT CHECK (bank_preposition IS NULL OR bank_preposition IN ('no', 'na'))" },
  { table: 'checkins', name: 'extra_id', ddl: 'TEXT' },
  { table: 'contract', name: 'rate_input', ddl: "TEXT CHECK (rate_input IS NULL OR rate_input IN ('efetiva', 'nominal', 'mes'))" },
  { table: 'extra_payments', name: 'created_at', ddl: 'TEXT' },
  { table: 'balance_checkpoints', name: 'created_at', ddl: 'TEXT' },
  { table: 'contract', name: 'fees_ref_month', ddl: 'TEXT' },
  { table: 'contract', name: 'fees_ref_insurance', ddl: 'REAL' },
  { table: 'contract', name: 'fees_ref_mip', ddl: 'REAL' },
  { table: 'contract', name: 'fees_ref_dfi', ddl: 'REAL' },
  { table: 'contract', name: 'fees_ref_admin_fee', ddl: 'REAL' },
  { table: 'checkins', name: 'insurance', ddl: 'REAL' },
  { table: 'checkins', name: 'mip', ddl: 'REAL' },
  { table: 'checkins', name: 'dfi', ddl: 'REAL' },
  { table: 'checkins', name: 'admin_fee', ddl: 'REAL' },
  { table: 'checkins', name: 'amortization', ddl: 'REAL' },
  { table: 'checkins', name: 'interest', ddl: 'REAL' },
  { table: 'checkins', name: 'charges', ddl: 'REAL' },
  { table: 'checkins', name: 'fgts', ddl: 'REAL' },
  { table: 'checkins', name: 'adjustment', ddl: 'REAL' },
  { table: 'checkins', name: 'scheduled', ddl: 'INTEGER NOT NULL DEFAULT 0' },
  { table: 'checkins', name: 'balance_source', ddl: "TEXT CHECK (balance_source IS NULL OR balance_source IN ('fatura', 'banco'))" },
  { table: 'extra_payments', name: 'paid', ddl: 'REAL' },
  { table: 'extra_payments', name: 'paid_date', ddl: 'TEXT' },
  { table: 'checkins', name: 'remaining_after', ddl: 'INTEGER' },
  { table: 'balance_checkpoints', name: 'remaining', ddl: 'INTEGER' },
];

function ensureColumns(db) {
  for (const col of ADDED_COLUMNS) {
    const existing = new Set(db.prepare(`PRAGMA table_info(${col.table})`).all().map((c) => c.name));
    if (!existing.has(col.name)) db.exec(`ALTER TABLE ${col.table} ADD COLUMN ${col.name} ${col.ddl}`);
  }
}

function openDatabase(Database, file, options = {}) {
  const db = new Database(file, options);
  if (!options.readonly) {
    db.pragma('journal_mode = WAL');
    db.exec(SCHEMA);
    ensureColumns(db);
    db.prepare('INSERT OR IGNORE INTO app_meta (key, value) VALUES (?, ?)').run('schema_version', String(SCHEMA_VERSION));
  }
  return db;
}

function readRows(db) {
  const meta = {};
  for (const r of db.prepare('SELECT key, value FROM app_meta').all()) meta[r.key] = r.value;
  return {
    contract: db.prepare('SELECT * FROM contract WHERE id = 1').get() || null,
    checkins: db.prepare('SELECT * FROM checkins ORDER BY year_month').all(),
    extras: db.prepare('SELECT * FROM extra_payments ORDER BY year_month, id').all(),
    checkpoints: db.prepare('SELECT * FROM balance_checkpoints ORDER BY year_month').all(),
    milestones: db.prepare('SELECT percent FROM milestones').all(),
    rateLatest: db.prepare('SELECT * FROM rate_latest').all(),
    ratePoints: db.prepare('SELECT * FROM rate_points').all(),
    trMonthly: db.prepare('SELECT * FROM tr_monthly').all(),
    trDue: db.prepare('SELECT * FROM tr_due').all(),
    meta,
  };
}

// Banco sem nenhum dado gravado ainda (primeira abertura)
function isEmpty(db) {
  return !db.prepare("SELECT 1 FROM app_meta WHERE key = 'created_at'").get();
}

function readDoc(db) {
  if (isEmpty(db)) return null;
  return rowsToDoc(readRows(db));
}

// Troca tudo de uma vez: ou grava o documento inteiro, ou nada muda
function writeDoc(db, doc) {
  const rows = docToRows(doc);
  const tx = db.transaction(() => {
    db.exec('DELETE FROM contract; DELETE FROM checkins; DELETE FROM extra_payments; DELETE FROM balance_checkpoints; DELETE FROM milestones; DELETE FROM rate_latest; DELETE FROM rate_points; DELETE FROM tr_monthly; DELETE FROM tr_due;');
    if (rows.contract) {
      db.prepare(`
        INSERT INTO contract (
          id, nickname, bank, bank_preposition, property_value, financed_amount, annual_rate, rate_input, cet, term_months, system,
          first_due_month, due_day, tr_indexed, monthly_insurance, monthly_admin_fee,
          fees_ref_month, fees_ref_insurance, fees_ref_mip, fees_ref_dfi, fees_ref_admin_fee, updated_at
        ) VALUES (
          1, @nickname, @bank, @bank_preposition, @property_value, @financed_amount, @annual_rate, @rate_input, @cet, @term_months, @system,
          @first_due_month, @due_day, @tr_indexed, @monthly_insurance, @monthly_admin_fee,
          @fees_ref_month, @fees_ref_insurance, @fees_ref_mip, @fees_ref_dfi, @fees_ref_admin_fee, CURRENT_TIMESTAMP
        )
      `).run(rows.contract);
    }
    const ins = (sql, list) => {
      const stmt = db.prepare(sql);
      for (const r of list) stmt.run(r);
    };
    ins('INSERT INTO checkins (id, year_month, paid_amount, balance_after, extra_id, insurance, mip, dfi, admin_fee, amortization, interest, charges, fgts, adjustment, scheduled, balance_source, remaining_after, created_at) VALUES (@id, @year_month, @paid_amount, @balance_after, @extra_id, @insurance, @mip, @dfi, @admin_fee, @amortization, @interest, @charges, @fgts, @adjustment, @scheduled, @balance_source, @remaining_after, @created_at)', rows.checkins);
    ins('INSERT OR REPLACE INTO extra_payments (id, year_month, amount, mode, source, note, paid, paid_date, created_at) VALUES (@id, @year_month, @amount, @mode, @source, @note, @paid, @paid_date, @created_at)', rows.extras);
    ins('INSERT INTO balance_checkpoints (id, year_month, balance, remaining, source, created_at) VALUES (@id, @year_month, @balance, @remaining, @source, @created_at)', rows.checkpoints);
    ins('INSERT INTO milestones (percent) VALUES (@percent)', rows.milestones.map((percent) => ({ percent })));
    ins('INSERT INTO rate_latest (series, date, value) VALUES (@series, @date, @value)', rows.rateLatest);
    ins('INSERT OR REPLACE INTO rate_points (series, date, value) VALUES (@series, @date, @value)', rows.ratePoints);
    ins('INSERT INTO tr_monthly (year_month, value) VALUES (@year_month, @value)', rows.trMonthly);
    ins('INSERT INTO tr_due (year_month, value) VALUES (@year_month, @value)', rows.trDue);
    const meta = db.prepare('INSERT OR REPLACE INTO app_meta (key, value) VALUES (?, ?)');
    for (const [k, v] of Object.entries(rows.meta)) meta.run(k, v);
  });
  tx();
  return true;
}

// Primeira abertura depois de atualizar: traz os dados do arquivo JSON das versões anteriores
function importLegacyJson(db, jsonPath) {
  if (!fs.existsSync(jsonPath) || !isEmpty(db)) return false;
  try {
    const doc = JSON.parse(fs.readFileSync(jsonPath, 'utf-8'));
    writeDoc(db, doc);
    fs.renameSync(jsonPath, `${jsonPath}.importado`);
    return true;
  } catch (err) {
    console.error('[Até Quitar] Não foi possível importar o arquivo JSON antigo.', err);
    return false;
  }
}

module.exports = { openDatabase, readDoc, writeDoc, importLegacyJson };
