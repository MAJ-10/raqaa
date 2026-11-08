/// <reference types="vitest/config" />
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import { singleFile, website } from './tools/pwa.ts';

// One code base, two outputs ("pnpm build" runs both):
//   vite build                → dist/            the website: installs as an app and works offline
//   vite build --mode single  → dist/raqaa.html  one self-contained file that opens by double-click
export default defineConfig(({ mode }) => {
  const single = mode === 'single';
  return {
    base: './',
    plugins: [react(), single ? singleFile('raqaa.html') : website()],
    publicDir: single ? false : 'public',
    build: {
      // The single file is added next to the website, so its build must not clear dist/.
      emptyOutDir: !single,
    },
    test: {
      include: ['tests/**/*.test.ts'],
    },
  };
});
