// Runs the mechanical checks over the files this work owns. See
// rag/prose-lint.ts for what each one can and cannot decide.

import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'

import { faqEntries } from './faq-cache.js'
import { JA_POLITE_ENDING } from './persona.js'
import {
  MAX_COMMENT_WIDTH,
  MIN_WRAPPED_WIDTH,
  bannedCopy,
  commentLayout,
  quotedNumerals,
  stackedDocblocks,
  undeclaredNumerals,
} from './prose-lint.js'
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
  'rag/prose-lint.test.ts',
]

// What a visitor reads, restricted to what this work wrote. The banned-pattern
// rule postdates most of the changelog, so the older entries are out of its
// reach on purpose (rag/prose-lint.ts says why).
// The changelog entries this work wrote. bannedCopy reads only what this list
// names, so an entry left out of it is an entry nothing checks: add the id here
// the day the entry ships.
const MIKA_ENTRY_IDS = ['mika-gal-register', 'mika-persona']

const MIKA_ENTRY = (file: string) =>
  MIKA_ENTRY_IDS.map((id) => {
    const src = read(file)
    const start = src.indexOf(`id: '${id}'`)
    assert.ok(start > 0, `${file} has no ${id} entry`)
    const after = src.indexOf("id: '", start + 20)
    return src.slice(start, after > 0 ? after : undefined)
  })

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

// Two numbers a comment quotes that the data can move. They were exempted once,
// while each happened to equal a count asserted in faq-audit.test.ts; when those
// counts moved on 2026-08-27 the cover went with them, and an exemption is
// exactly what this file exists to refuse. Measured here instead.
const jaVoiceLineOpeners = () =>
  faqEntries.length - faqEntries.filter((e) => JA_POLITE_ENDING.test(e.answers.ja.split('\n\n')[0])).length
const philosophyLeadIn = () =>
  (faqEntries.find((e) => e.id === 'philosophy')?.answers.en.split('\n\n')[1] ?? '').length

test('the numerals quoted in comments are measured or declared', () => {
  // Measured from the data the comments are talking about. If an FAQ entry or a
  // recording is added, the number in the comment stops matching and this fails
  // before a reader is misled by it.
  const measured = new Map<string, number>([
    ['cached answers', faqEntries.length],
    ['answer/locale pairs', faqEntries.length * 3],
    ['her recorded lines per locale', jaRecordedLines()],
    ['chat.* keys that are not hers', chatKeys - 3],
    ['ja openers that are nothing but a voice line', jaVoiceLineOpeners()],
    ["chars in philosophy's English lead-in", philosophyLeadIn()],
  ])
  // Not measurements: this module's own thresholds. They are asserted here
  // because the fixtures below are written around these exact values, so moving
  // one silently would make those fixtures test nothing.
  assert.equal(MAX_COMMENT_WIDTH, 92)
  assert.equal(MIN_WRAPPED_WIDTH, 45)
  assert.deepEqual(
    Object.fromEntries(measured),
    {
      'cached answers': 57,
      'answer/locale pairs': 171,
      'her recorded lines per locale': 25,
      'chat.* keys that are not hers': 37,
      'ja openers that are nothing but a voice line': 53,
      "chars in philosophy's English lead-in": 33,
    },
    'a comment quotes one of these; re-measure and update both',
  )

  // Owned by the counts test at the bottom of faq-audit.test.ts, which measures
  // each one and fails on drift.
  const assertedInFaqAudit = [51, 30, 76, 40, 4, 19]

  // Numbers this data cannot move. Each one is here because it is a constant of
  // something else, not a count of her answers.
  const constants = [
    3, // ZH_INTERJECTION_MAX, and 「第 3 個問題」 inside a quoted example
    5, // 「4 becomes 5」 in the ja-opener arithmetic, and 「item 5」 in a quoted incident
    8, // 「第 8 題」 inside a quoted example
    20, // Gemini free tier, requests per day
    71, 114, // round 5: 71 of 114 zh voice lines were rewritten, a historical count
    200, // the ≤200-char ceiling on a visitor's own message
    233, // useChatStream.ts:233/239/246; the lookbehind yields only the first
    128, // the display width of the over-long line a fixture below quotes verbatim
    52, // the count a fixture below quotes as the shape of a stale-number finding
    300, // the transcript clamp in the 2026-08-19 truncation incident
    429, // HTTP status
    649, // chars in the answer that incident truncated
  ]

  const declared = new Set<number>([...measured.values(), ...assertedInFaqAudit, ...constants])
  const findings = PROSE_FILES.flatMap((f) => undeclaredNumerals(f, read(f), declared))
  assert.deepEqual(findings, [], findings.map((f) => `${f.file}:${f.line} ${f.message}`).join('\n'))

  // The other direction. A declaration nobody quotes exempts that number from
  // the check forever, and reads as a fact about the code that is not one.
  const quoted = quotedNumerals(PROSE_FILES.map(read))
  const dead = [...declared].filter((n) => !quoted.has(n)).sort((a, b) => a - b)
  assert.deepEqual(dead, [], `declared but quoted nowhere: ${dead.join(', ')}`)
})

