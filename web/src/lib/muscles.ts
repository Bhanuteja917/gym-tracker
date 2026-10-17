type Side = 'front' | 'back';
type Part = { readonly id: string; readonly label: string; readonly side: Side };
type Group = { readonly id: string; readonly label: string } & (
  | { readonly parts: readonly Part[] }
  | { readonly side: Side }
);

/**
 * Muscle groups on the body chart, in body-map order, each split into the
 * individual muscles ("parts") drawn on it. A group without `parts` is drawn
 * as one muscle. `side` is the view of the figure that shows a muscle best;
 * some (side delts, upper traps, neck, calves) are drawn on both.
 */
export const MUSCLES = [
  {
    id: 'traps',
    label: 'Traps',
    parts: [
      { id: 'upper-traps', label: 'Upper traps', side: 'back' },
      { id: 'lower-traps', label: 'Lower traps', side: 'back' },
    ],
  },
  { id: 'neck', label: 'Neck', side: 'front' },
  {
    id: 'shoulders',
    label: 'Shoulders',
    parts: [
      { id: 'front-delts', label: 'Front delts', side: 'front' },
      { id: 'side-delts', label: 'Side delts', side: 'front' },
      { id: 'rear-delts', label: 'Rear delts', side: 'back' },
    ],
  },
  {
    id: 'chest',
    label: 'Chest',
    parts: [
      { id: 'upper-chest', label: 'Upper chest', side: 'front' },
      { id: 'mid-chest', label: 'Mid chest', side: 'front' },
      { id: 'lower-chest', label: 'Lower chest', side: 'front' },
    ],
  },
  {
    id: 'biceps',
    label: 'Biceps',
    parts: [
      { id: 'biceps-long', label: 'Biceps long head', side: 'front' },
      { id: 'biceps-short', label: 'Biceps short head', side: 'front' },
      { id: 'brachialis', label: 'Brachialis', side: 'front' },
    ],
  },
  {
    id: 'triceps',
    label: 'Triceps',
    parts: [
      { id: 'triceps-long', label: 'Triceps long head', side: 'back' },
      { id: 'triceps-lateral', label: 'Triceps lateral head', side: 'back' },
      { id: 'triceps-medial', label: 'Triceps medial head', side: 'back' },
    ],
  },
  {
    id: 'forearms',
    label: 'Forearms',
    parts: [
      { id: 'wrist-flexors', label: 'Wrist flexors', side: 'front' },
      { id: 'wrist-extensors', label: 'Wrist extensors', side: 'back' },
      { id: 'brachioradialis', label: 'Brachioradialis', side: 'front' },
    ],
  },
  {
    id: 'abdominals',
    label: 'Abdominals',
    parts: [
      { id: 'upper-abs', label: 'Upper abs', side: 'front' },
      { id: 'lower-abs', label: 'Lower abs', side: 'front' },
    ],
  },
  {
    id: 'obliques',
    label: 'Obliques',
    parts: [
      { id: 'external-obliques', label: 'External obliques', side: 'front' },
      { id: 'serratus', label: 'Serratus anterior', side: 'front' },
    ],
  },
  { id: 'hip-flexors', label: 'Hip flexors', side: 'front' },
  {
    id: 'lats',
    label: 'Lats',
    parts: [
      { id: 'latissimus', label: 'Latissimus dorsi', side: 'back' },
      { id: 'teres-major', label: 'Teres major', side: 'back' },
    ],
  },
  {
    id: 'traps-middle',
    label: 'Traps (mid-back)',
    parts: [
      { id: 'middle-traps', label: 'Middle traps', side: 'back' },
      { id: 'rhomboids', label: 'Rhomboids', side: 'back' },
    ],
  },
  { id: 'rotator-cuff', label: 'Rotator cuff', side: 'back' },
  { id: 'lower-back', label: 'Lower back', side: 'back' },
  {
    id: 'glutes',
    label: 'Glutes',
    parts: [
      { id: 'glute-max', label: 'Glute max', side: 'back' },
      { id: 'glute-med', label: 'Glute medius', side: 'back' },
    ],
  },
  { id: 'abductors', label: 'Abductors', side: 'front' },
  { id: 'adductors', label: 'Adductors', side: 'front' },
  {
    id: 'quads',
    label: 'Quads',
    parts: [
      { id: 'rectus-femoris', label: 'Rectus femoris', side: 'front' },
      { id: 'outer-quad', label: 'Outer quad', side: 'front' },
      { id: 'inner-quad', label: 'Inner quad', side: 'front' },
    ],
  },
  {
    id: 'hamstrings',
    label: 'Hamstrings',
    parts: [
      { id: 'outer-hamstring', label: 'Outer hamstring', side: 'back' },
      { id: 'inner-hamstring', label: 'Inner hamstring', side: 'back' },
    ],
  },
  {
    id: 'calves',
    label: 'Calves',
    parts: [
      { id: 'gastrocnemius', label: 'Gastrocnemius', side: 'back' },
      { id: 'soleus', label: 'Soleus', side: 'back' },
      { id: 'tibialis', label: 'Tibialis', side: 'front' },
    ],
  },
] as const satisfies readonly Group[];

