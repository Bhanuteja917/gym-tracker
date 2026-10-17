import { describe, expect, it } from 'vitest';

import { BACK, FRONT } from '@/components/muscle-figure/body-paths';

import { groupOf, isMuscleId, isPartId, MUSCLES, musclesFor, PARTS, partsOf, sideFor, summarize } from './muscles';

describe('musclesFor', () => {
  it('expands broad groups and ignores case', () => {
    expect(musclesFor('LEGS')).toEqual([
      'glute-max',
      'glute-med',
      'rectus-femoris',
      'outer-quad',
      'inner-quad',
      'outer-hamstring',
      'inner-hamstring',
      'gastrocnemius',
      'soleus',
      'tibialis',
    ]);
    expect(musclesFor(' core ')).toEqual(['upper-abs', 'lower-abs', 'external-obliques', 'serratus']);
    expect(musclesFor('Full body')).toHaveLength(PARTS.length);
  });

  it('resolves groups, single muscles and synonyms', () => {
    expect(musclesFor('Chest')).toEqual(['upper-chest', 'mid-chest', 'lower-chest']);
    expect(musclesFor('Upper chest')).toEqual(['upper-chest']);
    expect(musclesFor('Quadriceps')).toEqual(['rectus-femoris', 'outer-quad', 'inner-quad']);
    expect(musclesFor('Traps (mid-back)')).toEqual(['middle-traps', 'rhomboids']);
    expect(musclesFor('Rear delts')).toEqual(['rear-delts']);
    expect(musclesFor('Neck')).toEqual(['neck']);
  });

  it('combines lists without duplicates, in body-map order', () => {
    expect(musclesFor('Soleus, Glute max & glutes')).toEqual(['glute-max', 'glute-med', 'soleus']);
    expect(musclesFor('Shoulders, Triceps')).toHaveLength(6);
  });

  it('narrows a whole group by the exercise name', () => {
    expect(musclesFor('Chest', 'Incline Dumbbell Press')).toEqual(['upper-chest']);
    expect(musclesFor('Chest', 'Decline Bench Press')).toEqual(['lower-chest']);
    expect(musclesFor('Chest', 'Bench Press')).toEqual(['upper-chest', 'mid-chest', 'lower-chest']);
    expect(musclesFor('Shoulders', 'Side Lateral Raise')).toEqual(['side-delts']);
    expect(musclesFor('Shoulders', 'Reverse Flyes')).toEqual(['rear-delts']);
    expect(musclesFor('Biceps', 'Hammer Curls')).toEqual(['brachialis', 'brachioradialis']);
    expect(musclesFor('Triceps', 'Lying Triceps Extension (Skull Crusher)')).toEqual(['triceps-long']);
    expect(musclesFor('Abdominals', 'Hanging Leg Raise')).toEqual(['lower-abs', 'hip-flexors']);
    expect(musclesFor('Calves', 'Seated Calf Raise')).toEqual(['soleus']);
    expect(musclesFor('Calves', 'Standing Calf Raises')).toEqual(['gastrocnemius']);
    expect(musclesFor('Forearms', 'Palms-Down Wrist Curl Over A Bench')).toEqual(['wrist-extensors']);
    expect(musclesFor('Shoulders', 'External Rotation with Band')).toEqual(['rotator-cuff']);
  });

  it('keeps a named muscle even when the exercise name suggests another', () => {
    expect(musclesFor('Mid chest', 'Incline Bench Press')).toEqual(['mid-chest']);
  });

  it('only narrows the group the rule is for', () => {
    expect(musclesFor('Triceps, Chest', 'Decline Close-Grip Bench Press')).toEqual([
      'lower-chest',
      'triceps-long',
      'triceps-lateral',
      'triceps-medial',
    ]);
  });

  it('returns nothing for unknown or empty groups', () => {
    expect(musclesFor('Cardio')).toEqual([]);
    expect(musclesFor(null)).toEqual([]);
    expect(musclesFor('')).toEqual([]);
  });
});

describe('groups and parts', () => {
  it('tells groups and parts apart', () => {
    expect(isMuscleId('chest')).toBe(true);
    expect(isMuscleId('upper-chest')).toBe(false);
    expect(isPartId('upper-chest')).toBe(true);
    expect(isPartId('chest')).toBe(false);
    // A group drawn as one muscle is both.
    expect(isMuscleId('neck') && isPartId('neck')).toBe(true);
    expect(isMuscleId('Calves')).toBe(false);
    expect(isPartId(null)).toBe(false);
  });

  it('maps between groups and parts', () => {
    expect(partsOf('calves')).toEqual(['gastrocnemius', 'soleus', 'tibialis']);
    expect(partsOf('soleus')).toEqual(['soleus']);
    expect(partsOf('neck')).toEqual(['neck']);
    expect(groupOf('soleus')).toBe('calves');
    expect(groupOf('calves')).toBe('calves');
  });

  it('gives every part one group and a unique id', () => {
    expect(new Set(PARTS.map((p) => p.id)).size).toBe(PARTS.length);
    for (const m of MUSCLES) expect(partsOf(m.id).length, m.id).toBeGreaterThan(0);
  });

  it('collapses complete groups', () => {
    expect(summarize(['upper-chest', 'mid-chest', 'lower-chest', 'side-delts', 'neck'])).toEqual([
      'neck',
      'side-delts',
      'chest',
    ]);
  });
});

describe('sideFor', () => {
  it('picks the side that shows most of the muscles', () => {
    expect(sideFor(['outer-hamstring'])).toBe('back');
    expect(sideFor(['rectus-femoris', 'glute-max'])).toBe('front');
    expect(sideFor(['latissimus', 'biceps-long', 'rhomboids'])).toBe('back');
    expect(sideFor(['gastrocnemius'])).toBe('back');
    expect(sideFor([])).toBe('front');
  });

  it('only picks a side the muscle is drawn on', () => {
    for (const { id } of PARTS) expect(sideFor([id]) === 'back' ? BACK[id] : FRONT[id], id).toBeDefined();
  });

  it('draws only known muscles', () => {
    const ids = new Set<string>(PARTS.map((p) => p.id));
    for (const id of [...Object.keys(FRONT), ...Object.keys(BACK)]) expect(ids.has(id), id).toBe(true);
  });
});
