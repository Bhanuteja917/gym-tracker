import { router } from 'expo-router';
import { Alert, Pressable, StyleSheet, View } from 'react-native';

import { SetForm, type SetFormValues } from '@/components/set-form';
import { ThemedText } from '@/components/themed-text';
import { Button, Card } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { db } from '@/db/client';
import type { WeightUnit } from '@/db/schema';
import { getLastPerformance } from '@/data/history';
import { logSet, removeSessionExercise, suggestedSetValues, type WorkoutExercise } from '@/data/workouts';
import { useDbQuery } from '@/hooks/use-db-query';
import { useTheme } from '@/hooks/use-theme';
import { formatTargets } from '@/lib/targets';
import { formatDuration, restTimes } from '@/lib/time';
import { formatWeight } from '@/lib/units';

export function formatSet(set: { weight: number | null; unit: WeightUnit; reps: number }): string {
  return `${formatWeight(set.weight, set.unit)} × ${set.reps}`;
}

export function ExerciseCard({
  item,
  sessionId,
  defaultUnit,
}: {
  item: WorkoutExercise;
  sessionId: number;
  defaultUnit: WeightUnit;
}) {
  const theme = useTheme();
  const last = useDbQuery((d) => getLastPerformance(d, item.exerciseId, sessionId));
  const rests = restTimes(item.sets.map((s) => s.completedAt));

  // Last set here, else the planned targets, else last time (see suggestedSetValues).
  const suggested = useDbQuery((d) => suggestedSetValues(d, item.id));
  const initial: SetFormValues = suggested ?? { weight: null, unit: defaultUnit, reps: null };
  const target = formatTargets(item);

  const confirmRemove = () => {
    const doRemove = () => removeSessionExercise(db, item.id);
    if (item.sets.length === 0) return doRemove();
    Alert.alert(
      `Remove ${item.exercise.name}?`,
      `This deletes ${item.sets.length} logged set${item.sets.length === 1 ? '' : 's'}.`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Remove', style: 'destructive', onPress: doRemove },
      ],
    );
  };

  return (
    <Card>
      <View style={styles.header}>
        <Pressable style={styles.flex} onPress={() => router.push(`/exercise/${item.exerciseId}`)}>
          <ThemedText style={styles.title}>{item.exercise.name}</ThemedText>
        </Pressable>
        <Button title="Remove" variant="danger" size="small" onPress={confirmRemove} />
      </View>

      {target ? (
        <ThemedText type="small" style={styles.target}>
          Target {target}
          {item.targetSets !== null ? `  ·  ${item.sets.length}/${item.targetSets} sets` : ''}
        </ThemedText>
      ) : null}

      {last ? (
        <ThemedText type="small" themeColor="textSecondary">
          Last time: {last.sets.map(formatSet).join(', ')}
        </ThemedText>
      ) : null}

      {item.sets.map((set, i) => (
        <Pressable
          key={set.id}
          onPress={() => router.push(`/set/${set.id}`)}
          style={({ pressed }) => [
            styles.setRow,
            { borderBottomColor: theme.border, opacity: pressed ? 0.6 : 1 },
          ]}>
          <ThemedText themeColor="textSecondary" style={styles.setNumber}>
            {i + 1}
          </ThemedText>
          <View style={styles.flex}>
            <ThemedText>
              {formatSet(set)}
              {set.rpe !== null ? (
                <ThemedText type="small" themeColor="textSecondary">
                  {'  '}@{set.rpe}
                </ThemedText>
              ) : null}
            </ThemedText>
            {set.notes ? (
              <ThemedText type="small" themeColor="textSecondary">
                {set.notes}
              </ThemedText>
            ) : null}
          </View>
          {rests[i] !== null ? (
            <ThemedText type="small" themeColor="textSecondary">
              rest {formatDuration(rests[i]!)}
            </ThemedText>
          ) : null}
        </Pressable>
      ))}

      <SetForm
        // Re-mount when the logged set count or the suggested values change, never on typing.
        key={`${item.id}:${item.sets.length}:${initial.weight}:${initial.unit}:${initial.reps}`}
        initial={initial}
        submitLabel={`Log set ${item.sets.length + 1}`}
        onSubmit={(input) => logSet(db, item.id, input)}
      />
    </Card>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  title: { fontSize: 18, fontWeight: 700 },
  setRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  target: { fontWeight: 600 },
  setNumber: { width: 20, fontWeight: 700 },
});
