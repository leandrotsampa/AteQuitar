// Gera build/splash.bmp a partir de splash.html (rode com: npm run splash).
// O plugin do portátil só aceita BMP de 24 bits, então o PNG capturado é convertido aqui mesmo.
const fs = require('fs');
const path = require('path');
const { app, BrowserWindow, nativeImage } = require('electron');

const W = 480;
const H = 300;

// BMP 24 bits sem compressão: linhas de baixo para cima, BGR, cada linha alinhada em 4 bytes
function toBmp(bitmap, width, height) {
  const rowSize = Math.ceil((width * 3) / 4) * 4;
  const out = Buffer.alloc(54 + rowSize * height);
  out.write('BM', 0);
  out.writeUInt32LE(out.length, 2);
  out.writeUInt32LE(54, 10);
  out.writeUInt32LE(40, 14);
  out.writeInt32LE(width, 18);
  out.writeInt32LE(height, 22);
  out.writeUInt16LE(1, 26);
  out.writeUInt16LE(24, 28);
  out.writeUInt32LE(rowSize * height, 34);
  out.writeInt32LE(3780, 38);
  out.writeInt32LE(3780, 42);
  for (let y = 0; y < height; y++) {
    const dst = 54 + (height - 1 - y) * rowSize;
    for (let x = 0; x < width; x++) {
      // nativeImage.toBitmap() devolve BGRA
      const src = (y * width + x) * 4;
      out[dst + x * 3] = bitmap[src];
      out[dst + x * 3 + 1] = bitmap[src + 1];
      out[dst + x * 3 + 2] = bitmap[src + 2];
    }
  }
  return out;
}

app.whenReady().then(async () => {
  const win = new BrowserWindow({ width: W, height: H, show: true, frame: false, useContentSize: true });
  await win.loadFile(path.join(__dirname, 'splash.html'));
  await win.webContents.executeJavaScript('document.fonts.ready.then(() => true)');
  await new Promise((r) => setTimeout(r, 400));
  const shot = await win.webContents.capturePage({ x: 0, y: 0, width: W, height: H });
  const img = nativeImage.createFromBuffer(shot.toPNG()).resize({ width: W, height: H, quality: 'best' });
  const out = path.join(__dirname, '..', '..', 'build', 'splash.bmp');
  fs.writeFileSync(out, toBmp(img.toBitmap(), W, H));
  console.log(`Tela de carregamento gerada em ${path.relative(process.cwd(), out)}`);
  app.quit();
});
