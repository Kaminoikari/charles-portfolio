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
