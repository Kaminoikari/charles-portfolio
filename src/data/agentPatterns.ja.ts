// Charles's working reference on agentic design patterns. This is a curated
// knowledge source for the portfolio chatbot, not visible site UI: it lets the
// bot answer "does Charles know agentic design patterns / how does he apply X"
// from his real engineering practice. Every `howCharles` note is grounded in a
// system he has actually shipped (this corrective-RAG chatbot, the Product
// Playbook multi-agent system, his Claude Code / Codex builder workflows) or
// stated in measured terms where the tie is genuine but lighter — never invented.
//
// Pattern set and definitions follow Antonio Gulli's "Agentic Design Patterns"
// (the 21 core chapters). `name` keeps the English term across all locales;
// `body` is localized per file. The RAG ingest emits one chunk per pattern.

export interface AgentPattern {
  id: string
  name: string
  chapter: number
  body: string
}

// One-paragraph intro that frames the whole set as Charles's expertise.
export const agentPatternsIntro =
  'Agentic design patterns は、Charles が AI Product Builder として活用する再利用可能なビルディングブロックです。' +
  '以下のノートは、この corrective-RAG チャットボットや Product Playbook の' +
  'マルチエージェントシステムなど、彼が開発して本番投入したシステムに根ざしています。各パターンは、それが何か、' +
  'いつ手を伸ばすべきか、そして実務でどう適用しているかをカバーします。'

