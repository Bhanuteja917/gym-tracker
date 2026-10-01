import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Alert, Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Button, EmptyState, Screen, SectionTitle, TextField } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { db } from '@/db/client';
import {
  clearPlanDay,
  getPlanDay,
  movePlanExercise,
  setPlanDayName,
  type PlannedExercise,
} from '@/data/plan';
import { useDbQuery } from '@/hooks/use-db-query';
import { useTheme } from '@/hooks/use-theme';
import { isWeekday, WEEKDAY_NAMES, type Weekday } from '@/lib/days';
import { formatTargets } from '@/lib/targets';

export default function PlanDayScreen() {
  const weekday = Number(useLocalSearchParams<{ weekday: string }>().weekday);
  if (!isWeekday(weekday)) {
    return (
      <Screen>
        <EmptyState title="Day not found" />
      </Screen>
    );
  }
  return <PlanDayEditor weekday={weekday} />;
}

function PlanDayEditor({ weekday }: { weekday: Weekday }) {
  const day = useDbQuery((d) => getPlanDay(d, weekday));
  const [name, setName] = useState(day.name ?? '');

  // Typing only touches local state; the name is saved when editing ends or the
  // screen unmounts (refs hold the latest text for the unmount path).
  const latestName = useRef(name);
  const savedName = useRef(name.trim());

  const persistName = () => {
    const trimmed = latestName.current.trim();
    if (trimmed === savedName.current) return;
    savedName.current = trimmed;
    setPlanDayName(db, weekday, trimmed);
  };
  useEffect(
    () => () => {
      const trimmed = latestName.current.trim();
      if (trimmed !== savedName.current) setPlanDayName(db, weekday, trimmed);
    },
    [weekday],
  );

  const rename = (text: string) => {
    latestName.current = text;
    setName(text);
  };

  const confirmClear = () =>
    Alert.alert(`Clear ${WEEKDAY_NAMES[weekday]}?`, 'Removes its name and all planned exercises.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Clear',
        style: 'destructive',
        onPress: () => {
          clearPlanDay(db, weekday);
          latestName.current = '';
          savedName.current = '';
          setName('');
        },
      },
    ]);

  return (
    <Screen automaticallyAdjustKeyboardInsets>
      <Stack.Screen options={{ title: WEEKDAY_NAMES[weekday] }} />

      <SectionTitle>Name</SectionTitle>
      <TextField
        value={name}
        onChangeText={rename}
        onEndEditing={persistName}
        placeholder="e.g. Push"
        returnKeyType="done"
        accessibilityLabel="Day name"
      />

      <SectionTitle>Exercises</SectionTitle>
      {day.exercises.length === 0 ? (
        <EmptyState title="Rest day" message="Add exercises to plan a workout for this day." />
      ) : (
        <View>
          {day.exercises.map((pe, i) => (
            <PlanExerciseRow
              key={pe.id}
              item={pe}
              isFirst={i === 0}
              isLast={i === day.exercises.length - 1}
            />
          ))}
        </View>
      )}

      <Button
        title="+ Add exercise"
        size="large"
        onPress={() => router.push({ pathname: '/add-exercise', params: { weekday } })}
      />
      {day.exercises.length > 0 || day.name !== null ? (
        <Button title="Clear day" variant="danger" onPress={confirmClear} />
      ) : null}
    </Screen>
  );
}

function PlanExerciseRow({
  item,
  isFirst,
  isLast,
}: {
  item: PlannedExercise;
  isFirst: boolean;
  isLast: boolean;
}) {
  const theme = useTheme();
  const target = formatTargets(item) ?? 'No target';
  return (
    <View style={[styles.row, { borderBottomColor: theme.border }]}>
      <Pressable
        style={({ pressed }) => [styles.flex, { opacity: pressed ? 0.6 : 1 }]}
        onPress={() => router.push(`/plan-exercise/${item.id}`)}>
        <ThemedText numberOfLines={1}>{item.exercise.name}</ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          {item.exercise.archived ? `${target} · archived` : target}
        </ThemedText>
      </Pressable>
      <Button
        title="↑"
        size="small"
        disabled={isFirst}
        accessibilityLabel={`Move ${item.exercise.name} up`}
        onPress={() => movePlanExercise(db, item.id, -1)}
      />
      <Button
        title="↓"
        size="small"
        disabled={isLast}
        accessibilityLabel={`Move ${item.exercise.name} down`}
        onPress={() => movePlanExercise(db, item.id, 1)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
});
