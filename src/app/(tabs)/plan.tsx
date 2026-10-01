import { router } from 'expo-router';
import { View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ListRow, Screen } from '@/components/ui';
import { describePlanDay, getWeekPlan } from '@/data/plan';
import { useDbQuery } from '@/hooks/use-db-query';
import { WEEKDAY_NAMES, weekdayOf } from '@/lib/days';

export default function PlanTab() {
  const week = useDbQuery(getWeekPlan);
  const today = weekdayOf(new Date());

  return (
    <Screen safeTop>
      <ThemedText type="subtitle">Weekly plan</ThemedText>
      <ThemedText type="small" themeColor="textSecondary">
        Repeats every week. Tap a day to plan its exercises and targets.
      </ThemedText>
      <View>
        {week.map((day) => (
          <ListRow
            key={day.weekday}
            title={`${WEEKDAY_NAMES[day.weekday]}${day.weekday === today ? ' · Today' : ''}`}
            subtitle={describePlanDay(day)}
            right="›"
            onPress={() => router.push(`/plan/${day.weekday}`)}
          />
        ))}
      </View>
    </Screen>
  );
}
