'use client';

import { toast } from 'sonner';

import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { updateSettings } from '@/local/mutations';
import { useLocal, useLocalQuery } from '@/local/provider';
import { getDefaultUnit } from '@/local/queries';

export function UnitSetting() {
  const { mutate } = useLocal();
  const unit = useLocalQuery(getDefaultUnit, []);

  async function change(next: string) {
    if (next !== 'lb' && next !== 'kg') return;
    const result = await mutate((db) => updateSettings(db, { defaultUnit: next }));
    if (!result.ok) toast.error(result.error);
  }

  return (
    <ToggleGroup type="single" variant="outline" value={unit ?? ''} onValueChange={change} className="w-full">
      <ToggleGroupItem value="lb" className="h-10 flex-1">
        Pounds (lb)
      </ToggleGroupItem>
      <ToggleGroupItem value="kg" className="h-10 flex-1">
        Kilograms (kg)
      </ToggleGroupItem>
    </ToggleGroup>
  );
}
