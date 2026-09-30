// Throwaway prototype for docs/plans/avatar-idle-poses.md: poses three bodies
// in the owner's two reference idle poses and renders them from several
// angles. NOT site code and not wired into anything; it exists so the plan's
// numbers can be reproduced. The real implementation belongs in the engine
// (see the plan).
//
//   npm i --no-save playwright-core@1
//   OUT=/tmp/idle-poses node scripts/prototypes/idle-poses.mjs [--chromium /path/to/chrome] [open|behind]
//
// Writes c-<body>-<view>.png (views: front, 50deg, side, back) and prints the
// solved parameters for the clasping hand.
import http from 'node:http'
import { readFileSync, writeFileSync, statSync, mkdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import { chromium } from 'playwright-core'
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const OUT = process.env.OUT ?? '/tmp/idle-poses'
mkdirSync(OUT, { recursive: true })
const arg = process.argv.indexOf('--chromium')
const executablePath = arg > 0 ? process.argv[arg + 1] : '/opt/pw-browsers/chromium-1194/chrome-linux/chrome'
const WHICH = process.argv.includes('open') ? 'open' : 'behind'
const W = 360, H = 640
const PAGE = `<!doctype html><html><head><meta charset="utf-8">
<script type="importmap">{"imports":{"three":"/node_modules/three/build/three.module.js","three/addons/":"/node_modules/three/examples/jsm/","@pixiv/three-vrm":"/node_modules/@pixiv/three-vrm/lib/three-vrm.module.js"}}</script>
</head><body style="margin:0;background:#15171f">
<script type="module">
import * as THREE from 'three'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import { VRMLoaderPlugin, VRMUtils } from '@pixiv/three-vrm'
const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true })
renderer.setSize(${W}, ${H}); renderer.setClearColor(0x2a2d3a, 1)
renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.25
document.body.appendChild(renderer.domElement)
const V = (x,y,z) => new THREE.Vector3(x,y,z)
const rad = (d) => d * Math.PI / 180
// rotation taking basis (a0 axis, n0 normal) to (a1, n1), all in the model frame
function basisQ(a0, n0, a1, n1) {
  const m = (a, n) => { a = a.clone().normalize(); n = n.clone().sub(a.clone().multiplyScalar(n.dot(a))).normalize(); const b = new THREE.Vector3().crossVectors(a, n); return new THREE.Matrix4().makeBasis(a, n, b) }
  const M0 = m(a0, n0), M1 = m(a1, n1)
  return new THREE.Quaternion().setFromRotationMatrix(M1.multiply(M0.clone().transpose()))
}
window.pose = async (url, which, views) => {
  const scene = new THREE.Scene()
  scene.add(new THREE.AmbientLight(0xffffff, 1.1))
  const key = new THREE.DirectionalLight(0xffffff, 1.4); key.position.set(0.6, 1.6, 2.2); scene.add(key)
  const loader = new GLTFLoader(); loader.register((p) => new VRMLoaderPlugin(p))
  const vrm = (await loader.loadAsync(url)).userData.vrm
  VRMUtils.rotateVRM0(vrm); scene.add(vrm.scene)
  const h = vrm.humanoid, v0 = vrm.meta.metaVersion === '0'
  const f = V(0, 0, v0 ? -1 : 1), u = V(0, 1, 0), l = new THREE.Vector3().crossVectors(u, f)
  const set = (name, qWorld, parentWorld) => { const b = h.getNormalizedBoneNode(name); if (!b) return; b.quaternion.copy(parentWorld.clone().invert().multiply(qWorld)) }
  const dir = (o, out, fwd, down = 1) => o.clone().multiplyScalar(Math.sin(rad(out))).add(u.clone().multiplyScalar(-down * Math.cos(rad(out)))).add(f.clone().multiplyScalar(Math.sin(rad(fwd)))).normalize()
  const I = new THREE.Quaternion()
  const palm0 = u.clone().negate()
  const sideO = (side) => (side === 'left' ? l.clone() : l.clone().negate())
  const mixv = (o, m, d, b) => o.clone().multiplyScalar(m).add(u.clone().multiplyScalar(-d)).add(f.clone().multiplyScalar(-b)).normalize()
  function armBehind(side, p) {
    const o = sideO(side)
    const a1 = dir(o, p.upOut, -p.upBack)
    const a2 = mixv(o, -p.fm, p.fd, p.fb)
    const a3 = mixv(o, -p.hm, p.hd, p.hb)
    const n = p.palm === 'back' ? f.clone().negate() : f.clone()
    const q1 = basisQ(o, palm0, a1, f.clone().negate().add(o.clone().multiplyScalar(-0.3)))
    const q2 = basisQ(o, palm0, a2, n.clone().add(o.clone().multiplyScalar(-0.3)))
    const q3 = basisQ(o, palm0, a3, n)
    set(side + 'UpperArm', q1, I); set(side + 'LowerArm', q2, q1); set(side + 'Hand', q3, q2)
    const k = new THREE.Vector3().crossVectors(o, palm0).normalize()
    for (const fg of ['Index', 'Middle', 'Ring', 'Little'])
      ['Proximal', 'Intermediate', 'Distal'].forEach((seg, i) => { const b = h.getNormalizedBoneNode(side + fg + seg); if (b) b.quaternion.setFromAxisAngle(k, rad(p.curl[i])) })
    const tb = h.getNormalizedBoneNode(side + 'ThumbProximal'); if (tb) tb.quaternion.setFromAxisAngle(o, rad((side === 'left' ? 1 : -1) * (v0 ? 1 : -1) * p.thumb))
  }
  const wp = (name) => { const v = new THREE.Vector3(); h.getNormalizedBoneNode(name).getWorldPosition(v); return v }
  const palmC = (side) => wp(side + 'Hand').lerp(wp(side + 'MiddleProximal'), 0.6)
  if (which === 'open') {
    for (const side of ['left', 'right']) {
      const o = sideO(side)
      const a1 = dir(o, 22, 4), a2 = dir(o, 30, 10), a3 = dir(o, 58, 14)
      const q1 = basisQ(o, palm0, a1, o.clone().negate())
      const q2 = basisQ(o, palm0, a2, o.clone().negate().add(f.clone().multiplyScalar(0.8)))
      const q3 = basisQ(o, palm0, a3, f.clone().multiplyScalar(0.8).add(u.clone().multiplyScalar(-0.6)).add(o.clone().multiplyScalar(-0.2)))
      set(side + 'UpperArm', q1, I); set(side + 'LowerArm', q2, q1); set(side + 'Hand', q3, q2)
    }
  } else {
    // inner hand: relaxed, palm back, fingertips just past the midline
    const L = { upOut: 4, upBack: 18, fm: 0.55, fd: 0.8, fb: 0.26, hm: 0.6, hd: 0.8, hb: 0.1, palm: 'back', curl: [22, 28, 18], thumb: 12 }
    armBehind('left', L)
    vrm.scene.updateMatrixWorld(true)
    const wristL = wp('leftHand'), back = f.clone().negate()
    const target = wristL.clone().add(back.clone().multiplyScalar(0.025)).add(l.clone().multiplyScalar(0.01))
    // outer hand: search its forearm and hand directions until the palm sits on the other wrist
    const score = (R) => { armBehind('right', R); vrm.scene.updateMatrixWorld(true); return palmC('right').distanceTo(target) }
    let R = { upOut: 4, upBack: 16, fm: 0.6, fd: 0.8, fb: 0.25, hm: 0.8, hd: 0.5, hb: 0.15, palm: 'front', curl: [55, 65, 45], thumb: 35 }
    const keys = { upOut: [0, 14, 2], upBack: [0, 35, 3], fm: [0, 1.5, 0.1], fd: [0.2, 1.5, 0.1], fb: [-0.2, 0.8, 0.1], hm: [0, 1.5, 0.15], hd: [-0.2, 1.2, 0.15], hb: [-0.3, 0.6, 0.1] }
    let e = score(R)
    for (let pass = 0; pass < 6; pass++) {
      for (const [k, [lo, hi, st0]] of Object.entries(keys)) {
        const st = st0 / (1 + pass)
        for (const d of [st, -st, 2 * st, -2 * st]) {
          const c = { ...R, [k]: Math.min(hi, Math.max(lo, R[k] + d)) }
          const ec = score(c); if (ec < e) { e = ec; R = c }
        }
      }
    }
    const best = { e, R }
    armBehind('right', best.R)
    window.solve = { err: +best.e.toFixed(4), R: best.R }
  }
  // settle spring bones (hair, skirt) for a second
  for (let i = 0; i < 90; i++) vrm.update(1 / 60)
  const head = new THREE.Vector3(); h.getNormalizedBoneNode('head').getWorldPosition(head)
  const hips = new THREE.Vector3(); h.getRawBoneNode('hips').getWorldPosition(hips)
  const info = {}
  for (const side of ['left', 'right']) { const w = new THREE.Vector3(); h.getRawBoneNode(side + 'Middle' + 'Proximal').getWorldPosition(w); info[side] = [+(w.x - hips.x).toFixed(3), +(w.y - hips.y).toFixed(3), +(w.z - hips.z).toFixed(3)] }
  window.lastInfo = info
  const shots = []
  for (const yaw of views) {
    const cam = new THREE.PerspectiveCamera(20, ${W} / ${H}, 0.1, 30)
    const tgt = V(0, head.y * 0.55, 0), d = 5.2
    cam.position.set(Math.sin(rad(yaw)) * d, tgt.y + 0.1, Math.cos(rad(yaw)) * d); cam.lookAt(tgt)
    renderer.render(scene, cam); shots.push(renderer.domElement.toDataURL('image/png'))
  }
  VRMUtils.deepDispose(vrm.scene)
  return shots
}
window.ready = true
</script></body></html>`
const server = http.createServer((req, res) => {
  const url = decodeURIComponent(req.url.split('?')[0])
  if (url === '/p.html') { res.writeHead(200, { 'content-type': 'text/html' }); return res.end(PAGE) }
  const file = path.join(ROOT, url.startsWith('/avatar/') ? path.join('public', url) : url)
  try { statSync(file); res.writeHead(200, { 'content-type': file.endsWith('.js') ? 'text/javascript' : 'application/octet-stream' }); res.end(readFileSync(file)) } catch { res.writeHead(404); res.end() }
})
await new Promise((r) => server.listen(0, '127.0.0.1', r))
const b = await chromium.launch({ executablePath, args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] })
const p = await b.newPage(); p.on('pageerror', (e) => console.log('ERR', e.message))
await p.goto(`http://127.0.0.1:${server.address().port}/p.html`); await p.waitForFunction(() => window.ready)
const bodies = { gishin: '/avatar/gishin-2.vrm', pink: '/avatar/mika-pink-2.vrm', victoria: '/avatar/Victoria_Rubin_webp.vrm' }
const VARIANTS = [
  { upOut: 6, upBack: 22, fm: 0.55, fd: 0.8, fb: 0.2, hm: 0.45, hd: 0.9, hb: 0.1, pb: 1, po: -0.4, curl: [30, 40, 25] },
  { upOut: 4, upBack: 18, fm: 0.45, fd: 0.88, fb: 0.28, hm: 0.35, hd: 0.95, hb: 0.12, pb: 1, po: -0.5, curl: [32, 42, 28] },
  { upOut: 4, upBack: 26, fm: 0.5, fd: 0.85, fb: 0.1, hm: 0.5, hd: 0.85, hb: 0.0, pb: 1, po: -0.6, curl: [35, 45, 30] },
]
for (const [id, url] of Object.entries(bodies)) for (const which of [WHICH]) for (let vi = 0; vi < 1; vi++) {
  const shots = await p.evaluate(([u, w, P]) => { window.P = P; return window.pose(u, w, [0, 50, 90, 180]) }, [url, which, VARIANTS[vi]])
  console.log(id, JSON.stringify(await p.evaluate(() => window.solve)))
  shots.forEach((s, i) => writeFileSync(`${OUT}/c-${id}-${i}.png`, Buffer.from(s.split(',')[1], 'base64')))
}
await b.close(); server.close()