test('no block comment opens where another one closed', () => {
  const findings = PROSE_FILES.flatMap((f) => stackedDocblocks(f, read(f)))
  assert.deepEqual(findings, [], findings.map((f) => `${f.file}:${f.line} ${f.message}`).join('\n'))

  // The shape three reviewers found by eye, each time after an edit moved a
  // function in above the one a docblock belonged to.
  const stacked = ['/**', ' * One thing.', ' */', '/**', ' * A different thing.', ' */', 'const x = 1'].join('\n')
  assert.equal(stackedDocblocks('x.ts', stacked).length, 1, 'stacked docblocks went unseen')
  // A one-liner on either side of the seam counts too.
  assert.equal(stackedDocblocks('x.ts', '/** One thing. */\n/** Another. */\nconst x = 1').length, 1)
  // A fixture asserting a lone docblock goes unreported used to sit here. The
  // sweep above is already that assertion: `prose-lint.ts` and this file close
  // block comments that no other comment follows, so anything that reports a
  // lone one turns the sweep red. Measured across the baseline and the three
  // mutations that reach this check, keeping the fixture or dropping it gave the
  // same four results, so it pinned nothing of its own.
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
// nothing about whether it can see the defect it was written for. The layout
// fixtures are the exact lines a reviewer found by hand in persona.ts; the rest
// are written to drive one branch each, because a pattern nothing exercises can
// be deleted with the suite still green.

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

  // Block comments are prose too. rag/prose-lint.ts is written in them, and
  // reading only `//` left those outside the check while the plan said otherwise.
  const jsdoc = [
    '/**',
    ' * A polite form is followed by terminal punctuation, a colon, a trailing 〜／ー／…, a bracket or a quote on either side, or a final particle.',
    ' * or a final particle',
    ' * and the rest of the sentence continues here.',
    ' */',
  ].join('\n')
  const inBlock = commentLayout('x.ts', jsdoc)
  assert.equal(inBlock.filter((f) => f.message.includes('columns, over')).length, 1, 'a wide JSDoc line went unseen')
  assert.equal(inBlock.filter((f) => f.message.includes('orphan')).length, 1, 'a JSDoc orphan went unseen')
  // The delimiters carry no prose, so they are not orphans.
  assert.deepEqual(commentLayout('x.ts', '/**\n * One sentence.\n */'), [])

  // A line carrying a trailing comment is measured for width. It is not a
  // wrapped paragraph, so the orphan rule does not apply to it.
  const trailing = `  const ceiling = 92 // this annotation runs well past the ninety-two column ceiling the check enforces`
  assert.equal(commentLayout('x.ts', trailing).length, 1, 'a wide trailing comment went unseen')
  assert.deepEqual(commentLayout('x.ts', 'const a = 1 // short\n// next line of prose'), [])
})

