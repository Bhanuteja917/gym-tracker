import { router } from 'expo-router';
import { View } from 'react-native';

import { EmptyState, ListRow, Screen } from '@/components/ui';
import { listSavedFoods } from '@/data/food';
import { useDbQuery } from '@/hooks/use-db-query';
import { formatKcal, macroSummary } from '@/lib/nutrition';

export default function SavedFoodsScreen() {
  const foods = useDbQuery((d) => listSavedFoods(d));
  return (
    <Screen>
      {foods.length === 0 ? (
        <EmptyState
          title="No saved foods"
          message='When adding food, turn on "Save as food" to keep it here.'
        />
      ) : (
        <View>
          {foods.map((f) => (
            <ListRow
              key={f.id}
              title={f.name}
              subtitle={macroSummary(f)}
              right={`${formatKcal(f.calories)} kcal`}
              onPress={() => router.push(`/saved-food/${f.id}`)}
            />
          ))}
        </View>
      )}
    </Screen>
  );
}
