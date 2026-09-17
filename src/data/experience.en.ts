export interface ExperienceItem {
  dateRange: string
  title: string
  organization: string
  // Stable English company name used as the career-photo lookup key
  // (career-photos.ts is keyed by these). Locales that localize `organization`
  // (e.g. the bilingual zh-TW timeline) set this to the English name so photos
  // still resolve; when absent, `organization` is used as the key directly.
  orgKey?: string
  bullets: string[]
}

export const experience: ExperienceItem[] = [
  {
    dateRange: 'JULY 2024 — PRESENT',
    title: 'Head of Product',
    organization: 'USPACE Tech Co., Ltd.',
    bullets: [
      'Lead a 6-person product team owning product strategy, the annual roadmap and OKRs across the Taiwan and Japan markets, plus the mobility product-line matrix: parking payments, corporate travel and insurance, B2C airport transfers, a driver-side dispatch console app and a car-coating SaaS',
      "Drove the product org's AI transformation: built a department-wide RAG knowledge base and an agentic workflow SOP, cutting the discovery and competitive-analysis cycle by 80%",
      '0→1 launched USPACE for Business (Sep 2025): a B2B SaaS for corporate travel management, owned end-to-end from sales discovery through spec, launch, payments & reconciliation, reaching 30+ listed and multinational accounts in 3 months and growing B2B ARR 250%',
      '5x faster iteration, zero added engineering headcount: redefined the AI Product Builder role, engineering the full stack via agentic workflows with Claude Code & Codex, and architected the Maestro MCP end-to-end test suite for the app rewrite, freeing 80% of regression-testing hours',
      'Started as USPACE app owner leading a 15-person cross-functional Scrum team (PM, dev, design) at a 95%+ on-time release rate, doubling iteration velocity',
      "Launched Taiwan's first subscription-based parking insurance: an FSC sandbox trial with Fubon Insurance, pay-as-you-park pricing embedded one-tap for 1M+ members",
    ],
  },
  {
    dateRange: 'JAN 2025 — PRESENT',
    title: 'Product Mentor',
    organization: 'XChange School',
    bullets: [
      'Mentoring aspiring PMs at Taiwan\'s largest internet professional community',
      'Mentees are drawn from renowned Taiwanese universities, including National Taiwan University (NTU), National Chengchi University (NCCU), National Taipei University and Fu Jen Catholic University',
    ],
  },
  {
    dateRange: 'FEB 2024 — MAY 2024',
    title: 'Senior Product Manager',
    organization: 'NUEIP Technology Co., Ltd.',
    bullets: [
      '+40% data-driven decisions: built end-to-end BI product with advanced analytics & AI',
      '+35% forecast accuracy: implemented predictive analytics models for strategic planning',
      '50% faster reporting: integrated BI dashboards cutting data retrieval time',
    ],
  },
  {
    dateRange: 'AUG 2022 — FEB 2024',
    title: 'Product Manager',
    organization: 'PXPay Plus Co., Ltd.',
    bullets: [
      '+25% sign-up-to-first-transaction conversion: redesigned sign-up & checkout flow in 3 months, cutting average sign-up time 60% and adding 750K users and NT$450M in transaction volume',
      '+50% operational efficiency: pioneered reward points system, -40% customer complaints',
      'Led third-party billing integration for parking, cable TV, national pension & government payments, driving 30% of non-retail transaction volume and +15% MAU',
    ],
  },
  {
    dateRange: 'SEP 2019 — MAR 2022',
    title: 'Operations Manager',
    organization: 'FLUX Technology Inc.',
    bullets: [
      '+20% market share, +NT$50M annual revenue: rebuilt pricing, channel & product-mix strategy through competitive analysis',
      '+30% user retention: redesigned website & SEO for 3-product ecosystem',
      'Directed team of 10: +22% process efficiency, +35% order fulfillment speed',
    ],
  },
]
