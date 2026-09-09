import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import ar from './locales/ar.json';
import en from './locales/en.json';

/**
 * i18n foundation (Architecture Decisions D16 / D17).
 *
 * No user-facing string is hard-coded in components — every string goes through
 * a translation key. Adding a new language later is just another locale file.
 */
export const SUPPORTED_LANGUAGES = ['en', 'ar'] as const;
export type SupportedLanguage = (typeof SUPPORTED_LANGUAGES)[number];

export const DEFAULT_LANGUAGE: SupportedLanguage = 'en';

/** Languages that render right-to-left. */
const RTL_LANGUAGES: ReadonlySet<string> = new Set<string>(['ar']);

export function directionOf(language: string): 'rtl' | 'ltr' {
  return RTL_LANGUAGES.has(language) ? 'rtl' : 'ltr';
}

void i18n.use(initReactI18next).init({
  resources: {
    en: { translation: en },
    ar: { translation: ar },
  },
  lng: DEFAULT_LANGUAGE,
  fallbackLng: DEFAULT_LANGUAGE,
  interpolation: { escapeValue: false },
});

export default i18n;
