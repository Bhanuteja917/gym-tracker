import { WorkoutSummaryRow } from '@/components/workout-summary-row';
import { ThemedText } from '@/components/themed-text';
import { EmptyState, Screen } from '@/components/ui';
import { listWorkoutSummaries } from '@/data/workouts';
import { useDbQuery } from '@/hooks/use-db-query';

export default function HistoryTab() {
  const summaries = useDbQuery(listWorkoutSummaries);

  return (
    <Screen safeTop>
      <ThemedText type="subtitle">History</ThemedText>
      {summaries.length === 0 ? (
        <EmptyState title="No workouts yet" message="Start a workout from the Workout tab." />
      ) : (
        summaries.map((s) => <WorkoutSummaryRow key={s.id} summary={s} />)
      )}
    </Screen>
  );
}
