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

// Her launcher box, laid out at the origin: midX 188, so the head band is
// x 134.8–241.2 (±0.19 × height) and y 33.6–112 (12%–40% of height).
const RECT = { left: 0, top: 0, width: 376, height: 280 } as DOMRect
const IN_HEAD_Y = 70
const OUTSIDE_HEAD_Y = 200

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

async function mount(onPat: (kind: 'happy' | 'annoyed') => void) {
  const onHandle = vi.fn()
  render(
    <AvatarGuide
      mode="idle"
      placement="launcher"
      sizeClass="h-[280px] w-[376px]"
      onPat={onPat}
      onHandle={onHandle}
    />,
  )
  // The engine arrives through a dynamic import; until it does, the pat
  // listener has no handle and returns early.
  await waitFor(() => expect(onHandle).toHaveBeenCalledWith(handle))
}

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

  it('turns the third pat in quick succession into an annoyed, silent one', async () => {
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
