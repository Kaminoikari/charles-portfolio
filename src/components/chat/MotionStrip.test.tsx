// The strip is the whole feature: no button, no picker, so what it renders IS
// what a visitor can do. Two things it must never do are show a clip name in
// the wrong language and offer a clip that will not move her.
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { LocaleContext } from '../../i18n/locale-context'
import { STRINGS } from '../../i18n/strings'
import type { Locale } from '../../i18n/config'
import { MotionStrip } from './MotionStrip'
import { IDLE_MOTIONS, motionsFor, type AvatarMotionName } from './avatarMotions'

function draw(
  locale: Locale,
  props: Partial<React.ComponentProps<typeof MotionStrip>> = {},
) {
  const motions = props.motions ?? motionsFor('column')
  return render(
    <LocaleContext.Provider value={{ locale, setLocale: () => {} }}>
      <MotionStrip
        motions={motions}
        ready={props.ready ?? motions}
        onPlay={props.onPlay ?? (() => {})}
      />
    </LocaleContext.Provider>,
  )
}

describe('MotionStrip', () => {
  it('names every clip in the reader\'s own language and no other', () => {
    // The owner asked for this outright: a Japanese visitor sees しぐさ, not
    // "Dance" beside it. The mockup carried both because a mockup has no locale;
    // the shipped strip has one, so a label from another locale appearing here
    // means the key is missing and useT fell back to echoing it.
    for (const locale of ['en', 'zh-TW', 'ja'] as const) {
      const { unmount } = draw(locale)
      const mine = STRINGS[locale].chat.motions
      const others = (['en', 'zh-TW', 'ja'] as const)
        .filter((l) => l !== locale)
        .flatMap((l) => Object.entries(STRINGS[l].chat.motions))

      for (const name of motionsFor('column')) {
        const label = mine[name as keyof typeof mine]
        expect(screen.getByRole('button', { name: label }), `${locale}/${name}`).toBeTruthy()
      }
      const shown = screen.getAllByRole('button').map((b) => b.textContent)
      for (const [key, foreign] of others) {
        // Identical strings across locales are legitimate (待機 is 待機 in both
        // zh-TW and ja); only a label this locale does NOT use is a leak.
        if (Object.values(mine).includes(foreign)) continue
        expect(shown, `${locale} is showing ${key} from another locale`).not.toContain(foreign)
      }
      unmount()
    }
  })

  it('never shows a raw clip identifier', () => {
    // useT returns the KEY when a string is missing, so a forgotten locale entry
    // ships as "chat.motions.playFingers" in the composer rather than as a crash.
    for (const locale of ['en', 'zh-TW', 'ja'] as const) {
      const { unmount } = draw(locale)
      for (const label of screen.getAllByRole('button').map((b) => b.textContent ?? '')) {
        expect(label, `${locale} leaked a key`).not.toMatch(/^chat\./)
        expect(IDLE_MOTIONS, `${locale} leaked an identifier`).not.toContain(label as AvatarMotionName)
      }
      unmount()
    }
  })

  it('plays the clip that was tapped', async () => {
    const onPlay = vi.fn()
    draw('zh-TW', { onPlay })
    await userEvent.click(screen.getByRole('button', { name: STRINGS['zh-TW'].chat.motions.spin }))
    expect(onPlay).toHaveBeenCalledWith('spin')
  })

  it('leads with the dance, the way the idle rotation does', () => {
    draw('en')
    const first = screen.getAllByRole('button')[0]
    expect(first.textContent).toBe(STRINGS.en.chat.motions.dance)
  })

  it('disables a clip that has not downloaded rather than dropping it', async () => {
    // Dropping them would reshuffle the strip under a visitor's finger as each
    // of the ten lands. Leaving them enabled would hand out a control that does
    // nothing, since playMotion answers false for a clip still in flight.
    const onPlay = vi.fn()
    const motions = motionsFor('column')
    draw('en', { motions, ready: [motions[0]], onPlay })
    expect(screen.getAllByRole('button')).toHaveLength(motions.length)
    const late = screen.getByRole('button', { name: STRINGS.en.chat.motions[motions[1]] })
    expect(late.hasAttribute('disabled')).toBe(true)
    await userEvent.click(late)
    expect(onPlay).not.toHaveBeenCalled()
  })

  it('renders nothing where no clip is offered', () => {
    // This is also the mobile case. motionsFor('hidden') is empty, so a viewport
    // with no avatar needs no separate rule to keep in step.
    const { container } = draw('en', { motions: motionsFor('hidden') })
    expect(container.innerHTML).toBe('')
  })

  it('has a label for every clip the rotation can reach, in all three locales', () => {
    // A clip added to IDLE_MOTIONS with no entry in one locale file is caught by
    // the type checker, but only if the key exists in the Strings shape at all.
    for (const locale of ['en', 'zh-TW', 'ja'] as const) {
      const table = STRINGS[locale].chat.motions as Record<string, string>
      for (const name of IDLE_MOTIONS) {
        expect(table[name], `${locale} has no label for ${name}`).toBeTruthy()
      }
    }
  })
})
