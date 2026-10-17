import { describe, expect, it } from 'vitest';

import { dayName, EMPTY_PLAN, formatTarget, toPlan, weekdayOf } from './plan';
import { PLAN_TEMPLATES } from './plan-templates';

describe('weekly plan', () => {
  it('maps dates to weekdays starting on Monday', () => {
    expect(weekdayOf(new Date(2026, 9, 12))).toBe('mon');
    expect(weekdayOf(new Date(2026, 9, 18, 23, 59))).toBe('sun');
  });

  it('reads a stored plan, leaving missing or invalid days empty', () => {
    expect(toPlan(null)).toEqual(EMPTY_PLAN);
    const plan = toPlan({
      mon: { title: 'Upper', items: [{ exerciseId: 'a', sets: 3, reps: '8–12' }] },
      tue: { title: 'Bad', items: [{ exerciseId: 'a', sets: 0, reps: '' }] },
    });
    expect(plan.mon.items).toHaveLength(1);
    expect(plan.tue).toEqual({ title: '', items: [] });
    expect(plan.sun).toEqual({ title: '', items: [] });
  });

  it('names days and targets', () => {
    expect(dayName({ title: 'Push', items: [] })).toBe('Rest');
    expect(dayName({ title: '', items: [1, 2] })).toBe('2 exercises');
    expect(formatTarget({ sets: 3, reps: '8–12' })).toBe('3 × 8–12');
    expect(formatTarget({ sets: 1, reps: '' })).toBe('1 set');
  });

  it('has templates that fit a plan', () => {
    for (const template of PLAN_TEMPLATES) {
      for (const day of Object.values(template.days)) {
        expect(day.items.length).toBeLessThanOrEqual(20);
        for (const item of day.items) expect(item.sets).toBeGreaterThan(0);
      }
    }
  });
});
