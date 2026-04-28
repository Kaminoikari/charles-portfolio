// Translation policy: the linked Substack/Medium articles are published
// in Traditional Chinese. The Japanese-locale entries below render
// Japanese titles and subtitles as descriptions of each article's
// content for Japanese readers. Clicking through will land on the
// original Chinese article — this mirrors how Japanese tech blogs
// typically summarize foreign-language sources for their readers.
//
//   - Product names / framework names / tech stack stay English by
//     Japanese tech industry convention (Claude Code, Product Sense,
//     LLM Wiki, OKR, etc.).
//   - Article body itself remains in Chinese on the source platform.

export interface BlogArticle {
  title: string
  subtitle: string
  url: string
  platform: 'Medium' | 'Substack'
  date: string
  featured?: boolean
  cover?: string
}

export const blogArticles: BlogArticle[] = [
  // ── Featured (pinned) ──
  {
    title: 'なぜ私は Uber L4 Offer を断ったのか？AI の波の中で PM のキャリアを振り返る',
    subtitle: 'AI の波の中でのキャリアの内省：外資大手の威光と AI 変革がぶつかったとき、もっとも困難な決断をどう下したか。',
    url: 'https://charlestychen.substack.com/p/uber-l4-offer-pm-ai',
    platform: 'Substack',
    date: '2026-04-12',
    featured: true,
    cover: 'https://substack-post-media.s3.amazonaws.com/public/images/781195a1-7e0f-450d-88f1-3e976a22cf3d_1206x968.jpeg',
  },
  // ── Chronological (newest first) ──
  {
    title: 'モデルが毎日強くなる時代に、PM は一体何をすべきか？',
    subtitle: 'Anthropic Claude Code プロダクト責任者 Cat Wu が語る、7 つの反直感的な PM インサイト。',
    url: 'https://charlestychen.substack.com/p/pm-b5b',
    platform: 'Substack',
    date: '2026-04-24',
    cover: 'https://substack-post-media.s3.amazonaws.com/public/images/b437e201-2daa-425f-bd54-40c92a4da7a9_1088x1445.png',
  },
  {
    title: 'これからの 2 年は、PM 史上もっとも混沌とした時代になるかもしれない',
    subtitle: 'なぜ PM の半分は淘汰され、残りの半分は何を正しくやっているのか？Nikhyl Singhal が語る PM の分水嶺、自分を再構築する閾値、そして台湾で実際に目にしている現場。',
    url: 'https://charlestychen.substack.com/p/pm',
    platform: 'Substack',
    date: '2026-04-19',
    cover: 'https://substack-post-media.s3.amazonaws.com/public/images/7884d646-fa97-4fd4-bfe1-2fa01cfea1ff_1536x1024.png',
  },
  {
    title: '自分で育つ第二の脳を作る — Karpathy + Lex Fridman の LLM Wiki 完全実践ガイド',
    subtitle: 'AI で自分で育つ第二の脳を構築する：Karpathy LLM Wiki + Obsidian 完全構築ガイド。',
    url: 'https://charlestychen.substack.com/p/karpathy-lex-fridman-llm-wiki',
    platform: 'Substack',
    date: '2026-04-10',
    cover: 'https://substack-post-media.s3.amazonaws.com/public/images/3a2ca83a-9815-48a0-b9de-d618e6ee8cb4_2178x1134.png',
  },
  {
    title: 'スタンフォード CS153 で学んだこと：AI のボトルネックは一体どこにあるのか？',
    subtitle: '「AI Coachella」とも呼ばれるこの講義は、おそらく今、世界でもっとも人気のある一コマです。',
    url: 'https://charlestychen.substack.com/p/cs153-ai',
    platform: 'Substack',
    date: '2026-04-08',
    cover: 'https://substack-post-media.s3.amazonaws.com/public/images/8a4f2a9b-0010-43d3-b2b1-5a5bae7f2651_2816x1536.png',
  },
  {
    title: 'Claude Code ソースコード深掘りレポート：Agent OS アーキテクチャと自動化エンジニアリング実践の全方位解析',
    subtitle: 'Claude Code のソースコード流出は、開発者コミュニティ全体に衝撃を与え、Harness Engineering の未来に深い影響を与えました。',
    url: 'https://charlestychen.substack.com/p/claude-code-agent-os',
    platform: 'Substack',
    date: '2026-04-01',
    cover: 'https://substack-post-media.s3.amazonaws.com/public/images/5c66c5ed-0d3f-4906-af45-28884689a928_2816x1536.png',
  },
  {
    title: 'ノイズの中で真実を聞き分けられるのは、それだけ：Shazam の秒速識別を支える数学の真相',
    subtitle: 'Avery Wang の伝説的な論文から出発し、「時間整列ヒストグラム」がいかにスマートフォンにノイズの中での「読心」を可能にしているかを解析。',
    url: 'https://charlestychen.substack.com/p/shazam',
    platform: 'Substack',
    date: '2026-03-31',
    cover: 'https://substack-post-media.s3.amazonaws.com/public/images/d76b5f80-61e0-4c5e-b269-ca113a2e8c03_2816x1536.png',
  },
  {
    title: 'プロダクトマネージャー昇進の究極の謎：あなたの Product Sense は誰が定義するのか？',
    subtitle: 'Product Sense の構成要素と、育て方を分解する。',
    url: 'https://charlestychen.substack.com/p/product-sense',
    platform: 'Substack',
    date: '2026-03-31',
    cover: 'https://substack-post-media.s3.amazonaws.com/public/images/d3037171-c5a5-4375-b2bc-756cd14c987b_2752x1536.png',
  },
  {
    title: '1 つの open source Claude Skill が、あなたの PM ツールチェーン全体を置き換える方法',
    subtitle: '22 個のフレームワーク、6 つの実行モード、独自の Change Propagation Engine。',
    url: 'https://charleschen.medium.com/%E4%B8%80%E5%80%8B%E9%96%8B%E6%BA%90-claude-skill-%E5%A6%82%E4%BD%95%E5%8F%96%E4%BB%A3%E4%BD%A0%E7%9A%84%E6%95%B4%E5%80%8B-pm-%E5%B7%A5%E5%85%B7%E9%8F%88-22-%E5%80%8B%E6%A1%86%E6%9E%B6-6-%E7%A8%AE%E5%9F%B7%E8%A1%8C%E6%A8%A1%E5%BC%8F-%E7%8D%A8%E5%AE%B6-change-propagation-engine-32424c678d6a',
    platform: 'Medium',
    date: '2026-03-15',
    cover: 'https://miro.medium.com/0*oz5OiwumXzXqUVM1',
  },
  {
    title: 'Duolingo の 40 億ドルの大博打：なぜ 2026 年に「利益を犠牲」にして生き残りを選んだのか？',
    subtitle: '2026 年 2 月、エドテック大手 Duolingo が衝撃を放った：2025 年の売上は 10 億ドルを超えたが、株価は 20% 以上急落。創業者が選んだ戦略転換を映し出している。',
    url: 'https://charlestychen.substack.com/p/40-duolingo-2026',
    platform: 'Substack',
    date: '2026-02-28',
    cover: 'https://substack-post-media.s3.amazonaws.com/public/images/6e333e83-ff3a-4dd3-9405-8a33de3cbab7_1042x583.jpeg',
  },
  {
    title: 'プロダクトマネージャー vs. プロジェクトマネージャー',
    subtitle: '2 つのロールの本質的な違いと、キャリアでのポジショニング。',
    url: 'https://charleschen.medium.com/%E6%88%91%E5%BF%83%E4%B8%AD%E7%9A%84%E7%94%A2%E5%93%81%E7%B6%93%E7%90%86-vs-%E5%B0%88%E6%A1%88%E7%B6%93%E7%90%86-7e34fc57ec70',
    platform: 'Medium',
    date: '2025-06-01',
    cover: 'https://miro.medium.com/1*McevyyNy8urbJciiN7YwAQ.png',
  },
  {
    title: 'OKR を実務に成功裏に落とし込むには？',
    subtitle: '理論から実践まで、OKR 導入のリアルな経験。',
    url: 'https://charleschen.medium.com/okr%E5%AF%A6%E5%8B%99%E4%B8%8A%E8%A6%81%E5%A6%82%E4%BD%95%E6%88%90%E5%8A%9F%E8%90%BD%E5%9C%B0-fc9890830854',
    platform: 'Medium',
    date: '2025-05-01',
    cover: 'https://miro.medium.com/1*ciHZKpKZwrIQXrZBUecslw.jpeg',
  },
  {
    title: 'プロダクトマネージャー — プロダクト delivery ではなく、プロダクト discovery に注目せよ',
    subtitle: 'Discovery over delivery というプロダクト開発の心構え。',
    url: 'https://charleschen.medium.com/%E7%94%A2%E5%93%81%E7%B6%93%E7%90%86-%E4%B8%8D%E8%A6%81%E9%97%9C%E6%B3%A8%E7%94%A2%E5%93%81%E4%BA%A4%E4%BB%98-%E8%80%8C%E6%98%AF%E7%94%A2%E5%93%81%E6%8E%A2%E7%B4%A2-953381b1d4eb',
    platform: 'Medium',
    date: '2025-04-01',
    cover: 'https://miro.medium.com/1*07FSIHrRmf8KDY65SQ0Fsw.png',
  },
  {
    title: '内省シリーズ（二）| Authority vs Influence | 私が考える本当のリーダーシップ',
    subtitle: '権威と影響力の、本質的な違い。',
    url: 'https://charleschen.medium.com/%E5%8F%8D%E6%80%9D%E7%B3%BB%E5%88%97-%E4%BA%8C-authority-vs-influence-%E6%88%91%E5%BF%83%E7%9B%AE%E4%B8%AD%E7%9A%84%E7%9C%9F%E6%AD%A3%E9%A0%98%E5%B0%8E%E5%8A%9B-6f2bb20f04d1',
    platform: 'Medium',
    date: '2025-03-01',
    cover: 'https://miro.medium.com/0*URLUPWfvbuhIc30h',
  },
  {
    title: '内省シリーズ（一）| 意思決定はどう失敗するか？| 誰も避けられない認知バイアス',
    subtitle: '認知バイアスがプロダクトの意思決定にどう影響するか。',
    url: 'https://charleschen.medium.com/%E4%BC%81%E6%A5%AD%E7%87%9F%E9%81%8B%E5%A4%A7%E6%9C%89%E5%95%8F%E9%A1%8C-%E5%86%8D%E8%81%B0%E6%98%8E%E7%9A%84%E4%BA%BA%E9%83%BD%E7%84%A1%E6%B3%95%E9%81%BF%E5%85%8D%E8%AA%8D%E7%9F%A5%E5%81%8F%E8%AA%A4-d6053d9fdcf6',
    platform: 'Medium',
    date: '2025-02-01',
    cover: 'https://miro.medium.com/1*5NCkG52ADLxcDw_etFnWoA.jpeg',
  },
]

export const platformLinks = {
  medium: 'https://charleschen.medium.com/',
  substack: 'https://charlestychen.substack.com/',
}
