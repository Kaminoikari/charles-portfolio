// Lightweight prompt-injection defense for the public endpoint. The corpus and
// the user question are DATA, never instructions. This neutralizes the most
// common "ignore previous instructions" style payloads before the question
// reaches the LLM. It is defense-in-depth — the system prompt's faithfulness
// lock is the primary control.

const INJECTION_PATTERNS: RegExp[] = [
  /ignore\s+(all\s+)?(previous|prior|above)\s+(instructions?|prompts?)/gi,
  /disregard\s+(the\s+)?(system|above|previous)/gi,
  /you\s+are\s+now\s+(a|an)\b/gi,
  /(reveal|print|repeat|show)\s+(your\s+)?(system\s+)?(prompt|instructions?)/gi,
  /無視.*(指示|提示|以上)/g,
  /忽略.*(指令|指示|以上|先前)/g,
]

// Returns the question with injection markers softened. We don't reject — a
// recruiter might legitimately use these words — we just defang the imperative.
export function sanitize(question: string): string {
  let out = question
  for (const re of INJECTION_PATTERNS) out = out.replace(re, '[redacted instruction]')
  return out.slice(0, 1000) // hard length cap
}

// Output-side backstop. Many injection attacks (spell-out puzzles, decode, fill-
// in-the-blank) are crafted so the OFFENSIVE string only appears in the model's
// OUTPUT, not the input — so input filtering can't catch them all. This is the
// last line: if the generated answer contains a known slur/offensive term, we
// drop the whole answer rather than surface it. Word-boundary / standalone
// matching keeps false positives near zero on a portfolio Q&A surface.
//
// Kept intentionally small and high-precision (the slurs an attacker would try
// to coax out). Edit-friendly; the LLM scope-lock in nodes.ts is the primary
// control and this only fires if that is somehow bypassed.
const OFFENSIVE_OUTPUT: RegExp[] = [
  /\bn[i1]gg(er|a|ah)s?\b/i,
  /\bch[i1]nks?\b/i,
  /\bf[a@4]gg?(ot|ots|y)?\b/i,
  /\bk[i1]kes?\b/i,
  /\bsp[i1]cs?\b/i,
  /\bret[a@]rds?\b/i,
  /\bc[uo]nts?\b/i,
  /死黑鬼|黑鬼|尼哥|死尼|支那豬?|塌仔|阿三/,
]

// Returns true if the generated answer contains an offensive term that should
// never be surfaced regardless of how the prompt elicited it.
export function isOffensiveOutput(text: string): boolean {
  return OFFENSIVE_OUTPUT.some((re) => re.test(text))
}
