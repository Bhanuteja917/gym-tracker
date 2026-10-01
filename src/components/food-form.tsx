import { useState } from 'react';
import { StyleSheet, Switch, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Button, TextField } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import type { FoodInput } from '@/data/food';
import { parseCalories, parseMacro } from '@/lib/nutrition';

const text = (v: number | null | undefined) => (v == null ? '' : String(v));

/** Name, calories (required) and optional protein/carbs/fat. */
export function FoodForm({
  initial,
  submitLabel,
  onSubmit,
  showSaveToggle = false,
}: {
  initial?: Partial<FoodInput>;
  submitLabel: string;
  onSubmit: (input: FoodInput, saveAsFood: boolean) => void;
  showSaveToggle?: boolean;
}) {
  const [name, setName] = useState(initial?.name ?? '');
  const [calories, setCalories] = useState(text(initial?.calories));
  const [protein, setProtein] = useState(text(initial?.protein));
  const [carbs, setCarbs] = useState(text(initial?.carbs));
  const [fat, setFat] = useState(text(initial?.fat));
  const [saveAsFood, setSaveAsFood] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = () => {
    if (name.trim() === '') return setError('Name is required');
    const c = parseCalories(calories);
    if (!c.ok) return setError(c.error);
    const p = parseMacro(protein, 'Protein');
    if (!p.ok) return setError(p.error);
    const cb = parseMacro(carbs, 'Carbs');
    if (!cb.ok) return setError(cb.error);
    const f = parseMacro(fat, 'Fat');
    if (!f.ok) return setError(f.error);
    setError(null);
    onSubmit(
      { name: name.trim(), calories: c.value, protein: p.value, carbs: cb.value, fat: f.value },
      saveAsFood,
    );
  };

  return (
    <View style={styles.container}>
      <TextField
        value={name}
        onChangeText={setName}
        placeholder="Name (e.g. Lunch)"
        accessibilityLabel="Food name"
        returnKeyType="next"
      />
      <View style={styles.row}>
        <TextField
          value={calories}
          onChangeText={setCalories}
          placeholder="Calories"
          keyboardType="number-pad"
          accessibilityLabel="Calories"
          style={styles.flex}
        />
        <ThemedText themeColor="textSecondary">kcal</ThemedText>
      </View>
      <View style={styles.row}>
        <TextField
          value={protein}
          onChangeText={setProtein}
          placeholder="Protein g"
          keyboardType="decimal-pad"
          accessibilityLabel="Protein grams"
          style={styles.flex}
        />
        <TextField
          value={carbs}
          onChangeText={setCarbs}
          placeholder="Carbs g"
          keyboardType="decimal-pad"
          accessibilityLabel="Carbs grams"
          style={styles.flex}
        />
        <TextField
          value={fat}
          onChangeText={setFat}
          placeholder="Fat g"
          keyboardType="decimal-pad"
          accessibilityLabel="Fat grams"
          style={styles.flex}
        />
      </View>
      {showSaveToggle ? (
        <View style={styles.row}>
          <ThemedText style={styles.flex}>Save as food</ThemedText>
          <Switch value={saveAsFood} onValueChange={setSaveAsFood} accessibilityLabel="Save as food" />
        </View>
      ) : null}
      {error ? (
        <ThemedText type="small" themeColor="danger">
          {error}
        </ThemedText>
      ) : null}
      <Button title={submitLabel} variant="primary" size="large" onPress={submit} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: Spacing.two },
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  flex: { flex: 1 },
});
