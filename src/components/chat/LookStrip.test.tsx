// The strip is the whole feature: no gear, no picker, so what it renders IS
// what a visitor can do. It must name each body in the reader's language, mark
// the one on screen, take no tap while a body is on its way, and warm the
// cache for the body under the pointer.
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { LocaleContext } from '../../i18n/locale-context'
import { STRINGS } from '../../i18n/strings'
import type { Locale } from '../../i18n/config'
import { LookStrip } from './LookStrip'
import { ACTIVE_VARIANT, AVATAR_VARIANTS } from './avatarVariants'

const prefetch = vi.hoisted(() => vi.fn())
vi.mock('./avatarPrefetch', () => ({ prefetchBody: prefetch }))

const OTHER = AVATAR_VARIANTS.find((v) => v.id !== ACTIVE_VARIANT)!
const CURRENT = AVATAR_VARIANTS.find((v) => v.id === ACTIVE_VARIANT)!

function draw(locale: Locale, props: Partial<React.ComponentProps<typeof LookStrip>> = {}) {
  return render(
    <LocaleContext.Provider value={{ locale, setLocale: () => {} }}>
      <LookStrip
        variants={props.variants ?? AVATAR_VARIANTS}
        shown={props.shown ?? ACTIVE_VARIANT}
        busy={props.busy ?? false}
        onPick={props.onPick ?? (() => {})}
      />
    </LocaleContext.Provider>,
  )
}

beforeEach(() => prefetch.mockClear())

describe('LookStrip', () => {
  it("names every body in the reader's own language and no other", () => {
    for (const locale of ['en', 'zh-TW', 'ja'] as const) {
      const { unmount } = draw(locale)
      const mine = STRINGS[locale].chat.looks
      const others = (['en', 'zh-TW', 'ja'] as const)
        .filter((l) => l !== locale)
        .flatMap((l) => Object.entries(STRINGS[l].chat.looks))
      for (const v of AVATAR_VARIANTS) {
        expect(screen.getByRole('button', { name: mine[v.id] }), `${locale}/${v.id}`).toBeTruthy()
      }
      const shown = screen.getAllByRole('button').map((b) => b.textContent)
      for (const [key, foreign] of others) {
        if (mine[key as keyof typeof mine] === foreign) continue
        expect(shown, `${locale} shows the ${key} label of another locale`).not.toContain(foreign)
      }
      unmount()
    }
  })

  it('marks the body on screen as pressed and the rest as not', () => {
    draw('en', { shown: OTHER.id })
    const en = STRINGS.en.chat.looks
    expect(screen.getByRole('button', { name: en[OTHER.id] }).getAttribute('aria-pressed')).toBe('true')
    expect(screen.getByRole('button', { name: en[CURRENT.id] }).getAttribute('aria-pressed')).toBe('false')
  })

  it('reports a tap on another body, and ignores one on the current', async () => {
    const onPick = vi.fn()
    const user = userEvent.setup()
    draw('en', { onPick })
    const en = STRINGS.en.chat.looks
    await user.click(screen.getByRole('button', { name: en[CURRENT.id] }))
    expect(onPick).not.toHaveBeenCalled()
    await user.click(screen.getByRole('button', { name: en[OTHER.id] }))
    expect(onPick).toHaveBeenCalledTimes(1)
    expect(onPick).toHaveBeenCalledWith(OTHER.id)
  })

  it('takes no tap while a body is on its way', async () => {
    const onPick = vi.fn()
    const user = userEvent.setup()
    draw('en', { onPick, busy: true })
    for (const b of screen.getAllByRole('button')) {
      expect((b as HTMLButtonElement).disabled).toBe(true)
      await user.click(b)
    }
    expect(onPick).not.toHaveBeenCalled()
  })

  it('warms the cache for the body under the pointer or focus, never for the current one', async () => {
    const user = userEvent.setup()
    draw('en')
    const en = STRINGS.en.chat.looks
    await user.hover(screen.getByRole('button', { name: en[CURRENT.id] }))
    expect(prefetch).not.toHaveBeenCalled()
    await user.hover(screen.getByRole('button', { name: en[OTHER.id] }))
    expect(prefetch).toHaveBeenCalledWith(OTHER.url)
    prefetch.mockClear()
    screen.getByRole('button', { name: en[OTHER.id] }).focus()
    expect(prefetch).toHaveBeenCalledWith(OTHER.url)
  })

  it('warms nothing while a body is on its way', async () => {
    const user = userEvent.setup()
    draw('en', { busy: true })
    const en = STRINGS.en.chat.looks
    await user.hover(screen.getByRole('button', { name: en[OTHER.id] }))
    screen.getByRole('button', { name: en[OTHER.id] }).focus()
    expect(prefetch).not.toHaveBeenCalled()
  })

  it('renders nothing when there is only one body', () => {
    draw('en', { variants: [CURRENT] })
    expect(screen.queryByRole('group')).toBeNull()
  })
})
