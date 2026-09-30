import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';

/** Writes text to a temporary file and opens the share sheet (Save to Files, AirDrop, Mail…). */
export async function shareTextFile(
  filename: string,
  contents: string,
  mimeType: string,
  UTI: string,
): Promise<void> {
  const file = new File(Paths.cache, filename);
  if (file.exists) file.delete();
  file.create();
  file.write(contents);
  await Sharing.shareAsync(file.uri, { mimeType, UTI, dialogTitle: filename });
}
