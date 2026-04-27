// Locale configuration. Adding a new locale requires:
//  1. add it to LOCALES (and the type derives automatically)
//  2. create src/i18n/strings/<locale>.ts (must satisfy the type from en.ts)
//  3. duplicate the data files in src/data/ as *.<locale>.ts and register
//     them in src/data/index.ts
export const LOCALES = ['en', 'zh-TW', 'ja'] as const
export type Locale = (typeof LOCALES)[number]

export const DEFAULT_LOCALE: Locale = 'en'

// User-facing label rendered inside the language switcher.
export const LOCALE_LABELS: Record<Locale, string> = {
  'en': 'EN',
  'zh-TW': '繁中',
  'ja': '日本語',
}

// Value written to <html lang>. Aligns with BCP-47 conventions.
export const LOCALE_HTML_LANG: Record<Locale, string> = {
  'en': 'en',
  'zh-TW': 'zh-TW',
  'ja': 'ja',
}

// URL prefix for each locale. English is the default and lives at root with
// no prefix; the others are accessed under /<prefix>/...
export const LOCALE_URL_PREFIX: Record<Locale, string> = {
  'en': '',
  'zh-TW': '/zh-TW',
  'ja': '/ja',
}

// localStorage key that remembers the user's last explicit locale choice.
export const LOCALE_STORAGE_KEY = 'portfolio.locale'

export function isLocale(value: unknown): value is Locale {
  return typeof value === 'string' && (LOCALES as readonly string[]).includes(value)
}