type Muscles = (typeof MUSCLES)[number];
/** A muscle group. */
export type MuscleId = Muscles['id'];
/** An individual muscle drawn on the chart (a group without parts is its own part). */
export type PartId =
  | Extract<Muscles, { parts: unknown }>['parts'][number]['id']
  | Exclude<Muscles, { parts: unknown }>['id'];

/** Every drawn muscle with its group, in body-map order. */
export const PARTS: readonly { id: PartId; label: string; muscle: MuscleId; side: Side }[] = MUSCLES.flatMap(
  (m: Group) =>
    'parts' in m
      ? m.parts.map((p) => ({ ...p, muscle: m.id }))
      : [{ id: m.id, label: m.label, side: m.side, muscle: m.id }],
) as never;

const GROUP_PARTS = new Map<string, PartId[]>(
  MUSCLES.map((m) => [m.id, PARTS.filter((p) => p.muscle === m.id).map((p) => p.id)]),
);
const PART = new Map(PARTS.map((p) => [p.id as string, p]));

export function isMuscleId(value: string | null | undefined): value is MuscleId {
  return value != null && GROUP_PARTS.has(value);
}

export function isPartId(value: string | null | undefined): value is PartId {
  return value != null && PART.has(value);
}

/** The parts a group or part covers (a part covers itself). */
export function partsOf(id: MuscleId | PartId): PartId[] {
  return GROUP_PARTS.get(id) ?? [id as PartId];
}

/** The group a group or part belongs to. */
export function groupOf(id: MuscleId | PartId): MuscleId {
  return isMuscleId(id) ? id : PART.get(id)!.muscle;
}

export function muscleLabel(id: MuscleId | PartId): string {
  return MUSCLES.find((m) => m.id === id)?.label ?? PART.get(id)!.label;
}

const ALL_GROUPS = MUSCLES.map((m) => m.id);

