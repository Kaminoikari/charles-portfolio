import type { Locale } from '../config'
import en, { type Strings } from './en'
import zhTW from './zh-TW'
import ja from './ja'

export type { Strings }

export const STRINGS: Record<Locale, Strings> = {
  'en': en,
  'zh-TW': zhTW,
  'ja': ja,
}
