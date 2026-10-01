import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Alert, View } from 'react-native';

import { FoodForm } from '@/components/food-form';
import { EmptyState, ListRow, Screen, SectionTitle, TextField } from '@/components/ui';
import { db } from '@/db/client';
import type { SavedFood } from '@/db/schema';
import { addFoodEntry, listSavedFoods } from '@/data/food';
import { useDbQuery } from '@/hooks/use-db-query';
import { dayKey, parseDayKey } from '@/lib/dot-grid';
import { formatKcal, macroSummary } from '@/lib/nutrition';

export default function AddFoodModal() {
  const param = useLocalSearchParams<{ day?: string }>().day;
  const day = param && parseDayKey(param) ? param : dayKey(new Date());
  const [query, setQuery] = useState('');
  const [picked, setPicked] = useState<SavedFood | null>(null);
  const saved = useDbQuery((d) => listSavedFoods(d, query));

  return (
    <Screen automaticallyAdjustKeyboardInsets>
      <FoodForm
        // Re-mount to fill the fields when a saved food is picked.
        key={picked?.id ?? 'new'}
        initial={picked ?? undefined}
        submitLabel="Add"
        showSaveToggle
        onSubmit={(input, saveAsFood) => {
          try {
            addFoodEntry(db, day, input, { saveAsFood });
            router.back();
          } catch (e) {
            Alert.alert('Could not add food', (e as Error).message);
          }
        }}
      />

      <SectionTitle>Saved foods</SectionTitle>
      <TextField
        value={query}
        onChangeText={setQuery}
        placeholder="Search saved foods"
        autoCorrect={false}
        clearButtonMode="while-editing"
      />
      {saved.length === 0 ? (
        <EmptyState
          title={query.trim() === '' ? 'No saved foods yet' : 'No matches'}
          message='Turn on "Save as food" to reuse an entry with one tap.'
        />
      ) : (
        <View>
          {saved.map((f) => (
            <ListRow
              key={f.id}
              title={f.name}
              subtitle={macroSummary(f)}
              right={`${formatKcal(f.calories)} kcal`}
              onPress={() => setPicked(f)}
            />
          ))}
        </View>
      )}
    </Screen>
  );
}
