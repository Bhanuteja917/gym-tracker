import { Alert, Linking } from 'react-native';

/** Opens an exercise video link; YouTube links open in the YouTube app when installed. */
export async function openVideo(url: string): Promise<void> {
  try {
    await Linking.openURL(url);
  } catch {
    Alert.alert('Could not open video', url);
  }
}
