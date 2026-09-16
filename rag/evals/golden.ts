// Golden evaluation set for the portfolio RAG pipeline.
//
// Each item is grounded in the actual corpus (rag/ingest/extract.ts), so the
// expected chunk ids and answer facts are verifiable, not invented. Categories:
//   - single-fact : one chunk answers it (recall@k is the key metric)
//   - local       : needs a couple of related chunks (one project's sections)
//   - global      : needs cross-corpus synthesis (the portfolio-map rescue path)
//   - near-miss  : answerable, but a sibling question with the SAME shape and a
//                  DIFFERENT fact sits next to it in the corpus. These are the
//                  hard negatives: recall alone looks fine when the retriever
//                  brings back the sibling, so they are the items that tell a
//                  confusable index from a precise one — and the benchmark for
//                  the FAQ cache's cross-entry margin (rag/qdrant.ts), whose
//                  whole job is refusing to answer between two of them.
//   - out-of-corpus: NOT answerable — the bot must decline (faithfulness test)
//
// `relevantIds` are chunk-id PREFIXES (the stored ids carry a `:<locale>`
// suffix), so a match counts if any retrieved chunk id starts with the prefix.
// This keeps the set locale-agnostic. NOTE on prefix collisions: blog ids carry
// the article's URL slug, and one slug can prefix another (`blog:ai` also matches
// `blog:ai-286`, `blog:pm` also matches `blog:pm-b5b`), so always pin a blog id
// with a trailing colon (`blog:ai:`).
//
// `mustInclude` substrings are checked (lowercased) against the generated
// answer, which is in the QUESTION's language. So prefer language-neutral tokens
// — proper nouns (USPACE, Fubon, Gemini, Flutter), tech names, and numbers
// (591, 104, 22) — which survive translation; avoid English common nouns that a
// zh-TW / ja answer would localize.

export type EvalCategory = 'single-fact' | 'local' | 'global' | 'near-miss' | 'out-of-corpus'

export interface GoldenItem {
  id: string
  category: EvalCategory
  // Question per locale. Same intent, localized — mirrors how a real visitor in
  // each language would ask.
  question: { en: string; 'zh-TW': string; ja: string }
  // Chunk-id prefixes that SHOULD be retrieved (empty for out-of-corpus).
  relevantIds: string[]
  // Locale-INVARIANT tokens the answer must contain (lowercased substring
  // checks). Names, numbers, APIs and acronyms only: anything the site renders
  // differently per locale belongs in mustState, because a token the zh/ja copy
  // translates makes the item permanently unscoreable in those locales. The
  // structural test in golden.test.ts refuses a token the corpus cannot supply
  // in all three.
  mustInclude?: string[]
  // One claim, in English, judged against the answer in whatever language it is
  // written (rag/evals/judge.ts:judgeStatement). This is where a fact whose
  // wording is translated belongs — "he prioritises outcomes over outputs" holds
  // whether the answer says that or 「結果重於產出」.
  mustState?: string
  mustDecline?: boolean
}

