// English is the canonical source. All other locale files must satisfy the
// `Strings` type derived from this object — TypeScript will surface any
// missing keys at build time. Strings are typed as `string` (not literal)
// so translations can use any value while keeping the structural shape.
interface Strings {
  brand: { name: string; homeAriaLabel: string }
  nav: {
    about: string; skills: string; experience: string; projects: string; blog: string
    contact: string; contactAriaLabel: string; sectionAriaLabel: string
    openMenu: string; closeMenu: string; mainAriaLabel: string; languageGroupLabel: string
  }
  home: {
    skipLink: string; aboutMarker: string; aboutHeading: string
    aboutBody1: string; aboutBody2: string; aboutReadMore: string
    aboutMetricUsersLabel: string; aboutMetricRevenueLabel: string; aboutMetricAiLabel: string
    aboutMetricUsersShort: string; aboutMetricRevenueShort: string; aboutMetricAiShort: string
    universeAriaLabel: string; universeWordLeft: string; universeWordRight: string
    projectsCaseStudy: string
  }
  about: {
    metaTitle: string; metaDescription: string; back: string; heading: string
    subheading: string; photoAlt: string
    sectionWhoIAm: string; sectionPhilosophy: string; sectionAi: string
    sectionCareer: string; sectionSkills: string; sectionChineseBio: string
    sectionProjects: string; projectsCtaText: string
    philosophyIntro: string; aiIntro: string
  }
  changelog: {
    metaTitle: string; marker: string; heading: string; description: string
    filterAriaLabel: string; filterAll: string; emptyMessage: string
    tagFeature: string; tagDesign: string; tagTechnical: string
  }
  projectDetail: {
    notFound: string; backHome: string; back: string
    sectionProblem: string; sectionSolution: string; sectionTechStack: string
    sectionImpact: string; sectionLearnings: string
    prevLabel: string; nextLabel: string
  }
  footer: {
    letsConnect: string; rights: string; rendered: string
    changelogLink: string; visitSocial: string
  }
  defaults: { documentTitle: string }
}

const en: Strings = {
  brand: {
    name: 'CHARLES CHEN',
    homeAriaLabel: 'Charles Chen — scroll to top',
  },
  nav: {
    about: 'ABOUT',
    skills: 'SKILLS',
    experience: 'EXPERIENCE',
    projects: 'PROJECTS',
    blog: 'BLOG',
    contact: 'CONTACT ↗',
    contactAriaLabel: 'Scroll to contact section',
    sectionAriaLabel: 'Scroll to {{section}} section',
    openMenu: 'Open menu',
    closeMenu: 'Close menu',
    mainAriaLabel: 'Main navigation',
    languageGroupLabel: 'Language',
  },
  home: {
    skipLink: 'Skip to content',
    aboutMarker: '[ ABOUT ]',
    aboutHeading: 'What I bring to the table.',
    aboutBody1: "I help companies turn product vision into reality — from launching mobile apps to millions of users, to building B2B SaaS from the ground up. Currently at USPACE, I'm pioneering AI-driven prototyping to ship 5x faster than traditional workflows.",
    aboutBody2: "Whether it's scaling a consumer platform, launching an enterprise product, or integrating AI into development — I bring the strategy, execution, and cross-functional leadership to make it happen.",
    aboutReadMore: 'Read more',
    aboutMetricUsersLabel: 'Users Impacted',
    aboutMetricRevenueLabel: 'Revenue Impact',
    aboutMetricAiLabel: 'Faster with AI',
    aboutMetricUsersShort: 'Users',
    aboutMetricRevenueShort: 'Revenue',
    aboutMetricAiShort: 'AI Speed',
    universeAriaLabel: 'Understand What I Do',
    universeWordLeft: 'Understand',
    universeWordRight: 'What I Do',
    projectsCaseStudy: 'CASE STUDY',
  },
  about: {
    metaTitle: 'About Charles Chen — AI Product Manager in Taiwan',
    metaDescription: 'About Charles Chen (陳德潁) — AI Product Manager and AI Product Builder from Taiwan. Product philosophy, AI tooling approach, full career history, and skill set.',
    back: '← BACK TO PORTFOLIO',
    heading: 'About Charles Chen',
    subheading: 'AI Product Manager and AI Product Builder from Taiwan.',
    photoAlt: 'Charles Chen — AI Product Manager',
    sectionWhoIAm: 'Who I Am',
    sectionPhilosophy: 'Product Philosophy',
    sectionAi: 'How I Use AI in Product Development',
    sectionCareer: 'Career',
    sectionSkills: 'Skill Set',
    sectionChineseBio: '中文簡介',
    sectionProjects: 'PROJECTS',
    projectsCtaText: "See what I've built:",
    philosophyIntro: 'I believe the best product managers are builders. The gap between "what should we build" and "here\'s a working prototype" is where most product ideas die. By closing that gap with AI-powered development, I can test assumptions in hours instead of weeks.',
    aiIntro: "AI isn't a feature I add to products — it's how I build them. My AI-powered workflow spans the entire product lifecycle:",
  },
  changelog: {
    metaTitle: 'Changelog — Charles Chen Portfolio',
    marker: '[ CHANGELOG ]',
    heading: 'Building in public.',
    description: 'A record of design decisions, technical iterations, and the thinking behind every pixel of this portfolio.',
    filterAriaLabel: 'Filter by category',
    filterAll: 'All',
    emptyMessage: 'No entries matching this filter.',
    tagFeature: 'Feature',
    tagDesign: 'Design',
    tagTechnical: 'Technical',
  },
  projectDetail: {
    notFound: 'Project not found.',
    backHome: '← Back to portfolio',
    back: '← BACK TO PORTFOLIO',
    sectionProblem: 'Problem',
    sectionSolution: 'Solution',
    sectionTechStack: 'TECH STACK',
    sectionImpact: 'IMPACT',
    sectionLearnings: 'Learnings',
    prevLabel: '← Previous',
    nextLabel: 'Next →',
  },
  footer: {
    letsConnect: "Let's Connect",
    rights: '© 2026 Charles Chen. All rights reserved.',
    rendered: 'Rendered in {{ms}}ms · React · Canvas 2D · Tailwind',
    changelogLink: 'Changelog',
    visitSocial: 'Visit {{platform}}',
  },
  defaults: {
    documentTitle: 'AI Product Manager in Taiwan | Charles Chen Portfolio',
  },
}

export type { Strings }
export default en
