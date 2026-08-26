// Runs the three mechanical checks over the files this work owns. See
// rag/prose-lint.ts for what each one can and cannot decide.

import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'

import { faqEntries } from './faq-cache.js'
import { MAX_COMMENT_WIDTH, MIN_WRAPPED_WIDTH, bannedCopy, commentLayout, undeclaredNumerals } from './prose-lint.js'
import en from '../src/i18n/strings/en.js'

const read = (f: string) => readFileSync(new URL(`../${f}`, import.meta.url), 'utf8')

// Her voice and the tests that hold her to it.
const PROSE_FILES = [
  'rag/persona.ts',
  'rag/prose-lint.ts',
  'rag/faq-audit.test.ts',
  'rag/nodes.test.ts',
  'rag/triage.test.ts',
  'src/i18n/chatVoice.test.ts',
]

// What a visitor reads, restricted to what this work wrote. The banned-pattern
// rule postdates most of the changelog, so the older entries are out of its
// reach on purpose (rag/prose-lint.ts says why).
const MIKA_ENTRY = (file: string) => {
  const src = read(file)
  const start = src.indexOf("id: 'mika-persona'")
  assert.ok(start > 0, `${file} has no mika-persona entry`)
  const after = src.indexOf("id: '", start + 20)
  return [src.slice(start, after > 0 ? after : undefined)]
}

// lastIndexOf, because each strings file opens with a type declaration that has
// a `chat: {` of its own; indexOf lands there and slices the wrong block.
const CHAT_STRINGS = (file: string) => {
  const src = read(file)
  const start = src.lastIndexOf('  chat: {')
  assert.ok(start > 0, `${file} has no chat block`)
  const block = src.slice(start, src.indexOf('\n  },', start))
  assert.ok(block.includes('avatarBubble:'), `${file}: sliced the type declaration, not the strings`)
  return [block]
}