/** Lower-cased names (broad groups, groups, parts and common synonyms) → groups or parts. */
const NAMES: Record<string, readonly (MuscleId | PartId)[]> = {
  ...Object.fromEntries([...MUSCLES, ...PARTS].map((m) => [m.label.toLowerCase(), [m.id]])),
  // Broad groups, including the app's default suggestions.
  back: ['lats', 'traps-middle', 'lower-back'],
  arms: ['biceps', 'triceps', 'forearms'],
  legs: ['quads', 'hamstrings', 'glutes', 'calves'],
  core: ['abdominals', 'obliques'],
  'full body': ALL_GROUPS,
  // Synonyms.
  pecs: ['chest'],
  delts: ['shoulders'],
  'front shoulders': ['front-delts'],
  'anterior delts': ['front-delts'],
  'lateral delts': ['side-delts'],
  'middle delts': ['side-delts'],
  'rear shoulders': ['rear-delts'],
  'posterior delts': ['rear-delts'],
  trapezius: ['traps'],
  'mid back': ['traps-middle'],
  'middle back': ['traps-middle'],
  'upper back': ['traps-middle', 'traps'],
  'mid traps': ['middle-traps'],
  'upper pecs': ['upper-chest'],
  'middle chest': ['mid-chest'],
  'lower pecs': ['lower-chest'],
  abs: ['abdominals'],
  serratus: ['serratus'],
  iliopsoas: ['hip-flexors'],
  infraspinatus: ['rotator-cuff'],
  'erector spinae': ['lower-back'],
  'spinal erectors': ['lower-back'],
  'gluteus maximus': ['glute-max'],
  'glute med': ['glute-med'],
  'gluteus medius': ['glute-med'],
  quadriceps: ['quads'],
  'vastus lateralis': ['outer-quad'],
  'vastus medialis': ['inner-quad'],
  'biceps femoris': ['outer-hamstring'],
  gastrocs: ['gastrocnemius'],
  'tibialis anterior': ['tibialis'],
  shins: ['tibialis'],
  'forearm flexors': ['wrist-flexors'],
  'forearm extensors': ['wrist-extensors'],
};

/**
 * Exercise-name rules that narrow a whole group to the parts the exercise
 * mostly works, e.g. an incline press in "Chest" works the upper chest. The
 * first matching rule for a group wins; a group with no match keeps all its parts.
 */
const RULES: readonly { muscle: MuscleId; name: RegExp; parts: readonly PartId[] }[] = [
  // Push-ups are the other way round: hands raised (incline) works the lower chest.
  { muscle: 'chest', name: /incline push/i, parts: ['lower-chest'] },
  { muscle: 'chest', name: /decline push|feet elevated/i, parts: ['upper-chest'] },
  { muscle: 'chest', name: /incline|low cable cross|low.to.high/i, parts: ['upper-chest'] },
  { muscle: 'chest', name: /decline|\bdips?\b/i, parts: ['lower-chest'] },
  {
    muscle: 'shoulders',
    name: /rear|reverse.*fl(y|ye|ies)|back fly|pull.?apart|face pull|row to neck|bent.?over.*(raise|fly|lateral)/i,
    parts: ['rear-delts'],
  },
  { muscle: 'shoulders', name: /external rotation|internal rotation|cuban press/i, parts: ['rotator-cuff'] },
  {
    muscle: 'shoulders',
    name: /laterals? to front|scaption|alternating deltoid/i,
    parts: ['front-delts', 'side-delts'],
  },
  { muscle: 'shoulders', name: /lateral|side raise|upright.*row|high pull/i, parts: ['side-delts'] },
  { muscle: 'shoulders', name: /front.*raise|front delt/i, parts: ['front-delts'] },
  { muscle: 'shoulders', name: /press|arnold|handstand push/i, parts: ['front-delts', 'side-delts'] },
  { muscle: 'traps', name: /shrug|upright.*row|high pull/i, parts: ['upper-traps'] },
  { muscle: 'biceps', name: /hammer|reverse.*curl|zottman/i, parts: ['brachialis', 'brachioradialis'] },
  {
    muscle: 'biceps',
    name: /preacher|concentration|spider|scott|prone|over incline|high bench/i,
    parts: ['biceps-short'],
  },
  { muscle: 'biceps', name: /incline.*curl|drag curl/i, parts: ['biceps-long'] },
  {
    muscle: 'triceps',
    name: /push.?down|press.?down|kickback|bent.?over.*extension/i,
    parts: ['triceps-lateral', 'triceps-medial'],
  },
  {
    muscle: 'triceps',
    name: /overhead|french|skull|lying.*(extension|press)|tate press|triceps press|standing.*triceps extension|incline.*triceps extension|decline.*triceps extension/i,
    parts: ['triceps-long'],
  },
  { muscle: 'forearms', name: /reverse.*wrist|wrist extension|palms?.down.*wrist/i, parts: ['wrist-extensors'] },
  { muscle: 'forearms', name: /wrist curl|wrist flexion|finger curl/i, parts: ['wrist-flexors'] },
  { muscle: 'forearms', name: /reverse curl|hammer/i, parts: ['brachioradialis'] },
  {
    muscle: 'abdominals',
    name: /twist|side bend|oblique|russian|wood.?chop|side plank|windshield|cross.?body crunch|side bridge|side jackknife|180|spell caster/i,
    parts: ['external-obliques'],
  },
  {
    muscle: 'abdominals',
    name: /leg raise|knee.*raise|hip raise|reverse crunch|leg lift|flutter|scissor|knee tuck|leg tuck|pull.?in|pike|toes.to.bar/i,
    parts: ['lower-abs', 'hip-flexors'],
  },
  { muscle: 'abdominals', name: /crunch|sit.?up/i, parts: ['upper-abs'] },
  {
    muscle: 'glutes',
    name: /abduct|clam|band walk|side.?lying.*leg|fire hydrant|lateral walk|side step/i,
    parts: ['glute-med'],
  },
  { muscle: 'glutes', name: /thrust|bridge|kickback|pull.?through|hip extension/i, parts: ['glute-max'] },
  { muscle: 'quads', name: /leg extension|sissy/i, parts: ['rectus-femoris'] },
  { muscle: 'calves', name: /seated|soleus/i, parts: ['soleus'] },
  { muscle: 'calves', name: /posterior tibialis/i, parts: ['soleus'] },
  { muscle: 'calves', name: /tibialis|toe raise|dorsi|reverse calf/i, parts: ['tibialis'] },
  { muscle: 'calves', name: /calf raise|calf press|donkey|standing calf|gastrocnemius/i, parts: ['gastrocnemius'] },
  // Anything else for the calves (stretches, rolling) is the back of the leg, not the shin.
  { muscle: 'calves', name: /./, parts: ['gastrocnemius', 'soleus'] },
];

