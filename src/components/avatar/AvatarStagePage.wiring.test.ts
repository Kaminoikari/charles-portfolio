// The page has no render test (it mounts the WebGL guide), so this reads its
// source, the way avatarGuideEngine.wiring.test.ts reads the engine's.
// stageLayout.test.ts proves backdropBox puts a scene's eye level on the
// camera's horizon; only these lines make the page draw the box it returns.
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

const SOURCE = readFileSync(path.join(process.cwd(), 'src/components/avatar/AvatarStagePage.tsx'), 'utf8')

describe("the backdrop sits on the camera's horizon", () => {
  it("hands backdropBox the camera's horizon and each scene's eye level", () => {
    expect(SOURCE).toMatch(/const eyeRow = horizonRow\(framing, view\.h\)/)
    expect(SOURCE).toMatch(/const \{ lights, focusX, horizon \} = sceneById\(id\)/)
    expect(SOURCE).toMatch(/const box = backdropBox\(view, eyeRow, horizon, backdropFloor\)/)
    expect(SOURCE).toMatch(/const backdropFloor = layout === 'hud' \? view\.h - HUD_DOCK_H : view\.h/)
  })

  it('draws each picture in that box', () => {
    expect(SOURCE).toMatch(/<SceneLayer [^>]*box=\{box\}/)
    expect(SOURCE).toMatch(/style=\{\{ top: box\.top, height: box\.height,/)
  })
})
