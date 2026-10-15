// Regenerates src/server/exercise-library.json from free-exercise-db
// (https://github.com/yuhonas/free-exercise-db, public domain).
// Run: node scripts/build-exercise-library.mjs
import { writeFile } from 'node:fs/promises';

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

const response = await fetch(SOURCE);
if (!response.ok) throw new Error(`${SOURCE}: HTTP ${response.status}`);
const source = await response.json();

const seen = new Set();
const exercises = [];
for (const e of source) {
  const name = e.name.trim().replace(/\s+/g, ' ');
  if (seen.has(name.toLowerCase())) continue;
  seen.add(name.toLowerCase());
  const groups = e.primaryMuscles.map((m) => {
    if (!MUSCLE[m]) throw new Error(`Unmapped muscle "${m}" in "${name}"`);
    return MUSCLE[m];
  });
  exercises.push({ name, muscleGroup: groups.join(', ') || null });
}
exercises.sort((a, b) => a.name.localeCompare(b.name));

await writeFile(
  OUT,
  JSON.stringify({ source: 'free-exercise-db (public domain)', exercises }, null, 0).replace(/\},\{/g, '},\n{') + '\n',
);
console.log(`wrote ${exercises.length} exercises to ${OUT.pathname}`);
