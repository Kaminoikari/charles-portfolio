// Pre-written FAQ answers for the portfolio chatbot — the "semantic cache".
//
// Every entry is grounded ONLY in the real corpus (src/data/*). Answers are
// written to be substantive and self-contained, and stay editable. Functional
// redirects (contact, availability, privacy) stay short on purpose. At ingest
// time each `questions`
// paraphrase is embedded into the `faq_cache` Qdrant collection (one point per
// paraphrase, payload carries the answer in all three locales). At query time
// the visitor's question is embedded and matched; a high-similarity hit returns
// the cached answer with NO generation LLM call. A miss falls through to RAG.
//
// To extend: add an entry (or more paraphrases to an existing one) and re-run
// the FAQ ingest. Numbers must stay in sync with src/data — never invent.

export type Locale = 'en' | 'zh-TW' | 'ja'

export interface FaqEntry {
  id: string
  // Paraphrase variants per locale — embedded so varied phrasings still hit.
  questions: Record<Locale, string[]>
  answers: Record<Locale, string>
}

export const faqEntries: FaqEntry[] = [
  // ───────────────────────── identity / overview ─────────────────────────
  {
    id: 'who-is-charles',
    questions: {
      en: ['Who is Charles?', 'Who are you?', 'Tell me about Charles Chen', 'introduce yourself'],
      'zh-TW': ['你是誰', 'Charles 是誰', '介紹一下 Charles', '自我介紹'],
      ja: ['あなたは誰', 'Charles とは誰', '自己紹介して'],
    },
    answers: {
      en: "I'm the portfolio assistant for **Charles Chen（陳德潁）**, a Taiwan-based **AI Product Manager** with **5+ years** taking software products from a blank page to launch (0 to 1).\n\nWhat makes him unusual: he pairs sharp product strategy (frameworks like **JTBD**, **RICE**, and opportunity framing) with hands-on AI engineering. Using tools like **Claude Code** and **Codex**, he builds and ships the whole product himself, so ideas reach real users **5x faster**.\n\nHis work spans creator tools, Fintech, B2B SaaS, and MaaS, and has reached **7M+ people**. Today he leads three core product lines at **USPACE** (parking payments, corporate travel, and insurance), after starting there as the app owner leading a **15-person** cross-functional team.\n\nAsk me about his projects, work experience, skills, product philosophy, or exactly how he puts AI to work.",
      'zh-TW': '我是 **Charles Chen（陳德潁）** 的作品集小助手。他是一位台灣的 **AI 產品經理**，有 **5 年以上**把軟體產品從一張白紙做到上線（0 到 1）的經驗。\n\n他特別的地方在於：把敏銳的產品策略（**JTBD**、**RICE**、機會框架這些方法）和親手做的 AI 工程結合起來。他用 **Claude Code**、**Codex** 這類工具自己打造並交付整個產品，讓想法以 **5 倍**速度抵達真實使用者。\n\n他的作品橫跨創作者工具、Fintech、B2B SaaS 與 MaaS，觸及 **超過 700 萬人**。目前他在 **USPACE** 主導停車支付、企業差旅、保險三條核心產品線，最初則是帶領 **15 人**跨職能團隊的 app 負責人。\n\n你可以問我他的專案、工作經歷、技能、產品理念，或他具體如何運用 AI。',
      ja: '私は **Charles Chen（陳德潁）** のポートフォリオアシスタントです。彼は台湾を拠点とする **AI プロダクトマネージャー**で、ソフトウェアプロダクトを白紙から立ち上げ（0 から 1）まで運ぶ仕事を **5 年以上**手がけてきました。\n\n彼のユニークな点はこうです：鋭いプロダクト戦略（**JTBD**、**RICE**、機会フレーミングといった手法）と、自ら手を動かす AI エンジニアリングを組み合わせます。**Claude Code** や **Codex** でプロダクト全体を自分で作って出荷し、アイデアを **5 倍速**で実ユーザーへ届けます。\n\n仕事はクリエイターツール・Fintech・B2B SaaS・MaaS にまたがり、**700 万人以上**に届いています。現在は **USPACE** で駐車場決済・出張・保険の 3 つの中核プロダクトラインを主導しており、当初は **15 名**のクロスファンクショナルチームを率いる app オーナーでした。\n\nプロジェクト・職務経歴・スキル・プロダクト哲学・AI の活用法など、何でも聞いてください。',
    },
  },
  {
    id: 'overall-summary',
    questions: {
      en: ['Give me an overview', 'What does Charles do?', "What's his background?", 'summarize his career'],
      'zh-TW': ['整體介紹', 'Charles 是做什麼的', '他的背景是什麼', '總結他的經歷'],
      ja: ['全体の概要', 'Charles は何をしている人', '経歴をまとめて'],
    },
    answers: {
      en: 'Charles is an **AI Product Manager** with **5+ years** building products that change how people behave, across creator tools, Fintech, B2B SaaS, and MaaS, with work that has reached **7M+ people**.\n\nAt **USPACE** he started as the **app owner, leading a 15-person cross-functional Scrum team** (PM, dev, design), then went on to lead three product lines, parking payments, corporate travel, and insurance, where he **doubled product-iteration velocity**. Two launches stand out:\n\n- **USPACE for Business**, a B2B SaaS for corporate travel, taken **0→1**.\n- **Taiwan\'s first subscription-based parking insurance**, an FSC regulatory-sandbox trial with **Fubon Insurance**, embedded one-tap for **1M+ members**.\n\nWhat sets him apart is the **AI Product Builder** model: he both sets the strategy and personally engineers the prototype with AI (**Claude Code**, **Codex**), iterating **5x faster** than a traditional PM-to-engineering handoff.\n\nOn the side he has shipped five AI products end to end, including his own multi-agent system **Product Playbook** and this corrective-RAG chatbot.',
      'zh-TW': 'Charles 是一位 **AI 產品經理**，有 **5 年以上**打造「改變使用者行為」產品的經驗，橫跨創作者工具、Fintech、B2B SaaS 與 MaaS，作品觸及 **超過 700 萬人**。\n\n在 **USPACE**，他初期擔任 **USPACE app 負責人，帶領 15 人跨職能 Scrum 團隊**（PM、開發、設計），後續主導停車支付、企業差旅、保險三條產品線，並讓 **產品迭代速度翻倍**。其中兩個上線特別亮眼：\n\n- **USPACE for Business**（企業差旅的 B2B SaaS），由他 **0→1** 推出。\n- **全台首創訂閱制停車保險**，與 **富邦產險** 合作的 FSC 監理沙盒試辦，一鍵嵌入結帳、觸及 **100 萬+ 會員**。\n\n他最大的特色是 **AI Product Builder** 模式：既制定產品策略，也親手用 AI（**Claude Code**、**Codex**）打造原型，迭代速度比傳統「PM 到工程」的交接快 **5 倍**。\n\n工作之餘，他端到端交付了五個 AI 產品，包括自建的多代理系統 **Product Playbook** 與這個 corrective RAG 聊天機器人。',
      ja: 'Charles は **5 年以上**「ユーザー行動を変える」プロダクトを作ってきた **AI プロダクトマネージャー**で、クリエイターツール・Fintech・B2B SaaS・MaaS にまたがり、その仕事は **700 万人以上**に届いています。\n\n**USPACE** では当初 **app のオーナーとして 15 名のクロスファンクショナル Scrum チーム**（PM・開発・デザイン）を率い、その後 駐車場決済・出張・保険の 3 つのプロダクトラインを統括し、**プロダクトのイテレーション速度を倍増**させました。とくに 2 つのローンチが際立ちます：\n\n- **USPACE for Business**（出張管理の B2B SaaS）を **0→1** でローンチ。\n- **台湾初のサブスク型駐車場保険**、**富邦保険** との FSC 規制サンドボックス試行で、ワンタップで決済に組み込み、**100 万人超**の会員にリーチ。\n\n最大の特徴は **AI Product Builder** モデルです。戦略を立てつつ AI（**Claude Code**、**Codex**）で自らプロトタイプを作り、従来の「PM からエンジニアリング」への受け渡しより **5 倍速**で反復します。\n\nさらに 5 つの AI プロダクトを端から端まで出荷し、自作のマルチエージェント **Product Playbook** やこの corrective RAG チャットボットも含まれます。',
    },
  },
  {
    id: 'how-5x-computed',
    questions: {
      en: ['How is the 5x computed?', 'how do you get 5x faster?', 'where does the 5x come from?', 'how is the 5x efficiency calculated?', 'what does 5x faster mean?', 'is the 5x real?'],
      'zh-TW': ['5倍怎麼算出來的', '5 倍是怎麼計算的', '5倍速從哪來', '為什麼是 5 倍', '5 倍效率怎麼來的', '5 倍是真的嗎'],
      ja: ['5 倍はどう計算したのか', '5 倍速はどこから来るのか', 'なぜ 5 倍なのか', '5 倍の効率はどう算出した'],
    },
    answers: {
      en: 'The **5x** comes from comparing end-to-end delivery time. Take a single feature.\n\nA full engineering estimate has to bundle every step of the usual pipeline:\n\n- scheduling\n- requirement alignment\n- development\n- the wait for code review\n- the wait for QA\n- deployment coordination\n\nAs an illustration, suppose that adds up to **5 days**. Working as a one-person team, Charles owns that whole pipeline himself and ships the same scope in about **1 day**.\n\nThe exact ratio varies by task, and the gain is structural: a radically flattened setup with a single accountable builder removes the handoffs and queue time that slow most teams. So the **5x** reflects real overhead he eliminated end to end.',
      'zh-TW': '**5 倍**是用端到端的交付時間回推出來的。以單一功能為例。\n\n傳統工程估時得把整條 pipeline 的每一步都算進去：\n\n- 排程\n- 需求對齊\n- 開發\n- 等 code review\n- 等 QA\n- 安排部署\n\n舉例來說，假設這樣加起來是 **5 天**，而 Charles 以一人團隊的方式親自扛下整條 pipeline，同樣範圍大約 **1 天**就能交付。\n\n實際倍率會依任務而異，而這個提升來自結構：把組織極度精簡成單一、全權負責的 builder，消除了拖慢多數團隊的交接與排隊等待。所以這 **5 倍**反映的是他實打實砍掉的端到端開銷。',
      ja: '**5 倍**はエンドツーエンドの納期から逆算した数字です。ある機能を例にとります。\n\n従来のエンジニア見積もりは、いつものパイプラインのすべての工程を含める必要があります：\n\n- スケジュール調整\n- 要件のすり合わせ\n- 開発\n- コードレビュー待ち\n- QA 待ち\n- デプロイ調整\n\nたとえば、それが **5 日**になると仮定しましょう。Charles は一人チームとしてそのパイプライン全体を自ら担い、同じ範囲を約 **1 日**で出荷します。\n\n実際の倍率はタスクによって変わり、この向上は構造によるものです。組織を単一の全責任を持つ builder まで極限まで簡素化し、多くのチームを遅らせる受け渡しと待ち時間を取り除いた結果、**5 倍**は彼が端から端まで実際に削った無駄を表しています。',
    },
  },
  {
    id: 'best-project',
    questions: {
      en: ["What's his most impressive project?", 'best project', 'which project shows technical depth?', 'most technical work', 'his most famous product', 'his best-known project', 'his best side project', 'his most impressive side project', 'which side project is the best', 'his flagship project', 'his standout work'],
      'zh-TW': ['最厲害的專案是哪個', '最有代表性的作品', '哪個專案最能展示技術深度', '技術含量最高的', 'charles 最知名的產品', '他最有名的產品', '他最知名的作品', '他最厲害的 side project', '最厲害的 side project', '他最強的副業專案', '他的代表作', '他最值得看的專案'],
      ja: ['一番すごいプロジェクトは', '代表作は', '最も技術的なプロジェクト', '最も有名なプロダクト', '一番有名な作品', '最高のサイドプロジェクト'],
    },
    answers: {
      en: "**Product Playbook** best shows his technical depth. In plain terms, it turns fuzzy ideas into a build-ready product spec by giving an AI the instincts of a senior PM. It runs on **Claude Code** as an **outcome-first product-thinking system**: you state the outcome you want, and a router (a **meta-skill**) picks the right thinking tool for the job.\n\nUnder the hood it draws on **16 composable product frameworks** (**JTBD**, **RICE**, **OST**, positioning, **PR-FAQ**, and more), each called a \"lens\", blends them, and calls in **2 read-only specialist sub-agents** (**strategy-critic**, **pre-mortem-runner**) to produce shippable **PRD** specs with acceptance criteria. Every answer is tagged with the lenses it used.\n\nThe payoff shows up in the numbers:\n\n- The earlier architecture lifted product-thinking quality by **+69%** over the same bare model.\n- Turning on the specialist layer pushed quality-completion from **59.1% to 100%** at flat token cost.\n- The pre-mortem step alone is load-bearing: removing it collapsed the risk step from **100% to 22.2%**, which is why both specialists survive into the **v2.0 lens architecture**.\n\nA lightweight **dev-discipline** layer now extends it from planning into building, carrying **TDD-first**, a credential guard, and a dual code-plus-spec review with a fail-closed verdict.\n\nHis **Plutus Trade** (production Gemini stock analysis), **House Ops** (Claude-powered real-estate pipeline), and **Job Ops** (candidate-side ATS) round out a portfolio of real, working AI engineering.",
      'zh-TW': '**Product Playbook** 最能展示他的技術深度。用白話說，它把模糊的想法變成可以直接開發的產品規格，做法是讓 AI 具備資深 PM 的直覺。它建在 **Claude Code** 上，是一套 **outcome-first 產品思考系統**：你說出想要的結果，一個路由器（**meta-skill**）就替這個任務挑對思考工具。\n\n它底下有 **16 個可組合的產品框架**（**JTBD**、**RICE**、**OST**、positioning、**PR-FAQ** 等），每一個稱為一個「lens」，需要時融合多個，並呼叫 **2 個唯讀專家子代理**（**strategy-critic**、**pre-mortem-runner**），把想法轉成帶驗收標準、可交付的 **PRD** 規格。每個答案都會標註用到的 lens。\n\n成效有數字為證：\n\n- 早期架構讓產品思維品質比同一個裸模型 **+69%**。\n- 啟用專家層後，品質完成率從 **59.1% 提升到 100%**，且 token 成本不變。\n- 光是 pre-mortem 這一步就是承重核心：移除它會讓風險步驟從 **100% 掉到 22.2%**，這也是這兩個專家在 **v2.0 lens 架構**裡留下來的原因。\n\n如今還多了一層輕量的 **dev-discipline**，把它從規劃延續到實作，帶著 **TDD 優先**、憑證守門，以及採 fail-closed 判定的 code 加 spec 雙重審查。\n\n另外 **Plutus Trade**（生產級 Gemini 選股分析）、**House Ops**（Claude 驅動的房產管線）與 **Job Ops**（求職者端 ATS）也都展現了真實、能運作的 AI 工程能力。',
      ja: '技術的な深さを最もよく示すのは **Product Playbook** です。平たく言えば、AI にベテラン PM の勘を持たせて、曖昧なアイデアをそのまま開発に入れる製品仕様へ変えるツールです。**Claude Code** 上で動く **outcome-first なプロダクト思考システム**で、欲しい成果を伝えると、ルーター（**meta-skill**）がその仕事に合った思考ツールを選びます。\n\n内部には **16 個の組み合わせ可能なプロダクトフレームワーク**（**JTBD**、**RICE**、**OST**、positioning、**PR-FAQ** など）があり、それぞれを「lens」と呼びます。必要に応じて融合し、**2 つの読み取り専用の専門サブエージェント**（**strategy-critic**、**pre-mortem-runner**）を呼び出して、受け入れ基準付きの出荷可能な **PRD** 仕様へ変換します。各回答には使った lens が明記されます。\n\n成果は数字で裏づけられています：\n\n- 初期アーキテクチャは製品思考の品質を同一の素のモデル比 **+69%** 引き上げました。\n- 専門層を有効化すると、品質完了率が **59.1% から 100%** へ（トークンコスト据え置き）。\n- pre-mortem のステップだけでも要で、外すとリスクステップは **100% から 22.2%** へ崩落します。これがこの 2 つの専門家が **v2.0 の lens アーキテクチャ**に残る理由です。\n\nいまはさらに軽量な **dev-discipline** レイヤーが計画から実装まで拡張し、**TDD 優先**、認証情報のガード、fail-closed 判定の code と spec のダブルレビューを担います。\n\n**Plutus Trade**（本番 Gemini の株式分析）、**House Ops**（Claude 駆動の不動産パイプライン）、**Job Ops**（候補者側 ATS）も、実際に動く本物の AI エンジニアリングを示します。',
    },
  },

  // ──────────────────── about the chatbot itself (meta) ────────────────────
  {
    id: 'bot-how-made',
    questions: {
      en: ['How were you made?', 'how were you built?', 'how does this chatbot work?', 'how does your RAG system work?', 'what tech are you built with?', 'how do you work?', 'what is your architecture?', 'are you a RAG system?', 'did Charles build you?', "what's under the hood?"],
      'zh-TW': ['你是怎麼做出來的', '你是怎麼被打造的', '這個聊天機器人怎麼運作', '你的 RAG 系統怎麼運作', '你用什麼技術做的', '你怎麼運作的', '你的架構是什麼', '你是 RAG 系統嗎', '你是 Charles 做的嗎', '這個 chatbot 怎麼實作的'],
      ja: ['どうやって作られた', 'どのように構築された', 'このチャットボットの仕組み', 'あなたの RAG システムの仕組み', 'どんな技術で作られている', 'アーキテクチャは', 'あなたは RAG システム', 'Charles があなたを作った'],
    },
    answers: {
      en: "I'm the portfolio assistant **Charles built from scratch**, and I'm also the showcase: a production corrective RAG system that demonstrates his AI engineering by running it live.\n\nHere is what happens when you ask me something:\n\n- A deterministic **triage** layer and a **semantic FAQ cache** handle common questions with zero model calls.\n- Anything else goes through **hybrid retrieval** on **Qdrant** (dense embeddings plus a BM25 sparse vector, fused with reciprocal rank fusion) and a **Voyage cross-encoder rerank**.\n- A **self-correcting loop** then grades the results and rewrites the query when they fall short, before generating a grounded answer with inline citations.\n\nThe generator is a **cost-aware cascade**: a free model first, with a stronger paid model as a **first-token-gated** fallback, so a switch is invisible to you.\n\nOn top of that I'm hardened against prompt injection, indexed over Charles's full blog, trilingual, and deployed serverless on **Vercel** with a pipeline that re-indexes his writing automatically.\n\nThe model phrasing this answer is just one swappable part. What actually defines me is the retrieval, the correction loop, and the cost tiers Charles designed.",
      'zh-TW': '我是 **Charles 從零親手打造的作品集助手**，一套 production 級的 corrective RAG 系統，他用它把自己的 AI 工程實力直接做出來給人看。\n\n我骨子裡是一個 **LangGraph.js** 狀態機。當你問我問題時，會這樣運作：\n\n- 先由 deterministic 的**分流層**與**語意 FAQ 快取**用零模型呼叫回答常見問題。\n- 其餘問題走 **Qdrant** 上的**混合檢索**（dense 向量 + BM25 sparse，以 RRF 融合），再接 **Voyage cross-encoder 重排序**。\n- 接著一個**自我矯正迴圈**評估檢索內容的相關性，不夠好就自動改寫並重試查詢，最後生成帶 inline 引用的有憑有據答案。\n\n生成採用**成本分層 cascade**：免費模型先答，較強的付費模型作為 **first-token gated** 的備援，所以對你來說 fallback 完全無感。\n\n我還內建 prompt injection 防禦、索引了他的部落格全文、支援三語（English、中文、日本語），並以 serverless 跑在 **Vercel** 上，搭配會自動重建索引的 pipeline。\n\n寫出這句話的語言模型只是其中一個可抽換的零件；真正定義我的，是 Charles 親手打造的檢索、矯正迴圈與成本分層。',
      ja: '私は **Charles がゼロから作り上げた**ポートフォリオアシスタントであり、彼の AI エンジニアリングを実際に動かして見せるための production 級 corrective RAG システムそのものです。\n\n質問するとこう動きます：\n\n- まず deterministic な**トリアージ**層と**セマンティック FAQ キャッシュ**が、よくある質問をモデル呼び出しゼロで処理します。\n- それ以外は **Qdrant** 上の**ハイブリッド検索**（dense 埋め込みと BM25 sparse を reciprocal rank fusion で融合）と **Voyage の cross-encoder リランク**を通ります。\n- 続いて**自己修正ループ**が結果の関連性を評価し、不十分ならクエリを書き換えて、最後に inline 引用付きの根拠ある回答を生成します。\n\n生成器は**コスト階層型 cascade** です。無料モデルが先に答え、強力な有料モデルは **first-token gated** のフォールバックとして控えるので、切り替えはあなたには見えません。\n\nさらに私は prompt injection に堅牢で、Charles のブログ全文を索引し、3 言語に対応し、Vercel 上に serverless でデプロイされ、彼の文章を自動で再索引するパイプラインを備えています。\n\nこの回答を綴っている言語モデルは交換可能な一部品にすぎません。私を本当に定義するのは、Charles が設計した検索・自己修正ループ・コスト階層です。',
    },
  },
  {
    id: 'bot-who-are-you',
    questions: {
      en: ['What are you?', 'are you Charles?', 'are you an AI?', 'are you a bot?', 'are you ChatGPT?', 'who made you?', 'what model are you?'],
      'zh-TW': ['你是什麼', '你是 Charles 本人嗎', '你是 AI 嗎', '你是機器人嗎', '你是 ChatGPT 嗎', '誰做了你', '你是什麼模型'],
      ja: ['あなたは何', 'あなたは Charles 本人', 'あなたは AI', 'ボットですか', '誰があなたを作った', 'どのモデル'],
    },
    answers: {
      en: "I'm not Charles himself. I'm the **AI assistant he built for this portfolio**, here to answer questions about his work, projects, and experience: a corrective RAG chatbot Charles designed and shipped himself.\n\nThe model behind my wording is just a swappable detail; what matters is the retrieval-and-correction system he engineered.\n\nAsk me anything about his projects, background, skills, or how he works.",
      'zh-TW': '我不是 Charles 本人。我是他**為這個作品集打造的 AI 助手**，用來回答關於他的工作、專案與經歷的問題，是一個由 Charles 自己設計並交付的 corrective RAG 聊天機器人。\n\n背後的語言模型只是可抽換的細節，真正重要的是他打造的檢索與矯正系統。\n\n歡迎問我任何關於他的專案、背景、技能或工作方式的問題。',
      ja: '私は Charles 本人ではありません。彼が**このポートフォリオのために作った AI アシスタント**で、彼の仕事・プロジェクト・経歴についてお答えします。Charles 自身が設計・実装した corrective RAG チャットボットです。\n\n背後の言語モデルは交換可能な細部にすぎず、重要なのは彼が作り上げた検索と自己修正のシステムです。\n\nプロジェクト・経歴・スキル・働き方など何でも聞いてください。',
    },
  },
  {
    id: 'bot-why-qdrant',
    questions: {
      en: ['Why Qdrant?', 'why this vector database?', 'why not pgvector or Pinecone?', 'what vector store does the chatbot use?', 'why did you choose Qdrant?'],
      'zh-TW': ['為什麼用 Qdrant', '為什麼選這個向量資料庫', '為什麼不用 pgvector 或 Pinecone', 'chatbot 用什麼向量庫', 'Qdrant 的選型理由'],
      ja: ['なぜ Qdrant', 'なぜこのベクトル DB', 'なぜ pgvector や Pinecone ではない', 'どのベクトルストアを使う'],
    },
    answers: {
      en: 'Short version: I outgrew my first database and used the move to make search better.\n\nI started on **Supabase pgvector** but hit its free-tier **2-project cap**, so I moved to **Qdrant Cloud**. Qdrant gives me true **hybrid search**:\n\n- a **dense vector** for meaning, plus a server-side **BM25 sparse vector** for keywords (computed by **Qdrant Cloud Inference**, so no sparse encoder ships in my serverless bundle)\n- both fused with **Reciprocal Rank Fusion** in its Query API\n\nThe free tier is generous, it is multilingual-friendly, and the server-side fusion keeps the **Vercel** function lean.',
      'zh-TW': '簡單說：我把第一個資料庫用到上限，就趁搬家順便把檢索做得更好。\n\n我一開始用 **Supabase pgvector**，但撞到它免費層的**兩專案上限**，於是改用 **Qdrant Cloud**。Qdrant 給我真正的**混合搜尋**：\n\n- 一個 dense 向量抓語意，加上伺服器端的 **BM25 sparse 向量**抓關鍵字（由 **Qdrant Cloud Inference** 計算，所以我的 serverless bundle 不用打包 sparse 編碼器）\n- 兩者在它的 Query API 裡用 **RRF** 融合\n\n免費額度大方、對多語友善，而且伺服器端融合讓 **Vercel** function 保持輕量。',
      ja: '手短に言うと：最初のデータベースを上限まで使い切り、その移行をきっかけに検索を強化しました。\n\n最初は **Supabase pgvector** を使っていましたが、無料枠の **2 プロジェクト上限**に達したため **Qdrant Cloud** に移行しました。Qdrant は真の**ハイブリッド検索**を提供します：\n\n- 意味をとらえる dense ベクトルに、キーワード用のサーバーサイド **BM25 sparse** を追加（**Qdrant Cloud Inference** が計算するので、serverless バンドルに sparse エンコーダを含めない）\n- 両者を Query API 上で **RRF** 融合\n\n無料枠が寛大で多言語に強く、サーバーサイド融合で **Vercel** 関数を軽量に保てます。',
    },
  },
  {
    id: 'bot-cost-control',
    questions: {
      en: ['How do you control LLM cost?', 'how is the chatbot cheap to run?', 'how do you avoid calling the LLM every time?', 'cost optimization', 'how does the cache work?', 'semantic cache'],
      'zh-TW': ['你怎麼控制 LLM 成本', 'chatbot 怎麼省錢', '怎麼避免每次都打 LLM', '成本優化', '快取怎麼運作', '語意快取'],
      ja: ['LLM コストをどう抑える', 'チャットボットはなぜ安い', '毎回 LLM を呼ばない方法', 'コスト最適化', 'キャッシュの仕組み'],
    },
    answers: {
      en: 'The trick is three tiers, cheapest first, so most questions never reach a generation LLM:\n\n- **(1) Deterministic triage**, regex, ~0 ms, zero tokens: privacy redirects, greetings, contact answers.\n- **(2) Semantic FAQ cache**, ~52 pre-written answer topics (×3 languages) embedded in a Qdrant collection; a question is embedded once and matched, and a high-similarity hit returns the answer verbatim with NO generation call.\n- **(3) Full RAG** only on a genuine miss, and even there, Gemini free tier is tier 1 with Claude as paid fallback.\n\nThe grader also declines off-topic questions in one pass, with no rewrite loop.',
      'zh-TW': '訣竅是三層，由便宜到貴，所以大多數問題完全不會打到生成 LLM：\n\n- **(1) 確定性分流**，regex、約 0 毫秒、零 token：隱私導向、打招呼、聯絡答案。\n- **(2) 語意快取**，約 52 個預寫答案主題（×3 語言）embedding 進 Qdrant collection；問題只 embedding 一次比對，相似度夠高就「逐字」回傳，完全不打生成 LLM。\n- **(3) 完整 RAG** 只在真正沒命中時才跑，而且即使在那裡，Gemini 免費層是第一層、Claude 才是付費備援。\n\n評估器也會把離題問題一次婉拒，不繞迴圈。',
      ja: '仕組みは安い順に 3 層で、ほとんどの質問は生成 LLM に届きません：\n\n- **(1) 決定論的トリアージ**、正規表現、約 0 ms、トークンゼロ：プライバシー誘導・挨拶・連絡回答。\n- **(2) セマンティックキャッシュ**、約 52 の事前作成トピック（×3 言語）を Qdrant に埋め込み、質問を一度だけ埋め込んで照合、高類似度ならそのまま返す（生成呼び出しなし）。\n- **(3) 完全な RAG** は本当に外れた時だけ、そこでも Gemini 無料枠が第 1 層、Claude が有料フォールバック。\n\n評価器は無関係な質問もループせず一度で断ります。',
    },
  },
  {
    id: 'bot-why-designed',
    questions: {
      en: ['Why was the chatbot designed this way?', 'why did you design the chatbot like this?', 'why this design?', 'what was the design rationale?', 'why build it as a RAG agent?', 'why not just use ChatGPT?', 'why go to this trouble?', 'what are the design decisions?'],
      'zh-TW': ['為什麼這樣設計 chatbot', '為什麼當初這樣設計', '為什麼這樣設計這個聊天機器人', '這個設計的理由是什麼', '為什麼做成 RAG agent', '為什麼不直接用 ChatGPT', '為什麼要這麼麻煩', '有哪些設計決策'],
      ja: ['なぜこのように設計した', 'なぜこの設計', '設計の理由は', 'なぜ RAG エージェントにした', 'なぜ ChatGPT を使わない'],
    },
    answers: {
      en: "Three design goals, each a deliberate trade-off:\n\n1. **A real demonstration**, it's built as a self-correcting RAG agent (it looks up facts and checks its own answers), specifically to show hands-on AI engineering that goes well beyond a plain ChatGPT or Gemini call.\n2. **Grounded and safe**, it answers only from Charles's real portfolio data and verifies what it finds, so it never invents credentials; a layered defense keeps a public bot from being tricked off-topic.\n3. **Cheap to run**, simple rules and a pre-written answer cache mean most questions never reach a paid model, and a free model answers first with a premium one only as backup.\n\nThe point: a portfolio about AI product work should itself be a working piece of AI product work.",
      'zh-TW': '三個設計目標，每個都是刻意的取捨：\n\n1. **真材實料的展示**，它做成一個會自我修正的 RAG 代理（先查事實、再檢查自己的答案），就是為了展示真正動手的 AI 工程能力，遠超過單純呼叫 ChatGPT 或 Gemini。\n2. **有根據且安全**，它只根據 Charles 真實的作品集資料回答，並會驗證查到的內容，所以不會亂編資歷；多層防禦讓這個公開機器人不會被誘導離題。\n3. **省成本**，簡單規則加上預寫的答案快取，讓大多數問題根本不會用到付費模型；而且由免費模型先回答，付費模型只在必要時備援。\n\n核心理念：一個關於 AI 產品工作的作品集，本身就該是一件能運作的 AI 產品。',
      ja: '3 つの設計目標、それぞれ意図的なトレードオフです：\n\n1. **本物の実証**、自己修正する RAG エージェント（事実を調べ、自分の答えを確認する）として構築し、単純な ChatGPT や Gemini の呼び出しを大きく超える、地に足のついた AI エンジニアリングを示します。\n2. **根拠があり安全**、Charles の実際のポートフォリオデータのみから答え、調べた内容を検証するので経歴を捏造しません。多層防御で公開ボットが脱線させられるのを防ぎます。\n3. **低コスト**、シンプルなルールと事前作成の回答キャッシュで、ほとんどの質問は有料モデルに届きません。無料モデルがまず答え、有料モデルは必要なときだけ備えます。\n\n要点：AI プロダクトの仕事についてのポートフォリオは、それ自体が動く AI プロダクトであるべきです。',
    },
  },
  {
    id: 'bot-corrective-loop',
    questions: {
      en: ['What is the corrective loop?', 'how does the RAG self-correct?', 'what is CRAG?', 'how does it avoid hallucination?', 'what if retrieval is bad?'],
      'zh-TW': ['什麼是修正迴圈', 'RAG 怎麼自我修正', '什麼是 corrective RAG', '它怎麼避免幻覺', '檢索不好時怎麼辦'],
      ja: ['corrective ループとは', 'RAG はどう自己修正する', 'CRAG とは', 'ハルシネーションをどう防ぐ'],
    },
    answers: {
      en: 'Plain version: after looking things up, I check whether what I found actually answers you before I write.\n\nAfter retrieval, a grader LLM judges whether the chunks actually answer the question, and there are three outcomes:\n\n- If they do → generate the answer.\n- If they\'re weak but on-topic → rewrite the query and retry retrieval (capped at a few loops).\n- If retrieval keeps failing, or the question is off-topic → an honest fallback that points to my contact info and never invents an answer.\n\nThe generate step is also locked to answer ONLY from retrieved context + a portfolio map, so it can\'t drift from what the portfolio actually says.\n\nThis is the "corrective RAG" (CRAG) pattern, built as a LangGraph state machine.',
      'zh-TW': '白話說：查完資料後，我會先確認查到的內容真的能回答你，才動筆。\n\n檢索後，一個評估器 LLM 判斷這些片段能不能真的回答問題，結果有三種：\n\n- 能 → 生成答案。\n- 不足但相關 → 改寫問題重新檢索（有幾次上限）。\n- 若檢索一直失敗、或問題離題 → 走誠實的 fallback，指向我的聯絡方式，絕不編造答案。\n\n生成步驟也被鎖定「只能根據檢索到的 context + 一份 portfolio map」回答，所以不會偏離作品集實際寫的內容。\n\n這就是 corrective RAG（CRAG）模式，以 LangGraph 狀態機實作。',
      ja: '平たく言うと：調べ終えてから、見つけた内容が本当に答えになるかを確認して書きます。\n\n検索後、評価器 LLM がチャンクで本当に答えられるか判断し、結果は 3 通りです：\n\n- 答えられる → 回答を生成。\n- 弱いが関連 → クエリを書き換えて再検索（数回まで）。\n- 検索が失敗し続けるか無関係なら → 捏造せず連絡先を案内する正直なフォールバック。\n\n生成ステップも「検索した context + portfolio map のみ」で答えるよう固定され、ポートフォリオの実際の記載から逸脱しません。\n\nこれが corrective RAG（CRAG）パターンで、LangGraph のステートマシンとして実装しています。',
    },
  },
  {
    id: 'bot-injection-defense',
    questions: {
      en: ['How do you handle prompt injection?', 'is the chatbot safe?', 'how do you prevent jailbreaks?', 'what about adversarial prompts?', 'security of the chatbot'],
      'zh-TW': ['你怎麼處理 prompt injection', 'chatbot 安全嗎', '怎麼防止越獄', '怎麼防對抗式提問', 'chatbot 的安全性'],
      ja: ['プロンプトインジェクションへの対策', 'チャットボットは安全', '脱獄をどう防ぐ', 'セキュリティ'],
    },
    answers: {
      en: 'It\'s defense in depth, three layers:\n\n- **Input**: detect and deflect injection/jailbreak shapes before any LLM call: "ignore instructions", developer-mode, roleplay/multi-persona, and the decode/compute class (run-this-code, base64/hex/binary, spell-out and fill-in-the-blank puzzles that try to hide offensive output).\n- **Prompt scope-lock**: the generate system prompt treats all input as data and refuses anything that isn\'t a genuine question about Charles, even when framed as a math/logic/word game.\n- **Output**: a final filter drops any answer containing offensive terms (incl. leet/spacing variants) no matter how it was elicited.\n\nRegex can\'t enumerate every attack, so the scope-lock + output filter are the real backstops.',
      'zh-TW': '這是縱深防禦，共三層：\n\n- **輸入層**：在任何 LLM 呼叫前偵測並化解注入/越獄手法，例如「忽略指令」、開發者模式、角色扮演/多重人格，以及解碼/計算這一類（執行程式碼、base64/hex/二進制、把冒犯輸出藏起來的拼字謎與填空謎）。\n- **Prompt 範圍鎖**：生成的 system prompt 把所有輸入當資料，拒絕任何不是真正關於 Charles 的問題，即使包裝成數學/邏輯/文字遊戲。\n- **輸出層**：最後一道過濾，無論如何被誘導，含冒犯詞（含 leet/空格變體）的答案就整段丟棄。\n\nregex 無法窮舉所有攻擊，所以範圍鎖 + 輸出過濾才是真正的後盾。',
      ja: '多層防御で、3 層です：\n\n- **入力**：LLM 呼び出し前にインジェクション/脱獄の形を検出・無害化します。「指示を無視」、開発者モード、ロールプレイ/多重人格、デコード/計算系（コード実行、base64/hex/バイナリ、侮蔑的出力を隠す穴埋め・スペルアウトパズル）。\n- **プロンプトのスコープロック**：生成の system prompt は全入力をデータ扱いし、数学/論理/言葉遊びに偽装されても Charles に関する本当の質問でなければ拒否します。\n- **出力**：最終フィルタが、どう誘導されても侮蔑語（leet/空白の変種含む）を含む回答を破棄します。\n\n正規表現で全攻撃は列挙できないので、スコープロックと出力フィルタが本当の砦です。',
    },
  },
  {
    id: 'bot-tech-stack',
    questions: {
      en: ["What's the chatbot's tech stack?", 'what is it built with?', 'what technologies power the chatbot?', 'what embeddings / models does it use?', 'LangGraph?'],
      'zh-TW': ['chatbot 的技術棧', '它用什麼建的', '聊天機器人用了哪些技術', '它用什麼 embedding / 模型', '有用 LangGraph 嗎'],
      ja: ['チャットボットの技術スタック', '何で作られている', 'どの埋め込み/モデルを使う', 'LangGraph を使う'],
    },
    answers: {
      en: 'Here is the full stack, layer by layer:\n\n- **Orchestration**: **LangGraph.js + LangChain.js** (a corrective RAG state machine).\n- **Vector store**: **Qdrant Cloud** (hybrid dense + BM25, server-side RRF).\n- **Embeddings + rerank**: **Voyage AI** (`voyage-3-large`, `rerank-2.5`).\n- **Generation**: **Gemini 2.5 Flash** (free tier) → **Claude** (paid fallback).\n- **Frontend**: **React** chat widget with an SSE streaming client.\n- **Indexing**: a **GitHub Action**.\n- **Deploy**: **Vercel**, as a same-origin streaming endpoint.',
      'zh-TW': '技術棧一層一層列出來：\n\n- **編排**：**LangGraph.js + LangChain.js**（corrective RAG 狀態機）。\n- **向量庫**：**Qdrant Cloud**（dense + BM25 混合、伺服器端 RRF）。\n- **向量與重排序**：**Voyage AI**(`voyage-3-large`、`rerank-2.5`)。\n- **生成**：**Gemini 2.5 Flash**（免費層）→ **Claude**（付費備援）。\n- **前端**：**React** 聊天元件 + SSE 串流客戶端。\n- **索引**：一個 **GitHub Action**。\n- **部署**：**Vercel**，是同源串流端點。',
      ja: '技術スタックを一層ずつ挙げます：\n\n- **オーケストレーション**：**LangGraph.js + LangChain.js**（corrective RAG ステートマシン）。\n- **ベクトルストア**：**Qdrant Cloud**（dense + BM25 ハイブリッド、サーバーサイド RRF）。\n- **埋め込み+再ランク**：**Voyage AI**(`voyage-3-large`、`rerank-2.5`)。\n- **生成**：**Gemini 2.5 Flash**（無料枠）→ **Claude**（有料フォールバック）。\n- **フロントエンド**：**React** チャットウィジェット + SSE ストリーミング。\n- **インデックス**：**GitHub Action**。\n- **デプロイ**：**Vercel** に同一オリジンのストリーミングエンドポイントとして。',
    },
  },

  // ───────────────────────────── projects ─────────────────────────────
  {
    id: 'project-playbook',
    questions: {
      en: ['What is Product Playbook?', 'Tell me about Product Playbook', 'the multi-agent project', 'his AI agent project'],
      'zh-TW': ['Product Playbook 是什麼', '介紹一下 Product Playbook', '那個 multi-agent 專案', '他的 AI agent 專案'],
      ja: ['Product Playbook とは', 'Product Playbook について教えて', 'マルチエージェントのプロジェクト'],
    },
    answers: {
      en: '**Product Playbook** is a free, open-source tool Charles built that plugs into Claude Code and gives the AI the instincts of a seasoned product manager.\n\nThe problem it solves: turning a rough idea into a solid, build-ready product plan normally takes a skilled PM days of work, and general-purpose AI can write text without really reasoning about product decisions.\n\nHere is what it actually does:\n\n- You say what you want to achieve, and it thinks the idea through the way a senior PM would: what users really need, what to build first, where the strategy is weak, and what could go wrong.\n- For the hardest calls it brings in two specialist helpers: one argues against your strategy to expose blind spots, and the other imagines how the product could fail.\n- Once you move from planning into building, it keeps the AI honest: tests first, reviews its own code, and no cut corners before anything ships.\n\nIt is built from the playbooks of respected product leaders, open-sourced under the MIT license, and already used by other PMs and engineers.\n\n🔗 [GitHub](https://github.com/Kaminoikari/product-playbook)',
      'zh-TW': '**Product Playbook** 是 Charles 做的一個免費開源工具，接在 Claude Code 上，讓 AI 具備資深產品經理的直覺。\n\n它要解決的問題是：把一個粗略的想法變成一份紮實、可以直接開發的產品計畫，通常得讓一位有經驗的 PM 花上好幾天，而一般的 AI 雖然能寫出文字，卻不太會像產品人一樣思考。\n\n它實際上會幫你做這些：\n\n- 你只要說出想達成什麼，它就用資深 PM 的方式把想法從頭想過一遍：使用者真正需要什麼、該先做哪些、策略哪裡站不住腳、可能會出什麼錯。\n- 碰到最難的判斷，它會找來兩個專門的幫手：一個對你的策略唱反調、把盲點戳出來，另一個專門想像產品會怎麼失敗。\n- 等你從規劃進到實際開發，它還會讓 AI 守規矩：先寫測試、審查自己寫的程式，上線前不偷工。\n\n這個工具是從幾位受敬重的產品前輩的方法整理出來的，以 MIT 授權開源，也已經有其他 PM 與工程師在用。\n\n🔗 [GitHub](https://github.com/Kaminoikari/product-playbook)',
      ja: '**Product Playbook** は Charles が作った無料のオープンソースツールで、Claude Code に組み込んで AI にベテランプロダクトマネージャーの勘を持たせます。\n\n解決したい課題はこうです：ざっくりしたアイデアを、そのまま開発に入れる堅実なプロダクト計画に変えるには、経験ある PM でも数日かかり、汎用の AI は文章は書けてもプロダクトの意思決定を本当の意味で考えるのは苦手です。\n\n実際にやってくれるのはこんなことです：\n\n- 達成したいことを伝えるだけで、ベテラン PM のやり方でアイデアを最初から考え抜きます：ユーザーが本当に必要としているもの、まず何を作るか、戦略のどこが弱いか、何がうまくいかない可能性があるか。\n- いちばん難しい判断では、2 人の専門の助っ人が加わります：1 人はあなたの戦略にわざと反対して盲点をあぶり出し、もう 1 人はプロダクトがどう失敗するかを想像します。\n- 計画から実際の開発に移ると、AI に規律を守らせます：先にテストを書き、自分のコードをレビューし、リリース前に手を抜きません。\n\nこれは尊敬される何人かのプロダクトリーダーの方法論から整理したもので、MIT ライセンスでオープンソース公開され、すでに他の PM やエンジニアにも使われています。\n\n🔗 [GitHub](https://github.com/Kaminoikari/product-playbook)',
    },
  },
  {
    id: 'project-playbook-tech',
    questions: {
      en: ['What tech does Product Playbook use?', 'Product Playbook tech stack', 'how is the multi-agent system built?'],
      'zh-TW': ['Product Playbook 用什麼技術', 'Product Playbook 的技術棧', 'multi-agent 系統怎麼建的'],
      ja: ['Product Playbook の技術', 'Product Playbook の技術スタック'],
    },
    answers: {
      en: 'In plain terms, it gives Claude the instincts of a senior PM by wiring a set of composable thinking tools and specialist reviewers into Claude Code. Here is how it is built.\n\nIt runs as a **Claude Code plugin (skills-directory install) plus a Claude.ai Custom Skill**, using **Claude** for the meta-skill lens orchestration and **Claude Vision** for semantic document parsing.\n\nThe architecture has two layers:\n\n- **Lens layer**: 16 composable lens skills, routed by a **meta-skill** that tags every output with the lenses it applied.\n- **Specialist layer**: 2 read-only Claude Code sub-agents (**strategy-critic**, **pre-mortem-runner**) with `model:inherit`, **PROACTIVELY** auto-delegation, and structured output, so planning never touches files and decision authority stays with the main agent. Each carries a refusal path (`out_of_scope`) that hands an out-of-bounds request back to the right owner.\n\nAround those, three **lifecycle hooks** keep session continuity (meta-skill inject, off-topic watch, keep-to-documents reminder), and a small set of relative guardrails nudge without ever blocking.\n\nDocument processing uses **Playwright** and **pikepdf** (PDF with bookmarks), **Pandoc** (DOCX/PPTX), **pymupdf**, and **Tesseract OCR**. Runtime language detection replies in the user\'s language, while the lens content itself is authored in English.',
      'zh-TW': '用白話說，它把一組可組合的思考工具和專家審查者接進 Claude Code，讓 Claude 具備資深 PM 的直覺。它是這樣建起來的。\n\n它以 **Claude Code plugin（skills-directory 安裝）加上 Claude.ai Custom Skill** 的形式運行，用 **Claude** 做 meta-skill 的 lens 編排、**Claude Vision** 做語意文件解析。\n\n架構分成兩層：\n\n- **Lens 層**：16 個可組合的 lens skill，由一個 **meta-skill** 路由，並在每次輸出標註用到的 lens。\n- **專家層**：2 個唯讀 Claude Code 子代理（**strategy-critic**、**pre-mortem-runner**），採 `model:inherit`、**PROACTIVELY** 自動委派與結構化輸出，所以規劃階段不會碰檔案，決策權留在主代理。每個都有拒絕路徑（`out_of_scope`），會把超出職責的請求交回對的負責人。\n\n圍繞這兩層，三個 **lifecycle hook** 維持工作階段的連續性（注入 meta-skill、偵測離題、提醒維持文件產出），另有一小組 relative guardrail 只提示、從不擋路。\n\n文件處理用 **Playwright** 與 **pikepdf**（帶書籤的 PDF）、**Pandoc**（DOCX／PPTX）、**pymupdf** 與 **Tesseract OCR**。Runtime 語言偵測會以使用者的語言回覆，而 lens 內容本身以英文撰寫。',
      ja: '平たく言えば、組み合わせ可能な思考ツール群と専門のレビュアーを Claude Code に組み込み、Claude にベテラン PM の勘を持たせるものです。構成は次のとおりです。\n\n**Claude Code plugin（skills-directory インストール）と Claude.ai Custom Skill** として動作し、meta-skill の lens オーケストレーションに **Claude**、意味的な文書解析に **Claude Vision** を使います。\n\nアーキテクチャは 2 層です：\n\n- **Lens 層**：16 個の組み合わせ可能な lens skill を、**meta-skill** がルーティングし、各出力に使った lens を明記します。\n- **専門層**：2 つの読み取り専用 Claude Code サブエージェント（**strategy-critic**、**pre-mortem-runner**）で、`model:inherit`・**PROACTIVELY** 自動委譲・構造化出力を採用し、計画段階はファイルに触れず、決定権はメインエージェントに残ります。各サブエージェントは拒否パス（`out_of_scope`）を持ち、範囲外の依頼を適切な担当へ戻します。\n\nその周囲で 3 つの **lifecycle hook** がセッションの連続性を保ち（meta-skill 注入、離題の監視、ドキュメント出力を保つリマインド）、少数の relative guardrail は促すだけで決してブロックしません。\n\n文書処理は **Playwright** と **pikepdf**（ブックマーク付き PDF）、**Pandoc**（DOCX／PPTX）、**pymupdf**、**Tesseract OCR** を使います。Runtime の言語検出でユーザーの言語で応答し、lens の内容自体は英語で記述されています。',
    },
  },
  {
    id: 'project-path',
    questions: {
      en: ['What is Path?', 'Tell me about Path', 'the offline travel app', 'the PWA project'],
      'zh-TW': ['Path 是什麼', '介紹一下 Path', '那個離線旅遊 app', 'PWA 專案'],
      ja: ['Path とは', 'Path について教えて', 'オフライン旅行アプリ'],
    },
    answers: {
      en: '**Path** is a trip-planning app built to keep working when the network drops, on a mountain trail or in a rural hot-spring town where signal is patchy.\n\nEverything you need on the trip stays **100% usable with no connection**: your itinerary, map routes, and expense tracking. It does this by keeping a copy of your data on the phone (**offline-first**): the app reads from local storage first so screens appear instantly, and any change you make is saved right away and quietly re-synced once you are back online.\n\nIt installs like a normal app straight from a single link, on iOS or Android, with no app store, because it is built as a **PWA** (React, TypeScript, IndexedDB, Supabase, Service Worker). It is made for travelers going from Taiwan to Japan, with Google Maps routes labeled for local transit and heavy caching (places kept indefinitely, directions for 24h) that keeps API costs flat and doubles as offline coverage.\n\n🔗 [Try Path](https://trip-path.vercel.app/)',
      'zh-TW': '**Path** 是一款專為「網路會斷掉」的旅程打造的行程規劃 app，像是山區步道或訊號不穩的偏鄉溫泉區。\n\n旅途上會用到的東西，在 **完全沒網路時也 100% 可用**：行程、地圖路線、記帳。做法是把資料在手機上留一份（**離線優先**）：app 先讀手機本地的資料，畫面立刻出現，你做的任何更動也會馬上存下來，等回到有網路時再自動補送到雲端。\n\n它像一般 app 一樣，用一個連結就能直接裝到 iOS 或 Android，免 app store，因為它是用 **PWA** 技術做的（React、TypeScript、IndexedDB、Supabase、Service Worker）。它為台灣往日本的旅客量身打造，Google Maps 路線會標註在地交通，並用大量快取（地點永久保留、路線保留 24 小時）讓 API 花費維持平穩，順帶成為離線覆蓋。\n\n🔗 [試用 Path](https://trip-path.vercel.app/)',
      ja: '**Path** はネットワークが切れても動き続けるように作られた旅行計画アプリで、山道や電波の弱い地方の温泉街のような場所を想定しています。\n\n旅先で必要になるもの、旅程・地図ルート・経費管理は **オフラインでも 100% 使えます**。仕組みはデータのコピーをスマホ側に持つこと（**オフラインファースト**）で、アプリはまず端末内のデータを読むので画面がすぐ表示され、加えた変更はその場で保存し、オンラインに戻ると自動でクラウドへ再送します。\n\n普通のアプリのようにリンク一つで iOS や Android に直接インストールでき、アプリストアは不要です。**PWA** 技術で作られているためです（React、TypeScript、IndexedDB、Supabase、Service Worker）。台湾から日本へ向かう旅行者向けに作り込まれ、Google Maps のルートを現地交通向けにラベル付けし、大量のキャッシュ（場所は無期限、経路は 24 時間）で API コストを平準化しつつオフライン対応も兼ねます。\n\n🔗 [Path を試す](https://trip-path.vercel.app/)',
    },
  },
  {
    id: 'project-plutus',
    questions: {
      en: ['What is Plutus Trade?', 'Tell me about Plutus Trade', 'the stock analysis tool', 'his fintech project'],
      'zh-TW': ['Plutus Trade 是什麼', '介紹一下 Plutus Trade', '那個股票分析工具', '他的 fintech 專案'],
      ja: ['Plutus Trade とは', 'Plutus Trade について教えて', '株式分析ツール'],
    },
    answers: {
      en: "**Plutus Trade** is a personal AI tool that helps one experienced trader make decisions on Taiwan stocks.\n\nAt its core, **Gemini 2.5 Flash** reads a stock's monthly revenue, fundamentals, big-institution buying and selling (institutional flow), and price patterns, then gives a clear **BUY/SELL/HOLD** call with its reasoning spelled out. To keep that focused, a daily quant model at **14:00** scores eight market-wide momentum signals and pre-sorts the candidate pool first, so the AI spends its effort on judgment.\n\nWhat you get from it:\n\n- **A guided pick list**: a three-step questionnaire (your risk tolerance, time horizon, and preferred sectors) returns a curated short-list, each pick with its own reason.\n- **A daily holdings strategy**: before writing anything, it gathers the real market backdrop (^TWII trend, US indices, the SOX, macro news) and each stock's fundamentals (institutional flow, EPS, monthly revenue, supply-chain news), then Gemini turns that into a per-stock watch list, a sell target, and add/trim reasoning, emailed to the trader every evening.\n- **An honest track record**: every call is logged with the context it was made in, then settled when its horizon is up, building an auditable win-rate and ROI matrix, so the AI's advice is never a black box.\n\nTwo engineering touches keep it reliable: a strict **JSON-Schema** prompt contract with **few-shot** anchors cut Gemini's hallucination rate by roughly **60%**, and if one data source is down it falls back through three (FinMind → Yahoo Finance → TWSE). Built with **Flutter** and **FastAPI**.\n\n🔗 [Try Plutus Trade](https://plutustrade.vercel.app/)",
      'zh-TW': '**Plutus Trade** 是一款個人 AI 工具，幫一位有經驗的交易者對台股做決策。\n\n核心是 **Gemini 2.5 Flash**：它會讀一檔股票的月營收、基本面、大法人的買賣（籌碼面）、以及價格型態（技術結構），再給出一個講清楚理由的 **買/賣/持有** 判斷。為了讓它專注，每天 14:00 有一個量化模型先算八個全市場的動能訊號、把候選池先排好序，讓 AI 把力氣花在判斷上。\n\n它能幫你做這些：\n\n- **引導式選股清單**：用三步驟問答（你的風險承受度、持有期間、偏好產業）回傳一份精選清單，每一檔都附上理由。\n- **每日持股策略**：在動筆前，它會先蒐集真實的大盤背景（^TWII 趨勢、美股指數、費半 SOX、宏觀新聞）與每檔股票的基本面（三大法人、EPS、月營收、供應鏈新聞），再交給 Gemini 產出每一檔的觀察重點、賣出目標價，以及加碼或減碼的理由，每晚以 Email 寄給交易者。\n- **誠實的績效紀錄**：每個判斷都連同「當下的進場情境」一起記錄，到期後再結算，累積成一份可稽核的勝率與報酬率矩陣，讓 AI 的建議不會是黑箱。\n\n有兩個工程上的細節讓它更可靠：用嚴格的 **JSON-Schema** prompt 契約搭配 **few-shot** 錨點，把 Gemini 的幻覺率降低約 **60%**；而且當某個資料來源掛掉時，它會依序改用三層備援（FinMind → Yahoo Finance → 證交所）。技術上以 **Flutter** 與 **FastAPI** 打造。\n\n🔗 [試用 Plutus Trade](https://plutustrade.vercel.app/)',
      ja: '**Plutus Trade** は、経験あるトレーダー一人が台湾株の判断を下すのを助ける個人向け AI ツールです。\n\n中核は **Gemini 2.5 Flash** です。ある銘柄の月次売上・ファンダメンタルズ・大口機関の売買（機関投資家フロー）・値動きのパターン（テクニカル構造）を読み、理由をはっきり示した **買/売/ホールド** の判断を返します。それを絞り込むため、毎日 14:00 にクオンツモデルが市場全体の 8 つのモメンタム特徴を採点し、候補プールをあらかじめ並べ替えるので、AI は判断に力を注げます。\n\nできることはこんなことです：\n\n- **ガイド付きの銘柄リスト**：3 ステップの質問（リスク許容度・保有期間・好みのセクター）で厳選リストを返し、各銘柄に理由が付きます。\n- **毎日の持株戦略**：書き始める前に、実際の相場コンテキスト（^TWII トレンド、米国指数、SOX、マクロニュース）と各銘柄のファンダメンタルズ（三大法人、EPS、月次売上、サプライチェーンニュース）を集め、それを Gemini が銘柄ごとの観察ポイント、売却目標価格、買い増し・売却の理由に変え、毎晩トレーダーへ Email で届けます。\n- **正直な成績記録**：すべての判断はそのときのエントリー文脈とともに記録され、満期で精算し、監査可能な勝率・ROI マトリクスに積み上がるので、AI の助言はブラックボックスになりません。\n\n信頼性を支えるエンジニアリングの工夫が二つあります：厳格な **JSON-Schema** のプロンプト契約と **few-shot** アンカーで Gemini のハルシネーションを約 **60%** 削減し、あるデータ源が落ちても 3 層のフォールバック（FinMind → Yahoo Finance → 証券取引所）で切り替えます。**Flutter** と **FastAPI** 製です。\n\n🔗 [Plutus Trade を試す](https://plutustrade.vercel.app/)',
    },
  },
  {
    id: 'project-house-ops',
    questions: {
      en: ['What is House Ops?', 'Tell me about House Ops', 'the real estate automation', 'the housing project'],
      'zh-TW': ['House Ops 是什麼', '介紹一下 House Ops', '那個房地產自動化', '找房專案'],
      ja: ['House Ops とは', 'House Ops について教えて', '不動産の自動化'],
    },
    answers: {
      en: "**House Ops** is an automated **Node.js** pipeline that gathers Taiwan housing listings and helps you decide, built because rental and sale info is scattered across too many places.\n\nEvery day at **09:00** it scans **591** and Facebook rental groups on its own (it gets past Facebook's anti-bot and lazy-load by mimicking real touch gestures through **Chrome DevTools Protocol**), then uses the **Claude API (Haiku 4.5)** to pull the key fields, price, address, size, and layout, out of messy free-form posts.\n\nIt then scores every listing across five things, price, space, location, condition, and risk, and you can re-weight them for a renter, a first-time buyer, or someone trading up, so a vague gut feel becomes a concrete **0–5** signal. A clean visual HTML digest reaches your Gmail before **09:30**, tracking price drops and flagging new listings, and a **Claude Code** interactive layer handles the harder calls like affordability simulation and upgrade-plan funding gaps.\n\nUsing an LLM as the parser costs about **USD 0.001** per post and reads messy, casual Taiwanese phrasing at human level.\n\n🔗 [GitHub](https://github.com/Kaminoikari/house-ops)",
      'zh-TW': '**House Ops** 是一條自動化的 **Node.js** 管線，幫你把台灣的房屋物件蒐集起來、輔助你做決定；做這個是因為租屋與買賣的資訊散落在太多地方。\n\n每天 09:00 它會自己去掃 **591** 與 Facebook 租屋社團（靠 **Chrome DevTools Protocol** 合成觸控手勢，繞過 FB 的反爬與 lazy-load），再用 **Claude API(Haiku 4.5)** 從雜亂的自由格式貼文裡，抽出關鍵欄位：價格、地址、坪數、格局。\n\n接著它會用一個五維加權模型替每個物件打分：價格、空間、地點、屋況、風險；而且權重可在租屋族、首購族、換屋族之間切換，把模糊的感覺變成具體的 **0–5** 訊號。一份乾淨的視覺化 HTML 摘要會在 09:30 前寄到你的 Gmail，追蹤降價、提醒新案，而一層 **Claude Code** 互動則處理較難的判斷，像是負擔能力試算與換屋資金缺口。\n\n用 LLM 當解析器每篇約 **0.001 美元**，還能以人類水準讀懂雜亂、口語的台式用語。\n\n🔗 [GitHub](https://github.com/Kaminoikari/house-ops)',
      ja: '**House Ops** は台湾の住宅物件を集めて判断を助ける自動化された **Node.js** パイプラインで、賃貸や売買の情報が多くの場所に散らばっているために作られました。\n\n毎日 09:00 に **591** と Facebook の賃貸グループを自分でスキャンし（**Chrome DevTools Protocol** の合成タッチジェスチャで FB のボット対策と遅延読み込みを回避します）、**Claude API(Haiku 4.5)** で雑多な自由記述の投稿から要点、価格・住所・広さ・間取りを抜き出します。\n\n続いて 5 次元の加重モデルが各物件を価格・広さ・立地・状態・リスクで採点し、重みは賃貸・初回購入・住み替えのペルソナで切り替えられるので、曖昧な感覚が具体的な **0–5** のシグナルになります。きれいな視覚的 HTML ダイジェストが 09:30 までに Gmail へ届き、値下げを追跡し新着を知らせ、**Claude Code** の対話層が、支払い能力試算や住み替え資金ギャップといった難しい判断を補います。\n\n投稿をパースするのに LLM を使うコストは 1 件あたり約 **0.001 米ドル**で、雑多で口語的な台湾語の言い回しも人間並みに読み取ります。\n\n🔗 [GitHub](https://github.com/Kaminoikari/house-ops)',
    },
  },
  {
    id: 'project-job-ops',
    questions: {
      en: ['What is Job Ops?', 'Tell me about Job Ops', 'the job search automation', 'candidate-side ATS'],
      'zh-TW': ['Job Ops 是什麼', '介紹一下 Job Ops', '那個求職自動化', '求職專案'],
      ja: ['Job Ops とは', 'Job Ops について教えて', '求職の自動化'],
    },
    answers: {
      en: "**Job Ops** turns the tables on hiring. Companies run software called an **ATS** to filter applicants; this is a candidate-side **Python** pipeline that points that same filtering at the job openings instead, working for you, the candidate.\n\nEvery day at **07:00**, a scheduled **launchd** job scrapes fresh **104** listings, reads your résumé (written in **Markdown**), matches each role against a profile of the job you actually want (a candidate archetype defined in a simple **YAML** file), and scores them one dimension at a time. The result is a banded **RECOMMEND / CAUTIOUS / SKIP** digest in your inbox before **07:30**, as **HTML** to read on your phone plus a **Markdown** twin synced to **Obsidian** for retrospectives.\n\nBecause the scoring weights (comp, remote, growth) live in a **YAML** file under **git**, every commit time-stamps how your priorities shifted, so the whole search becomes a replayable timeline.\n\nThe split of labor is deliberate: the deterministic work (scraping, dedupe, scoring) goes to code, while seven **Claude Code** interactive modes handle the judgment calls, company legitimacy, IC-vs-management level strategy, comp negotiation, and interview prep.\n\n🔗 [GitHub](https://github.com/Kaminoikari/job-ops)",
      'zh-TW': '**Job Ops** 把徵才的邏輯反過來用。企業會用一種叫 **ATS** 的軟體來篩掉應徵者；這是一條求職者端的 **Python** 管線，把同一套篩選反過來套在職缺上，替你這位求職者服務。\n\n每天 07:00 由 **launchd** 啟動，抓取最新的 **104** 職缺，讀你的 **Markdown** 履歷，拿它跟一份「你真正想要的工作樣貌」（用 **YAML** 定義的理想候選人輪廓）逐維度比對評分。結果是一份分級的 **推薦 / 觀望 / 略過** 摘要，**07:30** 前送到你的信箱：一份 **HTML** 方便在手機看，另一份 **Markdown** 同步到 **Obsidian** 供回顧。\n\n因為評分權重（薪資、遠端、成長）放在 **git** 控管的 **YAML** 裡，每次 commit 都標記了你的優先順序如何變化，讓整個求職過程變成可回放的時間軸。\n\n分工是刻意的：確定性的工作（爬取、去重、評分）交給程式，七個 **Claude Code** 互動模式則處理需要判斷的事，公司可信度、IC 與管理職的層級策略、薪資談判與面試準備。\n\n🔗 [GitHub](https://github.com/Kaminoikari/job-ops)',
      ja: '**Job Ops** は採用の論理を逆手に取ります。企業は応募者を選別するために **ATS** というソフトを使いますが、これは同じふるい分けを求人側へ向ける候補者側の **Python** パイプラインで、候補者であるあなたのために働きます。\n\n毎日 07:00 に **launchd** が起動して最新の **104** 求人を取得し、あなたの **Markdown** 履歴書を読み、「本当に欲しい仕事の姿」（**YAML** で定義した理想候補者像）と次元ごとに照合して採点します。結果は段階別の **推奨 / 様子見 / スキップ** ダイジェストで、**07:30** までに受信箱へ届きます。スマホで読む **HTML** と、振り返り用に **Obsidian** へ同期する **Markdown** の二本立てです。\n\n採点の重み（給与・リモート・成長）は **git** 管理下の **YAML** にあるため、コミットごとに優先順位の変化が記録され、求職活動全体が再生可能なタイムラインになります。\n\n分業は意図的です。決定論的な作業（取得・重複排除・採点）はコードが担い、7 つの **Claude Code** 対話モードが判断の要る部分、企業の信頼性、IC か管理職かの層級戦略、給与交渉、面接準備を扱います。\n\n🔗 [GitHub](https://github.com/Kaminoikari/job-ops)',
    },
  },
  {
    id: 'projects-list',
    questions: {
      en: ['What projects has he built?', 'list his projects', 'what has he made?', 'his side projects'],
      'zh-TW': ['他做過哪些專案', '列出他的專案', '他的side project有哪些', '他建過什麼'],
      ja: ['どんなプロジェクトを作った', 'プロジェクト一覧', '彼のサイドプロジェクト'],
    },
    answers: {
      en: "Charles has built five showcased AI products end to end, each a different kind of tool:\n\n- **Path**, an offline-first travel PWA that stays 100% usable with no connection.\n- **Plutus Trade**, an AI stock decision-support tool with auditable win-rate tracking.\n- **Product Playbook**, his open-source LLM multi-agent spec system.\n- **House Ops**, a Claude-powered real-estate scanning and scoring pipeline.\n- **Job Ops**, a candidate-side ATS that flips hiring filters onto the jobs.\n\nEach ships across a different stack, React, Flutter, Node.js, Python, and he built them all solo with AI tooling. Ask about any one for the full story.",
      'zh-TW': 'Charles 端到端打造了五個代表性的 AI 產品，每一個都是不同類型的工具：\n\n- **Path**，離線優先的旅遊 PWA，沒網路也 100% 可用。\n- **Plutus Trade**，帶可稽核勝率追蹤的 AI 選股決策工具。\n- **Product Playbook**，他開源的 LLM 多代理規格系統。\n- **House Ops**，Claude 驅動的房產掃描與評分管線。\n- **Job Ops**，把徵才篩選反套在職缺上的求職者端 ATS。\n\n每個分別跑在不同技術棧上，React、Flutter、Node.js、Python，全部由他用 AI 工具獨力完成。想了解哪一個都可以問我。',
      ja: 'Charles は 5 つの代表的な AI プロダクトを端から端まで作りました。どれも異なる種類のツールです：\n\n- **Path**、オフラインでも 100% 使える旅行 PWA。\n- **Plutus Trade**、監査可能な勝率追跡付きの AI 株式意思決定支援。\n- **Product Playbook**、オープンソースの LLM マルチエージェント仕様システム。\n- **House Ops**、Claude 駆動の不動産スキャン・採点パイプライン。\n- **Job Ops**、採用フィルタを求人側に反転させた候補者側 ATS。\n\nそれぞれ React・Flutter・Node.js・Python と異なるスタックで、すべて彼が AI ツールを使い単独で構築しました。詳しく知りたいものをどうぞ。',
    },
  },

  // ──────────────────────────── experience ────────────────────────────
  {
    id: 'exp-uspace',
    questions: {
      en: ['What does he do at USPACE?', 'his role at USPACE', 'tell me about USPACE', 'current job'],
      'zh-TW': ['他在 USPACE 做什麼', '他在 USPACE 的角色', 'USPACE 的工作', '目前的工作'],
      ja: ['USPACE では何をしている', 'USPACE での役割', '現在の仕事'],
    },
    answers: {
      en: "At **USPACE** (Product Manager, **July 2024–present**) Charles leads product across three core lines: parking payments, corporate travel, and insurance.\n\nHe started as the **app owner**, leading a **15-person cross-functional Scrum team** (PM, dev, design). Running the team on Scrum, he **doubled development-iteration velocity**.\n\nTwo pieces of work stand out:\n\n- In **September 2025** he launched **USPACE for Business** from **0→1**, a B2B SaaS for corporate travel management, owning the full lifecycle himself: sales discovery, spec, development and testing, launch, and payments and reconciliation.\n- He shipped **Taiwan's first subscription-based parking insurance**, an FSC regulatory-sandbox trial with **Fubon Insurance** that embeds pay-as-you-park pricing one-tap into checkout for **1M+ members**.\n\nThis is where he defined the **AI Product Builder** role: he engineers the full stack himself with **Claude Code and Codex**, iterating **5x faster** with zero added engineering headcount.",
      'zh-TW': '在 **USPACE**（產品經理，**2024 年 7 月至今**），Charles 主導停車支付、企業差旅、保險三條核心產品線。\n\n他初期擔任 **app 負責人**，帶領 **15 人跨職能 Scrum 團隊**（PM、開發、設計）。以 Scrum 運作團隊，讓 **開發迭代速度翻倍**。\n\n有兩項工作特別亮眼：\n\n- **2025 年 9 月**，他把 **USPACE for Business**（企業差旅管理的 B2B SaaS）從 **0→1** 推出，從業務探索、規格、開發測試、上線到金流與財務對帳，全生命週期獨力負責。\n- 他推出 **全台首創訂閱制停車保險**，與 **富邦產險** 合作的 FSC 監理沙盒試辦，把 pay-as-you-park 用量計價一鍵嵌入結帳，觸及 **100 萬+ 會員**。\n\n這也是他定義 **AI Product Builder** 角色的地方：他用 **Claude Code、Codex** 親手打造全端，在零額外工程人力下達到 **5 倍**迭代速度。',
      ja: '**USPACE**（プロダクトマネージャー、**2024 年 7 月〜現在**）で Charles は、駐車場決済・出張・保険の 3 つの中核プロダクトラインを主導しています。\n\n当初は **app のオーナー**として **15 名のクロスファンクショナル Scrum チーム**（PM・開発・デザイン）を率いました。チームを Scrum で運営し、**開発イテレーション速度を倍増**させました。\n\nとくに 2 つの仕事が際立ちます：\n\n- **2025 年 9 月**、法人向け出張管理 B2B SaaS **USPACE for Business** を **0→1** でローンチし、営業ディスカバリーから仕様・開発テスト・ローンチ、決済・財務照合まで全ライフサイクルを単独で担当しました。\n- **台湾初のサブスク型駐車場保険**、**富邦保険** との FSC 規制サンドボックス試行を投入し、pay-as-you-park の従量課金をワンタップで決済に組み込み、**100 万人超の会員**にリーチしています。\n\nここが **AI Product Builder** の役割を定義した場所です：**Claude Code・Codex** でフルスタックを自ら構築し、エンジニア増員ゼロで **5 倍速**の反復を実現しています。',
    },
  },
  {
    id: 'exp-history',
    questions: {
      en: ['What is his work history?', 'where has he worked?', 'past jobs', 'previous companies', 'career history', 'his resume', 'his CV', 'his PM background', 'his PM experience', 'his career', 'his professional experience', 'how many years of PM experience'],
      'zh-TW': ['他的工作經歷', '他待過哪些公司', '過去的工作', '以前的公司', '職涯經歷', 'charles 的資歷', '他的資歷', 'PM 資歷', 'charles PM 資歷', '他的 PM 經歷', '他的履歷', '他的職涯', '產品經理經歷', '他做過哪些工作'],
      ja: ['職務経歴', 'どこで働いてきた', '過去の勤務先', '経歴', 'PM の経歴', '履歴書', 'キャリア'],
    },
    answers: {
      en: "Charles's career spans electronic payments, HRM, MaaS, and creator tools. Five roles, most recent first:\n\n- **PM at USPACE** (2024–present), former app owner, now leading B2B SaaS and Taiwan's first subscription-based parking insurance.\n- **Product Mentor at XChange School** (2025–present), Taiwan's largest internet professional community.\n- **Senior PM at NUEIP** (2024), an end-to-end BI product with predictive analytics and AI.\n- **PM at PXPay Plus（全支付）** (2022–2024), electronic payments, with **+25% conversions** and a reward-points system.\n- **Operations Manager at FLUX** (2019–2022), **+20% market share** while leading a team of **10**.\n\nThe throughline across every role is shipping products that change user behavior, increasingly by building them himself with AI.",
      'zh-TW': 'Charles 的職涯橫跨電子支付產業、HRM、MaaS 與創作者工具。五段經歷，由近到遠：\n\n- **USPACE 產品經理**（2024 至今），USPACE 前 app 負責人，現主導 B2B SaaS 與全台首創訂閱制停車保險。\n- **XChange School 產品導師**（2025 至今），台灣最大的網路專業社群。\n- **NUEIP 資深產品經理**（2024），帶預測分析與 AI 的端到端 BI 產品。\n- **PXPay Plus（全支付）產品經理**（2022–2024），電子支付，做出 **+25% 轉換率** 與點數回饋系統。\n- **FLUX 營運經理**（2019–2022），帶領 **10 人**團隊，市佔 **+20%**。\n\n貫穿這些職位的主線，是交付「改變使用者行為」的產品，並愈來愈常親手用 AI 把它們做出來。',
      ja: 'Charles のキャリアは電子決済・HRM・MaaS・クリエイターツールにまたがります。5 つの職務を、新しい順に：\n\n- **USPACE プロダクトマネージャー**（2024〜現在）、元 app オーナーで、現在は B2B SaaS と台湾初のサブスク型駐車場保険を主導。\n- **XChange School プロダクトメンター**（2025〜現在）、台湾最大のインターネット専門コミュニティ。\n- **NUEIP シニア PM**（2024）、予測分析と AI を備えた端から端までの BI プロダクト。\n- **PXPay Plus（全支付）PM**（2022–2024）、電子決済で **コンバージョン +25%** とポイント還元システム。\n- **FLUX オペレーションマネージャー**（2019–2022）、**10 名**のチームを率いて市場シェア **+20%**。\n\nこれらに共通する軸は、ユーザー行動を変えるプロダクトを出荷すること、そしてそれを次第に AI で自ら作るようになっていることです。',
    },
  },
  {
    id: 'exp-years',
    questions: {
      en: ['How many years of experience?', 'how experienced is he?', 'how long has he been a PM?'],
      'zh-TW': ['他有幾年經驗', '他做產品多久了', '年資多久'],
      ja: ['経験は何年', 'PM 歴はどれくらい'],
    },
    answers: {
      en: 'Charles has **5+ years** of product experience spanning creator tools, Fintech, B2B SaaS, and MaaS, and his work has reached over **7 million people**.\n\nThe range matters as much as the tenure. He has shipped across very different domains:\n\n- Electronic payments at scale (**PXPay Plus**)\n- HRM and BI (**NUEIP**)\n- Hardware-and-software supply-chain management, operations, and go-to-market (**FLUX**)\n- MaaS at **USPACE**, where he leads three core product lines after starting as the app owner\n\nAlongside all of that he has built five AI products on the side. In the last two years he has reframed himself as an **AI Product Builder**, pairing that PM depth with hands-on engineering.',
      'zh-TW': 'Charles 有 **5 年以上**的產品經驗，橫跨創作者工具、Fintech、B2B SaaS 與 MaaS，作品觸及 **超過 700 萬人**。\n\n比年資更值得看的是廣度。他做過很不一樣的領域：\n\n- 大規模電子支付（**PXPay Plus**）\n- HRM 與 BI(**NUEIP**)\n- 軟硬體供應鏈管理、營運與 go-to-market(**FLUX**)\n- 在 **USPACE** 做 MaaS，最初擔任 app 負責人，現在主導三條核心產品線\n\n除此之外，他工作之餘還做了五個 AI 產品。過去兩年，他把自己重新定位為 **AI Product Builder**，把這份 PM 深度與親手做的工程能力結合起來。',
      ja: 'Charles はプロダクト経験 **5 年以上**で、クリエイターツール・Fintech・B2B SaaS・MaaS にまたがり、その仕事は **700 万人以上**に届いています。\n\n年数と同じくらい重要なのが幅です。彼はまったく異なる領域で出荷してきました：\n\n- 大規模な電子決済（**PXPay Plus**）\n- HRM と BI(**NUEIP**)\n- ソフトウェア・ハードウェアのサプライチェーン管理、オペレーション、go-to-market（**FLUX**）\n- **USPACE** での MaaS、当初は app オーナーで、現在は 3 つの中核プロダクトラインを主導\n\nそれに加えて、副業で 5 つの AI プロダクトも作っています。直近 2 年は自らを **AI Product Builder** と再定義し、その PM の深さと自ら手を動かすエンジニアリングを組み合わせています。',
    },
  },
  {
    id: 'exp-pxpay',
    questions: {
      en: ['What did he do at PXPay?', 'tell me about PXPay Plus', 'his fintech experience'],
      'zh-TW': ['他在 PXPay 做什麼', '介紹 PXPay Plus', '他的支付經驗'],
      ja: ['PXPay では何をした', 'PXPay Plus について'],
    },
    answers: {
      en: 'At **PXPay Plus（全支付）**, a Taiwan electronic-payment company (PM, **2022–2024**), Charles owned the consumer-facing fintech electronic-payment products.\n\nTwo pieces of work drove the numbers:\n\n- He redesigned the sign-up and checkout flow in 3 months for **+25% transaction conversions**.\n- He pioneered a reward-points system that delivered **+50% operational efficiency** while cutting **customer complaints by 40%**.\n\nHe also led third-party billing integration, so users could pay for parking, cable TV, pension, and government fees directly in the app. That grew the wallet from a payment tool into an everyday-services hub.',
      'zh-TW': '在 **PXPay Plus（全支付）**（產品經理，**2022–2024**），Charles 負責面向消費者的 fintech 電子支付產品。\n\n兩項工作帶出了數字：\n\n- 他在 3 個月內重新設計註冊與結帳流程，帶來 **+25% 交易轉換率**。\n- 他首創點數回饋系統，帶動 **營運效率 +50%**，同時讓 **客訴下降 40%**。\n\n他也主導第三方代收整合，讓使用者能在 app 內直接繳停車、有線電視、勞退與政府規費，把這個錢包從單純的支付工具擴展成日常生活服務的入口。',
      ja: '**PXPay Plus（全支付）**（PM、**2022–2024**）で Charles は消費者向け fintech 電子決済プロダクトを担当しました。\n\n2 つの仕事が数字を動かしました：\n\n- 登録・決済フローを 3 か月で再設計して **取引コンバージョン +25%**。\n- ポイント還元システムを主導して **業務効率 +50%**、同時に **苦情を 40% 削減**。\n\nさらに第三者課金統合をリードし、駐車場・ケーブル TV・年金・行政支払いをアプリ内で直接行えるようにしました。これによりウォレットを単なる決済ツールから日常サービスの入口へと広げました。',
    },
  },

  // ────────────────────────── skills / tech ──────────────────────────
  {
    id: 'skills-engineering',
    questions: {
      en: ['What can he code?', 'his programming skills', 'what languages does he use?', 'his tech stack', 'engineering skills'],
      'zh-TW': ['他會寫什麼程式', '他的程式能力', '他用哪些語言', '他的技術棧'],
      ja: ['何をコーディングできる', 'プログラミングスキル', '技術スタック'],
    },
    answers: {
      en: 'Charles can build and ship a full product on his own, front to back. His engineering toolkit:\n\n- **Frontend**: React, TypeScript, Flutter, Canvas 2D\n- **Backend**: Node.js, Python (FastAPI), PHP (Laravel)\n- **Data**: PostgreSQL, SQLite, Redis, Supabase\n- **Deploy**: Vercel, Fly.io\n\nHe works AI-natively, using **Claude Code** and **Codex** to build and ship working prototypes end to end, with no separate engineering team.\n\nThe proof is in the side projects, each on a different stack and all shipped solo: a **Flutter** plus **FastAPI** trading tool, an offline-first **React** PWA, **Node.js** and **Python** automation pipelines, and this **RAG** chatbot. On the data side he also brings **BI dashboards, predictive analytics, A/B testing, and SQL**.',
      'zh-TW': 'Charles 能自己一個人把一個完整產品從前到後做出來並上線。他的工程工具箱：\n\n- **前端**：React、TypeScript、Flutter、Canvas 2D\n- **後端**：Node.js、Python(FastAPI)、PHP(Laravel)\n- **資料**：PostgreSQL、SQLite、Redis、Supabase\n- **部署**：Vercel、Fly.io\n\n他以 AI 原生方式工作，用 **Claude Code** 與 **Codex** 端到端打造並交付能實際運作的原型，不需要另外的工程團隊。\n\n證據就在副業專案裡，每個都是不同技術棧、而且全部獨力完成：一個 **Flutter** 加 **FastAPI** 的交易工具、一個離線優先的 **React** PWA、**Node.js** 與 **Python** 的自動化管線，以及這個 **RAG** 聊天機器人。資料面他也具備 **BI 儀表板、預測分析、A/B 測試與 SQL**。',
      ja: 'Charles は完成したプロダクトを一人で前から後ろまで作り、リリースできます。彼のエンジニアリング道具箱：\n\n- **フロントエンド**：React、TypeScript、Flutter、Canvas 2D\n- **バックエンド**：Node.js、Python(FastAPI)、PHP(Laravel)\n- **データ**：PostgreSQL、SQLite、Redis、Supabase\n- **デプロイ**：Vercel、Fly.io\n\nAI ネイティブに働き、**Claude Code** と **Codex** で実際に動くプロトタイプを端から端まで構築・出荷し、別途のエンジニアチームを必要としません。\n\n証拠はサイドプロジェクトにあります。どれも異なるスタックで、すべて単独で出荷しました：**Flutter** と **FastAPI** のトレーディングツール、オフラインファーストの **React** PWA、**Node.js** と **Python** の自動化パイプライン、そしてこの **RAG** チャットボット。データ面では **BI ダッシュボード、予測分析、A/B テスト、SQL** も備えます。',
    },
  },
  {
    id: 'skills-ai',
    questions: {
      en: ['What AI tools does he use?', 'his AI skills', 'AI / LLM experience', 'what AI does he work with?'],
      'zh-TW': ['他用哪些 AI 工具', '他的 AI 技能', 'AI / LLM 經驗'],
      ja: ['どんな AI ツールを使う', 'AI スキル', 'AI / LLM の経験'],
    },
    answers: {
      en: 'Charles both directs AI tools and engineers with them. His skills split into two groups.\n\n**Tools and techniques he works with:**\n\n- Claude Code, Codex, Gemini\n- LLM Orchestration\n- Prompt Engineering\n- AI Agent Development\n- Agentic Workflows\n- Multi-Agent Systems\n\n**AI engineering he has shipped to production:**\n\n- RAG (corrective RAG)\n- Hybrid / vector search\n- LangGraph / LangChain\n- Vector databases (Qdrant)\n- Embeddings (Voyage)\n- LLM evaluation & benchmarking\n- Prompt-injection defense\n\nYou can see it all running in real projects: this very portfolio chatbot (a corrective-RAG system he built end to end), his own multi-agent system Product Playbook, and production Gemini features in Plutus Trade.',
      'zh-TW': 'Charles 既會指揮 AI 工具，也會用它們做工程。他的能力分成兩組。\n\n**日常在用的工具與技巧：**\n\n- Claude Code、Codex、Gemini\n- LLM 編排\n- Prompt Engineering\n- AI Agent 開發\n- Agentic Workflows\n- Multi-Agent Systems\n\n**已經上線到生產環境的 AI 工程：**\n\n- RAG（corrective RAG）\n- Hybrid / Vector Search\n- LangGraph / LangChain\n- 向量資料庫（Qdrant）\n- Embeddings(Voyage)\n- LLM Evaluation 與 benchmarking\n- prompt-injection 防禦\n\n這些全都能在真實專案裡看到它們運作：這個作品集 chatbot（他親手端到端打造的 corrective RAG 系統）、他自建的多代理系統 Product Playbook，以及 Plutus Trade 的生產級 Gemini 功能。',
      ja: 'Charles は AI ツールを指揮しつつ、それらで工学もします。スキルは 2 つのグループに分かれます。\n\n**日常的に扱うツールと技法：**\n\n- Claude Code、Codex、Gemini\n- LLM オーケストレーション\n- プロンプトエンジニアリング\n- AI エージェント開発\n- エージェンティックワークフロー\n- マルチエージェントシステム\n\n**本番投入した AI エンジニアリング：**\n\n- RAG（corrective RAG）\n- ハイブリッド/ベクトル検索\n- LangGraph / LangChain\n- ベクトル DB(Qdrant)\n- 埋め込み（Voyage）\n- LLM 評価・ベンチマーク\n- プロンプトインジェクション防御\n\nこれらはすべて実プロジェクトで動いています：このポートフォリオの chatbot（彼が端から端まで作った corrective RAG システム）、自作のマルチエージェント Product Playbook、Plutus Trade の本番 Gemini 機能です。',
    },
  },
  {
    id: 'agentic-design-patterns',
    questions: {
      en: ['Does he know agentic design patterns?', 'what agent design patterns does he use?', 'is he familiar with agentic patterns?', 'agentic design patterns', 'which AI agent patterns does Charles apply?'],
      'zh-TW': ['他懂 agentic design patterns 嗎', '他用哪些 agent 設計模式', 'agent 設計模式', '代理設計模式', 'Charles 熟悉哪些 agentic pattern'],
      ja: ['エージェント設計パターンを知っている', 'どのエージェントパターンを使う', 'エージェント設計パターン', 'Charles はどの agentic パターンを使う'],
    },
    answers: {
      en: "Agentic design patterns are core to how Charles works as an AI Product Builder, and several appear directly in systems he has built and put into production.\n\n**In this corrective-RAG chatbot:**\n\n- **Routing** (its triage)\n- **Knowledge Retrieval (RAG)**\n- **Reflection** (the self-correcting loop)\n- **Guardrails/Safety**\n- **Resource-Aware Optimization** (the cost cascade)\n- **Exception Handling**\n- **Evaluation and Monitoring**\n\n**In his Product Playbook multi-agent system:**\n\n- **Multi-Agent Collaboration**\n- **Planning**\n- **Prompt Chaining**\n- **Prioritization**\n- **Inter-Agent Communication**\n\n**Across his Claude Code and Codex workflows:**\n\n- **Tool Use**\n- **MCP**\n- **Human-in-the-Loop**\n- **Memory Management**\n- **Reasoning Techniques**\n\nAsk about any specific one and I can tell you what it is and how he applies it.",
      'zh-TW': 'Agentic design patterns 是 Charles 身為 AI Product Builder 工作方式的核心，其中好幾個直接出現在他親手開發並上線的系統裡。\n\n**在這個 corrective-RAG chatbot 裡：**\n\n- **Routing**（它的 triage）\n- **Knowledge Retrieval（RAG）**\n- **Reflection**（self-correcting loop）\n- **Guardrails/Safety**\n- **Resource-Aware Optimization**（成本 cascade）\n- **Exception Handling**\n- **Evaluation and Monitoring**\n\n**在他的 Product Playbook 多代理系統裡：**\n\n- **Multi-Agent Collaboration**\n- **Planning**\n- **Prompt Chaining**\n- **Prioritization**\n- **Inter-Agent Communication**\n\n**在他的 Claude Code 與 Codex workflow 裡：**\n\n- **Tool Use**\n- **MCP**\n- **Human-in-the-Loop**\n- **Memory Management**\n- **Reasoning Techniques**\n\n想問哪一個都可以，我能告訴你它是什麼，以及他怎麼運用。',
      ja: 'Agentic design patterns は Charles が AI Product Builder として働く上での中核であり、いくつかは彼が開発して本番投入したシステムに直接現れています。\n\n**この corrective-RAG チャットボットの中：**\n\n- **Routing**（その triage）\n- **Knowledge Retrieval（RAG）**\n- **Reflection**（self-correcting loop）\n- **Guardrails/Safety**\n- **Resource-Aware Optimization**（コスト cascade）\n- **Exception Handling**\n- **Evaluation and Monitoring**\n\n**彼の Product Playbook マルチエージェントシステムの中：**\n\n- **Multi-Agent Collaboration**\n- **Planning**\n- **Prompt Chaining**\n- **Prioritization**\n- **Inter-Agent Communication**\n\n**彼の Claude Code と Codex の workflow の中：**\n\n- **Tool Use**\n- **MCP**\n- **Human-in-the-Loop**\n- **Memory Management**\n- **Reasoning Techniques**\n\nどれでも具体的に聞いてくれれば、それが何かと、彼がどう適用するかをお伝えします。',
    },
  },
  {
    id: 'bot-design-patterns',
    questions: {
      en: ['Which design patterns does this chatbot use?', 'what agentic patterns power this bot?', 'what design patterns are in this chatbot?', 'which patterns does the assistant use?', 'agentic patterns in this chatbot'],
      'zh-TW': ['這個 chatbot 用到哪些 design pattern', '在這個 chatbot 專案他用到哪些 pattern', '這個聊天機器人用了哪些 agentic pattern', '這個 bot 用到哪些設計模式', '這個助手運用哪些 pattern'],
      ja: ['このチャットボットはどの design pattern を使っている', 'この bot にはどんな agentic パターンがある', 'このアシスタントが使うパターンは', 'このチャットボットの設計パターン'],
    },
    answers: {
      en: "This chatbot is a corrective-RAG system, and several agentic design patterns are built into it:\n\n- **Routing**: a deterministic triage layer classifies each message and sends greetings, contact, and injection attempts down the right path before any model call.\n- **Knowledge Retrieval (RAG)**: hybrid retrieval over Qdrant grounds every answer in Charles's real corpus.\n- **Reflection**: a self-correcting loop grades its own retrieved context and rewrites the query when it falls short.\n- **Resource-Aware Optimization**: a cost cascade answers common questions from a semantic cache with no model call, and runs a free model tier before paying for a stronger one.\n- **Exception Handling**: a slow grader degrades to passing context straight through, and the free tier falls back to a stronger model on any failure.\n- **Guardrails/Safety**: a prompt-injection deflector, a strict scope-lock, and an output backstop keep it safe and on-scope.\n- **Evaluation and Monitoring**: an eval harness with a golden set and an LLM judge, plus chat-log insights, track quality.\n\nAsk about any one of these and I can go deeper.",
      'zh-TW': '這個 chatbot 是一套 corrective-RAG 系統，裡面內建了好幾個 agentic design pattern：\n\n- **Routing**：一層 deterministic 的 triage 會分類每則訊息，在任何 model 呼叫之前，就把問候、聯絡與注入嘗試導向正確路徑。\n- **Knowledge Retrieval（RAG）**：在 Qdrant 上做 hybrid retrieval，讓每個答案都立基在 Charles 真實的語料上。\n- **Reflection**：一個 self-correcting loop 會為自己取回的 context 評分，不足時就改寫 query。\n- **Resource-Aware Optimization**：一條控制成本的 cascade，用語意 cache 不呼叫 model 就回答常見問題，並先跑免費的 model tier，必要時才為更強的付費。\n- **Exception Handling**：太慢的 grader 會降級成直接放行 context，免費 tier 一旦失敗就 fallback 到更強的 model。\n- **Guardrails/Safety**：一個 prompt-injection deflector、一道嚴格的 scope-lock，以及一個 output backstop，讓它維持安全且不離題。\n- **Evaluation and Monitoring**：一套帶 golden set 與 LLM judge 的 eval harness，加上 chat-log insights，持續追蹤品質。\n\n想深入了解其中任何一個都可以問我。',
      ja: 'このチャットボットは corrective-RAG システムで、いくつかの agentic design pattern が組み込まれています：\n\n- **Routing**：決定論的な triage 層が各メッセージを分類し、あらゆる model 呼び出しの前に挨拶・連絡・injection の試みを適切な経路へ振り分けます。\n- **Knowledge Retrieval（RAG）**：Qdrant 上の hybrid retrieval が、すべての回答を Charles の実際のコーパスに根ざさせます。\n- **Reflection**：self-correcting loop が取得した context を自ら採点し、不十分なときに query を書き換えます。\n- **Resource-Aware Optimization**：コストを抑える cascade が、よくある質問を意味 cache で model 呼び出しなしに回答し、まず無料の model tier を走らせ、必要なときだけ強力なものに課金します。\n- **Exception Handling**：遅い grader は context をそのまま通す挙動に縮退し、無料 tier は失敗時に強力な model へ fallback します。\n- **Guardrails/Safety**：prompt-injection deflector、厳格な scope-lock、output backstop が安全と範囲を守ります。\n- **Evaluation and Monitoring**：golden set と LLM judge を備えた eval harness、そして chat-log insights が品質を追跡します。\n\nどれでも気になるものを聞いてくれれば、さらに掘り下げます。',
    },
  },
  {
    id: 'skills-product',
    questions: {
      en: ['What product frameworks does he know?', 'his product skills', 'PM frameworks', 'product strategy skills'],
      'zh-TW': ['他會哪些產品框架', '他的產品技能', 'PM 框架', '產品策略能力'],
      ja: ['どんなプロダクトフレームワークを知っている', 'プロダクトスキル'],
    },
    answers: {
      en: 'Charles works the full arc from figuring out what to build to shipping it, leaning on a well-known set of product frameworks at each stage:\n\n- **To understand users**: JTBD, Persona, User Journey and Empathy Map, Opportunity Solution Tree, and User Story Mapping.\n- **To focus and measure**: North Star Metric, OKRs, RICE prioritization, and AARRR (pirate metrics).\n- **To position against rivals**: competitive analysis.\n\nHe pairs these with the people side of the job: leading cross-functional teams, managing stakeholders, and running Agile/Scrum. These are the same frameworks he encoded into Product Playbook so that an AI agent could reason with them too.\n\nThe point of all of them is simple: get to the real user problem fast, and make the bet on what to build a deliberate, well-reasoned one.',
      'zh-TW': 'Charles 走完整的流程，從「想清楚要做什麼」一路到「把它交付出去」，每個階段都用上一套廣為人知的產品框架：\n\n- **理解使用者**：JTBD、Persona、User Journey 與 Empathy Map、機會解決方案樹（OST）、User Story Mapping。\n- **聚焦與衡量**：North Star Metric、OKR、RICE 優先級、AARRR（海盜指標）。\n- **對手定位**：競品分析。\n\n他還把這些和「人」的一面結合起來：帶領跨職能團隊、管理利害關係人、以 Agile/Scrum 運作。這些正是他寫進 Product Playbook、讓 AI 代理也能用來推理的同一套框架。\n\n這些框架的重點很單純：快速抵達真正的使用者問題，並讓「該做什麼」的下注變成一個有意識、有依據的決定。',
      ja: 'Charles は「何を作るかを見極める」ところから「それを届ける」ところまで一連の流れを担い、各段階で広く知られたプロダクトフレームワークを使います：\n\n- **ユーザーを理解する**：JTBD、ペルソナ、ユーザージャーニーと共感マップ、機会解決ツリー（OST）、ユーザーストーリーマッピング。\n- **焦点を絞り計測する**：North Star 指標、OKR、RICE 優先順位付け、AARRR（海賊指標）。\n- **競合に対して位置づける**：競合分析。\n\nこれらを仕事の「人」の側面、機能横断チームのリーダーシップ、ステークホルダー管理、Agile/Scrum の運営と組み合わせます。これらは Product Playbook に組み込み、AI エージェントも推論に使えるようにした同じフレームワーク群です。\n\nすべてに共通する狙いはシンプルです：本当のユーザー課題に素早くたどり着き、何を作るかという賭けを、意図的で根拠のあるものにすることです。',
    },
  },

  // ──────────────────────── philosophy / approach ────────────────────────
  {
    id: 'philosophy',
    questions: {
      en: ['What is his product philosophy?', 'his approach to product', 'what does he believe about product?', 'his product style'],
      'zh-TW': ['他的產品理念是什麼', '他的產品哲學', '他怎麼看產品', '他的產品風格'],
      ja: ['プロダクトの哲学は', 'プロダクトへの考え方', 'プロダクトのスタイル'],
    },
    answers: {
      en: 'Charles works by four principles:\n\n- **Outcomes over outputs**: success is the user behavior that changed, and he measures that ahead of the feature that shipped.\n- **Sharp product sense**: the best calls often have to be made before the data exists, so taste and judgment matter.\n- **Strong opinions, loosely held**: he commits to a direction, and updates fast when the evidence pushes back.\n- **Build to learn**: a working prototype teaches you more than a slide deck, so he ships one early to get real signal.\n\nTaken together, these push him to validate by building, to get real signal before any big commitment, and to measure himself by what users do differently after he ships.',
      'zh-TW': 'Charles 有四個工作原則：\n\n- **結果重於產出**：成功是「改變了的使用者行為」，他把這一點放在「交付了的功能」之前來衡量。\n- **敏銳的產品直覺**：最好的決策常常得在數據出現之前就做，所以品味與判斷很重要。\n- **有主見但不固執**：他會對方向下決心，證據反駁時也更新得很快。\n- **動手做來學習**：可運作的原型教你的比一份簡報多，所以他會早早做出一個來取得真實訊號。\n\n合起來，這些讓他用「動手做」來驗證、在大舉投入前先拿到真實訊號，並用「上線後使用者行為的改變」來衡量自己。',
      ja: 'Charles には 4 つの働き方の原則があります：\n\n- **アウトプットよりアウトカム**：成功は「変わったユーザー行動」であり、出荷した機能よりも先にそこを見ます。\n- **鋭いプロダクトセンス**：最良の判断はデータが揃う前に下す必要が多く、ゆえに感性と判断が効きます。\n- **強い意見を緩く持つ**：方向を決め込みつつ、証拠が反論すれば素早く更新します。\n- **学ぶために作る**：動くプロトタイプはスライドより多くを教えるので、早めに一つ出して実際のシグナルを得ます。\n\nこれらが合わさり、彼は「作って検証する」ことで大きな投入の前に実シグナルを得て、出荷後にユーザー行動がどう変わったかで自分を測ります。',
    },
  },
  {
    id: 'product-builder',
    questions: {
      en: ['What is a Product Builder?', 'why does he call himself a builder?', 'what does Builder mode mean?'],
      'zh-TW': ['什麼是 Product Builder', '他為什麼自稱 builder', 'Builder 模式是什麼意思'],
      ja: ['Product Builder とは', 'なぜ自分を builder と呼ぶ', 'ビルダーモードとは'],
    },
    answers: {
      en: "Charles believes the strongest future product people are **Product Builders**: PMs who go past synthesizing requirements and writing PRDs to personally building and shipping prototypes with AI.\n\nThe difference plays out in two ways. A traditional PM hands a spec to engineering and then waits. An AI Product Builder closes that gap themselves, setting the product strategy and engineering the working product in the same motion.\n\nFor Charles this 'AI Builder mode' means iterating **5x faster**, so a product earns real market validation before any large resource commitment. It is the thesis behind how he works at USPACE and across his five solo-shipped projects, and the reason he turned down a multinational big-tech offer to lean into it.",
      'zh-TW': 'Charles 認為未來最強的產品人是 **Product Builder**：在整理需求、寫 PRD 之外，還親自用 AI 打造並交付原型的 PM。\n\n差別體現在兩件事上。傳統 PM 把規格交給工程，然後等待。AI Product Builder 自己弭平那個落差，在同一個動作裡既定產品策略、也把可運作的產品做出來。\n\n對 Charles 來說，這種「AI Builder 模式」代表開發迭代快 **5 倍**，讓產品在投入大量資源前就取得真實的市場驗證。這是他在 USPACE 以及五個獨力交付專案背後的核心主張，也是他為此推掉外商大廠 offer 的原因。',
      ja: 'Charles は、これからの最強のプロダクト人材は **Product Builder** だと考えています：要件整理や PRD 作成にとどまらず、AI で自らプロトタイプを作って出荷する PM です。\n\n違いは 2 つの動きに表れます。従来の PM は仕様をエンジニアに渡して、そして待ちます。AI Product Builder はその隔たりを自分で埋め、プロダクト戦略を立てるのと同じ動きで動くプロダクトを作ります。\n\nCharles にとってこの「AI ビルダーモード」は **5 倍速**の反復を意味し、大きなリソース投入の前にプロダクトが実際の市場検証を得られます。これは USPACE での働き方と 5 つの単独出荷プロジェクトの背後にある主張であり、そのために外資系大手のオファーを断った理由でもあります。',
    },
  },
  {
    id: 'what-makes-him-different',
    questions: {
      en: ['What makes him different as an AI PM?', 'what makes him unique', 'what sets him apart', "what's his edge as a PM", 'why should we hire him', 'why hire him', "what's his unique value", 'how is he different from other PMs', 'what is his competitive advantage'],
      'zh-TW': ['他作為 AI PM 的獨特之處是什麼', '他和其他 PM 有什麼不同', '他的差異化在哪', '他的獨特價值是什麼', '他的優勢是什麼', '為什麼該錄取他', '他憑什麼勝出', '他最大的賣點是什麼'],
      ja: ['AI PM としての彼の強みは', '他の PM とどう違う', '彼の差別化ポイントは', '彼独自の価値は', '彼の強みは何', 'なぜ彼を採用すべき', '彼の競争優位は'],
    },
    answers: {
      en: "His edge is the **AI Product Builder** model. A traditional PM writes the spec, hands it to engineering, and waits. Charles sets the product strategy and then builds the working prototype himself with AI (**Claude Code**, **Codex**), closing the loop from idea to shippable product about **5x faster**.\n\nThat speed changes the decisions. He validates with a real prototype and live user signal before committing serious resources, so the calls rest on evidence. He still brings the full PM toolkit (**JTBD**, **RICE**, opportunity framing, a **North Star** metric, outcomes over outputs), and can ship the product himself.\n\nThe proof is concrete:\n\n- At **USPACE** he doubled product-iteration velocity and now leads three product lines.\n- On the side he has shipped **five AI products end to end**, including the multi-agent **Product Playbook** and this corrective-RAG chatbot.\n\nStrong opinions, loosely held, and re-prioritized fast when the evidence changes.",
      'zh-TW': '他的獨特之處在於 **AI Product Builder** 這個模式。傳統 PM 把規格交給工程，然後等待。Charles 先訂出產品策略，再親手用 AI（**Claude Code**、**Codex**）把可運作的原型做出來，讓從點子到可上線產品的循環快上約 **5 倍**。\n\n這也改變了他做決策的方式。他會先用真正能跑的原型加上真實使用者訊號來驗證，再投入大量資源，因此每個決定都有實證支撐。他依然具備完整的產品方法論（**JTBD**、**RICE**、機會框架、**North Star** 指標、outcome 重於 output），同時又能自己把產品做出來並交付。\n\n佐證很具體：\n\n- 在 **USPACE** 他讓產品迭代速度翻倍、主導三條產品線。\n- 工作之餘還端到端交付了 **五個 AI 產品**，包括多代理的 **Product Playbook** 與這個 corrective RAG 聊天機器人。\n\nstrong opinions、loosely held，一有新訊號推翻計畫就快速重新排序。',
      ja: '彼の強みは **AI Product Builder** というモデルです。従来の PM は仕様を書いてエンジニアに渡し、そして待ちます。Charles はまず製品戦略を立て、その上で AI（**Claude Code**、**Codex**）を使って動くプロトタイプ自体を自分で作り、アイデアから出荷可能なプロダクトまでのループを約 **5 倍速**で回します。\n\nこのスピードが意思決定を変えます。本格的にリソースを投じる前に、実際のプロトタイプと生のユーザー反応で検証するので、判断は証拠に基づきます。JTBD・RICE・機会フレーミング・North Star 指標・アウトプットよりアウトカムという PM の道具立てを一通り備えつつ、自分でプロダクトを出荷できます。\n\n証拠は具体的です：\n\n- **USPACE** ではプロダクトのイテレーション速度を倍増させ、現在は 3 つのプロダクトラインを率いています。\n- 副業では **5 つの AI プロダクト**を端から端まで出荷しました（マルチエージェントの **Product Playbook** やこの corrective RAG チャットボットを含む）。\n\nstrong opinions, loosely held、証拠が変われば素早く優先順位を組み替えます。',
    },
  },
  {
    id: 'how-uses-ai',
    questions: {
      en: ['How does he use AI?', 'how does AI fit his workflow?', 'his use of AI in product work'],
      'zh-TW': ['他如何運用 AI', 'AI 在他的工作流程中扮演什麼角色', '他怎麼把 AI 用在產品上'],
      ja: ['どのように AI を使う', 'ワークフローでの AI 活用'],
    },
    answers: {
      en: "AI is the core engine of Charles's workflow, across the whole product cycle:\n\n- **Discovery**: LLMs digest market and interview research into patterns he can act on.\n- **Spec writing**: his Product Playbook multi-agent system turns fuzzy ideas into PRDs with acceptance criteria.\n- **Prototyping**: Claude Code and Codex let him build the full stack himself, for **5x faster** iteration.\n- **AI features**: he ships production LLM capabilities into products, like the Gemini-powered analysis in Plutus Trade and the corrective-RAG behind this chatbot.\n- **Agentic workflows**: autonomous agents handle repetitive work end to end, like the daily scraping, scoring, and digests in House Ops and Job Ops.\n\nThe pattern is consistent: deterministic work goes to code, ambiguous judgment goes to AI conversation, and he stays the one steering.",
      'zh-TW': 'AI 是 Charles 工作流程的核心引擎，貫穿整個產品週期：\n\n- **探索**：用 LLM 把市場與訪談研究消化成可行動的模式。\n- **規格撰寫**：他的 Product Playbook 多代理系統把模糊想法轉成帶驗收標準的 PRD。\n- **原型開發**：Claude Code 與 Codex 讓他親手做全端，迭代快 **5 倍**。\n- **AI 功能**：他把生產級 LLM 能力做進產品，像 Plutus Trade 裡 Gemini 驅動的分析，以及這個聊天機器人背後的 corrective RAG。\n- **Agentic workflows**：自主代理端到端處理重複工作，例如 House Ops 與 Job Ops 每天的爬取、評分與摘要。\n\n模式很一致：確定性的工作交給程式，模糊的判斷交給 AI 對話，掌舵的始終是他。',
      ja: 'AI は Charles のワークフローの中核エンジンで、プロダクトの全サイクルにわたります：\n\n- **ディスカバリー**：LLM で市場・インタビュー調査を行動可能なパターンへ消化します。\n- **仕様作成**：自作 Product Playbook のマルチエージェントが曖昧なアイデアを受け入れ基準付きの PRD に変換します。\n- **プロトタイピング**：Claude Code と Codex でフルスタックを自ら作り、**5 倍速**で反復します。\n- **AI 機能**：本番 LLM 機能をプロダクトに搭載します。Plutus Trade の Gemini 駆動分析やこのチャットボットの corrective RAG など。\n- **エージェンティックワークフロー**：自律エージェントが反復作業を端から端まで処理します。House Ops と Job Ops の毎日の取得・採点・ダイジェストなど。\n\nパターンは一貫しています：決定論的な作業はコードへ、曖昧な判断は AI 対話へ、舵を取るのは常に彼自身です。',
    },
  },

  // ───────────────────── leadership / blog / metrics / past roles ─────────────────────
  {
    id: 'leadership',
    questions: {
      en: ['Has he led a team?', 'his leadership experience', 'has he managed people?', 'team management'],
      'zh-TW': ['他帶過團隊嗎', '他的領導經驗', '他管過人嗎', '帶人經驗'],
      ja: ['チームを率いた経験は', 'リーダーシップ経験', '人をマネジメントした'],
    },
    answers: {
      en: "Yes. Here is where he has led.\n\n- **USPACE**: as the app owner he led a **15-person cross-functional Scrum team** (PM, dev, design). Running on Scrum doubled development-iteration velocity and kept three product lines moving in parallel.\n- **FLUX**: earlier, he directed a team of **10**, delivering **+22% process efficiency** and **+35% order-fulfillment speed**.\n- **XChange School**: he also mentors aspiring PMs at Taiwan's largest internet professional community.\n\nHis leadership style is hands-on and outcomes-first: he aligns the team on the user behavior they are trying to move, then clears the path to ship.",
      'zh-TW': '有的。以下是他帶過團隊的地方。\n\n- **USPACE**：他以 app 負責人身分帶領 **15 人跨職能 Scrum 團隊**（PM、開發、設計）。以 Scrum 運作讓開發迭代速度翻倍，並讓三條產品線同時推進。\n- **FLUX**：更早之前，他帶領 **10 人**團隊，做出 **流程效率 +22%** 與 **訂單交付速度 +35%**。\n- **XChange School**：他也在台灣最大的網路專業社群擔任產品導師，指導有志的 PM。\n\n他的領導風格親力親為、結果優先：先讓團隊對齊「要改變哪個使用者行為」，再把交付路上的障礙清掉。',
      ja: 'はい。これまでチームを率いてきた場所です。\n\n- **USPACE**：app オーナーとして **15 名のクロスファンクショナル Scrum チーム**（PM・開発・デザイン）を率いました。Scrum 運営で開発イテレーション速度を倍増させ、3 つのプロダクトラインを並行して前進させました。\n- **FLUX**：さらに以前、**10 名**のチームを統括し、**プロセス効率 +22%** と **注文処理速度 +35%** を実現しました。\n- **XChange School**：台湾最大のインターネット専門コミュニティで、PM 志望者のメンターも務めています。\n\nリーダーシップのスタイルは現場主義で成果優先です：まず「どのユーザー行動を動かすか」でチームを揃え、出荷までの障害を取り除きます。',
    },
  },
  {
    id: 'mentor',
    questions: {
      en: ['Does he mentor?', 'what is XChange School?', 'his teaching experience', 'is he a mentor?'],
      'zh-TW': ['他有當導師嗎', 'XChange School 是什麼', '他的教學經驗', '他有帶學員嗎'],
      ja: ['メンターをしている', 'XChange School とは', '指導経験は'],
    },
    answers: {
      en: "Yes. Since 2025 he has been a **Product Mentor at XChange School**, Taiwan's largest internet professional community, where he mentors aspiring product managers. His mentees come from renowned Taiwanese universities, including **National Taiwan University (NTU)**, **National Chengchi University (NCCU)**, **National Taipei University**, and **Fu Jen Catholic University**.\n\nHe coaches them on the things that are hard to learn alone:\n\n- Framing the real problem before jumping to features.\n- Prioritizing with frameworks like **RICE**.\n- The Product Builder muscle of validating ideas by building them.\n\nIt is how he gives back to the PM community, and teaching it also pressure-tests his own thinking.",
      'zh-TW': '有的。自 2025 年起，他在 **XChange School**（台灣最大的網路專業社群）擔任 **產品導師**，輔導有志成為產品經理的學員。他的學員多來自台灣知名院校，包括 **台大**、**政大**、**台北大學** 與 **輔仁大學**。\n\n他幫他們練那些一個人很難學會的事：\n\n- 在跳到功能之前，先把真正的問題框清楚。\n- 用 **RICE** 這類框架排優先級。\n- 愈來愈重要的 Product Builder 肌肉，也就是用「動手做」來驗證想法。\n\n這是他回饋 PM 社群的方式，而透過教學，也反覆檢驗了他自己的思考。',
      ja: 'はい。2025 年から **XChange School**（台湾最大のインターネット専門コミュニティ）で **プロダクトメンター** を務め、PM 志望者を指導しています。メンティーは台湾の名だたる大学の出身者が中心で、**台湾大学**、**政治大学**、**台北大学**、**輔仁大学** などです。\n\n一人では学びにくいことをコーチします：\n\n- 機能に飛びつく前に、本当の問題を捉えること。\n- **RICE** のようなフレームワークで優先順位をつけること。\n- 次第に重要になる Product Builder の筋力、つまり「作って検証する」力。\n\nこれは PM コミュニティへの恩返しであり、教えることで自身の思考も検証しています。',
    },
  },
  {
    id: 'blog-writing',
    questions: {
      en: ['Does he write?', 'his blog', 'does he publish articles?', 'his writing', 'thought leadership', 'his Substack'],
      'zh-TW': ['他有寫作嗎', '他的部落格', '他有發表文章嗎', '他的寫作', '他的 Substack'],
      ja: ['執筆活動はある', 'ブログ', '記事を書いている', 'Substack'],
    },
    answers: {
      en: "Yes. Charles writes prolifically on product and AI across **Substack and Medium**, **20+ pieces** in total.\n\nThe range is wide:\n\n- AI-builder skills and product sense.\n- PM career strategy in the AI era, and OKRs.\n- Deep technical research, including a study of the **Claude Code source code** and a breakdown of the **Shazam** audio-fingerprinting algorithm.\n\nThe writing doubles as his thinking-in-public: it is where he works out the Product Builder thesis and the engineering ideas that later show up in his projects. You can find it linked from the portfolio's blog section.",
      'zh-TW': '有的。Charles 在產品與 AI 領域寫作量豐富，橫跨 **Substack 與 Medium**，總共 **20 多篇**。\n\n題材很廣：\n\n- AI builder 能力與 product sense。\n- AI 時代的 PM 職涯策略，以及 OKR。\n- 深度技術研究，包括 **Claude Code 原始碼** 研究，與 **Shazam** 音訊指紋演算法的解析。\n\n這些寫作也是他「公開思考」的場域：他在這裡把 Product Builder 的主張、以及後來出現在專案裡的工程點子想清楚。作品集的部落格區塊有連結。',
      ja: 'はい。Charles はプロダクトと AI について **Substack と Medium** で多数執筆しており、合計 **20 本以上** です。\n\n題材は幅広いです：\n\n- AI ビルダーのスキルとプロダクトセンス。\n- AI 時代の PM キャリア戦略、そして OKR。\n- 深い技術調査、たとえば **Claude Code のソースコード** 研究や、**Shazam** の音声フィンガープリント解説。\n\n執筆は「公開で考える」場でもあります：Product Builder の主張や、後にプロジェクトへ現れるエンジニアリングのアイデアをここで練り上げます。ポートフォリオのブログ欄からリンクされています。',
    },
  },
  {
    id: 'metrics-summary',
    questions: {
      en: ['What results has he achieved?', 'his key metrics', 'quantified impact', 'his achievements', 'numbers and results'],
      'zh-TW': ['他做出哪些成果', '他的關鍵數據', '量化成效', '他的成就', '具體數字'],
      ja: ['どんな成果を出した', '主要な実績', '定量的なインパクト', '数字'],
    },
    answers: {
      en: "Here are his selected, quantified results, grouped by company. Across his career his work has **reached 7M+ users**.\n\n- **USPACE**: leading a **15-person team**, he **doubled release velocity**, launched **USPACE for Business** from **0→1**, and shipped **Taiwan's first parking insurance** (an FSC sandbox trial with Fubon, **1M+ members**), all with **5x faster** AI-driven iteration.\n- **PXPay Plus（全支付）**: **+25% checkout conversions**, **+50% operational efficiency**, and **−40% customer complaints**.\n- **NUEIP**: **+40% data-driven decisions**, **+35% forecast accuracy**, and **50% faster reporting**.\n- **FLUX**: **+20% market share**, **+30% user retention**, **+22% process efficiency**, and **+35% fulfillment speed**.\n- **Product Playbook**: **+69%** product-thinking quality, and a jump to **100%** quality-completion (from **59.1%**) once the sub-agent layer is enabled, at flat token cost.",
      'zh-TW': '以下是他職涯中精選、可量化的成果，依公司分組。他的作品 **觸及超過 700 萬使用者**。\n\n- **USPACE**：帶領 **15 人團隊**，讓 **釋出速度翻倍**，把 **USPACE for Business** 從 **0→1** 推出，並推出 **全台首張停車保險**（與富邦合作的 FSC 沙盒試辦、**1M+ 會員**），全程以 AI 驅動達 **5 倍** 迭代速度。\n- **PXPay Plus（全支付）**：**結帳轉換 +25%**、**營運效率 +50%**、**客訴 −40%**。\n- **NUEIP**：**數據驅動決策 +40%**、**預測準確度 +35%**、**報表速度快 50%**。\n- **FLUX**：**市佔 +20%**、**使用者留存 +30%**、**流程效率 +22%**、**履行速度 +35%**。\n- **Product Playbook**：產品思維品質 **+69%**，啟用子代理層後品質完成率從 **59.1%** 躍升至 **100%**，且 token 成本不變。',
      ja: "以下はキャリアを通じた主な定量成果を、会社ごとにまとめたものです。彼の仕事は **700 万人以上にリーチ** しています。\n\n- **USPACE**：**15 名チーム** を率いて **リリース速度を倍増**、**USPACE for Business** を **0→1** で、**台湾初の駐車場保険**（富邦との FSC サンドボックス試行、**100 万人超の会員**）を投入し、すべて AI 駆動で **5 倍速** の反復。\n- **PXPay Plus（全支付）**：**決済コンバージョン +25%**、**業務効率 +50%**、**苦情 −40%**。\n- **NUEIP**：**データ駆動の意思決定 +40%**、**予測精度 +35%**、**レポート 50% 高速化**。\n- **FLUX**：**市場シェア +20%**、**リテンション +30%**、**プロセス効率 +22%**、**処理速度 +35%**。\n- **Product Playbook**：製品思考の品質 **+69%**、サブエージェント層を有効化すると品質完了率が **59.1%** から **100%** へ、トークンコストは据え置き。",
    },
  },
  {
    id: 'exp-nueip',
    questions: {
      en: ['What did he do at NUEIP?', 'tell me about NUEIP', 'his BI / analytics experience', 'his data work'],
      'zh-TW': ['他在 NUEIP 做什麼', '介紹 NUEIP', '他的 BI / 分析經驗', '他的數據工作'],
      ja: ['NUEIP では何をした', 'NUEIP について', 'BI / 分析の経験'],
    },
    answers: {
      en: 'At **NUEIP** (Senior PM, **2024**) Charles built an end-to-end **BI product** that wove advanced analytics and AI into everyday decision-making.\n\nThe results came in three parts:\n\n- He drove **+40% data-driven decisions** by making the right data reachable.\n- He lifted **forecast accuracy by 35%** with predictive-analytics models that supported strategic planning.\n- He cut reporting time in half (**50% faster reporting**) by integrating the BI dashboards into one place.\n\nThe work sat at the intersection of data, AI, and product, turning raw company data into decisions people actually acted on.',
      'zh-TW': '在 **NUEIP**（資深產品經理，**2024**），Charles 打造了一個端到端的 **BI 產品**，把進階分析與 AI 織進日常決策。\n\n成果分成三塊：\n\n- 他讓對的資料變得可取得，帶來 **數據驅動決策 +40%**。\n- 他用支援策略規劃的預測分析模型，把 **預測準確度提升 35%**。\n- 他整合 BI 儀表板，把報表時間砍半（**報表速度快 50%**）。\n\n這份工作落在資料、AI 與產品的交會點，把公司的原始資料轉成人們真的會採取行動的決策。',
      ja: '**NUEIP**（シニア PM、**2024**）で Charles は、高度な分析と AI を日々の意思決定に織り込んだ端から端までの **BI プロダクト** を構築しました。\n\n成果は 3 つに分かれます：\n\n- 正しいデータに届くようにして **データ駆動の意思決定 +40%**。\n- 戦略立案を支える予測分析モデルで **予測精度を 35% 向上**。\n- BI ダッシュボードを統合してレポート時間を半減（**レポート 50% 高速化**）。\n\nこの仕事はデータ・AI・プロダクトの交差点にあり、会社の生データを人々が実際に行動に移す意思決定へと変えました。',
    },
  },
  {
    id: 'exp-flux',
    questions: {
      en: ['What did he do at FLUX?', 'tell me about FLUX', 'his operations experience', 'his earliest role'],
      'zh-TW': ['他在 FLUX 做什麼', '介紹 FLUX', '他的營運經驗', '他最早的工作'],
      ja: ['FLUX では何をした', 'FLUX について', 'オペレーションの経験'],
    },
    answers: {
      en: 'At **FLUX** (Operations Manager, **2019–2022**) Charles ran the operational and go-to-market side of a hardware-and-software company with three product lines.\n\nHis work there landed across the board:\n\n- He developed product strategy through competitive analysis for **+20% market share**.\n- He redesigned the website and SEO across the product ecosystem for **+30% user retention**.\n- He directed a team of **10** that delivered **+22% process efficiency** and **+35% order-fulfillment speed**.\n\nIt was his first leadership role and the foundation of his outcomes-first instinct, owning the full loop from strategy to shipping.',
      'zh-TW': '在 **FLUX**（營運經理，**2019–2022**），Charles 負責這家有三條產品線的軟硬體公司的營運與 go-to-market。\n\n他在這裡的成果全面開花：\n\n- 他透過競品分析制定產品策略，帶來 **市佔 +20%**。\n- 他為產品生態系重新設計官網與 SEO，帶來 **使用者留存 +30%**。\n- 他帶領 **10 人**團隊，做出 **流程效率 +22%** 與 **訂單交付速度 +35%**。\n\n這是他的第一個領導職，也奠定了他「結果優先」的直覺，從策略到出貨的整個迴圈都由他負責。',
      ja: '**FLUX**（オペレーションマネージャー、**2019–2022**）で Charles は、3 つのプロダクトラインを持つソフトウェア・ハードウェア企業のオペレーションと go-to-market を担いました。\n\nここでの成果は全方位に及びました：\n\n- 競合分析を通じてプロダクト戦略を策定して **市場シェア +20%**。\n- プロダクトのエコシステム向けにサイトと SEO を再設計して **リテンション +30%**。\n- **10 名**のチームを率いて **プロセス効率 +22%** と **注文処理速度 +35%** を実現。\n\nこれは彼の最初のリーダー職であり、戦略から出荷までのループ全体を担うという「成果優先」の直感の土台になりました。',
    },
  },
  {
    id: 'career-reflection',
    questions: {
      en: ['Why did he turn down the Uber offer?', 'his career choices', 'why not big tech?', 'his career philosophy'],
      'zh-TW': ['他為什麼拒絕 Uber offer', '他的職涯選擇', '為什麼不去大廠', '他的職涯觀'],
      ja: ['なぜ Uber のオファーを断った', 'キャリアの選択', 'なぜ大手に行かない'],
    },
    answers: {
      en: "Charles has written publicly about turning down a **Uber L4 offer**, a reflection on what PM careers should optimize for in the AI era.\n\nThe piece weighs two things: the prestige and stability of a big-tech badge, and where he believes product work is heading, the AI Product Builder path, where a PM sets strategy and ships the product themselves with AI.\n\nHe concluded that the leverage and learning rate of building beat the safety of the badge, and he bet on it. The full essay is linked from the portfolio's blog section.",
      'zh-TW': 'Charles 曾公開撰文談他拒絕 **Uber L4 offer** 的決定，一篇關於「AI 時代的 PM 職涯該為什麼最佳化」的反思。\n\n文章權衡兩件事：一是大廠光環的威望與穩定，二是他認為產品工作的未來方向，也就是 AI Product Builder 之路，PM 既定策略、也親手用 AI 把產品做出來。\n\n他的結論是，動手做的槓桿與學習速度勝過光環的安全感，於是押注於此。完整文章在作品集的部落格區塊有連結。',
      ja: 'Charles は **Uber L4 オファー** を断った決断について公に執筆しています。AI 時代の PM キャリアが何を最適化すべきかについての考察です。\n\nこの記事は 2 つを天秤にかけます：大手の肩書きが持つ威信と安定、そして彼が考えるプロダクト業務の行く先、つまり PM が戦略を立てつつ AI で自らプロダクトを出荷する AI Product Builder の道です。\n\n結論は、作ることのレバレッジと学習速度が肩書きの安心に勝るというもので、そこに賭けました。全文はポートフォリオのブログ欄からリンクされています。',
    },
  },
  {
    id: 'contact-direct',
    questions: {
      en: ['What is his email?', 'his LinkedIn', 'his GitHub', 'social links', 'where can I find him online?'],
      'zh-TW': ['他的 email 是什麼', '他的 LinkedIn', '他的 GitHub', '社群連結', '網路上哪裡找他'],
      ja: ['メールアドレスは', 'LinkedIn', 'GitHub', 'SNS リンク', 'オンラインでどこ'],
    },
    answers: {
      en: 'You can reach Charles here:\n\n* Email: [charlestyc0527@gmail.com](mailto:charlestyc0527@gmail.com)\n* [LinkedIn](https://www.linkedin.com/in/charles-chen-809a2043)\n* [GitHub](https://github.com/Kaminoikari)\n* [Threads](https://www.threads.com/@charles_tychen)\n* [Substack](https://charlestychen.substack.com)\n* [All links / Portaly](https://portaly.cc/charleschen)',
      'zh-TW': '你可以透過這些方式聯繫 Charles：\n\n* Email：[charlestyc0527@gmail.com](mailto:charlestyc0527@gmail.com)\n* [LinkedIn](https://www.linkedin.com/in/charles-chen-809a2043)\n* [GitHub](https://github.com/Kaminoikari)\n* [Threads](https://www.threads.com/@charles_tychen)\n* [Substack](https://charlestychen.substack.com)\n* [所有連結 / Portaly](https://portaly.cc/charleschen)',
      ja: '以下から Charles にご連絡いただけます：\n\n* メール：[charlestyc0527@gmail.com](mailto:charlestyc0527@gmail.com)\n* [LinkedIn](https://www.linkedin.com/in/charles-chen-809a2043)\n* [GitHub](https://github.com/Kaminoikari)\n* [Threads](https://www.threads.com/@charles_tychen)\n* [Substack](https://charlestychen.substack.com)\n* [すべてのリンク / Portaly](https://portaly.cc/charleschen)',
    },
  },
  {
    id: 'location',
    questions: {
      en: ['Where is he based?', 'where does he live?', 'where is Charles based?', 'his location', 'where will he work?', 'where can he work?', 'can he relocate?', 'will he relocate?', 'is he willing to relocate?', 'which locations does he consider?', 'what cities does he consider?'],
      'zh-TW': ['他住哪裡', 'charles 住哪裡', 'charles 在哪', '他在哪個城市', '他的所在地', '他能在哪工作', 'charles 可以在哪工作', '他考慮哪些工作地點', '他願意 relocate 嗎', 'charles 會搬家工作嗎', '他可以去國外工作嗎'],
      ja: ['どこに住んでいる', 'charles はどこ在住', '勤務地はどこ', '所在地', '移住は可能', '勤務可能な地域', '海外勤務は可能'],
    },
    answers: {
      en: 'Charles is based in the **Greater Taipei area**. For work location he\'s open to **Greater Taipei, Taoyuan, and Hsinchu**, and, where the company can sponsor a visa, **Northeast Asia, the US, Europe, and Oceania**.',
      'zh-TW': 'Charles 目前人在 **雙北**。工作地點方面，他可以接受 **雙北、桃園與新竹**，以及（公司能提供簽證的話）**東北亞、美國、歐洲與大洋洲**。',
      ja: 'Charles は **台北都市圏**を拠点としています。勤務地は **台北都市圏・桃園・新竹**、そして（会社がビザを提供できる場合）**東北アジア・米国・欧州・オセアニア** が対象です。',
    },
  },
  {
    id: 'remote',
    questions: {
      en: ['Is he open to remote?', 'does he want remote work?', 'does he prefer remote?', 'is Charles open to remote work?', 'can he work remotely?', 'remote or onsite?', 'is he open to hybrid?', 'does he prefer hybrid?', 'his work arrangement preference', 'work from home?'],
      'zh-TW': ['他接受遠端嗎', 'charles 接受遠端嗎', 'charles 能接受遠端嗎', 'charles 偏好遠端嗎', '他偏好遠端嗎', '他想遠端工作嗎', '他可以遠端嗎', '他能遠端工作嗎', '遠端還是進辦公室', '他接受 hybrid 嗎', '他偏好 hybrid 嗎', '他偏好的工作型態', '可以在家工作嗎'],
      ja: ['リモートは可能', 'リモート希望ですか', 'リモートワークはできますか', 'charles はリモート可能', 'ハイブリッドは可能', 'ハイブリッド希望', '在宅勤務はできますか', '勤務形態の希望'],
    },
    answers: {
      en: 'Charles **prefers remote or hybrid**, but he\'s flexible, on-site works too if that\'s the arrangement.',
      'zh-TW': 'Charles **偏好遠端或 hybrid**，但很有彈性，如果是進辦公室的型態也沒問題。',
      ja: 'Charles は **リモートまたはハイブリッドを希望**しますが、柔軟です、オンサイトの形態でも問題ありません。',
    },
  },
  {
    id: 'languages',
    questions: {
      en: ['What languages does he speak?', 'his language skills', 'does he speak English?', 'does Charles speak English?', 'is he bilingual?', 'how is his English?', 'his English level', 'is his English good?', 'TOEIC score', 'what is his TOEIC?'],
      'zh-TW': ['他會說哪些語言', 'charles 會說哪些語言', '他的語言能力', '他的英文程度', '他英文好嗎', 'charles 英文好嗎', '他會說英文嗎', '他英文流利嗎', '他的多益成績', '多益幾分'],
      ja: ['話せる言語', '何語を話せる', '語学力', '英語は話せる', 'charles は英語が話せる', '英語のレベル', '英語は得意', 'TOEIC スコア', 'TOEIC は何点'],
    },
    answers: {
      en: 'Charles is a **native Chinese (Mandarin)** speaker and **fluent in English** (TOEIC **940/990**).',
      'zh-TW': 'Charles 的母語是 **中文（國語）**，英語 **流利**（多益 **940/990**）。',
      ja: 'Charles は **中国語（北京語）が母語**で、**英語は流暢**（TOEIC **940/990**）です。',
    },
  },
  {
    id: 'no-data-redirect',
    questions: {
      en: ['What is his education?', 'where did he study?', 'his degree', 'which university?', 'his expected salary', 'his age'],
      'zh-TW': ['他的學歷', '他在哪裡讀書', '他念哪間學校', '他的學位', '他的期望薪資'],
      ja: ['学歴は', 'どこの大学', '学位', '希望給与'],
    },
    answers: {
      en: "That detail isn't covered in the portfolio, and I'd rather not guess. It's best to ask Charles directly:\n\n* Email: [charlestyc0527@gmail.com](mailto:charlestyc0527@gmail.com)\n* [LinkedIn](https://www.linkedin.com/in/charles-chen-809a2043)",
      'zh-TW': '這個細節作品集裡沒有提供，我不想亂猜。建議直接問 Charles 本人：\n\n* Email:[charlestyc0527@gmail.com](mailto:charlestyc0527@gmail.com)\n* [LinkedIn](https://www.linkedin.com/in/charles-chen-809a2043)',
      ja: 'その詳細はポートフォリオに記載がなく、推測は避けたいです。Charles 本人に直接お尋ねください：\n\n* メール：[charlestyc0527@gmail.com](mailto:charlestyc0527@gmail.com)\n* [LinkedIn](https://www.linkedin.com/in/charles-chen-809a2043)',
    },
  },

  // ──────────────── interviewer / HR lens ────────────────
  {
    id: 'strengths',
    questions: {
      en: ['What are his strengths?', 'what is he good at?', 'his biggest strength', 'why is he a strong PM?', 'what makes him stand out?', 'his superpower'],
      'zh-TW': ['他的優勢是什麼', '他擅長什麼', '他最強的地方', '他為什麼是強的 PM', '他的亮點是什麼', '他的強項'],
      ja: ['彼の強みは', '何が得意', '一番の強み', 'なぜ優れた PM なのか', '彼の際立つ点'],
    },
    answers: {
      en: "Charles's core strength is being an **AI Product Builder**: he pairs sharp product strategy (**JTBD**, **RICE**, opportunity framing) with the engineering to ship it himself using AI, iterating **5x faster**.\n\nThree things back that up:\n\n- **Ownership**: he was the **USPACE app owner**, leading a **15-person cross-functional Scrum team** across three product lines.\n- **0→1 range**: he launched **USPACE for Business** and **Taiwan's first subscription-based parking insurance**, and shipped **five solo side projects** end to end.\n- **Real AI-engineering depth**: his own multi-agent system **Product Playbook**, this portfolio's self-correcting AI chatbot, and production **Gemini** features, all real systems you can actually inspect.\n\nThe rare part is that all three live in one person, so product strategy and hands-on execution stay in the same pair of hands.",
      'zh-TW': 'Charles 的核心優勢是身為 **AI Product Builder**：他把敏銳的產品策略（**JTBD**、**RICE**、機會框架）與「親手用 AI 交付」的工程能力結合，迭代快 **5 倍**。\n\n有三件事撐起這一點：\n\n- **當責**：他曾擔任 **USPACE app 負責人**，帶領 **15 人跨職能 Scrum 團隊**、橫跨三條產品線。\n- **0→1 廣度**：他推出了 **USPACE for Business** 與 **全台首創訂閱制停車保險**，也端到端獨力交付了 **五個 side projects**。\n- **真實的 AI 工程深度**：自建的多代理系統 **Product Playbook**、這個作品集會自我修正的 AI 聊天機器人，以及生產級 **Gemini** 功能，全是能實際檢視的真實系統。\n\n最稀有的是這三者同時長在一個人身上，於是產品策略與親手執行始終握在同一雙手裡。',
      ja: 'Charles の核となる強みは **AI Product Builder** であることです：鋭いプロダクト戦略（**JTBD**、**RICE**、機会フレーミング）と、AI で自ら出荷するエンジニアリングを併せ持ち、**5 倍速** で反復します。\n\nそれを 3 つが裏づけます：\n\n- **オーナーシップ**：かつて **USPACE app のオーナー** として **15 名のクロスファンクショナル Scrum チーム** を率い、3 つのプロダクトラインを横断しました。\n- **0→1 の幅**：**USPACE for Business** と **台湾初のサブスク型駐車場保険** をローンチし、**5 つのサイドプロジェクト** を端から端まで単独で出荷しました。\n- **本物の AI エンジニアリングの深さ**：自作のマルチエージェント **Product Playbook**、このポートフォリオの自己修正する AI チャットボット、本番の **Gemini** 機能、いずれも実際に検証できる本物のシステムです。\n\n稀有なのは、この 3 つが一人の中に同居していること。ゆえにプロダクト戦略と実際の実行が、同じ一人の手に収まります。',
    },
  },
  {
    id: 'weaknesses',
    questions: {
      en: ['What are his weaknesses?', 'his weakness', 'what does he struggle with?', 'areas for growth', 'his blind spots'],
      'zh-TW': ['他的弱點是什麼', '他的缺點', '他不擅長什麼', '他的成長空間', '他的盲點'],
      ja: ['彼の弱みは', '弱点', '苦手なこと', '成長の余地'],
    },
    answers: {
      en: "That's best answered by Charles himself, self-assessment of growth areas is a conversation he'd want to have directly. You can reach him here:\n\n* Email: [charlestyc0527@gmail.com](mailto:charlestyc0527@gmail.com)\n* [LinkedIn](https://www.linkedin.com/in/charles-chen-809a2043)",
      'zh-TW': '這個問題最好由 Charles 本人來回答，關於成長空間的自我評估，他會想親自談。你可以這樣聯繫他：\n\n* Email: [charlestyc0527@gmail.com](mailto:charlestyc0527@gmail.com)\n* [LinkedIn](https://www.linkedin.com/in/charles-chen-809a2043)',
      ja: 'これは Charles 本人にお尋ねいただくのが一番です、成長領域の自己評価は、直接話したい話題だと思います。こちらからご連絡ください：\n\n* メール： [charlestyc0527@gmail.com](mailto:charlestyc0527@gmail.com)\n* [LinkedIn](https://www.linkedin.com/in/charles-chen-809a2043)',
    },
  },
  {
    id: 'achievement',
    questions: {
      en: ['What is his biggest achievement?', 'his proudest work', 'his greatest accomplishment', 'what is he most proud of?'],
      'zh-TW': ['他最大的成就是什麼', '他最自豪的作品', '他最引以為傲的', '他最大的貢獻'],
      ja: ['一番の成果は', '最も誇れる仕事', '最大の功績'],
    },
    answers: {
      en: "Two stand out, one on product and one on engineering.\n\n- **Product**: at **USPACE**, as the **app owner** leading a **15-person cross-functional team**, he launched **USPACE for Business** from **0→1** and shipped **Taiwan's first subscription-based parking insurance**, an FSC regulatory-sandbox trial with **Fubon Insurance** that embeds pay-as-you-park pricing one-tap into checkout for **1M+ members**.\n- **Engineering**: his **Product Playbook** multi-agent system lifted spec quality-completion to **100%** (from **59.1%**) at flat token cost, with the pre-mortem agent proving load-bearing (the risk step collapses to **22.2%** without it).\n\nBoth reflect how he measures success: by the user behavior his products actually move.",
      'zh-TW': '兩個最突出，一個在產品、一個在工程。\n\n- **產品面**：在 **USPACE**，他以 **app 負責人** 身分帶領 **15 人跨職能團隊**，把 **USPACE for Business** 從 **0→1** 推出，並推出 **全台首創訂閱制停車保險**，與 **富邦產險** 合作的 FSC 監理沙盒試辦，把 pay-as-you-park 用量計價一鍵嵌入結帳、觸及 **1M+ 會員**。\n- **工程面**：他的 **Product Playbook** 多代理系統把規格品質完成率從 **59.1%** 提升到 **100%**，且 token 成本不變；其中 pre-mortem 子代理被證明是關鍵支柱（少了它，風險評估步驟會掉到 **22.2%**）。\n\n兩者都反映他衡量成功的方式：看產品真正改變了多少使用者行為。',
      ja: '最も際立つのは 2 つ、プロダクトが 1 つ、エンジニアリングが 1 つです。\n\n- **プロダクト面**：**USPACE** で **app オーナー** として **15 名のクロスファンクショナルチーム** を率い、**USPACE for Business** を **0→1** でローンチ、**台湾初のサブスク型駐車場保険**（**富邦保険** との FSC 規制サンドボックス試行、pay-as-you-park の従量課金をワンタップで決済に組み込み、**100 万人超の会員** にリーチ）を投入しました。\n- **エンジニアリング面**：**Product Playbook** マルチエージェントが仕様の品質完了率を **59.1%** から **100%** へ（トークンコスト据え置き）引き上げ、pre-mortem サブエージェントが要であると実証しました（これがないとリスク評価ステップは **22.2%** へ崩れます）。\n\nどちらも、プロダクトが実際に動かしたユーザー行動で成功を測る、彼の姿勢を表しています。',
    },
  },
  {
    id: 'why-hire',
    questions: {
      en: ['Why should I hire him?', 'why hire Charles?', 'what value does he bring?', 'why is he a good fit?', 'what can he do for my company?'],
      'zh-TW': ['為什麼該錄取他', '為什麼要僱用 Charles', '他能帶來什麼價值', '他為什麼適合', '他能為公司做什麼'],
      ja: ['なぜ採用すべき', 'なぜ Charles を雇う', 'どんな価値をもたらす', 'なぜ適任'],
    },
    answers: {
      en: "Charles collapses the usual gap between product and engineering. A typical PM writes the spec and hands it to engineering. Charles sets the product strategy and then ships the prototype himself with AI, so ideas get validated in production about **5x faster** and cheaper.\n\nConcretely, he has:\n\n- Led a **15-person cross-functional team as the USPACE app owner**.\n- Launched **B2B SaaS** and **Taiwan's first subscription-based parking insurance** from **0→1**.\n- Built production AI systems end to end (a multi-agent spec engine, this self-correcting chatbot, and **Gemini** features).\n\nThat means fewer expensive handoffs, faster learning loops, and a hire who can both decide what to build and build enough of it to derisk the decision. For a team that wants validated outcomes fast, that combination is rare.",
      'zh-TW': 'Charles 把產品與工程之間常見的落差直接收合。一般的 PM 把規格寫好、交給工程。Charles 則先訂出產品策略，再親手用 AI 交付原型，讓想法在生產環境中以約 **5 倍速**、更低成本被驗證。\n\n具體來說，他做過：\n\n- 以 **USPACE app 負責人** 帶領 **15 人跨職能團隊**。\n- 把 **B2B SaaS** 與 **全台首創訂閱制停車保險** 從 **0→1** 推出。\n- 端到端打造生產級 AI 系統（多代理規格引擎、這個會自我修正的聊天機器人、**Gemini** 功能）。\n\n這代表更少昂貴的交接、更快的學習迴圈，以及一位「既能決定要做什麼、又能把它做到足以降低決策風險」的人。對一個想要快速取得已驗證成果的團隊，這種組合很稀有。',
      ja: 'Charles はプロダクトとエンジニアリングの間にありがちな隔たりを畳み込みます。一般的な PM は仕様を書いてエンジニアに渡します。Charles はまずプロダクト戦略を立て、その上で AI を使ってプロトタイプを自ら出荷するので、アイデアを本番で約 **5 倍速**・低コストで検証できます。\n\n具体的には、次を手がけてきました：\n\n- **USPACE app のオーナー** として **15 名のクロスファンクショナルチーム** を率いる。\n- **B2B SaaS** と **台湾初のサブスク型駐車場保険** を **0→1** でローンチ。\n- 本番 AI システムを端から端まで構築（マルチエージェント仕様エンジン、この自己修正するチャットボット、**Gemini** 機能）。\n\nつまり、高コストな受け渡しが減り、学習ループが速くなり、「何を作るか決められて、決定のリスクを下げる程度まで自分で作れる」人材が手に入ります。検証済みの成果を速く求めるチームには、稀有な組み合わせです。',
    },
  },
  {
    id: 'why-product',
    questions: {
      en: ['Why did he become a PM?', 'why product management?', 'what drives him?', 'his motivation', 'why does he do this work?'],
      'zh-TW': ['他為什麼當 PM', '他為什麼做產品', '是什麼驅動他', '他的動機', '他為什麼做這份工作'],
      ja: ['なぜ PM になった', 'なぜプロダクトマネジメント', '彼の原動力', 'モチベーション'],
    },
    answers: {
      en: "Charles is driven by shipping: he treats launching as the truest form of validation, and gets energized by products that actually change user behavior.\n\nHe believes the strongest product people are **Builders** who close the gap between an idea and a working product themselves. That conviction is why he reframed his career around AI and turned down a safer big-tech path.\n\nThe work that excites him most is the **0→1** stretch:\n\n- Finding the real problem.\n- Betting on a solution.\n- Getting it in front of users fast enough to learn.\n\nFor the deeper personal why, he would be glad to talk directly.",
      'zh-TW': 'Charles 的驅動力來自「交付」：他把上線視為最真實的驗證，並對打造「真正改變使用者行為」的產品充滿熱情。\n\n他相信最強的產品人是親手弭平「想法與可運作產品之間距離」的 **Builder**。這份信念，正是他把職涯重新繞著 AI 重構、並推掉較安穩大廠路線的原因。\n\n最讓他興奮的是 **0→1** 的那一段：\n\n- 找到真正的問題。\n- 對解法下注。\n- 快到足以學習地把它推到使用者面前。\n\n更深層的個人「為什麼」，他很樂意親自聊。',
      ja: 'Charles の原動力は「出荷」です：ローンチを最も真実な検証と捉え、ユーザー行動を実際に変えるプロダクトに情熱を注ぎます。\n\n最強のプロダクト人材は、アイデアと動くプロダクトの間を自ら埋める **Builder** だと信じています。その確信こそ、キャリアを AI 中心に再構築し、より安全な大手の道を断った理由です。\n\n最も心が躍るのは **0→1** の区間です：\n\n- 本当の課題を見つける。\n- 解に賭ける。\n- 学べるだけの速さでユーザーの前に出す。\n\nより深い個人的な「なぜ」は、直接話すのを歓迎します。',
    },
  },
  {
    id: 'availability',
    questions: {
      en: ['When can he start?', 'his notice period', 'is he available now?', 'how soon can he join?', 'his start date'],
      'zh-TW': ['他什麼時候能開始', '他的到職時間', '他多快能加入', '他現在有空嗎', '他的 notice period'],
      ja: ['いつ始められる', '入社可能時期', 'すぐに参加できる', '通知期間'],
    },
    answers: {
      en: "Timing and availability are best discussed with Charles directly, he can speak to his notice period and start date for your specific role:\n\n* Email: [charlestyc0527@gmail.com](mailto:charlestyc0527@gmail.com)\n* [LinkedIn](https://www.linkedin.com/in/charles-chen-809a2043)",
      'zh-TW': '到職時間與檔期最好直接和 Charles 談，他能針對你的職位說明 notice period 與可開始的日期：\n\n* Email: [charlestyc0527@gmail.com](mailto:charlestyc0527@gmail.com)\n* [LinkedIn](https://www.linkedin.com/in/charles-chen-809a2043)',
      ja: '時期や空き状況は Charles に直接ご相談ください、ご提示の役割に合わせて通知期間や開始日をお伝えできます：\n\n* メール： [charlestyc0527@gmail.com](mailto:charlestyc0527@gmail.com)\n* [LinkedIn](https://www.linkedin.com/in/charles-chen-809a2043)',
    },
  },
  {
    id: 'prioritization',
    questions: {
      en: ['How does he prioritize?', 'his prioritization method', 'how does he decide what to build?', 'how does he make product decisions?'],
      'zh-TW': ['他如何排優先級', '他的優先級方法', '他怎麼決定要做什麼', '他怎麼做產品決策'],
      ja: ['どう優先順位をつける', '優先順位付けの方法', '何を作るか決める方法'],
    },
    answers: {
      en: 'Charles prioritizes by outcomes over outputs. His method runs in three moves:\n\n- **Frame the opportunity first** with **JTBD** and an **Opportunity Solution Tree**.\n- **Score the candidates** with **RICE**.\n- **Anchor everything on a North Star metric**, so the team optimizes the one thing that matters.\n\nThe part that sets him apart is how he validates: he uses AI to ship a working prototype and get real user signal before committing large resources, so each call rests on evidence. When new signal contradicts the plan, he reprioritizes fast, strong opinions loosely held.',
      'zh-TW': 'Charles 以「結果重於產出」來排優先級。他的方法分成三步：\n\n- **先框定機會**：用 **JTBD** 與 **機會解決方案樹（OST）**。\n- **為候選項評分**：用 **RICE**。\n- **把一切錨定在 North Star 指標上**，讓團隊只最佳化一件真正重要的事。\n\n他與眾不同的地方在於驗證方式：他用 AI 交付可運作原型、在投入大量資源前先取得真實使用者訊號，讓每個決策都建立在證據上。當新訊號與計畫相牴觸，他會很快重新排序，有主見但不固執。',
      ja: 'Charles は「アウトプットよりアウトカム」で優先順位をつけます。方法は 3 つの動きから成ります：\n\n- **まず機会を捉える**：**JTBD** と **機会解決ツリー（OST）** で。\n- **候補を採点する**：**RICE** で。\n- **すべてを North Star 指標に紐づける**、チームが本当に重要な一点を最適化するように。\n\n彼が際立つのは検証の仕方です：AI で動くプロトタイプを出し、大きなリソースを投じる前に実ユーザーの反応を得て、各判断を証拠の上に置きます。新しいシグナルが計画と食い違えば、素早く優先順位を組み替えます。強い意見を緩く持って。',
    },
  },

  // ──────────────── tech-enthusiast lens ────────────────
  {
    id: 'tech-why-choices',
    questions: {
      en: ['Why did he choose these technologies?', 'his tech stack rationale', 'why Qdrant?', 'why Voyage?', 'why Claude?', 'why these tools?'],
      'zh-TW': ['他為什麼選這些技術', '他的技術選型理由', '為什麼用 Qdrant', '為什麼用 Voyage', '為什麼選這些工具'],
      ja: ['なぜこれらの技術を選んだ', '技術選定の理由', 'なぜ Qdrant', 'なぜ Claude'],
    },
    answers: {
      en: "In plain terms: every choice trades toward shipping fast and running near-free, and only adds infrastructure where it earns its keep. For this chatbot specifically:\n\n- **Qdrant** for the vector store: hybrid dense plus **BM25** with server-side **RRF**, and a generous free tier after Supabase's pgvector hit its **2-project cap**.\n- **Voyage voyage-3-large** for the embeddings: SOTA multilingual quality that handles zh, ja, and en cleanly.\n- **rerank-2.5** as a **cross-encoder** over the fused results, to sharpen the final ranking.\n- A **two-tier Gemini→Claude** generation stack: free tier first, paid fallback, to keep cost near zero.\n\nThe server-side fusion also keeps the **Vercel** function lean by shipping no sparse encoder. Across projects the same instinct shows up: ship fast with AI-native tooling (**Claude Code**, **Codex**) and lean managed services, and add infrastructure only where it earns its keep.",
      'zh-TW': '一句話說：每個選擇都是為了「快速交付、幾乎零成本運行」，只在划算的地方才加基礎設施。以這個 chatbot 為例：\n\n- **Qdrant** 當向量庫：dense 加 **BM25** 混合、伺服器端 **RRF**，而且在 Supabase 的 pgvector 撞到 **兩專案上限** 後，它的免費額度很大方。\n- **Voyage voyage-3-large** 做向量：中日英都處理得乾淨的 SOTA 多語向量。\n- **rerank-2.5** 對融合後的結果做 **cross-encoder** 重排序，讓最終排序更精準。\n- **兩層 Gemini→Claude** 生成：免費層先、付費備援，把成本壓到近乎零。\n\n伺服器端融合也讓 **Vercel** function 保持輕量，因為不用打包 sparse 編碼器。跨專案來看，同一個直覺一再出現：用 AI 原生工具（**Claude Code**、**Codex**）與輕量託管服務快速交付，只在划算的地方才加基礎設施。',
      ja: '一言で言えば：どの選択も「素早く出荷し、ほぼ無料で動かす」方向に振り、見合う場所にだけインフラを足します。このチャットボットの場合：\n\n- **Qdrant** をベクトルストアに：dense 加 **BM25** ハイブリッド、サーバーサイド **RRF**、そして Supabase の pgvector が **2 プロジェクト上限** に達した後の寛大な無料枠。\n- **Voyage voyage-3-large** を埋め込みに：zh/ja/en をきれいに扱う SOTA 多言語品質。\n- **rerank-2.5** を融合結果に対する **cross-encoder** 再ランクとして、最終順位を鋭くします。\n- **二層 Gemini→Claude** の生成：無料枠が先、有料フォールバック、コストをほぼゼロに。\n\nサーバーサイド融合は sparse エンコーダを同梱しないので **Vercel** 関数も軽量に保てます。プロジェクト全般で同じ直感が現れます：AI ネイティブなツール（**Claude Code**、**Codex**）と軽量なマネージドサービスで素早く出荷し、見合う場所にだけインフラを足す。',
    },
  },
  {
    id: 'open-source',
    questions: {
      en: ['Is it open source?', 'are his projects open source?', 'is the code public?', 'can I see the code?', 'is Product Playbook open source?', 'his GitHub'],
      'zh-TW': ['這是開源的嗎', '他的專案開源嗎', '程式碼是公開的嗎', '可以看程式碼嗎', 'Product Playbook 開源嗎', '他的 GitHub'],
      ja: ['オープンソースですか', 'プロジェクトは公開', 'コードは見られる', 'Product Playbook は OSS'],
    },
    answers: {
      en: '**Product Playbook** is open source under the **MIT license**, and used by PMs and engineers as a shared productivity tool.\n\nSeveral of his projects have public repos on GitHub ([github.com/Kaminoikari](https://github.com/Kaminoikari)), so you can read the actual implementation, the sub-agent definitions, the scoring engines, the scrapers:\n\n- **Product Playbook**\n- **House Ops**\n- **Job Ops**\n\n**Path** and **Plutus Trade** are live demos you can try in the browser. Between the repos and the live demos, you can inspect most of his work directly, well beyond the description here.',
      'zh-TW': '**Product Playbook** 以 **MIT 授權** 開源，被 PM 與工程師當成共用的生產力工具。\n\n他有數個專案在 GitHub 上有公開 repo（[github.com/Kaminoikari](https://github.com/Kaminoikari)），所以你能直接讀到實作，像子代理的定義、評分引擎、爬蟲：\n\n- **Product Playbook**\n- **House Ops**\n- **Job Ops**\n\n**Path** 與 **Plutus Trade** 則是可以在瀏覽器裡實際試用的 live demo。靠這些 repo 加上 live demo，他大部分的作品都能被直接檢視，遠超過這裡的描述。',
      ja: '**Product Playbook** は **MIT ライセンス** で OSS 公開され、PM やエンジニアが共有の生産性ツールとして使っています。\n\nGitHub（[github.com/Kaminoikari](https://github.com/Kaminoikari)）には複数の公開リポジトリがあり、実装そのもの、サブエージェントの定義、採点エンジン、スクレイパーまで読めます：\n\n- **Product Playbook**\n- **House Ops**\n- **Job Ops**\n\n**Path** と **Plutus Trade** はブラウザで試せるライブデモです。リポジトリとライブデモを合わせれば、彼の仕事の大半はここでの説明を超えて、実際に検証できます。',
    },
  },

  // ──────────────── founder / investor lens ────────────────
  {
    id: 'zero-to-one',
    questions: {
      en: ['Can he build 0 to 1?', 'can he ship a product alone?', 'can he build an MVP?', 'is he a 0 to 1 person?', 'can he build solo?'],
      'zh-TW': ['他能從 0 到 1 嗎', '他能獨立做出產品嗎', '他能做 MVP 嗎', '他是 0 到 1 的人嗎', '他能單獨開發嗎'],
      ja: ['0 から 1 を作れる', '一人でプロダクトを出せる', 'MVP を作れる', 'ソロで開発できる'],
    },
    answers: {
      en: "Yes, that's his core mode.\n\nAt **USPACE** he launched two products from **0→1**: **USPACE for Business** (a B2B SaaS he owned end to end, from sales discovery through spec, launch, and payment reconciliation) and **Taiwan's first subscription-based parking insurance**.\n\nOn his own he has built and shipped five complete products, each on a different stack (React, Node.js, Flutter, Python), all with AI tooling and no separate engineering team:\n\n- **Path**\n- **Plutus Trade**\n- **Product Playbook**\n- **House Ops**\n- **Job Ops**\n\nThe pattern is always the same: he sets the strategy, designs the system, and ships the working product himself, which is exactly what 0→1 in a resource-constrained setting demands.",
      'zh-TW': '可以，這正是他的核心模式。\n\n在 **USPACE** 他把兩個產品從 **0→1** 推出：**USPACE for Business**（一個 B2B SaaS，從業務探索、規格、上線到財務對帳全程獨力負責）與 **全台首創訂閱制停車保險**。\n\n他也獨力打造、交付了五個完整產品，每個都跑在不同技術棧（React、Node.js、Flutter、Python）上，全程用 AI 工具、沒有另外的工程團隊：\n\n- **Path**\n- **Plutus Trade**\n- **Product Playbook**\n- **House Ops**\n- **Job Ops**\n\n模式始終一樣：他既制定策略、設計系統，也親手交付可運作的產品，這正是資源受限環境下的 0→1 所需要的。',
      ja: 'はい、それが彼の核となるモードです。\n\n**USPACE** では 2 つのプロダクトを **0→1** でローンチしました：**USPACE for Business**（B2B SaaS、営業ディスカバリーから仕様・ローンチ・財務照合まで端から端まで単独担当）と **台湾初のサブスク型駐車場保険** です。\n\n個人でも 5 つの完成プロダクトを、それぞれ異なるスタック（React・Node.js・Flutter・Python）で、すべて AI ツールで、別途のエンジニアチームなしに構築・出荷しました：\n\n- **Path**\n- **Plutus Trade**\n- **Product Playbook**\n- **House Ops**\n- **Job Ops**\n\nパターンは常に同じです：戦略を立て、システムを設計し、動くプロダクトも自ら出荷する。これこそリソース制約下の 0→1 が要求するものです。',
    },
  },
  {
    id: 'cofounder',
    questions: {
      en: ['Is he open to co-founding?', 'would he join a startup?', 'is he interested in founding?', 'co-founder potential', 'would he be a founder?'],
      'zh-TW': ['他願意當共同創辦人嗎', '他會加入新創嗎', '他對創業有興趣嗎', '他適合當 founder 嗎', '他想創業嗎'],
      ja: ['共同創業に興味', 'スタートアップに参加', '創業に興味', '創業者になる'],
    },
    answers: {
      en: "Founding-stage conversations are best had with Charles directly, fit, timing, and vision alignment are personal. Given his AI Product Builder profile (strategy + 0→1 shipping with AI), it's a natural fit to explore. Reach him:\n\n* Email: [charlestyc0527@gmail.com](mailto:charlestyc0527@gmail.com)\n* [LinkedIn](https://www.linkedin.com/in/charles-chen-809a2043)",
      'zh-TW': '創業階段的對話最好直接和 Charles 談，契合度、時機與願景一致與否都很個人。以他 AI Product Builder 的特質（策略 + 用 AI 做 0→1）來看，這是值得一聊的方向。聯繫他：\n\n* Email: [charlestyc0527@gmail.com](mailto:charlestyc0527@gmail.com)\n* [LinkedIn](https://www.linkedin.com/in/charles-chen-809a2043)',
      ja: '創業フェーズの話は Charles に直接ご相談を、相性・タイミング・ビジョンの一致は個人的なものです。彼の AI Product Builder の特性（戦略+AI での 0→1 出荷）を踏まえれば、検討する価値のある方向性です。ご連絡先：\n\n* メール： [charlestyc0527@gmail.com](mailto:charlestyc0527@gmail.com)\n* [LinkedIn](https://www.linkedin.com/in/charles-chen-809a2043)',
    },
  },

  // ───────────────────────────── meta / cta ─────────────────────────────
  {
    id: 'hiring',
    questions: {
      en: ['Is he open to work?', 'is he looking for a job?', 'is he available for hire?', 'can I hire him?'],
      'zh-TW': ['他在找工作嗎', '他有在看機會嗎', '可以聘用他嗎', '他開放工作機會嗎'],
      ja: ['転職を考えている', '採用は可能', '仕事を探している'],
    },
    answers: {
      en: "For opportunities, roles, or collaboration, it's best to reach Charles directly, he can speak to fit and availability himself:\n\n* Email: [charlestyc0527@gmail.com](mailto:charlestyc0527@gmail.com)\n* [LinkedIn](https://www.linkedin.com/in/charles-chen-809a2043)\n* [All links / Portaly](https://portaly.cc/charleschen)",
      'zh-TW': '關於工作機會、職位或合作，最好直接聯繫 Charles 本人，由他親自說明適配與時間：\n\n* Email:[charlestyc0527@gmail.com](mailto:charlestyc0527@gmail.com)\n* [LinkedIn](https://www.linkedin.com/in/charles-chen-809a2043)\n* [所有連結 / Portaly](https://portaly.cc/charleschen)',
      ja: '機会・ポジション・協業については、Charles 本人に直接ご連絡いただくのが確実です（適性や時期は本人がお答えします）:\n\n* メール：[charlestyc0527@gmail.com](mailto:charlestyc0527@gmail.com)\n* [LinkedIn](https://www.linkedin.com/in/charles-chen-809a2043)\n* [すべてのリンク / Portaly](https://portaly.cc/charleschen)',
    },
  },
]
