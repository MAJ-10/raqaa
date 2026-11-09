// Fetches the memory images listed in src/content/memory-images.json from Fluent Emoji Flat
// (Microsoft, MIT license) through the Iconify API, and adds an ink outline so they stand out on screen.
// Run after changing the list: pnpm images
import { readdir, readFile, rm, writeFile } from 'node:fs/promises';

const DIR = 'src/content/memory-images';
const INK = '#13213D'; // --ink in assets/tokens.css
const OUTLINE = 1; // in the icons' 32-unit grid

const list = JSON.parse(await readFile('src/content/memory-images.json', 'utf8'));
const ids = list.map((item) => item.id);

const response = await fetch(`https://api.iconify.design/fluent-emoji-flat.json?icons=${ids.join(',')}`);
if (!response.ok) throw new Error(`Iconify answered ${response.status}`);
const data = await response.json();
if (data.not_found?.length) throw new Error(`Not in Fluent Emoji Flat: ${data.not_found.join(', ')}`);

const size = data.width ?? 32;
for (const id of ids) {
  const icon = data.icons[id];
  const pad = OUTLINE * 2;
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${-pad} ${-pad} ${size + 2 * pad} ${size + 2 * pad}">` +
    `<defs><filter id="outline-${id}" x="-10%" y="-10%" width="120%" height="120%">` +
    `<feMorphology in="SourceAlpha" operator="dilate" radius="${OUTLINE}" result="grown"/>` +
    `<feFlood flood-color="${INK}"/><feComposite in2="grown" operator="in" result="edge"/>` +
    `<feMerge><feMergeNode in="edge"/><feMergeNode in="SourceGraphic"/></feMerge></filter></defs>` +
    `<g filter="url(#outline-${id})">${icon.body}</g></svg>\n`;
  await writeFile(`${DIR}/${id}.svg`, svg);
}

// Remove images no longer on the list.
for (const file of await readdir(DIR)) {
  if (file.endsWith('.svg') && !ids.includes(file.slice(0, -4))) await rm(`${DIR}/${file}`);
}
console.log(`${ids.length} images written to ${DIR}`);
