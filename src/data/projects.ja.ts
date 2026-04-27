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
      'オフラインファーストの旅行プランニング App。Google Maps、公共交通ルート、コスト管理、ドラッグ＆ドロップの旅程管理を統合。',
    ctaText: 'TRY IT',
    ctaUrl: 'https://trip-path.vercel.app/',
    tags: ['React', 'TypeScript', 'Supabase'],
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
      'AI 駆動のプロダクト企画システム。22 個のフレームワーク、6 つの実行モード、自動 dev handoff——ひと言のアイデアから完全な spec まで数分で。',
    ctaText: 'EXPLORE',
    ctaUrl: 'https://github.com/Kaminoikari/product-playbook',
    tags: ['Claude Code Skill', 'AI/LLM', 'Product'],
  },
]

export const projectDetails: ProjectDetail[] = [
  {
    id: 'path',
    title: 'Path — AI 旅行プランニング App',
    subtitle: '旅行プランニングを「何時間もかかるリサーチ」から、ドラッグ＆ドロップの体験へと変える AI SaaS プロダクト。',
    metaTitle: 'Path — AI 旅行プランナー | Charles Chen AI プロダクト事例',
    metaDescription:
      'Google Maps、公共交通、コスト管理を統合した AI SaaS 旅行プランニング App。台湾の AI Product Manager Charles Chen による実プロダクト事例。',
    problem: [
      '旅行プランニングは断片化しています。旅行者は 1 つの旅程を組むために、Google Maps、予約サイト、Excel、グループチャットの間を行き来しています。ルート計画・コスト管理・旅程管理を 1 つにまとめたツールは市場に存在せず、まして通信の不安定な海外でオフライン動作するものは皆無でした。',
      '既存の旅行 App は予約特化（Booking.com、Agoda）か、シェア特化（TripAdvisor）かのどちらかで、本当のプランニングワークフロー——「今日は何をする？どう行く？いくらかかる？」——を解いていません。',
    ],
    solution: [
      'オフラインファーストの旅行プランニング App を構築。コアはドラッグ＆ドロップで操作する 1 日単位の旅程タイムライン。各日が場所のタイムラインで、Google Maps の経路表示と統合され、移動時間・距離・コストが一目で分かります。',
      '最も重要なプロダクト判断はオフラインファーストにしたこと——すべての旅程データを local storage に同期し、通信がなくても旅行者が予定を確認できます。これは海外旅行者の最大の痛点を直接解きました。',
      'UX は「段階的な複雑さ」を軸に設計。まず行き先と日付だけを入力、そこに場所、ルート、コスト、メモを順に重ねていく。新規ユーザーは 2 分以内に最初の旅程を作れます。',
    ],
    techStack: [
      { category: 'Frontend', items: 'React, TypeScript, Tailwind CSS, PWA (Service Worker)' },
      { category: 'Backend', items: 'Supabase (PostgreSQL, Auth, Realtime)' },
      { category: 'Maps', items: 'Google Maps API (Places, Directions, Geocoding)' },
      { category: 'Deployment', items: 'Vercel' },
    ],
    impact: [
      'solo AI Product Builder として 0 から 1 まで作り上げたエンドツーエンドの AI SaaS プロダクト',
      'オフラインファースト構成——通信なしでも旅程にアクセス可能',
      '2 分以内のオンボーディングで最初の完全な旅程を作成',
      '完全なプロダクトライフサイクル（リサーチ → デザイン → 構築 → リリース）を体現',
    ],
    learnings: [
      'オフラインファーストは聞こえはシンプルですが、状態管理を慎重にやる必要があります。ローカルとリモートのデータ衝突解決が一番難しいエンジニアリング課題でした——last-write-wins と timestamp ベースのマージで解決。',
      'Google Maps API のコストはすぐに膨らみます。攻めのキャッシュ戦略（経路は 24 時間、場所は永続キャッシュ）で、UX を損なわずに API コストを抑えました。',
      'AI Product Manager 自身がプロダクトを作って分かった一番大きな気付きは、プロダクト判断から本番デプロイまで同じ午後で完結できると、イテレーション速度が一段違うということ。handoff の遅延も、spec の取り違えもありません。',
    ],
    links: [
      { label: 'Try Path', url: 'https://trip-path.vercel.app/' },
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
      'AI 駆動の株式分析プラットフォームを構築。Gemini AI を使って複数のデータソース——価格行動、テクニカル指標、機関投資家の売買パターン、財務レポート——を平易な言葉の個別株診断に統合します。',
      'コアとなるプロダクトイノベーションは「ワンタップ銘柄スクリーニング」：ユーザーが探しているもの（例：「成長中の割安テック株」）をひと言で記述すると、AI が銘柄を厳選し、それぞれの選定理由を返します。何時間もかかるマニュアル作業を置き換えるものです。',
      '予測トラッキングシステムを追加し、すべての AI 推奨を記録して長期の精度を追跡。ユーザーは AI のピックがどれくらい当たっているかを直接確認できる——透明性で信頼を築きます。',
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
      '動的キャッシュ戦略——取引時間中 5 分、引け後 1 時間、週末 24 時間',
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
      '既存の AI ライティングツール（ChatGPT、Notion AI）はテキストを生成できますが、プロダクトフレームワークを理解しません。JTBD 分析を適用したり、RICE スコア付き backlog を作ったり、user persona を機能要件にマッピングしたりはできない——汎用的な段落を生成するだけです。',
    ],
    solution: [
      'Claude.ai Custom Skill、Claude Code Plugin、Claude Code Skill の 3 つの配布チャネルにまたがる AI agent を構築。複数のプロダクトフレームワークを 1 つの spec 生成 pipeline にオーケストレーションします。ユーザーがひと言でプロダクトアイデアを記述し、実行モードを選ぶと、agent が完全な spec ドキュメントを生成します。',
      '重要なアーキテクチャ判断は、22 個の確立されたプロダクトフレームワーク（JTBD、Positioning、PR-FAQ、Pre-mortem、OST、RICE、PRD など）を free-form 生成ではなく構造化 prompt として使うこと。各フレームワークが、Discovery、Define、Develop、Deliver の 4 フェーズを通して、シニア PM の実際の思考パターンに AI の出力を制約します。',
      '6 つの実行モード——Quick、Full、Revision、Custom、Build、Feature Expansion——を設計し、PM が自分のプロダクト段階に合わせてツールの深さを選べるように。機能実験には 50 ページの spec は不要ですが、新規プロダクトのリリースには完全な dev handoff が必要です。',
      '上流の判断が変わったときに下流ドキュメントを自動更新する change propagation engine を構築。さらに 3 層 PDF パース（pymupdf テキスト抽出 → Claude Vision セマンティック → Tesseract OCR フォールバック）で、既存の PDF/DOCX/PPTX のリサーチ資料をそのままアップロードできます。',
      '自動 dev handoff が CLAUDE.md、TASKS.md、TICKETS.md を生成し、プロダクト要件を受入条件付きの技術タスクに翻訳して、PM → エンジニア間のコミュニケーションギャップを縮めます。',
    ],
    techStack: [
      { category: 'Platform', items: 'Claude.ai Custom Skill, Claude Code Plugin, Claude Code Skill' },
      { category: 'AI', items: 'Claude (Anthropic) — LLM orchestration, Claude Vision (PDF セマンティック解析)' },
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
      'マルチチャネル配布——Claude.ai、Claude Code Plugin、Claude Code Skill——でユーザーの既存ワークフロー内で出会う',
    ],
    learnings: [
      'LLM orchestration は単なるエンジニアリング課題ではなく、プロダクトデザインの課題です。フレームワークの実行順序が大事で——Persona を JTBD の前に走らせると、ユーザーコンテキストが job の特定を導くため、出力品質が上がります。pipeline の順序最適化にかなりの時間を使いました。',
      'Skill ベースの配布（Claude Code エコシステム）は強力なチャネルでした。ユーザーは新しいプラットフォームを採用する必要なく、既存のワークフローの中でツールを発見できます。',
      'AI Product Manager として AI agent を作って一番の気付き：プロダクトの価値は AI そのものではなく——フレームワークにあるということ。AI は配信メカニズムですが、22 個のプロダクトフレームワークこそが本当の知的財産です。LLM API は誰でも呼べる、差別化は何を聞くかを知っているかどうかです。',
    ],
    links: [
      { label: 'GitHub', url: 'https://github.com/Kaminoikari/product-playbook' },
    ],
  },
]
