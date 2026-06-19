// Translation policy mirrors src/i18n/strings/ja.ts and the project's
// data files:
//   - Code identifiers, React APIs (useRef, IntersectionObserver,
//     React.lazy, Suspense), library names (React, Vite, Tailwind, GSAP,
//     Pixabay, Vercel, FastAPI), file paths (src/..., main.tsx,
//     vercel.json), CSS values (100vh, 100dvh, rgba()), browser APIs
//     (localStorage, hreflang, JSON-LD, Open Graph), and CSS class
//     fragments stay English.
//   - Section / UI markers that remain English in the live site
//     (Hero, About, Universe, Changelog, [ ABOUT ], CASE STUDY, IMPACT,
//     TECH STACK) keep the same form in titles for consistency with
//     what readers see on screen.
//   - Numerical values, units, file/byte sizes, durations are kept.
//   - Descriptive narrative prose is translated to Japanese
//     (です/ます tone matches tech-blog convention).

export type ChangelogTag = 'feature' | 'design' | 'technical'

// A body is a list of blocks. A plain string renders as a paragraph; the
// object forms render as a sub-heading, a bullet list, or a stats grid.
// Inline `code` (backticks) and **bold** are supported inside any text.
export type ChangelogBlock =
  | string
  | { kind: 'heading'; text: string }
  | { kind: 'list'; items: string[] }
  | { kind: 'stats'; items: { value: string; label: string }[] }

export interface ChangelogEntry {
  id: string
  date: string
  title: string
  body: ChangelogBlock[]
  tags: ChangelogTag[]
}

