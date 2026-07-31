// Conversation-memory step for the RAG pipeline — the token-efficient "condense
// question" pattern (a.k.a. history-aware query rewriting).
//
// Why this and not "stuff the history into the generation prompt": a follow-up
// like "那薪水呢?" / "and there?" is meaningless to a vector search AND to the
// grounded-answer LLM without the prior turns. Rewriting it ONCE into a
// standalone question fixes retrieval *and* generation, and keeps every
// downstream node (triage, FAQ cache, retrieve, grade, generate) working on a
// single self-contained string — so the large generation prompt never grows
// with history. The whole cost of memory is one small call, on the free Gemini
// tier, and only when there is history to resolve against. The first turn (empty
// history) short-circuits to zero added cost.

import { gemini } from './llm.js'
import type { ChatTurn } from './api-helpers.js'

// Keep the rewrite prompt tiny: only the last few exchanges matter for pronoun
// resolution, and assistant answers are truncated (their topic, not their full
// text, is what disambiguates the follow-up).
const MAX_TURNS = 6 // last ~3 exchanges
const MAX_ASSISTANT_CHARS = 300
const TIMEOUT_MS = 5000
// A standalone question is about as long as the user's own (capped at 200 in
// api-helpers). A much longer output means the model rambled or leaked the
// history — distrust it and keep the original.
const MAX_OUTPUT_CHARS = 300

// Rewrite `question` into a standalone question using recent history. Returns the
// question UNCHANGED when there is no history, when the model declines/times out,
// or when the output looks degenerate — memory is a quality nicety, never a hard
// gate on the answer (mirrors grade/rewrite's graceful degradation).
export async function contextualizeQuestion(question: string, history: ChatTurn[]): Promise<string> {
  if (!history?.length) return question // first turn — zero added cost

  const recent = history
    .slice(-MAX_TURNS)
    .map((t) =>
      t.role === 'assistant'
        ? `Assistant: ${t.content.slice(0, MAX_ASSISTANT_CHARS)}`
        : `User: ${t.content}`,
    )
    .join('\n')

  try {
    const res = await Promise.race([
      gemini().invoke([
        {
          role: 'system',
          content:
            'You rewrite a follow-up message into a standalone question, using the ' +
            'conversation history only to resolve references. Replace pronouns and ' +
            'context-dependent phrases ("he", "that project", "there", "第二個", ' +
            '"那個") with their explicit referents from the history, so the result ' +
            'can be understood on its own. Keep the original language. If the ' +
            'message is ALREADY self-contained, or is a greeting, thanks, or ' +
            'chit-chat, return it UNCHANGED. Output ONLY the rewritten message — no ' +
            'preamble, no quotes, no explanation.',
        },
        { role: 'user', content: `History:\n${recent}\n\nFollow-up: ${question}` },
      ]),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('contextualize timed out')), TIMEOUT_MS),
      ),
    ])
    const out = String((res as { content: unknown }).content).trim()
    if (!out || out.length > MAX_OUTPUT_CHARS) return question
    return out
  } catch (err) {
    console.warn('contextualize failed, using original question:', (err as Error).message)
    return question
  }
}
