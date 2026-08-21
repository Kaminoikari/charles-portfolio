import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, waitFor } from '@testing-library/react'

import AvatarGuide from './AvatarGuide'
import { PAT_EMOTION } from './avatarMode'

// PAT_EMOTION is replaced with values nothing else in the codebase uses, so the
// assertions below can only pass if AvatarGuide actually READS the shared
// constant. Asserting against the real one would be circular: this file and the
// component would import the same literal, and putting ('happy', 0.9, 1.8) back
// inline would keep every test green while the two call sites drift apart.
vi.mock('./avatarMode', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./avatarMode')>()),
  PAT_EMOTION: {
    happy: ['nagomi', 0.42, 3.75],
    annoyed: ['surprised', 0.37, 2.25],
  },
}))

// The real engine builds a WebGL renderer and pulls in three-vrm; this file is
// about the pointer maths in the React shell, so the engine is a spy handle.
const handle = {
  setMode: vi.fn(),
  setActive: vi.fn(),
  setSpeech: vi.fn(),
  setEmotion: vi.fn(),
  playGesture: vi.fn(),
  playMotion: vi.fn(() => true),
  setFraming: vi.fn(),
  setPlacement: vi.fn(),
  dispose: vi.fn(),
}
vi.mock('./avatarGuideEngine', () => ({
  initAvatarGuide: (
    _canvas: HTMLCanvasElement,
    _url: string,
    onLoaded: () => void,
  ) => {
    onLoaded()
    return handle
  },
}))

// Her launcher box, laid out at the origin: midX 188. avatarHeadBand() puts
// her head at y 66–148 and x 150–226 in this box under the default framing;
// the numbers below are inside and below that, and the band's own arithmetic
// is held to her skeleton in avatarMode.test.ts rather than here.
const RECT = { left: 0, top: 0, width: 376, height: 280 } as DOMRect
const IN_HEAD_X = 188
const IN_HEAD_Y = 70
const OUTSIDE_HEAD_Y = 200

function tap(x = IN_HEAD_X, y = IN_HEAD_Y) {
  clock += 60
  document.dispatchEvent(new MouseEvent('pointerup', { clientX: x, clientY: y }))
}

let clock = 0
function stroke(xs: number[], y = IN_HEAD_Y) {
  for (const x of xs) {
    clock += 60
    document.dispatchEvent(new MouseEvent('pointermove', { clientX: x, clientY: y }))
  }
}
// Five moves = three direction flips, which is what a pat costs.
const BACK_AND_FORTH = [200, 210, 200, 210, 200]

beforeEach(() => {
  clock = 0
  vi.spyOn(performance, 'now').mockImplementation(() => clock)
  vi.spyOn(HTMLCanvasElement.prototype, 'getBoundingClientRect').mockReturnValue(RECT)
  vi.stubGlobal(
    'matchMedia',
    vi.fn((query: string) => ({
      matches: query === '(pointer: fine)',
      media: query,
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })) as unknown as typeof window.matchMedia,
  )
})

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

async function mount(
  onPat: (kind: 'happy' | 'annoyed') => void,
  // Launcher by default because that is what the stroke tests below were
  // written against. Taps are the placement-sensitive gesture, so they say so.
  placement: 'launcher' | 'beside-panel' = 'launcher',
) {
  const onHandle = vi.fn()
  render(
    <AvatarGuide
      mode="idle"
      placement={placement}
      sizeClass="h-[280px] w-[376px]"
      onPat={onPat}
      onHandle={onHandle}
    />,
  )
  // The engine arrives through a dynamic import; until it does, the pat
  // listener has no handle and returns early.
  await waitFor(() => expect(onHandle).toHaveBeenCalledWith(handle))
}

// The canvas box arrives one of two ways: a Tailwind class for the launcher,
// and px arithmetic for the two placements that answer to the viewport
// (avatarDockedBox, avatarColumnBox). The engine sizes its drawing buffer from
// whatever the element actually resolves to, so a style that never reaches the
// canvas renders her at the class's size while every arithmetic test upstream
// stays green.
describe('AvatarGuide canvas box', () => {
  it('applies a px box as an inline style and drops the class', () => {
    render(
      <AvatarGuide
        mode="idle"
        placement="beside-panel"
        sizeClass="h-[280px] w-[376px]"
        sizeStyle={{ width: 1020, height: 760 }}
        onHandle={vi.fn()}
      />,
    )
    const canvas = document.querySelector('canvas') as HTMLCanvasElement
    expect(canvas.style.width).toBe('1020px')
    expect(canvas.style.height).toBe('760px')
    // The class would fight the style at a lower specificity and win nothing,
    // but leaving it on is how a placement ends up with two sizes on the same
    // element the day one of them changes.
    expect(canvas.className).not.toContain('h-[280px]')
  })

  it('falls back to the class when no px box is given', () => {
    render(
      <AvatarGuide mode="idle" placement="launcher" sizeClass="h-[280px] w-[376px]" onHandle={vi.fn()} />,
    )
    const canvas = document.querySelector('canvas') as HTMLCanvasElement
    expect(canvas.className).toContain('h-[280px]')
    expect(canvas.style.width).toBe('')
  })
})

