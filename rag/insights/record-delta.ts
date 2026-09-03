import { writeFileSync } from 'node:fs'
import { basename } from 'node:path'

import { newSnapshots, readSnapshots, snapshotFile, snapshotsAfterLegacyPulse } from './records.js'

interface Args {
  current: string
  output: string
  previous?: string
  legacyPulse: string
}

function parseArgs(argv: string[]): Args {
  const value = (flag: string) => {
    const index = argv.indexOf(flag)
    return index >= 0 ? argv[index + 1] : undefined
  }
  const current = value('--current')
  const output = value('--output')
  if (!current || !output) {
    throw new Error('usage: record-delta.ts --current <snapshot.json> --output <new-records.json> [--previous <snapshot.json>] [--legacy-pulse <pulse>]')
  }
  return { current, output, previous: value('--previous'), legacyPulse: value('--legacy-pulse') ?? '' }
}

function main() {
  const args = parseArgs(process.argv.slice(2))
  const current = readSnapshots(args.current)
  if (!current) throw new Error(`invalid current snapshot: ${basename(args.current)}`)

  const previous = args.previous ? readSnapshots(args.previous) : null
  const added = previous ? newSnapshots(current, previous) : snapshotsAfterLegacyPulse(current, args.legacyPulse)
  writeFileSync(args.output, snapshotFile(added))
  console.log(`records=${added.length}`)
}

try {
  main()
} catch (error) {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
}
