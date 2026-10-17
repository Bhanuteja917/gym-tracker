// Regenerates src/server/exercise-library.json from free-exercise-db
// (https://github.com/yuhonas/free-exercise-db, public domain).
// Run: node scripts/build-exercise-library.mjs [path to a downloaded exercises.json]
import { readFile, writeFile } from 'node:fs/promises';

import { DROPPED, MUSCLE_FIXES, RENAMES } from './exercise-library-fixes.mjs';

const SOURCE = 'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/dist/exercises.json';
const OUT = new URL('../src/server/exercise-library.json', import.meta.url);

// free-exercise-db muscle → muscle group, named as on MuscleWiki's body map
// (see src/lib/muscles.ts).
const MUSCLE = {
  abdominals: 'Abdominals',
  abductors: 'Abductors',
  adductors: 'Adductors',
  biceps: 'Biceps',
  calves: 'Calves',
  chest: 'Chest',
  forearms: 'Forearms',
  glutes: 'Glutes',
  hamstrings: 'Hamstrings',
  lats: 'Lats',
  'lower back': 'Lower back',
  'middle back': 'Traps (mid-back)',
  neck: 'Neck',
  quadriceps: 'Quads',
  shoulders: 'Shoulders',
  traps: 'Traps',
  triceps: 'Triceps',
};

async function download() {
  if (process.argv[2]) return JSON.parse(await readFile(process.argv[2], 'utf8'));
  const response = await fetch(SOURCE);
  if (!response.ok) throw new Error(`${SOURCE}: HTTP ${response.status}`);
  return response.json();
}
const source = await download();

for (const name of [...Object.keys(MUSCLE_FIXES), ...Object.keys(RENAMES), ...DROPPED]) {
  if (!source.some((e) => e.name.trim() === name)) throw new Error(`Fix for "${name}", which isn't in the source`);
}

const seen = new Set();
const exercises = [];
// Library entries as an earlier version imported them, and what they are now,
// so the importer can correct exercises an account imported before.
const corrected = [];
const dropped = [];
for (const e of source) {
  const original = e.name.trim().replace(/\s+/g, ' ');
  if (seen.has(original.toLowerCase())) continue;
  seen.add(original.toLowerCase());
  const groups = e.primaryMuscles.map((m) => {
    if (!MUSCLE[m]) throw new Error(`Unmapped muscle "${m}" in "${original}"`);
    return MUSCLE[m];
  });
  const before = { name: original, muscleGroup: groups.join(', ') || null };
  if (DROPPED.includes(original)) {
    dropped.push(before);
    continue;
  }
  const after = {
    name: RENAMES[original] ?? original,
    // Cardio isn't one muscle; the source tags it all Quads.
    muscleGroup: MUSCLE_FIXES[original] ?? (e.category === 'cardio' ? null : before.muscleGroup),
  };
  exercises.push(after);
  if (after.name !== before.name || after.muscleGroup !== before.muscleGroup) corrected.push({ before, after });
}
exercises.sort((a, b) => a.name.localeCompare(b.name));
corrected.sort((a, b) => a.before.name.localeCompare(b.before.name));
dropped.sort((a, b) => a.name.localeCompare(b.name));

await writeFile(
  OUT,
  JSON.stringify({ source: 'free-exercise-db (public domain)', exercises, corrected, dropped }, null, 0)
    .replace(/\},\{/g, '},\n{')
    .replace(/\}\},\n\{/g, '}},\n{') + '\n',
);
console.log(
  `wrote ${exercises.length} exercises (${corrected.length} corrected, ${dropped.length} left out) to ${OUT.pathname}`,
);
