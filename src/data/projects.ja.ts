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
      'オフラインファーストの旅行プランニング PWA。Cache-first + background sync で、海外でネットが落ちても、旅程・経路・コストにそのまま手が届きます。',
    ctaText: 'TRY IT',
    ctaUrl: 'https://trip-path.vercel.app/',
    tags: ['PWA', 'React', 'IndexedDB'],
  },
  {
    id: 'plutus-trade',
    title: 'Plutus Trade',
    description:
      '台湾株向けの AI スマート銘柄選定ツール。リアルタイム株価、ローソク足チャート、財務諸表分析、AI 個別株診断、ワンタップ選定を統合し、パフォーマンス追跡バックテストシステムで AI の精度を継続的に改善します。',
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
      '台湾賃貸市場のための自律型物件探しパイプライン。毎朝 591 を自動スキャンし、各物件を 5 つの加重次元で採点して、朝のコーヒーを飲み終わる前に厳選サマリーをメールでお届けします。',
    ctaText: 'EXPLORE',
    ctaUrl: 'https://github.com/Kaminoikari/house-ops',
    tags: ['Node.js', 'Agent', 'Automation'],
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
      '海外のモバイルデータは高い、不安定、または両方です。Pocket WiFi はバッテリーが切れ、eSIM は地下のすべての駅をカバーするとは限らず、グループの予定はみんなの分のルート検索を抱えた 1 台のスマホでボトルネックになります。ネットが要る旅行プランナーは、いちばん悪いタイミングで失敗するプランナーです。',
    ],
    solution: [
      'Path をオフラインファーストの Progressive Web App として作りました。アーキテクチャ上で本当に答えるべき問いは「ネットがなくても動く web app をどう作るか」でした（native vs web はその下層の議論）。PWA は複数の条件を同時に満たしました：iOS / Android のホーム画面に 1 つの URL からインストール可能、Service Worker で完全なオフライン能力、app store のゲートなし、native build なし、プラットフォーム税なし。',
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
      'Cache-first + background sync は sequence diagram ではきれいに見えて、実装すると泥臭くなります。読み取りは素直で、IndexedDB は cached データを即座に返します。難しいのは衝突：同じ旅行を 2 つのデバイスでオフライン編集、両方が後でオンラインに戻る。最終的には last-write-wins + timestamp ベースのマージ、加えてレコード単位の sync queue に落ち着きました。完璧な解ではあえて目指さず、実際のユーザー行動（単一ユーザー、ときどきマルチデバイス、本物の衝突は稀）に合わせた現実的な妥協です。',
      'Google Maps API のコストは経路検索数でスケールします（ユーザー数とは独立）。攻めの cache 戦略：経路は 24 時間 cache、ジオコーディングした場所は永続 cache、選択した transit polyline は旅程そのものに保存。利用が増えても API 支出は横ばいで、オフライン体験を損なうこともありません。cache に当たるすべての呼び出しは、ネットなしでも動く呼び出しでもあります。',
    ],
    links: [
      { label: 'Try Path', url: 'https://trip-path.vercel.app/' },
    ],
  },
  {
    id: 'plutus-trade',
    title: 'Plutus Trade — 個人用台湾株 AI 意思決定支援ツール',
    subtitle: '単一ユーザー向け分析ツール：日次の「ファンダメンタルズ + 機関投資家フロー + テクニカル」研究サイクルを 1 回の AI synthesis パスに圧縮し、各推奨を instrument して長期にわたる監査を可能にする。',
    metaTitle: 'Plutus Trade — 個人用台湾株 AI 意思決定支援ツール | 事例研究',
    metaDescription:
      'アクティブな台湾株リサーチ実務者向けの単一ユーザー意思決定支援ツール。Gemini 駆動のクロスドメイン synthesis、ガイド付きスクリーニング、instrument 済みの予測トラッキング層。台湾の AI Product Manager Charles Chen による generative AI 事例研究。',
    problem: [
      'アクティブな台湾株実務者にとって、日次のリサーチワークフローは累積する時間コストです：月次売上の YoY/MoM 正規化、四半期ファンダメンタルズ（EPS、粗利率、ROE）、機関投資家の売買フロー、K 線のテクニカル構造。個々の入力は単独では扱える。ボトルネックは synthesis にあります。Watchlist が 30〜50 銘柄になると、分析作業量はフルタイムでデスクに座っていない実務者の時間予算を恒常的に超えます。',
      '現行のコンシューマーツールはこの問題に非対称に応えています。チャートアプリは生データを並べるだけで解釈しない；投資助言系プロダクトは解釈を提供するがユーザーを受動的な受け手として扱う。「ドメイン素養を備え、AI 出力を自ら監査でき、AI に synthesis を加速させたうえで時間をかけて信頼を積み上げたい」という中間の利用文脈には、どちらも応えていません。',
    ],
    solution: [
      'Plutus Trade を単一ユーザーの意思決定支援ツールとして位置づけました。Gemini 2.5 Flash は watchlist の各銘柄に対してクロスドメインの synthesis を行います：月次売上（YoY/MoM/累計）、四半期ファンダメンタルズ（EPS、粗利率、ROE、配当政策）、機関投資家フロー、テクニカル指標。出力は明示的な推論つきの BUY/SELL/HOLD 診断。免責事項つきで厳密に「分析」として framing し、最終的な意思決定権はユーザーに残ります。',
      'ガイド付きスクリーニング フローは、定性的な投資基準を AI が実行可能な contract に翻訳します。3 ステップの投資家プロファイル（リスク許容度、保有期間、セクター選好）が選股 prompt をパラメーター化し、選定理由つきの精選ショートリストを返します。これによりワークフローのうち、歴史的にもっとも時間がかかる発見フェーズを 1 回のインタラクションに圧縮します。',
      'instrument 済みの予測層が、各 AI 推奨に対して entry context を log し、地平で settle して、構造化された意思決定品質の記録を生成します（実 ROI、勝率、決定品質マトリクス）。狙いは持続的な透明性です：ユーザーは異なる市場 regime や戦略タイプ間でシステムの過去のパフォーマンスを監査でき、単回の出力は長期トラックレコードのなかの 1 つのデータポイントとして扱えます。',
    ],
    techStack: [
      { category: 'Frontend', items: 'Flutter 3.41+（Web、Vercel デプロイ）、Riverpod、go_router、fl_chart、Dio' },
      { category: 'Backend', items: 'FastAPI（Python 3.11）、Pydantic v2、httpx、APScheduler' },
      { category: 'AI', items: 'Google Gemini 2.5 Flash' },
      { category: 'Data Sources', items: 'TWSE/TPEX OpenAPI、Yahoo Finance、FinMind（3 層 fallback チェーン + 7 日 stale cache 付き）' },
      { category: 'Database', items: 'Supabase（PostgreSQL）、Redis（Upstash）を cache に' },
      { category: 'Notifications', items: 'Web Push（VAPID / pywebpush）、16 種類の通知 + 12 時間クールダウン' },
      { category: 'Deployment', items: 'Vercel（フロントエンド auto-deploy）+ Fly.io（バックエンド nrt region）' },
    ],
    impact: [
      '8 つの統合モジュールをカバーする単一ユーザー意思決定支援サーフェス：市場データセンター、自選股／ポートフォリオ管理、AI 個別株診断、ガイド付きスクリーニング、予測トラッキング、ファンダメンタルズ分析、スマート通知、引け後日報',
      'instrument 済みの予測層：各 AI 呼び出しは entry context つきで log され、地平で settle される（ROI、勝率、決定品質マトリクス）。システムを完全に auditable にします',
      '3 層のデータソース耐性：FinMind → Yahoo Finance → TWSE/TPEX OpenAPI fallback チェーン + 7 日 stale-cache のセーフティネットが、上流プロバイダーの劣化時にも分析能力を維持',
      '相場意識のキャッシュ方針：取引時間中は 5 分 TTL、引け後は次の寄付まで保持、週末キャッシュは月曜の寄付までロールフォワード',
    ],
    learnings: [
      'LLM 出力品質は主に prompt contract の設計問題です。JSON schema で出力フォーマットを制約した構造化 prompt + few-shot anchors は、free-form prompt と比較して Gemini のハルシネーションを約 60% 削減しました。「もっと強いモデルが要る」という議論の多くは上流で解決します：prompt contract を締めれば、モデル交換の必要は多くの場合消えます。',
      '金融 AI では、「分析」と「助言」の線をプロダクト層で強制する必要があります。モデルは求められれば推奨を出す；プロダクトの仕事はそれを免責事項つきの分析として再フレームすることです。これはプロダクト層に住む設計判断で、コンテンツモデレーションはその下流配置として続きます。',
      'Audience を 1 人に絞ることは意図的なプロダクト constraint であり、それ自体がプロダクト戦略を構成します。Scope を「ドメイン素養を持つ単一ユーザー」に収束させることで、コンシューマープロダクトが継承するトレードオフ マトリクス（合理的なデフォルト、新人 onboarding、不慣れなユーザー向けの容錯）を一括で消去し、設計表面を分析深度の最適化に振り切れます。',
      '意思決定支援ツールにとって、データソースの信頼性は第一級のプロダクト考慮です。多層 fallback + stale-cache のセーフティネットが、「上流プロバイダーが劣化したときも、ツールが使える」という保証になります。このプロダクトカテゴリでは、劣化はコア価値提案の outage と同義です。',
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
  },
  {
    id: 'house-ops',
    title: 'House Ops — 台湾賃貸市場の自律型物件探しパイプライン',
    subtitle: 'スケジュール駆動の 591 スキャナー。各賃貸・購入物件を 5 つの加重次元で採点し、毎日 09:00 に HTML メールサマリーをお届けします。さらに Claude のインタラクティブレイヤーが、支払い能力試算、物件比較、内見準備までカバーします。',
    metaTitle: 'House Ops — 自律型物件探しパイプライン | Charles Chen 個人プロジェクト',
    metaDescription:
      'Node.js による自動化パイプライン。毎日 591 をスキャンし、台湾の賃貸・購入物件を価格・スペース・立地・状態・リスクの 5 次元で加重採点し、HTML メールでお届けします。AI Product Manager Charles Chen の個人自動化事例研究。',
    problem: [
      '591 で台湾の賃貸を探すのは、繰り返しの「スキャン → 評価 → 棄却」ループです。物件は数時間で出入りし、価格は動き、同じ物件が別のエージェントから再投稿され、誠実な評価には MRT 距離・学区・築年数・間取り・エージェントの評判をクロスリファレンスする 30 タブ以上の作業が必要になります。これを夜だけ回す会社員にとって、ファネルは広すぎて、優先度の高い物件が一日のドリフトの中で雑音に埋もれます。',
      '591 自体や台湾の賃貸アグリゲーターの大半は、フィールドを並べるだけで判断はしません。リストし、ソートし、フィルターはしますが、採点はしません。物件が妥当かどうかは、賃料と行政区中央値、間取りと世帯人数、建物状態、賃貸リスクを束ねた文脈次第です。プラットフォーム側でそこを統合してくれるわけではないので、ユーザーが毎日、毎物件、自力で synthesis することになります。',
    ],
    solution: [
      'House Ops を Node.js（ESM）の自動化パイプラインとして構築し、macOS launchd で駆動しています。毎朝 09:00 に run-daily.mjs が agent-browser セッションをトリガーし、設定済みの 591 検索エリアをスキャンします。data/last-scan.json（cache）と data/scan-history.tsv（長期記録）と突き合わせて重複排除し、新規・値下げ・削除の差分を書き出します。',
      '各物件は、価格妥当性、スペースと間取り、周辺環境、物件状態、リスクの 5 次元でヒューリスティック採点を行い、加重して 0–5 点に合成します（賃貸は 30/20/25/15/10、購入は 35/20/20/15/10）。キーワード検出で MRT 近接（捷運）、学区（學區）、エレベーター、バルコニー、階層、リフォーム状況を拾います。≥4.0 はおすすめ、3.5–3.9 は慎重に検討、3.5 未満はスキップに分類されます。',
      '結果は nodemailer + Gmail SMTP で HTML メールに描画され、朝のコーヒー時間より前に届きます。メールには新着物件テーブル（スコア、行政区、賃料、サイズ、間取り、警告、591 リンク）、値下げ行、削除エントリ、行政区別の集計が入ります。もう一層は Claude Code 内に住んでいます。セッション内のインタラクティブモードで、支払い能力試算、買い替えプラン分析、物件サイドバイサイド比較、内見当日チェックリスト、アドホックな scan / pipeline コマンドが扱えます。自動化パイプラインがファネルを担い、インタラクティブモードが内見やトレードオフ周辺の人間の判断局面を担います。',
    ],
    techStack: [
      { category: 'Runtime', items: 'Node.js（ESM, .mjs）' },
      { category: 'Scraping', items: 'agent-browser（591 検索と物件ページの取得）' },
      { category: 'Email', items: 'nodemailer over Gmail SMTP（App Password 認証）' },
      { category: 'Scheduling', items: 'macOS launchd（com.house-ops.daily.plist、毎日 09:00）' },
      { category: 'Persistence', items: 'data/last-scan.json（cache）、data/scan-history.tsv（履歴）、data/tracker.md（ライフサイクル）、data/pipeline.md（キュー）' },
      { category: 'Interactive Layer', items: 'Claude Code modes（affordability、upgrade plan、compare、prepare visit、pipeline、scan）' },
      { category: 'Source', items: '591.com.tw（賃貸 + 購入）' },
    ],
    impact: [
      'Scheduled scanning：macOS launchd が毎朝 09:00 に run-daily.mjs を起動し、永続化されたスキャン履歴（data/last-scan.json cache + data/scan-history.tsv 長期記録）と重複排除',
      'Five-dimension scoring：各物件を価格妥当性、スペースと間取り、周辺環境、物件状態、リスクの 5 項目で個別採点し、0–5 点に加重合成（賃貸 30/20/25/15/10、購入 35/20/20/15/10）',
      'Daily email digest：nodemailer + Gmail SMTP で HTML サマリーを送信。新着、値下げ、削除、行政区別集計を含み、朝のコーヒー時間より前に到着',
      'Stateful tracker：評価済み物件はすべて Scanned → Evaluated → Visit → Signed のライフサイクルを通過し、data/tracker.md に保存',
      'Interactive Claude modes：セッション内の支払い能力計算機、買い替えプラン分析、物件サイドバイサイド比較、内見当日チェックリスト、アドホックな scan / pipeline コマンドを、自動化パイプラインの上に重ねる',
    ],
    learnings: [
      'launchd は macOS で「ログイン済みユーザー環境を必要とする」個人自動化に向くスケジューリング原語です。cron は detached で動き、継承する環境も最小限なので、keychain（Gmail 認証）、GUI サブシステム（一部のヘッドレスブラウザモード）、プロセス監督が絡むと相性が悪くなります。launchd は pmset の起動設定を尊重し、システム log と統合され、再起動後の手動再シードも要りません。日次の個人自動化にとって、運用上の天井が明確に高くなります。',
      '最初のパスはハード閾値フィルタを試しました：賃料 ≤ X、MRT 徒歩 ≤ Y、築年数 ≤ Z。優先順位が変わるたびに出力が振動します。安くて妥当な物件が階数キャップに 1 階差で落ちる一方、デフォルトに当たっただけの高めの物件がそのまま通ってしまうという具合でした。次元加重に切り替え、0–5 の合成スコアと 3 つの決定バンド（≥4.0 おすすめ、3.5–3.9 慎重、<3.5 スキップ）にしてからは、境界線上の候補を取りこぼさず、トレードオフをスコアに直接乗せられるようになりました。',
      '最初は Web dashboard が個人ツールの自然な UI に見えていましたが、実際の朝ルーチンが選択を決めました。最初に開かれるのはスマホ、しかもベッドから出る前です。メールはまさにその文脈に届きます：小さい画面でも流し読みできて、記録としてアーカイブでき、日付で検索できます。Dashboard なら能動的に開きに行く必要がありますが、メールは注意がもともと向いている場所に出てきます。',
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
]
