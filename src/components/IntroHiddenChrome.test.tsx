import { describe, it, expect } from 'vitest'
import { render, screen, act, fireEvent } from '@testing-library/react'
import { IntroHiddenChrome } from './IntroHiddenChrome'
import { HeroIntroProvider } from './hero/HeroIntroProvider'
import { useHeroIntro } from './hero/hero-intro-context'

// stands in for FaceHero, the only writer of the intro state in the real app
function IntroDriver() {
  const { setIntroRunning } = useHeroIntro()
  return <button onClick={() => setIntroRunning(true)}>start-intro</button>
}

function renderChrome() {
  return render(
    <HeroIntroProvider>
      <IntroHiddenChrome>
        <button className="fixed bottom-5 left-5">music</button>
        <button className="fixed bottom-5 right-5">chat</button>
      </IntroHiddenChrome>
      <IntroDriver />
    </HeroIntroProvider>,
  )
}

const wrapper = () => screen.getByText('music').parentElement as HTMLElement

describe('IntroHiddenChrome', () => {
  it('shows the floating controls when no intro is running', () => {
    renderChrome()
    expect(wrapper()).toHaveStyle({ opacity: '1' })
    expect(wrapper()).not.toHaveAttribute('inert')
  })

  it('hides them and takes them out of the tab order while the intro runs', () => {
    renderChrome()
    act(() => { fireEvent.click(screen.getByText('start-intro')) })
    expect(wrapper()).toHaveStyle({ opacity: '0' })
    expect(wrapper()).toHaveAttribute('inert')
    expect(wrapper()).toHaveAttribute('aria-hidden', 'true')
  })

  // A transform here would make this wrapper the containing block for its
  // `position: fixed` children and yank both FABs out of the viewport corners.
  it('never applies a transform, which would break its fixed children', () => {
    renderChrome()
    act(() => { fireEvent.click(screen.getByText('start-intro')) })
    const { transform } = wrapper().style
    expect(transform === '' || transform === 'none').toBe(true)
  })
})
