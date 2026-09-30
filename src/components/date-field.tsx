import { DatePicker, Host } from '@expo/ui/swift-ui';
import { datePickerStyle } from '@expo/ui/swift-ui/modifiers';

/**
 * A compact native date picker that takes only as much width as it needs, so it
 * can be aligned like any other control. (The cross-platform `DateTimePicker`
 * only sizes itself vertically on iOS and leaves the button centred.)
 */
export function DateField({ value, onChange }: { value: Date; onChange: (date: Date) => void }) {
  return (
    <Host matchContents>
      <DatePicker
        selection={value}
        displayedComponents={['date']}
        onDateChange={onChange}
        modifiers={[datePickerStyle('compact')]}
      />
    </Host>
  );
}
