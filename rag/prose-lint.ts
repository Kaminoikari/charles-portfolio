// The three defect classes that eighteen rounds of review kept finding by eye,
// turned into checks a machine runs first (docs/plans/mika-persona.md, the
// "PASS 的定義" section).
//
// Every round from the thirteenth on ended FAIL, and roughly half of each
// round's findings were created by the previous round's fix: a comment reflowed
// and left an orphan line, a count corrected in one paragraph and left wrong in
// the next, a changelog paragraph rewritten into the register it was fixing. A
// human reviewer finds two or three of those per pass out of a search space of
// every comment and every changelog line, so the pass never converges. These
// functions take file contents and return findings, so the whole space is
// checked every run and a reviewer cannot be the one to notice.
//
// What each check does NOT do is stated with it. None of them can judge whether
// a sentence is true; they close the classes where truth is mechanical.

export type Finding = { file: string; line: number; message: string }

/**
 * A line of comment prose, in either comment style. The first version read only
 * `//`, which left the JSDoc blocks in this very file outside the checks while
 * the plan claimed every comment line was covered. The opening and closing
 * delimiters of a block comment, and blank continuation lines, carry no prose,
 * so they are not measured.
 */
/**
 * The prose in a trailing comment, or null if the line has none. Quote-aware,
 * because a fixture in this suite holds a line WITH a trailing comment inside a
 * string literal, and reading that as prose about the code makes the sweep fail
 * on its own test data.
 */
export const trailingComment = (raw: string): string | null => {
  let quote: string | null = null
  for (let i = 0; i < raw.length; i++) {
    const c = raw[i]
    if (quote) {
      if (c === '\\') i++
      else if (c === quote) quote = null
      continue
    }
    if (c === '"' || c === "'" || c === '`') quote = c
    else if (c === '/' && raw[i + 1] === '/' && /\s/.test(raw[i - 1] ?? '')) return raw.slice(i + 2)
  }
  return null
}

export const isProseLine = (raw: string): boolean => {
  const t = raw.trim()
  if (t === '//' || t === '*' || t === '*/' || t === '/**' || t === '/*') return false
  return t.startsWith('//') || t.startsWith('*') || t.startsWith('/**') || t.startsWith('/*')
}

/** Display columns, counting CJK and full-width punctuation as two. */
export const displayWidth = (s: string): number =>
  [...s].reduce((n, c) => n + (/[ᄀ-ᅟ⺀-꓏가-힣豈-﫿︰-﹏＀-｠￠-￦]/.test(c) ? 2 : 1), 0)

export const MAX_COMMENT_WIDTH = 92
// A wrapped line this short in the middle of a paragraph is text inserted into
// an existing block without reflowing it, which is how every orphan so far got
// here. A paragraph's LAST line is allowed to be short, so the check only fires
// when another prose line follows.
export const MIN_WRAPPED_WIDTH = 45

/**
 * Comment lines that were edited without reflowing the paragraph. Blank comment
 * lines (`//`) are paragraph breaks and end a paragraph, so a short line before
 * one is a normal last line. Does not judge wording, only geometry.
 */
export function commentLayout(file: string, source: string): Finding[] {
  const lines = source.split('\n')
  const out: Finding[] = []
  lines.forEach((line, i) => {
    if (!isProseLine(line)) return
    const w = displayWidth(line)
    if (w > MAX_COMMENT_WIDTH) {
      out.push({ file, line: i + 1, message: `comment line is ${w} columns, over ${MAX_COMMENT_WIDTH}` })
    }
    if (w < MIN_WRAPPED_WIDTH && isProseLine(lines[i + 1] ?? '')) {
      out.push({ file, line: i + 1, message: `orphan line of ${w} columns in the middle of a paragraph` })
    }
  })
  return out
}

