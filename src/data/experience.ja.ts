// Translation policy mirrors src/i18n/strings/ja.ts:
//   - Job titles (Product Manager / Senior Product Manager / Operations
//     Manager / Product Mentor) and company names stay English. Date
//     ranges stay English-style (uppercase month + year) to match the
//     monospace layout in the timeline rendering.
//   - Bullet metric phrasing translated to Japanese, but standard tech /
//     product terms (B2B SaaS, BI, AI, AI Product Builder, Claude Code,
//     Codex, Antigravity) stay English.

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
      '85%+ の売上インパクト——駐車場決済・出張・金融保険の 3 つのプロダクトラインの戦略を主導（台湾 + 日本）',
      '0→1 で USPACE for Business をローンチ。企業の出張管理向け B2B SaaS',
      '5 倍速いイテレーション——Claude Code、Codex、Antigravity を活用した AI 駆動プロトタイピングを推進',
    ],
  },
  {
    dateRange: 'JAN 2025 — PRESENT',
    title: 'Product Mentor',
    organization: 'XChange School',
    bullets: [
      '台湾最大のインターネット業界プロフェッショナルコミュニティで、PM を目指す人をメンタリング',
    ],
  },
  {
    dateRange: 'FEB 2024 — MAY 2024',
    title: 'Senior Product Manager',
    organization: 'NUEIP Technology Co., Ltd.',
    bullets: [
      '+40% のデータ駆動の意思決定——高度な分析と AI を統合したエンドツーエンドの BI プロダクトを構築',
      '+35% の予測精度——戦略立案のための予測分析モデルを導入',
      '50% 高速なレポーティング——BI ダッシュボードを統合し、データ取得時間を短縮',
    ],
  },
  {
    dateRange: 'AUG 2022 — FEB 2024',
    title: 'Product Manager',
    organization: 'PXPay Plus Co., Ltd.',
    bullets: [
      '+25% の取引コンバージョン率——3 ヶ月でサインアップとチェックアウトのフローを再設計',
      '+50% のオペレーション効率——リワードポイントシステムを先導、顧客クレーム -40%',
      '駐車場・ケーブル TV・年金・行政手数料のサードパーティ決済統合をリード',
    ],
  },
  {
    dateRange: 'SEP 2019 — MAR 2022',
    title: 'Operations Manager',
    organization: 'FLUX Technology Inc.',
    bullets: [
      '+20% の市場シェア——競合分析を通じてプロダクト戦略を構築',
      '+30% のユーザーリテンション——3 つのプロダクトラインの公式サイトと SEO を再設計',
      '10 人のチームを率いた——プロセス効率 +22%、出荷スピード +35%',
    ],
  },
]
