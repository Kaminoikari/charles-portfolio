// LLM-as-judge for answer faithfulness: does the answer stay grounded in the
// retrieved context, without inventing facts? This is the metric that can't be
// computed deterministically — it needs a model to read answer + context and
// decide if every claim is supported. Uses the fast model with structured
// output for a cheap, stable verdict.

import { ChatAnthropic } from '@langchain/anthropic'
import { z } from 'zod'

import { config } from '../config.js'

const faithfulnessSchema = z.object({
  grounded: z
    .boolean()
    .describe('true if every factual claim in the answer is supported by the context'),
  reason: z.string().describe('one short sentence explaining the verdict'),
})

export interface FaithfulnessVerdict {
  grounded: boolean
  reason: string
}

// A faithful "I couldn't find that" decline is trivially grounded — guard it
// before spending a judge call.
export async function judgeFaithfulness(
  answer: string,
  context: string,
): Promise<FaithfulnessVerdict> {
  if (context.trim().length === 0) {
    return { grounded: true, reason: 'no context — decline is vacuously faithful' }
  }

  const judge = new ChatAnthropic({ model: config.modelFast, temperature: 0 }).withStructuredOutput(
    faithfulnessSchema,
    { name: 'faithfulness' },
  )

  return judge.invoke([
    {
      role: 'system',
      content:
        'You are a strict faithfulness judge for a RAG system. Given an ANSWER ' +
        'and the CONTEXT it was generated from, decide whether every factual ' +
        'claim in the answer is supported by the context. An honest "I could ' +
        "not find that\" counts as grounded. Inventing facts not in the context " +
        'is NOT grounded.',
    },
    { role: 'user', content: `CONTEXT:\n${context}\n\nANSWER:\n${answer}` },
  ])
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
