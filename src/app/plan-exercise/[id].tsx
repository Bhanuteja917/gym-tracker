import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Button, EmptyState, Screen, Segmented, TextField } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { db } from '@/db/client';
import { WEIGHT_UNITS, type WeightUnit } from '@/db/schema';
import {
  getPlanExercise,
  removePlanExercise,
  updatePlanTargets,
  type PlannedExercise,
} from '@/data/plan';
import { useDbQuery } from '@/hooks/use-db-query';
import { parseOptionalCount, parseWeight } from '@/lib/units';

const UNIT_OPTIONS = WEIGHT_UNITS.map((u) => ({ value: u, label: u }));
const text = (v: number | null) => (v === null ? '' : String(v));

export default function PlanExerciseModal() {
  const id = Number(useLocalSearchParams<{ id: string }>().id);
  const item = useDbQuery((d) => getPlanExercise(d, id));
  if (!item) {
    return (
      <Screen>
        <EmptyState title="Not in the plan" />
      </Screen>
    );
  }
  return <TargetsForm key={item.id} item={item} />;
}

function TargetsForm({ item }: { item: PlannedExercise }) {
  const [sets, setSets] = useState(text(item.targetSets));
  const [reps, setReps] = useState(text(item.targetReps));
  const [weight, setWeight] = useState(text(item.targetWeight));
  const [unit, setUnit] = useState<WeightUnit>(item.targetUnit);
  const [error, setError] = useState<string | null>(null);

  const save = () => {
    const s = parseOptionalCount(sets, 'Sets');
    if (!s.ok) return setError(s.error);
    const r = parseOptionalCount(reps, 'Reps');
    if (!r.ok) return setError(r.error);
    const w = parseWeight(weight);
    if (!w.ok) return setError(w.error);
    updatePlanTargets(db, item.id, {
      targetSets: s.value,
      targetReps: r.value,
      targetWeight: w.value,
      targetUnit: unit,
    });
    router.back();
  };

  const remove = () => {
    router.back();
    removePlanExercise(db, item.id);
  };

  return (
    <Screen automaticallyAdjustKeyboardInsets>
      <Stack.Screen options={{ title: item.exercise.name }} />
      <View style={styles.row}>
        <TextField
          value={sets}
          onChangeText={setSets}
          placeholder="Sets"
          keyboardType="number-pad"
          accessibilityLabel="Target sets"
          style={styles.flex}
        />
        <ThemedText themeColor="textSecondary">×</ThemedText>
        <TextField
          value={reps}
          onChangeText={setReps}
          placeholder="Reps"
          keyboardType="number-pad"
          accessibilityLabel="Target reps"
          style={styles.flex}
        />
      </View>
      <View style={styles.row}>
        <TextField
          value={weight}
          onChangeText={setWeight}
          placeholder="Weight"
          keyboardType="decimal-pad"
          accessibilityLabel="Target weight"
          style={styles.flex}
        />
        <Segmented options={UNIT_OPTIONS} value={unit} onChange={setUnit} />
      </View>
      <ThemedText type="small" themeColor="textSecondary">
        All optional. Targets pre-fill the set form when you start this day&apos;s workout.
      </ThemedText>
      {error ? (
        <ThemedText type="small" themeColor="danger">
          {error}
        </ThemedText>
      ) : null}
      <Button title="Save" variant="primary" size="large" onPress={save} />
      <Button title="Remove from day" variant="danger" onPress={remove} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
});
