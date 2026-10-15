import { parseDayKey, type DayKey } from './dot-grid';
import { isWeightUnit, type WeightUnit } from './units';

/** How far the attendance grid on the Workout tab reaches. */
export const ATTENDANCE_RANGES = ['3m', '6m'] as const;
export type AttendanceRange = (typeof ATTENDANCE_RANGES)[number];

export const ATTENDANCE_MONTHS: Record<AttendanceRange, number> = {
  '3m': 3,
  '6m': 6,
};
export const ATTENDANCE_WEEKS: Record<AttendanceRange, number> = {
  '3m': 13,
  '6m': 26,
};

export function isAttendanceRange(value: unknown): value is AttendanceRange {
  return value === '3m' || value === '6m';
}

/** The user's preferences. Synced as one record, last write wins. */
export type Settings = {
  defaultUnit: WeightUnit;
  attendanceRange: AttendanceRange;
  /** Start of a fixed attendance window, or null for "the last N months". */
  attendanceStart: DayKey | null;
};

export const DEFAULT_SETTINGS: Settings = {
  defaultUnit: 'lb',
  attendanceRange: '3m',
  attendanceStart: null,
};

/** Settings from stored values, with defaults for anything missing or invalid. */
export function toSettings(raw: {
  defaultUnit?: unknown;
  attendanceRange?: unknown;
  attendanceStart?: unknown;
}): Settings {
  return {
    defaultUnit: isWeightUnit(raw.defaultUnit) ? raw.defaultUnit : DEFAULT_SETTINGS.defaultUnit,
    attendanceRange: isAttendanceRange(raw.attendanceRange) ? raw.attendanceRange : DEFAULT_SETTINGS.attendanceRange,
    attendanceStart:
      typeof raw.attendanceStart === 'string' && parseDayKey(raw.attendanceStart) ? raw.attendanceStart : null,
  };
}
