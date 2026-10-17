/**
 * The weekly plan: for each day Monday–Sunday, a name ("Upper A") and the
 * exercises to do with a target of sets and reps. A day with no exercises is
 * a rest day. Saved with the settings, so it syncs as one record.
 */
import { z } from 'zod';

export const WEEKDAYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const;
export type Weekday = (typeof WEEKDAYS)[number];

export const WEEKDAY_LABELS: Record<Weekday, string> = {
  mon: 'Monday',
  tue: 'Tuesday',
  wed: 'Wednesday',
  thu: 'Thursday',
  fri: 'Friday',
  sat: 'Saturday',
  sun: 'Sunday',
};

export const MAX_PLAN_ITEMS = 20;

export const planItemSchema = z.object({
  exerciseId: z.string().min(1).max(64),
  sets: z.number().int().min(1).max(20),
  /** A target like "8–12", "10" or "30 s". */
  reps: z.string().trim().max(20),
});

export const planDaySchema = z.object({
  title: z.string().trim().max(40),
  items: z.array(planItemSchema).max(MAX_PLAN_ITEMS),
});

export const weeklyPlanSchema = z.object(
  Object.fromEntries(WEEKDAYS.map((d) => [d, planDaySchema])) as Record<Weekday, typeof planDaySchema>,
);

export type PlanItem = z.infer<typeof planItemSchema>;
export type PlanDay = z.infer<typeof planDaySchema>;
export type WeeklyPlan = z.infer<typeof weeklyPlanSchema>;

/** An exercise in a template, by name: matched to one the user has (by name or alias), else created. */
export type TemplateExercise = { name: string; muscleGroup: string | null; aliases?: readonly string[] };

/** A template day: exercises by name, so it works for any account. */
export type TemplateDay = {
  title: string;
  items: readonly { exercise: TemplateExercise; sets: number; reps: string }[];
};

export const EMPTY_PLAN: WeeklyPlan = Object.fromEntries(
  WEEKDAYS.map((d) => [d, { title: '', items: [] }]),
) as unknown as WeeklyPlan;

export function isWeekday(value: unknown): value is Weekday {
  return typeof value === 'string' && (WEEKDAYS as readonly string[]).includes(value);
}

/** The plan day a date falls on, in the device's time zone. */
export function weekdayOf(date: Date): Weekday {
  return WEEKDAYS[(date.getDay() + 6) % 7];
}

/** A stored plan, with any day that's missing or invalid left empty. */
export function toPlan(raw: unknown): WeeklyPlan {
  const value = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  const plan = { ...EMPTY_PLAN };
  for (const day of WEEKDAYS) {
    const parsed = planDaySchema.safeParse(value[day]);
    if (parsed.success) plan[day] = parsed.data;
  }
  return plan;
}

/** "Rest" for an empty day; otherwise the day's name, or its exercise count. */
export function dayName(day: { title: string; items: readonly unknown[] }): string {
  if (day.items.length === 0) return 'Rest';
  return day.title || `${day.items.length} exercise${day.items.length === 1 ? '' : 's'}`;
}

/** "3 × 8–12", or "3 sets" with no rep target. */
export function formatTarget(item: Pick<PlanItem, 'sets' | 'reps'>): string {
  return item.reps ? `${item.sets} × ${item.reps}` : `${item.sets} set${item.sets === 1 ? '' : 's'}`;
}

/** Hard sets per muscle group in a week, most first (exercises with no group are left out). */
export function weeklySets(
  plan: WeeklyPlan,
  groupOf: (exerciseId: string) => string | null | undefined,
): { group: string; sets: number }[] {
  const totals = new Map<string, number>();
  for (const day of WEEKDAYS) {
    for (const item of plan[day].items) {
      const group = groupOf(item.exerciseId);
      if (group) totals.set(group, (totals.get(group) ?? 0) + item.sets);
    }
  }
  return [...totals].map(([group, sets]) => ({ group, sets })).sort((a, b) => b.sets - a.sets);
}
