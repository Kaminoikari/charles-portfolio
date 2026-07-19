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
    description:
      'オフラインファーストの旅程計画 PWA。Cache-first と背景同期アーキテクチャを採用し、極端な圏外環境でも地図ルートと家計記録を数秒でロード、死角ゼロの旅体験を実現します。',
    ctaText: 'TRY IT',
    ctaUrl: 'https://trip-path.vercel.app/',
    tags: ['PWA', 'React', 'IndexedDB'],
  },
  {
    id: 'plutus-trade',
    title: 'Plutus Trade',
    description:
      '台湾株向けの深掘り AI 分析ツール。Gemini がファンダメンタルズ、機関投資家フロー、テクニカルをクロスドメインで融合し、実際の相場・サプライチェーンデータに基づく持株戦略を毎日生成、各提案の長期勝率と実質 ROI を追跡します。',
    ctaText: 'TRY IT',
    ctaUrl: 'https://plutustrade.vercel.app/',
    tags: ['Flutter', 'FastAPI', 'Gemini AI'],
  },
  {
    id: 'product-playbook',
    title: 'Product Playbook',
    description:
      'Claude Code 上で動く outcome-first のプロダクト思考システム。欲しい成果を伝えると、meta-skill が 16 個の組み合わせ可能なプロダクト lens から適切なものを選び、必要に応じて複数を融合し、2 つの読み取り専用の専門 Sub-agent を呼び出して、曖昧なアイデアを出荷可能な PRD 仕様へ変換します。実装フェーズに入ると、軽量なエンジニアリング規律レイヤーが TDD とダブルレビューの厳密さを計画から build まで引き継ぎます。',
    ctaText: 'EXPLORE',
    ctaUrl: 'https://github.com/Kaminoikari/product-playbook',
    tags: ['Lens System', 'Claude Code', 'AI/LLM'],
  },
  {
    id: 'house-ops',
    title: 'House Ops',
    description:
      '不動産意思決定の自動化 Pipeline。毎日 591 と Facebook グループを精密にスキャンし、Claude API が瞬時に構造化データへ抽出、独自開発の 5 次元加重アルゴリズムが最良 ROI 物件を秒で選定します。',
    ctaText: 'EXPLORE',
    ctaUrl: 'https://github.com/Kaminoikari/house-ops',
    tags: ['Node.js', 'Agent', 'Automation', 'Claude API'],
  },
  {
    id: 'job-ops',
    title: 'Job Ops',
    description:
      '全自動の個人求職 Pipeline。毎朝 104 から最新の求人を取得し、職務内容、業界、給与、AI 関連度のスコアで採点、「推奨・観察・見送り」の 3 段階意思決定ダイジェストを定刻に配信します。',
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
      'Path は「ネットワークなしでも走る Web アプリ」を基盤から再定義します。',
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
    subtitle: '「トレーディングデスク 1 卓ぶんの分析戦力を、AI 合成（Synthesis）1 回ぶんに収斂させる」。単一トレーダーのために設計された深掘り分析ツール。「ファンダメンタルズ + 機関投資家フロー + テクニカル」の従来は数時間かかる研究サイクルを、論理的な推論を伴う 1 回の意思決定提案に圧縮します：全次元の合成（月次売上、ファンダメンタルズ、機関投資家フロー、テクニカル構造を Gemini AI がクロスドメインで診断）、監査可能な意思決定（各 AI 推奨は「Instrumented」処理され、長期の勝率と ROI を追跡）、量的下層アーキテクチャ（量的モメンタムモデルで候補プールを絞り込み、AI の意味解釈が確かなデータに支えられるよう保証）、そして根拠に基づく持株戦略（毎日まず実際の相場コンテキストと個別株のファンダメンタルズで各保有を富化してから、Gemini がその日の売買戦略を執筆）。',
    metaTitle: 'Plutus Trade — 個人用台湾株 AI 意思決定支援ツール | 事例研究',
    metaDescription:
      'アクティブな台湾株リサーチ実務者向けの単一ユーザー意思決定支援ツール。Gemini 駆動のクロスドメイン synthesis、ガイド付きスクリーニング、instrument 済みの予測トラッキング層。台湾の AI Product Manager Charles Chen による generative AI 事例研究。',
    problem: [
      'アクティブに台湾株を運用する実務者にとって、もっとも高くつくコストはリサーチの時間です。',
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
      '根拠に基づく毎日の持株戦略：毎日 16:30 にまず実データのコンテキストを組み立てます（大盤 ^TWII のトレンド、米国主要指数と SOX、マクロニュース）。さらに各保有銘柄のファンダメンタルズ富化（直近 60 日トレンド、三大法人の純売買、EPS、月次売上 YoY/MoM、サプライチェーンニュース）を加え、その証拠を Gemini に渡します。各銘柄は観察ポイント、売却目標価格、買い増し・売却の理由、サプライチェーンと地政学リスクを伴って返り、毎晩トレーダーへ Email で届きます。',
      '常駐する自動化：スケジュール cron が場後日報（勝率トラッキング、予測検証、機関投資家フロー、翌日戦略、AI 自己レビュー）、16 種類の Web Push スマート通知（12 時間クールダウン付き）、そして市場の有力者の新規投稿を毎日のダイジェストに蒸留する Threads 達人モニターを実行します。',
    ],
    techStack: [
      { category: 'Frontend', items: 'Flutter 3.41+（Riverpod、go_router；クロスプラットフォーム対応、Vercel デプロイ）' },
      { category: 'Backend', items: 'FastAPI（Python 3.11）、Pydantic v2、APScheduler' },
      { category: 'AI Engine', items: 'Google Gemini 2.5 Flash（Narrative Synthesis 担当）' },
      { category: 'Data Enrichment', items: '毎日の相場コンテキストと個別株ファンダメンタルズの富化サービス（^TWII、米国指数、SOX、三大法人、EPS、売上；Redis 共用）' },
      { category: 'Quant Engine', items: '自製モメンタム Scoring 層（8 特徴量加重 + Redis キャッシュ）' },
      { category: 'Data Sources', items: '3 層 Fallback チェーン（FinMind → Yahoo Finance → TWSE OpenAPI）' },
      { category: 'Persistence', items: 'Supabase（PostgreSQL）、Redis（Upstash）をザラ場キャッシュに' },
      { category: 'Notifications & Email', items: 'Web Push（VAPID、pywebpush）、Resend（トランザクション Email）' },
      { category: 'Deployment', items: 'Fly.io（バックエンド nrt region）+ Vercel（フロントエンド）' },
    ],
    impact: [
      '全機能カバー：単一インターフェースに市場データ、AI 診断、ガイド付き選股、予測トラッキング、毎日の持株戦略、場後日報、スマート通知など 8 モジュールを統合',
      'データ耐性の保証：3 層データソース Fallback と 7 日 Stale-cache のセーフティネットにより、上流サービスが劣化したときもツールは分析能力を保ちます',
      '監査可能な信頼：各 AI 呼び出しは追跡可能かつ決済可能で、金融の意思決定で AI によくある「ブラックボックス」問題を解決します',
      'データに接地した AI 出力：相場コンテキストと個別株の富化レイヤーが、Gemini が持株戦略を書く前に実際の三大法人・EPS・月次売上を与えるため、すべての目標価格と提案が実データに支えられます',
      '相場感知キャッシュ：取引時間帯に応じて TTL を自動調整（ザラ場 5 分、週末はロック）、API コストを抑えつつリアルタイム性を維持',
    ],
    learnings: [
      '「Prompt Contract の設計が、AI による意思決定の品質を決める。」開発を進めるなかで、「モデルが弱い」という不満の多くは、上流の構造化された制約で解決できると気づきました。JSON Schema で出力フォーマットを制約し、Few-shot anchors を導入することで、Gemini のハルシネーション率を約 60% 削減できました。',
      '「接地」こそ信頼の源：信頼性の最大の向上は、実データをモデルに与えることから生まれました。相場コンテキストと個別株ファンダメンタルズの富化レイヤーを作り、Gemini が実際の三大法人・EPS・月次売上で推論できるようにしたことが、毎日の持株戦略を行動に値するほど信頼できるものにした要因です。',
      'プロダクト設計の境界感：金融プロダクトでは、「分析」と「助言」の線をインターフェース層で強制的に切り分ける必要があります。プロダクトの仕事は、モデルの回答を免責事項つきのプロフェッショナルな分析としてフレーミングすることです。',
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
    title: 'Product Playbook — Claude Code 向け outcome-first プロダクト Lens',
    subtitle: '「AI にシニア PM の頭脳を与え、そのうえで正しい思考ツールを自ら手に取らせる。」2.0 の書き直しでシステムは outcome-first になった：欲しい成果を伝えると、meta-skill がそこへ導くプロダクト思考の lens を選び、必要に応じて複数を融合する。5 つの中核的な理念がこの構造を定義する：',
    features: [
      { label: 'Outcome-first な lens ルーティング', description: '成果を伝えると、meta-skill が適した lens を選び、複数の視点を要する意思決定では 1 つの統合された答えへ融合する。16 個の組み合わせ可能な lens が、ディスカバリーから引き継ぎまでの弧全体をカバーする。' },
      { label: '専門 Sub-agent を要所で起用', description: '2 つの読み取り専用 Sub-agent（strategy-critic、pre-mortem-runner）が独立した Context で各自分析し、厳しい戦略批判と悲観的な失敗探索の切れ味を保つ。' },
      { label: 'provenance と証拠を標準搭載', description: '出力ごとに使った lens を明記し、判断が現実世界の事実に依存するときは lens がライブの証拠を引き、出典を添える。' },
      { label: 'エンジニアがそのまま引き継げる Handoff', description: '受け入れ基準付きの PRD、OWASP に沿ったセキュリティセクション、CLAUDE.md を一度に生成し、HTML・PDF・DOCX・PPTX へ書き出して本物の Dev Handoff を実現する。' },
      { label: '実装まで引き継ぐ規律', description: '計画がコードに変わると、軽量なエンジニアリング規律レイヤーが引き継ぐ：TDD 優先とテストの不正の明示的な禁止、scope integrity、認証情報のガード、そしてブランチを閉じる前の 2 つの新鮮な context によるレビュー（code reviewer と spec reviewer、fail-closed 判定）。' },
    ],
    metaTitle: 'Product Playbook — outcome-first プロダクト思考 Lens システム | LLM プロダクト事例',
    metaDescription:
      'Claude Code 上の outcome-first なプロダクトプランニングシステム：meta-skill がルーティングする 16 個の組み合わせ可能な PM lens、2 名の読み取り専用の専門 Sub-agent（戦略批判、pre-mortem）、出力ごとの provenance、自動化された Dev Handoff、そして build フェーズ向けの軽量な dev-discipline レイヤー（TDD 優先、code と spec のダブルレビュー）。AI PM Charles Chen の LLM オーケストレーション事例研究。',
    problem: [
      '従来のスペック作成コストが極めて高い：及第点の PRD はユーザーリサーチ、競合分析、技術的制約の統合を要し、通常数日を費やすため、チーム開発の進捗ボトルネックとなりがちである。',
      '汎用 AI のプロダクト思考の限界：ChatGPT や Notion AI は文章を生成できるが「プロダクトを理解していない」。JTBD 分析の自動実行や RICE モデルによるバックログの優先順位付けはできず、実用性のない汎用的な文章に終わる。',
      '単一 Context の記憶希釈：単一の AI にすべてのフレームワークを強制的に保持させると、巨大な記憶が互いに干渉して分析の深さが薄まる。プロダクト探索に必要な共感、戦略段階に必要な批判性、リスク予測に必要な悲観的想像力は、3 つの全く異なる作業モードであり、同一の対話内に共存させるのが難しい。',
      'コミュニケーションギャップが手戻りを誘発する：PM が進捗を優先しドキュメントの整合を飛ばすと、後段の開発における誤解と手戻りコストが指数的に増大する。',
    ],
    solution: [
      'outcome-first な lens システム：Product Playbook 2.0 は meta-skill で、欲しい成果を読み取り、そこへ導くプロダクト思考の lens を選び、意思決定が複数の視点を要するときは 1 つの統合された答えへ融合する。4 ステップの背骨は毎回同じ：成果を読む、lens を選ぶ、成果物を作る、provenance を明記する。',
      '16 個の組み合わせ可能な lens：成熟した各フレームワークが独立した lens skill として提供され（JTBD、Positioning、PR-FAQ、RICE 式の優先順位付け、North Star 指標、MVP scoping、PMF／GTM、strategy kernel など）、単独でも他と組み合わせても動くため、ツールは問いが本当に必要とする思考だけを持ち込む。',
      '独立 Context で動く専門 Sub-agent：2 つの読み取り専用の専門家が混雑したメインスレッドから離れて各自分析する。strategy-critic は厳しくも公正な戦略批判者を務め、pre-mortem-runner はプロダクト失敗の悲観的シナリオに全力を注ぐ。ディスカバリーに必要な共感は、いまや persona-journey と jtbd の lens の中に宿る。',
      '責務専一の工程設計：各専門家は読み取り専用で、拒否パス（out_of_scope）を備え、範囲外の依頼を正しい担当者へ返す。計画段階はツール層でファイルに触れず、決定権はメイン Agent に残る。',
      'Relative guardrails：少数の guardrail は既定で休眠し、現在の進め方が成果を本当に損なうときだけ、単一の非ブロッキングな注意として現れる。どんな場合もあなたを強制停止させない。',
      '大きな依頼向けの recipes：4 つの任意の recipe（full-product-plan、quick-validation、product-revision、feature-extension）が lens をエンドツーエンドのワークフローへ事前に並べる。あくまで提案で、採用するかはあなた次第。',
      '変更の自動伝播と技術翻訳：上流の意思決定が変わると下流ドキュメントも同期更新される。prd-and-handoff の lens が OWASP に沿ったセキュリティセクション付きの CLAUDE.md と TASKS.md を自動生成し、document-export が計画を HTML・PDF・DOCX・PPTX へ書き出す。',
      '計画から実装まで引き継ぐ規律：作業が実装フェーズに入ると、軽量な dev-discipline が引き継ぎ、TDD 優先（テストの不正は明示的に禁止）、scope integrity、シークレットと認証情報のガード、2 つの新鮮な context によるレビュー（code reviewer と spec reviewer、fail-closed 判定、最大 3 ラウンド）、そしてエントリーポイントの起動チェック付きの finish-branch チェックリストを備える。意図的に軽量に保つ：約 600 token の session-start ダイジェスト、1 つのオンデマンド skill、2 つの deterministic hook。',
    ],
    techStack: [
      { category: 'Platform', items: 'Claude Code plugin（skills-directory インストール）、Claude.ai Custom Skill' },
      { category: 'AI Engine', items: 'Claude（meta-skill lens オーケストレーション）、Claude Vision（意味文書解析）' },
      { category: 'Lens Layer', items: '16 個の組み合わせ可能な lens skill（JTBD、Positioning、PR-FAQ、RICE／solution-prioritization、success-metrics、MVP-scoping、PMF／GTM、strategy-kernel など）、meta-skill がルーティングし、出力ごとに provenance を付与' },
      { category: 'Specialist Sub-agents', items: '2 つの読み取り専用 Claude Code sub-agent（strategy-critic／pre-mortem-runner）、model: inherit、PROACTIVELY auto-delegate、structured output' },
      { category: 'Guardrails & Continuity', items: '3 つの lifecycle hook（session-start での meta-skill 注入、離題の監視、ドキュメント出力を保つリマインド）、relative な非ブロッキング guardrail、scoped SessionStart ルーティング指令' },
      { category: 'Engineering Discipline', items: 'build フェーズの dev-discipline レイヤー：TDD-first gate、シークレット／認証情報ガード hook、code + spec のダブル reviewer（fail-closed 判定）、finish-branch 起動チェック；約 600 token の session-start ダイジェスト + 2 つの deterministic hook' },
      { category: 'Doc Processing', items: 'Playwright + pikepdf（ブックマーク付き PDF）、Pandoc（DOCX／PPTX）、pymupdf、Tesseract OCR フォールバック' },
      { category: 'Tooling', items: 'Node.js、Bash、Markdown ベースの lens 定義、deterministic Python eval scorer' },
      { category: 'Localization', items: 'Runtime の言語検出でユーザーの言語で応答；lens の内容は英語で記述' },
    ],
    impact: [
      '開発効率の最大化：従来数日かかっていたスペック作成プロセスを数分まで大幅に短縮し、品質はベンチマークを上回る',
      '+69% の品質向上、実測値：初期アーキテクチャの Iteration 4 評価において、技術を未搭載の同一モデルと比べ、プロダクト思考と論理的厳密性が 69% 向上。これがシステムを作り込む理由となった',
      '専門分業は耐荷重構造であり、2.0 にも受け継がれる：初期の Sub-agent 層を有効化すると品質完了率が 59.1% から 100% へ（トークンコスト据え置き）、pre-mortem を単独で外すと同一の評価が 100% から 22.2% へ崩れた。この証拠こそが、strategy-critic と pre-mortem-runner を lens アーキテクチャでも専属の専門家として残す理由である',
      '2.0 はより簡潔で明快：16 個の組み合わせ可能な lens、出力ごとの provenance、非ブロッキングな guardrail により、ツールはディスカバリーから引き継ぎまでの弧全体で自ら適切なフレームワークを選ぶ',
      'ワークフローへのシームレス融合：Claude Code と Claude.ai の skill として配布し、エディタやターミナルから直接呼び出し、プラットフォームの切り替えは不要',
      'オープンソースへの貢献：MIT ライセンスで公開し、PM とエンジニアが部署を横断して協働する生産性ツールとなった',
    ],
    learnings: [
      '2.0 の書き直しは「組み合わせ」への賭けだった。1.x の設計では先に mode を選ばせ、固定のパイプラインを歩ませていた。だが実利用を観察すると、多くのプロダクトの問いは一度に 1〜2 個の lens で足りた。各フレームワークを組み合わせ可能な lens として作り直し、outcome-first のルーターを添えたことで、ツールは問いが必要とする思考だけを持ち込むようになり、provenance の一行がその選択を誠実で検証可能なものに保つ。',
      'プロダクトの価値は「フレームワーク」の階層に宿る。AI PM として、LLM のオーケストレーションは本質的にプロダクトデザインの問題であると深く実感した。生成は表層であり、どの lens を、いつ動かすかが核心である。Persona を先に定義してから JTBD 分析を行ってこそ、AI は真のユーザーペインポイントを精緻に識別できる。',
      'Empowered Specialist は中核的な工程判断である。かつては Sub-agent を「長いプロンプトを短く切る」技術的最適化に過ぎないと考えていたが、作ってみて気づいた。拒否パス（out_of_scope）と読み取り専用ツールセットこそが設計の核心である。専門家が越権時に「これは私の責務外です」と明言し決定権をメイン Agent へ返せる設計は、Marty Cagan の言う empowered team の概念に対応し、自らの境界を理解する専門家はむしろシステムを安定させる。評価もそれを裏づけた：pre-mortem を欠くとリスクステップが 22.2% まで落ちるため、strategy-critic と pre-mortem-runner はどちらも 2.0 の書き直しで専属の専門家として残った。',
      'アーキテクチャの進化は「差異と誠実に向き合うこと」にある。設計初期、私はすべての Sub-agent に整然とした YAML スキーマを共用させようと計画していた。だが実装で、戦略批判の成果物は「ブラインドスポット採点」、リスク予測の成果物は「リーディングインジケータ付きシナリオ」であり、同一の枠に押し込むと精緻性が薄まると分かった。最終的に「共有エンベロープ＋Agent ごとのボディ」を採用した。一貫性の価値は品質目標に奉仕することにあり、基層の問題が本質的に異なるとき、強制的な標準化は品質を損なう。',
      'コアインサイト：誰でも API を呼び出せるが、「正しい問いを問う」「思考を導く」「専門家に適切なタイミングで発言させる」方法を知ることこそが本物の知的財産である。lens はこのシステムの魂であり、outcome-first のルーティングは骨格であり、AI はそれらを高速に届ける自動化メカニズムである。',
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
      '台湾で賃貸や住宅を探す人にとって、最大の苦痛は「見きれない」ことです。',
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
      '「自動化の世界では、配信メディアそれ自体がプロダクトである。」配信メディアになぜ Email を選んだのか？それは行動科学からの気付きでした：朝の高頻度意思決定タイミングでは、「プッシュ（Push）」の到達率は「プル（Pull）」をはるかに上回ります。データはユーザーの注意がすでにある場所に能動的に現れるべきです。',
      '技術パスのトレードオフ：FB 統合の過程でさまざまなスクロール模倣パスを試した結果、CDP の Input.synthesizeScrollGesture（合成タッチジェスチャ）だけが実体操作として扱われることが分かりました。ここから学んだのは、アンチ Bot 機構に対抗するときは、実体レイヤーに近い操作ほど有効だということです。',
      'パーサとしての LLM の経済性：LLM で構造化フィールドを抽出するのは一見高価そうに見えますが、実際には 1 件あたりのコストは極小（約 USD 0.001）で、その安定性はルールベースの Parser をはるかに上回ります。「月租押金含管費可議」のような予測不能な台湾風中国語に対しても、AI は人間レベルの理解力を見せました。最後に、ハードフィルタから加重モデルへの転換こそが、このプロジェクトの魂です、次元間でのトレードオフを物件に許容することが、もっとも人間らしい意思決定パターンに合致するのです。',
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
