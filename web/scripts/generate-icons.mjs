// Renders the SetStack logo files and app icons. Run: node scripts/generate-icons.mjs
import { mkdir, writeFile } from 'node:fs/promises';

import sharp from 'sharp';

// The SetStack mark on a 64×64 grid: a green set stacked on two dark ones.
const GREEN = '#1FC18A';
const INK = '#0E2A25'; // the dark bars, for light backgrounds
const INK_ON_DARK = '#E3F1EC'; // the same bars on dark backgrounds
const bars = (ink) => `<rect x="22" y="8" width="36" height="14" rx="7" fill="${GREEN}"/>
  <rect x="10" y="25" width="44" height="14" rx="7" fill="${ink}"/>
  <rect x="6" y="42" width="36" height="14" rx="7" fill="${ink}"/>`;

const logo = (ink) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="512" height="512">
  ${bars(ink)}
</svg>
`;

/** An app icon: the mark at `scale` of the canvas, centred on a solid background. */
function icon(size, { scale, background = '#ffffff', ink = INK }) {
  const offset = (size * (1 - scale)) / 2;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <rect width="${size}" height="${size}" fill="${background}"/>
  <g transform="translate(${offset} ${offset}) scale(${(size * scale) / 64})">${bars(ink)}</g>
</svg>`;
}

async function png(path, svg) {
  await writeFile(path, await sharp(Buffer.from(svg)).png().toBuffer());
  console.log('wrote', path);
}

await mkdir('public/brand', { recursive: true });
await mkdir('public/icons', { recursive: true });
await writeFile('public/brand/setstack-logo.svg', logo(INK));
await writeFile('public/brand/setstack-logo-dark.svg', logo(INK_ON_DARK));
await png('public/brand/setstack-logo.png', icon(1024, { scale: 1, background: '#00000000' }));
await png('public/brand/setstack-logo-dark.png', icon(1024, { scale: 1, background: '#00000000', ink: INK_ON_DARK }));
console.log('wrote public/brand/setstack-logo{,-dark}.svg');

// iOS and the manifest apply their own corner mask, so these are full-bleed squares.
await png('public/icons/icon-192.png', icon(192, { scale: 0.8 }));
await png('public/icons/icon-512.png', icon(512, { scale: 0.8 }));
// Maskable icons are cropped to a circle as small as 80% of the canvas.
await png('public/icons/maskable-512.png', icon(512, { scale: 0.6 }));
await png('src/app/apple-icon.png', icon(180, { scale: 0.8 }));
// Browser tab icon: transparent, with the dark bars turning light in dark mode.
await writeFile(
  'src/app/icon.svg',
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
  <style>.ink { fill: ${INK} } @media (prefers-color-scheme: dark) { .ink { fill: ${INK_ON_DARK} } }</style>
  <rect x="22" y="8" width="36" height="14" rx="7" fill="${GREEN}"/>
  <rect class="ink" x="10" y="25" width="44" height="14" rx="7"/>
  <rect class="ink" x="6" y="42" width="36" height="14" rx="7"/>
</svg>
`,
);
console.log('wrote src/app/icon.svg');
