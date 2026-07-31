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
  // Corrections and questions about the visitor's own message. Today's
  // transcript had all of these land in retrieval, where the corpus has nothing
  // and the bot filled the gap by inventing what the visitor had "provided".
  /為什麼我(問|說|提|講)/,
  /我(問|說|提|講)(了)?(這|那)(句|個|段|題|件)/,
  /我(從來)?(都)?(沒有|沒|未曾|不曾)(提供|給|傳|貼|說|講|寄)/,
  /你(剛剛|剛才)(說|講|回答|用|提到|寫|給)/,
  // ja
  /さっき[^。？?！!]{0,12}(聞|言|質問|話)/,
  /覚えて(いる|ます)/,
  /(繰り返し|もう一度言って)/,
]

// "Answer my earlier question" points the other way: the visitor wants the
// portfolio answer they never got, not a recital of what they asked. Those
// belong in the rewrite-and-retrieve path, which resolves the reference into
// the earlier question and searches for it.
// The bare word 回答 is not enough to tell the two apart: "你剛剛用英文回答我" is
// a correction, not a request. What marks a request is a modal or imperative in
// front of it.
const WANTS_AN_ANSWER =
  /(請|请|要|能|可以|可不可以|會不會|会不会|應該|应该)\s*回(答|覆|复)|answer (my|the|that) [^.?!]{0,20}(question|one)|答えて/i

export function looksConversational(question: string): boolean {
  if (WANTS_AN_ANSWER.test(question)) return false
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
