// Consistency guards binding the portfolio map back to src/data. No network:
//   npm run rag:test
//
// The map is injected into EVERY generate call as global context, and the
// generation prompt treats it as fact. That makes it the one piece of the corpus
// that can outrank retrieval: when it goes stale it does not degrade an answer,
// it authors a wrong one, confidently, on every question. The ingest workflow
// rebuilds the index whenever src/data changes — but it has no idea this file
// exists, so a renamed project or a new job leaves the map behind silently.
//
// These tests pin the facts that have a machine-checkable counterpart: which
// projects and employers exist, and where the project links point. Prose (the
// philosophy line, the framing of each role) stays hand-written on purpose —
// there is nothing to compare it against.

import { test } from 'node:test'
import assert from 'node:assert/strict'

import { portfolioMap } from './portfolio-map.js'
import { projects, projectDetails } from '../src/data/projects.en.ts'
import { experience } from '../src/data/experience.en.ts'

// The map names employers the way a person would ("NUEIP"), not the way the
// registry does ("NUEIP Technology Co., Ltd."). Compare on the distinctive part.
const shortOrg = (name: string) =>
  name
    .replace(/[,\s]*(Co\.|Corp\.|Inc\.)?[,\s]*Ltd\.?$/i, '')
    .replace(/[,\s]*(Inc|Corp)\.?$/i, '')
    .replace(/\s+(Technology|Tech)$/i, '')
    .trim()

// Entries in a section are the lines starting with "- "; continuation lines are
// indented. The name runs up to the first " (" or " — ".
function sectionEntries(section: string): string[] {
  const body = portfolioMap.split(`${section}:`)[1] ?? ''
  const upToNextSection = body.split(/\n[A-Z][A-Z ]+:/)[0]
  return upToNextSection
    .split('\n')
    .filter((l) => l.startsWith('- '))
    .map((l) => l.slice(2).split(/ \(| — /)[0].trim())
}

test('the map names every project in src/data', () => {
  const named = sectionEntries('PROJECTS')
  assert.deepEqual(
    projects.map((p) => p.title).filter((t) => !named.includes(t)),
    [],
    `projects missing from portfolioMap (map lists: ${named.join(', ')})`,
  )
})

test('the map names no project that src/data does not have', () => {
  const titles = projects.map((p) => p.title)
  assert.deepEqual(sectionEntries('PROJECTS').filter((n) => !titles.includes(n)), [])
})

test('every project link in the map is a link src/data actually publishes', () => {
  const published = new Set(projectDetails.flatMap((d) => d.links.map((l) => l.url)))
  const inMap = [...portfolioMap.matchAll(/https?:\/\/[^\s)]+/g)].map((m) => m[0])
  // Only the project links are checked; the map cites no other URLs today, and a
  // future non-project URL should make this fail loudly rather than pass quietly.
  assert.deepEqual(inMap.filter((u) => !published.has(u)), [])
})

test('the map names every employer in src/data', () => {
  const missing = experience.map((e) => shortOrg(e.organization)).filter((o) => !portfolioMap.includes(o))
  assert.deepEqual(missing, [])
})

test('the map names no employer that src/data does not have', () => {
  const known = experience.map((e) => shortOrg(e.organization))
  assert.deepEqual(sectionEntries('WORK').filter((n) => !known.includes(n)), [])
})

test('each employer entry in the map carries the start year src/data records', () => {
  // The map compresses "JULY 2024 — PRESENT" to "(Jul 2024–present)". The year is
  // the part that can silently rot, and it is the part a visitor asks about.
  const lines = portfolioMap.split('\n').filter((l) => l.startsWith('- '))
  for (const e of experience) {
    const short = shortOrg(e.organization)
    const line = lines.find((l) => l.startsWith(`- ${short} (`))
    assert.ok(line, `no WORK entry for ${short}`)
    const year = e.dateRange.match(/\d{4}/)?.[0]
    assert.ok(line.includes(year!), `${short}: map entry ${JSON.stringify(line)} omits start year ${year}`)
  }
})
