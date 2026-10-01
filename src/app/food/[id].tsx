import { router, useLocalSearchParams } from 'expo-router';
import { Alert } from 'react-native';

import { FoodForm } from '@/components/food-form';
import { Button, EmptyState, Screen } from '@/components/ui';
import { db } from '@/db/client';
import { deleteFoodEntry, getFoodEntry, updateFoodEntry } from '@/data/food';
import { useDbQuery } from '@/hooks/use-db-query';

export default function EditFoodModal() {
  const id = Number(useLocalSearchParams<{ id: string }>().id);
  const entry = useDbQuery((d) => getFoodEntry(d, id));

  if (!entry) {
    return (
      <Screen>
        <EmptyState title="Entry not found" />
      </Screen>
    );
  }

  return (
    <Screen automaticallyAdjustKeyboardInsets>
      <FoodForm
        initial={entry}
        submitLabel="Save"
        onSubmit={(input) => {
          try {
            updateFoodEntry(db, id, input);
            router.back();
          } catch (e) {
            Alert.alert('Could not save', (e as Error).message);
          }
        }}
      />
      <Button
        title="Delete entry"
        variant="danger"
        onPress={() =>
          Alert.alert('Delete this entry?', undefined, [
            { text: 'Cancel', style: 'cancel' },
            {
              text: 'Delete',
              style: 'destructive',
              onPress: () => {
                router.back();
                deleteFoodEntry(db, id);
              },
            },
          ])
        }
      />
    </Screen>
  );
}
