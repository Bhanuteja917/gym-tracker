import { useState } from 'react';
import { Alert, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { TextField } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { parseOptionalCount } from '@/lib/units';

/** An optional positive whole-number target, saved when editing ends. */
export function TargetField({
  label,
  unit,
  value,
  max,
  onSave,
}: {
  label: string;
  unit: string;
  value: number | null;
  max: number;
  onSave: (value: number | null) => void;
}) {
  const [text, setText] = useState(value === null ? '' : String(value));

  const commit = () => {
    const result = parseOptionalCount(text, label, max);
    if (!result.ok) {
      Alert.alert('Invalid target', result.error);
      setText(value === null ? '' : String(value));
      return;
    }
    onSave(result.value);
  };

  return (
    <View style={styles.row}>
      <ThemedText style={styles.label}>{label}</ThemedText>
      <TextField
        value={text}
        onChangeText={setText}
        onEndEditing={commit}
        placeholder="None"
        keyboardType="number-pad"
        accessibilityLabel={`${label} target`}
        style={styles.input}
      />
      <ThemedText themeColor="textSecondary" style={styles.unit}>
        {unit}
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  label: { flex: 1 },
  input: { width: 100, textAlign: 'right' },
  unit: { width: 36 },
});
