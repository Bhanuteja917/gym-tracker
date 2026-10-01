import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Button, Card, ListRow } from '@/components/ui';
import { describePlanDay, getWeekPlan } from '@/data/plan';
import { useDbQuery } from '@/hooks/use-db-query';
import { WEEKDAY_NAMES, weekdayOf, type Weekday } from '@/lib/days';

/** Today's planned workout, with a blank workout and other plan days as alternatives. */
export function TodayPlanCard({
  onStartPlanned,
  onStartBlank,
}: {
  onStartPlanned: (weekday: Weekday) => void;
  onStartBlank: () => void;
}) {
  const week = useDbQuery(getWeekPlan);
  const todayWeekday = weekdayOf(new Date());
  const today = week[todayWeekday - 1];
  const planned = today.exercises.length > 0;
  const otherDays = week.filter((d) => d.exercises.length > 0 && d.weekday !== todayWeekday);
  const [picking, setPicking] = useState(false);

  return (
    <Card>
      <View style={styles.header}>
        <View style={styles.flex}>
          <ThemedText style={styles.title}>{WEEKDAY_NAMES[todayWeekday]}</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            {describePlanDay(today)}
          </ThemedText>
        </View>
        <Button title="Edit plan" variant="plain" size="small" onPress={() => router.navigate('/plan')} />
      </View>

      {planned ? (
        <Button
          title={`Start ${today.name ?? 'planned workout'}`}
          variant="primary"
          size="large"
          onPress={() => onStartPlanned(todayWeekday)}
        />
      ) : null}
      <Button
        title="Start blank workout"
        variant={planned ? 'secondary' : 'primary'}
        size={planned ? 'normal' : 'large'}
        onPress={onStartBlank}
      />

      {otherDays.length > 0 ? (
        <Button
          title={picking ? 'Hide other days' : 'Use another day…'}
          variant="plain"
          onPress={() => setPicking(!picking)}
        />
      ) : null}
      {picking
        ? otherDays.map((d) => (
            <ListRow
              key={d.weekday}
              title={WEEKDAY_NAMES[d.weekday]}
              subtitle={describePlanDay(d)}
              right="Start"
              onPress={() => onStartPlanned(d.weekday)}
            />
          ))
        : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center' },
  title: { fontWeight: 600 },
});
