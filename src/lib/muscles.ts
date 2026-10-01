/** Muscle groups an exercise can be tagged with, stored in `exercise.category`. */
export const MUSCLE_GROUPS = [
  'Chest',
  'Back',
  'Shoulders',
  'Arms',
  'Legs',
  'Core',
  'Cardio',
  'Full body',
] as const;

export type MuscleGroup = (typeof MUSCLE_GROUPS)[number];

export function isMuscleGroup(value: unknown): value is MuscleGroup {
  return (MUSCLE_GROUPS as readonly unknown[]).includes(value);
}
