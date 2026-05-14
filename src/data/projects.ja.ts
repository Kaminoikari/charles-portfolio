// Translation policy mirrors src/i18n/strings/ja.ts:
//   - Product names (Path, Plutus Trade, Product Playbook), tech stack
//     (React, Flutter, Supabase, etc.), framework names (JTBD, RICE, PRD),
//     and CTA markers (TRY IT, EXPLORE, GitHub) stay English.
//   - Descriptive copy, problem/solution/learnings paragraphs, and meta
//     descriptions are in Japanese.
//   - "AI Product Manager", "AI Product Builder", "B2B SaaS", "builder",
//     "consumer platform" stay English by industry convention in the
//     Japanese tech scene.

export interface Project {
  id: string
  title: string
  description: string
  ctaText: string
  ctaUrl: string
  tags: string[]
}

export interface ProjectDetail {
  id: string
  title: string
  subtitle: string
  metaTitle: string
  metaDescription: string
  problem: string[]
  solution: string[]
  techStack: { category: string; items: string }[]
  impact: string[]
  learnings: string[]
  links: { label: string; url: string }[]
  screenshots?: { src: string; alt: string }[]
}

export const projects: Project[] = [
  {
    id: 'path',
    title: 'Path',
    description:
      '「ネットワークが消えても、旅程は蒸発しない。」不安定なネットワーク環境のために設計された PWA。Cache-first + 背景同期アーキテクチャにより、旅程、地図ルート、支出記録は完全にオフラインでも使用可能。1 つの URL で iOS にも Android にもホーム画面追加できます。',
    ctaText: 'TRY IT',
    ctaUrl: 'https://trip-path.vercel.app/',
    tags: ['PWA', 'React', 'IndexedDB'],
  },
  {
    id: 'plutus-trade',
    title: 'Plutus Trade',
    description:
      '「トレーディングデスク 1 卓ぶんの分析戦力を、AI 合成（Synthesis）1 回ぶんに収斂させる」。単一トレーダーのために設計された深掘り分析ツール：月次売上、ファンダメンタルズ、機関投資家フロー、テクニカル構造を Gemini AI がクロスドメインで合成診断し、各推奨を「Instrumented」処理することで長期にわたる勝率と ROI を追跡し、その下層では量的モメンタムモデルが候補プールを絞り込み、AI の意味解釈が確かなデータに支えられるよう保証します。',
    ctaText: 'TRY IT',
    ctaUrl: 'https://plutustrade.vercel.app/',
    tags: ['Flutter', 'FastAPI', 'Gemini AI'],
  },
  {
    id: 'product-playbook',
    title: 'Product Playbook',
    description:
      'AI 駆動のプロダクト企画システム。22 個のフレームワーク、6 つの実行モード、自動 dev handoff で、ひと言のアイデアから完全な spec まで数分で。',
    ctaText: 'EXPLORE',
    ctaUrl: 'https://github.com/Kaminoikari/product-playbook',
    tags: ['Claude Code Skill', 'AI/LLM', 'Product'],
  },
  {
    id: 'house-ops',
    title: 'House Ops',
    description:
      '台湾住宅探索の自動化パイプライン。591 と Facebook の公開賃貸グループを毎日スキャンし、Claude API が自由文の投稿を構造化フィールドへ抽出。5 次元の加重採点で物件を絞り、Claude Code が支払い能力試算、住み替え計画、内見準備をセッション内で処理します。',
    ctaText: 'EXPLORE',
    ctaUrl: 'https://github.com/Kaminoikari/house-ops',
    tags: ['Node.js', 'Agent', 'Automation', 'Claude API'],
  },
  {
    id: 'job-ops',
    title: 'Job Ops',
    description:
      '「もともとあなたに向けられていた武器を、あなた自身のために使う」。自動化された個人向け求職パイプライン。毎日 07:00、104 から新着求人を取得し、Markdown 履歴書に対して採点、RECOMMEND / CAUTIOUS / SKIP の 3 段ダイジェストをメール配信。深い判断（企業の合法性、レベル戦略、面接準備）は 7 つの Claude Code インタラクティブモードが担います。',
    ctaText: 'EXPLORE',
    ctaUrl: 'https://github.com/Kaminoikari/job-ops',
    tags: ['Python', 'launchd', 'CV-aware', 'Automation'],
  },
]

