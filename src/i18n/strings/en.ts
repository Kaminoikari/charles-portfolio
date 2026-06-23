// English is the canonical source. All other locale files must satisfy the
// `Strings` type derived from this object — TypeScript will surface any
// missing keys at build time. Strings are typed as `string` (not literal)
// so translations can use any value while keeping the structural shape.
interface Strings {
  brand: { name: string; homeAriaLabel: string }
  nav: {
    about: string; skills: string; experience: string; projects: string; blog: string
    mentoring: string; changelog: string
    contact: string; contactAriaLabel: string; sectionAriaLabel: string
    openMenu: string; closeMenu: string; mainAriaLabel: string; languageGroupLabel: string
  }
  home: {
    skipLink: string; aboutMarker: string; aboutHeading: string
    aboutBody1: string; aboutBody2: string; aboutReadMore: string
    aboutMetricUsersLabel: string; aboutMetricLaunchLabel: string; aboutMetricAiLabel: string
    aboutMetricUsersShort: string; aboutMetricLaunchShort: string; aboutMetricAiShort: string
    universeAriaLabel: string; universeWordLeft: string; universeWordRight: string
    projectsCaseStudy: string
  }
  about: {
    metaTitle: string; metaDescription: string; back: string; heading: string
    subheading: string; photoAlt: string
    sectionWhoIAm: string; sectionPhilosophy: string; sectionAi: string
    sectionCareer: string; sectionSkills: string
    sectionProjects: string; projectsCtaText: string
    philosophyIntro: string; aiIntro: string
  }
  changelog: {
    metaTitle: string; marker: string; heading: string; description: string
    filterAriaLabel: string; filterAll: string; emptyMessage: string
    tagFeature: string; tagDesign: string; tagTechnical: string
    paginationAriaLabel: string; previousPage: string; nextPage: string
    goToPage: string; currentPage: string; showingRange: string
  }
  projectDetail: {
    notFound: string; backHome: string; back: string
    sectionProblem: string; sectionSolution: string; sectionScreens: string; sectionTechStack: string
    sectionImpact: string; sectionLearnings: string
    closeLightbox: string
    prevLabel: string; nextLabel: string
  }
  footer: {
    letsConnect: string; rights: string; rendered: string
    visitSocial: string
  }
  mentoring: {
    eyebrow: string; heading: string; body: string
    sessionTitle: string; sessionMeta: string; viewHours: string; bookOnAdplist: string
  }
  chat: {
    launcherLabel: string; launcherTag: string; openAriaLabel: string; closeAriaLabel: string
    clearLabel: string
    title: string; subtitle: string; emptyMessage: string; previewLabel: string
    inputPlaceholder: string; send: string; sendAriaLabel: string
    thinking: string; sourcesLabel: string; sourcesCount: string
    errorMessage: string; rateLimited: string; regionBlocked: string; retry: string
    suggested1: string; suggested2: string; suggested3: string
    suggested4: string; suggested5: string; suggested6: string; suggested7: string
    muteMusic: string; unmuteMusic: string
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
    mentoring: 'MENTORSHIP',
    changelog: 'CHANGELOG',
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
    aboutBody1: "I help companies turn product vision into reality: launching mobile apps to millions of users, building B2B SaaS from the ground up. Currently at USPACE, I'm pioneering AI-driven prototyping to ship 5x faster than traditional workflows.",
    aboutBody2: "Whether it's scaling a consumer platform, launching an enterprise product, or integrating AI into development, I bring the strategy, execution, and cross-functional leadership to make it happen.",
    aboutReadMore: 'Read more',
    aboutMetricUsersLabel: 'Users Impacted',
    aboutMetricLaunchLabel: 'B2B SaaS Launch',
    aboutMetricAiLabel: 'Faster with AI',
    aboutMetricUsersShort: 'Users',
    aboutMetricLaunchShort: 'B2B SaaS',
    aboutMetricAiShort: 'AI Speed',
    universeAriaLabel: 'Understand What I Do',
    universeWordLeft: 'Understand',
    universeWordRight: 'What I Do',
    projectsCaseStudy: 'CASE STUDY',
  },
  about: {
    metaTitle: 'About Charles Chen — AI Product Manager in Taiwan',
    metaDescription: 'About Charles Chen (陳德潁), AI Product Manager and AI Product Builder from Taiwan. Product philosophy, AI tooling approach, full career history, and skill set.',
    back: '← BACK TO PORTFOLIO',
    heading: 'About Charles Chen',
    subheading: 'AI Product Manager and AI Product Builder from Taiwan.',
    photoAlt: 'Charles Chen — AI Product Manager',
    sectionWhoIAm: 'Who I Am',
    sectionPhilosophy: 'Product Philosophy',
    sectionAi: 'How I Use AI in Product Development',
    sectionCareer: 'Career',
    sectionSkills: 'Skill Set',
    sectionProjects: 'PROJECTS',
    projectsCtaText: "See what I've built:",
    philosophyIntro: 'I believe the best product managers are all Builders. The gap between "what should we build" and "here\'s a working prototype" is where most product ideas die. Once AI-driven development closes that gap, I can validate assumptions in hours, not weeks.',
    aiIntro: "AI is more than a feature I add to products. It's core to how I think about building them. My AI-driven workflow spans the entire product lifecycle, turning ideas into commercially valuable outcomes with remarkable efficiency.",
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
    paginationAriaLabel: 'Changelog pages',
    previousPage: 'Prev',
    nextPage: 'Next',
    goToPage: 'Go to page {{page}}',
    currentPage: 'Current page, page {{page}}',
    showingRange: 'Showing {{start}}–{{end}} of {{total}}',
  },
  projectDetail: {
    notFound: 'Project not found.',
    backHome: '← Back to portfolio',
    back: '← BACK TO PORTFOLIO',
    sectionProblem: 'Problem',
    sectionSolution: 'Solution',
    sectionScreens: 'Product Demo',
    sectionTechStack: 'TECH STACK',
    sectionImpact: 'IMPACT',
    sectionLearnings: 'Learnings',
    closeLightbox: 'Close preview',
    prevLabel: '← Previous',
    nextLabel: 'Next →',
  },
  footer: {
    letsConnect: "Let's Connect",
    rights: '© 2026 Charles Chen. All rights reserved.',
    rendered: 'Rendered in {{ms}}ms · React · WebGL · Tailwind',
    visitSocial: 'Visit {{platform}}',
  },
  mentoring: {
    eyebrow: 'Mentoring',
    heading: 'Book time with me on ADPList',
    body: 'I mentor PMs on building products from 0 to 1, breaking into Product Management, and becoming AI-native Product Builders. Grab an open slot below.',
    sessionTitle: '1:1 Mentoring Session',
    sessionMeta: 'Free · 30 to 45 minutes · Remote',
    viewHours: 'View available hours',
    bookOnAdplist: 'Book on ADPList ↗',
  },
  chat: {
    launcherLabel: 'Ask this portfolio',
    launcherTag: 'RAG',
    openAriaLabel: 'Open the AI assistant',
    closeAriaLabel: 'Close the AI assistant',
    clearLabel: 'Clear this conversation',
    title: 'Ask about Charles',
    subtitle: 'CRAG · RRF · RECALL@K',
    emptyMessage:
      "Ask me anything about Charles's projects, experience, or how he builds with AI. Every answer is grounded in his actual portfolio.",
    previewLabel: 'Each answer shows the real chunks it retrieved and their relevance scores, like this:',
    inputPlaceholder: 'Ask anything about his work…',
    send: 'Send',
    sendAriaLabel: 'Send question',
    thinking: 'Retrieving…',
    sourcesLabel: 'Retrieved context',
    sourcesCount: '{{count}} chunks',
    errorMessage: "That didn't go through. Check your connection and try again.",
    rateLimited: 'Too many questions for now, give it a moment and try again.',
    regionBlocked: 'This assistant is not available in your region.',
    retry: 'Retry',
    suggested1: 'Tell me about Product Playbook',
    suggested2: 'How were you built?',
    suggested3: 'How does he make product decisions?',
    suggested4: 'How does he use AI in his work?',
    suggested5: 'Why should a team hire him?',
    suggested6: 'What makes him different as an AI PM?',
    suggested7: 'What did he do at USPACE?',
    muteMusic: 'Mute ambient music',
    unmuteMusic: 'Play ambient music',
  },
  defaults: {
    documentTitle: 'AI Product Manager in Taiwan | Charles Chen Portfolio',
  },
}

export type { Strings }
export default en