// Which mustInclude tokens the source cannot supply, per locale. Pure, and
// separate from the test that runs it over the real corpus, because that test
// has no negative case: every live rule passes, so narrowing the check to one
// locale changes nothing and a mutation of it survives. The synthetic fixture in
// golden.test.ts is what actually holds this logic.
export function tokensMissingFromSource(
  item: Pick<GoldenItem, 'id' | 'mustInclude'>,
  locales: string[],
  sourceFor: (locale: string) => string,
): string[] {
  const out: string[] = []
  for (const token of item.mustInclude ?? []) {
    const missing = locales.filter((loc) => !sourceFor(loc).toLowerCase().includes(token.toLowerCase()))
    if (missing.length > 0) out.push(`${item.id}: "${token}" absent from the ${missing.join(', ')} source`)
  }
  return out
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
    relevantIds: ['experience:uspace-tech-co-ltd:'],
    mustInclude: ['uspace'],
    mustState:
      'Charles is a Product Manager at USPACE, who started as the USPACE app owner leading a 15-person cross-functional team.',
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
    relevantIds: ['project:product-playbook:solution', 'project:product-playbook:tech', 'about:ai:spec-writing:'],
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
    relevantIds: ['experience:uspace-tech-co-ltd:'],
    mustInclude: ['fsc'],
    mustState: 'Charles launched a subscription parking-insurance product at USPACE with Fubon Insurance, piloted in the FSC regulatory sandbox.',
  },
  {
    id: 'nueip-role',
    category: 'single-fact',
    question: {
      en: 'What did Charles do at NUEIP?',
      'zh-TW': 'Charles 在 NUEIP 做什麼?',
      ja: 'Charles は NUEIP で何をしていましたか?',
    },
    relevantIds: ['experience:nueip-technology-co-ltd:'],
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
    relevantIds: ['blog:uber-l4-offer-pm-ai:'],
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
    relevantIds: ['blog:langgraph-ai:'],
    mustInclude: ['langgraph'],
  },

  // ── fragment-dependent (the answer lives in a blog BODY slice) ───────────
  // Body chunks are two thirds of the corpus and had five items between them,
  // all of which the article's title chunk alone could satisfy. These cannot:
  // the fact is inside the text, so the prefix pins `…:body:` and a title-only
  // hit scores zero. Pinned at the body level rather than at a numbered slice,
  // because re-chunking moves the boundaries and must not fail the eval.
  {
    id: 'uber-case-prep',
    category: 'single-fact',
    question: {
      en: 'How long did Charles get to prepare the Uber case study?',
      'zh-TW': 'Charles 準備 Uber 的 case study 有多少時間?',
      ja: 'Charles は Uber のケーススタディの準備にどれだけ時間がありましたか?',
    },
    relevantIds: ['blog:uber-l4-offer-pm-ai:body:'],
    mustInclude: ['72'],
  },
  {
    id: 'cs153-scale',
    category: 'single-fact',
    question: {
      en: 'How many students take Stanford CS153 now?',
      'zh-TW': '史丹佛 CS153 現在有多少學生修?',
      ja: 'スタンフォードの CS153 は今どれくらいの学生が受講していますか?',
    },
    relevantIds: ['blog:cs153-ai:body:'],
    mustInclude: ['500'],
  },
  {
    id: 'shazam-author',
    category: 'single-fact',
    question: {
      en: 'Who wrote the paper behind the Shazam algorithm?',
      'zh-TW': 'Shazam 演算法背後那篇論文是誰寫的?',
      ja: 'Shazam のアルゴリズムの元になった論文は誰が書きましたか?',
    },
    relevantIds: ['blog:shazam:body:'],
    mustInclude: ['avery wang'],
  },

  // ── agentic design patterns (sourceType 'knowledge') ─────────────────────
  // Twenty-two chunks with no golden item at all. They are chatbot-only — no
  // page on the site renders them — so retrieval is the ONLY way a visitor can
  // reach them, and nothing was checking that they are reachable.
  {
    id: 'pattern-reflection',
    category: 'single-fact',
    question: {
      en: 'Where does Charles use the reflection pattern?',
      'zh-TW': 'Charles 在哪裡用到 reflection 這個模式?',
      ja: 'Charles は reflection パターンをどこで使っていますか?',
    },
    relevantIds: ['pattern:reflection:'],
    mustInclude: ['playbook'],
  },
  {
    id: 'pattern-rag',
    category: 'single-fact',
    question: {
      en: 'How does Charles describe the retrieval-augmented generation pattern?',
      'zh-TW': 'Charles 怎麼描述 RAG 這個檢索增強生成模式?',
      ja: 'Charles は RAG（検索拡張生成）パターンをどう説明していますか?',
    },
    relevantIds: ['pattern:knowledge-retrieval-rag:'],
    mustState:
      'Charles describes RAG as grounding answers in external data the model never trained on, and his own system fuses dense and sparse retrieval and then reranks before generating with citations.',
  },
  {
    id: 'pattern-human-loop',
    category: 'single-fact',
    question: {
      en: 'What role does a human play in Charles\'s agent loops?',
      'zh-TW': 'Charles 的 agent 流程裡，人扮演什麼角色?',
      ja: 'Charles のエージェントのループで、人はどんな役割を担っていますか?',
    },
    relevantIds: ['pattern:human-in-the-loop:'],
    mustState:
      'Charles is himself the human in the loop, reviewing and steering what his coding agents produce before anything goes live.',
  },
  {
    id: 'patterns-known',
    category: 'global',
    question: {
      en: 'Does Charles actually know agentic design patterns?',
      'zh-TW': 'Charles 真的懂 agentic design patterns 嗎?',
      ja: 'Charles は本当に agentic design patterns を理解していますか?',
    },
    // The overview is the canonical answer; the two named patterns below are
    // legitimate evidence for the same question because each one says where he
    // applies it. A bare 'pattern:' prefix would have been a wildcard over the
    // whole source type, scoring a hit on any of the twenty-two and measuring
    // nothing.
    relevantIds: ['pattern:overview:', 'pattern:reflection:', 'pattern:multi-agent-collaboration:'],
    mustInclude: ['playbook'],
  },

  // ── skills chunk ─────────────────────────────────────────────────────────
  // One chunk, previously unreachable by any golden item. No mustInclude: the
  // entries are deliberately playful one-liners that each locale rewrites, so
  // there is no language-neutral token to assert. Recall is the whole test.
  {
    id: 'skills-listed',
    category: 'single-fact',
    question: {
      en: 'What skills does Charles list on his site?',
      'zh-TW': 'Charles 在網站上列了哪些技能?',
      ja: 'Charles はサイトにどんなスキルを挙げていますか?',
    },
    relevantIds: ['skills:all:'],
    mustState:
      'The skills Charles lists on his site are written as tongue-in-cheek one-liners about product work, along the lines of a GPS for chaos or professional cat herding.',
  },

  // ── near-miss pairs (hard negatives) ─────────────────────────────────────
  // Each pair is the same sentence with one noun changed, and the answers are
  // different numbers. A retriever that returns the sibling scores a hit on
  // recall@k while answering the wrong question, so these are the items where
  // correctness and recall come apart — which is exactly the failure a single
  // similarity threshold cannot see.
  {
    id: 'nueip-metric',
    category: 'near-miss',
    question: {
      en: 'By how much did data-driven decisions improve at NUEIP?',
      'zh-TW': 'NUEIP 的數據驅動決策提升了多少?',
      ja: 'NUEIP ではデータ駆動の意思決定がどれだけ向上しましたか?',
    },
    relevantIds: ['experience:nueip-technology-co-ltd:'],
    mustInclude: ['40'],
  },
  {
    id: 'pxpay-metric',
    category: 'near-miss',
    question: {
      en: 'By how much did sign-up conversion improve at PXPay Plus?',
      'zh-TW': 'PXPay Plus 的註冊轉換率提升了多少?',
      ja: 'PXPay Plus では登録コンバージョンがどれだけ向上しましたか?',
    },
    relevantIds: ['experience:pxpay-plus-co-ltd:'],
    mustInclude: ['25'],
  },
  {
    id: 'flux-team-size',
    category: 'near-miss',
    question: {
      en: 'How many people did Charles direct at FLUX?',
      'zh-TW': 'Charles 在 FLUX 帶了多少人?',
      ja: 'Charles は FLUX で何人を率いていましたか?',
    },
    relevantIds: ['experience:flux-technology-inc:'],
    mustInclude: ['10'],
  },
  {
    id: 'uspace-team-size',
    category: 'near-miss',
    question: {
      en: 'How big was the Scrum team Charles led at USPACE?',
      'zh-TW': 'Charles 在 USPACE 帶的 Scrum 團隊有多大?',
      ja: 'Charles が USPACE で率いた Scrum チームは何人でしたか?',
    },
    relevantIds: ['experience:uspace-tech-co-ltd:'],
    mustInclude: ['15'],
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
    mustInclude: ['indexeddb'],
    mustState: 'Path solves the problem of needing to record and read data without a network connection, by working offline first and syncing later.',
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
    mustState:
      'Product Playbook is an AI product-manager partner for Claude Code that turns a rough idea into a plan an engineer can build.',
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
    mustState:
      'House Ops turns the free-form text of a property listing into structured fields with an LLM, and then scores and ranks the listings automatically.',
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
    relevantIds: ['about:philosophy', 'project:product-playbook:', 'blog:product-sense:'],
    mustState:
      'Charles judges a product by whether user behaviour and business metrics actually changed, and holds strong hypotheses that he lets data overturn.',
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
    relevantIds: ['about:ai', 'blog:langgraph-ai:', 'blog:claude-code-agent-os:', 'changelog:rag-chatbot:'],
    mustState:
      'Charles uses AI across discovery, spec writing and prototyping, building working prototypes himself with Claude Code and Codex.',
  },
  {
    id: 'builder-identity',
    category: 'global',
    question: {
      en: 'What does Charles mean by being a "Product Builder"?',
      'zh-TW': 'Charles 所謂的「Product Builder」是什麼意思?',
      ja: 'Charles の言う「Product Builder」とはどういう意味ですか?',
    },
    relevantIds: ['about:whoiam', 'about:philosophy:build-to-learn:'],
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
    relevantIds: ['about:ai:spec-writing:', 'project:product-playbook'],
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
