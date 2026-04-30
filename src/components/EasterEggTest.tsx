import { useEffect, useState } from 'react'

const BEAT_LABELS = [
  '1 Awakening (0.0–1.2s)',
  '2 Nebula Bloom (1.2–3.0s)',
  '3 Galactic Jet (3.0–4.5s)',
  '4 Dyson Reveal (4.5–6.0s)',
  '5 The Lance (6.0–7.0s)',
  '6 Spacetime Warp (7.0–8.5s)',
  '7 Planet Ignition (8.5–9.5s)',
  '8 Convergence Cloud (9.5–10.8s)',
  '9 Snap Home (10.8–12.0s)',
]

export default function EasterEggTest() {
  const [running, setRunning] = useState(false)

  useEffect(() => {
    const onTrigger = () => setRunning(true)
    window.addEventListener('easter-egg', onTrigger)
    return () => window.removeEventListener('easter-egg', onTrigger)
  }, [])

  useEffect(() => {
    if (!running) return
    const id = setTimeout(() => setRunning(false), 12_500)
    return () => clearTimeout(id)
  }, [running])

  return (
    <div style={{
      position: 'fixed', inset: 0, background: '#0a0a0c', color: '#e8e8eb',
      fontFamily: 'SF Mono, Menlo, monospace', padding: '64px 48px',
      overflow: 'auto',
    }}>
      <h1 style={{ fontSize: 22, fontWeight: 600, marginBottom: 8, letterSpacing: '-0.01em' }}>
        Easter Egg Sequence — DQA
      </h1>
      <p style={{ fontSize: 13, color: '#9094a0', marginBottom: 32, lineHeight: 1.6 }}>
        Press the button below to play the full 12s sequence. The same trigger
        fires when clicking the site logo 5 times or entering the Konami code on
        the home page. Reduced-motion will play a 0.8s flash fallback instead.
      </p>

      <button
        onClick={() => window.dispatchEvent(new Event('easter-egg'))}
        disabled={running}
        style={{
          padding: '14px 28px',
          background: running ? '#1a1a1d' : '#E8652B',
          color: running ? '#5a5a60' : '#fff',
          border: 'none',
          borderRadius: 4,
          fontSize: 14,
          fontFamily: 'inherit',
          fontWeight: 600,
          letterSpacing: '0.02em',
          cursor: running ? 'not-allowed' : 'pointer',
          textTransform: 'uppercase',
        }}
      >
        {running ? 'Playing…' : 'Play full sequence'}
      </button>

      <div style={{ marginTop: 48 }}>
        <h2 style={{ fontSize: 14, fontWeight: 600, color: '#9094a0', marginBottom: 12, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
          Beats (timing reference)
        </h2>
        <ol style={{ fontSize: 13, lineHeight: 2.0, color: '#cccfd6', listStyle: 'none', padding: 0, margin: 0 }}>
          {BEAT_LABELS.map((label) => (
            <li key={label} style={{ borderBottom: '1px solid #1a1a1d', padding: '4px 0' }}>
              {label}
            </li>
          ))}
        </ol>
      </div>

      <div style={{ marginTop: 48, fontSize: 12, color: '#6a6a72', lineHeight: 1.6 }}>
        <div>Routes:</div>
        <div>• <code>/dyson-test</code> — Beat 4 isolated (existing prototype)</div>
        <div>• <code>/easter-egg-test</code> — this page</div>
      </div>
    </div>
  )
}