/** Japanese recorded lines, the number four separate comments quote. */
const jaRecordedLines = () => {
  const py = read('scripts/voice_lines.py')
  const block = py.slice(py.indexOf('JA_LINES = ['), py.indexOf('GIGGLE_LINES = ['))
  return (block.match(/^\s{4}\('mika-/gm) ?? []).length
}

const chatKeys = Object.keys(en.chat).length

test('the numerals quoted in comments are measured or declared', () => {
  // Measured from the data the comments are talking about. If an FAQ entry or a
  // recording is added, the number in the comment stops matching and this fails
  // before a reader is misled by it.
  const measured = new Map<string, number>([
    ['cached answers', faqEntries.length],
    ['answer/locale pairs', faqEntries.length * 3],
    ['her recorded lines per locale', jaRecordedLines()],
    ['chat.* keys that are not hers', chatKeys - 3],
    ['comment width ceiling', MAX_COMMENT_WIDTH],
    ['shortest line that is not an orphan', MIN_WRAPPED_WIDTH],
  ])
  assert.deepEqual(
    Object.fromEntries(measured),
    {
      'cached answers': 57,
      'answer/locale pairs': 171,
      'her recorded lines per locale': 25,
      'chat.* keys that are not hers': 37,
      'comment width ceiling': 92,
      'shortest line that is not an orphan': 45,
    },
    'a comment quotes one of these; re-measure and update both',
  )

  // Owned by the counts test at the bottom of faq-audit.test.ts, which measures
  // each one and fails on drift.
  const assertedInFaqAudit = [53, 33, 76, 40, 4, 16]

  // Numbers this data cannot move. Each one is here because it is a constant of
  // something else, not a count of her answers.
  const constants = [
    3, // ZH_INTERJECTION_MAX, and 「第 3 個問題」 inside a quoted example
    5, // the headroom left under the ja ceiling, and 「item 5」 in a quoted incident
    8, // 「第 8 題」 inside a quoted example
    20, // Gemini free tier, requests per day
    71, 114, // round 5: 71 of 114 zh voice lines were rewritten, a historical count
    200, // the ≤200-char ceiling on a visitor's own message
    233, 239, 246, // useChatStream.ts line references
    300, // the transcript clamp in the 2026-08-19 truncation incident
    429, // HTTP status
    649, // chars in the answer that incident truncated
  ]

  const declared = new Set<number>([...measured.values(), ...assertedInFaqAudit, ...constants])
  const findings = PROSE_FILES.flatMap((f) => undeclaredNumerals(f, read(f), declared))
  assert.deepEqual(findings, [], findings.map((f) => `${f.file}:${f.line} ${f.message}`).join('\n'))
})

test('no comment was edited without reflowing its paragraph', () => {
  const findings = PROSE_FILES.flatMap((f) => commentLayout(f, read(f)))
  assert.deepEqual(findings, [], findings.map((f) => `${f.file}:${f.line} ${f.message}`).join('\n'))
})

test('visitor-facing copy carries none of the banned writing patterns', () => {
  const findings = [
    ...['src/data/changelog.en.ts', 'src/data/changelog.zh-TW.ts', 'src/data/changelog.ja.ts'].flatMap(
      (f) => bannedCopy(f, MIKA_ENTRY(f)),
    ),
    ...['src/i18n/strings/en.ts', 'src/i18n/strings/zh-TW.ts', 'src/i18n/strings/ja.ts'].flatMap((f) =>
      bannedCopy(f, CHAT_STRINGS(f)),
    ),
  ]
  assert.deepEqual(findings, [], findings.map((f) => `${f.file} ${f.message}`).join('\n'))
})

// --- the checkers themselves, driven by inputs that are known to be bad -------
// A checker over the current tree is green from the day it lands, which proves
// nothing about whether it can see the defect it was written for. These feed it
// the exact text that shipped, or nearly shipped, in earlier rounds.

test('commentLayout sees the two shapes an unreflowed edit leaves', () => {
  // rag/persona.ts as of 7b18818: an orphan mid-paragraph and a 128-column line,
  // both left by text inserted into an existing block. A reviewer found these by
  // eye after a different one had been fixed by hand.
  const unreflowed = [
    '// ending can sit right before an aside; the cost is this wider misfire. 〜ませ as a polite imperative (いらっしゃいませ) is not',
    '// listed, because ませ also ends 常体 forms like 済ませて.',
  ].join('\n')
  assert.equal(commentLayout('x.ts', unreflowed).length, 1, 'an over-wide line went unseen')

  const orphan = ['// or a final particle', '// (〜ですよ。〜ますね。); 励ますんだ are followed by something else.'].join(
    '\n',
  )
  assert.equal(commentLayout('x.ts', orphan).length, 1, 'a mid-paragraph orphan went unseen')

  // A short line that ENDS a paragraph is not an orphan.
  assert.deepEqual(commentLayout('x.ts', '// one had been fixed.\n//\n// Next paragraph.'), [])
})

test('bannedCopy sees the patterns that reached review', () => {
  // The Japanese paragraph written in round 12 and caught in review before it
  // shipped, with the ではなく frame the global writing rule forbids.
  const ja =
    '`モデルを一切通らない文がほかに三つある。どれも棚卸しではなくレビューで見つかった。`'
  assert.equal(bannedCopy('ja', [ja]).length, 1, 'ではなく went unseen')

  const zh = '`這三句都是 review 抓出來的，不是清單抓出來的，所以每一條文案都得標明身分。`'
  assert.equal(bannedCopy('zh', [zh]).length, 1, 'the 不是 X 而是 Y frame went unseen')

  const en = '`A reviewer found all three, the inventory did not, rather than the list.`'
  assert.equal(bannedCopy('en', [en]).length, 1, 'an English contrast frame went unseen')

  assert.deepEqual(bannedCopy('ok', ['`每個答案都是從他真實的作品集裡撈出來的啦。`']), [])
})

test('undeclaredNumerals sees a count nothing measures', () => {
  const declared = new Set([57])
  // The shape of round 10's finding: a comment saying 52 where the data said 53.
  assert.equal(
    undeclaredNumerals('x.ts', '// her line in the 52 answers whose opener is a voice line', declared).length,
    1,
    'an undeclared count went unseen',
  )
  assert.deepEqual(undeclaredNumerals('x.ts', '// the 57 cached answers', declared), [])
  // Years and single digits are not counts of anything here.
  assert.deepEqual(undeclaredNumerals('x.ts', '// until 2026-08-26 it said 1 thing', declared), [])
})