// Every alternative in every banned pattern, one fixture each. The first
// version drove three of the ten, so every other branch could be deleted with
// the suite still green. The em-dash rule was among them, and it is the one the
// writing rule names first, as well as the one CJK copy breaks most often.
const BANNED_FIXTURES: Array<[string, string]> = [
  ['spaced em-dash', '`她掛在角色旁邊的對話泡泡 — 面板打開時的那句邀請也是。`'],
  ['doubled em-dash', '`這三句都是 review 找出來的——面板裡的每一條文案都得標明身分。`'],
  ['ではなく', '`モデルを一切通らない文が、どれも棚卸しではなくレビューで見つかりました。`'],
  ['不是 X 而是 Y', '`這不是清單抓出來的，而是 review 抓出來的。`'],
  ['而非', '`判準是她的錄音而非書面語法。`'],
  ['是 X，不是 Y', '`這三句都是 review 抓出來的，不是清單抓出來的。`'],
  ['not X but', '`It is not a demo but a product.`'],
  ['comma not', '`A reviewer found all three, not the inventory.`'],
  ['rather than', '`We rewrote each locale rather than translating one.`'],
  ['instead of', '`She ends on a particle instead of a full stop.`'],
]

test('bannedCopy sees every pattern it declares', () => {
  for (const [name, passage] of BANNED_FIXTURES) {
    assert.equal(bannedCopy('fixture', [passage]).length, 1, `the ${name} frame went unseen`)
  }
  // Copy that is actually shipping, in all three languages, stays clean.
  assert.deepEqual(
    bannedCopy('ok', [
      '`每個答案都是從他真實的作品集裡撈出來的啦。`',
      '`答えはぜんぶ、あたしが彼の実際のポートフォリオから引っぱってくるよ。`',
      "`Every answer comes straight out of his portfolio.`",
    ]),
    [],
  )
})

test('undeclaredNumerals sees a count nothing measures', () => {
  const declared = new Set([57])
  // The shape of an earlier finding: a comment saying 52 where the data said 53.
  assert.equal(
    undeclaredNumerals('x.ts', '// her line in the 52 answers whose opener is a voice line', declared).length,
    1,
    'an undeclared count went unseen',
  )
  assert.deepEqual(undeclaredNumerals('x.ts', '// the 57 cached answers', declared), [])
  // A numeral ending a sentence. The lookahead has to exclude a decimal point
  // without excluding a full stop; excluding both made this invisible.
  assert.equal(
    undeclaredNumerals('x.ts', '// the comment said 52.', declared).length,
    1,
    'a count at the end of a sentence went unseen',
  )
  // A decimal is a single number. The lookahead has to reject the integer part
  // when a fraction follows it; `15.5` is what drives that half, because in
  // `1.5` the integer is filtered as too small anyway.
  assert.deepEqual(undeclaredNumerals('x.ts', '// a ratio of 15.5 is not a count', declared), [])
  assert.deepEqual(undeclaredNumerals('x.ts', '// a ratio of 1.5 is not a count', declared), [])
  // A trailing comment is where a declaration list keeps its reasons, so it is
  // where an undeclared number hides best. This one escaped until a reviewer
  // read the list by eye.
  assert.equal(
    undeclaredNumerals('x.ts', '    128, // the width of the line round 17 found by hand', declared).length,
    1,
    'a count in a trailing comment went unseen',
  )
  // A comment inside a string literal is data about the code, so reading it as
  // prose about the code makes the sweep fail on its own fixtures. Quote
  // tracking is the only thing standing between those two readings.
  assert.deepEqual(
    undeclaredNumerals('x.ts', "    expect(lint('  128, // 99 of them', d)).toEqual([])", declared),
    [],
  )
  // Years and single digits are not counts of anything here.
  assert.deepEqual(undeclaredNumerals('x.ts', '// until 2026-08-26 it said 1 thing', declared), [])
})
