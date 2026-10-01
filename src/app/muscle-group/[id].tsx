import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Alert } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Button, EmptyState, Screen, SectionTitle, TextField } from '@/components/ui';
import { db } from '@/db/client';
import {
  countExercisesInGroup,
  getMuscleGroup,
  removeMuscleGroup,
  renameMuscleGroup,
} from '@/data/muscle-groups';
import { useDbQuery } from '@/hooks/use-db-query';

export default function EditMuscleGroupModal() {
  const id = Number(useLocalSearchParams<{ id: string }>().id);
  const group = useDbQuery((d) => getMuscleGroup(d, id));
  const used = useDbQuery((d) => countExercisesInGroup(d, id));
  const [name, setName] = useState(group?.name ?? '');

  if (!group) {
    return (
      <Screen>
        <EmptyState title="Muscle group not found" />
      </Screen>
    );
  }

  const save = (text = name) => {
    try {
      renameMuscleGroup(db, id, text);
      router.back();
    } catch (e) {
      Alert.alert('Could not rename', (e as Error).message);
    }
  };

  const remove = () =>
    Alert.alert(
      `Delete ${group.name}?`,
      used === 0
        ? 'No exercises use it.'
        : `${used} exercise${used === 1 ? '' : 's'} will be left with no muscle group. The exercises themselves are kept.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            router.back();
            removeMuscleGroup(db, id);
          },
        },
      ],
    );

  return (
    <Screen automaticallyAdjustKeyboardInsets>
      <SectionTitle>Name</SectionTitle>
      <TextField
        value={name}
        onChangeText={setName}
        onSubmitEditing={(e) => save(e.nativeEvent.text)}
        returnKeyType="done"
        autoFocus
        accessibilityLabel="Muscle group name"
      />
      <ThemedText type="small" themeColor="textSecondary">
        {used === 0
          ? 'No exercises use this group yet.'
          : `Used by ${used} exercise${used === 1 ? '' : 's'}; renaming updates them too.`}
      </ThemedText>
      <Button
        title="Save"
        variant="primary"
        disabled={name.trim() === '' || name.trim() === group.name}
        onPress={() => save()}
      />
      <Button title="Delete muscle group" variant="danger" onPress={remove} />
    </Screen>
  );
}
