import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Alert, StyleSheet, View } from 'react-native';

import { ExerciseCard } from '@/components/exercise-card';
import { ThemedText } from '@/components/themed-text';
import { Button, EmptyState, Screen, TextField } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { db } from '@/db/client';
import { getDefaultUnit } from '@/data/settings';
import {
  deleteSession,
  finishSession,
  getWorkout,
  reopenSession,
  updateSessionNotes,
} from '@/data/workouts';
import { useDbQuery } from '@/hooks/use-db-query';
import { useNow } from '@/hooks/use-now';
import { formatDate, formatDuration, formatTime } from '@/lib/time';

export default function WorkoutScreen() {
  const id = Number(useLocalSearchParams<{ id: string }>().id);
  const workout = useDbQuery((d) => getWorkout(d, id));
  const defaultUnit = useDbQuery(getDefaultUnit);
  const active = workout?.endedAt === null;
  const now = useNow(1000, active);
  const [notes, setNotes] = useState(workout?.notes ?? '');

  if (!workout) {
    return (
      <Screen>
        <Stack.Screen options={{ title: 'Workout' }} />
        <EmptyState title="Workout not found" />
      </Screen>
    );
  }

  const lastSetAt = Math.max(0, ...workout.exercises.flatMap((e) => e.sets.map((s) => s.completedAt)));

  const setCount = workout.exercises.reduce((n, e) => n + e.sets.length, 0);

  const finish = () => {
    const message = setCount === 0 ? 'No sets were logged, so this workout will be discarded.' : undefined;
    Alert.alert('Finish workout?', message, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Finish',
        onPress: () => {
          finishSession(db, id);
          router.back();
        },
      },
    ]);
  };

  const confirmDelete = () => {
    Alert.alert('Delete this workout?', 'All of its sets will be deleted. This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          router.back();
          deleteSession(db, id);
        },
      },
    ]);
  };

  return (
    <Screen automaticallyAdjustKeyboardInsets>
      <Stack.Screen
        options={{
          title: formatDate(workout.startedAt),
          headerRight: active
            ? () => <Button title="Finish" variant="plain" size="small" onPress={finish} />
            : undefined,
        }}
      />

      <View style={styles.stats}>
        <ThemedText type="small" themeColor="textSecondary">
          {active
            ? `Started ${formatTime(workout.startedAt)} · ${formatDuration(now - workout.startedAt)}`
            : `${formatTime(workout.startedAt)} – ${formatTime(workout.endedAt!)} · ${formatDuration(
                workout.endedAt! - workout.startedAt,
              )}`}
        </ThemedText>
        {active && lastSetAt > 0 ? (
          <ThemedText type="small" themeColor="textSecondary">
            Since last set: {formatDuration(now - lastSetAt)}
          </ThemedText>
        ) : null}
      </View>

      {workout.exercises.length === 0 ? (
        <EmptyState title="No exercises yet" message="Add an exercise to start logging sets." />
      ) : (
        workout.exercises.map((item) => (
          <ExerciseCard key={item.id} item={item} sessionId={id} defaultUnit={defaultUnit} />
        ))
      )}

      <Button
        title="+ Add exercise"
        size="large"
        onPress={() => router.push({ pathname: '/add-exercise', params: { sessionId: id } })}
      />

      <TextField
        value={notes}
        onChangeText={setNotes}
        onEndEditing={() => updateSessionNotes(db, id, notes)}
        placeholder="Workout notes"
        multiline
        style={styles.notes}
      />

      {active ? (
        <Button title="Finish workout" variant="primary" size="large" onPress={finish} />
      ) : (
        <View style={styles.actions}>
          <Button
            title="Resume this workout"
            onPress={() => {
              if (!reopenSession(db, id)) {
                Alert.alert('Another workout is in progress', 'Finish it before resuming this one.');
              }
            }}
          />
          <Button title="Delete workout" variant="danger" onPress={confirmDelete} />
        </View>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  stats: { gap: Spacing.half },
  notes: { minHeight: 70, textAlignVertical: 'top' },
  actions: { gap: Spacing.two },
});
