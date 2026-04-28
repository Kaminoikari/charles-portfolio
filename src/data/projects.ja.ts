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
      'AI 駆動の台湾株分析プラットフォーム。リアルタイム株価、K 線チャート、Gemini AI による個別株診断、ワンタップ銘柄スクリーニング、予測トラッキングシステム。',
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
    title: 'Plutus Trade — AI 台湾株分析プラットフォーム',
    subtitle: '機関投資家レベルの分析を個人投資家へ届ける generative AI プロダクト。',
    metaTitle: 'Plutus Trade — AI 台湾株分析 | Generative AI プロダクト事例',
    metaDescription:
      'Gemini AI 個別株診断、K 線チャート、予測トラッキングを統合した AI 駆動の台湾株プラットフォーム。台湾の AI Product Manager Charles Chen による generative AI プロダクト事例。',
    problem: [
      '台湾の個人投資家は、機関投資家が使う分析ツールにアクセスできません。多くのリテール投資家は直感、SNS の噂、または「データは見えるけれど解釈はできない」シンプルな株価アプリに頼っています。',
      'ボトルネックはデータの入手性ではなく、分析能力です。K 線チャート、決算レポート、機関投資家の売買データはすべて公開されていますが、それらを行動可能なインサイトに統合するには、多くのリテール投資家が持っていない専門知識が必要です。',
    ],
    solution: [
      'AI 駆動の株式分析プラットフォームを構築。Gemini AI を使って複数のデータソース（価格行動、テクニカル指標、機関投資家の売買パターン、財務レポート）を平易な言葉の個別株診断に統合します。',
      'コアとなるプロダクトイノベーションは「ワンタップ銘柄スクリーニング」：ユーザーが探しているもの（例：「成長中の割安テック株」）をひと言で記述すると、AI が銘柄を厳選し、それぞれの選定理由を返します。何時間もかかるマニュアル作業を置き換えるものです。',
      '予測トラッキングシステムを追加し、すべての AI 推奨を記録して長期の精度を追跡。ユーザーは AI のピックがどれくらい当たっているかを直接確認できる、透明性で信頼を築く仕組みです。',
      '3 段階のサブスクリプションモデル（Free / Pro / Premium）を実装し、機能を段階的に解放。AI 分析の深さがティアごとに増し、ユーザーにアップグレードの明確な理由を提供します。',
    ],
    techStack: [
      { category: 'Frontend', items: 'Flutter (iOS)' },
      { category: 'Backend', items: 'FastAPI (Python), APScheduler' },
      { category: 'AI', items: 'Google Gemini 1.5 Pro' },
      { category: 'Data', items: 'FinMind API（台湾株データ）, Yahoo Finance API（グローバル株価）, Redis caching' },
      { category: 'Database', items: 'Supabase (PostgreSQL)' },
      { category: 'Deployment', items: 'Vercel' },
    ],
    impact: [
      'サブスクリプションモデルと決済統合を備えた完全な AI SaaS プロダクト',
      'Gemini AI 統合によるリアルタイム個別株診断（繁体字中国語）',
      '予測トラッキングシステムで履歴ベースの精度測定',
      '動的キャッシュ戦略：取引時間中 5 分、引け後 1 時間、週末 24 時間',
    ],
    learnings: [
      'LLM の出力品質は prompt 構造に大きく左右されます。明示的な出力フォーマット（JSON schema）と few-shot 例を組み合わせた構造化 prompt は、free-form prompt と比較して Gemini のハルシネーションを約 60% 削減しました。',
      '金融系 AI プロダクトには追加のガードレールが必要です。すべての AI 出力ページに免責事項を表示し、システムは明示的な売買推奨は出さず、分析のみを返します。これは規制を意識したプロダクト判断です。',
      'サブスクリプション SaaS を作って学んだのは、ティア間の差別化を明確にする重要性。最初のバージョンは Free 枠に詰め込みすぎてアップグレード理由がなく、「分析の深さ」を軸に再設計（basic → advanced → deep）したらアップグレード意向が明らかに高まりました。',
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
