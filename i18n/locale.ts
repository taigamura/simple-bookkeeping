/**
 * Device-locale detection (#29): Japanese device locale → 'ja', everything
 * else → 'en'. No persisted language field and no Settings control — this
 * deliberately contrasts with theme, which stays manual (build decision 9).
 */
import * as Localization from 'expo-localization';

export type Language = 'ja' | 'en';

/** Pure: the device's locale list → a supported `Language`. */
export function detectLanguage(): Language {
  return Localization.getLocales()[0]?.languageCode === 'ja' ? 'ja' : 'en';
}
