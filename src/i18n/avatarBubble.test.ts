// The speech bubble Mika wears on the page is the seventh surface that reaches a
// visitor with no model in the path, after the five canned replies in triage.ts,
// the cached FAQ answers, and the two strings in nodes.ts. It is the one a visitor
// reads without asking anything at all, and until 2026-08-26 its Japanese said
// 私 while every other surface had been moved to あたし. It had no test then, which
// is why a reviewer found it rather than the suite (docs/plans/mika-persona.md).
//
// The rules come from rag/persona.ts, the same definitions the cached answers are
// held to, so her register cannot mean one thing here and another there.

import { describe, expect, test } from 'vitest'

import { JA_FORMAL_I, JA_POLITE_ENDING } from '../../rag/persona'
import en from './strings/en'
import ja from './strings/ja'
import zhTW from './strings/zh-TW'

const BUBBLES = {
  en: en.chat.avatarBubble,
  'zh-TW': zhTW.chat.avatarBubble,
  ja: ja.chat.avatarBubble,
} as const

describe('the avatar speech bubble', () => {
  test('names her, in every locale', () => {
    for (const [locale, bubble] of Object.entries(BUBBLES)) {
      expect(bubble, `${locale} bubble does not name her`).toMatch(/Mika|ミカ/)
    }
  })

  test('speaks in the first person, in every locale', () => {
    for (const [locale, bubble] of Object.entries(BUBBLES)) {
      expect(bubble, `${locale} bubble is not first-person`).toMatch(/\bI\b|I'm|我|あたし/)
    }
  })

  test('the Japanese bubble says あたし and stays 常体', () => {
    expect(JA_FORMAL_I.test(BUBBLES.ja), `bubble says 私: ${BUBBLES.ja}`).toBe(false)
    expect(JA_POLITE_ENDING.test(BUBBLES.ja), `bubble is 敬体: ${BUBBLES.ja}`).toBe(false)
  })

  test('carries at most one emoji, like any line of hers', () => {
    for (const [locale, bubble] of Object.entries(BUBBLES)) {
      const emoji = bubble.match(/\p{Extended_Pictographic}/gu) ?? []
      expect(emoji.length, `${locale} bubble carries ${emoji.length} emoji`).toBeLessThanOrEqual(1)
    }
  })
})
