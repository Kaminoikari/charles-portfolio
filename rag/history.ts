// Conversation transcript helpers shared by every step that reads history.
//
// Three jobs live here so the pipeline has one definition of each:
//   formatHistory      — the transcript rendering used by contextualize, the
//                        converse node, and the generation prompt.
//   looksConversational — the gate that spots a message whose answer IS the
//                        conversation ("我剛剛問了什麼", "repeat what I said"),
//                        as opposed to a portfolio question that merely refers
//                        back to it ("那個專案解決什麼問題?").
//   ordinalReference /  — resolving a reference by position ("我剛剛問你的第二個
//   replayTarget          問題") against the transcript, read by the graph and
//                        by the converse node.
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

// --- references by position ------------------------------------------------
// "我剛剛問你的第二個問題" names an earlier question by its place in the
// conversation. Nothing downstream can resolve that: an embedding has no
// ordering, and an LLM handed a flat transcript has to count the turns itself —
// which it did inconsistently in production, answering about the fourth
// question in one run and the second in the next. Counting is arithmetic, so it
// happens here, once, deterministically.

const ZH_NUMERALS: Record<string, number> = {
  一: 1, 二: 2, 兩: 2, 三: 3, 四: 4, 五: 5, 六: 6, 七: 7, 八: 8, 九: 9, 十: 10,
}
const EN_ORDINALS: Record<string, number> = {
  first: 1, second: 2, third: 3, fourth: 4, fifth: 5,
  sixth: 6, seventh: 7, eighth: 8, ninth: 9, tenth: 10,
}

// 第二個問題 / 第2題 / 第三個提問
const ZH_ORDINAL = /第\s*([0-9]+|[一二兩三四五六七八九十])\s*(?:個|个|則|则|條|条)?\s*(?:問題|问题|題|题|提問|提问)/
// 2番目の質問 / 二つ目の質問
const JA_ORDINAL = /([0-9]+|[一二三四五六七八九十])\s*(?:番目|つ目)\s*の\s*(?:質問|問題)/
// my second question / the 3rd question
const EN_ORDINAL =
  /\b(first|second|third|fourth|fifth|sixth|seventh|eighth|ninth|tenth|[0-9]+)(?:st|nd|rd|th)?\s+question\b/i
