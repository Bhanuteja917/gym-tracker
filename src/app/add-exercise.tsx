import { router, useLocalSearchParams } from 'expo-router';

import { ExerciseList } from '@/components/exercise-list';
import { Screen } from '@/components/ui';
import { db } from '@/db/client';
import { addExerciseToSession, getWorkout } from '@/data/workouts';
import { useDbQuery } from '@/hooks/use-db-query';

export default function AddExerciseModal() {
  const sessionId = Number(useLocalSearchParams<{ sessionId: string }>().sessionId);
  const inWorkout = useDbQuery(
    (d) => new Set(getWorkout(d, sessionId)?.exercises.map((e) => e.exerciseId)),
  );

  return (
    <Screen automaticallyAdjustKeyboardInsets>
      <ExerciseList
        rightText={(e) => (inWorkout.has(e.id) ? 'Added' : undefined)}
        onSelect={(exercise) => {
          addExerciseToSession(db, sessionId, exercise.id);
          router.back();
        }}
      />
    </Screen>
  );
}
