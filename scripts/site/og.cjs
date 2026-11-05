// Gera site/og.png, a imagem de prévia do site no WhatsApp, LinkedIn e Google (rode com: npm run site:og).
// Usa o Electron do projeto para desenhar og.html com as mesmas fontes do app, sem depender da internet.
const fs = require('fs');
const path = require('path');
const { app, BrowserWindow } = require('electron');

const W = 1200;
const H = 630;

app.whenReady().then(async () => {
  const win = new BrowserWindow({ width: W, height: H, show: false, frame: false, useContentSize: true, webPreferences: { offscreen: true } });
  await win.loadFile(path.join(__dirname, 'og.html'));
  await win.webContents.executeJavaScript('document.fonts.ready.then(() => true)');
  await new Promise((r) => setTimeout(r, 400));
  const shot = await win.webContents.capturePage({ x: 0, y: 0, width: W, height: H });
  const out = path.join(__dirname, '..', '..', 'site', 'og.png');
  fs.writeFileSync(out, shot.resize({ width: W, height: H, quality: 'best' }).toPNG());
  console.log(`Imagem de prévia gerada em ${path.relative(process.cwd(), out)}`);
  app.quit();
});
