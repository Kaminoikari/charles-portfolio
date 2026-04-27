import { useEffect } from 'react'
import { LOCALES, LOCALE_URL_PREFIX } from './config'
import { useLocale } from './LocaleContext'
import { useT, type StringKey } from './useT'

const SITE_ORIGIN = 'https://charles-chen.com'

interface MetaInput {
  // Translation keys that resolve to the document title and description for
  // the current locale. Pass undefined to fall back to the default title.
  titleKey?: StringKey
  descriptionKey?: StringKey
  // Pathname relative to the locale prefix, e.g. '/about'. Used to build
  // canonical and hreflang alternate URLs that point at the matching path
  // in every locale.
  path: string
}

function ensureLink(rel: string, hreflang?: string): HTMLLinkElement {
  const selector = hreflang
    ? `link[rel="${rel}"][hreflang="${hreflang}"]`
    : `link[rel="${rel}"]:not([hreflang])`
  let link = document.head.querySelector<HTMLLinkElement>(selector)
  if (!link) {
    link = document.createElement('link')
    link.rel = rel
    if (hreflang) link.hreflang = hreflang
    document.head.appendChild(link)
  }
  return link
}

function ensureMeta(name: string): HTMLMetaElement {
  let meta = document.head.querySelector<HTMLMetaElement>(`meta[name="${name}"]`)
  if (!meta) {
    meta = document.createElement('meta')
    meta.name = name
    document.head.appendChild(meta)
  }
  return meta
}

// Manages document.title, meta[name=description], canonical URL, and the full
// set of hreflang alternates for the current route. Call from any page-level
// component to keep SEO metadata in sync with the locale and path.
export function useDocumentMeta({ titleKey, descriptionKey, path }: MetaInput) {
  const { locale } = useLocale()
  const t = useT()

  useEffect(() => {
    const title = titleKey ? t(titleKey) : t('defaults.documentTitle')
    document.title = title

    if (descriptionKey) {
      ensureMeta('description').content = t(descriptionKey)
    }

    // canonical points at the current locale's URL for this path
    const localePath = LOCALE_URL_PREFIX[locale] + (path === '/' ? '' : path)
    ensureLink('canonical').href = SITE_ORIGIN + (localePath || '/')

    // hreflang alternates: one per locale plus an x-default mapping to root
    for (const loc of LOCALES) {
      const link = ensureLink('alternate', loc)
      const lp = LOCALE_URL_PREFIX[loc] + (path === '/' ? '' : path)
      link.href = SITE_ORIGIN + (lp || '/')
    }
    const xdefault = ensureLink('alternate', 'x-default')
    xdefault.href = SITE_ORIGIN + (path === '/' ? '/' : path)
  }, [locale, t, titleKey, descriptionKey, path])
}
