import { router } from 'expo-router';

import { ListRow } from '@/components/ui';
import type { WorkoutSummary } from '@/data/workouts';
import { formatDate, formatDuration } from '@/lib/time';

export function WorkoutSummaryRow({ summary }: { summary: WorkoutSummary }) {
  const names = summary.exerciseNames.join(', ') || 'No exercises';
  const right =
    summary.endedAt === null
      ? 'In progress'
      : `${summary.setCount} sets · ${formatDuration(summary.endedAt - summary.startedAt)}`;
  return (
    <ListRow
      title={formatDate(summary.startedAt)}
      subtitle={names}
      right={right}
      onPress={() => router.push(`/workout/${summary.id}`)}
    />
  );
}
