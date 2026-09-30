import { router, useLocalSearchParams } from 'expo-router';
import { Alert } from 'react-native';

import { SetForm } from '@/components/set-form';
import { Button, EmptyState, Screen } from '@/components/ui';
import { db } from '@/db/client';
import { deleteSet, getSet, updateSet } from '@/data/workouts';
import { useDbQuery } from '@/hooks/use-db-query';

export default function EditSetModal() {
  const id = Number(useLocalSearchParams<{ id: string }>().id);
  const set = useDbQuery((d) => getSet(d, id));

  if (!set) {
    return (
      <Screen>
        <EmptyState title="Set not found" />
      </Screen>
    );
  }

  return (
    <Screen automaticallyAdjustKeyboardInsets>
      <SetForm
        initial={set}
        submitLabel="Save"
        onSubmit={(input) => {
          updateSet(db, id, input);
          router.back();
        }}
      />
      <Button
        title="Delete set"
        variant="danger"
        onPress={() =>
          Alert.alert('Delete this set?', undefined, [
            { text: 'Cancel', style: 'cancel' },
            {
              text: 'Delete',
              style: 'destructive',
              onPress: () => {
                router.back();
                deleteSet(db, id);
              },
            },
          ])
        }
      />
    </Screen>
  );
}
