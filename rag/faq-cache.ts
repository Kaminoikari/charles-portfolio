// Pre-written FAQ answers for the portfolio chatbot — the "semantic cache".
//
// Every entry is grounded ONLY in the real corpus (src/data/*). Answers are
// kept short (2-4 sentences) and editable. At ingest time each `questions`
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
      en: "I'm the portfolio assistant for **Charles Chen （陳德潁）**, a Taiwan-based Software Product Manager who builds software products from 0 to 1, pairing product strategy with AI development tools to ship end-to-end. Ask me about his projects, work experience, skills, or how he uses AI.",
      'zh-TW': '我是 **Charles Chen（陳德潁）** 的作品集小助手。他是一位台灣的軟體產品經理，擅長從 0 到 1 打造軟體產品，結合產品策略與 AI 開發工具完成端到端交付。你可以問我他的專案、工作經歷、技能，或他如何運用 AI。',
      ja: '私は **Charles Chen（陳德潁）** のポートフォリオアシスタントです。彼は台湾を拠点とするソフトウェアプロダクトマネージャーで、0 から 1 のプロダクト構築を得意とし、プロダクト戦略と AI 開発ツールを組み合わせてエンドツーエンドで届けます。プロジェクト・職務経歴・スキル・AI 活用などお気軽にどうぞ。',
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
      en: 'Charles is an AI Product Manager with **5+ years** building products that change user behavior, across creator tools, Fintech, B2B SaaS, and MaaS. His work has reached **7M+ people**. He currently leads three product lines at USPACE (Taiwan + Japan) driving **85%+ of company revenue**, and ships AI-built prototypes **5x faster** than traditional workflows.',
      'zh-TW': 'Charles 是一位 AI 產品經理，有 **5 年以上**打造「改變使用者行為」產品的經驗，橫跨創作者工具、Fintech、B2B SaaS 與 MaaS，作品觸及 **超過 700 萬人**。他目前在 USPACE 主導三條產品線（台灣 + 日本），貢獻 **85% 以上的公司營收**，並以 AI 打造原型，比傳統流程快 **5 倍**。',
      ja: 'Charles は **5 年以上**「ユーザー行動を変える」プロダクトを作ってきた AI プロダクトマネージャーで、クリエイターツール・Fintech・B2B SaaS・MaaS にまたがり、その仕事は **700 万人以上**に届いています。現在 USPACE で 3 つのプロダクトライン（台湾+日本）を統括し、**会社売上の 85% 以上**を牽引、AI によるプロトタイピングで従来比 **5 倍速**で出荷しています。',
    },
  },
  {
    id: 'best-project',
    questions: {
      en: ["What's his most impressive project?", 'best project', 'which project shows technical depth?', 'most technical work'],
      'zh-TW': ['最厲害的專案是哪個', '最有代表性的作品', '哪個專案最能展示技術深度', '技術含量最高的'],
      ja: ['一番すごいプロジェクトは', '代表作は', '最も技術的なプロジェクト'],
    },
    answers: {
      en: '**Product Playbook** best shows his technical depth — an LLM Multi-Agent System on Claude Code that orchestrates 3 specialist sub-agents against 22 product frameworks to turn fuzzy ideas into shippable specs. Enabling the sub-agent layer lifted quality-completion from 59.1% to 100% at flat token cost. His **Plutus Trade**, **House Ops**, and **Job Ops** projects also showcase production AI engineering.',
      'zh-TW': '**Product Playbook** 最能展示他的技術深度——這是一套建在 Claude Code 上的 LLM 多代理系統(Multi-Agent)，用 3 個專家子代理搭配 22 個產品框架，把模糊的想法轉成可交付的規格。啟用子代理層後，品質完成率從 59.1% 提升到 100%，且 token 成本不變。另外 **Plutus Trade**、**House Ops**、**Job Ops** 也都展現了生產級的 AI 工程能力。',
      ja: '技術的な深さを最もよく示すのは **Product Playbook** です。Claude Code 上の LLM マルチエージェントシステムで、3 つの専門サブエージェントが 22 のプロダクトフレームワークを使い、曖昧なアイデアを出荷可能な仕様へ変換します。サブエージェント層を有効化すると、品質完了率が 59.1% から 100% へ向上（トークンコストは据え置き）。**Plutus Trade**・**House Ops**・**Job Ops** も本番レベルの AI エンジニアリングを示します。',
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
      en: "I'm the **portfolio assistant Charles built himself** — a corrective RAG chatbot, made to showcase his AI engineering. Under the hood: a **LangGraph.js** pipeline (triage → retrieve → grade → generate, with a corrective rewrite loop), **Qdrant** hybrid retrieval (dense + BM25, RRF-fused), **Voyage** embeddings + reranker, a two-tier **Gemini → Claude** generation stack, and a **semantic FAQ cache** that answers common questions with zero generation cost. The base model is Claude, but the whole system around it is Charles's own design.",
      'zh-TW': '我是 **Charles 親手打造的作品集小助手**——一個 corrective RAG 聊天機器人，專門用來展示他的 AI 工程能力。底層架構：**LangGraph.js** 流程（分流 → 檢索 → 評估 → 生成，含修正式重寫迴圈）、**Qdrant** 混合檢索(dense + BM25,RRF 融合)、**Voyage** 向量與重排序、兩層 **Gemini → Claude** 生成，以及一個**語意快取**讓常見問題零生成成本就能回答。底層模型是 Claude，但外圍整套系統都是 Charles 自己設計的。',
      ja: '私は **Charles 自身が作ったポートフォリオアシスタント**——彼の AI エンジニアリングを示すための corrective RAG チャットボットです。仕組みは：**LangGraph.js** パイプライン（トリアージ→検索→評価→生成、修正リライトループ付き）、**Qdrant** ハイブリッド検索(dense + BM25、RRF 融合)、**Voyage** の埋め込みとリランカー、二層の **Gemini → Claude** 生成、そして一般的な質問を生成コストゼロで返す**セマンティック FAQ キャッシュ**。ベースモデルは Claude ですが、その周りのシステム全体は Charles 自身の設計です。',
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
      en: "I'm not Charles — I'm the **AI assistant he built for this portfolio** to answer questions about his work, projects, and experience. I'm a corrective RAG chatbot Charles designed and shipped himself (the base model is Claude). Ask me anything about his projects, background, skills, or how he works.",
      'zh-TW': '我不是 Charles 本人——我是他**為這個作品集打造的 AI 助手**，用來回答關於他的工作、專案與經歷的問題。我是 Charles 自己設計並交付的 corrective RAG 聊天機器人(底層模型是 Claude)。歡迎問我任何關於他的專案、背景、技能或工作方式的問題。',
      ja: '私は Charles 本人ではなく、彼が**このポートフォリオのために作った AI アシスタント**で、彼の仕事・プロジェクト・経歴についてお答えします。Charles 自身が設計・実装した corrective RAG チャットボットです(ベースモデルは Claude)。プロジェクト・経歴・スキル・働き方など何でも聞いてください。',
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
      en: '**Product Playbook** is an LLM Multi-Agent System built on Claude Code. Three specialist sub-agents (discovery, strategy-critic, pre-mortem) are dispatched against 22 classic product frameworks (JTBD, RICE, etc.) to convert fuzzy requirements into executable PRD specs with acceptance criteria. It ships under MIT license. Enabling the sub-agents lifted quality-completion from 59.1% to 100% at flat token cost.',
      'zh-TW': '**Product Playbook** 是一套建在 Claude Code 上的 LLM 多代理系統。三個專家子代理(discovery、strategy-critic、pre-mortem)搭配 22 個經典產品框架(JTBD、RICE 等)，把模糊需求轉成帶驗收標準、可執行的 PRD 規格，並以 MIT 授權開源。啟用子代理後，品質完成率從 59.1% 提升到 100%，且 token 成本不變。',
      ja: '**Product Playbook** は Claude Code 上に構築された LLM マルチエージェントシステムです。3 つの専門サブエージェント(discovery / strategy-critic / pre-mortem)が 22 の定番プロダクトフレームワーク(JTBD、RICE など)を用い、曖昧な要件を受け入れ基準付きの実行可能な PRD 仕様へ変換します。MIT ライセンスで公開。サブエージェント有効化で品質完了率が 59.1%→100%（トークンコスト据え置き）。',
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
      en: 'It runs as a Claude.ai Custom Skill + Claude Code plugin, with Claude for LLM orchestration and Claude Vision for document parsing. The Multi-Agent layer is 3 Claude Code sub-agents (read-only tools, auto-delegation, structured YAML output). Doc processing uses Playwright, Pandoc, pymupdf, and Tesseract OCR; it supports six languages.',
      'zh-TW': '它以 Claude.ai Custom Skill + Claude Code plugin 形式運行，用 Claude 做 LLM 編排、Claude Vision 做文件解析。多代理層是 3 個 Claude Code 子代理(唯讀工具、自動委派、結構化 YAML 輸出)。文件處理用 Playwright、Pandoc、pymupdf 與 Tesseract OCR，並支援六種語言。',
      ja: 'Claude.ai Custom Skill + Claude Code プラグインとして動作し、LLM オーケストレーションに Claude、文書解析に Claude Vision を使用。マルチエージェント層は 3 つの Claude Code サブエージェント(読み取り専用ツール、自動委譲、構造化 YAML 出力)。文書処理は Playwright・Pandoc・pymupdf・Tesseract OCR、6 言語対応です。',
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
      en: '**Path** is an offline-first trip-planning PWA for unstable-network travel (think Tokyo subway or rural hot-spring towns). A cache-first + background-sync architecture (React, TypeScript, IndexedDB, Supabase, Service Worker) keeps the itinerary, map routes, and expense tracking 100% usable with no connection. One URL installs to iOS or Android — no app store.',
      'zh-TW': '**Path** 是一款離線優先(offline-first)的旅遊規劃 PWA，專為網路不穩的旅程設計（像東京地鐵或偏鄉溫泉區）。cache-first + 背景同步架構(React、TypeScript、IndexedDB、Supabase、Service Worker)讓行程、地圖路線、記帳在完全沒網路時也 100% 可用。一個網址就能安裝到 iOS 或 Android，免 app store。',
      ja: '**Path** はネットワークが不安定な旅（東京の地下鉄や地方の温泉街など）向けのオフラインファースト旅行計画 PWA です。cache-first+バックグラウンド同期(React、TypeScript、IndexedDB、Supabase、Service Worker)で、旅程・地図ルート・経費管理がオフラインでも 100% 使えます。URL 一つで iOS/Android にインストール、アプリストア不要。',
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
      en: '**Plutus Trade** is a personal AI decision-support tool for Taiwan equities. Gemini 2.5 Flash synthesizes fundamentals, institutional flow, and technicals into a BUY/SELL/HOLD diagnostic with explicit reasoning, while a daily quant momentum model pre-screens candidates. Every AI prediction is logged and settled at horizon for auditable win-rate and ROI. Built with Flutter + FastAPI.',
      'zh-TW': '**Plutus Trade** 是一款針對台股的個人 AI 決策輔助工具。Gemini 2.5 Flash 跨領域整合基本面、籌碼面與技術面，給出帶明確推理的 買/賣/持有 診斷，並由每日量化動能模型先篩選標的。每個 AI 預測都會被記錄並到期結算，提供可稽核的勝率與報酬率。技術棧為 Flutter + FastAPI。',
      ja: '**Plutus Trade** は台湾株向けの個人 AI 意思決定支援ツールです。Gemini 2.5 Flash がファンダメンタルズ・機関投資家フロー・テクニカルを統合し、根拠付きの 買/売/ホールド 診断を提示。日次のクオンツ・モメンタムモデルが候補を事前選別します。すべての AI 予測は記録され満期で精算、勝率と ROI を監査可能。Flutter + FastAPI 製。',
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
      en: '**House Ops** is a Node.js + AI pipeline for Taiwan real-estate decisions. It auto-scans 591 and Facebook rental groups daily at 09:00, uses Claude API (Haiku) to extract structured fields from messy posts, scores each listing on five weighted dimensions (price, space, location, condition, risk), and emails an HTML digest. A Claude Code layer adds affordability and upgrade-planning advice.',
      'zh-TW': '**House Ops** 是一條 Node.js + AI 的台灣房產決策管線。每天 09:00 自動掃描 591 與 Facebook 租屋社團，用 Claude API(Haiku)從雜亂貼文抽取結構化欄位，依五個加權維度（價格、空間、地點、屋況、風險）為每個物件評分，並寄出 HTML 摘要。Claude Code 互動層再補上負擔能力試算與換屋規劃建議。',
      ja: '**House Ops** は台湾の不動産意思決定のための Node.js + AI パイプラインです。毎朝 09:00 に 591 と Facebook の賃貸グループを自動スキャンし、Claude API(Haiku)で雑多な投稿から構造化フィールドを抽出、5 つの加重次元（価格・広さ・立地・状態・リスク）で採点し、HTML ダイジェストをメール配信。Claude Code 層が支払い能力試算や住み替え計画の助言を追加します。',
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
      en: "**Job Ops** is a candidate-side ATS — a Python pipeline that flips the filtering logic companies use onto the jobs instead. A daily 07:00 launchd run scrapes fresh 104 listings, scores each against your Markdown CV and YAML-defined weights (comp, remote, growth), and emails a banded RECOMMEND / CAUTIOUS / SKIP digest. Seven Claude Code modes add interview prep, comp research, and more.",
      'zh-TW': '**Job Ops** 是一套「求職者端的 ATS」——一條 Python 管線，把企業用來篩人的邏輯反過來套用在職缺上。每天 07:00 由 launchd 啟動，抓取最新的 104 職缺，依你的 Markdown 履歷與 YAML 權重（薪資、遠端、成長）評分，寄出分級的 推薦 / 觀望 / 略過 摘要。七個 Claude Code 模式再補上面試準備、薪資研究等。',
      ja: '**Job Ops** は「候補者側の ATS」です。企業が候補者を選別するロジックを求人側に反転させた Python パイプラインで、毎朝 07:00 に launchd が起動し最新の 104 求人を取得、Markdown 履歴書と YAML の重み（給与・リモート・成長）で採点し、推奨/様子見/スキップ の段階別ダイジェストをメール。7 つの Claude Code モードが面接準備や給与調査などを補います。',
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
      en: "Charles has built five showcased projects: **Path** (offline-first travel PWA), **Plutus Trade** (AI stock decision-support), **Product Playbook** (LLM multi-agent spec system), **House Ops** (real-estate automation), and **Job Ops** (candidate-side ATS). Ask about any one for details.",
      'zh-TW': 'Charles 有五個代表作品：**Path**(離線優先旅遊 PWA)、**Plutus Trade**(AI 選股決策輔助)、**Product Playbook**(LLM 多代理規格系統)、**House Ops**（房產自動化）、**Job Ops**(求職者端 ATS)。想了解哪一個都可以問我。',
      ja: 'Charles の代表的なプロジェクトは 5 つ：**Path**(オフラインファースト旅行 PWA)、**Plutus Trade**(AI 株式意思決定支援)、**Product Playbook**(LLM マルチエージェント仕様システム)、**House Ops**（不動産自動化）、**Job Ops**(候補者側 ATS)。詳しく知りたいものをどうぞ。',
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
      en: 'At **USPACE** (Product Manager, July 2024–present) Charles owns product strategy across three lines — parking payments, business travel, and financial insurance (Taiwan + Japan) — driving **85%+ of company revenue**. He 0→1 launched **USPACE for Business**, a B2B SaaS for corporate travel, and pioneered AI-driven prototyping (Claude Code, Codex, Antigravity) for **5x faster** iteration.',
      'zh-TW': '在 **USPACE**（產品經理，2024 年 7 月至今），Charles 主導三條產品線的策略——停車支付、商務差旅、金融保險（台灣 + 日本），貢獻 **85% 以上的公司營收**。他從 0 到 1 推出了 **USPACE for Business**(企業差旅管理的 B2B SaaS)，並率先導入 AI 原型開發(Claude Code、Codex、Antigravity)，讓迭代速度快 **5 倍**。',
      ja: '**USPACE**（プロダクトマネージャー、2024 年 7 月〜現在）で Charles は 3 つのライン（駐車場決済・出張・金融保険、台湾+日本）のプロダクト戦略を統括し、**会社売上の 85% 以上**を牽引。法人向け出張管理 B2B SaaS **USPACE for Business** を 0→1 でローンチし、AI 駆動プロトタイピング(Claude Code・Codex・Antigravity)で **5 倍速**の反復を実現しました。',
    },
  },
  {
    id: 'exp-history',
    questions: {
      en: ['What is his work history?', 'where has he worked?', 'past jobs', 'previous companies', 'career history'],
      'zh-TW': ['他的工作經歷', '他待過哪些公司', '過去的工作', '以前的公司'],
      ja: ['職務経歴', 'どこで働いてきた', '過去の勤務先'],
    },
    answers: {
      en: 'Charles has been: **PM at USPACE** (2024–present), **Product Mentor at XChange School** (2025–present), **Senior PM at NUEIP** (2024, BI + predictive analytics), **PM at PXPay Plus** (2022–2024, payments — +25% conversions), and **Operations Manager at FLUX** (2019–2022, +20% market share, led a team of 10).',
      'zh-TW': 'Charles 的經歷包括：**USPACE 產品經理**（2024 至今）、**XChange School 產品導師**（2025 至今）、**NUEIP 資深產品經理**(2024,BI + 預測分析)、**PXPay Plus 產品經理**（2022–2024，支付，+25% 轉換率），以及 **FLUX 營運經理**（2019–2022,+20% 市佔、帶領 10 人團隊）。',
      ja: 'Charles の経歴：**USPACE プロダクトマネージャー**（2024〜現在）、**XChange School プロダクトメンター**（2025〜現在）、**NUEIP シニア PM**(2024、BI+予測分析)、**PXPay Plus PM**（2022–2024、決済、コンバージョン +25%）、**FLUX オペレーションマネージャー**（2019–2022、市場シェア +20%、10 名のチームを統括）。',
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
      en: 'Charles has **5+ years** of product experience, spanning creator tools, Fintech, B2B SaaS, and MaaS. His work has reached over **7 million people**.',
      'zh-TW': 'Charles 有 **5 年以上**的產品經驗，橫跨創作者工具、Fintech、B2B SaaS 與 MaaS，作品觸及 **超過 700 萬人**。',
      ja: 'Charles はプロダクト経験 **5 年以上**で、クリエイターツール・Fintech・B2B SaaS・MaaS にまたがり、その仕事は **700 万人以上**に届いています。',
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
      en: 'At **PXPay Plus** (PM, 2022–2024) Charles redesigned the sign-up & checkout flow for **+25% transaction conversions** in 3 months, pioneered a reward-points system (**+50% operational efficiency, −40% complaints**), and led third-party billing integration for parking, cable TV, pension, and government payments.',
      'zh-TW': '在 **PXPay Plus**（產品經理，2022–2024），Charles 在 3 個月內重新設計註冊與結帳流程，帶來 **+25% 交易轉換率**;首創點數回饋系統（**營運效率 +50%、客訴 −40%**）;並主導停車、有線電視、年金與政府繳費的第三方代收整合。',
      ja: '**PXPay Plus**(PM、2022–2024)で Charles は登録・決済フローを再設計し 3 か月で **取引コンバージョン +25%**、ポイント還元システムを主導（**業務効率 +50%・苦情 −40%**）、駐車場・ケーブル TV・年金・行政支払いの第三者課金統合をリードしました。',
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
      en: 'On engineering: **React, TypeScript, Flutter, Canvas 2D, Node.js, Python (FastAPI), PHP (Laravel)**, with **PostgreSQL, SQLite, Redis, Supabase**, deployed on **Vercel / Fly.io**. He ships full-stack prototypes independently using Claude Code and Codex.',
      'zh-TW': '工程方面：**React、TypeScript、Flutter、Canvas 2D、Node.js、Python(FastAPI)、PHP(Laravel)**，資料庫有 **PostgreSQL、SQLite、Redis、Supabase**，部署於 **Vercel / Fly.io**。他能用 Claude Code 與 Codex 獨立交付全端原型。',
      ja: 'エンジニアリング面では **React、TypeScript、Flutter、Canvas 2D、Node.js、Python(FastAPI)、PHP(Laravel)**、DB は **PostgreSQL、SQLite、Redis、Supabase**、**Vercel / Fly.io** にデプロイ。Claude Code と Codex でフルスタックのプロトタイプを単独で出荷します。',
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
      en: 'On AI/LLM: **Claude Code, Codex, Gemini AI, LLM Orchestration, Prompt Engineering, AI Agent Development, and Agentic Workflows**. He has shipped AI in production (e.g. deep Gemini integration in Plutus Trade) and built his own multi-agent system, Product Playbook.',
      'zh-TW': 'AI/LLM 方面：**Claude Code、Codex、Gemini AI、LLM 編排、Prompt Engineering、AI Agent 開發，以及 Agentic Workflows**。他有將 AI 落地到生產環境的經驗(例如 Plutus Trade 深度整合 Gemini)，也打造了自己的多代理系統 Product Playbook。',
      ja: 'AI/LLM 面では **Claude Code、Codex、Gemini AI、LLM オーケストレーション、プロンプトエンジニアリング、AI エージェント開発、エージェンティックワークフロー**。本番環境で AI を出荷した経験があり(例：Plutus Trade での Gemini 深い統合)、自作のマルチエージェントシステム Product Playbook も構築しています。',
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
      en: 'On product strategy: **JTBD, Persona, User Journey / Empathy Map, Opportunity Solution Tree, User Story Mapping, North Star Metric, OKRs, RICE prioritization, AARRR, and competitive analysis** — plus cross-functional leadership, stakeholder management, and Agile/Scrum.',
      'zh-TW': '產品策略方面：**JTBD、Persona、User Journey / Empathy Map、機會解決方案樹(OST)、User Story Mapping、North Star Metric、OKR、RICE 優先級、AARRR，以及競品分析**，另外還有跨職能領導、利害關係人管理與 Agile/Scrum。',
      ja: 'プロダクト戦略面では **JTBD、ペルソナ、ユーザージャーニー/共感マップ、機会解決ツリー(OST)、ユーザーストーリーマッピング、North Star 指標、OKR、RICE 優先順位付け、AARRR、競合分析** に加え、機能横断リーダーシップ・ステークホルダー管理・Agile/Scrum。',
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
      en: 'Charles works by four principles: **Outcomes over outputs** (changing user behavior, not shipping features), **sharp product sense** (the best calls happen before the data exists), **strong opinions loosely held**, and **build to learn** (working prototypes beat slide decks). He measures success by what users do differently.',
      'zh-TW': 'Charles 有四個工作原則：**結果重於產出**（改變使用者行為，而非交付功能）、**敏銳的產品直覺**（最好的決策往往發生在數據出現之前）、**有主見但不固執**，以及 **動手做來學習**（可運作的原型勝過簡報）。他用「使用者行為的改變」來衡量成功。',
      ja: 'Charles の 4 つの原則：**アウトプットよりアウトカム**（機能の出荷でなくユーザー行動の変化）、**鋭いプロダクトセンス**（最良の判断はデータが揃う前に起きる）、**強い意見を緩く持つ**、**学ぶために作る**（動くプロトタイプはスライドに勝る）。成功は「ユーザーの行動がどう変わったか」で測ります。',
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
      en: "Charles believes the strongest future product people are **Product Builders** — PMs who move past just synthesizing requirements and writing PRDs to personally building and shipping prototypes with AI. This 'Builder mode' lets him iterate **5x faster**, so products earn real market validation before any large resource commitment.",
      'zh-TW': 'Charles 認為未來最強的產品人是 **Product Builder**——不只整理需求、寫 PRD，而是親自用 AI 打造並交付原型的 PM。這種「Builder 模式」讓他迭代快 **5 倍**，讓產品在投入大量資源前就能取得真實的市場驗證。',
      ja: 'Charles は、これからの最強のプロダクト人材は **Product Builder** だと考えています。要件整理や PRD 作成にとどまらず、AI で自らプロトタイプを作って出荷する PM です。この「ビルダーモード」で **5 倍速**の反復が可能になり、大きなリソース投入の前にプロダクトが実際の市場検証を得られます。',
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
      en: 'AI is the core engine of his workflow across the whole cycle: **Discovery** (LLMs digest market & interview research), **Spec writing** (his Product Playbook agent), **Prototyping** (Claude Code + Codex for full-stack builds), **AI features** (shipping Gemini in Plutus Trade), and **Agentic workflows** (autonomous agents handling repetitive work end to end).',
      'zh-TW': 'AI 是他工作流程的核心引擎，貫穿整個週期：**探索**(用 LLM 消化市場與訪談研究)、**規格撰寫**(他的 Product Playbook 代理)、**原型開發**(Claude Code + Codex 做全端)、**AI 功能**(在 Plutus Trade 落地 Gemini)，以及 **Agentic workflows**（自主代理端到端處理重複工作）。',
      ja: 'AI は彼のワークフローの中核エンジンで、全サイクルにわたります：**ディスカバリー**(LLM で市場・インタビュー調査を消化)、**仕様作成**(自作 Product Playbook エージェント)、**プロトタイピング**(Claude Code + Codex でフルスタック構築)、**AI 機能**(Plutus Trade で Gemini を出荷)、**エージェンティックワークフロー**（自律エージェントが反復作業を端から端まで処理）。',
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
      en: 'Yes. At **FLUX** he directed a team of **10** (+22% process efficiency, +35% order-fulfillment speed). He also mentors aspiring PMs at **XChange School** (Taiwan\'s largest internet professional community), and his skill set includes cross-functional team leadership, stakeholder management, and Agile/Scrum.',
      'zh-TW': '有的。在 **FLUX** 他帶領 **10 人**團隊（流程效率 +22%、訂單履行速度 +35%）。他也在 **XChange School**（台灣最大的網路專業社群）擔任產品導師，技能涵蓋跨職能團隊領導、利害關係人管理與 Agile/Scrum。',
      ja: 'はい。**FLUX** では **10 名**のチームを統括（プロセス効率 +22%、注文処理速度 +35%）。**XChange School**（台湾最大のインターネット専門コミュニティ）で PM 志望者のメンターも務め、スキルには機能横断のチームリーダーシップ・ステークホルダー管理・Agile/Scrum が含まれます。',
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
      en: 'Since 2025 Charles has been a **Product Mentor at XChange School**, Taiwan\'s largest internet professional community, mentoring aspiring product managers.',
      'zh-TW': '自 2025 年起，Charles 在 **XChange School**（台灣最大的網路專業社群）擔任 **產品導師**，輔導有志成為產品經理的學員。',
      ja: '2025 年から Charles は台湾最大のインターネット専門コミュニティ **XChange School** で **プロダクトメンター**を務め、PM 志望者を指導しています。',
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
      en: 'Yes — Charles writes prolifically on product and AI (Substack & Medium): 20+ pieces spanning AI-builder skills, product sense, PM career strategy in the AI era, OKRs, and deep technical research (e.g. a Claude Code source-code study, a Shazam algorithm breakdown). You can find his writing linked from the portfolio\'s blog section.',
      'zh-TW': '有的——Charles 在產品與 AI 領域寫作量豐富(Substack 與 Medium):20 多篇文章，橫跨 AI builder 能力、產品 sense、AI 時代的 PM 職涯策略、OKR，以及深度技術研究(例如 Claude Code 原始碼研究、Shazam 演算法解析)。作品集的部落格區塊有連結。',
      ja: 'はい——Charles はプロダクトと AI について多数執筆しています(Substack・Medium)。20 本以上で、AI ビルダーのスキル、プロダクトセンス、AI 時代の PM キャリア戦略、OKR、深い技術調査(Claude Code ソースコード研究、Shazam アルゴリズム解説など)に及びます。ポートフォリオのブログ欄からリンクされています。',
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
      en: 'Selected results: **7M+ users reached**; **85%+ of USPACE revenue** owned; **5x faster** iteration via AI prototyping; **+25% checkout conversions** and **−40% complaints** at PXPay; **+35% forecast accuracy** at NUEIP; **+20% market share** at FLUX. On Product Playbook: **+69%** product-thinking quality and a jump to **100%** quality-completion with sub-agents.',
      'zh-TW': '精選成果：觸及 **超過 700 萬使用者**;主導 **USPACE 85% 以上營收**;以 AI 原型開發達 **5 倍**迭代速度;在 PXPay **結帳轉換 +25%、客訴 −40%**;在 NUEIP **預測準確度 +35%**;在 FLUX **市佔 +20%**。Product Playbook 方面：產品思維品質 **+69%**，啟用子代理後品質完成率躍升至 **100%**。',
      ja: '主な成果：**700 万人以上**にリーチ;**USPACE 売上の 85% 以上**を統括;AI プロトタイピングで **5 倍速**の反復;PXPay で **決済コンバージョン +25%・苦情 −40%**;NUEIP で **予測精度 +35%**;FLUX で **市場シェア +20%**。Product Playbook では製品思考の品質 **+69%**、サブエージェントで品質完了率 **100%** へ。',
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
      en: 'At **NUEIP** (Senior PM, 2024) Charles built an end-to-end BI product with advanced analytics and AI: **+40% data-driven decisions**, **+35% forecast accuracy** via predictive models, and **50% faster reporting** by integrating BI dashboards.',
      'zh-TW': '在 **NUEIP**（資深產品經理，2024），Charles 打造了結合進階分析與 AI 的端到端 BI 產品：**數據驅動決策 +40%**、以預測模型達成 **預測準確度 +35%**，並透過整合 BI 儀表板讓 **報表速度快 50%**。',
      ja: '**NUEIP**(シニア PM、2024)で Charles は高度な分析と AI を備えたエンドツーエンドの BI プロダクトを構築：**データ駆動の意思決定 +40%**、予測モデルで **予測精度 +35%**、BI ダッシュボード統合で **レポート 50% 高速化**。',
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
      en: 'At **FLUX** (Operations Manager, 2019–2022) Charles developed product strategy through competitive analysis (**+20% market share**), redesigned the website and SEO for a 3-product ecosystem (**+30% retention**), and directed a team of 10 (**+22% process efficiency, +35% fulfillment speed**).',
      'zh-TW': '在 **FLUX**（營運經理，2019–2022），Charles 透過競品分析制定產品策略（**市佔 +20%**）、為三產品生態系重新設計網站與 SEO（**留存 +30%**），並帶領 10 人團隊（**流程效率 +22%、履行速度 +35%**）。',
      ja: '**FLUX**（オペレーションマネージャー、2019–2022）で Charles は競合分析を通じてプロダクト戦略を策定（**市場シェア +20%**）、3 プロダクトのエコシステム向けにサイトと SEO を再設計（**リテンション +30%**）、10 名のチームを統括（**プロセス効率 +22%・処理速度 +35%**）。',
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
      en: 'Charles has written publicly about turning down a Uber L4 offer — a reflection on PM career choices in the AI era, weighing the prestige of a big-tech badge against where he believes product work is heading (the Product Builder path). The full essay is linked from the portfolio\'s blog section.',
      'zh-TW': 'Charles 曾公開撰文談他拒絕 Uber L4 offer 的決定——一篇關於 AI 時代 PM 職涯選擇的反思，在「大廠光環」與「他認為產品工作的未來方向(Product Builder 之路)」之間做取捨。完整文章在作品集的部落格區塊有連結。',
      ja: 'Charles は Uber L4 オファーを断った決断について公に執筆しています。AI 時代の PM キャリア選択についての考察で、大手の肩書きの威信と、彼が考えるプロダクト業務の行く先(Product Builder の道)を天秤にかけたものです。全文はポートフォリオのブログ欄からリンクされています。',
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
      en: 'You can reach Charles here:\n\n* Email: [charlestyc0527@gmail.com](mailto:charlestyc0527@gmail.com)\n* [LinkedIn](https://www.linkedin.com/in/charles-chen-809a2043)\n* [GitHub](https://github.com/Kaminoikari)\n* [All links / Portaly](https://portaly.cc/charleschen)',
      'zh-TW': '你可以透過這些方式聯繫 Charles:\n\n* Email:[charlestyc0527@gmail.com](mailto:charlestyc0527@gmail.com)\n* [LinkedIn](https://www.linkedin.com/in/charles-chen-809a2043)\n* [GitHub](https://github.com/Kaminoikari)\n* [所有連結 / Portaly](https://portaly.cc/charleschen)',
      ja: '以下から Charles にご連絡いただけます：\n\n* メール：[charlestyc0527@gmail.com](mailto:charlestyc0527@gmail.com)\n* [LinkedIn](https://www.linkedin.com/in/charles-chen-809a2043)\n* [GitHub](https://github.com/Kaminoikari)\n* [すべてのリンク / Portaly](https://portaly.cc/charleschen)',
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
      en: 'Charles is based in the **Greater Taipei area**. For work location he\'s open to **Greater Taipei and Hsinchu**, and — where the company can sponsor a visa — **Northeast Asia, the US, Europe, and Oceania**.',
      'zh-TW': 'Charles 目前人在 **雙北**。工作地點方面，他可以接受 **雙北與新竹**，以及（公司能提供簽證的話）**東北亞、美國、歐洲與大洋洲**。',
      ja: 'Charles は **台北都市圏**を拠点としています。勤務地は **台北都市圏・新竹**、そして（会社がビザを提供できる場合）**東北アジア・米国・欧州・オセアニア** が対象です。',
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
      en: 'Charles **prefers remote or hybrid**, but he\'s flexible — on-site works too if that\'s the arrangement.',
      'zh-TW': 'Charles **偏好遠端或 hybrid**，但很有彈性——如果是進辦公室的型態也沒問題。',
      ja: 'Charles は **リモートまたはハイブリッドを希望**しますが、柔軟です——オンサイトの形態でも問題ありません。',
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
      ja: 'Charles は **中国語（北京語）が母語**で、**英語は流暢**(TOEIC **940/990**)です。',
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
      en: "Charles's core strength is being a **Product Builder** — he pairs sharp product strategy (JTBD, RICE, opportunity framing) with the engineering to ship it himself via AI, iterating 5x faster. He also brings proven revenue ownership (85%+ at USPACE), 0→1 launch experience, and full-stack AI engineering depth (his own multi-agent system, production Gemini features).",
      'zh-TW': 'Charles 的核心優勢是身為 **Product Builder**——他把敏銳的產品策略(JTBD、RICE、機會框架)與「親手用 AI 交付」的工程能力結合，迭代快 5 倍。他也具備實證的營收掌控力(USPACE 85%+)、0→1 上線經驗，以及全端 AI 工程深度(自建多代理系統、生產級 Gemini 功能)。',
      ja: 'Charles の核となる強みは **Product Builder** であること——鋭いプロダクト戦略(JTBD、RICE、機会フレーミング)と、AI で自ら出荷するエンジニアリングを併せ持ち、5 倍速で反復します。実証された売上オーナーシップ(USPACE 85%+)、0→1 のローンチ経験、フルスタックの AI エンジニアリング(自作マルチエージェント、本番 Gemini 機能)も備えます。',
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
      en: "That's best answered by Charles himself — self-assessment of growth areas is a conversation he'd want to have directly. You can reach him here:\n\n* Email: [charlestyc0527@gmail.com](mailto:charlestyc0527@gmail.com)\n* [LinkedIn](https://www.linkedin.com/in/charles-chen-809a2043)",
      'zh-TW': '這個問題最好由 Charles 本人來回答——關於成長空間的自我評估，他會想親自談。你可以這樣聯繫他：\n\n* Email: [charlestyc0527@gmail.com](mailto:charlestyc0527@gmail.com)\n* [LinkedIn](https://www.linkedin.com/in/charles-chen-809a2043)',
      ja: 'これは Charles 本人にお尋ねいただくのが一番です——成長領域の自己評価は、直接話したい話題だと思います。こちらからご連絡ください：\n\n* メール： [charlestyc0527@gmail.com](mailto:charlestyc0527@gmail.com)\n* [LinkedIn](https://www.linkedin.com/in/charles-chen-809a2043)',
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
      en: "A standout: at USPACE he owns product strategy driving **85%+ of company revenue** across three lines, and 0→1 launched USPACE for Business. On the engineering side, his **Product Playbook** multi-agent system lifted spec quality-completion to 100% (from 59.1%) at flat token cost. He measures success by outcomes — behavior and revenue moved, not features shipped.",
      'zh-TW': '其中一個亮點：在 USPACE 他主導的產品策略貢獻 **85% 以上的公司營收**（橫跨三條線），並 0→1 推出 USPACE for Business。工程方面，他的 **Product Playbook** 多代理系統把規格品質完成率從 59.1% 提升到 100%，且 token 成本不變。他以結果衡量成功——改變行為與營收，而非交付了多少功能。',
      ja: '際立つ成果：USPACE で 3 つのラインにまたがり **会社売上の 85% 以上** を牽引するプロダクト戦略を統括し、USPACE for Business を 0→1 でローンチ。エンジニアリング面では、**Product Playbook** マルチエージェントが仕様の品質完了率を 59.1% から 100% へ（トークンコスト据え置きで）引き上げました。成功は成果で測ります——機能でなく行動と売上の変化です。',
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
      en: 'Charles compresses the usual PM→engineering handoff: he sets product strategy AND ships the prototype himself with AI, validating ideas in production 5x faster and cheaper. He has owned 85%+ of revenue at USPACE, launched B2B SaaS 0→1, and built production AI systems end to end. For a team that wants validated outcomes fast — not just specs — that combination is rare.',
      'zh-TW': 'Charles 壓縮了傳統「PM → 工程」的交接：他既定產品策略，又親手用 AI 交付原型，讓想法在生產環境中以 5 倍速、更低成本被驗證。他在 USPACE 掌控 85%+ 營收、0→1 推出 B2B SaaS、端到端打造生產級 AI 系統。對一個想要「快速取得已驗證成果、而非只拿到規格」的團隊，這種組合很稀有。',
      ja: 'Charles は従来の「PM→エンジニアリング」の受け渡しを圧縮します：プロダクト戦略を立てつつ、AI で自らプロトタイプを出荷し、本番でアイデアを 5 倍速・低コストで検証します。USPACE で売上の 85%+ を統括、B2B SaaS を 0→1 でローンチ、本番 AI システムを端から端まで構築。「仕様だけでなく検証済みの成果を速く」求めるチームには稀有な組み合わせです。',
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
      en: 'Charles is driven by shipping — he treats launching as the truest form of validation, and is energized by building products that actually change user behavior. He believes the strongest product people are Builders who close the gap between idea and working product themselves. For the deeper personal "why," he would be glad to talk directly.',
      'zh-TW': 'Charles 的驅動力來自「交付」——他把上線視為最真實的驗證，並對打造「真正改變使用者行為」的產品充滿熱情。他相信最強的產品人是親手弭平「想法與可運作產品之間距離」的 Builder。更深層的個人「為什麼」，他很樂意親自聊。',
      ja: 'Charles の原動力は「出荷」です——ローンチを最も真実な検証と捉え、ユーザー行動を実際に変えるプロダクト作りに情熱を注ぎます。最強のプロダクト人材は、アイデアと動くプロダクトの間の距離を自ら埋める Builder だと信じています。より深い個人的な「なぜ」は、直接話すのを歓迎します。',
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
      en: "Timing and availability are best discussed with Charles directly — he can speak to his notice period and start date for your specific role:\n\n* Email: [charlestyc0527@gmail.com](mailto:charlestyc0527@gmail.com)\n* [LinkedIn](https://www.linkedin.com/in/charles-chen-809a2043)",
      'zh-TW': '到職時間與檔期最好直接和 Charles 談——他能針對你的職位說明 notice period 與可開始的日期：\n\n* Email: [charlestyc0527@gmail.com](mailto:charlestyc0527@gmail.com)\n* [LinkedIn](https://www.linkedin.com/in/charles-chen-809a2043)',
      ja: '時期や空き状況は Charles に直接ご相談ください——ご提示の役割に合わせて通知期間や開始日をお伝えできます：\n\n* メール： [charlestyc0527@gmail.com](mailto:charlestyc0527@gmail.com)\n* [LinkedIn](https://www.linkedin.com/in/charles-chen-809a2043)',
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
      en: 'Charles prioritizes by outcomes over outputs: he frames opportunities (JTBD, Opportunity Solution Tree), scores with RICE, and anchors on a North Star metric. Crucially, he validates by building — using AI to ship a working prototype and get real user signal before committing large resources, rather than debating in the abstract.',
      'zh-TW': 'Charles 以「結果重於產出」來排優先級：他用 JTBD、機會解決方案樹(OST)框定機會，用 RICE 評分，並錨定 North Star 指標。關鍵是他用「動手做」來驗證——用 AI 交付可運作原型、在投入大量資源前先取得真實使用者訊號，而不是空泛地辯論。',
      ja: 'Charles は「アウトプットよりアウトカム」で優先順位をつけます：JTBD や機会解決ツリー(OST)で機会を捉え、RICE で採点し、North Star 指標に紐づけます。重要なのは「作って検証する」こと——大きなリソースを投じる前に、AI で動くプロトタイプを出して実ユーザーの反応を得ます。',
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
      en: "For this chatbot specifically: **Qdrant** (hybrid dense+BM25 with server-side RRF, generous free tier after Supabase's 2-project cap), **Voyage voyage-3-large** (SOTA multilingual embeddings for zh/ja/en), and a **two-tier Gemini→Claude** stack (free-tier first, paid fallback) to control cost. Across projects he favors shipping fast with AI-native tooling (Claude Code, Codex) over heavyweight infrastructure.",
      'zh-TW': '以這個 chatbot 為例：**Qdrant**(dense+BM25 混合、伺服器端 RRF，在 Supabase 2 專案上限後選它的慷慨免費額度)、**Voyage voyage-3-large**(中日英多語的 SOTA 向量)、以及**兩層 Gemini→Claude** 堆疊（免費層優先、付費備援）來控制成本。跨專案來看，他偏好用 AI 原生工具(Claude Code、Codex)快速交付，而非笨重的基礎設施。',
      ja: 'このチャットボットの場合：**Qdrant**(dense+BM25 ハイブリッド、サーバーサイド RRF、Supabase の 2 プロジェクト上限後に選んだ寛大な無料枠)、**Voyage voyage-3-large**(zh/ja/en の SOTA 多言語埋め込み)、コスト管理のための**二層 Gemini→Claude**（無料枠優先、有料フォールバック）。プロジェクト全般では、重厚なインフラより AI ネイティブなツール(Claude Code、Codex)での高速出荷を好みます。',
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
      en: '**Product Playbook** is open source under the MIT license. Several of his projects have public repos on GitHub ([github.com/Kaminoikari](https://github.com/Kaminoikari)) — including Product Playbook, House Ops, and Job Ops. Path and Plutus Trade are live demos you can try.',
      'zh-TW': '**Product Playbook** 以 MIT 授權開源。他有數個專案在 GitHub 上有公開 repo([github.com/Kaminoikari](https://github.com/Kaminoikari))——包括 Product Playbook、House Ops 與 Job Ops。Path 和 Plutus Trade 則是可以實際試用的 live demo。',
      ja: '**Product Playbook** は MIT ライセンスで OSS 公開。GitHub([github.com/Kaminoikari](https://github.com/Kaminoikari))に複数の公開リポジトリがあります——Product Playbook、House Ops、Job Ops など。Path と Plutus Trade は実際に試せるライブデモです。',
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
      en: 'Yes — that\'s his core mode. Charles 0→1 launched USPACE for Business (B2B SaaS), and independently built and shipped five full products (Path, Plutus Trade, Product Playbook, House Ops, Job Ops) across React, Node.js, Flutter, and Python using AI tooling. He sets the strategy and ships the working product himself.',
      'zh-TW': '可以——這正是他的核心模式。Charles 0→1 推出了 USPACE for Business(B2B SaaS)，並獨立打造、交付了五個完整產品(Path、Plutus Trade、Product Playbook、House Ops、Job Ops)，橫跨 React、Node.js、Flutter 與 Python，全程用 AI 工具。他既定策略，也親手交付可運作的產品。',
      ja: 'はい——それが彼の核となるモードです。Charles は USPACE for Business(B2B SaaS)を 0→1 でローンチし、React・Node.js・Flutter・Python にまたがる 5 つの完成プロダクト(Path、Plutus Trade、Product Playbook、House Ops、Job Ops)を AI ツールで単独構築・出荷しました。戦略を立て、動くプロダクトも自ら出します。',
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
      en: "Founding-stage conversations are best had with Charles directly — fit, timing, and vision alignment are personal. Given his Product Builder profile (strategy + 0→1 shipping with AI), it's a natural fit to explore. Reach him:\n\n* Email: [charlestyc0527@gmail.com](mailto:charlestyc0527@gmail.com)\n* [LinkedIn](https://www.linkedin.com/in/charles-chen-809a2043)",
      'zh-TW': '創業階段的對話最好直接和 Charles 談——契合度、時機與願景一致與否都很個人。以他 Product Builder 的特質(策略 + 用 AI 做 0→1)來看，這是值得一聊的方向。聯繫他：\n\n* Email: [charlestyc0527@gmail.com](mailto:charlestyc0527@gmail.com)\n* [LinkedIn](https://www.linkedin.com/in/charles-chen-809a2043)',
      ja: '創業フェーズの話は Charles に直接ご相談を——相性・タイミング・ビジョンの一致は個人的なものです。彼の Product Builder の特性(戦略+AI での 0→1 出荷)を踏まえれば、検討する価値のある方向性です。ご連絡先：\n\n* メール： [charlestyc0527@gmail.com](mailto:charlestyc0527@gmail.com)\n* [LinkedIn](https://www.linkedin.com/in/charles-chen-809a2043)',
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
      en: "For opportunities, roles, or collaboration, it's best to reach Charles directly — he can speak to fit and availability himself:\n\n* Email: [charlestyc0527@gmail.com](mailto:charlestyc0527@gmail.com)\n* [LinkedIn](https://www.linkedin.com/in/charles-chen-809a2043)\n* [All links / Portaly](https://portaly.cc/charleschen)",
      'zh-TW': '關於工作機會、職位或合作，最好直接聯繫 Charles 本人，由他親自說明適配與時間：\n\n* Email:[charlestyc0527@gmail.com](mailto:charlestyc0527@gmail.com)\n* [LinkedIn](https://www.linkedin.com/in/charles-chen-809a2043)\n* [所有連結 / Portaly](https://portaly.cc/charleschen)',
      ja: '機会・ポジション・協業については、Charles 本人に直接ご連絡いただくのが確実です（適性や時期は本人がお答えします）:\n\n* メール：[charlestyc0527@gmail.com](mailto:charlestyc0527@gmail.com)\n* [LinkedIn](https://www.linkedin.com/in/charles-chen-809a2043)\n* [すべてのリンク / Portaly](https://portaly.cc/charleschen)',
    },
  },
]
