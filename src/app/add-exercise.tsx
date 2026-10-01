import { router, useLocalSearchParams } from 'expo-router';

import { ExerciseList } from '@/components/exercise-list';
import { Screen } from '@/components/ui';
import { db } from '@/db/client';
import { addPlanExercise, getPlanDay } from '@/data/plan';
import { addExerciseToSession, getWorkout } from '@/data/workouts';
import { useDbQuery } from '@/hooks/use-db-query';
import { isWeekday } from '@/lib/days';

/** Picks an exercise for a workout (`sessionId`) or a weekly-plan day (`weekday`). */
export default function AddExerciseModal() {
  const params = useLocalSearchParams<{ sessionId?: string; weekday?: string }>();
  const weekdayParam = Number(params.weekday);
  const weekday = isWeekday(weekdayParam) ? weekdayParam : null;
  const sessionId = Number(params.sessionId);

  const added = useDbQuery(
    (d) =>
      new Set(
        weekday !== null
          ? getPlanDay(d, weekday).exercises.map((e) => e.exerciseId)
          : getWorkout(d, sessionId)?.exercises.map((e) => e.exerciseId),
      ),
  );

  return (
    <Screen automaticallyAdjustKeyboardInsets>
      <ExerciseList
        rightText={(e) => (added.has(e.id) ? 'Added' : undefined)}
        onSelect={(exercise) => {
          if (weekday !== null) addPlanExercise(db, weekday, exercise.id);
          else addExerciseToSession(db, sessionId, exercise.id);
          router.back();
        }}
      />
    </Screen>
  );
}
