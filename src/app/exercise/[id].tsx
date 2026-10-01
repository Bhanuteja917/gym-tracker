import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Alert, StyleSheet, View } from 'react-native';

import { formatSet } from '@/components/exercise-card';
import { ThemedText } from '@/components/themed-text';
import { Button, Card, Chips, EmptyState, Screen, SectionTitle, TextField } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { db } from '@/db/client';
import {
  DuplicateExerciseError,
  getExercise,
  removeExercise,
  renameExercise,
  setExerciseArchived,
  setExerciseCategory,
  setExerciseVideoUrl,
} from '@/data/exercises';
import { bestSet, getExerciseHistory } from '@/data/history';
import { listMuscleGroups } from '@/data/muscle-groups';
import { getDefaultUnit } from '@/data/settings';
import { useDbQuery } from '@/hooks/use-db-query';
import { openVideo } from '@/lib/links';
import { formatDate } from '@/lib/time';
import { formatWeight } from '@/lib/units';

export default function ExerciseScreen() {
  const id = Number(useLocalSearchParams<{ id: string }>().id);
  const exercise = useDbQuery((d) => getExercise(d, id));
  const history = useDbQuery((d) => getExerciseHistory(d, id));
  const displayUnit = useDbQuery(getDefaultUnit);
  const groups = useDbQuery((d) => listMuscleGroups(d).map((g) => g.name));
  const [name, setName] = useState(exercise?.name ?? '');
  const [videoUrl, setVideoUrl] = useState(exercise?.videoUrl ?? '');

  if (!exercise) {
    return (
      <Screen>
        <EmptyState title="Exercise not found" />
      </Screen>
    );
  }

  const best = bestSet(history.flatMap((h) => h.sets));

  const saveName = () => {
    if (name.trim() === exercise.name) return;
    try {
      renameExercise(db, id, name);
    } catch (e) {
      Alert.alert(
        'Could not rename',
        e instanceof DuplicateExerciseError ? e.message : (e as Error).message,
      );
      setName(exercise.name);
    }
  };

  const saveVideoUrl = (text = videoUrl) => {
    if (text.trim() === (exercise.videoUrl ?? '')) return;
    try {
      setVideoUrl(setExerciseVideoUrl(db, id, text).videoUrl ?? '');
    } catch (e) {
      Alert.alert('Could not save link', (e as Error).message);
      setVideoUrl(exercise.videoUrl ?? '');
    }
  };

  const remove = () => {
    const hasHistory = history.length > 0;
    Alert.alert(
      hasHistory ? `Archive ${exercise.name}?` : `Delete ${exercise.name}?`,
      hasHistory
        ? 'It will be hidden from the exercise list. Past workouts keep it.'
        : 'It has never been used, so it will be deleted.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: hasHistory ? 'Archive' : 'Delete',
          style: 'destructive',
          onPress: () => {
            if (removeExercise(db, id) === 'deleted') router.back();
          },
        },
      ],
    );
  };

  return (
    <Screen automaticallyAdjustKeyboardInsets>
      <Stack.Screen options={{ title: exercise.name }} />

      <TextField
        value={name}
        onChangeText={setName}
        onEndEditing={saveName}
        accessibilityLabel="Exercise name"
        returnKeyType="done"
      />
      <SectionTitle>Muscle group</SectionTitle>
      <Chips
        options={groups}
        value={exercise.category}
        onChange={(category) => setExerciseCategory(db, id, category)}
      />

      <SectionTitle>Video</SectionTitle>
      <TextField
        value={videoUrl}
        onChangeText={setVideoUrl}
        onEndEditing={(e) => saveVideoUrl(e.nativeEvent.text)}
        placeholder="Paste a YouTube or web link"
        keyboardType="url"
        autoCapitalize="none"
        autoCorrect={false}
        clearButtonMode="while-editing"
        returnKeyType="done"
        accessibilityLabel="Video link"
      />
      {exercise.videoUrl ? (
        <Button title="▶ Watch video" onPress={() => openVideo(exercise.videoUrl!)} />
      ) : null}
      {exercise.archived ? (
        <Card>
          <ThemedText type="small" themeColor="textSecondary">
            This exercise is archived and hidden from the list.
          </ThemedText>
          <Button title="Unarchive" onPress={() => setExerciseArchived(db, id, false)} />
        </Card>
      ) : null}

      {best ? (
        <Card>
          <ThemedText type="small" themeColor="textSecondary">
            Best set
          </ThemedText>
          <ThemedText style={styles.best}>
            {formatWeight(best.weight, best.unit, displayUnit)} × {best.reps}
          </ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            {history.length} workout{history.length === 1 ? '' : 's'}
          </ThemedText>
        </Card>
      ) : null}

      <SectionTitle>History</SectionTitle>
      {history.length === 0 ? (
        <EmptyState title="No sets logged yet" />
      ) : (
        history.map((h) => (
          <View key={h.sessionId} style={styles.historyItem}>
            <ThemedText
              type="smallBold"
              onPress={() => router.push(`/workout/${h.sessionId}`)}>
              {formatDate(h.startedAt)}
            </ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              {h.sets.map(formatSet).join(', ')}
            </ThemedText>
          </View>
        ))
      )}

      {!exercise.archived ? (
        <Button
          title={history.length > 0 ? 'Archive exercise' : 'Delete exercise'}
          variant="danger"
          onPress={remove}
        />
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  best: { fontSize: 24, fontWeight: 700, lineHeight: 30 },
  historyItem: { gap: Spacing.half },
});
