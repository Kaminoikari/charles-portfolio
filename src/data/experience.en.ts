export interface ExperienceItem {
  dateRange: string
  title: string
  organization: string
  bullets: string[]
}

export const experience: ExperienceItem[] = [
  {
    dateRange: 'JULY 2024 — PRESENT',
    title: 'Product Manager',
    organization: 'USPACE Tech Co., Ltd.',
    bullets: [
      'Started as USPACE app owner leading a 15-person cross-functional Scrum team (PM, dev, design), then drove product strategy across parking payments, corporate travel & insurance, doubling iteration velocity',
      '0→1 launched USPACE for Business (Sep 2025): a B2B SaaS for corporate travel management, owned end-to-end from sales discovery through spec, launch, payments & reconciliation',
      '5x faster iteration, zero added engineering headcount: redefined the AI Product Builder role, engineering the full stack via agentic workflows with Claude Code & Codex',
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
      '+25% transaction conversions: redesigned sign-up & checkout flow in 3 months',
      '+50% operational efficiency: pioneered reward points system, -40% customer complaints',
      'Led third-party billing integration for parking, cable TV, pension & government payments',
    ],
  },
  {
    dateRange: 'SEP 2019 — MAR 2022',
    title: 'Operations Manager',
    organization: 'FLUX Technology Inc.',
    bullets: [
      '+20% market share: developed product strategy through competitive analysis',
      '+30% user retention: redesigned website & SEO for 3-product ecosystem',
      'Directed team of 10: +22% process efficiency, +35% order fulfillment speed',
    ],
  },
]
