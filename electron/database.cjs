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
    cet REAL NOT NULL DEFAULT 0,
    term_months INTEGER NOT NULL CHECK (term_months > 0),
    system TEXT NOT NULL CHECK (system IN ('SAC', 'PRICE')),
    first_due_month TEXT NOT NULL,
    due_day INTEGER NOT NULL CHECK (due_day BETWEEN 1 AND 31),
    tr_indexed INTEGER NOT NULL CHECK (tr_indexed IN (0, 1)),
    monthly_insurance REAL NOT NULL DEFAULT 0,
    monthly_admin_fee REAL NOT NULL DEFAULT 0,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

  -- Parcela registrada no check-in do mês (uma por mês)
  CREATE TABLE IF NOT EXISTS checkins (
    id TEXT PRIMARY KEY,
    year_month TEXT NOT NULL UNIQUE,
    paid_amount REAL NOT NULL CHECK (paid_amount >= 0),
    balance_after REAL CHECK (balance_after IS NULL OR balance_after > 0),
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS extra_payments (
    id TEXT PRIMARY KEY,
    year_month TEXT NOT NULL,
    amount REAL NOT NULL CHECK (amount > 0),
    mode TEXT NOT NULL CHECK (mode IN ('prazo', 'parcela')),
    source TEXT NOT NULL CHECK (source IN ('proprio', 'fgts', 'decimo')),
    note TEXT
  );
  CREATE INDEX IF NOT EXISTS idx_extra_payments_month ON extra_payments (year_month);

  -- Saldo devedor real informado (app do banco ou extrato do IR)
  CREATE TABLE IF NOT EXISTS balance_checkpoints (
    id TEXT PRIMARY KEY,
    year_month TEXT NOT NULL,
    balance REAL NOT NULL CHECK (balance >= 0),
    source TEXT NOT NULL CHECK (source IN ('banco', 'ir')),
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
`;

// Colunas acrescentadas depois da primeira versão: entram nos bancos já existentes sem recriar a tabela
const ADDED_COLUMNS = [
  { table: 'contract', name: 'bank_preposition', ddl: "TEXT CHECK (bank_preposition IS NULL OR bank_preposition IN ('no', 'na'))" },
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
    db.exec('DELETE FROM contract; DELETE FROM checkins; DELETE FROM extra_payments; DELETE FROM balance_checkpoints; DELETE FROM milestones; DELETE FROM rate_latest; DELETE FROM rate_points; DELETE FROM tr_monthly;');
    if (rows.contract) {
      db.prepare(`
        INSERT INTO contract (
          id, nickname, bank, bank_preposition, property_value, financed_amount, annual_rate, cet, term_months, system,
          first_due_month, due_day, tr_indexed, monthly_insurance, monthly_admin_fee, updated_at
        ) VALUES (
          1, @nickname, @bank, @bank_preposition, @property_value, @financed_amount, @annual_rate, @cet, @term_months, @system,
          @first_due_month, @due_day, @tr_indexed, @monthly_insurance, @monthly_admin_fee, CURRENT_TIMESTAMP
        )
      `).run(rows.contract);
    }
    const ins = (sql, list) => {
      const stmt = db.prepare(sql);
      for (const r of list) stmt.run(r);
    };
    ins('INSERT INTO checkins (id, year_month, paid_amount, balance_after, created_at) VALUES (@id, @year_month, @paid_amount, @balance_after, @created_at)', rows.checkins);
    ins('INSERT OR REPLACE INTO extra_payments (id, year_month, amount, mode, source, note) VALUES (@id, @year_month, @amount, @mode, @source, @note)', rows.extras);
    ins('INSERT INTO balance_checkpoints (id, year_month, balance, source) VALUES (@id, @year_month, @balance, @source)', rows.checkpoints);
    ins('INSERT INTO milestones (percent) VALUES (@percent)', rows.milestones.map((percent) => ({ percent })));
    ins('INSERT INTO rate_latest (series, date, value) VALUES (@series, @date, @value)', rows.rateLatest);
    ins('INSERT OR REPLACE INTO rate_points (series, date, value) VALUES (@series, @date, @value)', rows.ratePoints);
    ins('INSERT INTO tr_monthly (year_month, value) VALUES (@year_month, @value)', rows.trMonthly);
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
