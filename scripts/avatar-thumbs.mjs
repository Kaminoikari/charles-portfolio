// Renders the character-select portraits for the /avatar page:
// public/avatar/thumbs/<id>.webp, one per OFFERED look in
// src/components/chat/avatarVariants.ts, off the body the site serves.
//
// Re-run it whenever a look is added or a body's file changes:
//
//   npm i --no-save playwright-core@1 && node scripts/avatar-thumbs.mjs [--chromium /path/to/chrome]
//
// Playwright is not a dependency of the site; --no-save installs it for the run
// without touching package.json or the lockfile. It
// needs a Chromium: the Claude Code sandbox has one at /opt/pw-browsers, a
// laptop can pass its own with --chromium. Rendering is software WebGL there,
// which is fine for a still portrait; the pixels are the three-vrm renderer the
// site uses, lit the way avatarGuideEngine lights her.
import http from 'node:http'
import { readFileSync, writeFileSync, mkdirSync, statSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright-core'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const OUT = path.join(ROOT, 'public/avatar/thumbs')
const W = 320
const H = 400

const arg = process.argv.indexOf('--chromium')
const executablePath = arg > 0 ? process.argv[arg + 1] : '/opt/pw-browsers/chromium-1194/chrome-linux/chrome'

// The offered looks, read off the registry's declarations rather than imported
// (the registry is TypeScript and this is a plain Node script).
const registry = readFileSync(path.join(ROOT, 'src/components/chat/avatarVariants.ts'), 'utf8')
const looks = [...registry.matchAll(/\{ id: '([\w-]+)', label: '[^']*', url: '([^']+)'[^}]*offered: true/g)].map(
  ([, id, url]) => ({ id, url }),
)
if (looks.length === 0) throw new Error('no offered looks found in avatarVariants.ts')

const PAGE = `<!doctype html><html><head><meta charset="utf-8">
<script type="importmap">{"imports":{"three":"/node_modules/three/build/three.module.js","three/addons/":"/node_modules/three/examples/jsm/","@pixiv/three-vrm":"/node_modules/@pixiv/three-vrm/lib/three-vrm.module.js"}}</script>
</head><body style="margin:0;background:transparent">
<script type="module">
import * as THREE from 'three'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import { VRMLoaderPlugin, VRMUtils } from '@pixiv/three-vrm'
const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true })
renderer.setSize(${W}, ${H})
renderer.setClearColor(0x000000, 0)
renderer.toneMapping = THREE.ACESFilmicToneMapping
renderer.toneMappingExposure = 1.25
document.body.appendChild(renderer.domElement)
window.portrait = async (url) => {
  const scene = new THREE.Scene()
  scene.add(new THREE.AmbientLight(0xffffff, 1.1))
  const key = new THREE.DirectionalLight(0xffffff, 1.4); key.position.set(0.6, 1.6, 2.2); scene.add(key)
  const fill = new THREE.DirectionalLight(0x00d9ff, 0.3); fill.position.set(-0.4, -1.0, 1.8); scene.add(fill)
  const loader = new GLTFLoader(); loader.register((p) => new VRMLoaderPlugin(p))
  const vrm = (await loader.loadAsync(url)).userData.vrm
  VRMUtils.rotateVRM0(vrm); scene.add(vrm.scene)
  const h = vrm.humanoid
  const down = vrm.meta.metaVersion === '0' ? 1 : -1
  for (const [b, z] of [['leftUpperArm', 1.2], ['rightUpperArm', -1.2]]) {
    const n = h.getNormalizedBoneNode(b); if (n) n.rotation.z = z * down
  }
  vrm.update(0)
  const head = new THREE.Vector3(); h.getNormalizedBoneNode('head').getWorldPosition(head)
  const target = new THREE.Vector3(0, head.y + 0.02, head.z)
  const cam = new THREE.PerspectiveCamera(11, ${W} / ${H}, 0.1, 30)
  cam.position.set(0, target.y + 0.05, 2.3); cam.lookAt(target)
  renderer.render(scene, cam)
  const out = renderer.domElement.toDataURL('image/webp', 0.9)
  VRMUtils.deepDispose(vrm.scene)
  return out
}
window.ready = true
</script></body></html>`

const TYPES = { '.js': 'text/javascript', '.vrm': 'application/octet-stream', '.png': 'image/png' }
const server = http.createServer((req, res) => {
  const url = decodeURIComponent(req.url.split('?')[0])
  if (url === '/__thumbs.html') {
    res.writeHead(200, { 'content-type': 'text/html' })
    return res.end(PAGE)
  }
  const file = path.join(ROOT, url.startsWith('/avatar/') ? path.join('public', url) : url)
  try {
    if (!file.startsWith(ROOT) || !statSync(file).isFile()) throw new Error()
    res.writeHead(200, { 'content-type': TYPES[path.extname(file)] ?? 'application/octet-stream' })
    res.end(readFileSync(file))
  } catch {
    res.writeHead(404)
    res.end()
  }
})
await new Promise((r) => server.listen(0, '127.0.0.1', r))
const base = `http://127.0.0.1:${server.address().port}`

const browser = await chromium.launch({
  executablePath,
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
})
try {
  const page = await browser.newPage()
  await page.goto(`${base}/__thumbs.html`)
  await page.waitForFunction(() => window.ready)
  mkdirSync(OUT, { recursive: true })
  for (const { id, url } of looks) {
    const data = await page.evaluate((u) => window.portrait(u), url)
    const bytes = Buffer.from(data.split(',')[1], 'base64')
    writeFileSync(path.join(OUT, `${id}.webp`), bytes)
    console.log(`${id}.webp ${bytes.length} bytes (${url})`)
  }
} finally {
  await browser.close()
  server.close()
}
