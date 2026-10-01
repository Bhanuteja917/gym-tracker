import { relations, sql } from 'drizzle-orm';
import { index, integer, real, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core';

export const WEIGHT_UNITS = ['lb', 'kg'] as const;
export type WeightUnit = (typeof WEIGHT_UNITS)[number];

// All timestamps are epoch milliseconds.

export const settings = sqliteTable('settings', {
  key: text('key').primaryKey(),
  value: text('value').notNull(),
});

export const exercises = sqliteTable(
  'exercise',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    name: text('name').notNull(),
    category: text('category'),
    archived: integer('archived', { mode: 'boolean' }).notNull().default(false),
    createdAt: integer('created_at').notNull(),
  },
  (t) => [uniqueIndex('exercise_name_unique').on(sql`lower(${t.name})`)],
);

export const sessions = sqliteTable(
  'session',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    startedAt: integer('started_at').notNull(),
    endedAt: integer('ended_at'),
    notes: text('notes'),
    /** The weekly-plan day this workout was started from; null for a blank workout. */
    planWeekday: integer('plan_weekday'),
  },
  (t) => [index('session_started_at_idx').on(t.startedAt)],
);

/** An exercise performed within a session, in the order it was added. */
export const sessionExercises = sqliteTable(
  'session_exercise',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    sessionId: integer('session_id')
      .notNull()
      .references(() => sessions.id, { onDelete: 'cascade' }),
    exerciseId: integer('exercise_id')
      .notNull()
      .references(() => exercises.id, { onDelete: 'restrict' }),
    position: integer('position').notNull(),
    notes: text('notes'),
    // Targets copied from the weekly plan when the workout started, so later
    // plan edits don't rewrite history. All null for unplanned exercises.
    targetSets: integer('target_sets'),
    targetReps: integer('target_reps'),
    targetWeight: real('target_weight'),
    targetUnit: text('target_unit', { enum: WEIGHT_UNITS }),
  },
  (t) => [
    index('session_exercise_session_idx').on(t.sessionId),
    index('session_exercise_exercise_idx').on(t.exerciseId),
  ],
);

/**
 * One logged set. Weight is stored exactly as entered, together with its unit,
 * so values never drift through conversion. A null weight is a bodyweight set.
 */
export const setEntries = sqliteTable(
  'set_entry',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    sessionExerciseId: integer('session_exercise_id')
      .notNull()
      .references(() => sessionExercises.id, { onDelete: 'cascade' }),
    position: integer('position').notNull(),
    weight: real('weight'),
    unit: text('unit', { enum: WEIGHT_UNITS }).notNull(),
    reps: integer('reps').notNull(),
    rpe: real('rpe'),
    notes: text('notes'),
    completedAt: integer('completed_at').notNull(),
  },
  (t) => [index('set_entry_session_exercise_idx').on(t.sessionExerciseId)],
);

/** A muscle group exercises can be tagged with; exercises store its name in `category`. */
export const muscleGroups = sqliteTable(
  'muscle_group',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    name: text('name').notNull(),
    position: integer('position').notNull(),
  },
  (t) => [uniqueIndex('muscle_group_name_unique').on(sql`lower(${t.name})`)],
);

/** A day of the repeating weekly plan. Monday = 1 … Sunday = 7. A day with no exercises is a rest day. */
export const planDays = sqliteTable('plan_day', {
  weekday: integer('weekday').primaryKey(),
  name: text('name'),
});

/** A planned exercise on a weekly-plan day, with optional targets. */
export const planExercises = sqliteTable(
  'plan_exercise',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    weekday: integer('weekday')
      .notNull()
      .references(() => planDays.weekday, { onDelete: 'cascade' }),
    exerciseId: integer('exercise_id')
      .notNull()
      .references(() => exercises.id, { onDelete: 'cascade' }),
    position: integer('position').notNull(),
    targetSets: integer('target_sets'),
    targetReps: integer('target_reps'),
    targetWeight: real('target_weight'),
    targetUnit: text('target_unit', { enum: WEIGHT_UNITS }).notNull(),
  },
  (t) => [index('plan_exercise_weekday_idx').on(t.weekday)],
);

/** One food log entry. `day` is a local `YYYY-MM-DD` date. */
export const foodEntries = sqliteTable(
  'food_entry',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    day: text('day').notNull(),
    loggedAt: integer('logged_at').notNull(),
    name: text('name').notNull(),
    calories: integer('calories').notNull(),
    protein: real('protein'),
    carbs: real('carbs'),
    fat: real('fat'),
  },
  (t) => [index('food_entry_day_idx').on(t.day)],
);

/** A reusable food. Logging one copies its values into a food entry. */
export const savedFoods = sqliteTable(
  'saved_food',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    name: text('name').notNull(),
    calories: integer('calories').notNull(),
    protein: real('protein'),
    carbs: real('carbs'),
    fat: real('fat'),
  },
  (t) => [uniqueIndex('saved_food_name_unique').on(sql`lower(${t.name})`)],
);

export const sessionsRelations = relations(sessions, ({ many }) => ({
  exercises: many(sessionExercises),
}));

export const exercisesRelations = relations(exercises, ({ many }) => ({
  sessionExercises: many(sessionExercises),
}));

export const sessionExercisesRelations = relations(sessionExercises, ({ one, many }) => ({
  session: one(sessions, { fields: [sessionExercises.sessionId], references: [sessions.id] }),
  exercise: one(exercises, { fields: [sessionExercises.exerciseId], references: [exercises.id] }),
  sets: many(setEntries),
}));

export const setEntriesRelations = relations(setEntries, ({ one }) => ({
  sessionExercise: one(sessionExercises, {
    fields: [setEntries.sessionExerciseId],
    references: [sessionExercises.id],
  }),
}));

export const planDaysRelations = relations(planDays, ({ many }) => ({
  exercises: many(planExercises),
}));

export const planExercisesRelations = relations(planExercises, ({ one }) => ({
  day: one(planDays, { fields: [planExercises.weekday], references: [planDays.weekday] }),
  exercise: one(exercises, { fields: [planExercises.exerciseId], references: [exercises.id] }),
}));

export type Exercise = typeof exercises.$inferSelect;
export type Session = typeof sessions.$inferSelect;
export type SessionExercise = typeof sessionExercises.$inferSelect;
export type SetEntry = typeof setEntries.$inferSelect;
export type PlanDayRow = typeof planDays.$inferSelect;
export type PlanExercise = typeof planExercises.$inferSelect;
export type FoodEntry = typeof foodEntries.$inferSelect;
export type SavedFood = typeof savedFoods.$inferSelect;
export type MuscleGroup = typeof muscleGroups.$inferSelect;
