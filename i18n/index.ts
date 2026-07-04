/**
 * i18n public surface. Screens/components import `strings` — resolved once
 * when this module first loads (~app boot) from the device locale — instead
 * of reading dictionaries or the locale directly (#29).
 */
import { detectLanguage, type Language } from './locale';
import { en, ja, type Strings } from './strings';

const DICTS: Record<Language, Strings> = { en, ja };

export const strings: Strings = DICTS[detectLanguage()];

export { detectLanguage, type Language } from './locale';
export { en, ja, type Strings, type ZaimSkipStrings } from './strings';
