// TODO(i18n): translate this file to zh-TW. Until translated, contents
// are an English copy and the site falls back gracefully.

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
    title: '為什麼我拒絕了 Uber L4 Offer？一個 PM 在 AI 浪潮下的職涯覆盤',
    subtitle: '這篇文章記錄我在 AI 浪潮下的職涯反思：當外商大廠光環遇到 AI 變革，我如何做出最艱難的決定。',
    url: 'https://charlestychen.substack.com/p/uber-l4-offer-pm-ai',
    platform: 'Substack',
    date: '2026-04-12',
    featured: true,
    cover: 'https://substack-post-media.s3.amazonaws.com/public/images/781195a1-7e0f-450d-88f1-3e976a22cf3d_1206x968.jpeg',
  },
  // ── Chronological (newest first) ──
  {
    title: '接下來的兩年，可能是 PM 史上最混亂的時代',
    subtitle: '為什麼一半的 PM 會被洗掉，而留在場上的那一半，做對了什麼？Nikhyl Singhal 談 PM 職位的分水嶺、重塑自己的那個門檻，以及我在台灣看到的現場。',
    url: 'https://charlestychen.substack.com/p/pm',
    platform: 'Substack',
    date: '2026-04-19',
    cover: 'https://substack-post-media.s3.amazonaws.com/public/images/7884d646-fa97-4fd4-bfe1-2fa01cfea1ff_1536x1024.png',
  },
  {
    title: '打造會自己長大的第二大腦 — Karpathy + Lex Fridman 的 LLM Wiki 完整實戰指南',
    subtitle: '用 AI 蓋一座會自己成長的第二大腦：Karpathy LLM Wiki + Obsidian 完整建置攻略',
    url: 'https://charlestychen.substack.com/p/karpathy-lex-fridman-llm-wiki',
    platform: 'Substack',
    date: '2026-04-10',
    cover: 'https://substack-post-media.s3.amazonaws.com/public/images/3a2ca83a-9815-48a0-b9de-d618e6ee8cb4_2178x1134.png',
  },
  {
    title: '我從史丹佛 CS153 學到的事：AI 的瓶頸到底在哪裡？',
    subtitle: '這堂被戲稱為「AI Coachella」的課，可能是目前全世界最搶手的一堂課。',
    url: 'https://charlestychen.substack.com/p/cs153-ai',
    platform: 'Substack',
    date: '2026-04-08',
    cover: 'https://substack-post-media.s3.amazonaws.com/public/images/8a4f2a9b-0010-43d3-b2b1-5a5bae7f2651_2816x1536.png',
  },
  {
    title: 'Claude Code 原始碼深度研究報告：Agent OS 架構與自動化工程實踐的全方位解析',
    subtitle: 'Claude Code 原始碼外流，在整個開發圈社群引起軒然大波，並且對 Harness Engineering 的未來產生了深遠影響。',
    url: 'https://charlestychen.substack.com/p/claude-code-agent-os',
    platform: 'Substack',
    date: '2026-04-01',
    cover: 'https://substack-post-media.s3.amazonaws.com/public/images/5c66c5ed-0d3f-4906-af45-28884689a928_2816x1536.png',
  },
  {
    title: '只有它能在噪音中聽見真相：揭開 Shazam 秒速辨識的數學真相',
    subtitle: '從 Avery Wang 的傳奇論文出發，解析「時間對齊直方圖」如何讓手機在噪音中精準讀心',
    url: 'https://charlestychen.substack.com/p/shazam',
    platform: 'Substack',
    date: '2026-03-31',
    cover: 'https://substack-post-media.s3.amazonaws.com/public/images/d76b5f80-61e0-4c5e-b269-ca113a2e8c03_2816x1536.png',
  },
  {
    title: '產品經理的終極晉升之謎：誰在定義你的 Product Sense？',
    subtitle: '拆解 Product Sense 的構成與培養方式。',
    url: 'https://charlestychen.substack.com/p/product-sense',
    platform: 'Substack',
    date: '2026-03-31',
    cover: 'https://substack-post-media.s3.amazonaws.com/public/images/d3037171-c5a5-4375-b2bc-756cd14c987b_2752x1536.png',
  },
  {
    title: '一個開源 Claude Skill 如何取代你的整個 PM 工具鏈',
    subtitle: '22 個框架、6 種執行模式、獨家 Change Propagation Engine。',
    url: 'https://charleschen.medium.com/%E4%B8%80%E5%80%8B%E9%96%8B%E6%BA%90-claude-skill-%E5%A6%82%E4%BD%95%E5%8F%96%E4%BB%A3%E4%BD%A0%E7%9A%84%E6%95%B4%E5%80%8B-pm-%E5%B7%A5%E5%85%B7%E9%8F%88-22-%E5%80%8B%E6%A1%86%E6%9E%B6-6-%E7%A8%AE%E5%9F%B7%E8%A1%8C%E6%A8%A1%E5%BC%8F-%E7%8D%A8%E5%AE%B6-change-propagation-engine-32424c678d6a',
    platform: 'Medium',
    date: '2026-03-15',
    cover: 'https://miro.medium.com/0*oz5OiwumXzXqUVM1',
  },
  {
    title: '情勒鳥的 40 億美元豪賭：Duolingo 為何在 2026 年選擇「犧牲利潤」來換取生存？',
    subtitle: '2026年2月，教育科技巨頭Duolingo投下震撼彈：儘管2025年營收破10億美元，股價卻暴跌超20%，反映創辦人採取的策略轉向。',
    url: 'https://charlestychen.substack.com/p/40-duolingo-2026',
    platform: 'Substack',
    date: '2026-02-28',
    cover: 'https://substack-post-media.s3.amazonaws.com/public/images/6e333e83-ff3a-4dd3-9405-8a33de3cbab7_1042x583.jpeg',
  },
  {
    title: '產品經理 vs. 專案經理',
    subtitle: '兩個角色的本質差異與職涯定位。',
    url: 'https://charleschen.medium.com/%E6%88%91%E5%BF%83%E4%B8%AD%E7%9A%84%E7%94%A2%E5%93%81%E7%B6%93%E7%90%86-vs-%E5%B0%88%E6%A1%88%E7%B6%93%E7%90%86-7e34fc57ec70',
    platform: 'Medium',
    date: '2025-06-01',
    cover: 'https://miro.medium.com/1*McevyyNy8urbJciiN7YwAQ.png',
  },
  {
    title: 'OKR 實務上要如何成功落地？',
    subtitle: '從理論到實踐的 OKR 導入經驗。',
    url: 'https://charleschen.medium.com/okr%E5%AF%A6%E5%8B%99%E4%B8%8A%E8%A6%81%E5%A6%82%E4%BD%95%E6%88%90%E5%8A%9F%E8%90%BD%E5%9C%B0-fc9890830854',
    platform: 'Medium',
    date: '2025-05-01',
    cover: 'https://miro.medium.com/1*ciHZKpKZwrIQXrZBUecslw.jpeg',
  },
  {
    title: '產品經理 — 不要關注產品交付，而是產品探索',
    subtitle: 'Discovery over delivery 的產品開發心法。',
    url: 'https://charleschen.medium.com/%E7%94%A2%E5%93%81%E7%B6%93%E7%90%86-%E4%B8%8D%E8%A6%81%E9%97%9C%E6%B3%A8%E7%94%A2%E5%93%81%E4%BA%A4%E4%BB%98-%E8%80%8C%E6%98%AF%E7%94%A2%E5%93%81%E6%8E%A2%E7%B4%A2-953381b1d4eb',
    platform: 'Medium',
    date: '2025-04-01',
    cover: 'https://miro.medium.com/1*07FSIHrRmf8KDY65SQ0Fsw.png',
  },
  {
    title: '反思系列（二）| Authority vs Influence | 我心目中的真正領導力',
    subtitle: '權威與影響力的本質差異。',
    url: 'https://charleschen.medium.com/%E5%8F%8D%E6%80%9D%E7%B3%BB%E5%88%97-%E4%BA%8C-authority-vs-influence-%E6%88%91%E5%BF%83%E7%9B%AE%E4%B8%AD%E7%9A%84%E7%9C%9F%E6%AD%A3%E9%A0%98%E5%B0%8E%E5%8A%9B-6f2bb20f04d1',
    platform: 'Medium',
    date: '2025-03-01',
    cover: 'https://miro.medium.com/0*URLUPWfvbuhIc30h',
  },
  {
    title: '反思系列（一）| 決策如何失敗？| 無人可避免的認知偏誤',
    subtitle: '認知偏誤如何影響產品決策。',
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
