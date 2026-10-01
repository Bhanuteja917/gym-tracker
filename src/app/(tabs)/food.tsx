import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Button, Card, EmptyState, ListRow, Screen } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { dayTotals, listFoodEntries } from '@/data/food';
import { getNutritionTargets } from '@/data/settings';
import { useDbQuery } from '@/hooks/use-db-query';
import { formatDayKey, shiftDayKey } from '@/lib/days';
import { dayKey } from '@/lib/dot-grid';
import { calorieStatus, formatKcal, macroLines, macroSummary } from '@/lib/nutrition';

export default function FoodTab() {
  const [day, setDay] = useState(() => dayKey(new Date()));
  const entries = useDbQuery((d) => listFoodEntries(d, day));
  const totals = useDbQuery((d) => dayTotals(d, day));
  const targets = useDbQuery(getNutritionTargets);
  const isToday = day === dayKey(new Date());
  const status = calorieStatus(totals.calories, targets.calories);

  return (
    <Screen safeTop>
      <View style={styles.dayRow}>
        <Button title="‹" size="small" accessibilityLabel="Previous day" onPress={() => setDay(shiftDayKey(day, -1))} />
        <ThemedText type="subtitle" style={styles.dayLabel}>
          {formatDayKey(day)}
        </ThemedText>
        <Button title="›" size="small" accessibilityLabel="Next day" onPress={() => setDay(shiftDayKey(day, 1))} />
      </View>
      {!isToday ? (
        <Button title="Back to today" variant="plain" onPress={() => setDay(dayKey(new Date()))} />
      ) : null}

      <Card>
        <ThemedText style={styles.total}>
          {formatKcal(totals.calories)}
          {targets.calories !== null ? ` / ${formatKcal(targets.calories)}` : ''} kcal
        </ThemedText>
        {status ? (
          <ThemedText type="small" themeColor="textSecondary">
            {status}
          </ThemedText>
        ) : null}
        {macroLines(totals, targets).map((line) => (
          <ThemedText key={line} type="small">
            {line}
          </ThemedText>
        ))}
      </Card>

      <Button
        title="+ Add food"
        variant="primary"
        size="large"
        onPress={() => router.push({ pathname: '/food/new', params: { day } })}
      />

      {entries.length === 0 ? (
        <EmptyState title="Nothing logged" message="Food you log for this day shows up here." />
      ) : (
        <View>
          {entries.map((e) => (
            <ListRow
              key={e.id}
              title={e.name}
              subtitle={macroSummary(e)}
              right={`${formatKcal(e.calories)} kcal`}
              onPress={() => router.push(`/food/${e.id}`)}
            />
          ))}
        </View>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  dayRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  dayLabel: { flex: 1, textAlign: 'center' },
  total: { fontSize: 28, fontWeight: 700, lineHeight: 34 },
});
