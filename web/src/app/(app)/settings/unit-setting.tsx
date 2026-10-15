'use client';

import { useOptimistic, useTransition } from 'react';
import { toast } from 'sonner';

import { setDefaultUnitAction } from '@/actions/settings';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import type { WeightUnit } from '@/lib/units';

export function UnitSetting({ unit }: { unit: WeightUnit }) {
  const [optimistic, setOptimistic] = useOptimistic(unit);
  const [, startTransition] = useTransition();

  function change(next: string) {
    if (next !== 'lb' && next !== 'kg') return;
    startTransition(async () => {
      setOptimistic(next);
      const result = await setDefaultUnitAction(next);
      if (!result.ok) toast.error(result.error);
    });
  }

  return (
    <ToggleGroup type="single" variant="outline" value={optimistic} onValueChange={change} className="w-full">
      <ToggleGroupItem value="lb" className="h-10 flex-1">Pounds (lb)</ToggleGroupItem>
      <ToggleGroupItem value="kg" className="h-10 flex-1">Kilograms (kg)</ToggleGroupItem>
    </ToggleGroup>
  );
}
