// LLM-as-judge for answer faithfulness: does the answer stay grounded in the
// retrieved context, without inventing facts? This is the metric that can't be
// computed deterministically — it needs a model to read answer + context and
// decide if every claim is supported. Uses the fast model with structured
// output for a cheap, stable verdict.

import { ChatAnthropic } from '@langchain/anthropic'
import { z } from 'zod'

import { config } from '../config.js'
import { todayISO } from '../nodes.js'

// A boolean verdict and a reason. A list of unsupported claims was tried
// (run 36868407205, cdf7b6f): asked to enumerate, the judge listed wording it
// disliked ("a series of articles", "flagship"), ungrounded verdicts went from 11
// to 29 of 122, and its outright misreads did not fall. The boolean stays; the
// fixes that answered the 36857502362 misreads are the date and the equivalence
// sentence in the prompt below.
const faithfulnessSchema = z.object({
  grounded: z
    .boolean()
    .describe('true if every factual claim in the answer is supported by the context'),
  reason: z.string().describe('one short sentence explaining the verdict'),
})

type FaithfulnessOutput = z.infer<typeof faithfulnessSchema>
type Message = { role: 'system' | 'user'; content: string }

export interface FaithfulnessDeps {
  // The model call, injectable so tests fake the network and nothing else.
  invoke?: (messages: Message[]) => Promise<FaithfulnessOutput>
  // The date the judge is told it is. Defaults to the generator's clock.
  today?: string
}

// A union rather than an optional field, so `grounded` cannot be read off a run
// that never had one. That is the whole guard on the caller: `judged: false` used
// to be `grounded: true`, the caller scored it 1, and nothing in the types or
// the tests could see the difference between "the judge approved this" and
// "there was nothing to approve".
export type FaithfulnessVerdict =
  | { judged: false; reason: string }
  | { judged: true; grounded: boolean; reason: string }

const defaultInvoke = (messages: Message[]) =>
  new ChatAnthropic({ model: config.modelFast, temperature: 0 })
    .withStructuredOutput(faithfulnessSchema, { name: 'faithfulness' })
    .invoke(messages)

// An answer with no retrieved context is not a faithful answer and not an
// unfaithful one: a FAQ cache hit, a canned decline and an outage notice all
// arrive this way, and the judge has nothing to compare them against. Say so,
// and skip the model call.
export async function judgeFaithfulness(
  answer: string,
  context: string,
  deps: FaithfulnessDeps = {},
): Promise<FaithfulnessVerdict> {
  if (context.trim().length === 0) {
    return { judged: false, reason: 'no retrieved context, so there is nothing to judge' }
  }

  const invoke = deps.invoke ?? defaultInvoke
  // The generator is told today's date (nodes.ts); a judge that is not reads
  // "Head of Product since August 2026" as a claim about the future.
  const today = deps.today ?? todayISO()
  let out: FaithfulnessOutput
  try {
    out = await invoke([
      {
        role: 'system',
        content:
          'You are a strict faithfulness judge for a RAG system. Given an ANSWER ' +
          'and the CONTEXT it was generated from, decide whether every factual ' +
          'claim in the answer is supported by the context. An honest "I could ' +
          'not find that" counts as grounded. A claim the context states in other ' +
          'words, in another language, or as an equivalent number or date counts ' +
          'as supported. Inventing facts not in the context, or reversing what the ' +
          `context says, is NOT grounded. Today's date is ${today}; a date on or ` +
          'before it is not in the future.',
      },
      { role: 'user', content: `CONTEXT:\n${context}\n\nANSWER:\n${answer}` },
    ])
  } catch (err) {
    // One unreadable verdict is one unjudged run, reported by the caller; it used
    // to throw out of the eval loop and lose every result after it.
    return { judged: false, reason: `judge failed: ${err instanceof Error ? err.message : String(err)}` }
  }
  return { judged: true, grounded: out.grounded, reason: out.reason }
}

const statementSchema = z.object({
  states: z
    .boolean()
    .describe('true if the answer asserts the claim, in whatever language it is written'),
  reason: z.string().describe('one short sentence explaining the verdict'),
})

export interface StatementVerdict {
  states: boolean
  reason: string
}

// Does the answer make a particular claim, regardless of the language it is
// written in? This is the locale-agnostic half of correctness. The substring
// rules it replaces could only ask for a literal token, so an answer that said
// 「結果重於產出」 — a correct rendering of "outcomes over outputs" — scored as
// wrong for not containing the English word, while an answer that merely quoted
// the word scored as right. The claim is declared once, in English, and judged
// against an answer in any of the three locales.
export async function judgeStatement(answer: string, claim: string): Promise<StatementVerdict> {
  if (answer.trim().length === 0) return { states: false, reason: 'empty answer' }

  const judge = new ChatAnthropic({ model: config.modelFast, temperature: 0 }).withStructuredOutput(
    statementSchema,
    { name: 'statement' },
  )

  return judge.invoke([
    {
      role: 'system',
      content:
        'You decide whether an ANSWER asserts a given CLAIM. The answer may be ' +
        'in English, Traditional Chinese or Japanese; the claim is always in ' +
        'English. Judge the MEANING, not the wording: a correct translation or ' +
        'paraphrase of the claim counts as asserting it, and so does stating the ' +
        'same fact in different words. Extra material in the answer is fine. ' +
        'Answer false only if the answer does not assert the claim at all, or ' +
        'asserts something that contradicts it.',
    },
    { role: 'user', content: `CLAIM:
${claim}

ANSWER:
${answer}` },
  ])
}

const responsiveSchema = z.object({
  responsive: z.boolean().describe('true if the answer answers the question that was asked'),
  reason: z.string().describe('one short sentence explaining the verdict'),
})

// Does a pre-written answer answer the question a visitor asked? Used by the
// FAQ calibration on the serves that went to a different entry than the one the
// question belongs to. Many of those are entries on overlapping topics, where
// the other entry's answer still answers the question; the ones that do not are
// the confident wrong answers the cache exists to avoid, and those are what the
// margin has to be chosen against.
export async function judgeResponsive(question: string, answer: string): Promise<{ responsive: boolean; reason: string }> {
  const judge = new ChatAnthropic({ model: config.modelFast, temperature: 0 }).withStructuredOutput(responsiveSchema, {
    name: 'responsive',
  })
  return judge.invoke([
    {
      role: 'system',
      content:
        'A visitor asked a portfolio chatbot a QUESTION and was shown a pre-written ANSWER. ' +
        'Decide whether the ANSWER answers the QUESTION. Either may be in English, ' +
        'Traditional Chinese or Japanese. true if the answer directly addresses what was ' +
        'asked, even if it also says more. false if it answers a different question: a ' +
        'different company, project, person, time or topic than the one asked about, or a ' +
        'general overview when something specific was asked.',
    },
    { role: 'user', content: `QUESTION:\n${question}\n\nANSWER:\n${answer}` },
  ])
}
