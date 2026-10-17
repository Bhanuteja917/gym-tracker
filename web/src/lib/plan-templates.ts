/**
 * Built-in weekly plans. Exercises are named as in the exercise library
 * (src/server/exercise-library.json); `aliases` are other common names, so an
 * exercise you already log under another name is reused, history and all.
 * Templates are data only: applying one is `applyPlanTemplate` in src/local/mutations.ts.
 */
import type { TemplateDay, TemplateExercise, Weekday } from './plan';

export type PlanTemplate = {
  id: string;
  name: string;
  description: string;
  days: Record<Weekday, TemplateDay>;
};

const ex = (name: string, muscleGroup: string, ...aliases: string[]): TemplateExercise => ({
  name,
  muscleGroup,
  aliases,
});

// Gym exercises (chest/shoulder press machines, pec fly, lat pulldown, cables,
// dumbbells, leg extension and curl, a Smith/squat machine).
const G = {
  chestPress: ex('Machine Bench Press', 'Chest', 'Machine Chest Press', 'Chest Press'),
  inclinePress: ex(
    'Barbell Incline Bench Press - Medium Grip',
    'Chest',
    'Smith Machine Incline Bench Press',
    'Incline Bench Press',
    'Incline Dumbbell Press',
  ),
  fly: ex('Pec Deck (Butterfly)', 'Chest', 'Butterfly', 'Chest Fly', 'Pec Deck', 'Machine Fly'),
  row: ex('Seated Cable Rows', 'Traps (mid-back)', 'Seated Cable Row'),
  oneArmRow: ex('One-Arm Dumbbell Row', 'Traps (mid-back)', 'Dumbbell Row'),
  pulldown: ex('Wide-Grip Lat Pulldown', 'Lats', 'Lat Pulldown'),
  closePulldown: ex('Close-Grip Front Lat Pulldown', 'Lats', 'Close-Grip Lat Pulldown'),
  straightArm: ex('Straight-Arm Pulldown', 'Lats', 'Cable Rod Pulldown'),
  ohp: ex('Standing Military Press', 'Shoulders', 'Barbell overhead shoulder press', 'Overhead Press'),
  machinePress: ex('Machine Shoulder (Military) Press', 'Shoulders', 'Machine Shoulder Press'),
  lateral: ex('Side Lateral Raise', 'Shoulders', 'Lateral Raise', 'Dumbbell Lateral Raise'),
  rearFly: ex('Reverse Machine Flyes', 'Shoulders', 'Reverse Pec Deck', 'Rear Delt Fly'),
  facePull: ex('Face Pull', 'Shoulders'),
  curl: ex('Barbell Curl', 'Biceps'),
  inclineCurl: ex('Incline Dumbbell Curl', 'Biceps', 'Dumbbell Curl'),
  hammer: ex('Hammer Curls', 'Biceps', 'Hammer Curl'),
  pushdown: ex('Triceps Pushdown', 'Triceps', 'Tricep Rod Pushdown', 'Tricep Pushdown'),
  overheadExt: ex('Triceps Overhead Extension with Rope', 'Triceps', 'Overhead Cable Triceps Extension'),
  dips: ex('Dips - Triceps Version', 'Triceps', 'Tricep Dips', 'Dips'),
  squat: ex('Smith Machine Squat', 'Quads', 'Squat Machine', 'Hack Squat'),
  rdl: ex('Romanian Deadlift', 'Hamstrings', 'RDL', 'Dumbbell Romanian Deadlift'),
  splitSquat: ex('Smith Single-Leg Split Squat', 'Quads', 'Split Squat with Dumbbells', 'Bulgarian Split Squat'),
  hipThrust: ex('Barbell Hip Thrust', 'Glutes', 'Hip Thrust'),
  legExt: ex('Leg Extensions', 'Quads', 'Leg Extension'),
  legCurl: ex('Lying Leg Curls', 'Hamstrings', 'Leg Curl', 'Seated Leg Curl'),
  calf: ex('Smith Machine Calf Raise', 'Calves', 'Calf Raise', 'Standing Dumbbell Calf Raise'),
  cableCrunch: ex('Cable Crunch', 'Abdominals'),
  legRaise: ex('Hanging Leg Raise', 'Abdominals', 'Reverse Crunch'),
};

// No equipment: a backpack with books or bottles, a chair, a table, a step, a towel.
const H = {
  pushup: ex('Push-Ups', 'Chest', 'Pushups', 'Push-Up'),
  decline: ex('Decline Push-Up', 'Chest', 'Push-Ups With Feet Elevated'),
  closePushup: ex('Push-Ups - Close Triceps Position', 'Triceps', 'Diamond Push-Up'),
  pike: ex('Pike Push-Up', 'Shoulders'),
  invertedRow: ex('Inverted Row', 'Traps (mid-back)', 'Table Row'),
  doorRow: ex('Bodyweight Mid Row', 'Traps (mid-back)', 'Door Frame Row'),
  ytw: ex('Prone Y-T-W Raise', 'Shoulders'),
  lateral: G.lateral,
  backpackCurl: ex('Backpack Curl', 'Biceps'),
  bodyTricep: ex('Body Triceps Press', 'Triceps', 'Body Tricep Press'),
  benchDips: ex('Bench Dips', 'Triceps', 'Chair Dips'),
  bulgarian: ex('Bulgarian Split Squat (Bodyweight)', 'Quads'),
  singleRdl: ex('Single-Leg Romanian Deadlift (Bodyweight)', 'Hamstrings'),
  slideCurl: ex('Platform Hamstring Slides', 'Hamstrings', 'Towel Leg Curl'),
  nordic: ex('Floor Glute-Ham Raise', 'Hamstrings', 'Natural Glute Ham Raise', 'Nordic Curl'),
  stepUp: ex('Step-Up with Knee Raise', 'Glutes', 'Step-Up'),
  bridge: ex('Single Leg Glute Bridge', 'Glutes', 'Glute Bridge'),
  lunge: ex('Bodyweight Walking Lunge', 'Quads', 'Walking Lunge'),
  calf: ex('Standing Calf Raises', 'Calves', 'Single-Leg Calf Raise'),
  plank: ex('Plank', 'Abdominals'),
  reverseCrunch: ex('Reverse Crunch', 'Abdominals'),
  superman: ex('Superman', 'Lower back'),
};

