import { defineConfig } from '@playwright/test';

// End-to-end tests of the built app, in the Chrome and Edge installed on this computer.
// Run "pnpm e2e": it builds first, then serves dist/ for the website tests.
// The single-file tests open dist/raqaa.html straight from disk.
export default defineConfig({
  testDir: 'e2e',
  // One at a time: the update test briefly changes dist/sw.js.
  workers: 1,
  reporter: 'list',
  use: {
    baseURL: 'http://localhost:4173',
    viewport: { width: 1440, height: 900 },
  },
  projects: [
    { name: 'chrome', use: { channel: 'chrome' } },
    { name: 'edge', use: { channel: 'msedge' } },
  ],
  webServer: {
    command: 'pnpm exec vite preview --port 4173 --strictPort',
    url: 'http://localhost:4173',
    reuseExistingServer: false,
  },
});
