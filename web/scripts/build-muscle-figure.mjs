// Builds src/components/muscle-figure/body-paths.ts from the group shapes in
// scripts/muscle-figure/shapes.mjs and the splits in scripts/muscle-figure/parts.mjs.
// Run after changing either: node scripts/build-muscle-figure.mjs
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import polygonClipping from 'polygon-clipping';

import * as parts from './muscle-figure/parts.mjs';
import * as shapes from './muscle-figure/shapes.mjs';

const OUT = fileURLToPath(new URL('../src/components/muscle-figure/body-paths.ts', import.meta.url));
const CURVE_STEPS = 10;
const TOLERANCE = 0.1; // how far a simplified outline may stray, in viewBox units

/** Absolute M/L/H/V/C/Z path → rings of points, with curves flattened. */
function toRings(d) {
  const tokens = d.match(/[MLHVCZ]|-?\d*\.?\d+(?:e-?\d+)?/gi);
  const rings = [];
  let ring = null;
  let cmd = '';
  let x = 0;
  let y = 0;
  const num = () => Number(tokens.shift());
  while (tokens.length) {
    if (/[a-z]/i.test(tokens[0])) cmd = tokens.shift();
    if (cmd === 'Z') {
      if (ring) rings.push(ring);
      ring = null;
      continue;
    }
    if (cmd === 'M') {
      if (ring) rings.push(ring);
      x = num();
      y = num();
      ring = [[x, y]];
      cmd = 'L';
    } else if (cmd === 'L') {
      x = num();
      y = num();
      ring.push([x, y]);
    } else if (cmd === 'H') {
      x = num();
      ring.push([x, y]);
    } else if (cmd === 'V') {
      y = num();
      ring.push([x, y]);
    } else if (cmd === 'C') {
      const [x1, y1, x2, y2, x3, y3] = [num(), num(), num(), num(), num(), num()];
      for (let i = 1; i <= CURVE_STEPS; i++) {
        const t = i / CURVE_STEPS;
        const u = 1 - t;
        ring.push([
          u * u * u * x + 3 * u * u * t * x1 + 3 * u * t * t * x2 + t * t * t * x3,
          u * u * u * y + 3 * u * u * t * y1 + 3 * u * t * t * y2 + t * t * t * y3,
        ]);
      }
      x = x3;
      y = y3;
    } else {
      throw new Error(`Unsupported path command ${cmd}`);
    }
  }
  if (ring) rings.push(ring);
  return rings;
}

/** A path's subpaths as a multipolygon, one polygon each (the shapes have no holes). */
const fromPath = (d) => toRings(d).map((ring) => [ring]);

/** A left-half polygon plus its mirror image on the right half. */
const mirrored = (points) => [[points], [points.map(([px, py]) => [200 - px, py])]];

function simplify(points) {
  // Ramer–Douglas–Peucker on an open polyline.
  if (points.length < 3) return points;
  const [ax, ay] = points[0];
  const [bx, by] = points[points.length - 1];
  const len = Math.hypot(bx - ax, by - ay) || 1;
  let far = 0;
  let index = 0;
  for (let i = 1; i < points.length - 1; i++) {
    const [px, py] = points[i];
    const dist = Math.abs((bx - ax) * (ay - py) - (ax - px) * (by - ay)) / len;
    if (dist > far) {
      far = dist;
      index = i;
    }
  }
  if (far <= TOLERANCE) return [points[0], points[points.length - 1]];
  return [...simplify(points.slice(0, index + 1)).slice(0, -1), ...simplify(points.slice(index))];
}

const round = (n) => String(Math.round(n * 10) / 10);

function toPath(multipolygon) {
  return multipolygon
    .flatMap((polygon) =>
      polygon.map((ring) => {
        // Rings come back closed (last point = first); split in two so the
        // start point survives simplification.
        const mid = Math.floor(ring.length / 2);
        const points = [...simplify(ring.slice(0, mid + 1)), ...simplify(ring.slice(mid)).slice(1, -1)];
        return `M${points.map(([px, py]) => `${round(px)} ${round(py)}`).join('L')}Z`;
      }),
    )
    .join(' ');
}

const area = (multipolygon) =>
  multipolygon.flat().reduce((sum, ring) => {
    let a = 0;
    for (let i = 0; i < ring.length - 1; i++) a += ring[i][0] * ring[i + 1][1] - ring[i + 1][0] * ring[i][1];
    return sum + Math.abs(a) / 2;
  }, 0);

function buildSide(groups, { splits, added }) {
  const out = {};
  const add = (id, shape) => {
    if (area(shape) < 4) throw new Error(`${id} is (nearly) empty`);
    out[id] = out[id] ? polygonClipping.union(out[id], shape) : shape;
  };
  for (const [group, muscles] of Object.entries(splits)) {
    if (!groups[group]) throw new Error(`No shape for ${group}`);
    let rest = fromPath(groups[group]);
    for (const [id, region] of muscles) {
      const shape = region ? polygonClipping.intersection(rest, mirrored(region)) : rest;
      if (region) rest = polygonClipping.difference(rest, mirrored(region));
      add(id, shape);
    }
  }
  const missing = Object.keys(groups).filter((g) => !splits[g]);
  if (missing.length) throw new Error(`No split for ${missing.join(', ')}`);
  const body = fromPath(shapes.OUTLINE);
  const drawn = polygonClipping.union(...Object.values(out));
  for (const [id, points] of Object.entries(added)) {
    add(id, polygonClipping.difference(polygonClipping.intersection(mirrored(points), body), drawn));
  }
  return Object.fromEntries(Object.entries(out).map(([id, shape]) => [id, toPath(shape)]));
}

const record = (side) =>
  `{\n${Object.entries(side)
    .map(([id, d]) => `  '${id}': '${d}',`)
    .join('\n')}\n}`;

const front = buildSide(shapes.FRONT, parts.FRONT);
const back = buildSide(shapes.BACK, parts.BACK);

writeFileSync(
  OUT,
  `// Generated by scripts/build-muscle-figure.mjs from scripts/muscle-figure/; do not edit.
// Path data for the flat body figure (viewBox 200×422 per side; the
// figure faces the viewer, so the person's left is on the right).
import type { PartId } from '@/lib/muscles';

export const BODY_OUTLINE = '${shapes.OUTLINE}';

export const FRONT: Partial<Record<PartId, string>> = ${record(front)};

export const BACK: Partial<Record<PartId, string>> = ${record(back)};

/** Divisions drawn over the muscles (six-pack, spine, two-headed calves). */
export const FRONT_LINES = '${parts.FRONT_LINES}';
export const BACK_LINES = '${parts.BACK_LINES}';
`,
);
console.log(`Wrote ${Object.keys(front).length} front and ${Object.keys(back).length} back muscles to ${OUT}`);
