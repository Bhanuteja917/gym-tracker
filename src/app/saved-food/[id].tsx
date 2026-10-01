import { router, useLocalSearchParams } from 'expo-router';
import { Alert } from 'react-native';

import { FoodForm } from '@/components/food-form';
import { ThemedText } from '@/components/themed-text';
import { Button, EmptyState, Screen } from '@/components/ui';
import { db } from '@/db/client';
import { deleteSavedFood, getSavedFood, updateSavedFood } from '@/data/food';
import { useDbQuery } from '@/hooks/use-db-query';

export default function EditSavedFoodModal() {
  const id = Number(useLocalSearchParams<{ id: string }>().id);
  const food = useDbQuery((d) => getSavedFood(d, id));

  if (!food) {
    return (
      <Screen>
        <EmptyState title="Saved food not found" />
      </Screen>
    );
  }

  return (
    <Screen automaticallyAdjustKeyboardInsets>
      <FoodForm
        initial={food}
        submitLabel="Save"
        onSubmit={(input) => {
          try {
            updateSavedFood(db, id, input);
            router.back();
          } catch (e) {
            Alert.alert('Could not save', (e as Error).message);
          }
        }}
      />
      <ThemedText type="small" themeColor="textSecondary">
        Changes apply to future entries only; food already logged keeps its values.
      </ThemedText>
      <Button
        title="Delete saved food"
        variant="danger"
        onPress={() => {
          router.back();
          deleteSavedFood(db, id);
        }}
      />
    </Screen>
  );
}
