// Loader for the cached blog full-text bodies.
//
// The bodies live in blog-bodies.json (committed), keyed by article URL, and are
// populated by fetch-blog-bodies.ts. We separate fetching (fragile, network +
// egress-allowlist dependent, run occasionally) from ingest (deterministic, runs
// every build) so the index is reproducible and never blocks on a live fetch.

import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const HERE = dirname(fileURLToPath(import.meta.url))
export const BODIES_PATH = join(HERE, 'blog-bodies.json')

export interface BlogBody {
  url: string
  title?: string
  // Plain text of the article body (HTML already stripped by the fetcher).
  text: string
  fetchedAt: string
  source: 'substack' | 'medium' | 'other'
}

export type BlogBodyCache = Record<string, BlogBody>

let cache: BlogBodyCache | null = null

export function loadBlogBodies(): BlogBodyCache {
  if (cache) return cache
  try {
    cache = JSON.parse(readFileSync(BODIES_PATH, 'utf8')) as BlogBodyCache
  } catch {
    cache = {}
  }
  return cache
}

// Body text for a given article URL, or null if not cached. Normalises trailing
// slash so a stored "…/p/slug" matches "…/p/slug/".
export function getBlogBody(url: string): string | null {
  const c = loadBlogBodies()
  const hit = c[url] ?? c[url.replace(/\/$/, '')] ?? c[`${url}/`]
  const text = hit?.text?.trim()
  return text ? text : null
}
