import { router } from 'expo-router';

import { ExerciseList } from '@/components/exercise-list';
import { ThemedText } from '@/components/themed-text';
import { Screen } from '@/components/ui';

export default function ExercisesTab() {
  return (
    <Screen safeTop automaticallyAdjustKeyboardInsets>
      <ThemedText type="subtitle">Exercises</ThemedText>
      <ExerciseList onSelect={(e) => router.push(`/exercise/${e.id}`)} />
    </Screen>
  );
}
