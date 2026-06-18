// Golden evaluation set for the portfolio RAG pipeline.
//
// Each item is grounded in the actual corpus (rag/ingest/extract.ts), so the
// expected chunk ids and answer facts are verifiable, not invented. Categories:
//   - single-fact : one chunk answers it (recall@k is the key metric)
//   - local       : needs a couple of related chunks (one project's sections)
//   - global      : needs cross-corpus synthesis (the portfolio-map rescue path)
//   - out-of-corpus: NOT answerable — the bot must decline (faithfulness test)
//
// `relevantIds` are chunk-id PREFIXES (the stored ids carry a `:<locale>`
// suffix), so a match counts if any retrieved chunk id starts with the prefix.
// This keeps the set locale-agnostic. NOTE on prefix collisions: a bare prefix
// like `blog:1` also matches `blog:10`..`blog:19`, so for sources with
// double-digit indices (blog) use a trailing colon (`blog:1:`) to pin it.
//
// `mustInclude` substrings are checked (lowercased) against the generated
// answer, which is in the QUESTION's language. So prefer language-neutral tokens
// — proper nouns (USPACE, Fubon, Gemini, Flutter), tech names, and numbers
// (591, 104, 22) — which survive translation; avoid English common nouns that a
// zh-TW / ja answer would localize.

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
  {
    id: 'plutus-backend',
    category: 'single-fact',
    question: {
      en: 'What backend framework powers Plutus Trade?',
      'zh-TW': 'Plutus Trade 的後端用什麼框架?',
      ja: 'Plutus Trade のバックエンドは何のフレームワークですか?',
    },
    relevantIds: ['project:plutus-trade:tech'],
    mustInclude: ['fastapi'],
  },
  {
    id: 'plutus-frontend',
    category: 'single-fact',
    question: {
      en: 'What is Plutus Trade\'s frontend built with?',
      'zh-TW': 'Plutus Trade 的前端是用什麼做的?',
      ja: 'Plutus Trade のフロントエンドは何で作られていますか?',
    },
    relevantIds: ['project:plutus-trade:tech'],
    mustInclude: ['flutter'],
  },
  {
    id: 'path-frontend',
    category: 'single-fact',
    question: {
      en: 'What frontend framework does Path use?',
      'zh-TW': 'Path 的前端框架是什麼?',
      ja: 'Path のフロントエンドフレームワークは何ですか?',
    },
    relevantIds: ['project:path:tech'],
    mustInclude: ['react'],
  },
  {
    id: 'path-backend',
    category: 'single-fact',
    question: {
      en: 'What backend service does Path use to store data?',
      'zh-TW': 'Path 用什麼後端服務儲存資料?',
      ja: 'Path はデータ保存にどのバックエンドサービスを使っていますか?',
    },
    relevantIds: ['project:path:tech', 'project:path:solution'],
    mustInclude: ['supabase'],
  },
  {
    id: 'houseops-source',
    category: 'single-fact',
    question: {
      en: 'Which sites does House Ops scrape listings from?',
      'zh-TW': 'House Ops 從哪些網站抓取房源?',
      ja: 'House Ops はどのサイトから物件情報を取得しますか?',
    },
    relevantIds: ['project:house-ops', 'project:house-ops:solution', 'project:house-ops:problem'],
    mustInclude: ['591'],
  },
  {
    id: 'houseops-llm',
    category: 'single-fact',
    question: {
      en: 'Which AI model does House Ops use to parse listings?',
      'zh-TW': 'House Ops 用哪個 AI 模型解析房源貼文?',
      ja: 'House Ops は物件投稿の解析にどの AI モデルを使っていますか?',
    },
    relevantIds: ['project:house-ops:tech', 'project:house-ops:solution'],
    mustInclude: ['claude'],
  },
  {
    id: 'jobops-source',
    category: 'single-fact',
    question: {
      en: 'Which job board does Job Ops crawl?',
      'zh-TW': 'Job Ops 會爬哪個求職網站?',
      ja: 'Job Ops はどの求人サイトをクロールしますか?',
    },
    relevantIds: ['project:job-ops', 'project:job-ops:solution'],
    mustInclude: ['104'],
  },
  {
    id: 'playbook-frameworks',
    category: 'single-fact',
    question: {
      en: 'How many product frameworks does Product Playbook use?',
      'zh-TW': 'Product Playbook 用了幾個產品框架?',
      ja: 'Product Playbook はいくつのプロダクトフレームワークを使っていますか?',
    },
    relevantIds: ['project:product-playbook:solution', 'project:product-playbook:tech', 'about:ai:1'],
    mustInclude: ['22'],
  },
  {
    id: 'uspace-insurance',
    category: 'single-fact',
    question: {
      en: 'What insurance product did Charles launch at USPACE?',
      'zh-TW': 'Charles 在 USPACE 推出了什麼保險產品?',
      ja: 'Charles は USPACE でどんな保険商品を立ち上げましたか?',
    },
    relevantIds: ['experience:0'],
    mustInclude: ['fubon'],
  },
  {
    id: 'nueip-role',
    category: 'single-fact',
    question: {
      en: 'What did Charles do at NUEIP?',
      'zh-TW': 'Charles 在 NUEIP 做什麼?',
      ja: 'Charles は NUEIP で何をしていましたか?',
    },
    relevantIds: ['experience:2'],
    mustInclude: ['nueip'],
  },
  {
    id: 'uber-blog',
    category: 'single-fact',
    question: {
      en: 'Why did Charles turn down the Uber offer?',
      'zh-TW': 'Charles 為什麼拒絕了 Uber 的 offer?',
      ja: 'Charles はなぜ Uber のオファーを断ったのですか?',
    },
    relevantIds: ['blog:0:'],
    mustInclude: ['uber'],
  },
  {
    id: 'langgraph-blog',
    category: 'single-fact',
    question: {
      en: 'What did Charles write about building enterprise-grade RAG?',
      'zh-TW': 'Charles 寫過什麼關於打造企業級 RAG 的文章?',
      ja: 'Charles はエンタープライズ級 RAG の構築について何を書きましたか?',
    },
    relevantIds: ['blog:1:'],
    mustInclude: ['langgraph'],
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
  {
    id: 'plutus-quant',
    category: 'local',
    question: {
      en: 'How does Plutus Trade combine quantitative screening with AI?',
      'zh-TW': 'Plutus Trade 如何結合量化篩選與 AI?',
      ja: 'Plutus Trade は定量スクリーニングと AI をどう組み合わせていますか?',
    },
    relevantIds: ['project:plutus-trade:solution', 'project:plutus-trade:tech'],
    mustInclude: ['gemini'],
  },
  {
    id: 'path-sync',
    category: 'local',
    question: {
      en: 'How does Path keep working offline and sync later?',
      'zh-TW': 'Path 如何在離線時運作、之後再同步?',
      ja: 'Path はオフラインで動作し、後で同期する仕組みをどう実現していますか?',
    },
    relevantIds: ['project:path:solution', 'project:path:learnings'],
    mustInclude: ['indexeddb'],
  },
  {
    id: 'houseops-decide',
    category: 'local',
    question: {
      en: 'How does House Ops decide which listings are best?',
      'zh-TW': 'House Ops 如何判斷哪些房源最好?',
      ja: 'House Ops はどの物件が最適かをどう判断しますか?',
    },
    relevantIds: ['project:house-ops:solution', 'project:house-ops:impact'],
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
    // Global synthesis: the about chunk is canonical, but his product-method
    // project and product-philosophy articles are equally valid evidence — once
    // blog bodies are indexed they legitimately rank here, so they count too.
    relevantIds: ['about:philosophy', 'project:product-playbook:', 'blog:14:'],
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
    // Global synthesis: beyond the about chunk, the articles where he actually
    // builds with AI (the LangGraph twin, this RAG chatbot, Claude Code as an
    // agent OS) are valid evidence for "how he uses AI across his work".
    relevantIds: ['about:ai', 'blog:1:', 'blog:12:', 'changelog:rag-chatbot:'],
    mustInclude: ['prototyp'],
  },
  {
    id: 'builder-identity',
    category: 'global',
    question: {
      en: 'What does Charles mean by being a "Product Builder"?',
      'zh-TW': 'Charles 所謂的「Product Builder」是什麼意思?',
      ja: 'Charles の言う「Product Builder」とはどういう意味ですか?',
    },
    relevantIds: ['about:whoiam', 'about:philosophy:3'],
    mustInclude: ['builder'],
  },
  {
    id: 'ai-spec',
    category: 'global',
    question: {
      en: 'How does Charles use AI to write product specs?',
      'zh-TW': 'Charles 如何用 AI 撰寫產品規格?',
      ja: 'Charles はどのように AI を使ってプロダクト仕様を書きますか?',
    },
    relevantIds: ['about:ai:1', 'project:product-playbook'],
    mustInclude: ['playbook'],
  },
  {
    id: 'domains',
    category: 'global',
    question: {
      en: 'What industries has Charles built products in?',
      'zh-TW': 'Charles 在哪些產業做過產品?',
      ja: 'Charles はどんな業界でプロダクトを作ってきましたか?',
    },
    relevantIds: ['about:whoiam'],
    mustInclude: ['saas'],
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
  {
    id: 'age',
    category: 'out-of-corpus',
    question: {
      en: 'How old is Charles?',
      'zh-TW': 'Charles 今年幾歲?',
      ja: 'Charles は何歳ですか?',
    },
    relevantIds: [],
    mustDecline: true,
  },
  {
    id: 'phone',
    category: 'out-of-corpus',
    question: {
      en: 'What is Charles\'s phone number?',
      'zh-TW': 'Charles 的電話號碼是多少?',
      ja: 'Charles の電話番号は何ですか?',
    },
    relevantIds: [],
    mustDecline: true,
  },
]
