import {
  initAvatarGuide,
  type AvatarGuideHandle,
} from '../../src/components/chat/avatarGuideEngine'
import {
  AVATAR_FRAMING_COLUMN,
  AVATAR_FRAMING_DEFAULT,
  type AvatarMode,
  type AvatarPlacement,
} from '../../src/components/chat/avatarMode'
import type { AvatarMotionName } from '../../src/components/chat/avatarMotions'
import {
  MIKA_MILFY_MODEL_URL,
  PREVIEW_EMOTIONS,
  PREVIEW_GESTURES,
  PREVIEW_MOTIONS,
} from './live-preview-config'

const READY_POLL_MS = 300
// Ten small clips land in seconds on a local dev server; a minute of polling
// means one of them failed, and an interval with no exit would spin until the
// tab closes.
const READY_POLL_DEADLINE_MS = 60_000
const EMOTION_HOLD_SECONDS = 3
const COLUMN_ONLY_MOTION: AvatarMotionName = 'squat'

function requiredElement<ElementType extends Element>(selector: string): ElementType {
  const element = document.querySelector<ElementType>(selector)
  if (!element) throw new Error(`Mika preview is missing required element: ${selector}`)
  return element
}

const canvas = requiredElement<HTMLCanvasElement>('#mika-canvas')
const status = requiredElement<HTMLElement>('#preview-status')
const motionControls = requiredElement<HTMLElement>('#motion-controls')
const gestureControls = requiredElement<HTMLElement>('#gesture-controls')
const emotionControls = requiredElement<HTMLElement>('#emotion-controls')
const modeControls = requiredElement<HTMLElement>('#mode-controls')

let currentPlacement: AvatarPlacement = 'launcher'
let isDisposed = false
let readyPollId: number | null = null

function announce(message: string, state: 'loading' | 'ready' | 'error' = 'ready'): void {
  status.textContent = message
  status.dataset.state = state
}

function makeButton(label: string, onPress: () => void): HTMLButtonElement {
  const button = document.createElement('button')
  button.type = 'button'
  button.textContent = label
  button.addEventListener('click', onPress)
  return button
}

function applyPlacement(handle: AvatarGuideHandle, placement: AvatarPlacement): void {
  currentPlacement = placement
  handle.setPlacement(placement)
  const framing = placement === 'column' ? AVATAR_FRAMING_COLUMN : AVATAR_FRAMING_DEFAULT
  handle.setFraming(framing.distance, framing.lookAtY)
}

function collectReadyMotions(handle: AvatarGuideHandle): Set<AvatarMotionName> {
  // Both placements are asked about by parameter. An earlier version flipped
  // setPlacement back and forth to get the same union, which landed the
  // camera pan twice every poll tick while clips were still downloading.
  const ready = new Set<AvatarMotionName>()
  handle.readyMotions('launcher').forEach((name) => ready.add(name))
  handle.readyMotions('column').forEach((name) => ready.add(name))
  return ready
}

const handle = initAvatarGuide(
  canvas,
  MIKA_MILFY_MODEL_URL,
  () => {
    announce('Mika Milfy 已進入場景，正在準備 10 支動作。', 'loading')
  },
  () => {
    announce('WebGL context 已中斷，請重新整理頁面。', 'error')
  },
  () => {
    announce('模型載入失敗，請確認本機存在 public/avatar/mika-milfy-7.vrm。', 'error')
  },
)

handle.setActive(true)
handle.setMode('idle')
applyPlacement(handle, currentPlacement)

const motionButtons = new Map<AvatarMotionName, HTMLButtonElement>()
for (const motion of PREVIEW_MOTIONS) {
  const button = makeButton(motion.label, () => {
    const placement: AvatarPlacement = motion.name === COLUMN_ONLY_MOTION ? 'column' : 'launcher'
    applyPlacement(handle, placement)
    if (handle.playMotion(motion.name)) {
      announce(`正在播放：${motion.label}。`)
      return
    }
    announce(`${motion.label} 還在下載，請稍候。`, 'loading')
  })
  button.disabled = true
  button.dataset.motion = motion.name
  motionButtons.set(motion.name, button)
  motionControls.append(button)
}

for (const gesture of PREVIEW_GESTURES) {
  const button = makeButton(gesture.label, () => {
    handle.playGesture(gesture.name)
    announce(`正在表演：${gesture.label}。`)
  })
  button.dataset.gesture = gesture.name
  gestureControls.append(button)
}

for (const emotion of PREVIEW_EMOTIONS) {
  const button = makeButton(emotion.label, () => {
    handle.setEmotion(emotion.name, 1, EMOTION_HOLD_SECONDS)
    announce(`表情：${emotion.label}。`)
  })
  button.dataset.emotion = emotion.name
  emotionControls.append(button)
}

const modes: ReadonlyArray<{ name: AvatarMode; label: string }> = [
  { name: 'idle', label: '待機' },
  { name: 'listening', label: '聆聽' },
  { name: 'speaking', label: '說話' },
]
for (const mode of modes) {
  const button = makeButton(mode.label, () => {
    handle.setMode(mode.name)
    for (const candidate of modeControls.querySelectorAll('button')) {
      candidate.setAttribute('aria-pressed', String(candidate === button))
    }
    announce(`狀態：${mode.label}。`)
  })
  button.dataset.mode = mode.name
  button.setAttribute('aria-pressed', String(mode.name === 'idle'))
  modeControls.append(button)
}

function stopReadyPoll(): void {
  if (readyPollId !== null) {
    window.clearInterval(readyPollId)
    readyPollId = null
  }
}

const pollStartedAt = Date.now()

function refreshMotionButtons(): void {
  const ready = collectReadyMotions(handle)
  for (const [name, button] of motionButtons) button.disabled = !ready.has(name)
  if (ready.size === PREVIEW_MOTIONS.length) {
    stopReadyPoll()
    announce(`10 支動作已就緒，Mika Milfy 可以開始表演。`, 'ready')
    return
  }
  if (Date.now() - pollStartedAt > READY_POLL_DEADLINE_MS) {
    stopReadyPoll()
    const missing = PREVIEW_MOTIONS.filter((motion) => !ready.has(motion.name))
      .map((motion) => motion.label)
      .join('、')
    announce(`這些動作載入失敗：${missing}。其餘可以直接使用。`, 'error')
    return
  }
  announce(`動作準備中：${ready.size}／${PREVIEW_MOTIONS.length}。`, 'loading')
}

readyPollId = window.setInterval(refreshMotionButtons, READY_POLL_MS)
refreshMotionButtons()

function teardown(): void {
  if (isDisposed) return
  isDisposed = true
  stopReadyPoll()
  handle.dispose()
}

window.addEventListener('beforeunload', teardown)
window.addEventListener('pagehide', teardown)
