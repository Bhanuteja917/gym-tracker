/** Short, human descriptions of queued or conflicting changes, for the sync panel. */
import type { Entity } from '@/lib/sync-protocol';
import { formatSet, isWeightUnit } from '@/lib/units';

type Data = Record<string, unknown> | null | undefined;

export function describeChange(entity: Entity, data: Data): string {
  switch (entity) {
    case 'set':
      if (data && isWeightUnit(data.unit)) {
        return `Set: ${formatSet(data as unknown as Parameters<typeof formatSet>[0])}`;
      }
      return 'A set';
    case 'workout': {
      const started = typeof data?.startedAt === 'string' ? new Date(data.startedAt) : null;
      return started ? `Workout on ${started.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}` : 'A workout';
    }
    case 'workoutExercise':
      return 'An exercise in a workout';
    case 'exercise':
      return typeof data?.name === 'string' ? `Exercise “${data.name}”` : 'An exercise';
    case 'settings':
      return 'Default unit';
  }
}