// question 2 / question #3 / question number 4
const EN_NUMBERED = /\bquestion\s*(?:#|no\.?|number)?\s*([0-9]+)\b/i
// 最初の質問 — the zh "第一個問題" is already an ordinal above.
const FIRST_QUESTION = /最初の(?:質問|問題)/
// The most recent one, however it is named. Checked LAST so an explicit ordinal
// inside the same sentence ("剛剛問你的第二個問題") wins over the 剛剛 in front.
const LAST_QUESTION =
  /上一(?:個|个)?(?:問題|问题|題|题)|最(?:後|后)(?:一(?:個|个)|的)?(?:問題|问题|題|题)|(?:剛剛|剛才|刚刚|刚才)[^。？?！!]{0,8}的?(?:問題|问题|題|题)|\b(?:previous|last)\s+question\b|(?:前|最後|さっき)の(?:質問|問題)/i

// Naming a question is not the same as pointing at one. "最後一個問題，他現在在
// 找什麼機會?" is a politeness opener in front of a brand-new question, and
// "what's the first question you'd ask a new user?" asks about Charles's
// practice — both contain a question-shaped phrase and neither refers to this
// conversation. So the phrase counts only when the message points backwards, or
// when the phrase is what the sentence is about.
const POINTS_BACKWARD =
  /我(?:剛剛|剛才)?(?:問|說|讲|講|提)|剛剛|剛才|刚刚|刚才|上面|前面|上一|\bmy\b|\bi (?:asked|said)\b|\byou (?:answered|said|replied)\b|私|さっき|(?:請|请)\s*回(?:答|覆|复)|\banswer\b|答えて/i
// Applied to what FOLLOWS the phrase: "第二個問題是什麼", "第2題你還沒回覆",
// "2番目の質問は何ですか", "my second question was …".
const IS_THE_SUBJECT =
  /^[\s,，、:：]*(?:是什麼|是什么|是哪|你(?:還|还)沒|(?:還|还)沒|は(?:何|なん)|でした|(?:was|is)\b)/i
// And to what PRECEDES it. In zh, 問題 is also "problem", so "USPACE 遇到的第一個
// 問題是什麼?" has the same tail as "第一個問題是什麼?" and means something else
// entirely. What separates them is the modifier in front: a phrase owned by
// something ("USPACE 遇到的", "他在 USPACE 解決的") is not this conversation.
// Only a connective may lead.
const NOTHING_OWNS_IT = /^[\s,，、。:：]*(?:所以|那麼|那么|那|嗯|好|so|and|then|ok)?[\s,，、:：]*$/i

function parseNumber(token: string): number {
  return /^[0-9]+$/.test(token)
    ? Number(token)
    : (ZH_NUMERALS[token] ?? EN_ORDINALS[token.toLowerCase()] ?? 0)
}

// The 1-based position the message points at, with where the phrase ended, or
// null when it points at nothing. `total` lets "last" be resolved without the
// caller re-counting.
function locate(
  question: string,
  total: number,
): { index: number; start: number; end: number } | null {
  for (const re of [ZH_ORDINAL, JA_ORDINAL, EN_ORDINAL, EN_NUMBERED]) {
    const m = question.match(re)
    if (m?.[1] && m.index !== undefined) {
      return { index: parseNumber(m[1]), start: m.index, end: m.index + m[0].length }
    }
  }
  for (const [re, index] of [
    [FIRST_QUESTION, 1],
    [LAST_QUESTION, total],
  ] as const) {
    const m = question.match(re)
    if (m && m.index !== undefined) return { index, start: m.index, end: m.index + m[0].length }
  }
  return null
}

export interface OrdinalReference {
  /** 1-based position among the visitor's own questions, as they named it. */
  index: number
  /** How many questions they have actually asked. */
  total: number
  /** The question at `index`, or null when they named one that does not exist. */
  question: string | null
  /** Turns that preceded that question — what its own references resolve against. */
  priorTurns: ChatTurn[]
}

// Resolve a positional reference against the transcript. Null when the message
// names no position, or when there is nothing to count. An out-of-range index
// still resolves (with `question: null`) so the converse node can say "you have
// only asked three" instead of quietly answering about a different one.
export function ordinalReference(question: string, history: ChatTurn[]): OrdinalReference | null {
  const asked = (history ?? [])
    .map((turn, at) => ({ turn, at }))
    .filter(({ turn }) => turn.role === 'user')
  if (!asked.length) return null

  const found = locate(question, asked.length)
  if (!found || found.index < 1) return null
  // A question-shaped phrase only refers to an earlier turn when the message
  // points backwards, or when the phrase leads the sentence and is what the
  // sentence is about.
  const isTheSubject =
    NOTHING_OWNS_IT.test(question.slice(0, found.start)) &&
    IS_THE_SUBJECT.test(question.slice(found.end))
  if (!POINTS_BACKWARD.test(question) && !isTheSubject) return null

  const { index } = found
  const hit = asked[index - 1]
  return {
    index,
    total: asked.length,
    question: hit ? hit.turn.content : null,
    priorTurns: hit ? (history ?? []).slice(0, hit.at) : [],
  }
}

// "請回答我剛剛問你的第二個問題" asks for the ANSWER to an earlier question, not
// for a recital of it — so the pipeline replays that question through retrieval
// instead of talking about the conversation. Null unless the message both asks
// for an answer and names a question that exists.
export function replayTarget(
  question: string,
  history: ChatTurn[],
): { question: string; priorTurns: ChatTurn[] } | null {
  if (!WANTS_AN_ANSWER.test(question)) return null
  const ref = ordinalReference(question, history)
  return ref?.question ? { question: ref.question, priorTurns: ref.priorTurns } : null
}

// The single decision both consumers ask: is this a message to answer from the
// transcript? streamAnswer asks it to skip rewriting the question (rewriting
// resolves the referents and thereby destroys the very markers the gate reads —
// "剛剛我說的那兩家公司是哪兩家?" comes back as "華碩和鴻海是哪兩家公司?", which
// then retrieves nothing), and triage asks it to pick the converse route. They
// must agree, or a message gets rewritten out of the path it was headed for.
export function shouldAnswerFromHistory(question: string, history: ChatTurn[]): boolean {
  if ((history?.length ?? 0) === 0) return false
  // A replay goes to retrieval under the earlier question's own words, and
  // needs no guard of its own here: replayTarget requires WANTS_AN_ANSWER, and
  // looksConversational already rejects everything that matches it. A second
  // check would mask this one, leaving both untestable.
  //
  // Naming a position is deliberately NOT enough on its own to claim the
  // message for the transcript. That branch existed here for one turn and was
  // reverted on 2026-07-31: "第N個問題" followed by punctuation and a brand-new
  // question ("最後一個問題，是什麼讓他離開 USPACE?", "Second question: is he open
  // to relocating?") is how people preface a question, not how they refer back
  // to one, and every attempt to separate the two by looking at the words after
  // the phrase closed the examples it was shown and left the neighbours open.
  // So the pre-existing gate decides, and a positional phrase reaches converse
  // only when the message ALSO says it is looking back ("我剛剛問你的第二個問題是
  // 什麼?"). ordinalReference still resolves the position for the two consumers
  // that have already been routed here: replayTarget above, and the converse
  // hint in nodes.ts.
  return looksConversational(question)
}

// The one shape a shortened turn takes, wherever it gets shortened. A cut line
// has to LOOK cut. On 2026-08-19 one did not: a ten-item list came back on the
// next turn sliced to 300 chars, ending mid-sentence inside item 5, and the
// model read that ragged edge as evidence that its own reply had failed to
// send. It told the visitor "我的回應被截斷了" about an answer that had reached
// them whole. A marker turns that into something reportable — the model can say
// it is holding an excerpt and offer the rest — and it costs about ten tokens
// on the turns that actually get cut.
// Re-marking is idempotent about the ORIGINAL length, because a turn can pass
// two ceilings (the transport bound, then the prompt bound) and the second pass
// otherwise measures the already-shortened body and calls that the original: a
// 9000-char answer came out as "first 4000 of 8036". A wrong number is the same
// class of defect as the silent cut that started this — a fact the model has no
// way to doubt.
const MARKED = /…\[excerpt: first \d+ of (\d+) chars\]$/

export function excerpt(text: string, limit: number): string {
  const marked = text.match(MARKED)
  const body = marked ? text.slice(0, -marked[0].length) : text
  // Already short enough: keep it exactly as it is, marker and all.
  if (body.length <= limit) return text
  const original = marked ? Number(marked[1]) : text.length
  return `${body.slice(0, limit)}…[excerpt: first ${limit} of ${original} chars]`
}

// Render recent turns as a plain transcript.
//
// Older assistant answers are shortened: their topic is what disambiguates a
// follow-up, and their full text is dead weight in a prompt paid for on every
// request. The most recent ones are not, because that is where a follow-up
// actually points. "請回答第 8 題" is answerable only if item 8 of the list is
// still in the transcript, and on 2026-08-19 it was not — every copy of that
// answer had been cut at 300 chars before the prompt was built.
//
// When turns fall off the window the transcript says so, because a model given
// a silently-clipped transcript treats the oldest line it can see as the start
// of the conversation. Live: asked "我剛剛問你的第一個問題是什麼?" on the fifth
// turn, it confidently named the third — and then apologised for a mistake it
// had never made. "I can only see the recent part" is an answer; a wrong first
// question is not. Shortening one turn is the same failure at a smaller scale,
// so it gets the same treatment: `excerpt` above marks it.
//
// The visitor's turns carry their question number, counted over the WHOLE
// history before any clipping — so a reader of a partial transcript sees that
// the oldest line it holds is question 4, not question 1. Numbering the lines is
// what makes "第二個問題" answerable by reading rather than by counting.
export function formatHistory(
  turns: ChatTurn[],
  opts: {
    maxTurns: number
    /** Ceiling for assistant answers older than the recent window. */
    assistantChars: number
    /** How many trailing assistant answers keep their full text. */
    recentAssistantTurns?: number
    /** Ceiling for those, so one runaway answer still cannot own the prompt. */
    recentAssistantChars?: number
  },
): string {
  if (!turns?.length) return ''
  let asked = 0
  const numbered = turns.map((t, at) => ({ ...t, at, n: t.role === 'user' ? ++asked : 0 }))

  // Where the recent window starts, measured over the whole history rather than
  // the rendered slice: which answers are recent is a fact about the
  // conversation, not about how much of it fits in the prompt.
  const recentTurns = opts.recentAssistantTurns ?? 0
  const assistantAt = numbered.filter((t) => t.role === 'assistant').map((t) => t.at)
  const recentFrom =
    recentTurns > 0 ? (assistantAt[assistantAt.length - recentTurns] ?? 0) : Number.POSITIVE_INFINITY

  const kept = numbered.slice(-opts.maxTurns)
  const clipped = kept.length < turns.length
  const body = kept
    .map((t) =>
      t.role === 'assistant'
        ? `Assistant: ${excerpt(
            t.content,
            t.at >= recentFrom ? (opts.recentAssistantChars ?? opts.assistantChars) : opts.assistantChars,
          )}`
        : `User (question ${t.n}): ${t.content}`,
    )
    .join('\n')
  return clipped ? `(earlier turns are not shown)\n${body}` : body
}
