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
}

export const projects: Project[] = [
  {
    id: 'path',
    title: 'Path',
    description:
      'オフラインファーストの旅行プランニング PWA。Cache-first + background sync で、海外でネットが落ちても、旅程・経路・コストにそのまま手が届きます。',
    ctaText: 'TRY IT',
    ctaUrl: 'https://trip-path.vercel.app/',
    tags: ['PWA', 'React', 'IndexedDB'],
  },
  {
    id: 'plutus-trade',
    title: 'Plutus Trade',
    description:
      '自分用に作った台湾株の AI 副操縦士。Gemini が決算と機関投資家フローを統合し、毎日資料を自分で集める時間を節約。予測トラッキング + 引け後の AI 自己レビューでフィードバックループを閉じ、prompt とモデルの fine-tune の土台にしています。',
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
]

export const projectDetails: ProjectDetail[] = [
  {
    id: 'path',
    title: 'Path — オフラインファースト旅行プランニング PWA',
    subtitle: 'Progressive Web App として作られた旅行プランナー。海外でネットが落ちても、旅程・経路・コストにそのまま手が届きます。',
    metaTitle: 'Path — オフラインファースト旅行プランニング PWA | Charles Chen プロダクト事例',
    metaDescription:
      '複数日の旅行プランニングのためのオフラインファースト PWA。React、TypeScript、Supabase、IndexedDB の cache-first + background sync 構成で、海外でも通信なしに動きます。',
    problem: [
      '旅行プランナー App（Wanderlog、Tripit、または去趣のようなローカルのもの）はネット接続を前提にしています。空港の WiFi では美しく旅程を表示しても、東京の地下鉄、北海道の山あいの温泉、JR の電波の届かない乗り換えホームでは真っ白になります。プランナーがもっとも必要なまさにその瞬間に、機能を停止するわけです。',
      '海外のモバイルデータは高い、不安定、両方とも、のどれかです。Pocket WiFi はバッテリーが切れ、eSIM は地下のすべての駅をカバーするわけではなく、グループの予定はみんなの分のルート検索を抱えた 1 台のスマホでボトルネックになります。ネットが要る旅行プランナーは、いちばん悪いタイミングで失敗するプランナーです。',
    ],
    solution: [
      'Path をオフラインファーストの Progressive Web App として作りました。アーキテクチャの問いは「native か web か」ではなく「ネットがなくても動く web app をどう作るか」でした。PWA は両方に答えました：iOS / Android のホーム画面に 1 つの URL からインストール可能、Service Worker で完全なオフライン能力、app store のゲートなし、native build なし、プラットフォーム税なし。',
      'Cache-first + background sync のデータ戦略を採用。すべての読み取りはまず IndexedDB に当たって即座にレンダリングし、バックグラウンドで Supabase に同期して最新データを取得し cache を更新します。書き込みは optimistic：UI はすぐ更新、変更はローカル cache にコミット、API 呼び出しはバックグラウンドで走ります。ネットが切れていれば変更は sync queue で待機し、接続が戻ったら再生されます。海外で旅行者がローディングスピナーを見ることはなく、入力したものが消えることもありません。',
      'プランニング体験そのものをこのオフライン保証の上に構築：ドラッグ＆ドロップの複数日旅程（@dnd-kit）、Google Maps による場所と経路（最初の取得後にキャッシュ）、日台特化の公共交通指示（車両アイコン、徒歩時間、路線色）、通貨対応のコスト管理、写真・ドキュメント添付、よく使うトラベラーのテンプレート（リピート旅行で一発展開）。Supabase の Row Level Security がサーバーサイドで各ユーザーのデータを隔離します。',
    ],
    techStack: [
      { category: 'Frontend', items: 'React 18, TypeScript, Vite, TailwindCSS, shadcn/ui (Radix UI)' },
      { category: 'Offline / PWA', items: 'IndexedDB（idb 経由）、Service Worker、PWA manifest' },
      { category: 'State', items: 'TanStack Query（server state）、React Context（auth）、@dnd-kit（ドラッグ＆ドロップ）' },
      { category: 'Backend', items: 'Supabase（PostgreSQL、Auth と Google OAuth、Storage、Row Level Security）' },
      { category: 'Maps', items: 'Google Maps API（Places、Directions、Geocoding）' },
      { category: 'Validation', items: 'Zod（クライアント schema）、Postgres CHECK 制約（サーバー）' },
      { category: 'Testing', items: 'Vitest, Testing Library' },
      { category: 'Deployment', items: 'Vercel' },
    ],
    impact: [
      'オフラインファースト PWA：通信なしで旅程・経路・コストすべてにアクセス可能',
      'Cache-first + background sync：読み取りは瞬時、書き込みは optimistic、sync queue がネット切断時の編集を取りこぼしなく拾う',
      '日台公共交通の特化：車両アイコン、路線色、徒歩時間がメインのユースケースに合う',
      '単一 codebase、単一 URL：iOS / Android のホーム画面にインストール可能、app store の配信オーバーヘッドなし',
    ],
    learnings: [
      'PWA は荷重を支えるアーキテクチャ判断でした。native へ行けば 2 つの codebase、2 回の app store 審査、それでも「ネットがなくなったらどうする」への良い答えはなし。PWA ルートは native が提供するもの（ホーム画面アイコン、オフライン対応、インストール可能性）をすべて Path に与えてくれました。プラットフォーム税はなしです。さらに Service Worker + IndexedDB が今や web の first-class primitive なので、オフラインのストーリーは測定できるレベルで強くなりました。',
      'Cache-first + background sync は sequence diagram ではきれいに見えて、実装すると泥臭くなります。読み取りは素直で、IndexedDB は cached データを即座に返します。難しいのは衝突：同じ旅行を 2 つのデバイスでオフライン編集、両方が後でオンラインに戻る。最終的には last-write-wins + timestamp ベースのマージ、加えてレコード単位の sync queue に落ち着きました。完璧ではないですが、実際のユーザー行動（単一ユーザー、ときどきマルチデバイス、本物の衝突は稀）に合っています。',
      'Google Maps API のコストはユーザー数ではなく経路検索数でスケールします。攻めの cache 戦略：経路は 24 時間 cache、ジオコーディングした場所は永続 cache、選択した transit polyline は旅程そのものに保存。利用が増えても API 支出は横ばいで、オフライン体験を損なうこともありません。cache に当たるすべての呼び出しは、ネットなしでも動く呼び出しでもあります。',
    ],
    links: [
      { label: 'Try Path', url: 'https://trip-path.vercel.app/' },
      { label: 'GitHub', url: 'https://github.com/Kaminoikari/path' },
    ],
  },
  {
    id: 'plutus-trade',
    title: 'Plutus Trade — 自分用の台湾株 AI 副操縦士',
    subtitle: '取引のたびに月次売上、四半期決算、機関投資家フローを掘り下げて何時間も使うのをやめるため、自分用に作った AI ツール。',
    metaTitle: 'Plutus Trade — 個人用台湾株 AI 副操縦士 | Generative AI 事例',
    metaDescription:
      '個人用台湾株 AI 副操縦士：Gemini AI 個別株診断、ワンタップ銘柄スクリーニング、予測トラッキング、引け後 AI 自己レビュー。台湾の AI Product Manager Charles Chen による generative AI 事例。',
    problem: [
      '台湾株を手作業でリサーチするのは時間がかかります。月次売上を取得し、YoY/MoM を突き合わせ、四半期の EPS と粗利率を読み解き、三大投資家の売買フローを追い、K 線をスキャンしてようやく見立てを作る。Watchlist のすべての銘柄に対して、毎日。',
      'もう 1 本コンシューマー向けの SaaS を作る気はありませんでした。私が欲しかったのは自分用の副操縦士です。統合作業を肩代わりし、自分の予測を log に残し、本来であれば資料集めに費やしていた一晩を返してくれるもの。',
    ],
    solution: [
      'Plutus Trade を自分用の台湾株 AI 副操縦士として構築。Gemini 2.5 Flash が月次売上（YoY/MoM/累計）、四半期ファンダメンタルズ（EPS、粗利率、ROE、配当）、機関投資家フロー、テクニカルシグナルを一度に読み込み、平易な言葉の BUY/SELL/HOLD 診断と推論を返します。判断を置き換えるためではなく、一晩のリサーチを 1 段落に圧縮するためのものです。',
      'ワンタップ銘柄スクリーニングのフローを追加。3 ステップの投資家プロファイル ウィザード（リスク許容度、時間軸、セクター選好）が制約条件を AI に渡し、AI が選定理由つきの精選ショートリストを返します。「3 銘柄を見つけるために 30 銘柄をクリックして回る」部分のワークフローを省きます。',
      '各 AI 推奨の上に予測トラッキング層を構築。各ピックは entry context つきで log され、所定の地平で settle：実 ROI、勝率、決定品質マトリクス。16:30 の引け後日報には AI 自己レビューが含まれ、昨日のコールと実際に起きたことを突き合わせます。これでフィードバックループが閉じ、prompt（最終的にはモデル）を fine-tune するために必要なラベル付きデータが手に入ります。',
      '当初は 3 段階のサブスクリプションモデル（Free / Pro / Premium）と Apple In-App Purchase で出荷しましたが、外しました。目標が「自分が信頼できるツール」に収束した瞬間、SaaS の足場はただの摩擦になりました：1 ユーザーのための auth フロー、常にアンロックする機能のための tier ゲート、誰にも課金しない決済統合。外したことで、プロダクトはアップグレード意向ではなく分析の深さに最適化できるようになりました。',
    ],
    techStack: [
      { category: 'Frontend', items: 'Flutter 3.41+（Web、Vercel デプロイ）、Riverpod、go_router、fl_chart、Dio' },
      { category: 'Backend', items: 'FastAPI（Python 3.11）、Pydantic v2、httpx、APScheduler' },
      { category: 'AI', items: 'Google Gemini 2.5 Flash' },
      { category: 'Data Sources', items: 'TWSE/TPEX OpenAPI、Yahoo Finance、FinMind（fallback チェーン + 7 日 stale cache 付き）' },
      { category: 'Database', items: 'Supabase（PostgreSQL）、Redis（Upstash）を cache に' },
      { category: 'Notifications', items: 'Web Push（VAPID / pywebpush）、16 種類の通知 + 12 時間クールダウン' },
      { category: 'Deployment', items: 'Vercel（フロントエンド auto-deploy）+ Fly.io（バックエンド nrt region）' },
    ],
    impact: [
      '8 つの統合モジュールをカバーする個人 AI 副操縦士：データセンター、自選股／ポートフォリオ、AI 個別株診断、ワンタップ選股、予測トラッキング、ファンダメンタルズ、スマート通知、引け後日報',
      '閉ループ予測システム：すべての AI 呼び出しが log され、所定地平で settle、翌日報でレビューされる。これが prompt 反復と将来のモデル fine-tune に必要なラベル付きデータセットを積み上げます',
      '3 層のデータソース fallback（FinMind → Yahoo Finance → TWSE/TPEX OpenAPI）+ stale-cache のセーフティネットで、いずれかのプロバイダーが落ちても AI に餌が回ります',
      '動的キャッシュ戦略：取引時間中 5 分、引け後は次の取引日 09:00 までキャッシュ、週末はキャッシュを月曜まで持ち越し',
    ],
    learnings: [
      'LLM の出力品質は prompt 構造に大きく左右されます。明示的な出力フォーマット（JSON schema）と few-shot 例を組み合わせた構造化 prompt は、free-form prompt と比較して Gemini のハルシネーションを約 60% 削減しました。',
      '金融系 AI プロダクトには追加のガードレールが必要です。すべての AI 出力ページに免責事項を表示し、BUY/SELL/HOLD ラベルは投資助言ではなく分析出力として枠付けします。個人ツールであっても、この制約を最初から焼き込むことが大事：判断をモデルに外注したくなる傾向を止めてくれます。',
      'サブスクリプションを外したのは、このプロジェクトでもっとも頭がクリアになった判断でした。「これは自分のために作るツール」と決めた瞬間、「無料ティアのユーザーがこうしたら…」というトレードオフはすべて消えます。Build constraint は誰のために作るかから来る：これを最初に正しくすることが、個別の機能よりも大事です。',
      '予測トラッキング層は予測そのものよりも価値があります。AI は簡単な部分。「AI は何と言ったか、実際は何が起きたか、なぜ間違えたか」のラベル付き履歴こそが、システムを時間とともに改善できるようにする moat。これが今後の fine-tuning 作業に欲しい土台です。',
    ],
    links: [
      { label: 'Try Plutus Trade', url: 'https://plutustrade.vercel.app/' },
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
      '重要なアーキテクチャ判断は、22 個の確立されたプロダクトフレームワーク（JTBD、Positioning、PR-FAQ、Pre-mortem、OST、RICE、PRD など）を free-form 生成ではなく構造化 prompt として使うこと。各フレームワークが、Discovery、Define、Develop、Deliver の 4 フェーズを通して、シニア PM の実際の思考パターンに AI の出力を制約します。',
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
      'LLM orchestration は単なるエンジニアリング課題ではなく、プロダクトデザインの課題です。フレームワークの実行順序が大事で、Persona を JTBD の前に走らせると、ユーザーコンテキストが job の特定を導くため、出力品質が上がります。pipeline の順序最適化にかなりの時間を使いました。',
      'Skill ベースの配布（Claude Code エコシステム）は強力なチャネルでした。ユーザーは新しいプラットフォームを採用する必要なく、既存のワークフローの中でツールを発見できます。',
      'AI Product Manager として AI agent を作って一番の気付き：プロダクトの価値は AI そのものではなく、フレームワークにあるということ。AI は配信メカニズムですが、22 個のプロダクトフレームワークこそが本当の知的財産です。LLM API は誰でも呼べる、差別化は何を聞くかを知っているかどうかです。',
    ],
    links: [
      { label: 'GitHub', url: 'https://github.com/Kaminoikari/product-playbook' },
    ],
  },
]
