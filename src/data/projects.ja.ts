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
  description: string | string[]
  ctaText: string
  ctaUrl: string
  tags: string[]
}

export interface ProjectDetail {
  id: string
  title: string
  subtitle: string
  features?: { label: string; description: string }[]
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
    description: [
      '「ネットワークが消えても、旅程は蒸発しない。」',
      '不安定なネットワーク環境のために設計された PWA。Cache-first + 背景同期アーキテクチャにより、旅程、地図ルート、支出記録は完全にオフラインでも使用可能。1 つの URL で iOS にも Android にもホーム画面追加できます。',
    ],
    ctaText: 'TRY IT',
    ctaUrl: 'https://trip-path.vercel.app/',
    tags: ['PWA', 'React', 'IndexedDB'],
  },
  {
    id: 'plutus-trade',
    title: 'Plutus Trade',
    description: [
      '「トレーディングデスク 1 卓ぶんの分析戦力を、AI 合成（Synthesis）1 回ぶんに収斂させる」。',
      '単一トレーダーのために設計された深掘り分析ツール：月次売上、ファンダメンタルズ、機関投資家フロー、テクニカル構造を Gemini AI がクロスドメインで合成診断し、各推奨を「Instrumented」処理することで長期にわたる勝率と ROI を追跡し、その下層では量的モメンタムモデルが候補プールを絞り込み、AI の意味解釈が確かなデータに支えられるよう保証します。',
    ],
    ctaText: 'TRY IT',
    ctaUrl: 'https://plutustrade.vercel.app/',
    tags: ['Flutter', 'FastAPI', 'Gemini AI'],
  },
  {
    id: 'product-playbook',
    title: 'Product Playbook',
    description: [
      '「AI にシニア PM の頭脳を与え、ひらめきを実装可能なスペックへ変換する。」',
      'LLM オーケストレーションを基盤とする Multi-Agent System。22 種のプロダクトフレームワークと 3 名の専門家 Sub-agent が独立分業し、ディスカバリー、戦略批判、リスク予測を深掘りする。',
      'Claude エコシステムのワークフローに完全に組み込まれ、受け入れ基準（AC）付きの開発ドキュメントを自動生成し、シームレスな技術引き継ぎ（Dev Handoff）を実現する。',
    ],
    ctaText: 'EXPLORE',
    ctaUrl: 'https://github.com/Kaminoikari/product-playbook',
    tags: ['Multi-Agent', 'Claude Code', 'AI/LLM'],
  },
  {
    id: 'house-ops',
    title: 'House Ops',
    description: [
      '「不動産情報の大海原で、優良物件のほうから会いに来てもらう」。',
      'Node.js と AI による個人向け不動産意思決定パイプライン：毎日 09:00 に 591 と Facebook 賃貸グループを自動スキャンし、Claude API が混沌とした投稿を構造化データへ抽出、5 次元の加重採点で感覚的な内見直感を科学的指標へ変換、Claude Code と統合して初購試算から住み替え計画までの深いアドバイザリーモードを提供します。',
    ],
    ctaText: 'EXPLORE',
    ctaUrl: 'https://github.com/Kaminoikari/house-ops',
    tags: ['Node.js', 'Agent', 'Automation', 'Claude API'],
  },
  {
    id: 'job-ops',
    title: 'Job Ops',
    description: [
      '「もともとあなたに向けられていた武器を、あなた自身のために使う」。',
      '自動化された個人向け求職パイプライン。毎日 07:00、104 から新着求人を取得し、Markdown 履歴書に対して採点、RECOMMEND / CAUTIOUS / SKIP の 3 段ダイジェストをメール配信。深い判断（企業の合法性、レベル戦略、面接準備）は 7 つの Claude Code インタラクティブモードが担います。',
    ],
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
    title: 'Product Playbook — spec を生成する Multi-Agent System',
    subtitle: '「AI にシニア PM の頭脳を与え、ひらめきを実装可能なスペックへ変換する。」本システムは「アイデア」から「開発タスク」までの巨大なギャップを縮めるために設計され、4 つの中核的な構造を備える：',
    features: [
      { label: 'フレームワーク駆動の生成', description: 'JTBD や RICE など 22 種のプロダクトフレームワークを内蔵し、AI にシニア PM の思考で深く推論することを強制する。汎用 AI の空疎な出力を排除する。' },
      { label: 'Multi-Agent Orchestration', description: '3 名の専門家 Sub-agent を独立して稼働させ、ディスカバリーと戦略批判を担当する。深い判断をメイン Agent の混雑したコンテキストから解放する。' },
      { label: 'エコシステム全方位への組み込み', description: 'Claude.ai Custom Skill と Claude Code ターミナルツールを統合し、既存の習慣を変えずに PM の現行ワークフローへ直接組み込まれる。' },
      { label: '自動化された技術引き継ぎ', description: '受け入れ基準付きのスペックドキュメントと CLAUDE.md をワンクリックで生成し、シームレスな技術引き継ぎ（Dev Handoff）を実現する。' },
    ],
    metaTitle: 'Product Playbook — Multi-Agent スペック生成システム | LLM プロダクト事例',
    metaDescription:
      'Claude Code 向けの Multi-Agent プロダクトプランニングシステム：22 種の PM フレームワークと 3 名の専門家 Sub-agent（ディスカバリー、戦略批判、リスク予測）が連携し、自動化された Dev Handoff を実現する。AI PM Charles Chen の LLM オーケストレーション事例研究。',
    problem: [
      '従来のスペック作成コストが極めて高い：及第点の PRD はユーザーリサーチ、競合分析、技術的制約の統合を要し、通常数日を費やすため、チーム開発の進捗ボトルネックとなりがちである。',
      '汎用 AI のプロダクト思考の限界：ChatGPT や Notion AI は文章を生成できるが「プロダクトを理解していない」。JTBD 分析の自動実行や RICE モデルによるバックログの優先順位付けはできず、実用性のない汎用的な文章に終わる。',
      '単一 Context の記憶希釈：単一の AI にすべてのフレームワークを強制的に保持させると、巨大な記憶が互いに干渉して分析の深さが薄まる。プロダクト探索に必要な共感、戦略段階に必要な批判性、リスク予測に必要な悲観的想像力は、3 つの全く異なる作業モードであり、同一の対話内に共存させるのが難しい。',
      'コミュニケーションギャップが手戻りを誘発する：PM が進捗を優先しドキュメントの整合を飛ばすと、後段の開発における誤解と手戻りコストが指数的に増大する。',
    ],
    solution: [
      'Multi-Agent スペック生産パイプライン：Product Playbook はチャットボットの域を超え、厳密なスペック生産パイプラインとして稼働する。v1.2 で Multi-Agent 専門家分業アーキテクチャへ進化した。',
      'フレームワーク駆動の LLM オーケストレーション：22 種の成熟したプロダクトフレームワークを構造化プロンプトへ変換し、AI にシニア PM の思考モードでの推論を促し、実戦的価値のある出力を担保する。',
      '専門家 Sub-agent の独立稼働：3 名の専門家が独立した環境で各自の責務を担う。discovery-specialist はユーザーと機会の探索を担当；strategy-critic は厳格かつ公正な戦略批判者として機能；pre-mortem-runner はプロダクト失敗の悲観的シミュレーションに全力を投じる。メイン Agent が自動的にタスクを割り振り、Sub-agent は構造化 YAML で結果を返してメイン Agent が統合する。',
      '責務専一の工程設計：各 Sub-agent には拒否メカニズム（out_of_scope）が組み込まれており、権限を逸脱した要求に対しては明確に拒否し正しい担当者を指名する。ツールセットは「読み取り専用」に厳格に制限され、ツール層から「計画段階でファイルを書き換えない」を強制し、決定権はメイン Agent に常時残る。',
      '柔軟な 6 つのプロダクトモード：Quick、Full、Revision、Build を含む 6 種のモードを提供する。素早い機能実験から新規プロダクトのフルローンチまで、対応する出力深度が見つかる。',
      '強力なデータ取り込み：3 層 PDF 解析エンジン（テキスト → 意味認識 → OCR フォールバック）を内蔵し、既存のリサーチ資料をアップロードして AI が実材料に基づいて推論する。',
      '変更の自動伝播と技術翻訳：上流の意思決定が変更されると下流ドキュメントが同期的に更新される。システムは CLAUDE.md と TASKS.md を自動生成し、プロダクト要件を直接エンジニアの技術タスクへ翻訳する。',
    ],
    techStack: [
      { category: 'Platform', items: 'Claude.ai Custom Skill、Claude Code Plugin/Skill' },
      { category: 'AI Engine', items: 'Claude（LLM Orchestration）、Claude Vision（意味文書解析）' },
      { category: 'Multi-Agent Layer', items: '3 つの Claude Code sub-agent（discovery-specialist / strategy-critic / pre-mortem-runner）、読み取り専用ツールセット、model: inherit、PROACTIVELY auto-delegate、structured YAML output' },
      { category: 'Frameworks', items: '22 種の専門フレームワークを内蔵（JTBD、Positioning、PR-FAQ、RICE、OST など）' },
      { category: 'Doc Processing', items: 'Playwright（PDF レンダリング）、Pandoc（フォーマット変換）、pymupdf、Tesseract OCR' },
      { category: 'Tooling', items: 'Node.js、Bash、Markdown ベースのフレームワーク定義' },
      { category: 'Localization', items: '6 言語対応：中国語（繁体／簡体）、英語、日本語、韓国語、スペイン語' },
    ],
    impact: [
      '開発効率の最大化：従来数日かかっていたスペック作成プロセスを数分まで大幅に短縮し、品質はベンチマークを上回る',
      '品質ベースライン +69%：Iteration 4 評価において、コア技術を未搭載のモデルと比較し、プロダクト思考と論理的厳密性で 69% の大幅向上を達成',
      'Sub-agent アーキテクチャによる +40.9% の追加上乗せ：Iteration 5 評価では、3 名の Sub-agent 起動後に品質達成率が 59.1% から 100% へ跳ね上がり、トークン消費もほぼ同等であった。専門分業がコストを増やさずに品質を大幅に高めることを証明',
      '鍵となる耐荷重コンポーネントの検証：pre-mortem-runner はシステムの耐荷重核心であることが実測で証明された。これがないとメイン Agent は薄いリスクリストしか生成できず、補ったあと同一評価では品質が 22.2% から 100% へ向上（純増 +77.8%）',
      'ワークフローへのシームレス融合：マルチチャネル配信により、利用者はプラットフォームを切り替えることなく、既存のエディタやターミナルから直接呼び出せる',
      'オープンソースコミュニティへの貢献：MIT ライセンスで公開し、PM とエンジニアが部署横断で協働する生産性ツールとなった',
    ],
    learnings: [
      'プロダクトの価値は「フレームワーク」の階層に宿る。AI PM として、LLM のオーケストレーションは本質的にプロダクトデザインの問題であると深く実感した。生成は表層の現象であり、フレームワークの実行順序こそが核心である。Persona を先に定義してから JTBD 分析を行ってこそ、AI は真のユーザーペインポイントを精緻に識別できる。',
      'Empowered Specialist は工程的な意思決定である。かつては Sub-agent を「長いプロンプトを短く切る」技術的最適化に過ぎないと考えていたが、v1.2 で 3 名の Sub-agent を投入したときに気づいた。拒否メカニズム（out_of_scope return path）と読み取り専用ツールセットこそが設計の核心である。Sub-agent が権限を逸脱した要求に対して「これは私の責務外です」と明言し決定権をメイン Agent に返却できる設計は、Marty Cagan の言う empowered team の概念に対応する。専門家が自らの境界を理解することで、システムはむしろ安定する。Iteration 5 評価では pre-mortem-runner が欠けるとリスク評価の品質が 22.2% まで落ちることが示され、この専門分業が本当の意味でシステムの耐荷重構造であることが証明された。',
      'アーキテクチャの進化は「差異と誠実に向き合うこと」にある。設計初期、私は 3 名の Sub-agent に整然とした 4 フィールドの YAML スキーマを共用させようと計画していた。だが実装段階で、戦略批判の成果物は「ブラインドスポット採点」、リスク予測の成果物は「リーディングインジケータ付きシナリオ」であり、同一の枠に押し込むとそれぞれの精緻性が薄まることが分かった。最終的に「共有エンベロープ + Agent ごとのボディ」のトレードオフを採用した。この選択から得た学びは、一貫性の価値は品質目標に奉仕することにあり、基層の問題が本質的に異なるとき強制的な標準化は品質を傷つける、ということだ。',
      'チャネル戦略がユーザーリテンションを決める。Skill ベースの配信戦略を選んだことで非常に高い定着率を獲得した。優れたツールは利用者がすでに作業している場所へ「会いに行く」設計を採用する。新しいプラットフォームへの適応を強いる必要はない。',
      'コアインサイト：誰でも API を呼び出せるが、「正しい問いを問う」「思考を導く」「専門家に適切なタイミングで発言させる」方法を知ることこそが本物の知的財産である。22 種のフレームワークはこのシステムの魂であり、3 名の Sub-agent は専門分業の骨格であり、AI はそれらの知恵を高速に届ける自動化メカニズムにすぎない。',
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
    subtitle: '「不動産情報の大海原で、優良物件のほうから会いに来てもらう」。台湾不動産市場の情報の断片化を打ち破るために設計された、Node.js と AI による個人向け不動産意思決定パイプライン：オムニチャネル統合（毎日 09:00 に 591 と Facebook 賃貸グループを自動スキャンし、分断された情報を単一のフローへ収束）、AI セマンティック解析（Claude API が混沌としたコミュニティ投稿を精密に構造化データへ変換）、定量的意思決定モデル（5 次元の加重採点で、もともと感覚的な内見直感を科学的なデータ指標に変換）、深いアドバイザリーモード（Claude Code と統合し、初購試算から住み替え計画までプロフェッショナルなコンサルティングを提供）。',
    metaTitle: 'House Ops — 台湾住宅探索の自動化と AI 意思決定 Pipeline | Charles Chen 個人プロジェクト',
    metaDescription:
      'Node.js による自動化パイプライン。毎日 591 と Facebook の公開賃貸グループをスキャンし、Claude API で自由文の投稿を構造化フィールドへ抽出、台湾の物件を価格・スペース・立地・状態・リスクの 5 次元で加重採点し、HTML メールでお届けします。AI Product Manager Charles Chen の個人自動化事例研究。',
    problem: [
      '台湾で賃貸や住宅を探す人にとって、最大の苦痛は「物件がない」ことではなく、「見きれない」ことです。',
      '情報の極端な断片化：物件は 591、Facebook の秘密グループ、各種ロングテール掲示板に散在しています。ユーザーは数十のタブで MRT 距離、間取り、価格を手作業で照合せざるを得ません。',
      '高密度の情報ノイズ：FB 投稿は従来のツールでは絞り込めない自由文で、再投稿、価格変動、フォーマット崩壊を伴い、検索コストが極端に高くなります。',
      '意思決定疲労：「スキャン → 評価 → 棄却」のループを毎日繰り返し、優良物件は会社員が忙しくしている数時間のうちに掻っ攫われてしまいます。',
      '文脈診断の欠如：既存プラットフォームは基本的なフィルタしか提供せず、「地区中央家賃、面積比、賃貸リスク」を統合した意思決定のアドバイスを提供できません。',
    ],
    solution: [
      'House Ops は自動化パイプラインと AI の協働により、不動産スクリーニングを「手動スキャン」から「自動デリバリー」へと変えます。',
      'ブレイクスルー的スクレイピング：Chrome DevTools Protocol (CDP) で実体のタッチジェスチャを合成することで、Facebook のアンチ Bot 機構と遅延読み込み（Lazy-load）を回避し、最新のコミュニティ物件を確実に取得します。',
      'LLM 構造化エンジン：FB の混沌としたテキストに対し、Claude API (Haiku 4.5) がリアルタイムで価格、住所、坪数、間取りなどの構造化フィールドを抽出し、オムニチャネルでデータを揃えます。',
      '5 次元ヒューリスティック採点：システムは「価格、スペース、立地、状態、リスク」を定量採点します。ユーザーは「賃貸族 / 初購族 / 住み替え族」で動的に重みを切り替え、曖昧な印象を 0〜5 の具体的指標へ変換できます。',
      'プッシュ型意思決定体験：毎日 09:30 前に、ビジュアライズされた HTML サマリーが時間通りに Gmail に届きます。値下げ追跡、新着アラート、行政区別集計を含み、注意がもっとも集中する朝に意思決定が起きるようにします。',
      '人と AI の協働意思決定レイヤー：パイプラインはデータファネルと重複排除を担当し、AI インタラクションレイヤー（Claude Code）は支払い能力試算（Affordability）、売って買うときの資金ギャップ（Upgrade Plan）、内見チェックリスト（Checklist）といった複雑なトレードオフ判断を処理します。',
    ],
    techStack: [
      { category: 'Runtime', items: 'Node.js（ESM）' },
      { category: 'Scraping', items: 'agent-browser（591）+ CDP（Facebook の合成ジェスチャでスクレイピング）' },
      { category: 'LLM Extraction', items: 'Claude API（Haiku 4.5）が自由文解析を担当' },
      { category: 'Email', items: 'Nodemailer + Gmail SMTP でインタラクティブな HTML サマリーを送信' },
      { category: 'Scheduling', items: 'macOS launchd（スケジュール起動と環境変数の継承を処理）' },
      { category: 'Persistence', items: 'JSON Cache と TSV スキャン履歴' },
      { category: 'Interactive Layer', items: 'Claude Code 統合で財務と住み替え計画を深く支援' },
    ],
    impact: [
      'オムニチャネル収束：591 と FB の壁を打ち破り、分断されていた情報フローを単一の評価体系に統合',
      '精密な重複排除と追跡：永続キャッシュと組み合わせ、再投稿の自動フィルタと価格変動のリアルタイム追跡を実現',
      'フィルタから加重へ：硬直的な「ハード閾値フィルタリング」を「多次元加重モデル」へ進化させ、人間の意思決定の好みをより正確にシミュレート',
      '極限の意思決定効率：プッシュ型日報と AI インタラクションにより、毎日の物件確認時間を「数時間」から「数分」へ収束',
    ],
    learnings: [
      '「自動化の世界では、配信メディアそれ自体がプロダクトである。」なぜ Dashboard ではなく Email を選んだのか？それは行動科学からの気付きでした：朝の高頻度意思決定タイミングでは、「プッシュ（Push）」の到達率は「プル（Pull）」をはるかに上回ります。データはユーザーの注意がすでにある場所に能動的に現れるべきです。',
      '技術パスのトレードオフ：FB 統合の過程でさまざまなスクロール模倣パスを試した結果、CDP の Input.synthesizeScrollGesture（合成タッチジェスチャ）だけが実体操作として扱われることが分かりました。ここから学んだのは、アンチ Bot 機構に対抗するときは、実体レイヤーに近い操作ほど有効だということです。',
      'パーサとしての LLM の経済性：LLM で構造化フィールドを抽出するのは一見高価そうに見えますが、実際には 1 件あたりのコストは極小（約 USD 0.001）で、その安定性はルールベースの Parser をはるかに上回ります。「月租押金含管費可議」のような予測不能な台湾風中国語に対しても、AI は人間レベルの理解力を見せました。最後に、ハードフィルタから加重モデルへの転換こそが、このプロジェクトの魂です——次元間でのトレードオフを物件に許容することが、もっとも人間らしい意思決定パターンに合致するのです。',
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
      { label: 'GitHub', url: 'https://github.com/Kaminoikari/job-ops' },
    ],
  },
]
