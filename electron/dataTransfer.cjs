/**
 * Exportar e importar os dados em JSON. Funções puras, testadas em dataTransfer.test.ts.
 *
 * O arquivo leva só o que é da pessoa (contrato e registros); as taxas do mercado ficam de fora
 * porque o app as busca de novo no Banco Central.
 */

const FORMAT = 'ate-quitar';
const FORMAT_VERSION = 1;

function exportDocument(doc, now = new Date()) {
  return {
    formato: FORMAT,
    versao: FORMAT_VERSION,
    exportadoEm: now.toISOString(),
    contract: doc.contract ?? null,
    checkins: doc.checkins ?? [],
    extras: doc.extras ?? [],
    checkpoints: doc.checkpoints ?? [],
    celebrated: doc.celebrated ?? [],
    isDemo: Boolean(doc.isDemo),
    createdAt: doc.createdAt,
  };
}

// Aceita o arquivo exportado pelo app (e o JSON das primeiras versões, que tem o mesmo formato)
function parseImport(text) {
  let raw;
  try {
    raw = JSON.parse(text);
  } catch (err) {
    throw new Error('O arquivo não é um JSON válido.');
  }
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new Error('O arquivo não tem dados do Até Quitar.');
  if (raw.formato !== undefined && raw.formato !== FORMAT) throw new Error('O arquivo é de outro aplicativo.');
  if (typeof raw.versao === 'number' && raw.versao > FORMAT_VERSION) {
    throw new Error('O arquivo foi exportado por uma versão mais nova do Até Quitar. Atualize o app para importar.');
  }
  if (!raw.contract || typeof raw.contract !== 'object') throw new Error('O arquivo não tem um financiamento cadastrado.');
  const { formato, versao, exportadoEm, ...doc } = raw;
  return doc;
}

module.exports = { FORMAT, FORMAT_VERSION, exportDocument, parseImport };