export const agentPatterns: AgentPattern[] = [
  {
    id: 'prompt-chaining',
    name: 'Prompt Chaining',
    chapter: 1,
    body: '一つの prompt では大きすぎるタスクを一連のステップに分解し、各ステップの出力が次のステップの入力となり、状態を引き継いでいく手法です。Charles はこれを Product Playbook で使っており、discovery、strategy、spec の各ステージを一つの pipeline につなぎ、曖昧なアイデアを実行可能な PRD へと変換します。',
  },
  {
    id: 'routing',
    name: 'Routing',
    chapter: 2,
    body: 'エージェントが受け取ったリクエストを分類し、適切な workflow、tool、または sub-agent へと振り分けます。これはこのチャットボットの背骨です。決定論的な triage 層が、あらゆる model 呼び出しの前に挨拶、連絡、injection の試みを振り分け、後段の grader が各質問を回答、書き換え、辞退のいずれかへルーティングします。',
  },
  {
    id: 'parallelization',
    name: 'Parallelization',
    chapter: 3,
    body: '独立した sub-task を同時に実行してから結果を統合する手法で、全体の所要時間は各処理の合計まで膨らまず、最も遅いブランチに収まります。Charles はこれを Product Playbook や Claude Code の workflow で、複数の sub-agent や framework のパスを並行してディスパッチする際に適用します。',
  },
  {
    id: 'reflection',
    name: 'Reflection',
    chapter: 4,
    body: 'エージェントが自らのドラフトをゴールに照らして批評し、修正する手法で、客観性のために独立した critic agent を置くのが理想です。Charles の仕事では二度登場します。チャットボットの自己修正ループは取得した context を自ら採点し、不十分なときには query を書き換えます。そして Product Playbook の strategy-critic と pre-mortem-runner は専用の critic agent です。',
  },
  {
    id: 'tool-use',
    name: 'Tool Use (Function Calling)',
    chapter: 5,
    body: 'model に構造化された関数を渡し、training data を越えてライブなシステムへ手を伸ばせるようにします。データベースへのクエリ、API の呼び出し、コードの実行などです。Charles は AI Product Builder としてこれを多用しており、Claude Code と Codex のエージェントが実際の tool を呼び出してフルスタックを構築しリリースし、このチャットボットも retrieval のために Qdrant へクエリを投げます。',
  },
  {
    id: 'planning',
    name: 'Planning',
    chapter: 6,
    body: 'エージェントが行動する前に、複雑なゴールを順序づけられた一連のステップやサブゴールへと分解します。Charles は Product Playbook をこの考え方を軸に構築しました。このシステムは一行のアイデアを、acceptance criteria を備えた、順序立てて実行可能な PRD へと変換し、さらにクリーンな開発の引き継ぎのために CLAUDE.md と TASKS.md を生成します。',
  },
  {
    id: 'multi-agent-collaboration',
    name: 'Multi-Agent Collaboration',
    chapter: 7,
    body: '一つの問題を、それぞれが独自の context を持つ専門エージェントに分割し、一つの成果へ向けて協調させます。これは Product Playbook の目玉となるパターンで、discovery-specialist、strategy-critic、pre-mortem-runner という三つのスペシャリストが別々の context window で動き、main agent がそれらの構造化された出力を統合します。',
  },
  {
    id: 'memory-management',
    name: 'Memory Management',
    chapter: 8,
    body: '短期的な会話の状態と、より長期的な知識を保持し、エージェントがターンやタスクをまたいでも一貫性を保てるようにします。Charles はエージェント構築において context を管理されたリソースとして扱い、各 sub-agent が見る範囲をスコープすることで、context が膨らんでも作業が逸れずに根拠へ留まるようにしています。',
  },
  {
    id: 'learning-and-adaptation',
    name: 'Learning and Adaptation',
    chapter: 9,
    body: 'エージェントが固定されたままとどまらず、経験から改善したり、変化する環境に適応したりできるようにします。Charles はこれに eval-driven なイテレーションで取り組みます。挙動を計測し、その知見を prompt とアーキテクチャへフィードバックし、サイクルごとにシステムを締め上げていきます。',
  },
  {
    id: 'model-context-protocol',
    name: 'Model Context Protocol (MCP)',
    chapter: 10,
    body: '統合ごとに専用のグルーコードを書くことなく、エージェントが外部の tool やデータソースを発見して呼び出せるようにする標準インターフェースです。Charles は Claude Code の workflow の中で MCP サーバーを扱い、エージェントを必要な tool やデータへ接続することで、配管を書き直さずに能力をスケールさせます。',
  },
  {
    id: 'goal-setting-and-monitoring',
    name: 'Goal Setting and Monitoring',
    chapter: 11,
    body: 'エージェントに明確な目標と、その進捗を追うための metrics を与え、自律性が説明責任を保てるようにします。Charles はこれを Product Playbook では acceptance criteria として、プロダクトの仕事では OKR 形式の目標としてエンコードし、何をもって完了とするかを最初から定義し計測可能にします。',
  },
  {
    id: 'exception-handling-and-recovery',
    name: 'Exception Handling and Recovery',
    chapter: 12,
    body: 'tool は失敗し、ネットワークは切れ、入力は予想を裏切るものと想定したうえで、リトライ、fallback、graceful degradation を組み込みます。Charles のチャットボットはこの思想で設計されています。grader が遅いときは context をそのまま素通しさせるよう劣化し、無料の Gemini ティアは何らかの失敗があれば Claude へフォールバックするため、一時的なエラーが行き止まりになることはありません。',
  },
  {
    id: 'human-in-the-loop',
    name: 'Human-in-the-Loop',
    chapter: 13,
    body: 'エラーの代償が大きい地点に人間のレビューや承認を挟み、クリティカルパス上に人を残します。Charles は自身の AI Product Builder のループでまさにその人間として動き、Claude Code と Codex が生み出したものを、リリースする前にレビューし舵取りします。',
  },
  {
    id: 'knowledge-retrieval-rag',
    name: 'Knowledge Retrieval (RAG)',
    chapter: 14,
    body: '回答を、model が学習したことのない外部の最新データや独自データに根拠づけ、検証可能で事実に基づいた出力を実現します。このチャットボットは Charles 自身の RAG システムです。Qdrant 上のハイブリッド retrieval で、dense な Voyage embeddings と BM25 の sparse を reciprocal rank fusion で融合し、その後 cross-encoder で rerank してから、引用つきの根拠ある生成を行います。',
  },
  {
    id: 'inter-agent-communication',
    name: 'Inter-Agent Communication (A2A)',
    chapter: 15,
    body: 'エージェントがリクエストと結果をどうやり取りするかを定義し、別々に作られたスペシャリスト同士でも協調できるようにします。Product Playbook では、sub-agent が構造化された YAML を返し、それを main agent が消費します。これは型づけられた契約として、マルチエージェントの引き継ぎを信頼できるものに保ちます。',
  },
  {
    id: 'resource-aware-optimization',
    name: 'Resource-Aware Optimization',
    chapter: 16,
    body: '計算リソース、レイテンシ、コストを意図的に使い、基準を満たす中で最も安い経路を選びます。Charles はこのチャットボットをコスト制御のカスケードとして設計しました。決定論的な triage と意味的な FAQ cache が、よくある質問を model 呼び出しなしで答え、生成はまず無料ティアで走り、必要なときだけより強力な model にコストを払います。',
  },
  {
    id: 'reasoning-techniques',
    name: 'Reasoning Techniques',
    chapter: 17,
    body: '問題が分解と可視化された中間ステップを必要とするときに、chain-of-thought、ReAct、tree-of-thought といった構造化された推論を用います。Charles は、答えと同じくらい答えに至る道筋が重要なエージェント構築でこれらを使い、推論を tool 呼び出しと組み合わせて各ステップを根拠あるものに保ちます。',
  },
  {
    id: 'guardrails-safety',
    name: 'Guardrails/Safety Patterns',
    chapter: 18,
    body: 'エージェントが受け入れ、出力する内容を制約し、入力と出力を検証することで、安全かつスコープ内に留まらせます。Charles はこれをチャットボットへ何層にも組み込みました。prompt-injection を逸らすディフレクター、すべての入力をデータとして扱う厳格な scope-lock、そして不快な内容を一切表に出さず、その場合は回答そのものを破棄する output backstop です。',
  },
  {
    id: 'evaluation-and-monitoring',
    name: 'Evaluation and Monitoring',
    chapter: 19,
    body: '本番環境で品質を計測しバージョンを比較することで、改善が感覚に頼らずエビデンスで駆動されるようにします。Charles はこのチャットボット向けに、golden question set、LLM judge、metrics を備えた eval harness を構築し、chat-log の insights を通じてライブな利用状況を追跡しています。',
  },
  {
    id: 'prioritization',
    name: 'Prioritization',
    chapter: 20,
    body: '現実の制約のもとで競合するタスクやゴールにランクをつけ、システムが最も重要なところへ労力を注げるようにします。Charles は RICE のような優先順位づけのフレームワークを、自身のプロダクトの仕事でも、Product Playbook が何を最初に作るかを順序づける仕方でも適用しており、メンティーにも同じことをコーチングしています。',
  },
  {
    id: 'exploration-and-discovery',
    name: 'Exploration and Discovery',
    chapter: 21,
    body: '固定された計画に従わず、仮説を生成して検証しながら、オープンエンドな問題空間で動きます。Charles はこれを Product Playbook の discovery-specialist や自身の opportunity-framing の実践へ組み込んでおり、それらはソリューションへ踏み込む前に問題空間を探ります。',
  },
]
