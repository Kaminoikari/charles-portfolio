// Translation policy for the zh-TW Experience timeline:
//   - Job titles and company names are shown bilingually as "中文 · English"
//     (e.g. "資深產品經理 · Senior Product Manager"), so the Chinese reader
//     gets a localized label while the recognizable English brand / title is
//     preserved. `orgKey` carries the plain English company name so the career
//     photos (keyed by English in career-photos.ts) still resolve.
//   - Date ranges stay English-style (uppercase month + year) to match the
//     monospace layout in the timeline rendering.
//   - Bullet metric phrasing translated to Traditional Chinese, but standard
//     tech / product terms (B2B SaaS, BI, AI, AI Product Builder, Claude Code,
//     Codex, Antigravity) stay English.

export interface ExperienceItem {
  dateRange: string
  title: string
  organization: string
  // Stable English company name for the career-photo lookup (career-photos.ts).
  // Set here because `organization` above is bilingual and would not match.
  orgKey?: string
  bullets: string[]
}

export const experience: ExperienceItem[] = [
  {
    dateRange: 'JULY 2024 — PRESENT',
    title: '產品經理 · Product Manager',
    organization: '悠勢科技股份有限公司 · USPACE Tech Co., Ltd.',
    orgKey: 'USPACE Tech Co., Ltd.',
    bullets: [
      '初期擔任 USPACE app 負責人，帶領 15 人跨職能 Scrum 團隊（PM、開發、設計），後續主導停車支付、企業差旅、保險三條產品線的策略，產品迭代速度翻倍',
      '0→1 推出 USPACE for Business（2025 年 9 月）：企業差旅管理 B2B SaaS，從業務探索、規格、開發測試、上線到金流與財務對帳，全生命週期獨力負責',
      '5x 更快的迭代、零額外工程人力：重新定義 AI Product Builder 角色，以 Claude Code、Codex 的 agentic workflow 親手打造全端',
      '推出全台首創訂閱制停車保險：與富邦產險合作的 FSC 監理沙盒試辦，pay-as-you-park 用量計價，一鍵嵌入結帳、觸及 100 萬+ 會員',
    ],
  },
  {
    dateRange: 'JAN 2025 — PRESENT',
    title: '產品導師 · Product Mentor',
    // XChange is a community brand with no formal Chinese company name, so the
    // organization stays English-only here (unlike the bilingual rows above).
    organization: 'XChange School',
    orgKey: 'XChange School',
    bullets: [
      '在台灣最大的網路專業社群擔任 mentor，輔導有志成為 PM 的學員',
      '指導學員多來自台大、政大、台北大學、輔仁大學等知名院校',
    ],
  },
  {
    dateRange: 'FEB 2024 — MAY 2024',
    title: '資深產品經理 · Senior Product Manager',
    organization: '人易科技股份有限公司 · NUEIP Technology Co., Ltd.',
    orgKey: 'NUEIP Technology Co., Ltd.',
    bullets: [
      '+40% 資料驅動的決策：打造端到端 BI 產品，整合進階分析與 AI',
      '+35% 預測準確度：導入預測分析模型支援策略規劃',
      '50% 更快的報表產出：整合 BI 儀表板，縮短資料取得時間',
    ],
  },
  {
    dateRange: 'AUG 2022 — FEB 2024',
    title: '產品經理 · Product Manager',
    organization: '全支付電子支付股份有限公司 · PXPay Plus Co., Ltd.',
    orgKey: 'PXPay Plus Co., Ltd.',
    bullets: [
      '+25% 交易轉換率：3 個月內重新設計註冊與結帳流程',
      '+50% 營運效率：率先導入紅利點數系統，客訴 -40%',
      '主導第三方代收整合：停車、有線電視、勞退、政府規費',
    ],
  },
  {
    dateRange: 'SEP 2019 — MAR 2022',
    title: '營運經理 · Operations Manager',
    organization: '通量三維股份有限公司 · FLUX Technology Inc.',
    orgKey: 'FLUX Technology Inc.',
    bullets: [
      '+20% 市佔：透過競品分析建立產品策略',
      '+30% 使用者留存：為 3 條產品線重新設計官網與 SEO',
      '帶領 10 人團隊：流程效率 +22%、出貨速度 +35%',
    ],
  },
]
