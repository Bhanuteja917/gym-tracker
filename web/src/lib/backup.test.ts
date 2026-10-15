import { describe, expect, it } from 'vitest';

import { sampleBackup } from '../../test/fixtures';

import { InvalidBackupError, parseExpoBackup } from './backup';

describe('parseExpoBackup', () => {
  it('accepts a current backup', () => {
    const b = parseExpoBackup(JSON.stringify(sampleBackup()));
    expect(b.exercises).toHaveLength(2);
    expect(b.sets[1]!.weight).toBe(62.5);
  });

  it('accepts version 1 (no categories or video links)', () => {
    const v1 = sampleBackup({
      version: 1,
      exercises: [
        { id: 1, name: 'Bench Press', archived: false, createdAt: 1 },
        { id: 2, name: 'Pull-up', archived: false, createdAt: 1 },
      ],
    });
    expect(parseExpoBackup(JSON.stringify(v1)).exercises[0]!.category).toBeUndefined();
  });

  it('rejects other files with a readable error', () => {
    expect(() => parseExpoBackup('nope')).toThrow('File is not valid JSON');
    expect(() => parseExpoBackup('{"format":"other"}')).toThrow('Not a Gym Tracker backup file');
    expect(() => parseExpoBackup(JSON.stringify(sampleBackup({ version: 9 })))).toThrow(
      'Unsupported backup version',
    );
  });

  it('rejects dangling references', () => {
    const b = sampleBackup();
    b.sets.push({ ...b.sets[0]!, id: 9, sessionExerciseId: 999 });
    expect(() => parseExpoBackup(JSON.stringify(b))).toThrow(InvalidBackupError);
  });
});
