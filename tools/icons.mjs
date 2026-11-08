// Draws the app icons in public/icons from assets/brand/mark.svg, using the installed Chrome.
// Run after changing the mark: pnpm icons
import { copyFile, mkdir, readFile } from 'node:fs/promises';
import { chromium } from '@playwright/test';

const SKY = '#F2F7FF'; // --sky in assets/tokens.css
const out = 'public/icons';

// Let the mark fill whatever box it is drawn in, keeping its proportions.
const mark = (await readFile('assets/brand/mark.svg', 'utf8')).replace(
  /<svg([^>]*?)\swidth="[^"]*"\sheight="[^"]*"/,
  '<svg$1 width="100%" height="100%"',
);

const icons = [
  // Regular icons: transparent corners, a thin margin.
  { file: 'icon-192.png', size: 192, margin: 0.04, background: 'transparent' },
  { file: 'icon-512.png', size: 512, margin: 0.04, background: 'transparent' },
  // Maskable icon: a full background, and the mark inside the central safe circle.
  { file: 'icon-maskable-512.png', size: 512, margin: 0.2, background: SKY },
];

await mkdir(out, { recursive: true });
const browser = await chromium.launch({ channel: 'chrome' });
const page = await browser.newPage();
for (const { file, size, margin, background } of icons) {
  await page.setViewportSize({ width: size, height: size });
  const box = Math.round(size * (1 - 2 * margin));
  await page.setContent(
    `<body style="margin:0;width:${size}px;height:${size}px;display:grid;place-items:center;background:${background}">` +
      `<div style="width:${box}px;height:${box}px">${mark}</div></body>`,
  );
  await page.screenshot({ path: `${out}/${file}`, omitBackground: background === 'transparent' });
  console.log(`${out}/${file}`);
}
await browser.close();
await copyFile('assets/brand/mark.svg', `${out}/mark.svg`);
console.log(`${out}/mark.svg`);
