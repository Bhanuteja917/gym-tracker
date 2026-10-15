/** A small Expo app backup (version 4) for tests. */
export function sampleBackup(overrides: Record<string, unknown> = {}) {
  return {
    format: 'gym-tracker-backup',
    version: 4,
    exportedAt: 1_700_000_000_000,
    settings: [{ key: 'default_unit', value: 'kg' }],
    muscleGroups: [],
    exercises: [
      { id: 1, name: 'Bench Press', category: 'Chest', videoUrl: null, archived: false, createdAt: 1 },
      { id: 2, name: 'Pull-up', category: null, videoUrl: null, archived: false, createdAt: 1 },
    ],
    sessions: [
      { id: 10, startedAt: 1_700_000_000_000, endedAt: 1_700_000_360_000, notes: null, planWeekday: null },
      { id: 11, startedAt: 1_700_100_000_000, endedAt: null, notes: 'empty', planWeekday: null },
    ],
    sessionExercises: [
      { id: 100, sessionId: 10, exerciseId: 1, position: 0, notes: null },
      { id: 101, sessionId: 10, exerciseId: 2, position: 1, notes: null },
    ],
    sets: [
      { id: 1000, sessionExerciseId: 100, position: 0, weight: 60, unit: 'kg', reps: 8, rpe: null, notes: null, completedAt: 1_700_000_100_000 },
      { id: 1001, sessionExerciseId: 100, position: 1, weight: 62.5, unit: 'kg', reps: 6, rpe: 8, notes: null, completedAt: 1_700_000_200_000 },
      { id: 1002, sessionExerciseId: 101, position: 0, weight: null, unit: 'kg', reps: 10, rpe: null, notes: null, completedAt: 1_700_000_300_000 },
    ],
    planDays: [],
    planExercises: [],
    savedFoods: [],
    foodEntries: [],
    ...overrides,
  };
}
