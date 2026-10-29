import { defineConfig } from 'vite';

// https://vitejs.dev/config
export default defineConfig({
  build: {
    rollupOptions: {
      // carregados de node_modules na hora de rodar: o Baileys é ESM e traz as próprias dependências
      external: ['baileys', 'pino', 'qrcode', 'electron-updater'],
    },
  },
});
