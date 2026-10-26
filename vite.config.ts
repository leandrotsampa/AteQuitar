import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import pkg from './package.json' with { type: 'json' };

export default defineConfig({
  // Caminhos relativos para o Electron carregar dist/index.html via file://
  base: './',
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
  },
  plugins: [react(), tailwindcss()],
});
