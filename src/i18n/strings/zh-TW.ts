import type { Strings } from './en'

// Translation policy:
//   - Visible navigation labels (ABOUT / SKILLS / [ ABOUT ] / etc.) stay in
//     English. They are part of the brand's monospace/uppercase design
//     language and Taiwan tech audiences read them natively.
//   - aria-labels and any descriptive sentence-form copy is translated.
//   - Product names (Path, Plutus Trade, USPACE) and standard tech terms
//     (React, B2B SaaS, builder) stay in English.
const zhTW: Strings = {
  brand: {
    name: 'CHARLES CHEN',
    homeAriaLabel: '陳德潁 — 回到頁首',
  },
  nav: {
    about: 'ABOUT',
    skills: 'SKILLS',
    experience: 'EXPERIENCE',
    projects: 'PROJECTS',
    blog: 'BLOG',
    contact: 'CONTACT ↗',
    contactAriaLabel: '前往聯絡資訊',
    sectionAriaLabel: '前往 {{section}} 區段',
    openMenu: '開啟選單',
    closeMenu: '關閉選單',
    mainAriaLabel: '主要導覽',
    languageGroupLabel: '語言',
  },
  home: {
    skipLink: '跳至主要內容',
    aboutMarker: '[ ABOUT ]',
    aboutHeading: '我能交付什麼。',
    aboutBody1: '我幫助企業把產品願景變成可上線的成果：推出觸及百萬用戶的行動 App、從零打造 B2B SaaS。目前在 USPACE 推動 AI 驅動的原型開發，比傳統流程快 5 倍交付。',
    aboutBody2: '不論是擴展 consumer platform、推出企業級產品、或把 AI 整合進開發流程，我都帶來能落地的策略、執行力，以及跨部門領導。',
    aboutReadMore: '閱讀更多',
    aboutMetricUsersLabel: '影響使用者數',
    aboutMetricRevenueLabel: '營收影響',
    aboutMetricAiLabel: 'AI 加速倍數',
    aboutMetricUsersShort: '使用者',
    aboutMetricRevenueShort: '營收',
    aboutMetricAiShort: 'AI 加速',
    universeAriaLabel: '了解我在做什麼',
    universeWordLeft: 'Understand',
    universeWordRight: 'What I Do',
    projectsCaseStudy: 'CASE STUDY',
  },
  about: {
    metaTitle: '關於陳德潁（Charles Chen）— 台灣 AI Product Manager',
    metaDescription: '關於陳德潁（Charles Chen）— 來自台灣的 AI Product Manager 與 AI Product Builder。產品哲學、AI 工具運用、完整職涯經歷、技能組合。',
    back: '← 返回作品集',
    heading: '關於 Charles Chen',
    subheading: '來自台灣的 AI Product Manager 與 AI Product Builder。',
    photoAlt: '陳德潁 — AI Product Manager',
    sectionWhoIAm: '關於我',
    sectionPhilosophy: '產品哲學',
    sectionAi: '我如何在產品開發中運用 AI',
    sectionCareer: '職涯經歷',
    sectionSkills: '技能組合',
    sectionProjects: 'PROJECTS',
    projectsCtaText: '看看我打造過的作品：',
    philosophyIntro: '我相信最好的產品經理都是 Builder。「我們該打造什麼」與「這裡有一個可運作的原型」之間的距離，正是大多數產品點子消亡的地方。透過 AI 驅動的開發跨越這道鴻溝後，我能用幾小時、而不是幾週的時間來驗證假設。',
    aiIntro: 'AI 對我來說不僅是產品中的一項功能，更是我打造產品的核心思維。我的 AI 驅動工作流貫穿了整個產品生命週期，讓創意能以極高的效率轉化為具備商業價值的成果。',
  },
  changelog: {
    metaTitle: '更新日誌 — Charles Chen Portfolio',
    marker: '[ CHANGELOG ]',
    heading: '公開記錄打造過程。',
    description: '記錄這個作品集每一次設計決策、技術迭代，以及每一個像素背後的思考。',
    filterAriaLabel: '依類別篩選',
    filterAll: '全部',
    emptyMessage: '沒有符合此篩選條件的項目。',
    tagFeature: '功能',
    tagDesign: '設計',
    tagTechnical: '技術',
  },
  projectDetail: {
    notFound: '找不到此專案。',
    backHome: '← 返回作品集',
    back: '← 返回作品集',
    sectionProblem: '問題',
    sectionSolution: '方案',
    sectionScreens: '產品 Demo',
    sectionTechStack: 'TECH STACK',
    sectionImpact: 'IMPACT',
    sectionLearnings: '心得',
    closeLightbox: '關閉預覽',
    prevLabel: '← 上一個',
    nextLabel: '下一個 →',
  },
  footer: {
    letsConnect: '聯絡我',
    rights: '© 2026 Charles Chen. 版權所有。',
    rendered: '{{ms}} ms 完成渲染 · React · Canvas 2D · Tailwind',
    changelogLink: '更新日誌',
    visitSocial: '前往 {{platform}}',
  },
  defaults: {
    documentTitle: '台灣 AI Product Manager | Charles Chen Portfolio',
  },
}

export default zhTW
