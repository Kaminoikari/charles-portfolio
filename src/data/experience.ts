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
      '85%+ revenue impact — owned product strategy across parking, subscriptions & enterprise lines (TW + JP)',
      '0→1 launched USPACE for Business, a B2B SaaS for corporate travel management',
      '5x faster iteration — pioneered AI-driven prototyping with Claude Code, Cursor & Antigravity',
    ],
  },
  {
    dateRange: 'JAN 2025 — PRESENT',
    title: 'Product Mentor',
    organization: 'XChange School',
    bullets: [
      'Mentoring aspiring PMs at Taiwan\'s largest internet professional community',
    ],
  },
  {
    dateRange: 'FEB 2024 — MAY 2024',
    title: 'Senior Product Manager',
    organization: 'NUEIP Technology Co., Ltd.',
    bullets: [
      '+40% data-driven decisions — built end-to-end BI product with advanced analytics & AI',
      '+35% forecast accuracy — implemented predictive analytics models for strategic planning',
      '50% faster reporting — integrated BI dashboards cutting data retrieval time',
    ],
  },
  {
    dateRange: 'AUG 2022 — FEB 2024',
    title: 'Product Manager',
    organization: 'PXPay Plus Co., Ltd.',
    bullets: [
      '+25% transaction conversions — redesigned sign-up & checkout flow in 3 months',
      '+50% operational efficiency — pioneered reward points system, -40% customer complaints',
      'Led third-party billing integration for parking, cable TV, pension & government payments',
    ],
  },
  {
    dateRange: 'SEP 2019 — MAR 2022',
    title: 'Operations Manager',
    organization: 'FLUX Technology Inc.',
    bullets: [
      '+20% market share — developed product strategy through competitive analysis',
      '+30% user retention — redesigned website & SEO for 3-product ecosystem',
      'Directed team of 10 — +22% process efficiency, +35% order fulfillment speed',
    ],
  },
]
