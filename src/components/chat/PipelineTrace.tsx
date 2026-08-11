// The retrieval pipeline, drawn as it runs (fullscreen rail only).
//
// The visual vocabulary is deliberately signal-processing rather than
// generic-spinner: each node is a station, the connector between two stations
// carries a pulse of charge once the upper one completes, and the working node
// spins an arc until it reports its own latency. That is what makes the trace
// carry information — order, causality and cost — instead of just filling the
// wait.
//
// It renders the steps the server actually reported. The graph is not a fixed
// line of stages: triage can answer outright and skip retrieval, and the
// corrective loop sends retrieve through twice, which shows up here as a
// genuine second station.

import { useT } from '../../i18n'
import type { StringKey } from '../../i18n/useT'
import type { TraceStep } from './useChatStream'

// Node ids come from the server (rag/graph.ts). An id with no label here still
// renders — under its raw id — rather than vanishing from the trace.
const NODE_LABEL_KEYS: Record<string, StringKey> = {
  triage: 'chat.nodeTriage',
  converse: 'chat.nodeConverse',
  retrieve: 'chat.nodeRetrieve',
  gradeDocuments: 'chat.nodeGradeDocuments',
  rewriteQuery: 'chat.nodeRewriteQuery',
  generate: 'chat.nodeGenerate',
  fallback: 'chat.nodeFallback',
}

function Station({ step, last }: { step: TraceStep; last: boolean }) {
  const t = useT()
  const running = step.status === 'running'
  const labelKey = NODE_LABEL_KEYS[step.id]

  return (
    <li className="grid grid-cols-[16px_1fr_auto] items-start gap-2.5 py-1.5">
      <span className="relative mt-0.5 h-4 w-4 shrink-0">
        {/* Connector down to the next station. It stays lit once this pass is
            done, so the path already travelled is readable at a glance. */}
        {!last && (
          <span
            className={
              'absolute left-[7.5px] top-4 block w-px ' +
              (running ? 'bg-border' : 'bg-accent-cyan/30')
            }
            style={{ height: 'calc(100% + 0.5rem)' }}
          >
            {/* The charge travelling to the next station, once this one is done. */}
            {!running && (
              <span className="absolute inset-x-0 block h-3 bg-gradient-to-b from-transparent via-accent-cyan to-transparent animate-chat-charge" />
            )}
          </span>
        )}
        {/* Rotating arc while this node is doing work. */}
        {running && (
          <span className="absolute inset-0 rounded-full bg-[conic-gradient(from_0deg,transparent_0deg,transparent_210deg,var(--color-accent-cyan)_350deg,transparent_360deg)] [mask:radial-gradient(closest-side,transparent_66%,#000_68%)] animate-chat-spin" />
        )}
        <span
          className={
            'absolute left-[5px] top-[5px] block h-1.5 w-1.5 rounded-full ' +
            (running
              ? 'bg-accent-cyan shadow-[0_0_8px_rgba(0,217,255,0.8)]'
              : 'bg-accent-cyan shadow-[0_0_0_3px_rgba(0,217,255,0.14)]')
          }
        />
      </span>

      <span className={'text-[12px] leading-snug ' + (running ? 'text-white' : 'text-white/80')}>
        {labelKey ? t(labelKey) : step.id}
      </span>

      <span className="font-mono text-[10px] tabular-nums text-text-tertiary">
        {running ? '···' : `${step.ms ?? 0} ms`}
      </span>
    </li>
  )
}

export function PipelineTrace({ trace }: { trace: TraceStep[] }) {
  const t = useT()

  if (trace.length === 0) {
    return (
      <div className="flex flex-col gap-2">
        <h3 className="font-mono text-[10px] font-medium uppercase tracking-[1.1px] text-text-tertiary">
          {t('chat.pipelineTitle')}
        </h3>
        <p className="text-[12px] leading-relaxed text-text-tertiary">{t('chat.pipelineIdle')}</p>
      </div>
    )
  }

  // Only completed passes have a measured cost, so the running total counts
  // those and grows as each node reports in.
  const total = trace.reduce((sum, s) => sum + (s.status === 'done' ? (s.ms ?? 0) : 0), 0)
  const running = trace.some((s) => s.status === 'running')

  return (
    <div className="flex flex-col gap-2">
      <h3 className="flex items-center justify-between gap-2 font-mono text-[10px] font-medium uppercase tracking-[1.1px] text-text-tertiary">
        <span>{t('chat.pipelineTitle')}</span>
        <span className="tabular-nums text-accent-cyan">{total} ms</span>
      </h3>
      <ol
        // Announced politely so a screen reader hears the pipeline advance
        // without the visual metaphor being required to follow it.
        aria-live="polite"
        aria-busy={running || undefined}
        className="flex list-none flex-col p-0"
      >
        {trace.map((step, i) => (
          <Station key={`${step.id}-${i}`} step={step} last={i === trace.length - 1} />
        ))}
      </ol>
    </div>
  )
}
