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
  // As groundFacts reports it: '940', 'date:2026-08'.
  fact: string
  surfaces: Surface[]
  publishedIn: { file: string; text: string } | null
  reason: string
}

export const OFF_CORPUS_FACTS: OffCorpusFact[] = [
  {
    fact: 'date:2026-08',
    surfaces: ['portfolio-map', 'faq:overall-summary', 'faq:exp-uspace', 'faq:exp-history'],
    publishedIn: { file: 'index.html', text: 'promoted to Head of Product in August 2026' },
    reason:
      'The promotion date is on the static résumé in index.html and in public/llms.txt; ' +
      'src/data/experience records the role (JULY 2024 — PRESENT) but not the month of the promotion.',
  },
  {
    fact: '940',
    surfaces: ['faq:languages'],
    publishedIn: null,
    reason: 'TOEIC score. No page on the site states it.',
  },
  {
    fact: '990',
    surfaces: ['faq:languages'],
    publishedIn: null,
    reason: 'TOEIC maximum, quoted alongside the score.',
  },
]
