/**
 * shareTextFile — writes UTF-8 text to a cache file and hands it to the
 * system share sheet (expo-sharing). Reused by the CSV export (#24) and the
 * corrupt-load safety net's "Export unreadable backup" row (#28).
 *
 * RN Web has no native share sheet (expo-sharing's web shim only wraps
 * `navigator.share`, which is gated to secure contexts and rarely present in
 * dev), so web instead triggers a normal browser download via an object URL —
 * consistent with this project's existing web-fallback pattern for native-only
 * APIs (see `nav/Root.tsx`'s `notify`/`confirm`).
 */
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { Platform } from 'react-native';

export async function shareTextFile(filename: string, contents: string): Promise<void> {
  if (Platform.OS === 'web') {
    shareTextFileWeb(filename, contents);
    return;
  }

  const file = new File(Paths.cache, filename);
  file.create({ overwrite: true });
  file.write(contents);

  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(file.uri);
  }
}

function shareTextFileWeb(filename: string, contents: string) {
  const blob = new Blob([contents], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}
