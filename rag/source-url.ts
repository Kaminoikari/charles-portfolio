// Map a retrieved chunk to the most specific public page it represents, so the
// chat widget can turn each cited source into a real link.
//
//   project      -> its detail page          /projects/:id
//   blog         -> the external article      (carried in the chunk payload)
//   about        -> the About page            /about
//   changelog    -> the Changelog page        /changelog
//   experience   -> the home Experience section  /#experience
//   skill        -> the home Skills section       /#skills
//   knowledge    -> null  (agent-patterns corpus is chatbot-only; no page)
//
// On-site URLs are locale-aware. The prefix table mirrors src/i18n/config.ts
// (LOCALE_URL_PREFIX) — duplicated here on purpose so the rag layer stays
// decoupled from the React app; keep the two in sync if a locale is added.

const LOCALE_PREFIX: Record<string, string> = { 'en': '', 'zh-TW': '/zh-TW', 'ja': '/ja' }

export interface SourceMeta {
  sourceType: string
  projectId: string | null
  // External article URL — present only on blog chunks (added at ingest time).
  url?: string | null
  locale: string
}

export function sourceUrl(m: SourceMeta): string | null {
  const prefix = LOCALE_PREFIX[m.locale] ?? ''
  // Home page: '' → '/', others keep their prefix ('/ja'), so a section hash
  // reads as '/#skills' or '/ja#skills' with no double slash before the hash.
  const home = prefix || '/'
  switch (m.sourceType) {
    case 'blog':
      return m.url ?? null
    case 'project':
      return m.projectId ? `${prefix}/projects/${m.projectId}` : `${home}#projects`
    case 'about':
      return `${prefix}/about`
    case 'changelog':
      return `${prefix}/changelog`
    case 'experience':
      return `${home}#experience`
    case 'skill':
      return `${home}#skills`
    default:
      // knowledge / playbook / anything without a public page.
      return null
  }
}
