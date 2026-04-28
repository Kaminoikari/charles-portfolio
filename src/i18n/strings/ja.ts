import type { Strings } from './en'

// Translation policy (mirrors zh-TW.ts):
//   - Visible navigation labels (ABOUT / SKILLS / [ ABOUT ] / etc.) stay
//     in English. They are part of the brand's monospace/uppercase design
//     language and Japanese tech audiences read them natively.
//   - aria-labels and any descriptive sentence-form copy is translated.
//   - Product names (Path, Plutus Trade, USPACE) and standard tech terms
//     (React, B2B SaaS, builder, AI Product Manager) stay in English in
//     line with how Japanese tech industry actually writes/speaks.
//   - "All rights reserved." in the footer is kept English by convention —
//     Japanese tech sites overwhelmingly leave the legal phrase as-is.
const ja: Strings = {
  brand: {
    name: 'CHARLES CHEN',
    homeAriaLabel: 'Charles Chen — トップへ戻る',
  },
  nav: {
    about: 'ABOUT',
    skills: 'SKILLS',
    experience: 'EXPERIENCE',
    projects: 'PROJECTS',
    blog: 'BLOG',
    contact: 'CONTACT ↗',
    contactAriaLabel: 'お問い合わせへスクロール',
    sectionAriaLabel: '{{section}} セクションへスクロール',
    openMenu: 'メニューを開く',
    closeMenu: 'メニューを閉じる',
    mainAriaLabel: 'メインナビゲーション',
    languageGroupLabel: '言語',
  },
  home: {
    skipLink: 'コンテンツへスキップ',
    aboutMarker: '[ ABOUT ]',
    aboutHeading: '私が届けられるもの。',
    aboutBody1: '企業のプロダクトビジョンを実際の成果に変えるお手伝いをしています。数百万人のユーザーに届くモバイル App のローンチから、ゼロからの B2B SaaS 構築まで。現在 USPACE で、従来のワークフローより 5 倍速く届ける AI 駆動プロトタイピングを推進中です。',
    aboutBody2: 'コンシューマープラットフォームのスケール、エンタープライズプロダクトのローンチ、開発への AI 統合。どれにおいても、形にするための戦略、実行力、そしてクロスファンクショナルなリーダーシップを提供します。',
    aboutReadMore: 'もっと読む',
    aboutMetricUsersLabel: '影響したユーザー数',
    aboutMetricRevenueLabel: '売上インパクト',
    aboutMetricAiLabel: 'AI による高速化',
    aboutMetricUsersShort: 'ユーザー',
    aboutMetricRevenueShort: '売上',
    aboutMetricAiShort: 'AI 速度',
    universeAriaLabel: '私の仕事を理解する',
    universeWordLeft: 'Understand',
    universeWordRight: 'What I Do',
    projectsCaseStudy: 'CASE STUDY',
  },
  about: {
    metaTitle: 'Charles Chen（陳德潁）について — 台湾の AI Product Manager',
    metaDescription: 'Charles Chen（陳德潁）について — 台湾出身の AI Product Manager / AI Product Builder。プロダクト哲学、AI ツールの活用方針、完全な職歴、スキルセット。',
    back: '← ポートフォリオに戻る',
    heading: 'Charles Chen について',
    subheading: '台湾出身の AI Product Manager / AI Product Builder。',
    photoAlt: 'Charles Chen — AI Product Manager',
    sectionWhoIAm: '私について',
    sectionPhilosophy: 'プロダクト哲学',
    sectionAi: 'プロダクト開発での AI の使い方',
    sectionCareer: 'キャリア',
    sectionSkills: 'スキルセット',
    sectionProjects: 'PROJECTS',
    projectsCtaText: '私が作ったものを見る：',
    philosophyIntro: '最高のプロダクトマネージャーはみな Builder だと信じています。「何を作るべきか」と「ここに動くプロトタイプがあります」の間にある距離こそ、ほとんどのプロダクトアイデアが死ぬ場所です。AI 駆動の開発でそのギャップを越えれば、仮説検証は数週間ではなく数時間でできます。',
    aiIntro: 'AI は私にとってプロダクトに加える一機能を超え、プロダクトを作る上での中核的な思考そのものです。私の AI 駆動ワークフローはプロダクトライフサイクル全体を貫き、アイデアを高い効率でビジネス価値ある成果に変換します。',
  },
  changelog: {
    metaTitle: '変更履歴 — Charles Chen Portfolio',
    marker: '[ CHANGELOG ]',
    heading: '公開しながら作る。',
    description: 'このポートフォリオのすべてのピクセルの裏にある、デザイン判断、技術的なイテレーション、そして思考の記録。',
    filterAriaLabel: 'カテゴリでフィルタ',
    filterAll: 'すべて',
    emptyMessage: '該当するエントリーはありません。',
    tagFeature: '機能',
    tagDesign: 'デザイン',
    tagTechnical: '技術',
  },
  projectDetail: {
    notFound: 'プロジェクトが見つかりません。',
    backHome: '← ポートフォリオに戻る',
    back: '← ポートフォリオに戻る',
    sectionProblem: '課題',
    sectionSolution: '解決策',
    sectionTechStack: 'TECH STACK',
    sectionImpact: 'IMPACT',
    sectionLearnings: '学び',
    prevLabel: '← 前へ',
    nextLabel: '次へ →',
  },
  footer: {
    letsConnect: 'お問い合わせ',
    rights: '© 2026 Charles Chen. All rights reserved.',
    rendered: '{{ms}} ms でレンダリング · React · Canvas 2D · Tailwind',
    changelogLink: '変更履歴',
    visitSocial: '{{platform}} へ',
  },
  defaults: {
    documentTitle: '台湾の AI Product Manager | Charles Chen Portfolio',
  },
}

export default ja
