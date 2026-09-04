import type { AvatarMotionName } from '../../src/components/chat/avatarMotions'
import type { EmotionName, GestureName } from '../../src/components/chat/avatarGuideEngine'

export interface PreviewControl<Name extends string> {
  name: Name
  label: string
}

export const MIKA_MILFY_MODEL_URL = '/avatar/mika-milfy-10.vrm'

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
