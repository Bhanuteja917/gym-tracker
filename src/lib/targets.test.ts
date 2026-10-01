import { formatTargets } from './targets';

const none = { targetSets: null, targetReps: null, targetWeight: null, targetUnit: null };

describe('formatTargets', () => {
  it('formats full and partial targets', () => {
    expect(formatTargets({ targetSets: 3, targetReps: 8, targetWeight: 135, targetUnit: 'lb' })).toBe(
      '3 × 8 @ 135 lb',
    );
    expect(formatTargets({ ...none, targetSets: 3 })).toBe('3 sets');
    expect(formatTargets({ ...none, targetSets: 1 })).toBe('1 set');
    expect(formatTargets({ ...none, targetReps: 8, targetWeight: 60, targetUnit: 'kg' })).toBe(
      '8 reps @ 60 kg',
    );
    expect(formatTargets({ ...none, targetWeight: 135, targetUnit: 'lb' })).toBe('@ 135 lb');
  });

  it('returns null when nothing is set', () => {
    expect(formatTargets(none)).toBeNull();
  });
});
