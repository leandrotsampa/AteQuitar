/**
 * Processo principal do Electron: janela sem moldura nativa, dados do usuário
 * num banco SQLite local (atequitar.sqlite) e os comandos da janela.
 */

const { app, BrowserWindow, ipcMain, shell, Menu, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const { windowChromeOptions, windowControlFor, shortcutFor } = require('./windowChrome.cjs');
const { portableDirectoryFor } = require('./dataDirectory.cjs');
const { openDatabase, readDoc, writeDoc, importLegacyJson } = require('./database.cjs');
const { exportDocument, parseImport } = require('./dataTransfer.cjs');

const DB_FILE = 'atequitar.sqlite';
// Arquivo das primeiras versões; também é o modo de reserva se o SQLite não carregar
const JSON_FILE = 'atequitar-dados.json';

let mainWindow = null;
let Database = null;
let db = null;
let dataPath = '';
// 'portable' = banco ao lado do app; 'system' = pasta de dados do sistema (userData)
let storageMode = 'portable';

function getDataDirectory() {
  const portableDir = portableDirectoryFor({
    env: process.env,
    platform: process.platform,
    isPackaged: app.isPackaged,
    exePath: app.getPath('exe'),
    cwd: process.cwd(),
  });
  if (portableDir) {
    try {
      fs.accessSync(portableDir, fs.constants.W_OK);
      storageMode = 'portable';
      return portableDir;
    } catch (err) {
      // pasta restrita (ex.: C:\Program Files): usa a pasta de dados do sistema
    }
  }
  const userDataDir = app.getPath('userData');
  fs.mkdirSync(userDataDir, { recursive: true });
  storageMode = 'system';
  return userDataDir;
}

function initDatabase() {
  const dir = getDataDirectory();
  const jsonPath = path.join(dir, JSON_FILE);
  try {
    Database = require('better-sqlite3');
    dataPath = path.join(dir, DB_FILE);
    db = openDatabase(Database, dataPath);
    if (importLegacyJson(db, jsonPath)) console.log('[Até Quitar] Dados do arquivo JSON antigo importados para o SQLite.');
  } catch (err) {
    // Driver nativo indisponível: segue gravando no arquivo JSON para não perder nada
    console.error('[Até Quitar] SQLite indisponível; usando o arquivo JSON de reserva.', err);
    db = null;
    dataPath = jsonPath;
  }
  console.log(`[Até Quitar] Dados (${db ? 'sqlite' : 'json'}, ${storageMode}): ${dataPath}`);
}

function readData() {
  if (db) return readDoc(db);
  try {
    return fs.existsSync(dataPath) ? JSON.parse(fs.readFileSync(dataPath, 'utf-8')) : null;
  } catch (err) {
    return null;
  }
}

function writeData(doc) {
  if (db) return writeDoc(db, doc);
  // Reserva: arquivo temporário e troca de nome, para nunca ficar pela metade
  const tmp = `${dataPath}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(doc, null, 2), 'utf-8');
  fs.renameSync(tmp, dataPath);
  return true;
}

const today = () => new Date().toISOString().slice(0, 10);

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1320,
    height: 880,
    minWidth: 1024,
    minHeight: 680,
    title: 'Até Quitar',
    backgroundColor: '#eef1f8',
    ...windowChromeOptions(process.platform),
    icon: path.join(__dirname, '..', 'dist', 'icon.png'),
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      spellcheck: false,
    },
  });
  mainWindow.once('ready-to-show', () => mainWindow.show());
  setTimeout(() => {
    if (mainWindow && !mainWindow.isDestroyed() && !mainWindow.isVisible()) mainWindow.show();
  }, 4000);

  const devUrl = 'http://localhost:3100';
  const prodPath = path.join(__dirname, '..', 'dist', 'index.html');
  if (process.env.NODE_ENV === 'development' || !fs.existsSync(prodPath)) {
    mainWindow.loadURL(devUrl).catch(() => mainWindow.loadFile(prodPath));
  } else {
    mainWindow.loadFile(prodPath);
  }

  const sendMaximized = () => mainWindow.webContents.send('window:maximized', mainWindow.isMaximized());
  mainWindow.on('maximize', sendMaximized);
  mainWindow.on('unmaximize', sendMaximized);

  mainWindow.webContents.on('before-input-event', (event, input) => {
    if (input.type !== 'keyDown') return;
    const action = shortcutFor(input, app.isPackaged);
    if (!action) return;
    event.preventDefault();
    const wc = mainWindow.webContents;
    const zoom = (delta) => wc.setZoomLevel(Math.min(3, Math.max(-3, wc.getZoomLevel() + delta)));
    if (action === 'zoom-in') zoom(0.5);
    else if (action === 'zoom-out') zoom(-0.5);
    else if (action === 'zoom-reset') wc.setZoomLevel(0);
    else if (action === 'reload') wc.reload();
    else if (action === 'devtools') wc.toggleDevTools();
  });

  // Links externos (fontes das taxas, gov.br) abrem no navegador do sistema
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https:\/\//.test(url)) shell.openExternal(url);
    return { action: 'deny' };
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

function setupIpcHandlers() {
  ipcMain.handle('window:control', (event, action) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    const control = windowControlFor(action);
    if (!win || !control) return;
    if (control === 'minimize') win.minimize();
    else if (control === 'close') win.close();
    else if (win.isMaximized()) win.unmaximize();
    else win.maximize();
  });
  ipcMain.handle('window:is-maximized', (event) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    return Boolean(win && win.isMaximized());
  });

  ipcMain.handle('data:load', () => readData());
  ipcMain.handle('data:save', (event, doc) => writeData(doc));
  ipcMain.handle('data:info', () => ({ path: dataPath, mode: storageMode, engine: db ? 'sqlite' : 'json' }));

  // Exportar: os dados em JSON legível (sem as taxas do mercado, que o app busca de novo)
  ipcMain.handle('data:export', async (event) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    const doc = readData();
    if (!doc) return { ok: false };
    const { canceled, filePath } = await dialog.showSaveDialog(win, {
      title: 'Exportar dados do Até Quitar',
      defaultPath: path.join(app.getPath('documents'), `atequitar-dados-${today()}.json`),
      filters: [{ name: 'Dados do Até Quitar (JSON)', extensions: ['json'] }],
    });
    if (canceled || !filePath) return { ok: false };
    fs.writeFileSync(filePath, JSON.stringify(exportDocument(doc), null, 2), 'utf-8');
    return { ok: true, path: filePath };
  });

  // Importar: lê o JSON escolhido e devolve os dados para a interface confirmar e aplicar
  ipcMain.handle('data:import', async (event) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    const { canceled, filePaths } = await dialog.showOpenDialog(win, {
      title: 'Importar dados do Até Quitar',
      properties: ['openFile'],
      filters: [{ name: 'Dados do Até Quitar (JSON)', extensions: ['json'] }],
    });
    if (canceled || !filePaths[0]) return { ok: false };
    try {
      return { ok: true, doc: parseImport(fs.readFileSync(filePaths[0], 'utf-8')) };
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : 'Arquivo inválido.' };
    }
  });

  ipcMain.handle('data:open-folder', () => {
    if (fs.existsSync(dataPath)) shell.showItemInFolder(dataPath);
    else shell.openPath(path.dirname(dataPath));
    return true;
  });
}

function setupApplicationMenu() {
  if (process.platform === 'darwin') {
    Menu.setApplicationMenu(Menu.buildFromTemplate([{ role: 'appMenu' }, { role: 'editMenu' }]));
  } else {
    Menu.setApplicationMenu(null);
  }
}

app.whenReady().then(() => {
  initDatabase();
  setupIpcHandlers();
  setupApplicationMenu();
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('will-quit', () => {
  try {
    db?.close();
  } catch (e) {}
});