export const projectDetails: ProjectDetail[] = [
  {
    id: 'path',
    title: 'Path — オフラインファースト旅行プランニング PWA',
    subtitle: '「ネットワークが消えても、旅程は蒸発しない。」不安定なネットワーク環境のために設計された Progressive Web App (PWA)。最も心細い瞬間にも、旅人がナビゲーションと情報を手元に保てるように作られています：電波が切れても情報は途切れない（東京の地下鉄の深い駅でも、辺鄙な温泉郷でも、交通・支出・ルートに即アクセス）、ゼロレイテンシ体験（オフラインファースト設計で読み取りは瞬時、変更は自動同期）、クロスプラットフォーム インストール（App Store 不要、1 つの URL で iOS にも Android にもホーム画面追加）。',
    metaTitle: 'Path — オフラインファースト旅行プランニング PWA | Charles Chen プロダクト事例',
    metaDescription:
      '不安定なネットワーク環境のために設計された Progressive Web App。React、TypeScript、Supabase、IndexedDB による Cache-first + 背景同期アーキテクチャで、旅程、交通、支出記録がオフラインでも完全に動作します。AI プロダクトマネージャー Charles Chen の旅行プロダクト事例。',
    problem: [
      '市場の主要な旅程アプリ（Wanderlog、Tripit など）は、ユーザーが「常時オンライン」であることを前提としています。しかし海外旅行では、これは往々にして贅沢な仮定です。',
      '電波のブラックホール：空港の WiFi は快適でも、地下鉄のホーム、地下街、田舎の温泉に入った途端、旅程はしばしば真っ白になります。',
      '接続の不安定さ：海外のモバイルデータは高価かつ不安定です。Pocket WiFi の電池が切れたり、eSIM が肝心な瞬間に途切れたりすれば、グループ全員の旅程と交通案内は止まります。',
      'ツールの矛盾：ネットワークがないと動かないツールは、最悪のタイミング（電波がない、急いで道を探したい）でこそ機能しません。',
    ],
    solution: [
      'Path はウェブをアプリ化するだけにとどまらず、「ネットワークなしでも走る Web アプリ」を基盤から再定義します。',
      'アーキテクチャ戦略としての PWA：PWA をネイティブより優先したのは、クロスプラットフォームのインストール問題とオフライン動作を一度に解決できるためです。Service Worker により、ネイティブアプリと同等の権限が手に入り、「プラットフォーム税」や煩雑な App Store 審査を払う必要がありません。',
      'Cache-first 戦略：読み取りでは全てのリクエストをローカルの IndexedDB に優先的に向け、「即座のレンダリング」を実現。最新データは裏で Supabase と静かに同期します。書き込みは「楽観的 UI（Optimistic UI）」を採用し、ユーザーがタップした瞬間に UI が反応、編集リクエストはまず Sync Queue に並び、接続復旧後に自動的にリプレイされます。',
      '日台旅行者向けの特化設計：Google Maps の場所とルートを統合し、日本と台湾でよく利用される公共交通機関に対して特化したラベル（車両アイコン、徒歩時間、路線色）を提供。さらに多通貨の支出管理、写真と書類の添付、よく使う旅程テンプレートのワンタップ適用機能も備えています。',
      'セキュアなデータ分離：Supabase の Row Level Security (RLS) によって、マルチユーザー環境下のデータアクセスを安全に分離しています。',
    ],
    techStack: [
      { category: 'フロントエンドフレームワーク', items: 'React 18, TypeScript, Vite, TailwindCSS' },
      { category: 'オフライン技術', items: 'IndexedDB (via idb), Service Worker, PWA Manifest' },
      { category: '状態管理', items: 'TanStack Query（サーバー同期）、@dnd-kit（旅程のドラッグ＆ドロップ）' },
      { category: 'バックエンドサービス', items: 'Supabase (PostgreSQL, Auth, Storage, RLS)' },
      { category: '地図統合', items: 'Google Maps API (Places, Directions, Geocoding)' },
      { category: 'デプロイ環境', items: 'Vercel' },
    ],
    impact: [
      '100% オフライン稼働可：旅程、地図ルート、支出記録は完全にオフラインでも変わらず動作します。',
      '極めて滑らかな UI：Cache-first 機構により Loading Spinner を全て排除し、書き込み操作のデータが失われることはありません。',
      'シーン特化の設計：日台旅行のペインポイントを的確に捉え、車両の色やアイコンは現実世界の案内サインに直接対応します。',
      '極めて低いメンテナンスコスト：単一の Codebase でクロスプラットフォームのインストールを実現し、ネイティブアプリ開発と複数プラットフォームへの配信コストを節約します。',
    ],
    learnings: [
      'PWA は「荷重を担う」決定でした。開発初期の段階で、ネイティブアプリの道を選べば、開発リソースが二つの Codebase と審査プロセスに薄まることに気づきました。一方で「ネットワークがなくなったらどうするか」という核心テーマは、PWA の Service Worker + IndexedDB という体系下で、より優雅で、よりネイティブに近いウェブ的な解を導き出してくれました。',
      '同期ロジックの現実的なチャレンジ：「Cache-first + 背景同期」は理論上はエレガントでも、実装上は地味な作業の積み重ねです。最大の難所は「コンフリクト」の処理で、たとえば 2 台のスマホがオフラインで同じ旅程を編集してから同期するケース。最終的に Last-write-wins + Timestamp によるマージ戦略を選びました。1 人旅やたまにマルチデバイスを使うシナリオでは、これがパフォーマンスと開発コストのバランスを最も取れる実装です。',
      '精密なコストコントロール：Google Maps API のコストはリクエスト量に比例するため、積極的なキャッシュ戦略を採りました：場所は永続キャッシュ、ルートは 24 時間キャッシュ。これは API 費用を極めて低い水準に抑え、さらに面白い副産物も生みました：節約のために命中したキャッシュは、そのまま「ネットワークなしでも閲覧できる」旅程のパスでもあるのです。',
    ],
    links: [
      { label: 'Try Path', url: 'https://trip-path.vercel.app/' },
    ],
    screenshots: [
      {
        src: '/assets/path-demo.mp4',
        alt: 'Path の 30 秒デモ動画は 9 シーンを巡ります：マーケティング hero、機能グリッド、ダッシュボード KPI 概要、行程カード一覧、ドラッグで日程を並べ替える Day editor、アジア路線マップ、費用詳細、AI レシート OCR スキャナ、オフラインモード banner が完全にロードされた dashboard に重なり、最後に Path のブランドフレームで締める。',
      },
    ],
  },
  {
    id: 'plutus-trade',
    title: 'Plutus Trade — 個人用台湾株 AI 意思決定支援ツール',
    subtitle: '「トレーディングデスク 1 卓ぶんの分析戦力を、AI 合成（Synthesis）1 回ぶんに収斂させる」。単一トレーダーのために設計された深掘り分析ツール。データを表示するだけでなく、「ファンダメンタルズ + 機関投資家フロー + テクニカル」の従来は数時間かかる研究サイクルを、論理的な推論を伴う 1 回の意思決定提案に圧縮します：全次元の合成（月次売上、ファンダメンタルズ、機関投資家フロー、テクニカル構造を Gemini AI がクロスドメインで診断）、監査可能な意思決定（各 AI 推奨は「Instrumented」処理され、長期の勝率と ROI を追跡）、量的下層アーキテクチャ（量的モメンタムモデルで候補プールを絞り込み、AI の意味解釈が確かなデータに支えられるよう保証）。',
    metaTitle: 'Plutus Trade — 個人用台湾株 AI 意思決定支援ツール | 事例研究',
    metaDescription:
      'アクティブな台湾株リサーチ実務者向けの単一ユーザー意思決定支援ツール。Gemini 駆動のクロスドメイン synthesis、ガイド付きスクリーニング、instrument 済みの予測トラッキング層。台湾の AI Product Manager Charles Chen による generative AI 事例研究。',
    problem: [
      'アクティブに台湾株を運用する実務者にとって、もっとも高くつくコストは資金ではなく、リサーチの時間です。',
      '分析量の爆発：銘柄ごとに月次売上 YoY/MoM、四半期 EPS／粗利、機関投資家の売買フロー、K 線構造を処理する必要があります。自選銘柄が 30〜50 になると、その作業量はフルタイムでない実務者の時間予算を直接突き破ります。',
      '市場ツールの二極化：既存のチャートアプリは「データを並べる」だけで解釈しない；投資助言系プロダクトは直接「銘柄」を渡してくれるが透明性はない。',
      '信頼の空白：ドメイン素養を備え、AI で分析を加速したいが「AI のロジックを自分で監査する」ことで長期的な信頼を築きたい、そんな中堅トレーダーに応えるツールが市場には存在しません。',
    ],
    solution: [
      'Plutus Trade はあなた個人のデジタル・アナリストとして自らを位置づけ、定性的な投資基準を AI が実行可能な指令契約に翻訳します。',
      'AI クロスドメイン診断：Gemini 2.5 Flash で watchlist を多次元合成分析します。システムは明確な推論を伴う BUY/SELL/HOLD 診断を返し、出力を「プロフェッショナルな分析」のレベルにフレーミング、最終的な意思決定権はユーザーに残します。',
      'ガイド付き選股（Guided Discovery）：3 ステップの投資家プロファイル（リスク許容度、保有期間、セクター選好）により、長大な市場スキャンを 1 回の質の高いインタラクションに収斂させ、精選リストと選定理由を直接生成します。',
      'ハイブリッド量化レイヤー（Hybrid Quant Layer）：システムは意味解釈だけに頼りません。毎日 14:00 に量的モデルを先に走らせ、市場全体の 8 大モメンタム特徴量とパーセンタイルランクを計算し、データによるランキングで AI に「下地を敷く」ことで、LLM をもっとも得意な意味解釈に専念させます。',
      '完全な監査メカニズム：すべての予測層は「Log entry context」で計装記録されます。推奨が満期決済されると、システムは構造化された意思決定品質マトリクス（実 ROI、勝率）を生成。これによりユーザーは市場サイクルをまたいで、各局面でのシステムの挙動を振り返ることができます。',
    ],
    techStack: [
      { category: 'Frontend', items: 'Flutter 3.41+（クロスプラットフォーム対応、Vercel デプロイ）' },
      { category: 'Backend', items: 'FastAPI（Python 3.11）、Pydantic v2、APScheduler' },
      { category: 'AI Engine', items: 'Google Gemini 2.5 Flash（Narrative Synthesis 担当）' },
      { category: 'Quant Engine', items: '自製モメンタム Scoring 層（8 特徴量加重 + Redis キャッシュ）' },
      { category: 'Data Sources', items: '3 層 Fallback チェーン（FinMind → Yahoo Finance → TWSE OpenAPI）' },
      { category: 'Persistence', items: 'Supabase（PostgreSQL）、Redis（Upstash）をザラ場キャッシュに' },
      { category: 'Deployment', items: 'Fly.io（バックエンド nrt region）+ Vercel（フロントエンド）' },
    ],
    impact: [
      '全機能カバー：単一インターフェースに市場データ、AI 診断、ガイド付き選股、予測トラッキングなど 8 モジュールを統合',
      'データ耐性の保証：3 層データソース Fallback と 7 日 Stale-cache のセーフティネットにより、上流サービスが劣化したときもツールは分析能力を保ちます',
      '監査可能な信頼：各 AI 呼び出しは追跡可能かつ決済可能で、金融の意思決定で AI によくある「ブラックボックス」問題を解決します',
      '相場感知キャッシュ：取引時間帯に応じて TTL を自動調整（ザラ場 5 分、週末はロック）、API コストを抑えつつリアルタイム性を維持',
    ],
    learnings: [
      '「Prompt Contract の設計が、AI による意思決定の品質を決める。」開発を進めるなかで、「モデルが弱い」という不満の多くは、上流の構造化された制約で解決できると気づきました。JSON Schema で出力フォーマットを制約し、Few-shot anchors を導入することで、Gemini のハルシネーション率を約 60% 削減できました。',
      'プロダクト設計の境界感：金融プロダクトでは、「分析」と「助言」の線をインターフェース層で強制的に切り分ける必要があります。プロダクトの仕事はモデルのすべての回答に無制限に応えることではなく、それを免責事項つきのプロフェッショナルな分析としてフレーミングすることです。',
      '「一人のために設計する」ことの戦略的優位：受け手を「単一のプロフェッショナルな素養を備えたユーザー」に絞り込むのは意図的なプロダクト戦略です。これによって新人向けの冗長な設計をすべて取り除き、デザインのサーフェスをまるごと、分析の深さとシステムの監査可能性の追求に振り切ることができました。意思決定支援ツールの世界では、「信頼性」と「透明性」こそが最優先の価値提案です。',
    ],
    links: [
      { label: 'Try Plutus Trade', url: 'https://plutustrade.vercel.app/' },
    ],
    screenshots: [
      {
        src: '/assets/plutus-watchlist.png',
        alt: 'Plutus Trade のウォッチリスト画面。各カードに株価、前日比、当日の値動きが表示されます。銘柄名とコードはデモ用にぼかし処理を施しています。',
      },
      {
        src: '/assets/plutus-ai-winrate.png',
        alt: 'AI 選股勝率：238 件の決済済み推奨で勝率 64%、平均 ROI +58.96%、ROI の推移分布、月次勝率の内訳。',
      },
      {
        src: '/assets/plutus-holdings-winrate.png',
        alt: 'Plutus Trade のポートフォリオ勝率分析。各銘柄の損益と未実現損益が表示されます。銘柄名とコードはデモ用にぼかし処理を施しています。',
      },
    ],
  },
  {
    id: 'product-playbook',
    title: 'Product Playbook — spec を生成する AI Agent',
    subtitle: 'LLM orchestration で、ひと言のプロダクトアイデアを完全な spec ドキュメントに変える AI agent プロダクト。',
    metaTitle: 'Product Playbook — AI Agent spec ジェネレーター | LLM プロダクト事例',
    metaDescription:
      'Claude Code 向けに作った AI agent プロダクト。22 個のプロダクトフレームワークと自動 dev handoff。台湾の AI Product Manager Charles Chen による LLM プロダクト事例。',
    problem: [
      '優れたプロダクト spec を書くには数日かかります。良い PRD はユーザーリサーチ、競合分析、技術制約、ビジネス目標を 1 つの一貫したドキュメントに統合する必要があります。多くの PM はこれをスキップ（不明瞭なまま開発開始）するか、時間をかけすぎる（開発を遅らせる）かのどちらかです。',
      '既存の AI ライティングツール（ChatGPT、Notion AI）はテキストを生成できますが、プロダクトフレームワークを理解しません。JTBD 分析を適用したり、RICE スコア付き backlog を作ったり、user persona を機能要件にマッピングしたりはできず、汎用的な段落を生成するだけです。',
    ],
    solution: [
      'Claude.ai Custom Skill、Claude Code Plugin、Claude Code Skill の 3 つの配布チャネルにまたがる AI agent を構築。複数のプロダクトフレームワークを 1 つの spec 生成 pipeline にオーケストレーションします。ユーザーがひと言でプロダクトアイデアを記述し、実行モードを選ぶと、agent が完全な spec ドキュメントを生成します。',
      '重要なアーキテクチャ判断は、22 個の確立されたプロダクトフレームワーク（JTBD、Positioning、PR-FAQ、Pre-mortem、OST、RICE、PRD など）を構造化 prompt として使うこと。各フレームワークが、Discovery、Define、Develop、Deliver の 4 フェーズを通して、シニア PM の実際の思考パターンに AI の出力を制約します。Free-form 生成はこのアプローチが置き換える対象です。',
      '6 つの実行モード（Quick、Full、Revision、Custom、Build、Feature Expansion）を設計し、PM が自分のプロダクト段階に合わせてツールの深さを選べるように。機能実験には 50 ページの spec は不要ですが、新規プロダクトのリリースには完全な dev handoff が必要です。',
      '上流の判断が変わったときに下流ドキュメントを自動更新する change propagation engine を構築。さらに 3 層 PDF パース（pymupdf テキスト抽出 → Claude Vision セマンティック → Tesseract OCR フォールバック）で、既存の PDF/DOCX/PPTX のリサーチ資料をそのままアップロードできます。',
      '自動 dev handoff が CLAUDE.md、TASKS.md、TICKETS.md を生成し、プロダクト要件を受入条件付きの技術タスクに翻訳して、PM → エンジニア間のコミュニケーションギャップを縮めます。',
    ],
    techStack: [
      { category: 'Platform', items: 'Claude.ai Custom Skill, Claude Code Plugin, Claude Code Skill' },
      { category: 'AI', items: 'Claude (Anthropic) で LLM orchestration, Claude Vision (PDF セマンティック解析)' },
      { category: 'Frameworks', items: '22 個のプロダクトフレームワーク（JTBD、Positioning、PR-FAQ、Pre-mortem、OST、RICE、PRD など）' },
      { category: 'Document Processing', items: 'Playwright (Chromium PDF rendering), Pandoc (フォーマット変換), pymupdf (テキスト抽出), Tesseract OCR, pikepdf (bookmarks)' },
      { category: 'Tooling', items: 'Node.js (npm), Bash, Git, Markdown (フレームワーク定義)' },
      { category: 'Distribution', items: 'npm package, GitHub (MIT license)' },
      { category: 'Internationalization', items: '6 言語（英語、繁体字／簡体字中国語、日本語、スペイン語、韓国語）' },
    ],
    impact: [
      'PM とエンジニアの両方が使う open source AI agent プロダクト',
      'アイデアから完全な spec まで、数日 → 数分に短縮',
      '22 個のプロダクトフレームワークを再利用可能な LLM prompt に体系化（Discovery → Deliver 全フェーズ）',
      '6 つの実行モード（Quick / Full / Revision / Custom / Build / Feature Expansion）が異なるプロダクト開発段階に対応',
      'skill を使わない baseline Claude 応答に対して、品質 +69% 向上',
      'マルチチャネル配布（Claude.ai、Claude Code Plugin、Claude Code Skill）でユーザーの既存ワークフロー内で出会う',
    ],
    learnings: [
      'LLM orchestration は本質的にプロダクトデザインの課題で、エンジニアリングはその実装層に位置します。フレームワークの実行順序が大事で、Persona を JTBD の前に走らせると、ユーザーコンテキストが job の特定を導くため、出力品質が上がります。pipeline の順序最適化にかなりの時間を使いました。',
      'Skill ベースの配布（Claude Code エコシステム）は強力なチャネルでした。ユーザーは既存のワークフローの中でそのままツールに触れられ、新しいプラットフォームの採用は不要です。',
      'AI Product Manager として AI agent を作って一番の気付き：プロダクトの価値はフレームワーク層に住んでいます。AI は配信メカニズムで、22 個のプロダクトフレームワークこそが本当の知的財産です。LLM API は誰でも呼べる、差別化は何を聞くかを知っているかどうかです。',
    ],
    links: [
      { label: 'GitHub', url: 'https://github.com/Kaminoikari/product-playbook' },
    ],
    screenshots: [
      {
        src: '/assets/product-playbook-demo-ja.mp4',
        alt: 'Product Playbook Build Mode のデモ動画：プロダクト要件を入力すると、AI が既存コードベースをスキャンし、技術スタックを自動検出。PM フレームワークを適用して課題を明確化し、ソリューション設計へと直接進みます。',
      },
    ],
  },
  {
    id: 'house-ops',
    title: 'House Ops — 台湾住宅探索の自動化と AI 意思決定 Pipeline',
    subtitle: 'macOS launchd が毎日 09:00 に Node.js パイプラインを起動：591 と Facebook の公開賃貸グループをスキャンし、Claude API（Haiku 4.5）が自由文の投稿を構造化フィールドへ抽出、5 つの加重次元で 0–5 採点して HTML サマリーを送信。Claude の意思決定レイヤーがセッション内で支払い能力試算、住み替え計画、物件比較、内見当日のチェックリストを担当。',
    metaTitle: 'House Ops — 台湾住宅探索の自動化と AI 意思決定 Pipeline | Charles Chen 個人プロジェクト',
    metaDescription:
      'Node.js による自動化パイプライン。毎日 591 と Facebook の公開賃貸グループをスキャンし、Claude API で自由文の投稿を構造化フィールドへ抽出、台湾の物件を価格・スペース・立地・状態・リスクの 5 次元で加重採点し、HTML メールでお届けします。AI Product Manager Charles Chen の個人自動化事例研究。',
    problem: [
      '台湾の物件探しは 591、Facebook 公開グループ、長い裾野のコミュニティ掲示板に分散しており、効率の悪い「スキャン → 評価 → 棄却」ループに陥りがちです。物件は極めて流動的でノイズも多く、再投稿・価格変動・プラットフォーム横断のデータ断絶、そしてフィールドフィルタでは読めない自由文のソーシャル投稿が含まれます。ユーザーは数十のタブを同時に開いて MRT 距離、学区、間取り、エージェントの評判を手作業で照合する必要があり、時間に余裕のない会社員にとって、意思決定コストの高さとノイズ量で優良物件が埋もれがちです。既存プラットフォームは基本的なフィールド絞り込みしか提供せず、物件のコンテキスト（家賃の地区中央値、面積比、賃貸リスク）を総合的に診断する機能を欠いており、ユーザーは毎日、低生産性の情報合成を繰り返さざるを得ません。',
    ],
    solution: [
      '本プロジェクトは Node.js（ESM）ベースの自動化パイプラインを構築し、macOS launchd で駆動しています。毎日 09:00 に 2 つのスキャンが並列で走ります：agent-browser が指定の 591 検索エリアにアクセスし、専用の Chrome インスタンス（別の launchd plist で KeepAlive 起動、プロファイルは普段使いの Chrome から隔離）が Chrome DevTools Protocol の `Input.synthesizeScrollGesture` で合成タッチジェスチャを生成し、Facebook anti-bot の lazy-load を回避して公開賃貸グループの最新投稿を取得します。FB の自由文の投稿は Claude API（Haiku 4.5）に渡されて `{price_num, address, district, size, layout, contact, confidence}` の構造化フィールドへ抽出され、591 物件と統合された評価キューに入ります。各物件は 5 次元のヒューリスティック採点（価格・スペース・立地・状態・リスク）を通り、賃貸族・初購族・住み替え族の 3 つのシナリオで加重ロジックを切り替えます。≥ 4.0 点の物件を優先推薦としてフラグ立てし、Nodemailer で並べ替えとフィルタが可能な視覚化 HTML サマリーとして配信します。Claude Code のインタラクティブレイヤーがセッション内の意思決定を担当：`affordability`（初購族の試算）、`upgrade plan`（住み替えの売買タイミングと資金ギャップ分析）、`compare 001, 003`（並列比較）、`prepare visit for 001`（内見当日のチェックリストと交渉戦略）。パイプラインがデータファネルを担い、AI が複雑なトレードオフ判断を担います。',
    ],
    techStack: [
      { category: 'Runtime', items: 'Node.js（ESM, .mjs）' },
      { category: 'Scraping', items: 'agent-browser（591）+ Chrome DevTools Protocol（FB グループ、Input.synthesizeScrollGesture で anti-bot 回避）' },
      { category: 'LLM Extraction', items: 'Claude API（Haiku 4.5）、自由文の投稿 → 構造化フィールド' },
      { category: 'Email', items: 'Nodemailer + Gmail SMTP（並べ替え / フィルタ可能な HTML サマリー）' },
      { category: 'Scheduling', items: 'macOS launchd（daily run + 専用 Chrome KeepAlive インスタンス）' },
      { category: 'Persistence', items: 'JSON Cache、TSV スキャン履歴（自動）、Markdown Tracker（Claude Code セッションで対話的に書き込み）' },
      { category: 'Interactive Layer', items: 'Claude Code（Affordability、Upgrade Plan、Compare、Prepare Visit）' },
      { category: 'Sources', items: '591.com.tw（賃貸 / 購入）+ Facebook 公開賃貸グループ' },
    ],
    impact: [
      'Multi-source ingestion：CDP の合成ジェスチャで Facebook anti-bot の lazy-load を回避し、Claude API による自由文投稿の構造化抽出と組み合わせて、591 とコミュニティの 2 つの供給ルートを単一の評価キューに収束。',
      'Scheduled scanning：毎日 09:00 にパイプラインを自動起動し、永続キャッシュと組み合わせて精密な重複排除を実現。',
      'Five-dimension scoring：賃貸族・初購族・住み替え族でペルソナ別に重みを動的調整する定量スコアリングモデル（賃貸は 30/20/25/15/10 など）を実装し、感覚的な印象をデータ指標に変換。',
      'Daily email digest：591 と FB の物件を別セクションで構成した HTML レポートを定刻配信し、値下げ追跡・削除エントリ・行政区分集計を含めて朝の意思決定体験を最適化。',
      'Interactive Claude modes：初購族の支払い能力試算、住み替えの財務計画、物件の深い比較をカバーする in-session AI コンサルティングを提供し、ラストマイルの意思決定品質を強化。',
    ],
    learnings: [
      '個人自動化のシナリオでは、launchd は cron よりエレガントな選択肢です。ユーザー環境を完全に継承し、Keychain 認証を処理し、システム起動設定にも対応するため、パイプラインの運用上限が大きく引き上がります。',
      'フィルタリングロジックでは、ハードフィルターから多次元加重スコアリングへ移行したことが鍵となるブレイクスルーでした。ハードフィルターは単一指標で境界候補を切り捨てがちですが、加重モデルなら次元間でのトレードオフを許容し、人間の意思決定をより正確に模倣できます。配信メディアを Email にしたのは行動科学に基づく理解からです：朝の高頻度意思決定時間帯では、Push 配信のリーチとモバイル可読性が、Dashboard のような Pull 型インターフェースを大きく上回り、注意がすでにある場所にデータを能動的に届けられます。',
      'FB のページング攻略では、純 JS scroll、agent-browser scroll、keyboard PageDown、CDP `Input.dispatchMouseEvent` を順に試しましたが、いずれも anti-bot 検出に引っかかり feed が paginate されませんでした。唯一機能したのは CDP `Input.synthesizeScrollGesture` で、Facebook がこれを実機トラックパッドのスクロールとして扱うためです。抽出側では、自由文のソーシャル投稿を LLM に渡す方が（投稿あたり約 USD 0.001）、台湾賃貸特有の表現（「月租押金兩個月含管理費可議」など）に対するルールベースパーサのメンテナンス工数を考えると、長期的に堅牢かつ低コストです。',
    ],
    links: [
      { label: 'GitHub', url: 'https://github.com/Kaminoikari/house-ops' },
    ],
    screenshots: [
      {
        src: '/assets/house-ops-daily-report.png',
        alt: 'House Ops の日次メールサマリー：トップのサマリーブロック、新着物件テーブル、値下げと削除エントリ、行政区別集計。',
      },
      {
        src: '/assets/house-ops-listing-report.png',
        alt: '単一物件の 5 次元評価レポート：価格妥当性、スペースと間取り、周辺環境、物件状態、リスクの 5 項目スコアと、0–5 加重合成。',
      },
    ],
  },
  {
    id: 'job-ops',
    title: 'Job Ops — 応募者視点の個人版 ATS',
    subtitle: '「もともとあなたに向けられていた武器を、あなた自身のために使う。」求職プロセスにおける情報の非対称性を解消するために作った、自動化された個人向け求職パイプライン（Python Pipeline）。企業が候補者をスクリーニングするための「Applicant Tracking System（ATS）」のロジックを反転させ、毎日 07:00 に macOS launchd で起動して 104 から新着求人を取得し、あなたの Markdown 履歴書に対して精密に採点。7 つの Claude Code インタラクティブモードが報酬調査から面接準備まで深い戦略を提供します。',
    metaTitle: 'Job Ops — 応募者視点の個人版 ATS | Charles Chen 個人プロジェクト',
    metaDescription: '自動化された個人向け Python パイプライン：毎朝 07:00 に ATS ロジックを反転させ、104 から新着求人を取得、Markdown 履歴書と個人ウェイトに照らして採点、3 段ダイジェストをメール配信。企業の合法性、レベル戦略、報酬交渉、面接準備を担う 7 つの Claude Code インタラクティブモードと組み合わせ。AI プロダクトマネージャー Charles Chen の個人求職 OS。',
    problem: [
      '採用市場では、企業側が強力な ATS を持ち、毎日自動的に何百人もの候補者をスクリーニング・ランク付け・淘汰しています。応募者側には対応するツールがなく、効率の悪いループに陥らざるを得ません。',
      '目視スクリーニングの限界：30 〜 50 件の対象求人を同時に追跡すると、給与、勤務地、規模、リモート方針といった複数の変数を脳内でバランスさせるのは難しく、8 件目あたりで疲弊し、最終的にはプラットフォームの「おすすめ順序」を受け入れることになります。',
      'フィルタリング条件が硬すぎる：既存のプラットフォームは給与下限や勤務地のようなハード制約しか表現できず、「成長性 > 報酬 > 通勤」のような加重選好を表現できません。',
      '動的な調整余地がない：求職フェーズ（前期の海撒き vs. 後期のクロージング）に応じて評価ウェイトを切り替えることができず、応募者は自ら低効率な「マッチングエンジン」を担うしかありません。',
    ],
    solution: [
      'Job Ops は HR が候補者に対して使う構造化された採点プロセスを反転させ、求人側を選別される対象に置きます。',
      '自動採点ループ：毎日 07:00 に macOS launchd が起動。104 から取得した求人を CV-aware evaluator に流し込み、evaluator はあなたの Markdown 履歴書を読み、YAML で定義された「候補者アーキタイプ」と照合し、求人を 1 項目ずつ採点します。',
      '2 種類のレポート形式：日報は 07:30 までに届きます。スマホで朝 Gmail から読める HTML と、Obsidian に同期される Markdown 版があり、後者は月末の振り返り用です。',
      'プログラム可能な価値観：採点ウェイト（報酬、リモート、成長性など）は完全に YAML 設定ファイルに外出ししています。求職戦略の切り替えはコード 1 行の編集で済みます。さらに、その YAML を Git で管理することにより、各コミットがあなたの優先順位の変化を記録し、求職活動全体で最も信頼できる軌跡となります。',
      '人間と機械の分業：パイプラインはルールベースで大量に処理する仕事（スクレイピング、重複排除、採点、送信）を担当し、Claude Code インタラクティブ層は会話によって深まる判断作業（企業の合法性、レベル戦略（IC vs マネジメント）、報酬交渉、面接の対位）を担当します。',
    ],
    techStack: [
      { category: 'ランタイム', items: 'Python 3.11+ (asyncio)' },
      { category: 'スクレイピング', items: 'httpx（104 API 連携、UA ローテーション、レート制限）' },
      { category: 'CV 取り込み', items: 'cv_reader が Markdown 履歴書を構造化シグナルへ解析' },
      { category: 'スコアリングエンジン', items: '多次元加重スコアリング、RECOMMEND / CAUTIOUS / SKIP の 3 段で出力' },
      { category: '設定', items: 'YAML（検索条件と個人の優先順位ウェイト）' },
      { category: '通知', items: 'Gmail SMTP（inline-styled HTML と Markdown 双子版を配信）' },
      { category: 'スケジューリング', items: 'macOS launchd（com.job-ops.daily）' },
      { category: '永続化', items: 'TSV scan-history（求人ライフサイクル、価格変動、再投稿の検出を追跡）' },
      { category: 'インタラクティブ層', items: '7 つの専門 Claude Code モード（interview-prep、comp-research など）を統合' },
      { category: 'テスト', items: 'pytest、pytest-asyncio' },
    ],
    impact: [
      '情報を高効率で絞り込む：毎日 30 〜 50 件の生求人を、朝食の時間に読み切れる 3 段ダイジェストへと凝縮します。',
      '戦略の柔軟な切り替え：config の編集だけでパイプラインを「広く撒くモード」から「精密に詰めるモード」へ切り替えられ、ロジックコードの変更は不要です。',
      '深い意思決定の支援：7 つの AI インタラクティブモードが情報の死角を埋めます（フォーラム由来のソースを用いた企業の合法性チェック、IC とマネジメント職の報酬の駆け引きなど）。',
      'ノイズの最小化：TSV トラッキングにより、求人の更新内容は同一行上に diff 注釈として表示され、再投稿が 3 行のノイズに膨らむこともなく、情報の純度が保たれます。',
    ],
    learnings: [
      'エンジニアリングのピースは骨格にすぎず、本当に核心的な意思決定は「このルーブリックを誰に向けるか」です。このプロジェクトの価値は、求職市場の非対称性を打破することにあります：HR は毎日自動化ツールで候補者を測りますが、私はそのルーブリックを反転させて求人を測ることを選びました。これは効率を高めるだけにとどまらず、フィルタリングの主導権を取り戻すことにつながります。',
      'さらに、「ウェイトとロジックの分離」という設計は、想定外のリターンをもたらしました。YAML と Git が結びつくことで、各コミットが「個人の優先順位の移動」を示すタイムスタンプとなり、私の求職プロセスは断片的なレポートの集積から、再現可能な時系列の物語へと姿を変えました。',
      '最後に、この「パイプライン + インタラクティブモード」の二層アーキテクチャは、非常に高い汎用性を見せました。決定論的な仕事（スクレイピング、ランキング）はコードに任せ、曖昧な判断（戦略、交渉）は AI との対話に任せる。このデザインパターンは、私の他の自動化プロジェクト（house-ops など）でも同様に成立しています。',
    ],
    links: [
      { label: 'GitHub（private repo）', url: 'https://github.com/Kaminoikari/job-ops' },
    ],
  },
]
