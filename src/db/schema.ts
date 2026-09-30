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

export type Exercise = typeof exercises.$inferSelect;
export type Session = typeof sessions.$inferSelect;
export type SessionExercise = typeof sessionExercises.$inferSelect;
export type SetEntry = typeof setEntries.$inferSelect;
