// The Protico community widget is injected by a third-party script (see
// index.html). It ships no way to reposition itself, so this module lets a
// visitor drag the floating widget anywhere and remembers where they left it.
//
// Protico's layout mode is set from their dashboard and can change without
// notice. This targets the non-sidebar floating-box layout, where
// #proticoFrameSpan is the fixed-positioned element that holds both the
// collapsed button and the expanded chat panel.

const WIDGET_ID = 'proticoFrameSpan'
const STORAGE_KEY = 'protico-widget-position'
const DRAG_THRESHOLD_PX = 5
const OBSERVE_TIMEOUT_MS = 20_000

// Distance of the widget's left/bottom edges from the viewport edges, matching
// the widget's own left+bottom anchoring so its panel still expands on-screen.
type Anchor = { left: number; bottom: number }

function readSavedAnchor(): Anchor | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const parsed: unknown = JSON.parse(raw)
    if (
      typeof parsed === 'object' &&
      parsed !== null &&
      typeof (parsed as Anchor).left === 'number' &&
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
  const maxLeft = Math.max(0, window.innerWidth - width)
  const maxBottom = Math.max(0, window.innerHeight - height)
  return {
    left: Math.min(Math.max(0, anchor.left), maxLeft),
    bottom: Math.min(Math.max(0, anchor.bottom), maxBottom),
  }
}

function applyAnchor(widget: HTMLElement, anchor: Anchor): void {
  widget.style.left = `${anchor.left}px`
  widget.style.bottom = `${anchor.bottom}px`
  widget.style.right = 'auto'
  widget.style.top = 'auto'
}

function enableDrag(widget: HTMLElement): void {
  widget.style.cursor = 'grab'
  widget.style.touchAction = 'none'

  let activePointerId: number | null = null
  let dragging = false
  let startX = 0
  let startY = 0
  let startAnchor: Anchor = { left: 0, bottom: 0 }
  // Null until the visitor moves the widget — while null, the widget keeps
  // whatever default position Protico's own config gave it.
  let currentAnchor: Anchor | null = null

  const saved = readSavedAnchor()
  if (saved) {
    const rect = widget.getBoundingClientRect()
    currentAnchor = clampAnchor(saved, rect.width, rect.height)
    applyAnchor(widget, currentAnchor)
  }

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
    const rect = widget.getBoundingClientRect()
    currentAnchor = clampAnchor(
      { left: startAnchor.left + dx, bottom: startAnchor.bottom - dy },
      rect.width,
      rect.height,
    )
    applyAnchor(widget, currentAnchor)
  }

  const endDrag = (event: PointerEvent) => {
    if (event.pointerId !== activePointerId) return
    activePointerId = null
    document.body.style.cursor = ''
    document.body.style.userSelect = ''
    window.removeEventListener('pointermove', onPointerMove)
    window.removeEventListener('pointerup', endDrag)
    window.removeEventListener('pointercancel', endDrag)
    if (dragging && currentAnchor) saveAnchor(currentAnchor)
  }

  const onPointerDown = (event: PointerEvent) => {
    if (event.pointerType === 'mouse' && event.button !== 0) return
    activePointerId = event.pointerId
    dragging = false
    startX = event.clientX
    startY = event.clientY
    const rect = widget.getBoundingClientRect()
    startAnchor = { left: rect.left, bottom: window.innerHeight - rect.bottom }
    // Tracking moves on window (rather than capturing the pointer to the
    // widget) keeps the trailing click event targeted at the widget's own
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

  widget.addEventListener('pointerdown', onPointerDown)
  widget.addEventListener('click', onClickCapture, true)

  window.addEventListener('resize', () => {
    if (!currentAnchor) return
    const rect = widget.getBoundingClientRect()
    currentAnchor = clampAnchor(currentAnchor, rect.width, rect.height)
    applyAnchor(widget, currentAnchor)
  })
}

export function initProticoWidget(): void {
  const existing = document.getElementById(WIDGET_ID)
  if (existing instanceof HTMLElement) {
    enableDrag(existing)
    return
  }

  // The widget script appends its container asynchronously, so watch for it.
  const observer = new MutationObserver(() => {
    const found = document.getElementById(WIDGET_ID)
    if (found instanceof HTMLElement) {
      observer.disconnect()
      window.clearTimeout(timeoutId)
      enableDrag(found)
    }
  })
  observer.observe(document.body, { childList: true, subtree: true })

  const timeoutId = window.setTimeout(() => {
    observer.disconnect()
  }, OBSERVE_TIMEOUT_MS)
}
