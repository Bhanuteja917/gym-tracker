import { DateTimePicker } from '@expo/ui/community/datetime-picker';

/** Android counterpart of the iOS `DateField`: the Material date picker. */
export function DateField({ value, onChange }: { value: Date; onChange: (date: Date) => void }) {
  return <DateTimePicker value={value} mode="date" onValueChange={(_, date) => onChange(date)} />;
}
