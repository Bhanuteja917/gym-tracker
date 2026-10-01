import { useState } from 'react';
import { Alert } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Button, Chips, EmptyState, ListRow, TextField } from '@/components/ui';
import { db } from '@/db/client';
import type { Exercise } from '@/db/schema';
import { createExercise, DuplicateExerciseError, listExercises } from '@/data/exercises';
import { listMuscleGroups } from '@/data/muscle-groups';
import { useDbQuery } from '@/hooks/use-db-query';

/**
 * Searchable exercise list, filterable by muscle group. When the search text
 * doesn't match an existing exercise exactly, offers to create it with an
 * optional muscle group.
 */
export function ExerciseList({
  onSelect,
  rightText,
}: {
  onSelect: (exercise: Exercise) => void;
  rightText?: (exercise: Exercise) => string | undefined;
}) {
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<string | null>(null);
  // Muscle group for a new exercise; defaults to the active filter.
  const [newCategory, setNewCategory] = useState<string | null>(null);
  const all = useDbQuery((d) => listExercises(d));
  const groups = useDbQuery((d) => listMuscleGroups(d).map((g) => g.name));

  const q = query.trim().toLowerCase();
  const matches = all.filter(
    (e) => (filter === null || e.category === filter) && e.name.toLowerCase().includes(q),
  );
  const exact = all.some((e) => e.name.toLowerCase() === q);

  const changeFilter = (value: string | null) => {
    setFilter(value);
    setNewCategory(value);
  };

  const create = () => {
    try {
      const exercise = createExercise(db, query, newCategory);
      setQuery('');
      onSelect(exercise);
    } catch (e) {
      if (e instanceof DuplicateExerciseError) onSelect(e.existing);
      else Alert.alert('Could not add exercise', (e as Error).message);
    }
  };

  return (
    <>
      <TextField
        value={query}
        onChangeText={setQuery}
        placeholder="Search or add exercise"
        autoCorrect={false}
        clearButtonMode="while-editing"
        returnKeyType="done"
      />
      {q !== '' && !exact ? (
        <>
          <ThemedText type="small" themeColor="textSecondary">
            Muscle group (optional)
          </ThemedText>
          <Chips options={groups} value={newCategory} onChange={setNewCategory} />
          <Button title={`+ Create "${query.trim()}"`} variant="plain" onPress={create} />
        </>
      ) : (
        <Chips options={groups} value={filter} onChange={changeFilter} noneLabel="All" />
      )}
      {matches.length === 0 && q === '' ? <EmptyState title="No exercises" /> : null}
      {matches.map((e) => (
        <ListRow
          key={e.id}
          title={e.name}
          subtitle={e.category ?? undefined}
          right={rightText?.(e)}
          onPress={() => onSelect(e)}
        />
      ))}
    </>
  );
}