// Written by the user, in ~/.claude/CLAUDE.md: no dash standing in for a pause
// mid-sentence, and no "X, not Y" contrast frame in any of the three languages.
//
// The rule postdates most of this site's copy: the changelog's older entries
// carry it throughout, and rewriting those is not this work. So the caller
// passes the text this work owns (the mika-persona entry, the chat strings)
// rather than whole files, and the older copy is left alone until someone
// decides to sweep it.
const BANNED_COPY: Array<[RegExp, string]> = [
  [/[^\s]\s—\s[^\s]|——/u, 'an em-dash used as a mid-sentence pause'],
  [/ではなく/u, 'the ではなく contrast frame'],
  [/不是[^。！？]{0,25}而是|而非|是[^，。！？]{1,25}，不是/u, 'the 不是 X 而是 Y contrast frame'],
  [/\bnot [a-z ]+ but\b|, not |\brather than\b|\binstead of\b/i, 'an English contrast frame'],
]

/** Banned writing patterns in one passage of visitor-facing copy. */
export function bannedCopy(file: string, passages: readonly string[]): Finding[] {
  const out: Finding[] = []
  passages.forEach((passage, i) => {
    for (const [re, what] of BANNED_COPY) {
      if (re.test(passage)) out.push({ file, line: i + 1, message: `passage ${i + 1} carries ${what}` })
    }
  })
  return out
}

/**
 * Numerals quoted in comments. A number in prose beside the data it counts has
 * drifted in five separate rounds, always silently, because nothing reads it.
 * Every numeral above 1 has to be declared: either it is measured from the data
 * here, or it is registered as a constant that this data cannot move (a line
 * reference, a character ceiling, an API quota, a number inside a quoted
 * example). An undeclared one fails, which forces the choice at the moment the
 * number is written.
 *
 * The limit, stated so nobody reads more into a green run: this catches a NEW
 * number appearing unaccounted for, and it keeps the measured ones true. It
 * cannot catch a false sentence built out of a number that is already declared.
 */
/** Every numeral in one line of prose that is a count of something. */
const countsIn = (prose: string): number[] =>
  (prose.match(/(?<![\w.\-/])\d+(?![\w]|\.\d)/g) ?? [])
    .filter((raw) => Number(raw) > 1 && !/^20\d\d$/.test(raw))
    .map(Number)

/**
 * Numerals quoted in comments. A number in prose beside the data it counts has
 * drifted in five separate rounds, always silently, because nothing reads it.
 * Every numeral above 1 has to be declared: either it is measured from the data
 * here, or it is registered as a constant that this data cannot move (a line
 * reference, a character ceiling, an API quota, a number inside a quoted
 * example). An undeclared one fails, which forces the choice at the moment the
 * number is written.
 *
 * The limit, stated so nobody reads more into a green run: this catches a NEW
 * number appearing unaccounted for, and it keeps the measured ones true. It
 * cannot catch a false sentence built out of a number that is already declared.
 */
export function undeclaredNumerals(file: string, source: string, declared: ReadonlySet<number>): Finding[] {
  const out: Finding[] = []
  source.split('\n').forEach((line, i) => {
    // A trailing comment is prose too. Leaving it out let a count hide on the
    // same line as the code it annotates, which is where a declaration list
    // keeps its reasons.
    const prose = isProseLine(line) ? line : trailingComment(line)
    if (prose == null) return
    const where = isProseLine(line) ? 'comment' : 'trailing comment'
    for (const n of countsIn(prose)) {
      if (!declared.has(n)) {
        out.push({ file, line: i + 1, message: `${where} quotes ${n}, which nothing measures or declares` })
      }
    }
  })
  return out
}

/**
 * Every number the comments in these sources actually quote. A declaration for
 * a number nobody quotes is dead: it exempts that number from the check forever
 * and reads as a fact about the code. Two such declarations shipped before a
 * reviewer read the list by eye.
 */
export function quotedNumerals(sources: readonly string[]): Set<number> {
  const seen = new Set<number>()
  for (const source of sources) {
    for (const line of source.split('\n')) {
      const prose = isProseLine(line) ? line : trailingComment(line)
      if (prose == null) continue
      for (const n of countsIn(prose)) seen.add(n)
    }
  }
  return seen
}
