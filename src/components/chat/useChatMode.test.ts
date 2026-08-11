import { describe, expect, it, afterEach } from 'vitest'
import { act, renderHook, cleanup } from '@testing-library/react'
import { useChatMode } from './useChatMode'

afterEach(cleanup)

function pressEscape() {
  act(() => {
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
  })
}

describe('useChatMode', () => {
  it('starts minimised so the widget rests as a launcher pill', () => {
    const { result } = renderHook(() => useChatMode())
    expect(result.current.mode).toBe('minimised')
  })

  it('opens to the docked panel the first time', () => {
    const { result } = renderHook(() => useChatMode())
    act(() => result.current.open())
    expect(result.current.mode).toBe('docked')
  })

  it('toggles between docked and fullscreen with one control', () => {
    const { result } = renderHook(() => useChatMode())
    act(() => result.current.open())
    act(() => result.current.toggleFullscreen())
    expect(result.current.mode).toBe('fullscreen')
    act(() => result.current.toggleFullscreen())
    expect(result.current.mode).toBe('docked')
  })

  it('minimises straight from fullscreen without passing through docked', () => {
    const { result } = renderHook(() => useChatMode())
    act(() => result.current.open())
    act(() => result.current.toggleFullscreen())
    act(() => result.current.minimise())
    expect(result.current.mode).toBe('minimised')
  })

  // Re-opening from the pill returns to whichever size was last in use, so a
  // visitor working in fullscreen is not demoted to the small panel every time.
  it('reopens at the size that was last in use', () => {
    const { result } = renderHook(() => useChatMode())
    act(() => result.current.open())
    act(() => result.current.toggleFullscreen())
    act(() => result.current.minimise())
    act(() => result.current.open())
    expect(result.current.mode).toBe('fullscreen')
  })

  it('expands straight to fullscreen from the pill when asked', () => {
    const { result } = renderHook(() => useChatMode())
    act(() => result.current.toggleFullscreen())
    expect(result.current.mode).toBe('fullscreen')
  })

  describe('Escape steps down one level at a time', () => {
    it('goes fullscreen to docked', () => {
      const { result } = renderHook(() => useChatMode())
      act(() => result.current.open())
      act(() => result.current.toggleFullscreen())
      pressEscape()
      expect(result.current.mode).toBe('docked')
    })

    it('goes docked to minimised', () => {
      const { result } = renderHook(() => useChatMode())
      act(() => result.current.open())
      pressEscape()
      expect(result.current.mode).toBe('minimised')
    })

    it('stays minimised once there is nothing left to collapse', () => {
      const { result } = renderHook(() => useChatMode())
      pressEscape()
      expect(result.current.mode).toBe('minimised')
    })

    // Escape must not leak past the widget's own lifetime.
    it('stops responding after unmount', () => {
      const { result, unmount } = renderHook(() => useChatMode())
      act(() => result.current.open())
      const before = result.current.mode
      unmount()
      pressEscape()
      expect(before).toBe('docked')
    })
  })

  // Collapsing from fullscreen via Escape still counts as "last used size",
  // otherwise the next Escape-then-reopen would jump back to fullscreen.
  it('treats an Escape collapse as the new last-used size', () => {
    const { result } = renderHook(() => useChatMode())
    act(() => result.current.open())
    act(() => result.current.toggleFullscreen())
    pressEscape() // fullscreen -> docked
    pressEscape() // docked -> minimised
    act(() => result.current.open())
    expect(result.current.mode).toBe('docked')
  })
})
