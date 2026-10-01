import { router } from 'expo-router';

import { AttendanceGrid } from '@/components/attendance-grid';
import { TodayPlanCard } from '@/components/today-plan-card';
import { WorkoutSummaryRow } from '@/components/workout-summary-row';
import { ThemedText } from '@/components/themed-text';
import { Button, Card, EmptyState, Screen, SectionTitle } from '@/components/ui';
import { db } from '@/db/client';
import { listWorkoutSummaries, startPlannedSession, startSession } from '@/data/workouts';
import { useDbQuery } from '@/hooks/use-db-query';
import type { Weekday } from '@/lib/days';
import { formatTime } from '@/lib/time';

export default function WorkoutTab() {
  const summaries = useDbQuery(listWorkoutSummaries);
  const active = summaries.find((s) => s.endedAt === null);
  const recent = summaries.filter((s) => s.endedAt !== null).slice(0, 5);

  const startBlank = () => {
    const session = startSession(db);
    router.push(`/workout/${session.id}`);
  };

  const startPlanned = (weekday: Weekday) => {
    const session = startPlannedSession(db, weekday);
    router.push(`/workout/${session.id}`);
  };

  return (
    <Screen safeTop>
      <ThemedText type="subtitle">Gym Tracker</ThemedText>

      <AttendanceGrid />

      {active ? (
        <Card>
          <ThemedText style={{ fontWeight: 600 }}>Workout in progress</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            Started {formatTime(active.startedAt)} · {active.exerciseNames.length} exercises ·{' '}
            {active.setCount} sets
          </ThemedText>
          <Button
            title="Resume workout"
            variant="primary"
            size="large"
            onPress={() => router.push(`/workout/${active.id}`)}
          />
        </Card>
      ) : (
        <TodayPlanCard onStartPlanned={startPlanned} onStartBlank={startBlank} />
      )}

      <SectionTitle>Recent workouts</SectionTitle>
      {recent.length === 0 ? (
        <EmptyState title="No workouts yet" message="Finished workouts will show up here." />
      ) : (
        recent.map((s) => <WorkoutSummaryRow key={s.id} summary={s} />)
      )}
    </Screen>
  );
}
