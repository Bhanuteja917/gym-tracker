'use client';

import { useEffect, useRef, useState } from 'react';

import { cn } from '@/lib/utils';
import type { MuscleId } from '@/lib/muscles';

import type { MuscleScene, SceneOptions } from './scene';

const DARK = '(prefers-color-scheme: dark)';

/**
 * A rotatable 3D body with `highlighted` muscles in colour. Drag to turn it;
 * with `onSelect`, tapping a muscle reports it. three.js loads on first use.
 */
export function MuscleFigure({
  highlighted,
  onSelect,
  className,
}: {
  highlighted: readonly MuscleId[];
  onSelect?: (id: MuscleId) => void;
  className?: string;
}) {
  const container = useRef<HTMLDivElement>(null);
  const scene = useRef<MuscleScene | null>(null);
  const [dark, setDark] = useState(() => typeof window !== 'undefined' && window.matchMedia(DARK).matches);
  const [failed, setFailed] = useState(false);
  const options: SceneOptions = { highlighted, onSelect, dark };
  const latest = useRef(options);

  useEffect(() => {
    latest.current = options;
    scene.current?.update(options);
  });

  useEffect(() => {
    const query = window.matchMedia(DARK);
    const onChange = () => setDark(query.matches);
    query.addEventListener('change', onChange);
    return () => query.removeEventListener('change', onChange);
  }, []);

  useEffect(() => {
    let cancelled = false;
    import('./scene')
      .then(({ createMuscleScene }) => {
        if (cancelled || !container.current) return;
        scene.current = createMuscleScene(container.current, latest.current);
      })
      .catch(() => !cancelled && setFailed(true));
    return () => {
      cancelled = true;
      scene.current?.dispose();
      scene.current = null;
    };
  }, []);

  return (
    <div
      ref={container}
      className={cn('bg-card relative h-80 overflow-hidden rounded-xl border', className)}
      role="img"
      aria-label="3D body figure. Drag to rotate."
    >
      {failed && (
        <p className="text-muted-foreground absolute inset-0 grid place-items-center p-4 text-center text-sm">
          The 3D figure can&apos;t be shown on this device.
        </p>
      )}
    </div>
  );
}
