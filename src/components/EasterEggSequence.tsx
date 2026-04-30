import { useEffect } from 'react'

export default function EasterEggSequence() {
  useEffect(() => {
    let active = false
    const onTrigger = async () => {
      if (active) return
      active = true
      try {
        const { runEasterEggSequence } = await import('../lib/easterEgg/runner')
        await runEasterEggSequence()
      } finally {
        active = false
      }
    }
    window.addEventListener('easter-egg', onTrigger)
    return () => window.removeEventListener('easter-egg', onTrigger)
  }, [])
  return null
}
