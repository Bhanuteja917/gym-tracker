'use client';

import { Minus, Plus } from 'lucide-react';
import { useId, useState, useTransition, type ReactNode } from 'react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Spinner } from '@/components/ui/spinner';
import { Textarea } from '@/components/ui/textarea';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { formatNumber, type WeightUnit } from '@/lib/units';

export type SetFormValues = {
  weight: string;
  unit: WeightUnit;
  reps: string;
  rpe: string;
  notes: string;
};

type Result = { ok: true } | { ok: false; error: string };

const STEP: Record<WeightUnit, number> = { lb: 5, kg: 2.5 };

/** Weight × reps entry with steppers. Blank weight = bodyweight. RPE and notes behind "More". */
export function SetForm({
  initial,
  submitLabel,
  onSubmit,
  extraActions,
}: {
  initial: { weight: number | null; unit: WeightUnit; reps: number | null; rpe?: number | null; notes?: string | null };
  submitLabel: string;
  onSubmit: (values: SetFormValues) => Promise<Result>;
  extraActions?: ReactNode;
}) {
  const id = useId();
  const [values, setValues] = useState<SetFormValues>({
    weight: initial.weight === null ? '' : String(initial.weight),
    unit: initial.unit,
    reps: initial.reps === null ? '' : String(initial.reps),
    rpe: initial.rpe == null ? '' : String(initial.rpe),
    notes: initial.notes ?? '',
  });
  const [showMore, setShowMore] = useState(Boolean(initial.rpe != null || initial.notes));
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const set = (patch: Partial<SetFormValues>) => setValues((v) => ({ ...v, ...patch }));

  function step(field: 'weight' | 'reps', direction: 1 | -1) {
    const amount = field === 'weight' ? STEP[values.unit] : 1;
    const current = Number(values[field].replace(',', '.')) || 0;
    const next = Math.max(0, current + direction * amount);
    set({ [field]: next === 0 && field === 'weight' ? '' : formatNumber(next, 2) });
  }

  function submit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    startTransition(async () => {
      const result = await onSubmit(values);
      if (!result.ok) setError(result.error);
    });
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <Label htmlFor={`${id}-weight`}>Weight</Label>
            <ToggleGroup
              type="single"
              size="sm"
              variant="outline"
              value={values.unit}
              onValueChange={(unit) => unit && set({ unit: unit as WeightUnit })}
              aria-label="Unit"
            >
              <ToggleGroupItem value="lb" className="h-6 px-2 text-xs">lb</ToggleGroupItem>
              <ToggleGroupItem value="kg" className="h-6 px-2 text-xs">kg</ToggleGroupItem>
            </ToggleGroup>
          </div>
          <Stepper onMinus={() => step('weight', -1)} onPlus={() => step('weight', 1)} label="weight">
            <Input
              id={`${id}-weight`}
              inputMode="decimal"
              placeholder="BW"
              autoComplete="off"
              value={values.weight}
              onChange={(e) => set({ weight: e.target.value })}
              className="h-11 text-center text-lg tabular-nums"
            />
          </Stepper>
        </div>
        <div className="space-y-1.5">
          <div className="flex h-6 items-center">
            <Label htmlFor={`${id}-reps`}>Reps</Label>
          </div>
          <Stepper onMinus={() => step('reps', -1)} onPlus={() => step('reps', 1)} label="reps">
            <Input
              id={`${id}-reps`}
              inputMode="numeric"
              pattern="[0-9]*"
              autoComplete="off"
              value={values.reps}
              onChange={(e) => set({ reps: e.target.value })}
              className="h-11 text-center text-lg tabular-nums"
            />
          </Stepper>
        </div>
      </div>

      {showMore ? (
        <div className="grid grid-cols-[5rem_1fr] gap-3">
          <div className="space-y-1.5">
            <Label htmlFor={`${id}-rpe`}>RPE</Label>
            <Input
              id={`${id}-rpe`}
              inputMode="decimal"
              placeholder="1–10"
              value={values.rpe}
              onChange={(e) => set({ rpe: e.target.value })}
              className="h-11 text-center"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor={`${id}-notes`}>Notes</Label>
            <Textarea
              id={`${id}-notes`}
              rows={1}
              value={values.notes}
              onChange={(e) => set({ notes: e.target.value })}
              className="min-h-11"
            />
          </div>
        </div>
      ) : (
        <button type="button" className="text-muted-foreground text-sm" onClick={() => setShowMore(true)}>
          + RPE / notes
        </button>
      )}

      {error && (
        <p role="alert" className="text-destructive text-sm">
          {error}
        </p>
      )}

      <div className="flex gap-2">
        {extraActions}
        <Button type="submit" size="lg" className="h-11 flex-1" disabled={pending}>
          {pending && <Spinner />}
          {submitLabel}
        </Button>
      </div>
    </form>
  );
}

function Stepper({
  children,
  onMinus,
  onPlus,
  label,
}: {
  children: ReactNode;
  onMinus: () => void;
  onPlus: () => void;
  label: string;
}) {
  return (
    <div className="flex items-center gap-1">
      <Button type="button" variant="outline" size="icon" className="size-11 shrink-0" onClick={onMinus} aria-label={`Less ${label}`}>
        <Minus />
      </Button>
      {children}
      <Button type="button" variant="outline" size="icon" className="size-11 shrink-0" onClick={onPlus} aria-label={`More ${label}`}>
        <Plus />
      </Button>
    </div>
  );
}
