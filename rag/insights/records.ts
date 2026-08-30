import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'

export interface QuestionRecordSource {
  type: 'open' | 'question' | null
  question?: string | null
  answer?: string | null
  language?: string | null
  route?: string | null
  loops?: number | null
  latency_ms?: number | null
  visitor_id: string | null
  country?: string | null
  ts: string | null
}

export interface QuestionSnapshot {
  hash: string
  timestamp: string | null
}

interface SnapshotFile {
  version: 1
  records: QuestionSnapshot[]
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object'
}

function stableQuestionContent(row: QuestionRecordSource): string {
  return JSON.stringify({
    answer: row.answer ?? null,
    country: row.country ?? null,
    language: row.language ?? null,
    latencyMs: row.latency_ms ?? null,
    loops: row.loops ?? null,
    question: row.question ?? null,
    route: row.route ?? null,
    timestamp: row.ts,
    type: row.type,
    visitorId: row.visitor_id,
  })
}

export function questionHash(row: QuestionRecordSource): string {
  return createHash('sha256').update(stableQuestionContent(row)).digest('hex')
}

export function questionSnapshots(rows: QuestionRecordSource[]): QuestionSnapshot[] {
  return rows
    .filter((row) => row.type !== 'open')
    .map((row) => ({ hash: questionHash(row), timestamp: row.ts }))
    .sort((a, b) => a.hash.localeCompare(b.hash))
}

function isQuestionSnapshot(value: unknown): value is QuestionSnapshot {
  if (!isRecord(value)) return false
  const record = value
  return (
    typeof record.hash === 'string' &&
    record.hash.length > 0 &&
    (typeof record.timestamp === 'string' || record.timestamp === null)
  )
}

function parseSnapshotFile(value: unknown): QuestionSnapshot[] | null {
  if (!isRecord(value)) return null
  const snapshot = value
  if (snapshot.version !== 1 || !Array.isArray(snapshot.records) || !snapshot.records.every(isQuestionSnapshot)) {
    return null
  }
  return snapshot.records
}

export function readSnapshots(path: string): QuestionSnapshot[] | null {
  try {
    return parseSnapshotFile(JSON.parse(readFileSync(path, 'utf8')))
  } catch {
    return null
  }
}

export function snapshotFile(records: QuestionSnapshot[]): string {
  const snapshot: SnapshotFile = { version: 1, records }
  return `${JSON.stringify(snapshot)}\n`
}

export function newSnapshots(current: QuestionSnapshot[], previouslySent: QuestionSnapshot[]): QuestionSnapshot[] {
  const sentHashes = new Set(previouslySent.map((record) => record.hash))
  return current.filter((record) => !sentHashes.has(record.hash))
}

export function snapshotsAfterLegacyPulse(current: QuestionSnapshot[], legacyPulse: string): QuestionSnapshot[] {
  const latest = legacyPulse.match(/(?:^|\s)latest=([^\s]+)/)?.[1]
  const latestMs = latest ? Date.parse(latest) : Number.NaN
  if (Number.isNaN(latestMs)) return current
  return current.filter((record) => {
    const timestampMs = Date.parse(record.timestamp ?? '')
    return Number.isNaN(timestampMs) || timestampMs > latestMs
  })
}
