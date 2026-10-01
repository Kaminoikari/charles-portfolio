// Facts the hand-written surfaces state that the chatbot's corpus (src/data)
// does not. Every entry is a known exception to the grounding tests
// (faq-grounding.test.ts, portfolio-map.test.ts), and every entry must say where
// the fact IS published, which a test then checks: an exception that stops
// being true, or whose source stops saying it, fails the same suite it is
// exempt from.
//
// `publishedIn: null` means nothing on the site states the fact at all. Those
// are the ones that most need a decision: either the site starts saying it (and
// the entry is deleted), or the surface stops saying it.

export type Surface = 'portfolio-map' | `faq:${string}`

export interface OffCorpusFact {
  // As groundFacts reports it: '1,000', 'date:2026-08'.
  fact: string
  surfaces: Surface[]
  publishedIn: { file: string; text: string } | null
  reason: string
}

// Empty since 2026-10-01: the promotion date went into src/data/experience and
// the TOEIC score came out of the FAQ answers. Kept so the next exception has a
// place to be registered, and checked, instead of an inline skip.
export const OFF_CORPUS_FACTS: OffCorpusFact[] = []
