// Conversation transcript helpers shared by every step that reads history.
//
// Two jobs live here so the pipeline has one definition of each:
//   formatHistory      — the transcript rendering used by contextualize, the
//                        converse node, and the generation prompt.
//   looksConversational — the gate that spots a message whose answer IS the
//                        conversation ("我剛剛問了什麼", "repeat what I said"),
//                        as opposed to a portfolio question that merely refers
//                        back to it ("那個專案解決什麼問題?").
//
// The distinction matters because the two need opposite treatment. A
// referential follow-up is rewritten into a standalone question and retrieved
// for as usual (see contextualize.ts). A conversational one has no answer in
// the corpus at all: retrieval finds nothing, grading calls it unanswerable and
// the visitor gets an honest refusal to a question the bot could have answered
// from what it was already holding.

import type { ChatTurn } from './api-helpers.js'

// Messages asking about the conversation itself. Deterministic on purpose —
// this runs on every message, and a regex costs nothing next to a model call.
// Each pattern needs an explicit backward reference (剛剛 / just / さっき /
// first question), so a plain portfolio question never matches.
const CONVERSATIONAL: RegExp[] = [
  // zh: 剛剛/剛才/上面/前面/第一輪 … 問/說/講/提到
  /(剛剛|剛才|上面|前面|第一輪|上一(題|個問題|則))[^。？?！!]{0,12}(問|說|講|提到)/,
  /(問|說|講)[^。？?！!]{0,8}(剛剛|剛才)/,
  /你(還)?記得[^。？?！!]{0,16}(嗎|？|\?)/,
  /(重複|重覆)[^。？?！!]{0,12}(剛剛|剛才|我說|我問|問題|一遍)/,
  // en
  /what did i (just )?(ask|say|tell)/i,
  /repeat (what i|my|the) [^.?!]{0,20}(said|asked|question|message)/i,
  /do you remember (what|my|our)/i,
  /my (first|previous|last|earlier) (question|message)/i,
  // ja
  /さっき[^。？?！!]{0,12}(聞|言|質問|話)/,
  /覚えて(いる|ます)/,
  /(繰り返し|もう一度言って)/,
]

export function looksConversational(question: string): boolean {
  return CONVERSATIONAL.some((re) => re.test(question))
}

// The single decision both consumers ask: is this a message to answer from the
// transcript? streamAnswer asks it to skip rewriting the question (rewriting
// resolves the referents and thereby destroys the very markers the gate reads —
// "剛剛我說的那兩家公司是哪兩家?" comes back as "華碩和鴻海是哪兩家公司?", which
// then retrieves nothing), and triage asks it to pick the converse route. They
// must agree, or a message gets rewritten out of the path it was headed for.
export function shouldAnswerFromHistory(question: string, history: ChatTurn[]): boolean {
  return (history?.length ?? 0) > 0 && looksConversational(question)
}

// Render recent turns as a plain transcript. Assistant answers are truncated:
// their topic is what disambiguates a follow-up, their full text is dead weight
// in a prompt that is paid for on every request.
export function formatHistory(
  turns: ChatTurn[],
  opts: { maxTurns: number; assistantChars: number },
): string {
  if (!turns?.length) return ''
  return turns
    .slice(-opts.maxTurns)
    .map((t) =>
      t.role === 'assistant'
        ? `Assistant: ${t.content.slice(0, opts.assistantChars)}`
        : `User: ${t.content}`,
    )
    .join('\n')
}
