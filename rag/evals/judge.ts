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
