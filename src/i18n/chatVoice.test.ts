// Three of the strings under chat.* are Mika talking, and no model runs on their
// path: the speech bubble she wears on the page, the invitation the panel opens
// with, and the failure notice, which useChatStream patches into her own message
// bubble (useChatStream.ts:233/239/246) so a dead request makes that string her
// entire turn. The other 37 keys split two ways: the six suggestion chips are the
// visitor's own words and must not sound like her, and the rest is UI chrome —
// labels, aria strings, pipeline node names — which stays written.
//
// Each of the three was found by a reviewer rather than by the suite: the bubble's
// Japanese still said 私 on 2026-08-26 after every other surface had moved to
// あたし, and the other two were still written prose (ja 敬体, zh with no
// sentence-final particle) after the same sweep called the inventory complete.
// That is why the classification below is an assertion and not a comment: a new
// key under chat.* turns the first test red until someone decides which of the
// three groups it belongs to.
//
// The register rules come from rag/persona.ts, and these strings are held to every
// one the 57 cached answers are held to: Japanese stays 常体 and never says 私,
// Chinese ends on a sentence-final particle and carries only that one. Holding
// them to a shorter list is how the first version of this file shipped a failure
// notice that stacked particles the way the cached answers were forbidden to.
// English has no morphological marker to measure — 敬体 and 語氣詞 have no English
// equivalent — so the English strings are held only to what is measurable across
// all three: person, and the emoji ban.

import { describe, expect, test } from 'vitest'

import {
  JA_FORMAL_I,
  JA_POLITE_ENDING,
  ZH_CLAUSE_SEPARATOR,
  ZH_INTERJECTION_MAX,
  ZH_PARTICLE_AT_CLAUSE_END,
  ZH_SPOKEN_ENDING,
} from '../../rag/persona'
import en from './strings/en'
import ja from './strings/ja'
import zhTW from './strings/zh-TW'

const LOCALES = { en: en.chat, 'zh-TW': zhTW.chat, ja: ja.chat } as const

// Spoken by her. Adding one here without writing it in her voice fails below.
const HERS = ['avatarBubble', 'emptyMessage', 'errorMessage'] as const

// Written from the visitor's side, not hers: the six suggestion chips are the
// question a visitor is about to ask, so they must NOT read as Mika.
const VISITOR = ['suggested1', 'suggested2', 'suggested3', 'suggested4', 'suggested5', 'suggested6'] as const

// UI chrome: labels, aria strings, pipeline node names, and the two system
// notices. `regionBlocked` doubles as an aria-label and an input placeholder, so
// it has to read as an interface; `rateLimited` currently has no consumer in src/
// at all, which is a separate defect and not a voice one.
const CHROME = [
  'launcherLabel',
  'launcherTag',
  'openAriaLabel',
  'minimiseAriaLabel',
  'expandAriaLabel',
  'collapseAriaLabel',
  'suggestionsTitle',
  'pipelineTitle',
  'pipelineIdle',
  'pipelineRunningLabel',
  'pipelineInterrupted',
  'nodeTriage',
  'nodeConverse',
  'nodeRetrieve',
  'nodeGradeDocuments',
  'nodeRewriteQuery',
  'nodeGenerate',
  'nodeFallback',
  'clearLabel',
  'title',
  'subtitle',
  'previewLabel',
  'inputPlaceholder',
  'send',
  'sendAriaLabel',
  'thinking',
  'sourcesLabel',
  'sourcesCount',
  'rateLimited',
  'regionBlocked',
  'retry',
]

const INTRODUCES_HERSELF = ['avatarBubble', 'emptyMessage'] as const

const lines = (key: string) =>
  Object.entries(LOCALES).map(([locale, chat]) => [locale, (chat as Record<string, string>)[key]] as const)

describe('the chat strings that are her talking', () => {
  test("every key under chat.* is classified as hers, as the visitor's, or as chrome", () => {
    const classified = [...HERS, ...VISITOR, ...CHROME].sort()
    for (const [locale, chat] of Object.entries(LOCALES)) {
      expect(Object.keys(chat).sort(), `${locale} has an unclassified chat string`).toEqual(classified)
    }
  })

  test('the suggestion chips stay in the visitor\'s voice', () => {
    for (const key of VISITOR) {
      for (const [locale, line] of lines(key)) {
        expect(line, `${locale} ${key} speaks as her`).not.toMatch(/Mika|ミカ|あたし/)
      }
    }
  })

  test('the bubble names her, in every locale', () => {
    for (const [locale, line] of lines('avatarBubble')) {
      expect(line, `${locale} bubble does not name her`).toMatch(/Mika|ミカ/)
    }
  })

  test('she speaks in the first person where she addresses the visitor', () => {
    for (const key of INTRODUCES_HERSELF) {
      for (const [locale, line] of lines(key)) {
        expect(line, `${locale} ${key} is not first-person`).toMatch(/\bI\b|I'm|\bme\b|\bmy\b|我|あたし/)
      }
    }
  })

  test('the Japanese strings never say 私 and stay 常体', () => {
    for (const key of HERS) {
      const line = LOCALES.ja[key]
      expect(JA_FORMAL_I.test(line), `ja ${key} says 私: ${line}`).toBe(false)
      expect(JA_POLITE_ENDING.test(line), `ja ${key} is 敬体: ${line}`).toBe(false)
    }
  })

  test('the Chinese strings end the way speech does', () => {
    for (const key of HERS) {
      const line = LOCALES['zh-TW'][key]
      expect(ZH_SPOKEN_ENDING.test(line), `zh ${key} ends like written prose: ${line}`).toBe(true)
    }
  })

  // The same rule faq-audit.test.ts holds the 57 cached answers to: a particle may
  // sit in a leading interjection of three characters or fewer, or at the very end.
  // One in between is the caricature 71 zh voice lines were rewritten to remove.
  test('the Chinese strings never stack particles mid-sentence', () => {
    for (const key of HERS) {
      const line = LOCALES['zh-TW'][key]
      const clauses = line.trim().split(ZH_CLAUSE_SEPARATOR)
      for (let i = 0; i < clauses.length - 1; i++) {
        if (i === 0 && clauses[0].length <= ZH_INTERJECTION_MAX) continue
        expect(
          ZH_PARTICLE_AT_CLAUSE_END.test(clauses[i]),
          `zh ${key} stacks particles mid-sentence: ${line}`,
        ).toBe(false)
      }
    }
  })

  // Zero, not a budget of one. The ceiling used to be 1 for the two introductions
  // and 0 for the failure notice, which was the register in force until the owner's
  // 2026-08-27 spec made "全文禁用任何 Emoji 表情符號" a red line; rag/persona.ts now tells
  // the model the same thing. The one pictograph left in her copy anywhere is the
  // 🔗 that marks a project link inside a hand-written cached answer, and no
  // chat.* string is one of those.
  test('carries no emoji at all, in any locale', () => {
    for (const key of HERS) {
      for (const [locale, line] of lines(key)) {
        const emoji = line.match(/\p{Extended_Pictographic}/gu) ?? []
        expect(emoji, `${locale} ${key} carries ${emoji.length} emoji`).toEqual([])
      }
    }
  })
})
