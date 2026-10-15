// Renders the app icons from an inline SVG. Run: node scripts/generate-icons.mjs
import { mkdir, writeFile } from 'node:fs/promises';

import sharp from 'sharp';

// lucide "dumbbell" (ISC license), 24×24.
const GLYPH = `
  <path d="M17.596 12.768a2 2 0 1 0 2.829-2.829l-1.768-1.767a2 2 0 0 0 2.828-2.829l-2.828-2.828a2 2 0 0 0-2.829 2.828l-1.767-1.768a2 2 0 1 0-2.829 2.829z"/>
  <path d="m2.5 21.5 1.4-1.4"/>
  <path d="m20.1 3.9 1.4-1.4"/>
  <path d="M5.343 21.485a2 2 0 1 0 2.829-2.828l1.767 1.768a2 2 0 1 0 2.829-2.829l-6.364-6.364a2 2 0 1 0-2.829 2.829l1.768 1.767a2 2 0 0 0-2.828 2.829z"/>
  <path d="m9.6 14.4 4.8-4.8"/>`;

const BG = '#0a0a0a';
const FG = '#fafafa';

/** `glyphScale` is the glyph's share of the canvas; maskable icons need a smaller one. */
function svg(size, { glyphScale, rounded }) {
  const glyph = size * glyphScale;
  const offset = (size - glyph) / 2;
  const radius = rounded ? size * 0.22 : 0;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <rect width="${size}" height="${size}" rx="${radius}" fill="${BG}"/>
  <g transform="translate(${offset} ${offset}) scale(${glyph / 24})" fill="none" stroke="${FG}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${GLYPH}</g>
</svg>`;
}

async function png(path, size, options) {
  await writeFile(path, await sharp(Buffer.from(svg(size, options))).png().toBuffer());
  console.log('wrote', path);
}

await mkdir('public/icons', { recursive: true });
// iOS and the manifest apply their own corner mask, so these are full-bleed squares.
await png('public/icons/icon-192.png', 192, { glyphScale: 0.6, rounded: false });
await png('public/icons/icon-512.png', 512, { glyphScale: 0.6, rounded: false });
await png('public/icons/maskable-512.png', 512, { glyphScale: 0.45, rounded: false });
await png('src/app/apple-icon.png', 180, { glyphScale: 0.6, rounded: false });
// Browser tab icon.
await writeFile('src/app/icon.svg', svg(64, { glyphScale: 0.66, rounded: true }));
console.log('wrote src/app/icon.svg');
