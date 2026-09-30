// The phone dock covers her legs at the reference framing, so it can be put
// away and brought back. Hidden, it must really be gone for a keyboard or a
// screen reader too (inert), and the one way back must be on screen.
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { describe, expect, it } from 'vitest'

import { LocaleContext } from '../../i18n/locale-context'
import type { Locale } from '../../i18n/config'
import { HudDock } from './HudDock'
import type { StageTab } from './stageContent'

function Harness({ locale = 'zh-TW' as Locale }) {
  const [tab, setTab] = useState<StageTab>('looks')
  const [hidden, setHidden] = useState(false)
  return (
    <LocaleContext.Provider value={{ locale, setLocale: () => {} }}>
      <HudDock
        tab={tab}
        onTab={setTab}
        hidden={hidden}
        onHidden={setHidden}
        pickers={{
          looks: <button type="button">look</button>,
          motions: <button type="button">motion</button>,
          expressions: <button type="button">expression</button>,
          scenes: <button type="button">scene</button>,
        }}
      />
    </LocaleContext.Provider>
  )
}

describe('HudDock', () => {
  it('puts the dock away and brings it back', async () => {
    const user = userEvent.setup()
    render(<Harness />)
    const dock = screen.getByTestId('stage-dock')
    expect(dock).not.toHaveAttribute('inert')
    expect(screen.queryByRole('button', { name: '顯示選單' })).toBeNull()

    await user.click(screen.getByRole('button', { name: '隱藏選單' }))
    expect(dock).toHaveAttribute('inert')
    expect(dock.className).toContain('translate-y-full')

    await user.click(screen.getByRole('button', { name: '顯示選單' }))
    expect(dock).not.toHaveAttribute('inert')
    expect(screen.queryByRole('button', { name: '顯示選單' })).toBeNull()
  })

  it('keeps the chosen tab across hiding', async () => {
    const user = userEvent.setup()
    render(<Harness />)
    await user.click(screen.getByRole('tab', { name: '表情' }))
    await user.click(screen.getByRole('button', { name: '隱藏選單' }))
    await user.click(screen.getByRole('button', { name: '顯示選單' }))
    expect(screen.getByRole('tab', { name: '表情' })).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByRole('button', { name: 'expression' })).toBeInTheDocument()
  })

  it('labels both buttons in every locale', () => {
    for (const [locale, hide] of [
      ['en', 'Hide controls'],
      ['ja', 'メニューを隠す'],
    ] as const) {
      const { unmount } = render(<Harness locale={locale} />)
      expect(screen.getByRole('button', { name: hide })).toBeInTheDocument()
      unmount()
    }
  })
})
