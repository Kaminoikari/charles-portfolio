// Standalone ambient-music toggle, fixed bottom-left as the mirror of the chat
// launcher (bottom-right). The bottom-left corner opened up when the third-party
// community widget was retired, so the music control — previously folded into
// the chat widget to avoid a right-corner collision — gets its own floating FAB
// again. Symmetric layout: left = music, right = AI. AudioProvider owns the
// audio; this only reads/toggles the shared mute state via context.

import { useT } from '../../i18n'
import { useAmbientAudio } from './audio-context'
import { MuteIcon } from './MuteIcon'

export function MusicToggle() {
  const t = useT()
  const audio = useAmbientAudio()
  const label = audio.muted ? t('chat.unmuteMusic') : t('chat.muteMusic')

  return (
    <button
      type="button"
      onClick={audio.toggle}
      aria-label={label}
      aria-pressed={!audio.muted}
      className="fixed bottom-5 left-5 z-50 flex h-12 w-12 cursor-pointer items-center justify-center rounded-full border border-border bg-bg-secondary text-text-tertiary shadow-[0_8px_30px_rgba(0,0,0,0.4)] transition-[transform,border-color,color] duration-200 hover:-translate-y-0.5 hover:border-accent-cyan hover:text-accent-cyan focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-cyan"
    >
      <MuteIcon muted={audio.muted} size={16} />
    </button>
  )
}
