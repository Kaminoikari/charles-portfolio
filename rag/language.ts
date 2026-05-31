// Deterministic language detection for the tri-locale corpus (en | zh-TW | ja).
//
// An LLM call here would add latency + cost to every question for a problem
// that script detection solves for free and deterministically:
//   - Japanese kana (Hiragana/Katakana) present  -> ja
//   - CJK ideographs present (no kana)            -> zh-TW  (corpus has no zh-CN)
//   - otherwise                                   -> en
//
// Kana presence is what disambiguates Japanese from Chinese — Chinese text never
// contains kana, while Japanese prose almost always does.

export type Locale = 'en' | 'zh-TW' | 'ja'

const KANA = /[぀-ゟ゠-ヿ]/ // Hiragana + Katakana
const CJK = /[一-鿿]/ // CJK Unified Ideographs

export function detectLanguage(text: string): Locale {
  if (KANA.test(text)) return 'ja'
  if (CJK.test(text)) return 'zh-TW'
  return 'en'
}
