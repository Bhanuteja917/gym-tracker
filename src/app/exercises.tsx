import { router } from 'expo-router';

import { ExerciseList } from '@/components/exercise-list';
import { Screen } from '@/components/ui';

export default function ExercisesScreen() {
  return (
    <Screen automaticallyAdjustKeyboardInsets>
      <ExerciseList onSelect={(e) => router.push(`/exercise/${e.id}`)} />
    </Screen>
  );
}
