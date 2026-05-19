// The Protico community-lobby widget is injected by a third-party script
// (see index.html). It ships no drag support and hard-anchors itself to the
// bottom-right corner, where it collides with the ambient-audio button. This
// module lifts the collapsed widget clear of that button and lets the visitor
// drag it anywhere, persisting the chosen spot across reloads.

const CONTAINER_ID = 'proticoButtonContainer'
const STYLE_ID = 'protico-widget-position'
const STORAGE_KEY = 'protico-widget-position'
const DRAG_THRESHOLD_PX = 5
const OBSERVE_TIMEOUT_MS = 20_000
// 20px corner offset + 44px ambient-audio button + 12px breathing room.
const DEFAULT_RIGHT_PX = 20
const DEFAULT_BOTTOM_PX = 76

// Distance of the widget's right/bottom edges from the viewport edges. The
// widget's own design grows the button leftward when expanded, so anchoring
// by right/bottom keeps it on-screen regardless of width changes.
type Anchor = { right: number; bottom: number }

function readSavedAnchor(): Anchor | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const parsed: unknown = JSON.parse(raw)
    if (
      typeof parsed === 'object' &&
      parsed !== null &&
      typeof (parsed as Anchor).right === 'number' &&
      typeof (parsed as Anchor).bottom === 'number'
    ) {
      return parsed as Anchor
    }
    return null
  } catch {
    return null
  }
}

function saveAnchor(anchor: Anchor): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(anchor))
  } catch {
    // Storage may be unavailable (private mode / quota); the widget simply
    // won't remember its position across reloads, which is acceptable.
  }
}

function clampAnchor(anchor: Anchor, width: number, height: number): Anchor {
  const maxRight = Math.max(0, window.innerWidth - width)
  const maxBottom = Math.max(0, window.innerHeight - height)
  return {
    right: Math.min(Math.max(0, anchor.right), maxRight),
    bottom: Math.min(Math.max(0, anchor.bottom), maxBottom),
  }
}

// The widget rewrites the container's inline cssText on every open/close, so
// position must be enforced from a stylesheet with !important, driven by CSS
// custom properties on :root (which the widget never touches).
function injectPositionStyle(): void {
  if (document.getElementById(STYLE_ID)) return
  const style = document.createElement('style')
  style.id = STYLE_ID
  style.textContent =
    `#${CONTAINER_ID}{` +
    'right:var(--protico-widget-right) !important;' +
    'bottom:var(--protico-widget-bottom) !important;' +
    'left:auto !important;' +
    'top:auto !important;' +
    'cursor:grab !important;' +
    'touch-action:none !important;' +
    '}'
  document.head.appendChild(style)
}

function applyAnchor(anchor: Anchor): void {
  const root = document.documentElement
  root.style.setProperty('--protico-widget-right', `${anchor.right}px`)
  root.style.setProperty('--protico-widget-bottom', `${anchor.bottom}px`)
}

function enableDrag(container: HTMLElement): void {
  let activePointerId: number | null = null
  let dragging = false
  let startX = 0
  let startY = 0
  let startAnchor: Anchor = { right: 0, bottom: 0 }
  let currentAnchor: Anchor =
    readSavedAnchor() ?? { right: DEFAULT_RIGHT_PX, bottom: DEFAULT_BOTTOM_PX }

  const setAnchor = (anchor: Anchor) => {
    currentAnchor = anchor
    applyAnchor(anchor)
  }

  const initialRect = container.getBoundingClientRect()
  setAnchor(clampAnchor(currentAnchor, initialRect.width, initialRect.height))

  const onPointerMove = (event: PointerEvent) => {
    if (event.pointerId !== activePointerId) return
    const dx = event.clientX - startX
    const dy = event.clientY - startY
    if (!dragging && Math.hypot(dx, dy) < DRAG_THRESHOLD_PX) return
    if (!dragging) {
      dragging = true
      document.body.style.cursor = 'grabbing'
      document.body.style.userSelect = 'none'
    }
    const rect = container.getBoundingClientRect()
    setAnchor(
      clampAnchor(
        { right: startAnchor.right - dx, bottom: startAnchor.bottom - dy },
        rect.width,
        rect.height,
      ),
    )
  }

  const endDrag = (event: PointerEvent) => {
    if (event.pointerId !== activePointerId) return
    activePointerId = null
    document.body.style.cursor = ''
    document.body.style.userSelect = ''
    window.removeEventListener('pointermove', onPointerMove)
    window.removeEventListener('pointerup', endDrag)
    window.removeEventListener('pointercancel', endDrag)
    if (dragging) saveAnchor(currentAnchor)
  }

  const onPointerDown = (event: PointerEvent) => {
    if (event.pointerType === 'mouse' && event.button !== 0) return
    activePointerId = event.pointerId
    dragging = false
    startX = event.clientX
    startY = event.clientY
    const rect = container.getBoundingClientRect()
    startAnchor = {
      right: window.innerWidth - rect.right,
      bottom: window.innerHeight - rect.bottom,
    }
    // Tracking moves on window (rather than capturing the pointer to the
    // container) keeps the trailing click event targeted at the widget's own
    // button, so a plain tap still opens the lobby.
    window.addEventListener('pointermove', onPointerMove)
    window.addEventListener('pointerup', endDrag)
    window.addEventListener('pointercancel', endDrag)
  }

  // A real drag ends with a click on the widget's open button; swallow it
  // during the capture phase so dragging never toggles the lobby. A plain
  // click (no drag) leaves `dragging` false and passes straight through.
  const onClickCapture = (event: MouseEvent) => {
    if (dragging) {
      event.stopPropagation()
      event.preventDefault()
      dragging = false
    }
  }

  container.addEventListener('pointerdown', onPointerDown)
  container.addEventListener('click', onClickCapture, true)

  window.addEventListener('resize', () => {
    const rect = container.getBoundingClientRect()
    setAnchor(clampAnchor(currentAnchor, rect.width, rect.height))
  })
}

function setup(container: HTMLElement): void {
  injectPositionStyle()
  enableDrag(container)
}

export function initProticoWidget(): void {
  const existing = document.getElementById(CONTAINER_ID)
  if (existing instanceof HTMLElement) {
    setup(existing)
    return
  }

  // The widget script appends its container asynchronously, so watch for it.
  const observer = new MutationObserver(() => {
    const found = document.getElementById(CONTAINER_ID)
    if (found instanceof HTMLElement) {
      observer.disconnect()
      window.clearTimeout(timeoutId)
      setup(found)
    }
  })
  observer.observe(document.body, { childList: true, subtree: true })

  const timeoutId = window.setTimeout(() => {
    observer.disconnect()
  }, OBSERVE_TIMEOUT_MS)
}
