'use client';

import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { dayKey, parseDayKey } from '@/lib/dot-grid';
import { ATTENDANCE_MONTHS, isAttendanceRange, type Settings } from '@/lib/settings';
import { updateSettings } from '@/local/mutations';
import { useLocal, useLocalQuery } from '@/local/provider';
import { getSettings } from '@/local/queries';

export function AttendanceSetting() {
  const { mutate } = useLocal();
  const settings = useLocalQuery(getSettings, []);
  if (!settings) return null;
  const months = ATTENDANCE_MONTHS[settings.attendanceRange];

  async function change(changes: Partial<Settings>) {
    const result = await mutate((db) => updateSettings(db, changes));
    if (!result.ok) toast.error(result.error);
  }

  return (
    <div className="space-y-3">
      <ToggleGroup
        type="single"
        variant="outline"
        value={settings.attendanceRange}
        onValueChange={(v) => isAttendanceRange(v) && change({ attendanceRange: v })}
        className="w-full"
        aria-label="Grid length"
      >
        <ToggleGroupItem value="3m" className="h-10 flex-1">
          3 months
        </ToggleGroupItem>
        <ToggleGroupItem value="6m" className="h-10 flex-1">
          6 months
        </ToggleGroupItem>
      </ToggleGroup>

      <div className="flex items-center justify-between gap-3">
        <label htmlFor={settings.attendanceStart ? 'attendance-start' : undefined} className="text-sm font-medium">
          Start date
        </label>
        {settings.attendanceStart ? (
          <Input
            id="attendance-start"
            type="date"
            className="h-10 w-auto"
            value={settings.attendanceStart}
            onChange={(e) => parseDayKey(e.target.value) && change({ attendanceStart: e.target.value })}
          />
        ) : (
          <Button
            id="attendance-start"
            variant="outline"
            onClick={() => change({ attendanceStart: dayKey(new Date()) })}
          >
            Set start date
          </Button>
        )}
      </div>

      <p className="text-muted-foreground text-sm">
        {settings.attendanceStart
          ? `The Workout tab shows ${months} months from this date.`
          : `No start date: the Workout tab shows the last ${months} months.`}
      </p>
      {settings.attendanceStart && (
        <Button variant="ghost" size="sm" className="-ml-2" onClick={() => change({ attendanceStart: null })}>
          Clear start date
        </Button>
      )}
    </div>
  );
}
