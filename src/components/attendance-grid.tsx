import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Card } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { getGymDays } from '@/data/attendance';
import { getAttendanceRange, getAttendanceStart, type AttendanceRange } from '@/data/settings';
import { useDbQuery } from '@/hooks/use-db-query';
import { useNow } from '@/hooks/use-now';
import { useTheme } from '@/hooks/use-theme';
import { blockRange, buildGrid, parseDayKey, rollingRange } from '@/lib/dot-grid';

const MONTHS: Record<AttendanceRange, number> = { '3m': 3, '6m': 6 };
const WEEKS: Record<AttendanceRange, number> = { '3m': 13, '6m': 26 };

const DAY_LABELS = ['M', '', 'W', '', 'F', '', ''];
const LABEL_WIDTH = 16;
const MONTH_ROW_HEIGHT = 16;
const MAX_DOT = 18;

const plural = (n: number) => (n === 1 ? 'day' : 'days');
const shortDate = (date: Date, withYear: boolean) =>
  date.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    ...(withYear ? { year: 'numeric' } : {}),
  });

/**
 * GitHub-style grid of weeks with a filled dot for each day with a finished
 * workout. Covers the last 3 or 6 months, or a fixed window from the start date
 * chosen in Settings.
 */
export function AttendanceGrid() {
  const theme = useTheme();
  const [width, setWidth] = useState(0);
  const now = useNow(60_000); // so "today" moves on at midnight
  const length = useDbQuery(getAttendanceRange);
  const startKey = useDbQuery(getAttendanceStart);

  const today = new Date(now);
  const start = startKey ? parseDayKey(startKey) : null;
  const range = start ? blockRange(start, MONTHS[length]) : rollingRange(today, WEEKS[length]);
  const weeks = buildGrid(range, today);

  const from = range.from.getTime();
  const to = new Date(range.to.getFullYear(), range.to.getMonth(), range.to.getDate() + 1).getTime();
  const gymDays = useDbQuery((d) => getGymDays(d, from, to));

  const count = gymDays.size;
  const totalDays = weeks.reduce((n, w) => n + w.days.filter((x) => x.inRange).length, 0);
  const title = start ? `${count} of ${totalDays} ${plural(totalDays)}` : `${count} ${plural(count)}`;
  const subtitle = start
    ? `${shortDate(range.from, range.from.getFullYear() !== range.to.getFullYear())} – ${shortDate(range.to, true)}`
    : `in the last ${MONTHS[length]} months`;

  const cell = width > 0 ? Math.min((width - LABEL_WIDTH) / weeks.length, MAX_DOT / 0.7) : 0;
  const dot = Math.floor(cell * 0.7);

  return (
    <Card>
      <View>
        <ThemedText style={{ fontWeight: 600 }}>{title}</ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          {subtitle}
        </ThemedText>
      </View>

      <View
        onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
        accessible
        accessibilityLabel={`Went to the gym on ${title}, ${subtitle}`}>
        {cell > 0 ? (
          <>
            <View style={[styles.months, { marginLeft: LABEL_WIDTH }]}>
              {weeks.map((w, i) =>
                w.month === null ? null : (
                  <ThemedText
                    key={w.days[0].key}
                    type="small"
                    themeColor="textSecondary"
                    style={[styles.month, { left: i * cell }]}>
                    {new Date(2000, w.month, 1).toLocaleDateString(undefined, { month: 'short' })}
                  </ThemedText>
                ),
              )}
            </View>
            <View style={styles.row}>
              <View style={{ width: LABEL_WIDTH }}>
                {DAY_LABELS.map((label, i) => (
                  <View key={i} style={[styles.center, { height: cell }]}>
                    <ThemedText type="small" themeColor="textSecondary" style={styles.dayLabel}>
                      {label}
                    </ThemedText>
                  </View>
                ))}
              </View>
              {weeks.map((w) => (
                <View key={w.days[0].key}>
                  {w.days.map((day) => (
                    <View key={day.key} style={[styles.center, { width: cell, height: cell }]}>
                      {day.inRange ? (
                        <View
                          style={{
                            width: dot,
                            height: dot,
                            borderRadius: dot / 2,
                            backgroundColor: gymDays.has(day.key)
                              ? theme.accent
                              : theme.backgroundSelected,
                            opacity: day.future ? 0.4 : 1,
                            borderWidth: day.today ? (dot < 12 ? 1 : 2) : 0,
                            borderColor: theme.text,
                          }}
                        />
                      ) : null}
                    </View>
                  ))}
                </View>
              ))}
            </View>
          </>
        ) : null}
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  months: { height: MONTH_ROW_HEIGHT, marginBottom: Spacing.one },
  month: { position: 'absolute', fontSize: 11, lineHeight: MONTH_ROW_HEIGHT },
  row: { flexDirection: 'row' },
  center: { alignItems: 'center', justifyContent: 'center' },
  dayLabel: { fontSize: 10, lineHeight: 12 },
});
