// Translation policy mirrors src/i18n/strings/ja.ts:
//   - Job titles (Head of Product / Product Manager / Senior Product
//     Manager / Operations Manager / Product Mentor) and company names stay
//     English. Date ranges stay English-style (uppercase month + year) to
//     match the monospace layout in the timeline rendering.
//   - Bullet metric phrasing translated to Japanese, but standard tech /
//     product terms (B2B SaaS, BI, AI, AI Product Builder, Claude Code,
//     Codex, Antigravity) stay English.

export interface ExperienceItem {
  dateRange: string
  title: string
  organization: string
  // See experience.en.ts: stable English key for career-photo lookup. Unused
  // here (organization already holds the English name), kept for type parity.
  orgKey?: string
  bullets: string[]
}

export const experience: ExperienceItem[] = [
  {
    dateRange: 'JULY 2024 — PRESENT',
    title: 'Head of Product',
    organization: 'USPACE Tech Co., Ltd.',
    bullets: [
      '6 名のプロダクトチームを率い、台湾・日本両市場のプロダクト戦略、年間 Roadmap と OKR を担当。モビリティ事業のプロダクトライン群（駐車場決済・出張・金融保険に加え、B2C 空港送迎、ドライバー向け配車管制アプリ、車体コーティング SaaS）を統括',
      'プロダクト部門の AI トランスフォーメーションを推進：部門の RAG ナレッジベースと Agentic Workflow の標準プロセスを構築し、要件調査と競合分析のサイクルを 80% 短縮',
      '0→1 で USPACE for Business（2025 年 9 月）をローンチ：企業の出張管理向け B2B SaaS で、営業ディスカバリーから仕様・開発テスト・ローンチ、決済・財務照合まで全ライフサイクルを単独で担当。3 ヶ月で上場企業・多国籍企業 30 社超を開拓し、B2B ARR を 250% 成長',
      '5 倍速いイテレーション、エンジニア増員ゼロ：AI Product Builder の役割を再定義し、Claude Code と Codex の agentic workflow でフルスタックを自ら構築。アプリ再構築プロジェクトでは Maestro MCP による E2E 自動テスト一式を単独で設計し、リグレッションテスト工数の 80% を解放',
      '当初は USPACE app のオーナーとして 15 名のクロスファンクショナル Scrum チーム（PM・開発・デザイン）を率い、95% 以上のオンタイムリリース率でイテレーション速度を倍増',
      '台湾初のサブスク型駐車場保険をローンチ：富邦保険との FSC 規制サンドボックス試行で、pay-as-you-park の従量課金をワンタップで決済に組み込み、100 万人超の会員にリーチ',
    ],
  },
  {
    dateRange: 'JAN 2025 — PRESENT',
    title: 'Product Mentor',
    organization: 'XChange School',
    bullets: [
      '台湾最大のインターネット業界プロフェッショナルコミュニティで、PM を目指す人をメンタリング',
      '指導してきたメンティーは台湾大学、政治大学、台北大学、輔仁大学など台湾の名だたる大学の出身者が中心',
    ],
  },
  {
    dateRange: 'FEB 2024 — MAY 2024',
    title: 'Senior Product Manager',
    organization: 'NUEIP Technology Co., Ltd.',
    bullets: [
      '+40% のデータ駆動の意思決定：高度な分析と AI を統合したエンドツーエンドの BI プロダクトを構築',
      '+35% の予測精度：戦略立案のための予測分析モデルを導入',
      '50% 高速なレポーティング：BI ダッシュボードを統合し、データ取得時間を短縮',
    ],
  },
  {
    dateRange: 'AUG 2022 — FEB 2024',
    title: 'Product Manager',
    organization: 'PXPay Plus Co., Ltd.',
    bullets: [
      '+25% の新規登録から初回取引までのコンバージョン率：3 ヶ月でサインアップとチェックアウトのフローを再設計し、平均登録時間を 60% 短縮、75 万人の新規ユーザーと 4.5 億台湾ドルの取引額を上乗せ',
      '+50% のオペレーション効率：リワードポイントシステムを先導、顧客クレーム -40%',
      '駐車場・ケーブル TV・国民年金・行政手数料のサードパーティ決済統合をリードし、非小売取引の 30% を創出、MAU +15%',
    ],
  },
  {
    dateRange: 'SEP 2019 — MAR 2022',
    title: 'Operations Manager',
    organization: 'FLUX Technology Inc.',
    bullets: [
      '+20% の市場シェア、年間売上 +5,000 万台湾ドル：競合分析を通じて価格・チャネル・製品構成を再設計',
      '+30% のユーザーリテンション：3 つのプロダクトラインの公式サイトと SEO を再設計',
      '10 人のチームを率いた：プロセス効率 +22%、出荷スピード +35%',
    ],
  },
]
