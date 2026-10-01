import Constants from 'expo-constants';
import * as DocumentPicker from 'expo-document-picker';
import { File } from 'expo-file-system';
import { router } from 'expo-router';
import { Alert, StyleSheet, View } from 'react-native';

import { TargetField } from '@/components/target-field';
import { DateField } from '@/components/date-field';
import { ThemedText } from '@/components/themed-text';
import { Button, Card, ListRow, Screen, Segmented, SectionTitle } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { db } from '@/db/client';
import { WEIGHT_UNITS } from '@/db/schema';
import {
  exportBackup,
  exportCsv,
  InvalidBackupError,
  parseBackup,
  restoreBackup,
} from '@/data/backup';
import {
  getAttendanceRange,
  getAttendanceStart,
  getDefaultUnit,
  getNutritionTargets,
  setAttendanceRange,
  setAttendanceStart,
  setDefaultUnit,
  setNutritionTarget,
} from '@/data/settings';
import { useDbQuery } from '@/hooks/use-db-query';
import { dayKey, parseDayKey } from '@/lib/dot-grid';
import { MAX_CALORIES } from '@/lib/nutrition';
import { shareTextFile } from '@/lib/share-file';

const UNIT_OPTIONS = WEIGHT_UNITS.map((u) => ({ value: u, label: u === 'lb' ? 'Pounds (lb)' : 'Kilograms (kg)' }));
const LENGTH_OPTIONS = [
  { value: '3m', label: '3 months' },
  { value: '6m', label: '6 months' },
] as const;

function stamp(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function showError(title: string, e: unknown) {
  Alert.alert(title, e instanceof Error ? e.message : String(e));
}

export default function SettingsTab() {
  const unit = useDbQuery(getDefaultUnit);
  const length = useDbQuery(getAttendanceRange);
  const startKey = useDbQuery(getAttendanceStart);
  const targets = useDbQuery(getNutritionTargets);
  const start = startKey ? parseDayKey(startKey) : null;

  const exportJson = async () => {
    try {
      const json = JSON.stringify(exportBackup(db), null, 2);
      await shareTextFile(`gym-tracker-backup-${stamp()}.json`, json, 'application/json', 'public.json');
    } catch (e) {
      showError('Export failed', e);
    }
  };

  const exportSpreadsheet = async () => {
    try {
      await shareTextFile(`gym-tracker-sets-${stamp()}.csv`, exportCsv(db), 'text/csv', 'public.comma-separated-values-text');
    } catch (e) {
      showError('Export failed', e);
    }
  };

  const restore = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: 'application/json',
        copyToCacheDirectory: true,
      });
      if (result.canceled) return;
      const backup = parseBackup(await new File(result.assets[0].uri).text());
      Alert.alert(
        'Replace all data?',
        `This backup has ${backup.sessions.length} workouts, ${backup.sets.length} sets and ` +
          `${backup.foodEntries.length} food entries. Everything currently on this phone will be replaced.`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Replace',
            style: 'destructive',
            onPress: () => {
              try {
                restoreBackup(db, backup);
                Alert.alert('Restore complete');
              } catch (e) {
                showError('Restore failed — nothing was changed', e);
              }
            },
          },
        ],
      );
    } catch (e) {
      showError(e instanceof InvalidBackupError ? 'Not a valid backup' : 'Restore failed', e);
    }
  };

  return (
    <Screen safeTop>
      <ThemedText type="subtitle">Settings</ThemedText>

      <SectionTitle>Default weight unit</SectionTitle>
      <Segmented options={UNIT_OPTIONS} value={unit} onChange={(u) => setDefaultUnit(db, u)} />
      <ThemedText type="small" themeColor="textSecondary">
        New sets start in this unit, and stats show weights in it. You can still switch any set
        between lb and kg.
      </ThemedText>

      <SectionTitle>Attendance grid</SectionTitle>
      <Card>
        <Segmented
          options={LENGTH_OPTIONS}
          value={length}
          onChange={(r) => setAttendanceRange(db, r)}
        />
        <View style={styles.startRow}>
          <ThemedText>Start date</ThemedText>
          {start ? (
            <DateField value={start} onChange={(date) => setAttendanceStart(db, dayKey(date))} />
          ) : (
            <Button title="Set start date" onPress={() => setAttendanceStart(db, dayKey(new Date()))} />
          )}
        </View>
        <ThemedText type="small" themeColor="textSecondary">
          {start
            ? `The Workout tab shows ${length === '3m' ? '3' : '6'} months from this date.`
            : `No start date: the Workout tab shows the last ${length === '3m' ? '3' : '6'} months.`}
        </ThemedText>
        {start ? (
          <Button
            title="Clear start date"
            variant="plain"
            onPress={() => setAttendanceStart(db, null)}
            style={styles.clear}
          />
        ) : null}
      </Card>

      <SectionTitle>Daily nutrition targets</SectionTitle>
      <Card>
        <TargetField
          label="Calories"
          unit="kcal"
          max={MAX_CALORIES}
          key={`calories:${targets.calories}`}
          value={targets.calories}
          onSave={(v) => setNutritionTarget(db, 'calories', v)}
        />
        <TargetField
          label="Protein"
          unit="g"
          max={2000}
          key={`protein:${targets.protein}`}
          value={targets.protein}
          onSave={(v) => setNutritionTarget(db, 'protein', v)}
        />
        <TargetField
          label="Carbs"
          unit="g"
          max={2000}
          key={`carbs:${targets.carbs}`}
          value={targets.carbs}
          onSave={(v) => setNutritionTarget(db, 'carbs', v)}
        />
        <TargetField
          label="Fat"
          unit="g"
          max={2000}
          key={`fat:${targets.fat}`}
          value={targets.fat}
          onSave={(v) => setNutritionTarget(db, 'fat', v)}
        />
        <ThemedText type="small" themeColor="textSecondary">
          Leave blank for no target. Macros without a target only show once you log them.
        </ThemedText>
      </Card>

      <SectionTitle>Library</SectionTitle>
      <View>
        <ListRow title="Exercises" right="›" onPress={() => router.push('/exercises')} />
        <ListRow title="Muscle groups" right="›" onPress={() => router.push('/muscle-groups')} />
        <ListRow title="Saved foods" right="›" onPress={() => router.push('/foods')} />
      </View>

      <SectionTitle>Backup</SectionTitle>
      <Card>
        <ThemedText type="small" themeColor="textSecondary">
          Your data lives only on this phone. Export a backup now and then — save it to Files or
          iCloud Drive.
        </ThemedText>
        <View style={styles.buttons}>
          <Button title="Export backup (JSON)" variant="primary" onPress={exportJson} />
          <Button title="Export sets (CSV)" onPress={exportSpreadsheet} />
          <Button title="Restore from backup…" variant="danger" onPress={restore} />
        </View>
      </Card>

      <ThemedText type="small" themeColor="textSecondary" style={styles.version}>
        Gym Tracker {Constants.expoConfig?.version ?? ''}
      </ThemedText>
    </Screen>
  );
}

const styles = StyleSheet.create({
  buttons: { gap: Spacing.two },
  startRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 40,
  },
  clear: { alignSelf: 'flex-start', paddingHorizontal: 0 },
  version: { textAlign: 'center', marginTop: Spacing.four },
});
