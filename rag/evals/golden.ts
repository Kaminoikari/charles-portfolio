// Golden evaluation set for the portfolio RAG pipeline.
//
// Each item is grounded in the actual corpus (rag/ingest/extract.ts), so the
// expected chunk ids and answer facts are verifiable, not invented. Categories:
//   - single-fact : one chunk answers it (recall@k is the key metric)
//   - local       : needs a couple of related chunks (one project's sections)
//   - global      : needs cross-corpus synthesis (the portfolio-map rescue path)
//   - out-of-corpus: NOT answerable — the bot must decline (faithfulness test)
//
// `relevantIds` are chunk-id PREFIXES (locale suffix is appended per run), so a
// match counts if any retrieved chunk id starts with the prefix. This keeps the
// set locale-agnostic; the runner expands per locale.

export type EvalCategory = 'single-fact' | 'local' | 'global' | 'out-of-corpus'

export interface GoldenItem {
  id: string
  category: EvalCategory
  // Question per locale. Same intent, localized — mirrors how a real visitor in
  // each language would ask.
  question: { en: string; 'zh-TW': string; ja: string }
  // Chunk-id prefixes that SHOULD be retrieved (empty for out-of-corpus).
  relevantIds: string[]
  // Facts the answer must contain (lowercased substring checks in correctness).
  // For out-of-corpus, the answer must instead signal a decline.
  mustInclude?: string[]
  mustDecline?: boolean
}

export const GOLDEN: GoldenItem[] = [
  // ── single-fact ─────────────────────────────────────────────────────────
  {
    id: 'uspace-role',
    category: 'single-fact',
    question: {
      en: 'What is Charles\'s role at USPACE?',
      'zh-TW': 'Charles 在 USPACE 的職位是什麼?',
      ja: 'Charles の USPACE での役職は何ですか?',
    },
    relevantIds: ['experience:0'],
    mustInclude: ['product manager', 'uspace'],
  },
  {
    id: 'path-stack',
    category: 'single-fact',
    question: {
      en: 'What is the Path project built with offline?',
      'zh-TW': 'Path 這個專案的離線技術用什麼?',
      ja: 'Path プロジェクトのオフライン技術は何を使っていますか?',
    },
    relevantIds: ['project:path:tech', 'project:path:solution'],
    mustInclude: ['indexeddb'],
  },
  {
    id: 'plutus-ai',
    category: 'single-fact',
    question: {
      en: 'Which AI model does Plutus Trade use?',
      'zh-TW': 'Plutus Trade 用哪個 AI 模型?',
      ja: 'Plutus Trade はどの AI モデルを使っていますか?',
    },
    relevantIds: ['project:plutus-trade:tech', 'project:plutus-trade'],
    mustInclude: ['gemini'],
  },

  // ── local (one project, multiple sections) ───────────────────────────────
  {
    id: 'path-problem',
    category: 'local',
    question: {
      en: 'What problem does Path solve and how?',
      'zh-TW': 'Path 解決什麼問題、怎麼解?',
      ja: 'Path はどんな問題をどう解決しますか?',
    },
    relevantIds: ['project:path:problem', 'project:path:solution'],
    mustInclude: ['offline'],
  },
  {
    id: 'playbook-what',
    category: 'local',
    question: {
      en: 'What is Product Playbook and what does it do?',
      'zh-TW': 'Product Playbook 是什麼、能做什麼?',
      ja: 'Product Playbook とは何で、何ができますか?',
    },
    relevantIds: ['project:product-playbook', 'changelog:product-playbook'],
    mustInclude: ['framework'],
  },

  // ── global (cross-corpus synthesis; portfolio-map rescue) ─────────────────
  {
    id: 'overall-style',
    category: 'global',
    question: {
      en: 'What is Charles\'s overall product philosophy?',
      'zh-TW': 'Charles 整體的產品哲學是什麼?',
      ja: 'Charles の全体的なプロダクト哲学は何ですか?',
    },
    relevantIds: ['about:philosophy'],
    mustInclude: ['outcome'],
  },
  {
    id: 'ai-workflow',
    category: 'global',
    question: {
      en: 'How does Charles use AI across his work?',
      'zh-TW': 'Charles 如何在工作中運用 AI?',
      ja: 'Charles は仕事でどのように AI を活用していますか?',
    },
    relevantIds: ['about:ai'],
    mustInclude: ['prototyp'],
  },

  // ── out-of-corpus (must decline; faithfulness) ────────────────────────────
  {
    id: 'salary',
    category: 'out-of-corpus',
    question: {
      en: 'What is Charles\'s current salary?',
      'zh-TW': 'Charles 現在的薪水是多少?',
      ja: 'Charles の現在の給料はいくらですか?',
    },
    relevantIds: [],
    mustDecline: true,
  },
  {
    id: 'pets',
    category: 'out-of-corpus',
    question: {
      en: 'Does Charles have any pets?',
      'zh-TW': 'Charles 有養寵物嗎?',
      ja: 'Charles はペットを飼っていますか?',
    },
    relevantIds: [],
    mustDecline: true,
  },
]