describe('AvatarGuide head pats', () => {
  it('reports a happy pat, and performs the face and wiggle itself', async () => {
    const onPat = vi.fn()
    await mount(onPat)

    stroke(BACK_AND_FORTH)

    expect(onPat).toHaveBeenCalledTimes(1)
    expect(onPat).toHaveBeenCalledWith('happy')
    // The visible beat is this component's, so a pat still reads when the
    // giggle is skipped or the browser refuses to play it.
    expect(handle.setEmotion).toHaveBeenCalledWith(...PAT_EMOTION.happy)
    expect(handle.playGesture).toHaveBeenCalledWith('wiggle')
  })

  it('ignores a stroke below her head so a collarbone sweep is not a pat', async () => {
    const onPat = vi.fn()
    await mount(onPat)

    stroke(BACK_AND_FORTH, OUTSIDE_HEAD_Y)

    expect(onPat).not.toHaveBeenCalled()
  })

  it('turns the third pat in quick succession into an annoyed one', async () => {
    const onPat = vi.fn()
    await mount(onPat)

    for (let i = 0; i < 3; i++) {
      stroke(BACK_AND_FORTH)
      clock += 9000 // past the 8s pat cooldown, inside the 20s streak window
    }

    expect(onPat.mock.calls.map(([kind]) => kind)).toEqual(['happy', 'happy', 'annoyed'])
    expect(handle.setEmotion).toHaveBeenLastCalledWith(...PAT_EMOTION.annoyed)
    // The wiggle belongs to the happy beats only.
    expect(handle.playGesture).toHaveBeenCalledTimes(2)
  })
})

describe('AvatarGuide head taps', () => {
  it('answers a tap on her head with the same beat a stroke earns', async () => {
    const onPat = vi.fn()
    await mount(onPat, 'beside-panel')

    tap()

    expect(onPat).toHaveBeenCalledTimes(1)
    expect(onPat).toHaveBeenCalledWith('happy')
    expect(handle.setEmotion).toHaveBeenCalledWith(...PAT_EMOTION.happy)
    expect(handle.playGesture).toHaveBeenCalledWith('wiggle')
  })

  it('leaves the launcher alone, where a click has to open the panel', async () => {
    const onPat = vi.fn()
    await mount(onPat, 'launcher')

    tap()

    expect(onPat).not.toHaveBeenCalled()
  })

  it('ignores a tap below her head', async () => {
    const onPat = vi.fn()
    await mount(onPat, 'beside-panel')

    tap(IN_HEAD_X, OUTSIDE_HEAD_Y)

    expect(onPat).not.toHaveBeenCalled()
  })

  it('turns the third tap in a row into the annoyed one', async () => {
    const onPat = vi.fn()
    await mount(onPat, 'beside-panel')

    for (let i = 0; i < 3; i++) {
      tap()
      clock += 400 // past the tap cooldown, far inside the 20s streak window
    }

    expect(onPat.mock.calls.map(([kind]) => kind)).toEqual(['happy', 'happy', 'annoyed'])
    expect(handle.setEmotion).toHaveBeenLastCalledWith(...PAT_EMOTION.annoyed)
  })

  it('counts taps and strokes into ONE streak', async () => {
    const onPat = vi.fn()
    await mount(onPat, 'beside-panel')

    stroke(BACK_AND_FORTH)
    clock += 400
    tap()
    clock += 400
    tap()

    // Two taps alone would both be happy; it is the stroke before them that
    // makes the second one the third pat.
    expect(onPat.mock.calls.map(([kind]) => kind)).toEqual(['happy', 'happy', 'annoyed'])
  })

  it('collapses a duplicate pointerup into one pat', async () => {
    const onPat = vi.fn()
    await mount(onPat, 'beside-panel')

    tap()
    clock += 40 // faster than a hand taps on purpose
    tap()

    expect(onPat).toHaveBeenCalledTimes(1)
  })

  it('lets a deliberate tap rhythm reach the annoyed beat', async () => {
    const onPat = vi.fn()
    await mount(onPat, 'beside-panel')

    // 300ms apart is a normal "pat pat pat". The gap used to be 350ms, which
    // ate the middle tap and left three taps looking like two.
    for (let i = 0; i < 3; i++) {
      tap()
      clock += 240 // + the 60ms `tap` advances = 300ms between taps
    }

    expect(onPat.mock.calls.map(([kind]) => kind)).toEqual(['happy', 'happy', 'annoyed'])
  })

  it('spends no cooldown on a pat the engine could not perform', async () => {
    const onPat = vi.fn()
    const onHandle = vi.fn()
    // No `mount` here on purpose: it waits for the engine handle. The engine
    // arrives through a dynamic import, so a gesture before it lands has
    // nothing to perform on — and burning the 8s stroke cooldown there would
    // silence every stroke for the eight seconds AFTER she is finally ready.
    render(
      <AvatarGuide
        mode="idle"
        placement="beside-panel"
        sizeClass="h-[280px] w-[376px]"
        onPat={onPat}
        onHandle={onHandle}
      />,
    )
    stroke(BACK_AND_FORTH)
    expect(onPat).not.toHaveBeenCalled()

    await waitFor(() => expect(onHandle).toHaveBeenCalledWith(handle))
    // One stroke, once she is ready. The clock has moved 300ms, far inside the
    // cooldown the lost pat would have started.
    stroke(BACK_AND_FORTH)

    expect(onPat).toHaveBeenCalledWith('happy')
  })
})
