// Translation policy: the linked Substack/Medium articles are published
// in Traditional Chinese. The English-locale entries below render English
// titles and subtitles as descriptions of each article's content for
// English readers. Clicking through lands on the original Chinese article,
// mirroring how English-language tech blogs summarize foreign-language
// sources for their readers.
//
//   - Product names / framework names / tech stack stay as-is by
//     convention (Claude Code, Product Sense, LLM Wiki, OKR, etc.).
//   - The article body itself remains in Chinese on the source platform.

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
    title: "Why I Turned Down an Uber L4 Offer: A PM's Career Reckoning in the AI Wave",
    subtitle:
      'A career reflection in the age of AI: when the prestige of a global tech giant met the AI shift, how I made the hardest call of my career.',
    url: 'https://charlestychen.substack.com/p/uber-l4-offer-pm-ai',
    platform: 'Substack',
    date: '2026-04-12',
    featured: true,
    cover: 'https://substack-post-media.s3.amazonaws.com/public/images/781195a1-7e0f-450d-88f1-3e976a22cf3d_1206x968.jpeg',
  },
  {
    title: 'How I Built an "Enterprise-Grade" AI Digital Twin with LangGraph',
    subtitle:
      "What enterprises really need from AI applications: from semantic caching and hybrid retrieval to a self-correcting pipeline, one product manager's take on enterprise-grade RAG.",
    url: 'https://charlestychen.substack.com/p/langgraph-ai',
    platform: 'Substack',
    date: '2026-06-04',
    featured: true,
    cover: 'https://substack-post-media.s3.amazonaws.com/public/images/180e9fdf-9f06-450e-adda-d9d13a0a92f2_1470x980.avif',
  },
  // ── Chronological (newest first) ──
  {
    title: 'Building a Mental Model of Physical AI in One Week',
    subtitle:
      'From MockWorld to SmolVLA, how a one-week mini-experiment let me feel out firsthand the real boundaries between LLM orchestration and robotics policy.',
    url: 'https://charlestychen.substack.com/p/physical-ai',
    platform: 'Substack',
    date: '2026-06-16',
    cover: 'https://substack-post-media.s3.amazonaws.com/public/images/6831e03c-be9f-4e8f-96d9-6ab9012f7da2_1402x1122.png',
  },
  {
    title: "Why AI Labs Are Starting to Bet on Hardware: Caitlin Kalinowski's Take",
    subtitle:
      "The emerging consensus in San Francisco's AI scene: what you can do in front of a keyboard will eventually saturate, and the next wave is in the physical world.",
    url: 'https://charlestychen.substack.com/p/ai-caitlyn-kalinowski',
    platform: 'Substack',
    date: '2026-05-17',
    cover: 'https://substack-post-media.s3.amazonaws.com/public/images/28935939-649f-4cb7-b88f-ac8ca791398c_1717x916.png',
  },
  {
    title:
      'Stop Blindly Climbing the Management Ladder: The Era of the "Hi-C High-Impact Individual Contributor" and the Context Digitization We Overlooked',
    subtitle:
      'AI has already made "one person equals one department" possible, but is your company ready to let you run with it?',
    url: 'https://charlestychen.substack.com/p/hi-c-context',
    platform: 'Substack',
    date: '2026-05-16',
    cover: 'https://substack-post-media.s3.amazonaws.com/public/images/0d5e29cb-f289-4d7f-823e-70c739972f00_1672x941.png',
  },
  {
    title: 'An AI Builder\'s Learning Map: Complete Notes from the "Beyond LLM" Course',
    subtitle:
      'Taught by a Stanford professor, this course systematically breaks down the core competencies of the AI engineer and the AI Builder. Starting from the inherent limits of large language models (LLM), it covers Prompt Engineering, RAG, and Fine-Tuning through to advanced Agentic Workflow and Multi-Agent frameworks: a complete framework of thinking for turning AI technology into real business value.',
    url: 'https://charlestychen.substack.com/p/ai-builder-beyond-llm',
    platform: 'Substack',
    date: '2026-05-11',
    cover: 'https://substack-post-media.s3.amazonaws.com/public/images/d4a0ae46-a6fc-48b4-ad40-65bae8937f96_1536x1024.png',
  },
  {
    title: 'Why Cultivating Agency Matters More Than Skills in the AI Era',
    subtitle:
      "Once AI removes the skill bottleneck, what really sets people apart? Notion product lead Max Schoening's answer is agency.",
    url: 'https://charlestychen.substack.com/p/ai-agency',
    platform: 'Substack',
    date: '2026-05-05',
    cover: 'https://substack-post-media.s3.amazonaws.com/public/images/d5925d65-be4b-4606-9938-4adf3df5b724_1536x1024.png',
  },
  {
    title: 'When Software Alone Is No Longer a Moat: What Makes a Durable Competitive Advantage Today?',
    subtitle:
      'Snap CEO Evan Spiegel on why only two consumer apps have survived in 15 years, how every Snapchat feature got copied, why hardware is the only real moat, and why distribution matters more than the product.',
    url: 'https://charlestychen.substack.com/p/ai-distribution',
    platform: 'Substack',
    date: '2026-04-27',
    cover: 'https://substack-post-media.s3.amazonaws.com/public/images/6f3a89a9-97a4-4b89-9d72-0bee47261402_1122x1402.png',
  },
  {
    title: 'When Models Get Stronger Every Day, What Should a PM Actually Do?',
    subtitle: 'Seven counterintuitive PM insights from Anthropic Claude Code product lead Cat Wu.',
    url: 'https://charlestychen.substack.com/p/pm-b5b',
    platform: 'Substack',
    date: '2026-04-24',
    cover: 'https://substack-post-media.s3.amazonaws.com/public/images/b437e201-2daa-425f-bd54-40c92a4da7a9_1088x1445.png',
  },
  {
    title: 'The Next Two Years May Be the Most Chaotic Era in PM History',
    subtitle:
      "Why half of all PMs will be washed out, and what the half who stay are doing right. Nikhyl Singhal on the PM watershed, the threshold for reinventing yourself, and what I'm seeing on the ground in Taiwan.",
    url: 'https://charlestychen.substack.com/p/pm',
    platform: 'Substack',
    date: '2026-04-19',
    cover: 'https://substack-post-media.s3.amazonaws.com/public/images/7884d646-fa97-4fd4-bfe1-2fa01cfea1ff_1536x1024.png',
  },
  {
    title: "Building a Second Brain That Grows Itself: A Hands-On Guide to Karpathy + Lex Fridman's LLM Wiki",
    subtitle:
      "Use AI to build a second brain that grows on its own: a complete build guide for Karpathy's LLM Wiki plus Obsidian.",
    url: 'https://charlestychen.substack.com/p/karpathy-lex-fridman-llm-wiki',
    platform: 'Substack',
    date: '2026-04-10',
    cover: 'https://substack-post-media.s3.amazonaws.com/public/images/3a2ca83a-9815-48a0-b9de-d618e6ee8cb4_2178x1134.png',
  },
  {
    title: "What I Learned from Stanford CS153: Where Is AI's Real Bottleneck?",
    subtitle: 'Nicknamed "AI Coachella," this may be the most sought-after class in the world right now.',
    url: 'https://charlestychen.substack.com/p/cs153-ai',
    platform: 'Substack',
    date: '2026-04-08',
    cover: 'https://substack-post-media.s3.amazonaws.com/public/images/8a4f2a9b-0010-43d3-b2b1-5a5bae7f2651_2816x1536.png',
  },
  {
    title:
      'A Deep Dive into the Claude Code Source: A Full Analysis of the Agent OS Architecture and Automated Engineering Practice',
    subtitle:
      'The Claude Code source leak sent shockwaves through the developer community and had a profound impact on the future of Harness Engineering.',
    url: 'https://charlestychen.substack.com/p/claude-code-agent-os',
    platform: 'Substack',
    date: '2026-04-01',
    cover: 'https://substack-post-media.s3.amazonaws.com/public/images/5c66c5ed-0d3f-4906-af45-28884689a928_2816x1536.png',
  },
  {
    title: "Only It Can Hear the Truth Through the Noise: The Math Behind Shazam's Split-Second Recognition",
    subtitle:
      'Starting from Avery Wang\'s legendary paper, a breakdown of how the "time-alignment histogram" lets a phone read minds precisely through the noise.',
    url: 'https://charlestychen.substack.com/p/shazam',
    platform: 'Substack',
    date: '2026-03-31',
    cover: 'https://substack-post-media.s3.amazonaws.com/public/images/d76b5f80-61e0-4c5e-b269-ca113a2e8c03_2816x1536.png',
  },
  {
    title: 'The Ultimate Promotion Mystery for Product Managers: Who Defines Your Product Sense?',
    subtitle: 'Breaking down what Product Sense is made of and how to develop it.',
    url: 'https://charlestychen.substack.com/p/product-sense',
    platform: 'Substack',
    date: '2026-03-31',
    cover: 'https://substack-post-media.s3.amazonaws.com/public/images/d3037171-c5a5-4375-b2bc-756cd14c987b_2752x1536.png',
  },
  {
    title: 'How One Open-Source Claude Skill Can Replace Your Entire PM Toolchain',
    subtitle: '22 frameworks, 6 execution modes, and an exclusive Change Propagation Engine.',
    url: 'https://charleschen.medium.com/%E4%B8%80%E5%80%8B%E9%96%8B%E6%BA%90-claude-skill-%E5%A6%82%E4%BD%95%E5%8F%96%E4%BB%A3%E4%BD%A0%E7%9A%84%E6%95%B4%E5%80%8B-pm-%E5%B7%A5%E5%85%B7%E9%8F%88-22-%E5%80%8B%E6%A1%86%E6%9E%B6-6-%E7%A8%AE%E5%9F%B7%E8%A1%8C%E6%A8%A1%E5%BC%8F-%E7%8D%A8%E5%AE%B6-change-propagation-engine-32424c678d6a',
    platform: 'Medium',
    date: '2026-03-15',
    cover: 'https://miro.medium.com/0*oz5OiwumXzXqUVM1',
  },
  {
    title: 'The Guilt-Trip Owl\'s $4 Billion Gamble: Why Duolingo Chose to "Sacrifice Profit" for Survival in 2026',
    subtitle:
      'In February 2026, edtech giant Duolingo dropped a bombshell: despite 2025 revenue topping $1 billion, its stock plunged more than 20%, reflecting a strategic pivot by its founder.',
    url: 'https://charlestychen.substack.com/p/40-duolingo-2026',
    platform: 'Substack',
    date: '2026-02-28',
    cover: 'https://substack-post-media.s3.amazonaws.com/public/images/6e333e83-ff3a-4dd3-9405-8a33de3cbab7_1042x583.jpeg',
  },
  {
    title: 'Product Manager vs. Project Manager',
    subtitle: 'The fundamental differences between the two roles, and how each fits into a career.',
    url: 'https://charleschen.medium.com/%E6%88%91%E5%BF%83%E4%B8%AD%E7%9A%84%E7%94%A2%E5%93%81%E7%B6%93%E7%90%86-vs-%E5%B0%88%E6%A1%88%E7%B6%93%E7%90%86-7e34fc57ec70',
    platform: 'Medium',
    date: '2024-06-27',
    cover: 'https://miro.medium.com/1*McevyyNy8urbJciiN7YwAQ.png',
  },
  {
    title: 'How Do You Successfully Land OKRs in Practice?',
    subtitle: 'Lessons from rolling out OKR, from theory to practice.',
    url: 'https://charleschen.medium.com/okr%E5%AF%A6%E5%8B%99%E4%B8%8A%E8%A6%81%E5%A6%82%E4%BD%95%E6%88%90%E5%8A%9F%E8%90%BD%E5%9C%B0-fc9890830854',
    platform: 'Medium',
    date: '2023-09-03',
    cover: 'https://miro.medium.com/1*ciHZKpKZwrIQXrZBUecslw.jpeg',
  },
  {
    title: 'Product Managers: Focus on Product Discovery Over Delivery',
    subtitle: 'The product development mindset of discovery over delivery.',
    url: 'https://charleschen.medium.com/%E7%94%A2%E5%93%81%E7%B6%93%E7%90%86-%E4%B8%8D%E8%A6%81%E9%97%9C%E6%B3%A8%E7%94%A2%E5%93%81%E4%BA%A4%E4%BB%98-%E8%80%8C%E6%98%AF%E7%94%A2%E5%93%81%E6%8E%A2%E7%B4%A2-953381b1d4eb',
    platform: 'Medium',
    date: '2023-08-01',
    cover: 'https://miro.medium.com/1*07FSIHrRmf8KDY65SQ0Fsw.png',
  },
  {
    title: 'Reflections (Part 2) | Authority vs Influence | What Real Leadership Means to Me',
    subtitle: 'The fundamental difference between authority and influence.',
    url: 'https://charleschen.medium.com/%E5%8F%8D%E6%80%9D%E7%B3%BB%E5%88%97-%E4%BA%8C-authority-vs-influence-%E6%88%91%E5%BF%83%E7%9B%AE%E4%B8%AD%E7%9A%84%E7%9C%9F%E6%AD%A3%E9%A0%98%E5%B0%8E%E5%8A%9B-6f2bb20f04d1',
    platform: 'Medium',
    date: '2022-09-11',
    cover: 'https://miro.medium.com/0*URLUPWfvbuhIc30h',
  },
  {
    title: 'Reflections (Part 1) | How Do Decisions Fail? | The Cognitive Biases No One Can Avoid',
    subtitle: 'How cognitive bias shapes product decisions.',
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
