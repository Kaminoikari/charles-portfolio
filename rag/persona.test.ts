// Which parts of Mika's voice travel to which language. Offline, no network:
//   npm run rag:test
//
// Until 2026-09-16 the voice block shipped all three locales' example lines in
// every prompt. On five production probes of the English question "What skills
// does Charles list on his site?", three came back in the wrong language: two in
// Chinese and one in Japanese, with `language` correctly detected as `en` and
// all six retrieved sources in `:en`. The drifting replies opened on
// 「お、それ聞いちゃう？」 and used 「整理給你」 and 「超級」, which are not the
// model improvising in another language: they are the exact strings this file
// hands it as examples of what to say.
//
// Hence the rule these tests hold: an example of WHAT TO SAY is written in one
// language and only reaches that language. A BANNED term still travels to every
// language, because a prohibition is not something to copy, and none of the
// three strings the incident produced was one.

import { test } from 'node:test'
import assert from 'node:assert/strict'

import { mikaVoice } from './persona.js'
import type { Locale } from './language.js'

const LOCALES: Locale[] = ['en', 'zh-TW', 'ja']

// Positive examples, quoted from the two regions that carry them: the per-
// language bullet, and the "looking something up is…" replacements. Two sources
// per language, so gating one region and forgetting the other stays visible.
const EXAMPLES = {
  ja: ['お、それ聞いちゃう？', '自分のために作ったツール'],
  'zh-TW': ['包在 Mika 身上', '整理給你'],
  en: ['Ooh, good question! On it!'],
} as const

test('the voice block sends an example only to the language it is written in', () => {
  for (const locale of LOCALES) {
    const voice = mikaVoice(locale)
    for (const [exampleLocale, examples] of Object.entries(EXAMPLES)) {
      for (const example of examples) {
        assert.equal(
          voice.includes(example),
          exampleLocale === locale,
          `mikaVoice('${locale}') ${voice.includes(example) ? 'carries' : 'is missing'} the ` +
            `${exampleLocale} example ${JSON.stringify(example)}`,
        )
      }
    }
  }
})

test('every language still gets a voice of its own', () => {
  // Gating must not empty the block out: whatever a locale loses, it keeps the
  // bullet that tells it how to open and close.
  for (const locale of LOCALES) {
    assert.match(mikaVoice(locale), /Open on /, `mikaVoice('${locale}') lost its opener guidance`)
  }
})

test('a rule that is not an example reaches every language', () => {
  // The emoji ban, the service-desk ban and the precedence rule are prohibitions
  // and constraints, so they are not language-specific and nothing in the
  // incident came from one. Gating by mistake would silently drop them.
  for (const locale of LOCALES) {
    const voice = mikaVoice(locale)
    assert.match(voice, /NEVER use an emoji/, `mikaVoice('${locale}') lost the emoji ban`)
    assert.match(voice, /Never sound like a service desk/, `mikaVoice('${locale}') lost the service-desk ban`)
    assert.match(voice, /Your voice never bends a fact/, `mikaVoice('${locale}') lost the precedence rule`)
  }
})
