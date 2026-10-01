import { router } from 'expo-router';
import { useState } from 'react';
import { Alert, Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Button, EmptyState, Screen, SectionTitle, TextField } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { db } from '@/db/client';
import type { MuscleGroup } from '@/db/schema';
import { addMuscleGroup, listMuscleGroups, moveMuscleGroup } from '@/data/muscle-groups';
import { useDbQuery } from '@/hooks/use-db-query';
import { useTheme } from '@/hooks/use-theme';

export default function MuscleGroupsScreen() {
  const groups = useDbQuery(listMuscleGroups);
  const [name, setName] = useState('');

  // Takes the submitted text directly so a fast "return" can't use stale state.
  const add = (text = name) => {
    if (text.trim() === '') return;
    try {
      addMuscleGroup(db, text);
      setName('');
    } catch (e) {
      Alert.alert('Could not add', (e as Error).message);
    }
  };

  return (
    <Screen automaticallyAdjustKeyboardInsets>
      {groups.length === 0 ? (
        <EmptyState title="No muscle groups" />
      ) : (
        <View>
          {groups.map((g, i) => (
            <GroupRow key={g.id} group={g} isFirst={i === 0} isLast={i === groups.length - 1} />
          ))}
        </View>
      )}

      <SectionTitle>Add muscle group</SectionTitle>
      <TextField
        value={name}
        onChangeText={setName}
        onSubmitEditing={(e) => add(e.nativeEvent.text)}
        placeholder="e.g. Glutes"
        returnKeyType="done"
        accessibilityLabel="New muscle group name"
      />
      <Button title="Add" variant="primary" disabled={name.trim() === ''} onPress={() => add()} />
    </Screen>
  );
}

function GroupRow({
  group,
  isFirst,
  isLast,
}: {
  group: MuscleGroup;
  isFirst: boolean;
  isLast: boolean;
}) {
  const theme = useTheme();
  return (
    <View style={[styles.row, { borderBottomColor: theme.border }]}>
      <Pressable
        style={({ pressed }) => [styles.flex, { opacity: pressed ? 0.6 : 1 }]}
        onPress={() => router.push(`/muscle-group/${group.id}`)}>
        <ThemedText numberOfLines={1}>{group.name}</ThemedText>
      </Pressable>
      <Button
        title="↑"
        size="small"
        disabled={isFirst}
        accessibilityLabel={`Move ${group.name} up`}
        onPress={() => moveMuscleGroup(db, group.id, -1)}
      />
      <Button
        title="↓"
        size="small"
        disabled={isLast}
        accessibilityLabel={`Move ${group.name} down`}
        onPress={() => moveMuscleGroup(db, group.id, 1)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
});
