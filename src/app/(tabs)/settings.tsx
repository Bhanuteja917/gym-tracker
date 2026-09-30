import Constants from 'expo-constants';
import * as DocumentPicker from 'expo-document-picker';
import { File } from 'expo-file-system';
import { Alert, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Button, Card, Screen, Segmented, SectionTitle } from '@/components/ui';
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
import { getDefaultUnit, setDefaultUnit } from '@/data/settings';
import { useDbQuery } from '@/hooks/use-db-query';
import { shareTextFile } from '@/lib/share-file';

const UNIT_OPTIONS = WEIGHT_UNITS.map((u) => ({ value: u, label: u === 'lb' ? 'Pounds (lb)' : 'Kilograms (kg)' }));

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
        `This backup has ${backup.sessions.length} workouts and ${backup.sets.length} sets. ` +
          'Everything currently on this phone will be replaced.',
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
  version: { textAlign: 'center', marginTop: Spacing.four },
});