const ORDER = new Map(PARTS.map((p, i) => [p.id, i]));

/**
 * The muscles an exercise targets, in body-map order. `group` is its free-text
 * muscle group: several names can be combined with commas, "&" or "and"
 * ("Calves, Hamstrings"), and naming a part ("Upper chest") picks just that
 * part. A whole group is narrowed by the exercise `name` where it gives the
 * part away (see RULES). Unknown names (e.g. "Cardio") contribute nothing.
 */
export function musclesFor(group: string | null | undefined, name?: string | null): PartId[] {
  if (!group) return [];
  const found = new Set<PartId>();
  for (const text of group.toLowerCase().split(/\s*(?:,|&|\band\b|\/)\s*/)) {
    for (const id of NAMES[text.trim().replace(/\s+/g, ' ')] ?? []) {
      const rule = name && isMuscleId(id) ? RULES.find((r) => r.muscle === id && r.name.test(name)) : undefined;
      for (const part of rule?.parts ?? partsOf(id)) found.add(part);
    }
  }
  return [...found].sort((a, b) => ORDER.get(a)! - ORDER.get(b)!);
}

/** The side of the body that shows most of these muscles (front on a tie). */
export function sideFor(ids: readonly PartId[]): 'front' | 'back' {
  const back = ids.filter((id) => PART.get(id)!.side === 'back').length;
  return back > ids.length - back ? 'back' : 'front';
}

/** These muscles with every complete group collapsed to the group, e.g. all three heads → "triceps". */
export function summarize(ids: readonly PartId[]): (MuscleId | PartId)[] {
  return MUSCLES.flatMap((m) => {
    const parts = partsOf(m.id).filter((p) => ids.includes(p));
    return parts.length === partsOf(m.id).length ? [m.id] : parts;
  });
}
