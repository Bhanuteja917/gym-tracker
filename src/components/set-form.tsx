import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Button, Segmented, TextField } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import type { SetInput } from '@/data/workouts';
import { WEIGHT_UNITS, type WeightUnit } from '@/db/schema';
import { parseReps, parseRpe, parseWeight } from '@/lib/units';

const UNIT_OPTIONS = WEIGHT_UNITS.map((u) => ({ value: u, label: u }));

export type SetFormValues = {
  weight: number | null;
  unit: WeightUnit;
  reps: number | null;
  rpe?: number | null;
  notes?: string | null;
};

function validate(weight: string, reps: string, rpe: string): SetInput | string {
  const w = parseWeight(weight);
  if (!w.ok) return w.error;
  const r = parseReps(reps);
  if (!r.ok) return r.error;
  const p = parseRpe(rpe);
  if (!p.ok) return p.error;
  return { weight: w.value, unit: 'lb', reps: r.value, rpe: p.value };
}

/**
 * Weight / unit / reps inputs with optional RPE and notes behind "More".
 * After submitting, weight, unit and reps stay filled in, so the next set is
 * pre-filled with the one just done.
 */
export function SetForm({
  initial,
  submitLabel,
  onSubmit,
}: {
  initial: SetFormValues;
  submitLabel: string;
  onSubmit: (input: SetInput) => void;
}) {
  const [weight, setWeight] = useState(initial.weight === null ? '' : String(initial.weight));
  const [unit, setUnit] = useState<WeightUnit>(initial.unit);
  const [reps, setReps] = useState(initial.reps === null ? '' : String(initial.reps));
  const [rpe, setRpe] = useState(initial.rpe == null ? '' : String(initial.rpe));
  const [notes, setNotes] = useState(initial.notes ?? '');
  const [showMore, setShowMore] = useState(initial.rpe != null || !!initial.notes);
  const [error, setError] = useState<string | null>(null);

  const submit = () => {
    const result = validate(weight, reps, rpe);
    if (typeof result === 'string') {
      setError(result);
      return;
    }
    setError(null);
    onSubmit({ ...result, unit, notes });
    // RPE and notes are per-set; weight, unit and reps carry over.
    setRpe('');
    setNotes('');
  };

  return (
    <View style={styles.container}>
      <View style={styles.row}>
        <TextField
          value={weight}
          onChangeText={setWeight}
          placeholder="Weight"
          keyboardType="decimal-pad"
          accessibilityLabel="Weight"
          selectTextOnFocus
          style={styles.weight}
        />
        <Segmented options={UNIT_OPTIONS} value={unit} onChange={setUnit} />
        <ThemedText themeColor="textSecondary">×</ThemedText>
        <TextField
          value={reps}
          onChangeText={setReps}
          placeholder="Reps"
          keyboardType="number-pad"
          accessibilityLabel="Reps"
          selectTextOnFocus
          style={styles.reps}
        />
      </View>

      {showMore ? (
        <View style={styles.row}>
          <TextField
            value={rpe}
            onChangeText={setRpe}
            placeholder="RPE"
            keyboardType="decimal-pad"
            accessibilityLabel="RPE"
            style={styles.rpe}
          />
          <TextField
            value={notes}
            onChangeText={setNotes}
            placeholder="Notes"
            accessibilityLabel="Notes"
            style={styles.notes}
          />
        </View>
      ) : null}

      {error ? (
        <ThemedText type="small" themeColor="danger">
          {error}
        </ThemedText>
      ) : null}

      <View style={styles.row}>
        {!showMore ? (
          <Button title="More" variant="plain" size="small" onPress={() => setShowMore(true)} />
        ) : null}
        <Button title={submitLabel} variant="primary" onPress={submit} style={styles.submit} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: Spacing.two },
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  weight: { flex: 1, minWidth: 70 },
  reps: { width: 70 },
  rpe: { width: 70 },
  notes: { flex: 1 },
  submit: { flex: 1 },
});
