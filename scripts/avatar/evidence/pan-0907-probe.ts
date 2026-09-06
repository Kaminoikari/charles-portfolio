import { CLEARANCE as VROID_SAMPLE_B } from '../../../src/components/chat/clearance/vroid-sample-b'
import { crownBound } from '../../../src/components/chat/clearance'
import { AVATAR_MOTIONS } from '../../../src/components/chat/avatarMotions'

const f = VROID_SAMPLE_B
const FOV = f.framings.fov
const half = (d: number): number => d * Math.tan((FOV / 2) * (Math.PI / 180))

for (const [clip, def] of Object.entries(AVATAR_MOTIONS)) {
  const m = f.clips[clip]
  for (const frame of def.placements) {
    const framing = f.framings.frames[frame]
    const h = half(framing.distance)
    const crown = crownBound(f, clip, frame, f.restCrownY)
    const top = framing.lookAtY + h
    const bottom = framing.lookAtY - h
    const centred = Math.round(((m.hipsLow + crown) / 2) * 100) / 100 - framing.lookAtY
    const smallest = Math.ceil((crown - framing.lookAtY - h) * 100) / 100
    console.log(
      `${clip}/${frame}  declared ${def.pan?.[frame] ?? 0}  hipsLow ${m.hipsLow}  crownBound ${crown.toFixed(4)}  ` +
      `span ${bottom.toFixed(4)}..${top.toFixed(4)}  centre-> ${centred.toFixed(4)}  smallest-> ${smallest.toFixed(4)}`,
    )
  }
}
