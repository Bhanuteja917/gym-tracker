import { useState } from 'react';
import { Alert } from 'react-native';

import { Button, EmptyState, ListRow, TextField } from '@/components/ui';
import { db } from '@/db/client';
import type { Exercise } from '@/db/schema';
import { createExercise, DuplicateExerciseError, listExercises } from '@/data/exercises';
import { useDbQuery } from '@/hooks/use-db-query';

/**
 * Searchable exercise list. When the search text doesn't match an existing
 * exercise exactly, offers to create it.
 */
export function ExerciseList({
  onSelect,
  rightText,
}: {
  onSelect: (exercise: Exercise) => void;
  rightText?: (exercise: Exercise) => string | undefined;
}) {
  const [query, setQuery] = useState('');
  const all = useDbQuery((d) => listExercises(d));

  const q = query.trim().toLowerCase();
  const matches = q === '' ? all : all.filter((e) => e.name.toLowerCase().includes(q));
  const exact = all.some((e) => e.name.toLowerCase() === q);

  const create = () => {
    try {
      const exercise = createExercise(db, query);
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
        <Button title={`+ Create "${query.trim()}"`} variant="plain" onPress={create} />
      ) : null}
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