export const changelog: ChangelogEntry[] = [
  {
    id: 'rag-blog-fulltext',
    date: '2026-06-18',
    title: 'AI チャットボットの CRAG パイプラインにブログ全文検索を追加',
    tags: ['feature', 'technical'],
    body: [
      'サイトの AI チャットボットが、タイトルと要約だけでなくブログ記事の本文からも回答できるようになりました。これまでは各記事の見出しとサブタイトルしか埋め込まれていなかったため、「その記事が実際に何を論じているか」といった踏み込んだ質問には答えようがありませんでした。新しい取り込みパイプラインが各記事の本文を取得し、段落に分割して、ほかのコンテンツと並べて検索インデックスに追加します。',
      { kind: 'heading', text: '変更点' },
      {
        kind: 'list',
        items: [
          '**全文検索**：フェッチャーが Substack と Medium から各記事の本文をバージョン管理下のキャッシュに取り込みます。この処理はインデックス作成と意図的に分離しており、再構築のたびにライブ（かつレート制限のある）取得を待つことはありません。',
          '**言語を意識したチャンク分割**：依存関係ゼロの再帰的スプリッターが長文を重なりのある段落に分割し、英語だけでなく中国語の文の区切りも適切に扱います。',
          '**設計段階から多言語対応**：記事は中国語で書かれていますが、多言語埋め込みにより英語や日本語の質問でも取得でき、より深い答えがどの言語でも表に出てきます。',
          '**ポートフォリオの内容を優先**：検索ではサイト自身のキュレーションされた情報（プロフィール、プロジェクト、経歴）を外部記事より上位に重み付けし、ブログの余談が一次情報を埋もれさせないようにしました。',
        ],
      },
    ],
  },
  {
    id: 'enter-gate-loader',
    date: '2026-06-10',
    title: 'エンター前のローディング演出を作り直した',
    tags: ['design', 'technical'],
    body: [
      'ヒーローポートレートの前に表示されるスプラッシュは、単なるパーセント表示に代わって、リズムのあるローディングシーケンスになりました。黒い画面の中央で発光するメビウスの帯が回転し、その下でステータス文がローテーションし、画面下部のヘアライン状のプログレスバーが 0 から満了まで走り切ってから、Enter コントロールが登場します。',
      { kind: 'heading', text: '変わったこと' },
      {
        kind: 'list',
        items: [
          '**リアルタイム描画のメビウスの帯**：ローディングシンボルは小さな canvas にパラメトリックなメビウスの帯をリアルタイムで描いたもので、retina 画面でも鮮明なまま、背後のポートレートと同じワイヤーフレームと発光の言語を話します。',
          '**必ず物語るプログレスバー**：表示する進捗は「固定 2 秒のスイープ」と「実際のダウンロード進捗」の遅い方を採用します。キャッシュで一瞬に読み込まれても落ち着いた到着として読め、回線が遅いときはバーが正直に進みます。',
          '**段階的な引き継ぎ**：バーが満了すると一拍発光し、ステータス文とバーが一緒にフェードアウトし、その場所に ENTER が裸のテキストとして開花します。字間が落ち着き、両脇からヘアラインが外へ伸びていきます。ホバーすると字間が広がり、ラインが灯り、文字が幾層もの光に包まれます。',
        ],
      },
    ],
  },
  {
    id: 'hero-webgl-portrait',
    date: '2026-06-09',
    title: 'ヒーローを即時演算の WebGL ポートレートに作り直した',
    tags: ['feature', 'design', 'technical'],
    body: [
      'トップページのオープニングは、私自身の顔の 3D ポートレートになりました。three.js と WebGL でブラウザ内にリアルタイム描画し、従来の Canvas 2D パーティクルヒーローを置き換えています。Enter を押すと走査線が顔をなぞり、ハーフトーンの点群をライティングされたワイヤーフレームへと変え、また元へ戻します。機械が人を見分ける前に、まず観察するように。いま公開しているのは、三日間と七十あまりのコミットを経て生き残ったバージョンで、回り道の一つひとつが計画と同じくらい最終形を形づくりました。',
      { kind: 'heading', text: 'ここまでの道のり' },
      {
        kind: 'list',
        items: [
          '**素体の頭から始める**：お題は、ポートレートを自分自身の顔にすることでした。ジオメトリは汎用の male_base 頭部モデルが受け持ち、そこへ写真を焼き込んで頂点ごとに明るさをサンプリングし、同じジオメトリを点、線、陰影付きメッシュの三通りで同時に描画します。点群が面影を、ワイヤーフレームが構造を担い、走査線はどちらを見せるかを決めるだけです。',
          '**実らなかった平面の顔**：それより前の試みは、写真を 2.5D の Delaunay レリーフへ三角形分割する方式でした。背景の切り抜き、蜘蛛の巣のような細長い三角形の除去、輪郭の引き締めと、ほとんどの時間を格闘に費やしましたが、カメラが動いた瞬間、やはり紙の切り抜きにしか見えません。これを破棄したことで、頂点ごとの焼き込み方式が決まりました。',
          '**午前二時のしかめ面**：目のレーザーの隠し演出は、当初は顎を落として大きく吠える口でした。唇のリングを締め、顎の蝶番を直すコミットを五つ重ねても口はメッシュを裂いてしまい、午前二時に吠えるのをやめ、口を結んだ険しいしかめ面に差し替えました。結果として、この頭の性格には吠えよりずっと合っています。',
          '**iOS 音声との戦い**：レーザー音だけで十数コミットを要しました。途切れないループ、サイレントスイッチが入っていても鳴る再生、タップ操作の中でのアンロック。Web Audio と HTMLAudio を行き来して、ループと iOS の両方が納得するまで続けました。',
          '**プロトタイプから製品へ**：承認されたプロトタイプを React コンポーネントへ仕上げる工程が残っていました。ライフサイクルを持つエンジンモジュールの切り出し、ブルームパスの GPU メモリリークの追跡、オープニング音を正しく鳴らすための Enter ゲート、そしてタッチとスクロールの取り合い、アドレスバー収納時のズーム跳ね、小さい画面で薄くなる塵の場といった、モバイル調整の長い尻尾です。',
        ],
      },
      { kind: 'heading', text: '見えるもの' },
      {
        kind: 'list',
        items: [
          '**光の点でできた顔**：ポートレートは数千の点で描かれ、各点の明るさは 3D 表面に焼き込んだ写真から得ています。頭がカーソルに合わせて回っても、面影がきちんと保たれます。',
          '**変形する走査**：動く走査線が通り過ぎた跡で点群を陰影のあるワイヤーフレームに変え、やがて静かに戻します。同じジオメトリが二通りに読み取れます。',
          '**細部の個性**：冒頭の赤い走査、目のレーザーの明滅、そして走査の後も消えずに漂い続ける細かな塵。',
        ],
      },
      { kind: 'heading', text: 'どう描画しているか' },
      {
        kind: 'list',
        items: [
          '**一つのパイプライン、二つの見え方**：点群ポートレートは GPU で、ワイヤーフレームは CPU 側でライティングし、走査線の位置に応じて混ぜることで、遷移を滑らかに保ちます。',
          '**ふるまいへの配慮**：画面外にスクロールしたりタブが背面に回ると自動で停止し、reduced-motion の設定を尊重し、WebGL が使えない場合は静止画にフォールバックします。',
          '**タップで始まる音声**：Enter スプラッシュがあるのは、入ることを選んだ瞬間にオープニング音と環境音を鳴らすためです。ブラウザはユーザー操作の後でしか音を再生しないからです。',
        ],
      },
    ],
  },
  {
    id: 'rag-chatbot',
    date: '2026-05-31',
    title: 'ポートフォリオ AI チャットボットを公開',
    tags: ['feature', 'technical'],
    body: [
      'サイト隅の「このポートフォリオに質問」ボタンを押すと、私が一から設計・構築したチャットボットが開きます。英語・中国語・日本語で私の仕事について答え、私の実際のポートフォリオデータのみに基づくので、作り話はしません。実際に動く AI エンジニアリング作品として、パイプラインのすべての層を自分で設計・構築しました。',
      { kind: 'heading', text: '質問にどう答えるか' },
      '使っているのは RAG（検索拡張生成）です。まずポートフォリオから関連する事実を探し、それに基づいて答えを書くので、すべての回答が取得した根拠の上に成り立ちます。私のものはさらに「自己修正する」RAG で、自分の回答をチェックします。',
      {
        kind: 'list',
        items: [
          '**自己修正するパイプライン**：LangGraph 上に複数のステップとして構築：質問を仕分け → 関連内容を検索 → その内容が十分か評価 → 回答を作成。評価が低ければ質問を言い換えて再検索し、それでも見つからなければ推測せず正直に答えられないと伝えます。',
          '**ハイブリッド検索（Qdrant）**：どの答えも二通りで同時に探します。「意味」（Voyage AI のベクトル）と「キーワード」（BM25）で検索し、結果を統合して関連度で並べ替えます。「彼のプロダクト哲学は？」のような曖昧な質問も、正確な語句が必要な質問も両方拾えます。（無料枠の上限に達したため Supabase から Qdrant へ移行。）',
          '**2 つの言語モデル、コストに応じて分担**：速くて無料のモデル（Gemini）がまず答え、Gemini が失敗したときだけ自動的に高性能な有料モデル（Claude）が引き継ぐので、訪問者がエラーを見ることはありません。',
          '**関係グラフ**：手作りの小さな関連マップ（私 ↔ 役割 ↔ プロジェクト ↔ ツール）により、「どのプロジェクトが Claude を使う？」のような複数の事実をまたぐ質問にも答えられます。',
        ],
      },
      { kind: 'heading', text: '低コストで動くよう設計：ほとんどの質問は有料モデルを呼ばない' },
      {
        kind: 'list',
        items: [
          '**即時ルール**：よくあるケースは単純なパターンマッチで処理し、AI コストはゼロ。プライバシーの質問（年齢・家族・給与など）は丁寧に「Charles に直接お問い合わせを」、挨拶や連絡先の質問は定型回答を返します。',
          '**回答キャッシュ**：約 50 のよくある質問には事前作成の回答（3 言語すべて）を用意。訪問者が似た質問をすると、対応する回答を直接返し、言語モデルは一切呼びません。本当に新しい質問だけが完全なパイプラインに進みます。',
          '**スマートな振り分け**：評価器が「回答可能」「私に関するが未記載」「無関係」を区別するので、無関係な質問（一般的な雑学）は再試行せず一度で断ります。',
        ],
      },
      { kind: 'heading', text: 'セキュリティ：悪用への多層防御' },
      '公開チャットボットは「プロンプトインジェクション」（ルールを無視させたり有害な発言をさせたりする手口）の標的です。3 層で防御します。',
      {
        kind: 'list',
        items: [
          '**入力チェック**：AI が動く前に操作の試みを検出：「指示を無視して」、偽の「開発者モード」、ロールプレイ／多重人格、そしてコード・エンコード・穴埋めゲームの中に侮蔑語を隠す謎かけ。',
          '**スコープの固定**：モデルにはすべてのメッセージをただのデータとして読み、その中に紛れ込んだ指示は無視するよう指示しています。私に関する本当の質問でなければ：数学や言葉遊びに偽装されていても：拒否します。',
          '**出力チェック**：最終フィルタが、どう誘導されても侮蔑語を含む回答を丸ごと破棄します。',
          '**安定性**：モデル呼び出しの fail-fast、呼び出しごとのタイムアウト、メインフローを止めない評価器で、サービスが固まらないようにしました（以前はレート制限下でたまにタイムアウトしていました）。',
        ],
      },
      { kind: 'heading', text: '正確さと稼働をどう保つか' },
      'チャットボットの知識は、このサイトを描画するのと同じデータファイルから作られるので、ポートフォリオの実際の記載と矛盾することはありません。再インデックスはワンクリックの GitHub Action で実行し、全体は Vercel 上にサイトと同一オリジンでデプロイ、回答はタイピングのように 1 文字ずつストリーミングされます。',
      'スタック：LangGraph.js · LangChain.js · Qdrant · Voyage AI · Gemini · Claude · React · Vercel。',
    ],
  },
  {
    id: 'product-playbook-closed-loop',
    date: '2026-05-29',
    title: 'Product Playbook v1.2.12 — 閉ループ自己修正システム（Closed-Loop Self-Correction）',
    tags: ['feature', 'technical'],
    body: [
      'Product Playbook v1.2.12 は、このスキルの「手回し式」反復フローを**半自動の閉ループ**へ進化させます：1 つのコマンドで全周、テスト実行 → 失敗したルールを特定 → LLM で修正案を提示 → 5 言語へ同期 → 改善幅を計測 → 収束したか判定、を回せます。',
      { kind: 'heading', text: 'なぜ作ったか' },
      'このスキルは 22 の PM フレームワーク（JTBD、PR-FAQ、OST、Persona…）を 6 言語にわたって搭載するプラグインです。これまではルールを 1 つ調整するたびに、手動で eval を回し、どの eval が後退したか確認し、ファイルを編集し、翻訳を 5 ロケールへ同期し、再度回して確認する必要がありました、1 周 30〜60 分かかり、どこかの言語を取りこぼしがちでした。さらに悪いことに、その変更が本当にスキルを良くしたのかを客観的に教えてくれる指標がありませんでした。今回の iteration はこのワークフローをコード化します。',
      { kind: 'heading', text: '追加した中核機能' },
      {
        kind: 'list',
        items: [
          '**`loop-tick` オーケストレーター**：1 コマンドで全周：debt-report（どの eval が失敗し、重みはいくつか）→ patch-proposer（LLM が Hard Gate の修正を提案、`--dry-run` がデフォルト）→ i18n-mirror-apply（5 言語へ同期）→ drift-report（ドリフトが残っていないか確認）→ `loop-history.jsonl` に JSON を 1 行追記。各ステージが自身の経過時間を記録します。',
          '**i18n ドリフト検出 + 自動翻訳**：`i18n-drift-report` は英語ソースと 5 ロケール全部を純 Python で比較し（ルール数、Hard Gate 数、fear / anxiety / shame など 10 個の感情語）、`i18n-mirror-apply` は `claude -p` で新規ルールを 5 言語へ翻訳します。30 対のファイルの暗黙のドリフトを発見・修正し、その中には一度も同期されたことのない canonical vocab リストも含まれていました。',
          '**改善を計測するツール**：`eval-lift-report` は「本物の硬い改善」とテストセットが緩んだだけの「幻の改善（phantom lift）」を切り分け、`attribution-check` は「A ファイルを編集 → eval B が反転するはず」が実際に起きたかを検証し、`loop-summary` は複数の tick を横断して converged / improving / stalled / regressing / insufficient-data の 5 つの裁定のいずれかを ASCII sparkline 付きで返します。',
          '**安全ゲート**：eval-freshness gate は eval が最後のルール編集より古い場合に実行を拒否し、`suppress-pair` はある file/eval ペアを手調整中とマークして自動化に触らせず、すべての LLM subprocess に timeout を持たせました（以前は単一のハングで CI を 90 分燃やしていました）。',
          '**CI 3 つのゲート**：`test-closed-loop.yml` が PR ごとに 77 個の単体テストを実行、`debt-check.yml` がその PR が影響する見込みの eval を列挙、`i18n-drift-check.yml` が critical なドリフトにコメント。費用のかかる behavioural eval は manual-only に変更しました（自動実行はサブスク quota を焼き尽くしていました）。',
        ],
      },
      { kind: 'heading', text: '品質への投資' },
      '15 ラウンドのレビュー、4 つの commit 波にわたって 25 個のバグを発見・修正しました、その中には history に score が無いとき NoneType の減算でクラッシュする `judge()`、Python の `lines[-0:]` が全件をスライスするため全記録を残してしまう `--keep-last 0`、CI の i18n 文字列を mojibake させる `encoding="utf-8"` 未指定の `read_text`/`write_text` が 9 箇所、などがありました。今では単体テストが `scripts/_config.SEVERITY_WEIGHTS` を `evals/compute_eval_score.SEVERITY_WEIGHTS` と等しく固定するので、orchestrator が見るスコアが eval の出すスコアと黙って乖離することは二度とありません。',
      {
        kind: 'stats',
        items: [
          { value: '23', label: 'commits / 20 時間' },
          { value: '76', label: 'files 変更' },
          { value: '+7,787 / −342', label: 'net lines' },
          { value: '77', label: '単体テスト' },
          { value: '6', label: '対応言語' },
          { value: '0', label: 'CI の LLM token コスト' },
        ],
      },
      { kind: 'heading', text: '学んだこと' },
      {
        kind: 'list',
        items: [
          '**「半自動」は「全自動」よりずっと現実的**：各 LLM ステージはデフォルトで dry-run、`--apply` を付けて初めて実際に動きます。eval は常に人間のコマンドで実行します、CI で自動実行するとサブスク quota を焼き尽くすからです。',
          '**バグを 1 つ直すごとに unit test を 1 つ書く**：15 ラウンドのレビューが新しい問題を掘り続けられたのは、テストが修正済みの箇所を固定し、次のブロックを安心して触れたからです。',
          '**設定値の集中管理が命綱**：`_config.py` + env override により、「CI では短い timeout」「ローカルテストでは 1 秒 timeout」が 1 行の設定で済みます。',
          '**クロスソースの一貫性はテストで強制する**：orchestrator の `SEVERITY_WEIGHTS` と eval の値は等しくなければスコアが乖離します。今では 1 つの unit test で両者を固定し、二度と黙ってドリフトしません。',
        ],
      },
    ],
  },
  {
    id: 'product-playbook-multi-agent',
    date: '2026-05-21',
    title: 'Product Playbook アップグレード — Multi-Agent System アーキテクチャ',
    tags: ['feature', 'technical'],
    body: [
      'Product Playbook v1.2 で 3 名の専門家 Sub-agent（discovery-specialist、strategy-critic、pre-mortem-runner）を投入しました。各 Sub-agent は独立した context window で稼働し、自身が担当するフレームワーク知識のみを携え、ツールセットは読み取り専用（Read / Grep / Glob / WebSearch）に厳格に制限されます。責務外の要求に対しては `out_of_scope` を返却し正しい承継者を指名、結果は structured YAML として main agent に返して統合されます。Iteration 5 の A/B 評価では、Sub-agent レイヤーが Skill ベースラインに対して +40.9% を上乗せ（アサーション通過率が 59.1% から 100% へ、両アームのトークン消費は約 152K で完全に同等）。とりわけ pre-mortem-runner が耐荷重の中核で、22.2% から 100% への +77.8% 跳ね上がりを単独で担います。/projects/product-playbook のケーススタディを zh-TW / en / ja の 3 言語で Multi-Agent 視点に全面書き直ししました。',
      'ディテールページのレンダラーに optional `features[]` フィールド（label + description）を追加し、サブタイトル直下に 4 枚カードの hero ブロックとして表示します。[ 課題 ] / [ 解決策 ] / [ IMPACT ] のパラグラフは `label：content`（英語の `label: content` も対応）を自動でバレットロウへ変換し、ラベルを太字でハイライト。[ 学び ] は引き続きプローズ表示。ラベル内の 40.9% のような小数点もパーサを誤動作させません。',
    ],
  },
  {
    id: 'job-ops-launch',
    date: '2026-05-14',
    title: 'Job Ops が Portfolio に合流 — 応募者側に反転させた ATS パイプライン',
    tags: ['feature'],
    body: [
      '5 つ目のサイドプロジェクトとして Job Ops を追加しました。/projects/job-ops のケーススタディは、HR 側の ATS ロジックを応募者側に反転させた Python パイプラインを紹介します：macOS launchd が毎朝 07:00 に起動し、httpx で 104 の検索・詳細 API から求人を取得、CV-aware evaluator（cv_reader が履歴書を解析、archetypes.yml の候補者アーキタイプに照合）が加重採点し、RECOMMEND / CAUTIOUS / SKIP の 3 段に分類、inline-styled HTML と Markdown 双子版のダイジェストを Gmail SMTP で配信します。インタラクティブ層は house-ops と同じ二層構造で、7 つの Claude Code モード（cv-match、comp-research、legitimacy、level-strategy、interview-prep、personalization、role-summary）が会話的深さを必要とする判断を担います。',
      'ホームのカードアニメーションは Portfolio に新しい視覚言語を追加します。実際の 104 求人由来のトークン（「Python」「資深」「90K」「遠端」「Senior」「5y」）が縦のストリームでキャンバスを落下します。y=150 に mars オレンジの CV-MATCH スキャンラインが横たわり、CV と紐づくトークンが線を横切るたびに glyph が mars ハローと共に閃光します。スキャンラインの下では「07:00 DAILY DIGEST」パネルが 1 行ずつ materialize し、計 3 件（Senior AI PM 4.6 / Growth PM 3.8 / Junior Data PM 2.9）が表示。スコア帯ごとに表現を変え、RECOMMEND は mars の塗り潰しドット、SKIP はより淡い白で示します。静止フレームでは飛行中の雨と満タンのダイジェストを凍結し、ホバーなしでもカードが完成形の製品として読める状態を維持します。',
    ],
  },
  {
    id: 'house-ops-fb-integration',
    date: '2026-05-07',
    title: 'House Ops マルチソース化 — FB 公開グループ + Claude API 抽出',
    tags: ['feature', 'technical'],
    body: [
      'House Ops の上流が「591 のみ」から「591 + Facebook の公開賃貸グループ」へ拡張されました。FB 統合は Chrome DevTools Protocol の `Input.synthesizeScrollGesture` 合成タッチジェスチャを採用してページングを実現します（Facebook の Graph API Groups エンドポイントは 2024 年 4 月に完全廃止済み）。Facebook はこの合成ジェスチャを実機トラックパッドのスクロールとして扱うため、anti-bot の lazy-load 検出を回避できます。専用 Chrome インスタンスは別の launchd plist（com.house-ops.chrome-debug.plist）で KeepAlive 起動され、プロファイルは普段使いの Chrome と隔離、cookie は初回手動ログイン後に永続化されるので、再起動後もログイン不要です。FB の自由文の投稿は Claude API（Haiku 4.5）で `{price_num, address, district, size, layout, contact, confidence}` に構造化抽出され（投稿あたり約 USD 0.001）、591 物件と同じ 5 次元加重スコアリングに統合され、日次 HTML サマリーには 591 と FB のセクションが並んで配信されるようになりました。',
      '/projects/house-ops のケーススタディも同時に更新しました：detail title を「591 Data Automation」から「Taiwan Housing Automation」へ拡張してマルチソース範囲を反映し、Tech Stack に Browser Automation（CDP）と LLM Extraction（Claude API）の 2 行を追加、Sources を「591 + Facebook 公開賃貸グループ」に変更しました。インタラクティブモード一覧に `upgrade plan` を追加し、対象ユーザーを「賃貸族 / 初購族」から「賃貸族 / 初購族 / 住み替え族」の 3 シナリオに拡張。learnings には FB anti-bot 攻略の経緯（純 JS scroll、agent-browser scroll、keyboard PageDown、CDP dispatchMouseEvent はすべて失敗し、合成ジェスチャでのみページングが機能した）を反映しました。card tags に `Claude API` を追加し、新たな LLM 抽出能力を明示しています。',
    ],
  },
  {
    id: 'path-demo-remotion-pipeline',
    date: '2026-05-06',
    title: 'Path ケーススタディ：30 秒の Remotion デモ動画',
    tags: ['feature', 'technical'],
    body: [
      'Path 詳細ページ（/projects/path）に 30 秒の autoplay loop デモ動画を追加しました。Path ケーススタディ初の動画であり、リポジトリ初の Remotion レンダリング資産でもあります。1404×1128 / 30fps の動画は 9 つのシーンを巡ります：マーケティング hero とブランド雰囲気、4 つの機能グリッドに cyan stagger ハイライト、ダッシュボード KPI 概要（3 TRIPS · 24 DAYS · 491 KM）、我的行程 の行程カード一覧、Day 4 を持ち上げて新しい位置にドロップする drag-to-reorder の Day editor、アジア路線マップ（491 km）、費用詳細（NT$95,454）、AI レシート OCR スキャナ、オフラインモード banner が完全にロードされた dashboard に重なるシーン、最後の Path ワードマークを mars-orange の放射光で締めます。',
      '技術スタック面では、Vite アプリとは別に /remotion/ workspace を新設しました。Composition が PathDemo を 1404×1128 / 30fps で登録し、シーンファイルは Sequence + interpolate + spring で ken-burns パン、stagger カードの pulse、crossfade を構成します。当初は Codex image_gen で静的イラストを生成する予定でしたが、codex exec の非対話モードでは image_gen ツールにアクセスできず、pipeline を Playwright で実際のプロダクト画面をキャプチャする方式に切り替えました（既存のログイン済み Path セッションを駆動し、オフラインシーンでは navigator.onLine をトグル）。drag-to-reorder のシーンは当初リアルタイム録画で撮る計画でしたが、Playwright MCP には動画録画ツールが組み込まれていないため、Playwright で 5 つの keyframe（静止 / 持ち上げ + cyan border / ドラッグ中 / 新スロットの上にホバー / ドロップ後）を撮影し、Remotion で crossfade して連続的な動きに見えるよう再構成しました。レンダリング結果は 5.6MB（CRF 26）、/assets/path-demo.mp4 として配信され、projects.{en,ja,zh-TW}.ts の既存 screenshot schema を継承します。',
    ],
  },
  {
    id: 'add-house-ops-personal-project',
    date: '2026-04-29',
    title: 'Personal Projects — House Ops を追加',
    tags: ['feature'],
    body: [
      '4 つ目の personal project として House Ops を追加しました。Node.js（ESM）の自動化パイプラインで、macOS launchd 経由で毎朝 09:00 に 591 をスキャンし、各賃貸・購入物件を 5 つの加重次元（価格妥当性、スペースと間取り、周辺環境、物件状態、リスク）で採点し、nodemailer + Gmail SMTP で HTML サマリーを配信します。永続化された tracker が評価済み物件を Scanned → Evaluated → Visit → Signed のライフサイクルで管理し、Claude Code のインタラクティブレイヤーがセッション内の支払い能力試算、買い替えプラン分析、サイドバイサイド比較、内見当日チェックリストを担います。',
      'House Ops は Plutus Trade、Product Playbook と同じ軸に並ぶ、audience-of-one の個人ツール事例です。技術選択（launchd スケジューリング、加重次元採点と 3 つの決定バンド、メールサマリー配信）は、朝のルーチンで実際にどう使われるかから逆算しています。ページは /projects/house-ops にあり、スクリーンショット 2 枚（日次サマリーと物件別評価）と、完全な problem / solution / tech stack / impact / learnings の構成を 3 言語で提供します。',
    ],
  },
  {
    id: 'i18n-content-translation',
    date: '2026-04-28',
    title: '多言語コンテンツ — 全量翻訳の仕上げ',
    tags: ['feature'],
    body: [
      'i18n アーキテクチャが英語の placeholder のまま残していたすべての locale データファイルを埋めました。/zh-TW/ と /ja/ の経路は各言語でエンドツーエンドに読めます：About ページ（Who I Am のナラティブ、Product Philosophy の bullets、How I Use AI テーブル、Skills テーブル）、experience タイムライン、3 つのプロジェクトケーススタディ（Path、Plutus Trade、Product Playbook）、universe section に漂う skill names、そして約 3,200 語の changelog 本体：shader の作業、アニメーションのリファクタ、scroll restoration、GEO/SEO 戦略、オーディオシステムなど。',
      '各翻訳は、すべての locale ファイル冒頭に明記されたポリシーに従っています。プロダクト名（Path、Plutus Trade、Product Playbook、USPACE）、技術スタック（React、Flutter、Supabase、FastAPI など）、フレームワーク名（JTBD、RICE、OKRs、AARRR）、業界用語（B2B SaaS、builder、Product Builder、MaaS）、コード識別子、React/browser API（useRef、IntersectionObserver、localStorage、hreflang）、ファイルパス、CSS 値、英語の UI マーカー（[ ABOUT ]、CASE STUDY、IMPACT、TECH STACK）はすべて英語のままで、台湾と日本の PM が実際に書くスタイルに揃えており、翻訳すると不自然になります。説明文、problem/solution の段落、bullet 見出し、技術ナラティブは翻訳されています。',
      'Blog section については、繁体字中国語で公開された記事は /zh-TW/ では原題と原副題をそのまま残しています（公開コピーと一致）。/ja/ では、各記事のトピックを日本語読者向けに説明するため、タイトルと副題を日本語に翻訳しました。日本のテックブログが外国語の記事を読者向けに要約する慣習と同じです。リンク先は依然として Substack/Medium 上の繁体字中国語の原文です。',
      'トーンは、日本語が既存の data ファイルに揃えた です/ます 体、繁体字中国語は台湾 PM の声で、技術的な context が実際そう書かれる場面では自然に英中を混ぜます。Portfolio 全体が、すべてのページ、すべてのデータファイルで、3 つの locale すべてに対して i18n 完了。TODO 標記は残っていません。canonical な英語 Strings interface に対する型チェックは通過するため、locale 間の今後のずれは build time で表面化します。',
    ],
  },
  {
    id: 'hero-easter-egg-mobile-polish',
    date: '2026-04-27',
    title: 'Hero — Easter Egg モバイル最適化',
    tags: ['design', 'technical'],
    body: [
      'モバイルで easter-egg ポートレートに悪影響を与えていた 2 つの問題を修正。1 つ目、hero text、「click the logo 5 times」hint、SCROLL インジケーターが photo phase 中も完全な不透明度で残り、ポートレートが小さい viewport に収束した時点で重なっていました。各 overlay に専用の ref を持たせ、egg phase machine に連動した render-loop 内のフェードで egg t=1.25s から t=1.55s（shader の photoHide に合わせる）にかけて消し、ポートレート全体の間は隠したまま、reverse phase 開始の 0.15s でフェードイン。ポートレートはどの画面サイズでもクリーンなステージに着地します。',
      '2 つ目、ポートレートの sampler は edge-only でした：ソース PNG への 4 方向 Laplacian でシルエット、目、眉、口の輪郭線だけを残していました。モバイルでは内側が空の hollow wireframe に見え、顔として読めませんでした（頬、額、首の領域が空だったため）。スパースな内部塗りを追加：写真領域内 5 ピクセルごとに低 weight（6）で particle pool に入れ、ソート後に最も暗いパーティクルを得る一方、強いエッジは引き続き最も明るいものを獲得します。顔は小さい表示サイズでは肉付きのあるポートレートとして読まれ、デスクトップサイズではシルエットを定義していたクリーンな線画も失われません。',
    ],
  },
  {
    id: 'i18n-architecture',
    date: '2026-04-27',
    title: '多言語サイト — English / 繁中 / 日本語 アーキテクチャ',
    tags: ['feature', 'technical'],
    body: [
      'Portfolio が英語（root デフォルト）、繁体字中国語（/zh-TW/* 配下）、日本語（/ja/* 配下）を提供できるよう i18n アーキテクチャを追加。英語のエントリーは bare URL のまま（/en/ プレフィックスは付けません）、既存のインバウンドリンクと SEO は検索エンジンが期待する場所にそのまま着地します。Locale プレフィックスのブランチは同じ route table を共有し、すべてのページ（home、About、ケーススタディ、changelog）が各 locale で対応するパスに存在します。Router は URL プレフィックスから locale を解決し、初回訪問でブラウザ言語からの自動検出は行いません。',
      'i18n ライブラリなしで構築。react-i18next と react-intl はこのサイトに不要な機能（ICU formatting、複数形ルール、namespace lazy load）を備えており、それぞれ約 50KB を加えます。代わりに小さなカスタム層を実装：locale ごとの typed strings dictionary（英語ファイルが canonical な Strings interface を定義し、zh-TW と ja は構造的に満たす必要があるため、欠落した翻訳キーは build time で浮上）、active dictionary から dotted-path の文字列を取り出し簡単な {{var}} 補間に対応する useT() hook、各 locale ブランチをラップして `<html lang>` を active locale と同期させる LocaleProvider。',
      'Per-locale データアーキテクチャは同じパターンに揃えています：各コンテンツファイル（projects、changelog、experience、blog、skills）を .en.ts / .zh-TW.ts / .ja.ts に分割。Locale-aware loader（src/data/index.ts）が useProjects()、useChangelog() などを公開し、active locale に対応するデータセットを返し、翻訳ファイルにエントリが欠けていれば英語にフォールバックします。翻訳コピーは英語と TODO マーカーで始め、サイトは即座にデプロイ可能で、翻訳者はアーキテクチャを動かさずに段階的に埋められます。',
      'SEO 表面も locale-aware に。useDocumentMeta() helper がすべてのルートで document.title、meta[name=description]、canonical link、そして完全な <link rel="alternate" hreflang> タグ群（en、zh-TW、ja、x-default）を更新します。hreflang URL は各 locale で対応するパスを指すため、Google、Baidu などのクローラーは audience に応じて適切なバージョンを提示できます。index.html に元々あった、すべての locale を同じ英語 root に向けていた静的な hreflang は置き換えました。',
      'Persistence は opt-in のみ。初回訪問時のブラウザ言語自動検出は無し。プレフィックスのない root は常に英語を render。ただし、ユーザーが言語スイッチャーをクリックした時点で選択が localStorage に書き込まれ、再訪者は最後に選んだ locale に着地します（プレフィックスのない root は /zh-TW/ または /ja/ に一度だけ redirect）。英語に戻すと redirect はクリアされます。',
      'Nav にコンパクトな 3 ボタン言語スイッチャーを追加（デスクトップ：CONTACT ボタン横の pill グループ；モバイル：hamburger menu 内、divider で区切る）。切替時に現在の sub-path を保持（/about → /zh-TW/about → /ja/about）、閲覧途中で言語を変えても home に戻されません。',
    ],
  },
  {
    id: 'hero-easter-egg-braam-sfx',
    date: '2026-04-27',
    title: 'Hero — Easter Egg シネマティック Braam SFX',
    tags: ['feature', 'design'],
    body: [
      'Easter-egg シーケンスに映画予告編風の braam サウンドエフェクトを組み合わせました。トリガー時にオーディオを offset し、特徴的な 50dB attack transient が COLLAPSE_END（egg elapsed ~0.80s）：シンギュラリティが最大圧縮に達し白いフラッシュが点火する瞬間に正確に着地するようにしています。Braam は flash と explode phase を貫いてうねり、パーティクルがポートレートに収束する間も鳴り続け、長い decay tail は photo-hold と reverse phase まで響きます。',
      '単一の遅延再生 `setTimeout` で配線：オーディオは egg トリガーから 0.49s アイドル、その後 t=0 から再生されるため、ファイル冒頭の無音 pre-attack が collapse 開始の張力を満たしてから衝撃が落ちます。複数のトリガーで 1 つの Audio element を使い回し、既存の eggStartRef ガードで再トリガーをゲート、コンポーネントの unmount 時に進行中の再生を停止。音量は 0.55 に上限を設け、braam が ambient サウンドトラックを圧倒せず、ドラマティックな句読点として読まれるようにしています。',
    ],
  },
  {
    id: 'hero-easter-egg-cosmic-photo',
    date: '2026-04-27',
    title: 'Hero — 宇宙塵パーティクルポートレート & Easter Egg 仕上げ',
    tags: ['feature', 'design', 'technical'],
    body: [
      'Easter-egg ポートレート phase を作り直し、写真を構成するパーティクルが宇宙塵のように見える描画に切り替えました（旧版は実心の数珠のような見え方）。各パーティクルは事前 render された radial-gradient sprite（汎用の暖白コアと、5 段階の輝度グラデーションでティントされた halo）として描画され、additive blending で合成されます。隣り合う halo は連続した発光ファブリックに重なり、個別のドットとしてはスタックしません。約 3 分の 1 のパーティクルは短い接線ストリークも描き、ポートレートに向かう途上で orbital ring からちょうど抜け出してきたばかりであることを匂わせます。',
      '写真のパレットを shader の lens-halo スペクトルに合わせて調整：brightness 0 を炎のような赤橙（暖かいガスフィラメント）、brightness 1 をクリームホワイト（lens の三日月コア）、温色側の反対の冷側ガスに合わせて 12% のシアンアクセントを加えます。ポートレート本来の chiaroscuro は温度勾配として読まれ（明るいピクセルは熱せられた lensed light、暗いピクセルは冷却中の accretion debris のように見え）、宇宙の背景とポートレートが視覚的に同じ color DNA を共有します。',
      'Easter egg 中に shader 側で実際の重力崩壊を加えました。Shader は `u_eggCollapse` で駆動される radial zoom と引き締まる vortex を適用し、collapse phase で lens は視覚的に implode します（旧版では単に暗くなるだけでした）。reverse phase ではパーティクルが orbital ring に戻って分散する間、より小さな二次崩壊が再生されます。新しい `u_photoHide` uniform は photo phase 全体で shader を 0 にフェードします（explode の最後 0.35s で立ち上げ、収束しているポートレートの背後で lens がフラッシュしないようにし、ポートレート全体は 0 を保ち、reverse collapse で再び下げる）。',
      'Reverse phase をクリーンな線形分散に戻しました：パーティクルは `easeOutQuart` でまっすぐ orbital ring に戻り、回転はしません。以前の CW スパイラル版では、写真が「回転しながら」溶けていくように読まれて不自然でした。重力的な雰囲気は今や shader の二次崩壊にすべて宿っており、パーティクルは単に分散して再形成されます。',
      '3000 個のパーティクルリングを 60 fps で動かすためのパフォーマンス対策：canvas DPR の上限を 1.5 に（Retina ディスプレイでピクセル作業をおおよそ半分に削減、画質の劣化は知覚できないレベル）、idle-orbit trail の stroke style を per-frame ループの外に hoist（フレームごとに数千の冗長な state 切替を節約）、trail render の閾値を上げて、暗い／遅い外角のパーティクルは stroke を完全にスキップ。Photo-phase の shadowBlur を事前 render の glow sprite に置き換え、約 3-4 倍安く、halo もよりクリーンに。hero コピーをぐらつかせていた mousemove 駆動の text-repulsion 効果も削除しました。',
    ],
  },
  {
    id: 'hero-black-hole-shader-orbital-particles',
    date: '2026-04-27',
    title: 'Hero — ブラックホール Shader & Orbital パーティクルシステム',
    tags: ['feature', 'design', 'technical'],
    body: [
      'Hero パーティクルの背後に WebGL fragment shader を追加し、ブラックホール風の accretion disk を render：中央に明るい lensing 三日月、周囲を柔らかいガスフィラメントが流れます。Shader は既存のパーティクルリングの下、自前の canvas に乗っているので、hero は階層構成として読まれます（前景に光る event horizon、その背後にアニメーションするガス、最上層に orbiting パーティクル）、平坦な単一のパーティクルフィールドではありません。',
      '以前の波形変調・固定角度のパーティクルモデルを、msurguy の blackhole リファレンスに着想を得た Kepler 風の orbital システムに置き換えました。各パーティクルは中心の周りを実際に回転し、半径依存の角速度を持ちます（内側軌道は速く、外側コーナーはゆっくり drift）。差動回転として読まれます（旧版の見え方は静的な装飾リングでした）。パーティクル数は狭いバンド内の 800 個から、viewport 対角線全体に広がる 3000 個になり、ワイドスクリーンディスプレイのコーナーが空っぽに見えなくなりました。',
      'クリックとタップの相互作用は spring-damper の物理モデルを採用：ヒットは近くのパーティクルを初期 radial velocity で外側に押し、重力が base orbit を通って引き戻し、欠減衰の振動でそれらを行き過ぎさせて自然に落ち着かせます。旧版の挙動は硬い線形の repel-and-snap でした。Shader 自体はクリックに反応せず、パーティクルリングだけが反応します。ガスの背景をニュートラルに保つことで、クリックフィードバックは軌道への物理的な摂動として感じられ、全画面の「画面が揺れる」反応はこのバージョンで取り除いています。',
      'Konami easter egg は shader とパーティクルリングの同期化された big-bang シーケンスとして再構築。すべてのパーティクルがシンギュラリティに向かって崩壊、中心でフラッシュが弾け、衝撃波が外向きに波及、パーティクルが Charles の写真に爆発、しばし保持、リングに溶け戻り、shader は黒抜けから通常のガスにフェード。両コンポーネントは共有の `easter-egg` window event を聞き、phase 境界（collapse 0.8s → flash 1.0s → explode 1.6s → photo 3.5s → reverse 5.0s）が同期したまま保たれます。',
      '途中で行ったいくつかの小さな修正：shader の分母特異点（中心の bright spot、lens を貫く対角スライス）を epsilon 安定化形式に置き換え；ガス回転は指数的に飽和する drift を使うようにし（旧来の線形巻き取りに替えて）、noise パターンが時間とともに長い sweep arc を蓄積しなくなりました；hero テキストには階層化された黒の text-shadow と支援コピーのわずかに高い不透明度を与え、明るい lens 三日月が通り抜けても読みやすさを保ちます。',
    ],
  },
  {
    id: 'hero-mobile-vertical-centering',
    date: '2026-04-21',
    title: 'Hero Section — モバイル垂直センタリング修正',
    tags: ['technical', 'design'],
    body: [
      'モバイルでの hero テキストが、可視 viewport の垂直中央より明らかに下に位置していました。根本原因は 100vh：モバイルブラウザではこの単位は URL バーが収納された状態の viewport を表し、実際に可視の領域ではありません。そのため section は訪問者が見える範囲より高くなり、「100vh の中央」は視覚的中心からおおよそ 40-50px 下に着地していました。下部の SCROLL ↓ インジケーターも同じ理由で URL バーの裏に隠れていました。',
      'Hero section を 100dvh（dynamic viewport height）に切り替え、supports-[] variant を介して適用：モダンブラウザは実際に可視の領域に合わせて section をサイズし、dvh が認識されない古いブラウザでは 100vh にフォールバックします。Canvas はすでに section の clientHeight に基づいて resize されており、パーティクルアニメーションの中心はレイアウトに自動的に追従します。追加の変更は不要でした。',
    ],
  },
  {
    id: 'ambient-audio-default-muted',
    date: '2026-04-19',
    title: 'Ambient Audio — デフォルトでミュート起動',
    tags: ['design'],
    body: [
      'Ambient サウンドトラックの起動方法を反転しました。最初のバージョンはデフォルトで unmuted で、最初のクリックやスクロールを待ってフェードインを忍ばせることでブラウザの autoplay block をすり抜けようとしていました。賢い裏技でしたが、正直さに欠ける挙動でした：コーナーのスピーカーアイコンは終始「sound on」を表示する一方、ブラウザは静かに再生をブロックしていました。訪問者は遅延が意図的であるとは知りようがなく、クリックもスクロールもしなかった人は永遠に嘘をつくアイコンを見ることになります。',
      '今ではアイコンは muted 状態で起動し、ブラウザが実際に行っていることと一致します。音楽は訪問者が明示的にスピーカーをクリックしたときだけ始まります。クリック自体が autoplay を解除する user gesture としてカウントされ、1 つのアクションが許可を付与し、フェードインを開始します。別の「enable audio」ステップも、現実と矛盾するアイコンもありません。',
      'localStorage のセマンティクスも引き締めました。ボタンはどちらにせよ訪問者の最後の選択を覚えていますが、デフォルト状態（保存値がない、または保存値が何らかの形で破損している場合）は muted です。前回積極的に unmute した再訪者は再び音楽を聞き、それ以外の人は要求するまで沈黙が続きます。サウンドを opt-in として扱う：portfolio にとって正しいデフォルトです。',
    ],
  },
  {
    id: 'ambient-space-audio',
    date: '2026-04-18',
    title: 'Ambient Space Audio — Interstellar 風の音響景観',
    tags: ['feature', 'design'],
    body: [
      '訪問者がサイトを探索する間、背景で静かに流れる映画的な ambient サウンドトラックを追加しました。リファレンスは Hans Zimmer の Interstellar スコア：リズム要素のないゆっくりと動く pad と sub bass で、注意を要求せず体験の下に静かに座ります。Pixabay の CC0「Calm Space Music」トラックをライセンスしました。',
      'ブラウザの autoplay policy は、ユーザーインタラクションなしで音のあるオーディオを開始することをブロックします。Chrome と Safari はこれに何年も厳格で、それは正当な理由があります。policy と戦う代わりに、player は最初の pointer/keyboard/scroll/touch event を待ち、その後 1.8 秒かけて音量を 0 から 0.35 にフェードします。トランジションは十分に遅く、オーディオは最初からそこにあったかのように感じられます。',
      '右下隅に固定された小さな glassmorphic ミュートボタン。クリックで 0.6 秒かけてオーディオをフェードアウトしてから一時停止し、設定を localStorage に保存：ミュートした訪問者は再訪時もミュートのままです。ボタン自体はモバイルの届きやすさを考慮した 44×44 のヒットエリアを使い、hover 時には accent-cyan カラーでサイトの既存の focus ring 処理に揃えています。',
      'オーディオ element は main.tsx の router の上に一度だけ配置され、/、/about、/changelog、/projects/:id 間のナビゲーションでも再生が中断されません。再初期化なし、ルート間の隙間なし。',
    ],
  },
  {
    id: 'product-page-refresh-2026-04',
    date: '2026-04-18',
    title: 'Product Pages — Tech Stack コンテンツ更新',
    tags: ['technical'],
    body: [
      '3 つのプロジェクトケーススタディページの tech stack 表が古くなっていました。プロダクト自体はローンチ後も進化を続けているため、portfolio も追いつく必要がありました。',
      'Path のフロントエンドスタックには PWA / Service Worker レイヤーをクレジット：offline-first はユーザーに対する約束であり、それを支える tech stack に表示されるべきです。Plutus Trade のデータソースは「FinMind API、Redis」から拡張し、台湾特化の FinMind フィードに加えてグローバル株価のための Yahoo Finance API も含むようになりました。プロダクトは実際に両市場をカバーしていますが、ページがそれを反映していませんでした。',
      'Product Playbook が最大の書き直しを受け、現在の GitHub README から直接持ってきました。配信チャネルは「npm、GitHub」とリストされていましたが、それ以降 3 つの配信面に拡張しています（Claude.ai Custom Skill、Claude Code Plugin、Claude Code Skill）。それぞれユーザーのワークフローの異なる部分でユーザーと会います。文書処理 pipeline（Chromium PDF render の Playwright、フォーマット変換の Pandoc、テキスト抽出の pymupdf、フォールバック層の Tesseract OCR、bookmark の pikepdf、セマンティック解析の Claude Vision）はまったく欠けていました。Impact セクションに 6 言語の国際化、MIT ライセンス、+69% の品質向上ベンチマークを追加しました。',
      '6 つの実行モードも、ページが以前抱えていた曖昧な「from lightweight to comprehensive」の説明に代えて、実際の production の名前（Quick、Full、Revision、Custom、Build、Feature Expansion）にリネームしました。',
    ],
  },
  {
    id: 'footer-portaly-link',
    date: '2026-04-17',
    title: 'Footer — Portaly リンクを追加',
    tags: ['feature'],
    body: [
      'Contact Footer に Portaly（portaly.cc/charleschen）を 4 つ目のソーシャルリンクとして、LinkedIn、GitHub、Threads と並べて追加しました。Portaly は主要な link-in-bio ハブなので、portfolio から表に出すことでクロスプラットフォームのプレゼンスを集約できます。',
      'アイコンは Portaly 公式の brand mark（apple-touch-icon）を使い、ローカルで処理して白背景を取り除き、ロゴの端に密着するように切り抜き、他のソーシャルアイコンが使う 20×20 サイズでもクリーンに render されます。',
    ],
  },
  {
    id: 'scroll-restoration-fix',
    date: '2026-04-15',
    title: 'Scroll Restoration — リフレッシュ問題の修正',
    tags: ['technical'],
    body: [
      'どのスクロール位置でリフレッシュしても常に間違ったセクションにジャンプしていました。時には About セクション、時には先頭。根本原因は、ホームページのすべてのセクションを Suspense 境界に包んだ React.lazy() で lazy load していたことでした。',
      'ブラウザの scroll restoration はスクロール位置を保存し、ページがレンダリングされた後に復元することで動作します。しかし Suspense では、ページは最初にコンパクトなフォールバック（単一の h-screen div）を render し、すべてのセクションがロードされたときに本来の高さに展開します。実コンテンツが現れる頃には、ブラウザはすでに間違ったページの高さに対して復元を試みており、位置は 0 にクランプされていました。',
      '修正は素直でした：すべてのホームページセクションから lazy() を取り除き、直接 import します。これらのセクションはユーザーがスクロールするうちに必ず見えるようになるため、lazy load は実質的なメリットを提供せず、scroll restoration を壊していました。ルートレベルのページ（About、Changelog、ケーススタディ）は訪問者がそこにナビゲートしないかもしれないため、引き続き lazy-loaded です。',
      'Bundle は 233KB から 313KB に増加（gzip 75KB → 102KB）しましたが、7 つの個別 chunk リクエストを排除しました。実世界のロード時間への正味の影響はごくわずかです。HTTP の往復オーバーヘッドのため、1 つの大きなリクエストは多数の小さなリクエストよりも速いことがよくあります。',
    ],
  },
  {
    id: 'responsive-layout-fixes',
    date: '2026-04-14',
    title: 'Responsive Layout — Hero と About のアラインメント',
    tags: ['design', 'technical'],
    body: [
      '2 つのレイアウト一貫性の問題を修正。Hero セクションのテキストコンテナは max-w-[900px] でしたが、About は max-w-[1400px] で、コンテンツの左端がセクション間でジャンプしていました。Hero を同じ max-w-[1400px] px-6 md:px-12 コンテナに統一し、h1 自体は快適な行長を維持するために max-w-[900px] でキャップしました。',
      'About セクションは md（768px）で水平 layout に切り替わりますが、サイドアノテーション付きの写真は約 728px のスペースを必要としました。タブレット画面（768-1024px）では、テキストカラムがほぼゼロ幅に潰されていました。水平 breakpoint を md から lg（1024px）に押し上げ、レスポンシブな写真サイズ（lg で 350×480、xl でフル 440×600 に展開）を追加しました。',
    ],
  },
  {
    id: 'blog-xai-redesign',
    date: '2026-04-13',
    title: 'Blog Section — xAI スタイルの記事リスト',
    tags: ['feature', 'design'],
    body: [
      'Blog セクションは以前 2 つのプラットフォームボタン（Medium、Substack）だけを表示し、記事タイトルも説明もなく、訪問者にも検索エンジンにも価値がありませんでした。xAI のニュースページレイアウトに着想を得たフル記事リストとして再設計しました。',
      '各記事は日付、タイトル、副題、プラットフォームタグ、カバー画像、READ ボタンを持つ row として表示されます。カバー画像は 16:10 のアスペクトコンテナ内で background-size: cover を使用。カバーのない記事はフォールバックとして暗くなったプラットフォームロゴを表示します。Featured 記事（Uber L4 Offer）は日付の隣に mars カラーのバッジを取得します。',
      '副題は当初は汎用的な 1 行サマリーでした。実際の Substack 副題に置き換え、はるかに魅力的になりました。例えば CS153 の記事は「探討 AI 發展的真正限制與突破方向」から「這堂被戲稱為「AI Coachella」的課，可能是目前全世界最搶手的一堂課。」になりました。',
      'ソートは featured 記事を最初に、残りは時系列の逆順に。13 記事：Substack から 7（カバー画像付き）、Medium から 6。',
    ],
  },
  {
    id: 'case-study-pages',
    date: '2026-04-12',
    title: 'Case Study Pages — SEO Topic Cluster',
    tags: ['feature', 'technical'],
    body: [
      '/projects/path、/projects/plutus-trade、/projects/product-playbook に専用のケーススタディページを追加しました。各ページには構造化されたセクションがあります（Problem、Solution、Tech Stack、Impact、Learnings）。適切な meta タイトル、ディスクリプション、動的な canonical URL とともに。',
      'ホームページのプロジェクトカードはこれらのケーススタディページにリンクするようになりました（旧版では外部 URL に直接飛んでいました）。これは SEO のための内部 topic cluster を作成します：ホームページがケーススタディにリンクし、ケーススタディがリンクバックし、各ページが異なる long-tail キーワードをターゲットにします。',
      'また、完全な職歴、プロダクト哲学（outcomes over outputs、strong opinions loosely held、strong product sense、build to learn）、AI ワークフローの内訳、スキルセット、台湾の検索トラフィック向けの lang="zh-TW" 付きの中国語簡介セクションを備えた専用の /about ページも追加しました。',
      'すべての新しいページは動的な canonical URL と構造化された meta タグを使用します。Google Search Console がサブページを「Alternate page with proper canonical tag」としてフラグした問題を修正しました：以前はすべてがハードコードされた root canonical を共有していました。',
    ],
  },
  {
    id: 'geo-seo-optimization',
    date: '2026-04-11',
    title: 'GEO & SEO — Portfolio を AI に発見可能にする',
    tags: ['feature', 'technical'],
    body: [
      'Portfolio は人間には見栄えが良かったものの、検索エンジンと AI システムには見えませんでした。React SPA として、ページ全体がクライアントサイドで render されていました：JavaScript を実行しないクローラーは空の <div id="root"></div> しか見えませんでした。structured data なし、meta 戦略なし、sitemap なし。',
      '第 1 層は機械的なもの：JSON-LD structured data（Person、FAQPage、ItemList スキーマ）、Open Graph タグ、Twitter Cards、canonical URL、author メタデータ、freshness シグナル（公開日／変更日）を追加しました。14 種類すべての主要な AI クローラー（GPTBot、ClaudeBot、PerplexityBot など）を明示的に許可する robots.txt、sitemap.xml、AI が直接消費するための実験的な llms.txt を作成しました。',
      '第 2 層は SPA 可視性問題を解決しました。<noscript> タグ内に完全な HTML フォールバックを追加：JS を実行しないクローラーは適切な H1/H2/H3 階層、achievement リスト、skill テーブル、プロジェクト記述、FAQ セクションを備えた完全なセマンティックコンテンツを取得します。React は mount 時に可視 DOM を置き換えるため、ユーザーはフォールバックを見ることはありません。最初は #root 内にフォールバックを置きましたが、React が hydrate する前に未スタイルの HTML が一瞬光る原因となりました。<noscript> に移動して修正しました。',
      '第 3 層はキーワード戦略でした。GEO 監査によると、コンテンツは「私が誰であるか」（ブランドページ）として構造化されており、「私が解決する問題は何か」（検索ページ）ではありませんでした。「AI Product Manager」は「AI Product Builder」よりも検索ボリュームが大幅に高いものの、19 回に対してわずか 4 回しか出ていませんでした。タイトル、JSON-LD、noscript 見出し、FAQ コンテンツ全体で「AI Product Manager」を 15 回に再バランスしました。地理シグナル「Taiwan」を主要な位置に追加。タイトルは name-first（「Charles Chen、AI Product Builder」）から keyword-first（「AI Product Manager | Charles Chen Portfolio」）にシフトしました。',
      'また vercel.json に X-Robots-Tag ヘッダーを追加、noscript フォールバックから /changelog への内部リンクを追加、long-tail キーワードを狙った新しい FAQ も追加しました：「how to become an AI product builder」、「AI product manager portfolio example」、「generative AI product case study」、「difference between AI PM and AI Product Builder」。',
    ],
  },
  {
    id: 'playbook-animation-fixes',
    date: '2026-04-09',
    title: 'Product Playbook — Connection Line 修正',
    tags: ['design', 'technical'],
    body: [
      'フレームワーク badge（JTBD、Persona、RICE、PRD）を SPEC.md セクションに繋ぐオレンジの bezier ラインに 3 つの問題がありました。1 つ目は暗い背景でほとんど見えなかったこと：スタックされたアルファ値（globalAlpha 0.3 × marsA(0.6)）から実効 opacity はわずか約 18% でした。値をそれぞれ 0.55 と 0.9 に上げ、実効可視性を約 50% にしました。',
      '2 つ目、各ラインは 1 サイクルで 2 回アニメーションしていました。根本原因は lineProgress 計算内の「peek-ahead」分岐で、セクションが始まる前に次のラインを事前描画していました。セクションインデックスが進むと、sectionLocalProgress が 0 にリセットされ、ラインは完全に描画された状態から空に戻り、最初からアニメーションし直していました。peek-ahead 分岐を削除して、各ラインがちょうど 1 回アニメーションするようにしました。',
      '3 つ目、Dev Handoff セクション（最後）は完了 checkmark を表示しないままでした。isComplete 条件は si < activeSectionIndex でしたが、最後のセクションインデックスは最大 activeSectionIndex に等しいため、3 < 3 は常に false でした。最後のセクションを処理するために progress >= 1 のチェックを追加しました。',
    ],
  },
  {
    id: 'changelog-page',
    date: '2026-04-09',
    title: 'Changelog — Building in Public',
    tags: ['feature', 'design'],
    body: [
      'この portfolio のすべての部分の背後にある設計判断、技術的反復、考えを記録するための専用 /changelog ページを追加しました。Linear の changelog からの着想：寛大な余白と自然な散文を備えたクリーンな単一カラムレイアウト（bullet-point の changelog 形式を置き換える形）。',
      'これには、以前は単一ページのスクロールアプリだったものに React Router を導入する必要がありました。ホームページは以前と同じように動作します：すべてのセクションが同じナビ動作で垂直にスクロールします。Changelog は独自の URL に存在し、Vercel デプロイのための適切な SPA フォールバックを備えています。',
      'Nav コンポーネントは route-aware になりました：ホームページではセクションボタンが以前のようにスクロール。Changelog ページではボタンが /#section に navigate し、ページのロード後に自動でスクロール。Changelog のエントリーポイントは footer に存在します：技術的なメタデータと並ぶさりげないリンクで、より深く掘り下げたい訪問者向けです。',
      '各エントリは自然な散文として書かれています（release notes 形式を置き換える形）。目標は決定の背後にある「なぜ」を共有すること：なぜ About セクションが 5 回の背景アニメーション反復を経たのか、なぜ Fibonacci 分布が Universe sphere を解いたのか、なぜカードアニメーションが完全な state machine ライフサイクルを必要としたのか。',
    ],
  },
  {
    id: 'animation-module-extraction',
    date: '2026-04-09',
    title: 'アニメーションアーキテクチャのリファクタ',
    tags: ['technical'],
    body: [
      '3 つのカードアニメーションシステムは単一ファイルで 1,240 行に成長していました。各アニメーション（Path の S 字 bezier ルート、Plutus Trade の K 線 ticker、Product Playbook の spec 組み立て）は独自の定数、state machine、draw 関数を持つ自己完結したシステムでした。それらはたまたま同じファイルに住んでいただけです。',
      'それぞれを専用モジュールに抽出：pathAnimation.ts、plutusAnimation.ts、playbookAnimation.ts、共通ユーティリティ用の shared.ts。ProjectCards.tsx は 1,240 行から 593 行に減少しました。',
      'またすべてのハードコードされた rgba() 文字列を 2 つのヘルパー関数（whiteA() と marsA()）に集中させ、コードベース全体で 56 箇所を置換しました。アクセントカラーが今後変わる場合は単一の定数更新で完結し、draw 関数を探し回る作業は不要です。',
      'Playbook アニメーションのバッジメトリクス計算は以前モジュールレベルの可変キャッシュでした。コンポーネントスコープの useRef に移動：共有可変状態はもうありません。',
    ],
  },
  {
    id: 'product-playbook-card',
    date: '2026-04-08',
    title: 'Product Playbook — Spec 組み立てアニメーション',
    tags: ['feature', 'design'],
    body: [
      'Claude Code 向けの AI 駆動プロダクト企画 skill である Product Playbook 用に、3 番目のサイドプロジェクトカードを追加しました。アニメーションはコアコンセプトを視覚化する必要がありました：フレームワークが入り、完全な spec が出てくる。',
      'デザインは左に 4 つのフレームワーク badge（JTBD、Persona、RICE、PRD）を表示し、曲線 bezier ラインで右側のドキュメントに繋ぎます。各セクションが埋まるにつれて（Overview、User Stories、Architecture、Dev Handoff）、対応するフレームワーク badge が accent-mars のパルスで点灯します。',
      'ドキュメント内で、コンテンツ行はタイピングカーソルが約 0.6Hz で点滅しながら段階的に埋まります。完了したセクションは checkmark を取得します。下部の進捗バーは easeInOutCubic を使用しており、旧来の線形成長より洗練された感触に仕上がります。',
      '入場の振付は第一印象として重要でした：badge は fade + slide-up で時差をつけて入り（120ms 間隔）、続いてドキュメントのアウトラインがフェードイン。これは他の 2 つのカードが当初持っていなかった「reveal」の瞬間をアニメーションに与えます。',
      '複数の監査サイクルを経て微調整：よりクリーンな 1:1 のセクションマッピングのためにフレームワークを 6 から 4 に削減、接続線を平坦な水平線から曲線へ切り替え、分数補間で部分曲線の終点を滑らかにしました。',
    ],
  },
  {
    id: 'mobile-card-autoplay',
    date: '2026-04-08',
    title: 'カードアニメーションのモバイル自動再生',
    tags: ['feature', 'technical'],
    body: [
      'Canvas カードアニメーションは onMouseEnter と onMouseLeave によってトリガーされていました：これらはタッチデバイスでは決して発火しません。モバイルでは、イラストレーションは静止状態に永久に凍結されていました。',
      '修正は matchMedia("(hover: none)") でタッチデバイスを検出し、代替トリガーとして threshold 0.3 の IntersectionObserver を使います。モバイルでカードがビューにスクロールイン時、アニメーションは自動的に再生されます。スクロールアウト時には停止します。',
      'デスクトップの動作は変わりません：アニメーションは依然 hover でトリガーされます。',
    ],
  },
  {
    id: 'canvas-card-animations',
    date: '2026-04-07',
    title: 'プロジェクトカード用インタラクティブ Canvas アニメーション',
    tags: ['feature', 'design'],
    body: [
      'プロジェクトカードはもともと静的な SVG イラストを持っていました：汎用的で生気がない。3 つすべてを、各プロジェクトのストーリーを語るインタラクティブな Canvas 2D アニメーションに置き換えました。',
      'Path のアニメーションは S 字 bezier ルートを光るコメットトレイル付きで描きます。光点が各 waypoint を通過すると、到着リップルが拡張し、対応する旅程カード（Day 1、Day 2、Day 3）が段階的なチェックマークアニメーションで点灯します。サイクル全体は：旅行 → 終点で一時停止 → フェードアウト → リセット。',
      'Plutus Trade はライブの K 線 ticker を表示します。陽線は accent-mars で発光、陰線は白で。新しいローソクは右からスクロールインし、周期的なサージイベントが劇的な長いローソクを作成します。取引日は独自のライフサイクルを持ちます：8 秒の取引 → 引け減速 → フェードアウト → 新しい日。',
      'カード UI 自体は xAI に着想を得ました：シャープなボーダーとコーナーの四角形装飾、hover 時のグラデーションオーバーレイ、微妙なスケール変換。各アニメーションは hover（デスクトップ）または viewport 可視性（モバイル）でのみ実行され、静止状態では常にフルイラストのディムプレビューを表示します。',
    ],
  },
  {
    id: 'nav-footer-cleanup',
    date: '2026-04-07',
    title: 'Navigation と Footer の仕上げ',
    tags: ['design'],
    body: [
      '小さくも重要な 2 つのレイアウト修正。モバイルのハンバーガーメニューは CONTACT ボタンの前に配置されていました。ユーザーが期待する一番右の位置に移動しました。',
      'About セクションには nav バーの CONTACT ボタンと重複する「Let\'s Connect」リンクがありました。削除。1 つの明確な call-to-action は、競合する 2 つよりも優れています。',
    ],
  },
  {
    id: 'about-hero-photo',
    date: '2026-03-28',
    title: 'About Section — 成果アノテーション付きの写真',
    tags: ['design'],
    body: [
      'About セクションを再設計し、デスクトップでは両側に成果アノテーションが並ぶ大きなプロフィール写真を中心に据えました。写真は CSS radial gradient mask を使い、暗い背景への自然なエッジフェードを実現：プログラム的な背景除去を試みるよりずっとクリーンです。',
      'デスクトップレイアウトは写真を中央に配置し、左側に「7M+ Users Impacted」、右側に「0→1 B2B SaaS Launch」と「5x Faster with AI」を置きます。モバイルではコンパクトなメトリクス行の上に写真を積み重ねます。',
      'コピーは一般的な紹介から「What I bring to the table.」へ洗練：直接的で自信があり、メトリクスをそれと並んで語らせます。',
    ],
  },
  {
    id: 'universe-section-evolution',
    date: '2026-03-25',
    title: 'Universe Section — 3D 球面への道のり',
    tags: ['feature', 'design', 'technical'],
    body: [
      'Skills セクションはサイトのほかのどの部分よりも多くの反復を経ました。散らばった線のある基本的な canvas から始まり、フル 3D 球面ビジュアライゼーションに進化しました。',
      '球面上の線の分布が最も難しい問題でした。ランダム配置は不均一に見えました。グリッドベースのアプローチを試しましたが人工的に見えました。最終的に Fibonacci sphere アルゴリズム（ひまわりが種を並べるのと同じ数学）に到達し、完全に均一な分布を生み出しました。',
      'Render 順序は 3D で重要です：viewer に近いパーティクルは遠いものの上に描画する必要があります。フレームごとに garbage collection の圧力を回避するために、事前に割り当てられたソート配列を持つ z-sorted render を実装しました。',
      'スクロール駆動のテキスト拡散は xAI のビジュアル言語に着想を得ました：球面の周りに配置されたスキルラベルがユーザーがスクロールするにつれて外側に移動し、拡張と探検の感覚を生み出します。ラベルはカテゴリ間で自動サイクルし、初期ビューを圧倒せずにフルスキルセットを表示します。',
      'xAI の美学に合わせるため、球面の比率、線の密度、パーティクルの輝度、中心密度の分布を、何十ものコミットにわたって微調整しました。',
    ],
  },
  {
    id: 'particle-hero-rings',
    date: '2026-03-22',
    title: 'ParticleHero — Ring パーティクルシステム',
    tags: ['feature', 'design'],
    body: [
      'Hero セクションは Perlin noise flow field（有機的なストリームでドリフトするパーティクル）から始まりました。良く見えましたが汎用的でした。同心リングで穏やかな脈動を持つ Antigravity スタイルのリングパーティクルアルゴリズムに置き換えました。',
      'Hero 上のどこかをクリックすると、パーティクルを通って外側に伝播するリップル効果が生成されます。リング中心はクリックを追わずに画面中央に固定されたまま、構成を安定に保ちつつ、応答性を感じさせます。',
      'パラメーターを徹底的にチューニング：脈動を 0.008 から 0.003 に減速して微妙さを出し、密度を 80×25 から 40×15 に減らして hero テキストを圧倒しないように。',
      'ここに easter egg が隠されています：logo を素早く 5 回クリックすると、パーティクルがエッジ検出を使用してプロフィール写真のシルエットに再配置されるトリガーになります。顔は viewport サイズに合わせてスケールするので、デスクトップとモバイルの両方で明瞭に読まれます。',
    ],
  },
  {
    id: 'about-neural-network',
    date: '2026-03-20',
    title: 'About Section — 背景アニメーションの進化',
    tags: ['design', 'technical'],
    body: [
      'About セクションの背景は急速な反復を経ました。連結したパーティクルから始まり、六角形のノードを試し（騒がしすぎ）、「quantum neural network」コンセプトに進化、最終的にパルスする線で繋がれたシンプルな発光ドットに落ち着きました。',
      '最終実装では 80 の通常ノードと 10 の hub ノードを使用します。hub は大きく、より明るく、よりゆっくり動き、ネットワーク内の視覚的アンカーとして機能します。青紫のカラーパレット（#6BA3D6、#4E8FD4、#8B9FD6）は、暖かい accent-mars と競合せずに補完するために選ばれました。',
      'パフォーマンスは、80 ノードが接続のために潜在的に O(n²) 距離チェックを必要とする可能性で懸念事項でした。これを O(n) に削減する spatial grid を実装：各ノードは隣接する grid セルのみをチェックします。grid コンテナはガベージコレクションの圧力を回避するためにフレーム間で再利用されます。',
      'IntersectionObserver でセクションが画面外にスクロールするとアニメーション全体が一時停止します。誰も見えないものに CPU サイクルを焼く意味はありません。',
    ],
  },
  {
    id: 'space-grotesk-typography',
    date: '2026-03-18',
    title: 'Space Grotesk — タイポグラフィ基盤',
    tags: ['design'],
    body: [
      'システムフォントから Space Grotesk へ主書体を切り替えました。Space Grotesk の幾何的かつ温かみのある特性は、xAI 風のビジュアル言語と合致します：技術的でありながら親しみやすい。',
      'セクションラベル、タグ、技術的な UI 要素のモノスペースアクセントには SF Mono を組み合わせました。セクションヘッダーは tracking-[2px] の一貫した [ SECTION ] 形式に統一：サイト全体を結びつける小さなディテールです。',
    ],
  },
  {
    id: 'initial-launch',
    date: '2026-03-15',
    title: 'Portfolio ローンチ',
    tags: ['feature', 'design', 'technical'],
    body: [
      'charles-chen.com の初回ローンチ。React 19、Vite、Tailwind 4、アニメーション用の Canvas 2D で構築。基盤として暗いテーマ（#0A0A0A の背景に暖かい accent-mars #E8652B）を確立しました。',
      'カラー、ボーダー、タイポグラフィの design token は Tailwind の @theme directive に存在します：単一の真実の源。すべてのセクションは React.lazy() で lazy-loaded され、Vite によって自動的に code-split されます。',
      'Accessibility は最初から組み込まれています：skip-to-content リンク、focus-visible アウトライン、すべてのアニメーションを無効にする prefers-reduced-motion サポート、すべてのインタラクティブ要素の ARIA ラベル。View Transitions API はセクション間のナビゲーション時にスムーズな crossfade を提供します。',
    ],
  },
]
