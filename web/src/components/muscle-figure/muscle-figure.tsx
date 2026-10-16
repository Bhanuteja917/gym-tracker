import { memo } from 'react';

import { muscleLabel, type MuscleId } from '@/lib/muscles';
import { cn } from '@/lib/utils';

import { BACK, BACK_LINES, BODY_OUTLINE, FRONT, FRONT_LINES } from './body-paths';

export type FigureView = 'front' | 'back' | 'both';

// Ink-chart colours: a dark body with light outlines in dark mode, a pale body
// with white gaps in light mode, target muscles in the accent pink.
const OUTLINE = 'fill-zinc-100 stroke-zinc-400 dark:fill-[#18181a] dark:stroke-zinc-200';
const MUSCLE = 'fill-zinc-300 stroke-white dark:fill-[#5f5e5c] dark:stroke-zinc-200';
const HIGHLIGHT = 'fill-[#e8657f] stroke-white dark:stroke-zinc-200';
const LINES = 'fill-none stroke-white dark:stroke-zinc-200';

const SIDES = { front: { paths: FRONT, lines: FRONT_LINES }, back: { paths: BACK, lines: BACK_LINES } };

/**
 * Front and/or back body chart with `highlighted` muscles in colour. With
 * `onSelect`, tapping a muscle reports it (the muscle buttons around the
 * figure are the keyboard-accessible way to pick one).
 */
export function MuscleFigure({
  view = 'both',
  highlighted,
  onSelect,
  className,
}: {
  view?: FigureView;
  highlighted: readonly MuscleId[];
  onSelect?: (id: MuscleId) => void;
  className?: string;
}) {
  const sides = view === 'both' ? (['front', 'back'] as const) : [view];
  const label = highlighted.length
    ? `Body chart highlighting ${highlighted.map(muscleLabel).join(', ')}`
    : 'Body chart';
  return (
    <svg viewBox={view === 'both' ? '0 0 420 422' : '0 0 200 422'} className={cn('block', className)} role="img" aria-label={label}>
      {sides.map((side, i) => (
        <g key={side} transform={`translate(${i * 220} 0)`}>
          <path d={BODY_OUTLINE} className={OUTLINE} strokeWidth={1.25} vectorEffect="non-scaling-stroke" />
          {(Object.entries(SIDES[side].paths) as [MuscleId, string][]).map(([id, d]) => (
            <path
              key={id}
              d={d}
              className={cn(
                highlighted.includes(id) ? HIGHLIGHT : MUSCLE,
                onSelect && 'cursor-pointer',
                onSelect && !highlighted.includes(id) && 'hover:fill-zinc-400 dark:hover:fill-[#8a8886]',
              )}
              strokeWidth={0.75}
              strokeLinejoin="round"
              vectorEffect="non-scaling-stroke"
              onClick={onSelect && (() => onSelect(id))}
            />
          ))}
          <path
            d={SIDES[side].lines}
            className={cn(LINES, 'pointer-events-none')}
            strokeWidth={0.75}
            strokeLinecap="round"
            vectorEffect="non-scaling-stroke"
          />
        </g>
      ))}
    </svg>
  );
}

const SPRITE_ID = 'muscle-figure';

/**
 * Shared shapes for `MuscleThumb`, so a long list repeats short `<use>`
 * references instead of the full path data. Render once on any screen with thumbnails.
 */
export function MuscleSprite() {
  return (
    <svg width="0" height="0" className="absolute" aria-hidden>
      <defs>
        <path id={`${SPRITE_ID}-outline`} d={BODY_OUTLINE} />
        {(['front', 'back'] as const).flatMap((side) =>
          Object.entries(SIDES[side].paths).map(([id, d]) => <path key={`${side}-${id}`} id={`${SPRITE_ID}-${side}-${id}`} d={d} />),
        )}
      </defs>
    </svg>
  );
}

/** A small single-side figure showing only the outline and the highlighted muscles. Needs `MuscleSprite`. */
export const MuscleThumb = memo(function MuscleThumb({
  side,
  highlighted,
  className,
}: {
  side: 'front' | 'back';
  highlighted: readonly MuscleId[];
  className?: string;
}) {
  return (
    <svg viewBox="0 0 200 422" className={cn('block', className)} aria-hidden>
      <use href={`#${SPRITE_ID}-outline`} className={OUTLINE} strokeWidth={1} vectorEffect="non-scaling-stroke" />
      {highlighted
        .filter((id) => SIDES[side].paths[id])
        .map((id) => (
          <use key={id} href={`#${SPRITE_ID}-${side}-${id}`} className="fill-[#e8657f]" />
        ))}
    </svg>
  );
});
