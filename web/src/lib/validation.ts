import { z } from 'zod';

import { WEIGHT_UNITS } from './units';

/** Form fields arrive as strings; blank means "not set". */
const blankToNull = (v: unknown) => (typeof v === 'string' && v.trim() === '' ? null : v);
const decimal = (v: unknown) => (typeof v === 'string' ? v.trim().replace(',', '.') : v);

export const idSchema = z.string().min(1).max(64);
export const unitSchema = z.enum(WEIGHT_UNITS);

export const setInputSchema = z.object({
  weight: z.preprocess(
    (v) => decimal(blankToNull(v)),
    z.coerce
      .number({ error: 'Weight must be a number' })
      .min(0, 'Weight can’t be negative')
      .max(2000, 'Weight looks too large')
      .nullable(),
  ),
  unit: unitSchema,
  reps: z.coerce
    .number({ error: 'Reps must be a whole number' })
    .int('Reps must be a whole number')
    .min(1, 'Reps must be at least 1')
    .max(1000, 'Reps looks too large'),
  rpe: z.preprocess(
    (v) => decimal(blankToNull(v)),
    z.coerce
      .number({ error: 'RPE must be a number' })
      .min(1, 'RPE must be 1–10')
      .max(10, 'RPE must be 1–10')
      .refine((n) => (n * 2) % 1 === 0, 'RPE must be in half steps')
      .nullable(),
  ),
  notes: z.preprocess(blankToNull, z.string().trim().max(500).nullable()),
});
export type SetInput = z.infer<typeof setInputSchema>;

export const exerciseInputSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(100, 'Name is too long'),
  muscleGroup: z.preprocess(blankToNull, z.string().trim().max(50).nullable()),
  videoUrl: z.preprocess(
    blankToNull,
    z
      .url({ protocol: /^https?$/, error: 'Enter a full http(s) link' })
      .max(500)
      .nullable(),
  ),
});
export type ExerciseInput = z.infer<typeof exerciseInputSchema>;

export const notesSchema = z.preprocess(blankToNull, z.string().trim().max(2000).nullable());

/** First error message from a failed parse, for showing next to a form. */
export function firstError(error: z.ZodError): string {
  return error.issues[0]?.message ?? 'Invalid input';
}
