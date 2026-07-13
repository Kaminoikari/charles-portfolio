// Blog articles are external posts on Substack/Medium. The original
// articles are written in Traditional Chinese, so the Chinese-locale
// titles + subtitles here match the actual published article copy.

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
  {
    title: '我如何用 LangGraph 打造「企業級」AI 數位分身',
    subtitle: '來聊聊企業對 AI 應用的真正技術需求：從語意快取、混合檢索到自我修正管線，一個產品經理的 Enterprise-grade RAG 實踐。',
    url: 'https://charlestychen.substack.com/p/langgraph-ai',
    platform: 'Substack',
    date: '2026-06-04',
    featured: true,
    cover: 'https://substack-post-media.s3.amazonaws.com/public/images/180e9fdf-9f06-450e-adda-d9d13a0a92f2_1470x980.avif',
  },
  // ── Chronological (newest first) ──
  {
    title: 'AI 什麼都給你最合理的答案，但好策略「應該要能被反對」',
    subtitle: 'Instagram 有三十億每月活躍用戶，負責人 Mosseri 卻說：判斷力不是讀出來的，是賭出來的。',
    url: 'https://charlestychen.substack.com/p/ai-e32',
    platform: 'Substack',
    date: '2026-07-12',
    cover: 'https://substack-post-media.s3.amazonaws.com/public/images/b59c06a2-93e3-4225-969a-eb6ade9a2061_1470x980.jpeg',
  },
  {
    title: '你的職能，是你工作的「平均值」',
    subtitle: '當實作成本歸零，台灣 PM 該擔心的不是被 AI 取代，而是你那份『什麼都做』的雜學，究竟是繼續被動補洞，還是主動擴張。',
    url: 'https://charlestychen.substack.com/p/484',
    platform: 'Substack',
    date: '2026-07-02',
    cover: 'https://substack-post-media.s3.amazonaws.com/public/images/7719f968-2b5b-4962-8ef3-d1b1ee9f5fa8_1672x941.png',
  },
  {
    title: '如何打造全世界最 AI 化的工程團隊',
    subtitle: 'Claude Code 與 Cowork 負責人 Fiona Fung 的一線觀察。當每季產出暴增八倍、角色界線全面模糊、agent 無所不在，她怎麼帶團隊、又怎麼守住文化。',
    url: 'https://charlestychen.substack.com/p/ai',
    platform: 'Substack',
    date: '2026-06-22',
    cover: 'https://substack-post-media.s3.amazonaws.com/public/images/bd16fff7-a139-421f-8316-72b1c2b6048f_1672x941.png',
  },
  {
    title: '我用一星期，建立 Physical AI 的心智模型',
    subtitle: '從 MockWorld 到 SmolVLA，一場一週的小型實驗如何讓我親身理解 LLM Orchestration 與 Robotics Policy 的真實邊界。',
    url: 'https://charlestychen.substack.com/p/physical-ai',
    platform: 'Substack',
    date: '2026-06-16',
    cover: 'https://substack-post-media.s3.amazonaws.com/public/images/6831e03c-be9f-4e8f-96d9-6ab9012f7da2_1402x1122.png',
  },
  {
    title: '為什麼 AI 實驗室開始押注硬體：Caitlin Kalinowski 的觀察',
    subtitle: '舊金山 AI 圈最近的共識：鍵盤前能做的事遲早飽和，下一波浪潮在物理世界。',
    url: 'https://charlestychen.substack.com/p/ai-caitlyn-kalinowski',
    platform: 'Substack',
    date: '2026-05-17',
    cover: 'https://substack-post-media.s3.amazonaws.com/public/images/28935939-649f-4cb7-b88f-ac8ca791398c_1717x916.png',
  },
  {
    title: '別再盲目爬管理階梯了：迎來「Hi-C 高影響力獨立貢獻者」時代，與被我們忽視的 Context 數位化',
    subtitle: 'AI 已經讓「一個人＝一個部門」成為可能，但你的公司，準備好放手讓你做了嗎？',
    url: 'https://charlestychen.substack.com/p/hi-c-context',
    platform: 'Substack',
    date: '2026-05-16',
    cover: 'https://substack-post-media.s3.amazonaws.com/public/images/0d5e29cb-f289-4d7f-823e-70c739972f00_1672x941.png',
  },
  {
    title: 'AI Builder 的學習地圖：《Beyond LLM》課程完整筆記',
    subtitle: '本課程由史丹佛大學教授授課，系統化拆解 AI 工程師與 AI Builder 核心職能。內容從大型語言模型（LLM）的本質限制出發，一路涵蓋 Prompt Engineering、RAG、Fine-Tuning 到高階的 Agentic Workflow 與 Multi-Agent 框架，這是一套將 AI 技術轉化為實質商業價值的完整認知體系。',
    url: 'https://charlestychen.substack.com/p/ai-builder-beyond-llm',
    platform: 'Substack',
    date: '2026-05-11',
    cover: 'https://substack-post-media.s3.amazonaws.com/public/images/d4a0ae46-a6fc-48b4-ad40-65bae8937f96_1536x1024.png',
  },
  {
    title: '為什麼在 AI 時代，培養 agency 比培養技能更重要',
    subtitle: '當 AI 把技能瓶頸拿掉之後，真正分出高下的是什麼？Notion 產品負責人 Max Schoening 給的答案是 agency。',
    url: 'https://charlestychen.substack.com/p/ai-agency',
    platform: 'Substack',
    date: '2026-05-05',
    cover: 'https://substack-post-media.s3.amazonaws.com/public/images/d5925d65-be4b-4606-9938-4adf3df5b724_1536x1024.png',
  },
  {
    title: '當純軟體不再是護城河：什麼才是今日持久的競爭優勢？',
    subtitle: 'Snap CEO Evan Spiegel 談：為什麼 15 年來只有兩個 consumer app 活下來、Snapchat 每一個功能都被抄走、硬體才是唯一真正的 moat、以及 distribution 比產品更重要。',
    url: 'https://charlestychen.substack.com/p/ai-distribution',
    platform: 'Substack',
    date: '2026-04-27',
    cover: 'https://substack-post-media.s3.amazonaws.com/public/images/6f3a89a9-97a4-4b89-9d72-0bee47261402_1122x1402.png',
  },
  {
    title: '當模型每天都在變強，PM 到底該做什麼？',
    subtitle: 'Anthropic Claude Code 產品負責人 Cat Wu 的 7 個反直覺 PM 洞察。',
    url: 'https://charlestychen.substack.com/p/pm-b5b',
    platform: 'Substack',
    date: '2026-04-24',
    cover: 'https://substack-post-media.s3.amazonaws.com/public/images/b437e201-2daa-425f-bd54-40c92a4da7a9_1088x1445.png',
  },
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
    date: '2024-06-27',
    cover: 'https://miro.medium.com/1*McevyyNy8urbJciiN7YwAQ.png',
  },
  {
    title: 'OKR 實務上要如何成功落地？',
    subtitle: '從理論到實踐的 OKR 導入經驗。',
    url: 'https://charleschen.medium.com/okr%E5%AF%A6%E5%8B%99%E4%B8%8A%E8%A6%81%E5%A6%82%E4%BD%95%E6%88%90%E5%8A%9F%E8%90%BD%E5%9C%B0-fc9890830854',
    platform: 'Medium',
    date: '2023-09-03',
    cover: 'https://miro.medium.com/1*ciHZKpKZwrIQXrZBUecslw.jpeg',
  },
  {
    title: '產品經理 — 不要關注產品交付，而是產品探索',
    subtitle: 'Discovery over delivery 的產品開發心法。',
    url: 'https://charleschen.medium.com/%E7%94%A2%E5%93%81%E7%B6%93%E7%90%86-%E4%B8%8D%E8%A6%81%E9%97%9C%E6%B3%A8%E7%94%A2%E5%93%81%E4%BA%A4%E4%BB%98-%E8%80%8C%E6%98%AF%E7%94%A2%E5%93%81%E6%8E%A2%E7%B4%A2-953381b1d4eb',
    platform: 'Medium',
    date: '2023-08-01',
    cover: 'https://miro.medium.com/1*07FSIHrRmf8KDY65SQ0Fsw.png',
  },
  {
    title: '反思系列（二）| Authority vs Influence | 我心目中的真正領導力',
    subtitle: '權威與影響力的本質差異。',
    url: 'https://charleschen.medium.com/%E5%8F%8D%E6%80%9D%E7%B3%BB%E5%88%97-%E4%BA%8C-authority-vs-influence-%E6%88%91%E5%BF%83%E7%9B%AE%E4%B8%AD%E7%9A%84%E7%9C%9F%E6%AD%A3%E9%A0%98%E5%B0%8E%E5%8A%9B-6f2bb20f04d1',
    platform: 'Medium',
    date: '2022-09-11',
    cover: 'https://miro.medium.com/0*URLUPWfvbuhIc30h',
  },
  {
    title: '反思系列（一）| 決策如何失敗？| 無人可避免的認知偏誤',
    subtitle: '認知偏誤如何影響產品決策。',
    url: 'https://charleschen.medium.com/%E4%BC%81%E6%A5%AD%E7%87%9F%E9%81%8B%E5%A4%A7%E6%9C%89%E5%95%8F%E9%A1%8C-%E5%86%8D%E8%81%B0%E6%98%8E%E7%9A%84%E4%BA%BA%E9%83%BD%E7%84%A1%E6%B3%95%E9%81%BF%E5%85%8D%E8%AA%8D%E7%9F%A5%E5%81%8F%E8%AA%A4-d6053d9fdcf6',
    platform: 'Medium',
    date: '2022-03-09',
    cover: 'https://miro.medium.com/1*5NCkG52ADLxcDw_etFnWoA.jpeg',
  },
]

export const platformLinks = {
  medium: 'https://charleschen.medium.com/',
  substack: 'https://charlestychen.substack.com/',
}
