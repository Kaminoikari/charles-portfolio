import type { AvatarMotionName } from '../../src/components/chat/avatarMotions'
import type { EmotionName, GestureName } from '../../src/components/chat/avatarGuideEngine'
import type { AvatarFamilyId } from '../../src/components/chat/avatarVariants'

export interface PreviewControl<Name extends string> {
  name: Name
  label: string
}

export const MIKA_MILFY_MODEL_URL = '/avatar/mika-milfy-12.vrm'

/**
 * Which rig the previewed build came off.
 *
 * Stated here rather than looked up, because this tool's whole job is to try
 * the clips on a build BEFORE it is declared in AVATAR_VARIANTS: point the URL
 * above at a fresh `mika-milfy-13.vrm` and the registry has never heard of it.
 * The engine will not guess a family for an undeclared body (guessing is how a
 * clip measured on one skeleton gets played on another), so the person who
 * built the file says which rig it came off. `make.py` prints the skeleton
 * comparison it ran against the base; if that gate passed, this is still right.
 */
export const MIKA_MILFY_FAMILY: AvatarFamilyId = 'vroid-sample-b'

/**
 * Which body the page loads: `?model=/avatar/whatever.vrm` overrides the URL
 * above.
 *
 * The point of this tool is to try a build before it is declared anywhere, and
 * the build worth trying is not always the next Milfy: Phase 3.5's VRM 1.0 →
 * 0.x conversion and Phase 4's rebound weights each produce a file whose only
 * honest check is a browser. Editing this file to look at one and editing it
 * back is how a temporary URL gets committed.
 *
 * Same-origin absolute paths only. Anything that resolves to another origin is
 * reported and ignored rather than fetched, because whatever comes back is
 * handed to the engine as a body.
 *
 * The check is the URL parser's, not a list of shapes to reject. Spelling the
 * shapes out is how `/\\evil.example/x.vrm` got through the first version: it
 * starts with one slash, not two, and carries no `..`, and the parser turns the
 * backslash into a slash and resolves it cross-origin anyway.
 */
export function resolvePreviewModel(search: string): { url: string; problem?: string } {
  const asked = new URLSearchParams(search).get('model')
  if (!asked) return { url: MIKA_MILFY_MODEL_URL }
  const refuse = {
    url: MIKA_MILFY_MODEL_URL,
    problem: `?model= 必須是本站的絕對路徑（收到：${asked}），改用預設的 ${MIKA_MILFY_MODEL_URL}。`,
  }
  if (!asked.startsWith('/')) return refuse
  const here = 'http://preview.invalid'
  let resolved: URL
  try {
    resolved = new URL(asked, here)
  } catch {
    return refuse
  }
  if (resolved.origin !== here) return refuse
  // The ANSWER is parsed a second time, by the loader, against the real page.
  // `/.//evil.example/x.vrm` is same-origin here and normalises to
  // `//evil.example/x.vrm`, which is an authority the second time round: the
  // check passed and the string that left still reached another origin.
  if (resolved.pathname.startsWith('//')) return refuse
  return { url: resolved.pathname + resolved.search }
}

export const PREVIEW_MOTIONS: readonly PreviewControl<AvatarMotionName>[] = [
  { name: 'dance', label: '跳舞' },
  { name: 'peaceSign', label: '比 Yeah' },
  { name: 'modelPose', label: '模特兒姿勢' },
  { name: 'spin', label: '轉圈' },
  { name: 'squat', label: '深蹲' },
  { name: 'akimbo', label: '叉腰' },
  { name: 'playFingers', label: '活動手指' },
  { name: 'scratchHead', label: '搔頭' },
  { name: 'idleLoop', label: '待機律動' },
  { name: 'stretch', label: '伸展' },
]

export const PREVIEW_GESTURES: readonly PreviewControl<GestureName>[] = [
  { name: 'bow', label: '鞠躬' },
  { name: 'nod', label: '點頭' },
  { name: 'wiggle', label: '開心搖頭' },
  { name: 'tilt', label: '歪頭' },
  { name: 'glance', label: '左右張望' },
  { name: 'swayStep', label: '重心擺動' },
  { name: 'bounce', label: '輕快彈跳' },
  { name: 'hipTwist', label: '扭腰' },
  { name: 'toeLook', label: '低頭看腳' },
]

export const PREVIEW_EMOTIONS: readonly PreviewControl<EmotionName>[] = [
  { name: 'happy', label: '開心' },
  { name: 'angry', label: '生氣' },
  { name: 'sad', label: '難過' },
  { name: 'relaxed', label: '放鬆' },
  { name: 'surprised', label: '驚訝' },
  { name: 'excited', label: '興奮' },
  { name: 'nagomi', label: '和睦笑眼' },
  { name: 'pale', label: '青ざめ' },
]