const REST: TemplateDay = { title: '', items: [] };
const day = (title: string, ...items: [TemplateExercise, number, string][]): TemplateDay => ({
  title,
  items: items.map(([exercise, sets, reps]) => ({ exercise, sets, reps })),
});

/**
 * Upper / Lower / Push / Pull / Legs, every muscle twice a week at about
 * 10–14 hard sets: the evidence-based range for growth (Schoenfeld 2017,
 * Pelland 2024). Rep ranges are for double progression.
 */
const GYM_5_DAY: PlanTemplate = {
  id: 'gym-5',
  name: 'Gym · 5 days (Upper/Lower + Push/Pull/Legs)',
  description: 'Mon Upper · Tue Lower · Thu Push · Fri Pull · Sat Legs. About 60–75 min, each muscle twice a week.',
  days: {
    mon: day(
      'Upper',
      [G.chestPress, 3, '6–10'],
      [G.row, 3, '8–12'],
      [G.ohp, 2, '6–10'],
      [G.pulldown, 3, '8–12'],
      [G.lateral, 3, '12–20'],
      [G.curl, 2, '8–12'],
      [G.pushdown, 2, '10–15'],
    ),
    tue: day(
      'Lower · Squat',
      [G.squat, 3, '6–10'],
      [G.rdl, 3, '8–10'],
      [G.legExt, 3, '10–15'],
      [G.legCurl, 3, '10–15'],
      [G.calf, 3, '8–12'],
      [G.cableCrunch, 2, '10–15'],
    ),
    wed: REST,
    thu: day(
      'Push',
      [G.inclinePress, 3, '6–10'],
      [G.machinePress, 3, '8–12'],
      [G.fly, 3, '10–15'],
      [G.lateral, 4, '12–20'],
      [G.overheadExt, 3, '10–15'],
      [G.dips, 2, '6–12'],
    ),
    fri: day(
      'Pull',
      [G.closePulldown, 3, '8–12'],
      [G.oneArmRow, 3, '8–12'],
      [G.straightArm, 2, '12–15'],
      [G.rearFly, 3, '12–20'],
      [G.facePull, 2, '12–20'],
      [G.inclineCurl, 3, '8–12'],
      [G.hammer, 2, '10–15'],
    ),
    sat: day(
      'Legs · Hinge',
      [G.legCurl, 3, '8–12'],
      [G.splitSquat, 3, '8–12'],
      [G.hipThrust, 3, '8–12'],
      [G.legExt, 3, '12–15'],
      [G.calf, 3, '10–15'],
      [G.legRaise, 2, '8–15'],
    ),
    sun: REST,
  },
};

/** The same week with no equipment. Take every set close to failure (0–2 reps left). */
const HOME_5_DAY: PlanTemplate = {
  id: 'home-5',
  name: 'Home · 5 days, no equipment',
  description:
    'Same days as the gym plan, for trips home. Use a loaded backpack, a chair and a table; go close to failure.',
  days: {
    mon: day(
      'Upper · Home',
      [H.pushup, 4, '8–25'],
      [H.invertedRow, 4, '8–20'],
      [H.pike, 3, '6–15'],
      [H.lateral, 3, '15–30'],
      [H.backpackCurl, 3, '10–20'],
      [H.bodyTricep, 3, '8–15'],
    ),
    tue: day(
      'Lower · Home',
      [H.bulgarian, 4, '8–20'],
      [H.singleRdl, 3, '8–15'],
      [H.slideCurl, 3, '6–15'],
      [H.calf, 4, '10–20'],
      [H.plank, 2, '30–60 s'],
    ),
    wed: REST,
    thu: day(
      'Push · Home',
      [H.decline, 4, '6–20'],
      [H.pike, 3, '3–12'],
      [H.closePushup, 3, '8–20'],
      [H.lateral, 4, '15–30'],
      [H.benchDips, 3, '10–20'],
    ),
    fri: day(
      'Pull · Home',
      [H.invertedRow, 4, '8–20'],
      [H.doorRow, 3, '8–15'],
      [H.ytw, 3, '10–15'],
      [H.superman, 2, '12–15'],
      [H.backpackCurl, 3, '10–20'],
    ),
    sat: day(
      'Legs · Home',
      [H.nordic, 3, '3–8'],
      [H.stepUp, 3, '10–15'],
      [H.bridge, 3, '10–20'],
      [H.lunge, 2, '12–20'],
      [H.calf, 3, '10–20'],
      [H.reverseCrunch, 2, '10–20'],
    ),
    sun: REST,
  },
};

export const PLAN_TEMPLATES: readonly PlanTemplate[] = [GYM_5_DAY, HOME_5_DAY];
