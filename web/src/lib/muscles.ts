/**
 * Individual muscles drawn on the 3D body figure, named as on MuscleWiki's body
 * map. An exercise's free-text muscle group is resolved to these with
 * `musclesFor`, so broad groups ("Legs") and single muscles ("Calves") both work.
 */
export const MUSCLES = [
  { id: 'traps', label: 'Traps' },
  { id: 'front-shoulders', label: 'Front shoulders' },
  { id: 'rear-shoulders', label: 'Rear shoulders' },
  { id: 'chest', label: 'Chest' },
  { id: 'biceps', label: 'Biceps' },
  { id: 'triceps', label: 'Triceps' },
  { id: 'forearms', label: 'Forearms' },
  { id: 'abdominals', label: 'Abdominals' },
  { id: 'obliques', label: 'Obliques' },
  { id: 'lats', label: 'Lats' },
  { id: 'traps-middle', label: 'Traps (mid-back)' },
  { id: 'lower-back', label: 'Lower back' },
  { id: 'glutes', label: 'Glutes' },
  { id: 'abductors', label: 'Abductors' },
  { id: 'adductors', label: 'Adductors' },
  { id: 'quads', label: 'Quads' },
  { id: 'hamstrings', label: 'Hamstrings' },
  { id: 'calves', label: 'Calves' },
] as const;

export type MuscleId = (typeof MUSCLES)[number]['id'];

const ALL = MUSCLES.map((m) => m.id);

/** Lower-cased names (groups, muscles and common synonyms) → muscles. */
const NAMES: Record<string, readonly MuscleId[]> = {
  // Broad groups, including the app's default suggestions.
  chest: ['chest'],
  pecs: ['chest'],
  back: ['lats', 'traps-middle', 'lower-back'],
  shoulders: ['front-shoulders', 'rear-shoulders'],
  delts: ['front-shoulders', 'rear-shoulders'],
  arms: ['biceps', 'triceps', 'forearms'],
  legs: ['quads', 'hamstrings', 'glutes', 'calves'],
  core: ['abdominals', 'obliques'],
  abs: ['abdominals'],
  'full body': ALL,
  // Single muscles and synonyms.
  traps: ['traps'],
  trapezius: ['traps'],
  'front shoulders': ['front-shoulders'],
  'front delts': ['front-shoulders'],
  'rear shoulders': ['rear-shoulders'],
  'rear delts': ['rear-shoulders'],
  biceps: ['biceps'],
  triceps: ['triceps'],
  forearms: ['forearms'],
  abdominals: ['abdominals'],
  obliques: ['obliques'],
  lats: ['lats'],
  'traps (mid-back)': ['traps-middle'],
  'mid back': ['traps-middle'],
  'middle back': ['traps-middle'],
  'upper back': ['traps-middle', 'traps'],
  'lower back': ['lower-back'],
  glutes: ['glutes'],
  abductors: ['abductors'],
  adductors: ['adductors'],
  quads: ['quads'],
  quadriceps: ['quads'],
  hamstrings: ['hamstrings'],
  calves: ['calves'],
};

/**
 * The muscles a muscle-group text targets, in body-map order. Several names
 * can be combined with commas, "&" or "and" (e.g. "Calves, Hamstrings").
 * Unknown names (e.g. "Cardio") contribute nothing.
 */
export function musclesFor(group: string | null | undefined): MuscleId[] {
  if (!group) return [];
  const found = new Set<MuscleId>();
  for (const part of group.toLowerCase().split(/\s*(?:,|&|\band\b|\/)\s*/)) {
    for (const id of NAMES[part.trim().replace(/\s+/g, ' ')] ?? []) found.add(id);
  }
  return ALL.filter((id) => found.has(id));
}

export function muscleLabel(id: MuscleId): string {
  return MUSCLES.find((m) => m.id === id)!.label;
}

export function isMuscleId(value: string | null | undefined): value is MuscleId {
  return ALL.some((id) => id === value);
}

// Muscles best seen from behind; the rest show on the front (forearms on both).
const BACK_MUSCLES: readonly MuscleId[] = [
  'traps',
  'rear-shoulders',
  'triceps',
  'traps-middle',
  'lats',
  'lower-back',
  'glutes',
  'hamstrings',
  'calves',
];

/** The side of the body that shows most of these muscles (front on a tie). */
export function sideFor(ids: readonly MuscleId[]): 'front' | 'back' {
  const back = ids.filter((id) => BACK_MUSCLES.includes(id)).length;
  return back > ids.length - back ? 'back' : 'front';
}
