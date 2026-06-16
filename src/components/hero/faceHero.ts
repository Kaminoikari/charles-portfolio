import * as THREE from 'three'
import { GLTFLoader, type GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { SimplifyModifier } from 'three/examples/jsm/modifiers/SimplifyModifier.js'
import * as BufferGeometryUtils from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js'
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js'
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js'
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js'

export type FaceHeroOptions = {
  /** 資產目錄，結尾帶斜線，例如 '/hero/' */
  assetBase: string
  /** 0..1 真實載入進度 */
  onProgress?: (p: number) => void
  /** 資產載完，Enter 可啟用 */
  onReady?: () => void
  /** intro 跑完，hero 文字可淡入 */
  onIntroComplete?: () => void
  /** 引擎邊界錯誤(WebGL 不支援、GLB 載入失敗) */
  onError?: (err: Error) => void
  /** 略過動畫 intro，直接定格在靜態肖像 */
  reducedMotion?: boolean
}

export type FaceHeroHandle = {
  /** 由 Enter 點擊呼叫(真實 user gesture → 解鎖音訊 → 跑 intro)。skipIntro 時直接定格在穩態肖像,不播 intro 動畫與音效(同 session 再訪首頁用) */
  startIntro: (skipIntro?: boolean) => void
  /** 暫停/恢復 render loop 與音訊(離屏 / 分頁隱藏) */
  setActive: (active: boolean) => void
  /** 拆掉 renderer、listeners、RAF、音訊 */
  dispose: () => void
}

function isWebGLAvailable(): boolean {
  try {
    const canvas = document.createElement('canvas')
    return !!(window.WebGLRenderingContext && (canvas.getContext('webgl') || canvas.getContext('experimental-webgl')))
  } catch {
    return false
  }
}

export function initFaceHero(canvas: HTMLCanvasElement, opts: FaceHeroOptions): FaceHeroHandle {
  const noop: FaceHeroHandle = { startIntro: () => {}, setActive: () => {}, dispose: () => {} }

  if (!isWebGLAvailable()) {
    opts.onError?.(new Error('WebGL unavailable'))
    return noop
  }

  type Layer = {
    attr: THREE.BufferAttribute
    base: Float32Array
    portrait: Float32Array
    wireTarget: number[]
    travelK: number
    ny: Float32Array
    pos: Float32Array
    sweepable: boolean
    kind: 'fill' | 'line' | 'point'
    nrm: Float32Array
  }
  type JawRig = {
    half: THREE.BufferAttribute
    wire: THREE.BufferAttribute
    halfBase: Float32Array
    wireBase: Float32Array
    corner: Float32Array
    span: number
    lastOpen: number
  }
  type BuildOptions = {
    parent: THREE.Object3D
    fillK?: number
    lineK: number
    ptK: number
    ptSize: number
    occlude?: boolean
    setBounds?: boolean
    halftone?: boolean
    captureVerts?: boolean
    slimCheek?: number
    mouthNarrow?: number
    earShrink?: number
    earTuck?: number
    jawRig?: boolean
    travelLine?: number
    travelPoint?: number
    sweepable?: boolean
    depthTest?: boolean
    brightFn: (x: number, y: number, z: number, nz: number) => number
  }
  const assetBase = opts.assetBase

  // === tunables ==============================================================
  const CONFIG = {
    glbUrl: assetBase + "male_base.glb",
    imgUrl: assetBase + "charles-face.png",
    headMeshRe: /Head/i,
    eyeMeshRe: /eye/i,

    // landmark-aligned projection: both photo + model were measured with MediaPipe,
    // so we map model->photo in the eye frame (origin = eye midpoint, unit = iod).
    // This lands the real eyes/nose/mouth/chin on the model's matching features.
    photo: { sw: 374, sh: 512, eyeMidX: 171.5, eyeMidY: 196.5, iod: 41 },
    model: { eyeMidX: -0.0003, eyeMidY: 0.1769, iod: 0.0638 },
    frontPow: 1.4,         // normal.z exponent — higher = photo only on the very front
    // soft face oval (eye-frame units) so neck / hair / ears fade to dark
    faceMask: { halfW: 1.45, top: -1.05, bot: 2.05, feather: 0.45 },

    fitHeight: 3.3,        // world height the cropped head is scaled to (cat-style head framing)
    neckCropUnits: 1.6,    // crop the mesh below this many eye-frame units under the eyes — sits just above the shoulders so the full jaw/chin stays but the shoulders are gone
    intro: 1.6,

    contrast: 1.75, bias: 0.02,   // feature contrast applied to the sampled photo luma
    headDecimate: 2200,           // target head vertex count (sparser yutaabe-style net)
    eyeDecimate: 360,             // target eyeball vertex count
    // render intensities (additive layers; kept low so bloom doesn't blow out)
    fill: 0.42, line: 0.62, point: 0.8, pointSize: 0.03,
    eyeBright: 0.34, eyeLine: 0.55, eyePoint: 0.62,
    travelLine: 2.5, travelPoint: 1.5,   // mars-orange light flowing along the wireframe (post-intro), cat intensity x2.5
  }
  const TURN = { yaw: 0.55, pitch: 0.38, shiftX: 0, shiftY: 0 }
  const FOLLOW = { gaze: 0.75, head: 0.10 }
  // ===========================================================================

  function warm(b: number): [number, number, number] {
    b = Math.min(1, Math.max(0, b))
    return [ (240 + (255 - 240) * b) / 255, (132 + (246 - 132) * b) / 255, (64 + (216 - 64) * b) / 255 ]
  }

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true })
  // size from the canvas box, not the window: the canvas is locked to the svh hero via CSS, so the
  // mobile address bar collapsing on scroll (which grows window.innerHeight) can't resize it and blow
  // the head up. updateStyle=false keeps the CSS size; only the drawing buffer follows the box.
  const dispW = () => canvas.clientWidth || window.innerWidth
  const dispH = () => canvas.clientHeight || window.innerHeight
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
  renderer.setSize(dispW(), dispH(), false)
  renderer.setClearColor(0x000000, 1)

  const scene = new THREE.Scene()
  const camera = new THREE.PerspectiveCamera(50, dispW() / dispH(), 0.1, 100)
  camera.position.z = 5

  const composer = new EffectComposer(renderer)
  composer.addPass(new RenderPass(scene, camera))
  const bloom = new UnrealBloomPass(new THREE.Vector2(dispW(), dispH()), 0.22, 0.4, 0.55)
  composer.addPass(bloom)
  composer.addPass(new OutputPass())

  const head = new THREE.Group()
  // mobile shrinks and lifts the whole avatar (head + eyes + shed dust) via this rig so the
  // headline below never collides with it. the rig wraps head so the per-frame mouse-follow on
  // head.position stays independent of the responsive scale/offset. only the avatar moves; the
  // full-viewport canvas background is untouched, so there is no shrunken second layer.
  const headRig = new THREE.Group()
  headRig.add(head)
  scene.add(headRig)
  const MOBILE_MAX_W = 768           // <= Tailwind md breakpoint: phones get the shrunk framing
  const MOBILE_HEAD_SCALE = 0.75     // avatar scaled to 0.75 on phones
  const MOBILE_HEAD_LIFT = 0.4       // world units the avatar centre rises on phones
  let rigReady = false               // hold off until the head bbox is measured at scale 1
  function applyHeadRig() {
    if (!rigReady) return
    const mobile = window.innerWidth <= MOBILE_MAX_W
    headRig.scale.setScalar(mobile ? MOBILE_HEAD_SCALE : 1)
    headRig.position.y = mobile ? MOBILE_HEAD_LIFT : 0
  }

  // --- wireframe-state dynamics (own implementation; references yutaabe's cat-head BEHAVIOUR, not its code) ---
  // brand palette only: cyan #00D9FF primary, mars-orange #E8652B accent. three additive effects layered on
  // the wireframe state — shed dust drifting off the head, brighter star nodes.
  let headWireVerts: Float32Array | null = null   // head wireframe vertex positions, captured at build for dust spawn points
  const dustSys: { update: (dt: number) => void } = { update: () => {} }   // halftone dots that peel off the head and drift outward, persisting across both states
  const DUST = { count: 760, life: 3.4, speed: 0.24, size: 0.02, bright: 1.0, col: [0.30, 0.80, 1.0] }   // cyan-white shed motes — dense, continuous flow
  const CONSTELLATION_GAIN = 1.6        // brighten the wireframe point nodes so vertices read as stars

  // shed-dust field: a fixed pool of motes that spawn on the head surface and drift outward (mostly
  // sideways + up), fading in and out over their life, then respawn. persists in both the wireframe and
  // dot states so the field never collapses when the sweep returns to the portrait.
  const tmpDust = new THREE.Vector3()
  function setupDust(ext: number) {
    if (!headWireVerts || headWireVerts.length < 9) return
    const M = DUST.count, srcN = headWireVerts.length / 3
    const pos = new Float32Array(M * 3), col = new Float32Array(M * 3)
    const vel = new Float32Array(M * 3), life = new Float32Array(M), age = new Float32Array(M)
    const respawn = (i: number) => {
      const v = (Math.floor(Math.random() * srcN)) * 3, o = i * 3
      // spawn on the head surface in world space (head.matrixWorld carries the mobile scale + lift) so the
      // motes peel off the visible head, then drift at full size below — the field fills the whole screen
      tmpDust.set(headWireVerts![v], headWireVerts![v + 1], headWireVerts![v + 2]).applyMatrix4(head.matrixWorld)
      pos[o] = tmpDust.x; pos[o + 1] = tmpDust.y; pos[o + 2] = tmpDust.z
      const dir = tmpDust.x >= 0 ? 1 : -1, sp = DUST.speed * ext * (0.5 + Math.random())
      // desktop sheds up + out into two side plumes; mobile spreads motes in every direction,
      // including a near-zero-horizontal and bidirectional-vertical cohort, so the column directly
      // above and below the small lifted head fills in too instead of only the sides
      const mobile = window.innerWidth <= MOBILE_MAX_W
      vel[o] = mobile
        ? dir * sp * Math.random() * 1.2                  // 0..1.2: some motes travel almost straight up/down
        : dir * sp * (0.7 + 0.6 * Math.random())          // outward, sideways
      vel[o + 1] = mobile
        ? sp * (Math.random() - 0.5) * 2.0                // up AND down
        : sp * (0.15 + 0.5 * Math.random())              // gentle rise
      vel[o + 2] = sp * (Math.random() - 0.3) * 0.4       // slight depth drift
      life[i] = DUST.life * (0.6 + 0.8 * Math.random()); age[i] = Math.random() * life[i]   // stagger so they don't pulse in unison
    }
    for (let i = 0; i < M; i++) respawn(i)
    const g = new THREE.BufferGeometry()
    g.setAttribute("position", new THREE.BufferAttribute(pos, 3))
    g.setAttribute("color", new THREE.BufferAttribute(col, 3))
    const mat = new THREE.PointsMaterial({ size: DUST.size, map: squareTexture(), vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, sizeAttenuation: true })
    // parented to the scene (not the head) so the rig's mobile scale never shrinks the field's reach
    const pts = new THREE.Points(g, mat); pts.frustumCulled = false; scene.add(pts)
    dustSys.update = (dt: number) => {
      for (let i = 0; i < M; i++) {
        age[i] += dt; if (age[i] >= life[i]) respawn(i)
        const o = i * 3
        pos[o] += vel[o] * dt; pos[o + 1] += vel[o + 1] * dt; pos[o + 2] += vel[o + 2] * dt
        const lf = age[i] / life[i], a = Math.sin(Math.PI * lf) * DUST.bright   // per-mote fade in-out only; no longer gated by sweep state, so the field persists in the dot state
        col[o] = DUST.col[0] * a; col[o + 1] = DUST.col[1] * a; col[o + 2] = DUST.col[2] * a
      }
      g.attributes.position.needsUpdate = true; g.attributes.color.needsUpdate = true
    }
  }

  // --- eye death-laser (Superman/Cyclops): two beams from the eyes converging on the pointer ---
  const LASER = { color: [1.0, 0.12, 0.05], width: 0.24, plane: 1.2, length: 24 }  // length overshoots the screen edge
  let firing = false, fireI = 0, charge = 0, scowl = 0   // charge = 0..1 eye charge-up, fireI = beam intensity (lags the charge), scowl = fast grim-mouth ramp (snaps with the press, not the beam)
  const eyeWorld: THREE.Vector3[] = []                   // eye origins in head-local space (filled in build)
  const beams: THREE.Mesh[] = [], muzzles: THREE.Sprite[] = []        // per-eye beam mesh + muzzle sprite
  const raycaster = new THREE.Raycaster()
  const ndcPointer = new THREE.Vector2()
  let faceHitMesh: THREE.Mesh | null = null   // the head's depth occluder, reused as the raycast target so touch only acts on the face
  function pointerOverFace(e: PointerEvent): boolean {
    if (!faceHitMesh) return false
    ndcPointer.set((e.clientX / window.innerWidth) * 2 - 1, -((e.clientY / window.innerHeight) * 2 - 1))
    raycaster.setFromCamera(ndcPointer, camera)
    return raycaster.intersectObject(faceHitMesh, false).length > 0
  }

  // heat-vision SFX (user-supplied), split so every press gets the charge+fire attack and then a
  // seamless sustain: the attack take plays once, and ~when it lands in the beam the looping body
  // takes over (aligned to the same point in the source, so the handoff is continuous).
  const laserAttack = new Audio(assetBase + "laser-attack.mp3")   // charge build + fire blast (~2s)
  laserAttack.preload = "auto"; laserAttack.volume = 0.9
  // sustained beam: TWO <audio loop> elements run continuously, phase-offset by half the clip. Each
  // element is faded to silence exactly as it crosses its OWN loop seam (where <audio loop> leaves a
  // tiny re-seek gap), while the other — then mid-clip and clean — carries the sound. An equal-power
  // envelope keeps the sum constant, so the seam is inaudible without leaving HTMLAudio for Web Audio.
  const loopEls = [new Audio(assetBase + "laser-fire.wav"), new Audio(assetBase + "laser-fire.wav")]
  loopEls.forEach((e) => { e.preload = "auto"; e.loop = true; e.volume = 0 })
  let loopVol = 0          // master beam level (driven up by the attack→loop handoff)
  let loopRunning = false
  const loopDur = () => { const d = loopEls[0].duration; return Number.isFinite(d) && d > 0 ? d : 8.7 }
  // intro SFX (approach A): we attempt autoplay at the intro beats, but browsers block audible
  // playback before the first user gesture — so the very first load may be silent. accepted for
  // now; the final beat timing + autoplay strategy get locked when this folds into the real hero.
  const introScanSfx = new Audio(assetBase + "intro_scan.mp3")    // dark riser under the rising red scan
  const introBaamSfx = new Audio(assetBase + "intro_baam2.mp3")   // deep braam impact when the eyes ignite
  introScanSfx.preload = "auto"; introScanSfx.volume = 0.8
  introBaamSfx.preload = "auto"; introBaamSfx.volume = 0.9
  const BAAM_LEAD = 0.15   // seconds the braam starts before the eyes ignite, so its weight lands on the ignition (tentative; tuned at integration)
  const BAAM_VOL = 0.9     // braam playback volume
  const BAAM_TAIL = 1.1    // seconds of braam at full volume before it fades — the source has a ~13s tail that drags on under the steady state
  const BAAM_FADE = 3.2    // fade-out length; long + gentle so the braam dissolves into the BGM rather than cutting
  let baamFadeRAF = 0, baamFadeTimer = 0
  function playBaam() {
    setPlaybackSession()
    clearTimeout(baamFadeTimer); cancelAnimationFrame(baamFadeRAF)
    introBaamSfx.currentTime = 0; introBaamSfx.volume = BAAM_VOL; introBaamSfx.play().catch(() => {})
    baamFadeTimer = window.setTimeout(() => {
      const t0 = performance.now()
      const step = () => {
        const k = Math.min(1, (performance.now() - t0) / (BAAM_FADE * 1000))
        // raised-cosine taper: slope eases to zero at the end so the tail dissolves
        // into silence (and the rising BGM) instead of a linear yank that reads as a cut
        introBaamSfx.volume = BAAM_VOL * 0.5 * (1 + Math.cos(Math.PI * k))
        if (k >= 1) { introBaamSfx.pause(); introBaamSfx.volume = BAAM_VOL; return }   // re-arm at full volume for the next play
        baamFadeRAF = requestAnimationFrame(step)
      }
      step()
    }, BAAM_TAIL * 1000)
  }
  const ATTACK_TO_LOOP = 1.4   // seconds into the attack take where the sustained beam takes over
  const LASER_VOL = 0.9        // shared playback volume for attack + loop
  const LASER_XFADE = 0.6      // equal-power crossfade window (must finish before the ~2.38s attack ends)
  let loopTimer = 0, loopFadeRAF = 0
  function setPlaybackSession() {
    // iOS Safari silences audio when the hardware mute switch is on unless the page declares a
    // "playback" audio session (iOS 16.4+). this lets the sound through with the ringer flipped.
    try { const nav = navigator as Navigator & { audioSession?: { type: string } }; if (nav.audioSession) nav.audioSession.type = "playback" } catch { /* audioSession unsupported */ }
  }
  function startFireSfx() {
    setPlaybackSession()
    clearTimeout(loopTimer); cancelAnimationFrame(loopFadeRAF)
    laserAttack.currentTime = 0; laserAttack.volume = LASER_VOL; laserAttack.play().catch(() => {})   // charge + fire, every press
    // prime BOTH loop elements now, inside the gesture, MUTED — iOS blocks a play() fired later from a
    // timer, but honours unmuting an already-playing element. We unmute + fade them in at the handoff.
    loopEls.forEach((e) => { e.muted = true; e.currentTime = 0; e.volume = 0; e.play().catch(() => {}) })
    loopTimer = window.setTimeout(() => {
      loopRunning = true; loopVol = 0
      loopEls[0].muted = false; loopEls[0].currentTime = 0
      loopEls[1].muted = false; loopEls[1].currentTime = loopDur() / 2   // half-clip offset so the two seams never coincide
      // one frame loop drives (a) the equal-power attack→beam handoff, then (b) the continuous
      // two-element seam-masking crossfade for as long as the beam is held. each element's level
      // follows |sin(π·phase)|, hitting 0 exactly at its own loop seam where the other covers it.
      const t0 = performance.now()
      const frame = () => {
        if (!loopRunning) return
        const k = Math.min(1, (performance.now() - t0) / (LASER_XFADE * 1000))
        loopVol = LASER_VOL * Math.sin((k * Math.PI) / 2)
        laserAttack.volume = LASER_VOL * Math.cos((k * Math.PI) / 2)
        if (k >= 1 && !laserAttack.paused) { laserAttack.pause(); laserAttack.currentTime = 0; laserAttack.volume = LASER_VOL }
        const d = loopDur()
        loopEls[0].volume = loopVol * Math.abs(Math.sin(Math.PI * (loopEls[0].currentTime / d)))
        loopEls[1].volume = loopVol * Math.abs(Math.sin(Math.PI * (loopEls[1].currentTime / d)))
        loopFadeRAF = requestAnimationFrame(frame)
      }
      frame()
    }, ATTACK_TO_LOOP * 1000)
  }
  function stopFireSfx() {
    clearTimeout(loopTimer); cancelAnimationFrame(loopFadeRAF)
    loopRunning = false
    laserAttack.pause(); laserAttack.currentTime = 0; laserAttack.volume = LASER_VOL
    loopEls.forEach((e) => { e.pause(); e.currentTime = 0; e.muted = true; e.volume = 0 })   // re-arm silent for the next press
  }
  const aimPlane = new THREE.Plane(new THREE.Vector3(0, 0, 1), -LASER.plane)   // target plane in front of the face
  const aimTarget = new THREE.Vector3(), tmpDir = new THREE.Vector3(), tmpCam = new THREE.Vector3()
  const tmpEo = new THREE.Vector3(), tmpToCam = new THREE.Vector3(), tmpWidth = new THREE.Vector3()
  const tmpNormal = new THREE.Vector3(), tmpMid = new THREE.Vector3(), tmpScale = new THREE.Vector3()
  const tmpBasis = new THREE.Matrix4()

  function dotTexture() {
    const c = document.createElement("canvas"); c.width = c.height = 64
    const x = c.getContext("2d")!
    const g = x.createRadialGradient(32, 32, 0, 32, 32, 32)
    g.addColorStop(0, "rgba(255,255,255,1)"); g.addColorStop(0.4, "rgba(255,255,255,0.6)"); g.addColorStop(1, "rgba(255,255,255,0)")
    x.fillStyle = g; x.beginPath(); x.arc(32, 32, 32, 0, Math.PI * 2); x.fill()
    const t = new THREE.CanvasTexture(c); t.needsUpdate = true; return t
  }
  function squareTexture() {
    // a soft-edged square mote for the shed dust (halftone pixels read square, not round)
    const c = document.createElement("canvas"); c.width = c.height = 32
    const x = c.getContext("2d")!
    x.fillStyle = "rgba(255,255,255,0.35)"; x.fillRect(4, 4, 24, 24)
    x.fillStyle = "rgba(255,255,255,1)"; x.fillRect(9, 9, 14, 14)
    const t = new THREE.CanvasTexture(c); t.needsUpdate = true; return t
  }

  // drop every triangle that sits entirely below cropY (world space) — removes neck/shoulders.
  // returns a non-indexed geometry; decimate() welds + reindexes it (no stray vertices left).
  function cropBelow(geo: THREE.BufferGeometry, cropY: number) {
    const pos = geo.getAttribute("position"), idx = geo.getIndex(), tri = idx ? idx.array : null, out: number[] = []
    const pushV = (i: number) => out.push(pos.getX(i), pos.getY(i), pos.getZ(i))
    const n = tri ? tri.length : pos.count
    for (let i = 0; i < n; i += 3) {
      const a = tri ? tri[i] : i, b = tri ? tri[i + 1] : i + 1, c = tri ? tri[i + 2] : i + 2
      if (Math.max(pos.getY(a), pos.getY(b), pos.getY(c)) >= cropY) { pushV(a); pushV(b); pushV(c) }
    }
    const g = new THREE.BufferGeometry()
    g.setAttribute("position", new THREE.Float32BufferAttribute(out, 3))
    return g
  }

  const allMats: THREE.Material[] = []
  const LAYERS: Layer[] = []       // {attr, base, ny} per render layer — drives the intro sweep reveal
  let yMin = 0, yMax = 1  // head vertical bounds (normalized sweep coordinate)
  let jawRig: JawRig | null = null       // {half, wire, halfBase, wireBase, weight, span} — drops the jaw open while firing (a roar)

  // --- halftone portrait shader -------------------------------------------------
  // a dense screen-space dot grid (cat style). each dot's size is driven by the per-vertex
  // baked photo brightness (aBright), so the dots track the face as the head rotates.
  // the portrait fades to nothing on the wireframe side of the sweep line (uSweepNy).
  const halftoneUniforms = {
    uTime: { value: 0 }, uResolution: { value: new THREE.Vector2(window.innerWidth, window.innerHeight) },
    uSweepNy: { value: 1.15 }, uIntroFade: { value: 0 }, uYMin: { value: 0 }, uYSpan: { value: 1 },
    uMouse: { value: new THREE.Vector2(0, 0) }, uLightDir: { value: new THREE.Vector3(0, 0, 1) },
    uIntroRed: { value: -999 },   // rising red-curtain line (ny) during the intro; -999 = intro over
    uEyeCharge: { value: 0 },     // 0..1 Superman charge-up: the eyes glow red before the beam fires
    uEyeIgnite: { value: 0 },     // 0..1 intro eye ignition; stays dark through the whole red scan, blazes only once the scan reaches the top
    uCursorActive: { value: 0 },  // 0..1 fade for the cyan cursor highlight; 0 when no pointer so it doesn't park on the face (mobile has no hover)
  }
  const HALFTONE_VERT = `
    attribute float aBright;
    varying float vBright; varying float vNy; varying vec3 vNormal; varying vec3 vViewPos;
    uniform float uYMin, uYSpan;
    void main() {
      vBright = aBright;
      vNy = (position.y - uYMin) / uYSpan;
      vNormal = normalize(normalMatrix * normal);
      vec4 mv = modelViewMatrix * vec4(position, 1.0); vViewPos = mv.xyz;
      gl_Position = projectionMatrix * mv;
    }`
  const HALFTONE_FRAG = `
    precision highp float;
    varying float vBright; varying float vNy; varying vec3 vNormal; varying vec3 vViewPos;
    uniform float uTime, uSweepNy, uIntroFade, uCursorActive;
    uniform vec2 uResolution, uMouse; uniform vec3 uLightDir;
    void main() {
      float w = smoothstep(uSweepNy - 0.07, uSweepNy + 0.07, vNy);   // 1 = wireframe side
      float portrait = 1.0 - w;
      // directional lighting sculpts the form (lit side -> dots, shadow side -> gaps), like cat
      vec3 N = normalize(vNormal), V = normalize(-vViewPos), L = normalize(uLightDir);
      float diff = max(dot(N, L), 0.0);
      float rim = pow(1.0 - max(dot(N, V), 0.0), 2.2);
      float shade = 0.14 + 0.72 * diff + 0.28 * rim;          // low ambient so shadows read
      float b = clamp(vBright * shade, 0.0, 1.0);             // photo identity x directional sculpt
      // --- cat halftone particle math (verbatim), driven by the sculpted brightness ---
      float lightShaped = smoothstep(0.1, 0.8, b);
      float cellSize = 10.0;
      vec2 cellId = floor(gl_FragCoord.xy / cellSize);
      vec2 cellLocal = fract(gl_FragCoord.xy / cellSize) - 0.5;
      float dotDist = length(cellLocal);
      float cellHash = fract(sin(dot(cellId, vec2(127.1, 311.7))) * 43758.5453);
      float cellHash2 = fract(sin(dot(cellId, vec2(91.34, 47.71))) * 28471.13);
      float pulsePrimary = sin(uTime * 2.2 + cellHash * 6.2831) * 0.5 + 0.5;
      float pulseSecondary = sin(uTime * 1.3 + cellHash2 * 6.2831) * 0.5 + 0.5;
      // cursor interaction (cat verbatim): dots near the cursor grow and turn brand cyan
      vec2 cursorPx = (uMouse * 0.5 + 0.5) * uResolution;
      vec2 cellCenterPx = (cellId + 0.5) * cellSize;
      float cursorInfluence = (1.0 - smoothstep(0.0, 220.0, distance(cellCenterPx, cursorPx))) * uCursorActive;   // gated off when no pointer so it never parks on the face centre
      float dotRadius = lightShaped * 0.6
          + (pulsePrimary - 0.5) * 0.10 * lightShaped
          + (pulseSecondary - 0.5) * 0.06 * lightShaped
          + cursorInfluence * 0.35;
      dotRadius = max(dotRadius, 0.0);
      float dotMask = smoothstep(dotRadius + 0.08, dotRadius - 0.08, dotDist);
      vec3 dotColor = mix(vec3(1.0), vec3(0.0, 0.851, 1.0), cursorInfluence);   // brand cyan #00D9FF near cursor
      vec3 halftoneColor = dotColor * dotMask;
      // transform halo: a pale-cyan energy band riding the sweep line as it morphs the portrait <-> wireframe.
      // parked off the head (uSweepNy 1.15 / -0.15) during the holds, so it only glows mid-transition.
      float hd = abs(vNy - uSweepNy);
      float haloCore = exp(-pow(hd / 0.022, 2.0));
      float haloSoft = exp(-pow(hd / 0.075, 2.0));
      float flick = 0.85 + 0.15 * sin(uTime * 26.0 + vNy * 60.0);
      vec3 halo = (vec3(0.30, 0.85, 1.0) * haloCore * 1.0 + vec3(0.08, 0.55, 1.0) * haloSoft * 0.7) * flick;
      gl_FragColor = vec4((halftoneColor * portrait + halo) * uIntroFade, 1.0);
    }`
  function makeHalftoneMaterial() {
    return new THREE.ShaderMaterial({
      uniforms: halftoneUniforms, vertexShader: HALFTONE_VERT, fragmentShader: HALFTONE_FRAG,
      transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, depthTest: true,
    })
  }

  // --- cat-style eyes -----------------------------------------------------------
  // the eyeballs render as the same halftone dot grid, but their dot size is driven
  // purely by directional lighting (no photo) so they read as glossy spheres. every
  // ~3s they fire the cat's blink glow: a quantized random flash across the surface.
  const EYE_VERT = `
    attribute vec3 aEyeOff;
    varying vec3 vNormal; varying vec3 vViewPos; varying float vNy; varying vec3 vEyeOff;
    uniform float uYMin, uYSpan;
    void main() {
      vNormal = normalize(normalMatrix * normal);
      vec4 mv = modelViewMatrix * vec4(position, 1.0); vViewPos = mv.xyz;
      vNy = (position.y - uYMin) / uYSpan;
      vEyeOff = aEyeOff;
      gl_Position = projectionMatrix * mv;
    }`
  const EYE_FRAG = `
    precision highp float;
    varying vec3 vNormal; varying vec3 vViewPos; varying float vNy; varying vec3 vEyeOff;
    uniform float uTime, uIntroFade, uSweepNy, uIntroRed, uEyeCharge, uEyeIgnite, uCursorActive;
    uniform vec2 uResolution, uMouse; uniform vec3 uLightDir;
    float hash(float n) { return fract(sin(n) * 43758.5453); }
    void main() {
      vec3 N = normalize(vNormal), V = normalize(-vViewPos);
      vec3 L = normalize(vec3(uMouse.x * 2.5, uMouse.y * 2.5, 1.5));   // cat eye light: tracks the cursor for the glossy sheen
      vec3 H = normalize(L + V);
      float diff = max(dot(N, L), 0.0) * 0.12;   // cat weight — keeps the lit hemisphere from blowing out
      float spec = pow(max(dot(N, H), 0.0), 80.0) * 0.5 + pow(max(dot(N, H), 0.0), 200.0) * 0.8;
      float rim = pow(1.0 - max(dot(V, N), 0.0), 2.5) * 0.35;
      float lightLevel = clamp(diff * 3.3 + rim * 1.2 + spec * 3.0, 0.0, 1.0);
      float lightShaped = smoothstep(0.1, 0.8, lightLevel);
      // cat halftone particle math (cellSize 10 — denser than the face, like cat eyes)
      float cellSize = 10.0;
      vec2 cellId = floor(gl_FragCoord.xy / cellSize);
      vec2 cellLocal = fract(gl_FragCoord.xy / cellSize) - 0.5;
      float dotDist = length(cellLocal);
      float cellHash = fract(sin(dot(cellId, vec2(127.1, 311.7))) * 43758.5453);
      float cellHash2 = fract(sin(dot(cellId, vec2(91.34, 47.71))) * 28471.13);
      float pulsePrimary = sin(uTime * 2.2 + cellHash * 6.2831) * 0.5 + 0.5;
      float pulseSecondary = sin(uTime * 1.3 + cellHash2 * 6.2831) * 0.5 + 0.5;
      vec2 cursorPx = (uMouse * 0.5 + 0.5) * uResolution;
      vec2 cellCenterPx = (cellId + 0.5) * cellSize;
      float cursorInfluence = (1.0 - smoothstep(0.0, 220.0, distance(cellCenterPx, cursorPx))) * uCursorActive;
      float dotRadius = lightShaped * 0.6
          + (pulsePrimary - 0.5) * 0.10 * lightShaped
          + (pulseSecondary - 0.5) * 0.06 * lightShaped
          + cursorInfluence * 0.35;
      dotRadius = max(dotRadius, 0.0);
      float dotMask = smoothstep(dotRadius + 0.08, dotRadius - 0.08, dotDist);
      vec3 mixedDotColor = mix(vec3(1.0), vec3(0.0, 0.851, 1.0), cursorInfluence);   // brand cyan near cursor
      vec3 hotTint = vec3(0.91, 0.45, 0.2) * pow(spec, 1.2) * 2.0 * (1.0 - cursorInfluence);   // mars-orange specular
      vec3 halftoneColor = (mixedDotColor + hotTint) * dotMask;
      // blink glow (cat verbatim): every 3s, flash quantized random patches across the eyeball
      vec3 dx = dFdx(vViewPos), dy = dFdy(vViewPos);
      vec3 faceNormal = normalize(cross(dx, dy));
      vec3 quantized = floor(faceNormal * 2.0 + 0.5);
      float seed = dot(quantized, vec3(127.1, 311.7, 74.7));
      float noise = hash(seed * 1000.0 + floor(uTime * 20.0));
      float val = noise < 0.33 ? 0.0 : (noise < 0.66 ? 0.5 : 1.0);
      float cycle = mod(uTime, 3.0);
      float glowOn = smoothstep(0.0, 0.08, cycle) * smoothstep(0.5, 0.35, cycle);
      vec3 col = mix(halftoneColor, vec3(val), glowOn);
      // only the halftone state shows the eyeball; the wireframe side hands off to the dim eye lines
      float portrait = 1.0 - smoothstep(uSweepNy - 0.07, uSweepNy + 0.07, vNy);
      // aperture mask: keep only the eye-opening (a lens-shaped ellipse on the front of the eyeball),
      // so the dots stay inside the lids instead of covering the whole sphere. vEyeOff is normalised to eye radius.
      float ex = vEyeOff.x / 0.66, ey = vEyeOff.y / 0.34;
      float aperture = 1.0 - smoothstep(0.72, 1.0, ex * ex + ey * ey);
      float front = smoothstep(-0.04, 0.14, vEyeOff.z);
      float eyeMask = aperture * front;
      vec3 steadyEye = col * portrait * eyeMask;
      // Superman charge-up: the eyeball ignites red inside the lid opening before the beam fires.
      // not gated by the portrait factor, so the eyes glow in both the dot and wireframe states.
      vec3 chargeGlow = vec3(0.0);
      if (uEyeCharge > 0.001) {
        float ndv = max(dot(V, N), 0.0);
        float fres = pow(1.0 - ndv, 1.0);
        float corona = pow(fres, 0.4) * 6.0;
        float core = pow(ndv, 2.0) * 2.0;
        float flick = 0.7 + 0.3 * sin(uTime * 22.0);   // crackle as the charge builds
        chargeGlow = (vec3(2.0, 0.07, 0.04) + vec3(18.0, 0.10, 0.05) * corona + vec3(8.0, 0.12, 0.06) * core)
            * uEyeCharge * flick * eyeMask;
      }
      if (uIntroRed > -900.0) {
        // intro: the whole eyeball ignites as a red corona (the two eye light points), then
        // dissolves into the steady masked eye as uIntroFade ramps. (cat FRAG_EYE red-glow, verbatim weights)
        float NdotV = max(dot(V, N), 0.0);
        float fres = pow(1.0 - NdotV, 1.0);
        float corona = pow(fres, 0.3) * 10.0;
        float inner = pow(fres, 2.5) * 4.0;
        float hotspot = pow(NdotV, 3.0) * 1.5;
        float pulse = 0.85 + 0.15 * sin(uTime * 3.0);
        float isRed = uEyeIgnite;   // dark through the whole rising scan; ignites only after the red line clears the top
        vec3 redGlow = (vec3(2.5, 0.03, 0.03)
            + vec3(40.0, 0.08, 0.04) * corona * pulse
            + vec3(24.0, 0.20, 0.05) * inner
            + vec3(10.0, 0.15, 0.08) * hotspot) * isRed;
        gl_FragColor = vec4(mix(redGlow, steadyEye, uIntroFade), 1.0);
      } else {
        gl_FragColor = vec4(steadyEye * uIntroFade + chargeGlow, 1.0);
      }
    }`
  function makeEyeMaterial() {
    return new THREE.ShaderMaterial({
      uniforms: halftoneUniforms, vertexShader: EYE_VERT, fragmentShader: EYE_FRAG,
      transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, depthTest: false,
      side: THREE.FrontSide,   // cull back faces so additive front+back don't double the brightness
    })
  }

  // wireframe-state eye lines. a custom material discards back-hemisphere fragments (per-fragment
  // facing test) so the eyeball reads as a front surface instead of a see-through 3D sphere.
  const EYE_WIRE_VERT = `
    attribute vec3 aEyeOff;
    varying vec3 vNormal; varying vec3 vViewPos; varying float vNy; varying vec3 vEyeOff;
    uniform float uYMin, uYSpan;
    void main() {
      vNormal = normalize(normalMatrix * normal);
      vec4 mv = modelViewMatrix * vec4(position, 1.0); vViewPos = mv.xyz;
      vNy = (position.y - uYMin) / uYSpan;
      vEyeOff = aEyeOff;
      gl_Position = projectionMatrix * mv;
    }`
  const EYE_WIRE_FRAG = `
    precision highp float;
    varying vec3 vNormal; varying vec3 vViewPos; varying float vNy; varying vec3 vEyeOff;
    uniform float uSweepNy, uIntroFade;
    void main() {
      vec3 N = normalize(vNormal), V = normalize(-vViewPos);
      float facing = dot(N, V);
      if (facing < 0.02) discard;            // cull the back hemisphere
      // clip to the lid opening (same aperture as the halftone eye) so eyeball lines deep in the socket
      // don't draw over the head — only the surface seen through the opening shows, no see-through.
      float ex = vEyeOff.x / 0.66, ey = vEyeOff.y / 0.34;
      float aperture = 1.0 - smoothstep(0.72, 1.0, ex * ex + ey * ey);
      float front = smoothstep(-0.04, 0.14, vEyeOff.z);
      float eyeMask = aperture * front;
      if (eyeMask < 0.01) discard;
      float w = smoothstep(uSweepNy - 0.07, uSweepNy + 0.07, vNy);    // only on the wireframe side of the sweep
      float edge = smoothstep(0.0, 0.32, facing);                     // soften the grazing silhouette lines
      gl_FragColor = vec4(vec3(0.16, 0.12, 0.08) * w * edge * uIntroFade * eyeMask, 1.0);
    }`
  function makeEyeWireMaterial() {
    return new THREE.ShaderMaterial({
      uniforms: halftoneUniforms, vertexShader: EYE_WIRE_VERT, fragmentShader: EYE_WIRE_FRAG,
      transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, depthTest: false,
    })
  }

  // --- death-laser beam: a camera-facing quad, white-hot core inside a Superman-red sheath ---
  const BEAM_VERT = `
    varying vec2 vUv;
    void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`
  const BEAM_FRAG = `
    precision highp float;
    uniform vec3 uColor; uniform float uTime; uniform float uIntensity;
    varying vec2 vUv;
    void main() {
      float across = (vUv.y - 0.5) * 2.0;       // -1..1 across the beam width
      float along  = vUv.x;                      // 0 (eye) .. 1 (tip)
      float core   = exp(-across * across * 26.0);   // tight white centre
      float sheath = exp(-across * across * 4.5);    // soft red halo
      float taper  = smoothstep(1.0, 0.72, along);   // thin out toward the tip
      float flick  = 0.85 + 0.15 * sin(uTime * 40.0 + along * 22.0);
      vec3 col = vec3(1.5) * core + uColor * sheath * 1.7; // thin white core inside a saturated red sheath
      float env = (core + sheath * 0.6) * taper * flick * uIntensity;
      gl_FragColor = vec4(col, env);
    }`
  const beamUniforms = {
    uColor: { value: new THREE.Color(LASER.color[0], LASER.color[1], LASER.color[2]) },
    uTime: { value: 0 }, uIntensity: { value: 0 },
  }
  function makeBeamMaterial() {
    return new THREE.ShaderMaterial({
      uniforms: beamUniforms, vertexShader: BEAM_VERT, fragmentShader: BEAM_FRAG,
      transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, depthTest: false, side: THREE.DoubleSide,
    })
  }
  function makeGlowSprite() {
    return new THREE.SpriteMaterial({
      map: dotTexture(), color: new THREE.Color(1.0, 0.22, 0.14),
      blending: THREE.AdditiveBlending, depthTest: false, depthWrite: false, transparent: true,
    })
  }

  // --- load photo + glb in parallel ----------------------------------------
  const loadImg = new Promise<HTMLImageElement>((res, rej) => {
    const im = new Image()
    im.crossOrigin = "anonymous"
    im.onload = () => res(im)
    im.onerror = () => rej(new Error(`hero photo failed to load: ${CONFIG.imgUrl}`))
    im.src = CONFIG.imgUrl
  })
  const loadGlb = new Promise<GLTF>((res, rej) =>
    new GLTFLoader().load(
      CONFIG.glbUrl,
      (g) => res(g),
      (ev) => { if (ev.total > 0) opts.onProgress?.(0.1 + 0.85 * (ev.loaded / ev.total)) },
      rej,
    ),
  )

  Promise.all([loadImg, loadGlb]).then(([im, gltf]) => build(im, gltf)).catch((e: unknown) => {
    const err = e instanceof Error ? e : new Error(String(e))
    console.error(err)
    opts.onError?.(err)
  })

  function build(im: HTMLImageElement, gltf: GLTF) {
    // photo luma sampler
    const { sw, sh } = CONFIG.photo
    const oc = document.createElement("canvas"); oc.width = sw; oc.height = sh
    const octx = oc.getContext("2d")!; octx.drawImage(im, 0, 0, sw, sh)
    const px = octx.getImageData(0, 0, sw, sh).data
    const lumaAt = (x: number, y: number) => { const xi = Math.min(sw - 1, Math.max(0, Math.round(x))), yi = Math.min(sh - 1, Math.max(0, Math.round(y))); const i = (yi * sw + xi) * 4; return (0.299 * px[i] + 0.587 * px[i + 1] + 0.114 * px[i + 2]) / 255 }

    // find head + eye meshes
    let headMesh: THREE.Mesh | null = null, eyeMesh: THREE.Mesh | null = null
    gltf.scene.traverse((o) => { const mesh = o as THREE.Mesh; if (!mesh.isMesh) return; if (CONFIG.eyeMeshRe.test(o.name)) eyeMesh = mesh; else if (CONFIG.headMeshRe.test(o.name)) headMesh = mesh })
    if (!headMesh) { opts.onError?.(new Error('no head mesh')); return }
    const head0: THREE.Mesh = headMesh

    head0.updateWorldMatrix(true, false)
    const hgFull = head0.geometry.clone(); hgFull.applyMatrix4(head0.matrixWorld)
    // crop below the neck so the framing is head-only; fit then recomputes on the head alone (enlarges the face)
    const cropY = CONFIG.model.eyeMidY - CONFIG.neckCropUnits * CONFIG.model.iod
    const hgW = cropBelow(hgFull, cropY)
    hgW.computeBoundingBox()
    const bb = hgW.boundingBox!
    const ctr = new THREE.Vector3(); bb.getCenter(ctr)
    const fit = CONFIG.fitHeight / (bb.max.y - bb.min.y)

    // eye-frame model->photo mapping (landmark aligned) + feature contrast
    const P = CONFIG.photo, M = CONFIG.model, FM = CONFIG.faceMask
    const nxOf = (x: number) => (x - M.eyeMidX) / M.iod
    const nyOf = (y: number) => (M.eyeMidY - y) / M.iod
    const mapX = (x: number) => P.eyeMidX + nxOf(x) * P.iod
    const mapY = (y: number) => P.eyeMidY + nyOf(y) * P.iod
    const faceWeight = (nx: number, ny: number) => { const cyf = (FM.top + FM.bot) / 2, ryf = (FM.bot - FM.top) / 2; const r = Math.hypot(nx / FM.halfW, (ny - cyf) / ryf); return Math.min(1, Math.max(0, (1 - r) / FM.feather + 0.5)) }
    const contrast = (b: number) => Math.min(1, Math.max(0, (b - 0.5) * CONFIG.contrast + 0.5 + CONFIG.bias))
    const sstep = (e0: number, e1: number, v: number) => { let t = (v - e0) / (e1 - e0); t = t < 0 ? 0 : t > 1 ? 1 : t; return t * t * (3 - 2 * t) }
    // fade dots that sit beyond the face width — kills the stray ear dots without touching the silhouette
    // (1 inside the face oval halfW, 0 past the ears). vertical contour (chin/forehead) is unaffected.
    const earCut = (nx: number) => sstep(1.72, 1.45, Math.abs(nx))

    // decimate + weld a world-space geometry down to ~targetVerts
    function decimate(geoW: THREE.BufferGeometry, targetVerts: number) {
      let g = new THREE.BufferGeometry()
      g.setAttribute("position", geoW.getAttribute("position").clone())
      if (geoW.getIndex()) g.setIndex(geoW.getIndex()!.clone())
      g = BufferGeometryUtils.mergeVertices(g)
      const remove = Math.max(0, g.getAttribute("position").count - targetVerts)
      if (remove > 0) g = new SimplifyModifier().modify(g, remove)
      g = BufferGeometryUtils.mergeVertices(g)
      g.computeVertexNormals()
      return g
    }

    // build fills + wireframe + nodes for one decimated geometry
    function buildLayers(g: THREE.BufferGeometry, o: BuildOptions) {
      const pa = g.getAttribute("position"), na = g.getAttribute("normal"), index = g.getIndex()!
      const n = pa.count, pos = new Float32Array(n * 3), bright = new Float32Array(n), nloc = new Float32Array(n * 3)
      for (let i = 0; i < n; i++) {
        const x = pa.getX(i), y = pa.getY(i), z = pa.getZ(i)
        pos[i * 3] = (x - ctr.x) * fit; pos[i * 3 + 1] = (y - ctr.y) * fit; pos[i * 3 + 2] = (z - ctr.z) * fit
        bright[i] = o.brightFn(x, y, z, Math.max(0, na.getZ(i)))
        nloc[i * 3] = na.getX(i); nloc[i * 3 + 1] = na.getY(i); nloc[i * 3 + 2] = na.getZ(i)   // local normal, for cat wireframe lighting
      }
      const posAttr = new THREE.BufferAttribute(pos, 3)
      let lo = Infinity, hi = -Infinity
      for (let i = 0; i < n; i++) { const y = pos[i * 3 + 1]; if (y < lo) lo = y; if (y > hi) hi = y }
      if (o.setBounds) { yMin = lo; yMax = hi; halftoneUniforms.uYMin.value = lo; halftoneUniforms.uYSpan.value = (hi - lo) || 1 }
      const nySpan = (yMax - yMin) || 1
      const ny = new Float32Array(n)
      for (let i = 0; i < n; i++) ny[i] = (pos[i * 3 + 1] - yMin) / nySpan
      // grim-mouth weight (the heat-vision scowl): firing curls JUST the two mouth corners (commissures)
      // down, leaving the rest of the closed mouth still — no broad block dips. the corner sits at the
      // lateral extreme of the lip region, so pass 1 finds the lip's own max width (data-driven, not the face
      // width) and pass 2 keeps only the vertices near that extreme, biased to the lower-outer corner. lips
      // are isolated from the cheeks by the SURFACE NORMAL (lips face forward, cheeks face sideways).
      const lipCornerW = new Float32Array(n)   // weight peaked on the two mouth corners -> the downturn
      if (o.jawRig) {
        const lipW = new Float32Array(n)
        let lipXMax = 1e-6
        for (let i = 0; i < n; i++) {
          let bi = (ny[i] - 0.14) / 0.03; bi = bi < 0 ? 0 : bi > 1 ? 1 : bi
          let bo = (0.235 - ny[i]) / 0.03; bo = bo < 0 ? 0 : bo > 1 ? 1 : bo
          let band = Math.min(bi, bo); band = band * band * (3 - 2 * band)
          let fz = (nloc[i * 3 + 2] - 0.2) / 0.4; fz = fz < 0 ? 0 : fz > 1 ? 1 : fz             // faces forward
          let sx = 1 - (Math.abs(nloc[i * 3]) - 0.32) / 0.28; sx = sx < 0 ? 0 : sx > 1 ? 1 : sx  // not sideways -> lip, not cheek
          lipW[i] = band * fz * sx
          if (lipW[i] > 0.2) { const ax = Math.abs(pos[i * 3]); if (ax > lipXMax) lipXMax = ax }  // lip lateral extent = where the corners are
        }
        for (let i = 0; i < n; i++) {
          let corner = (Math.abs(pos[i * 3]) / lipXMax - 0.72) / 0.26; corner = corner < 0 ? 0 : corner > 1 ? 1 : corner; corner = corner * corner * (3 - 2 * corner)   // only the outer slice of the lip width = the two corner tips
          let low = (0.205 - ny[i]) / 0.05; low = low < 0 ? 0 : low > 1 ? 1 : low   // bias the curl to the lower-outer corner
          lipCornerW[i] = lipW[i] * corner * (0.4 + 0.6 * low)
        }
      }
      // real geometry slimming for the WIREFRAME only — pull the front cheek/cheekbone vertices
      // inward in x so the lit-wire contour actually narrows (not a brightness trick). the halftone
      // dot mesh keeps the untouched posAttr, so the dot state is byte-identical. lines/points are
      // invisible in the dot state (PORTRAIT_LINE_MUL = 0, point portrait = 0), so moving them here
      // changes nothing about the portrait.
      const posWire = Float32Array.from(pos)
      if (o.slimCheek) {
        let xAbsMax = 1e-6, zLo = Infinity, zHi = -Infinity
        for (let i = 0; i < n; i++) { const ax = Math.abs(pos[i * 3]); if (ax > xAbsMax) xAbsMax = ax; const z = pos[i * 3 + 2]; if (z < zLo) zLo = z; if (z > zHi) zHi = z }
        const zSpan = (zHi - zLo) || 1
        const sb = (e0: number, e1: number, v: number) => { let t = (v - e0) / (e1 - e0); t = t < 0 ? 0 : t > 1 ? 1 : t; return t * t * (3 - 2 * t) }
        // ear region: the outermost vertices at ear height (gated tight so it isolates the ears from the cheekbone)
        const earMask = (i: number) => sb(0.44, 0.52, ny[i]) * (1 - sb(0.60, 0.70, ny[i])) * sb(0.72, 0.92, Math.abs(pos[i * 3]) / xAbsMax)
        // pre-pass: per-ear centroid so the ear can be shrunk toward its own centre (smaller + rounder)
        let eLx = 0, eLy = 0, eLz = 0, eLw = 0, eRx = 0, eRy = 0, eRz = 0, eRw = 0
        if (o.earShrink) {
          for (let i = 0; i < n; i++) { const em = earMask(i); if (em > 0.01) { const x = pos[i * 3], y = pos[i * 3 + 1], z = pos[i * 3 + 2]; if (x < 0) { eLx += x * em; eLy += y * em; eLz += z * em; eLw += em } else { eRx += x * em; eRy += y * em; eRz += z * em; eRw += em } } }
          eLw = eLw || 1; eRw = eRw || 1; eLx /= eLw; eLy /= eLw; eLz /= eLw; eRx /= eRw; eRy /= eRw; eRz /= eRw
        }
        for (let i = 0; i < n; i++) {
          const x = pos[i * 3], hy = ny[i], nzf = (pos[i * 3 + 2] - zLo) / zSpan
          // gate by the SURFACE NORMAL: only pull vertices whose surface faces sideways (the silhouette
          // edge of the cheek/jaw). front-facing features (lips, mouth, nose) have a small lateral normal,
          // so they are never moved and stay exactly aligned with the dot-state geometry.
          const side = sb(0.32, 0.82, Math.abs(nloc[i * 3]))          // 1 = faces sideways (safe to slim), 0 = faces forward (held)
          const cheek = sb(0.30, 0.46, hy) * (1 - sb(0.58, 0.74, hy)) // cheek + cheekbone band
          const jaw = 1 - sb(0.05, 0.48, hy)                          // jaw -> chin: strongest at the bottom, sharpens the point
          const front = 0.4 + 0.6 * sb(0.35, 0.8, nzf)               // de-emphasise the rear so the ears stay mostly intact
          const profile = Math.min(1.7, cheek + jaw * 1.7)            // combine; jaw pulled harder than the cheek for a pointier chin
          posWire[i * 3] = x * (1 - o.slimCheek * side * front * profile)
          // narrow the lip line to the portrait's mouth width (front-facing lip vertices only)
          if (o.mouthNarrow) { const lip = sb(0.12, 0.16, hy) * (1 - sb(0.21, 0.25, hy)); posWire[i * 3] *= (1 - o.mouthNarrow * lip * sb(0.42, 0.8, nzf)) }
          // shrink + tuck the ears toward their centroid so they read smaller and rounder
          if (o.earShrink) { const em = earMask(i); if (em > 0.01) { const k = o.earShrink * em; const tx = (x < 0 ? eLx : eRx) * (1 - o.earTuck!), ty = (x < 0 ? eLy : eRy), tz = (x < 0 ? eLz : eRz); posWire[i * 3] += (tx - posWire[i * 3]) * k; posWire[i * 3 + 1] += (ty - posWire[i * 3 + 1]) * k; posWire[i * 3 + 2] += (tz - posWire[i * 3 + 2]) * k } }
        }
      }
      const posWireAttr = new THREE.BufferAttribute(posWire, 3)
      if (o.captureVerts) headWireVerts = Float32Array.from(posWire)   // dust peels off these surface points
      if (o.jawRig) {
        // firing tenses the closed mouth into a grim scowl (corners down + lower lip pressed up).
        // drives both the halftone and wireframe positions.
        jawRig = { half: posAttr, wire: posWireAttr, halfBase: Float32Array.from(pos), wireBase: Float32Array.from(posWire), corner: lipCornerW, span: nySpan, lastOpen: 0 }
      }
      const mkCol = (fn: (b: number) => number) => { const c = new Float32Array(n * 3); for (let i = 0; i < n; i++) { const w = warm(bright[i]), k = fn(bright[i]); c[i * 3] = w[0] * k; c[i * 3 + 1] = w[1] * k; c[i * 3 + 2] = w[2] * k } return c }
      // register a color buffer with the post-intro engines. each layer carries the colour it
      // shows in the two steady states — portrait (halftone dots) and wireframe — plus per-vertex
      // height (sweep) and world position (travel light). the sweep lerps portrait<->wireframe.
      const sweepable = o.sweepable !== false
      const regCol = (c: Float32Array, kind: 'fill' | 'line' | 'point') => {
        const attr = new THREE.BufferAttribute(c, 3)
        const portrait = Float32Array.from(c)
        let wireTarget = [0, 0, 0], travelK = 0
        if (sweepable) {
          if (kind === "fill") { for (let i = 0; i < portrait.length; i++) portrait[i] *= PORTRAIT_FILL_MUL }
          else if (kind === "line") { for (let i = 0; i < portrait.length; i++) portrait[i] *= PORTRAIT_LINE_MUL; wireTarget = WIRE_DIM_LINE; travelK = o.travelLine || 0 }
          else { for (let i = 0; i < portrait.length; i++) portrait[i] = 0; wireTarget = WIRE_DIM_POINT; travelK = o.travelPoint || 0 }   // point: dark in portrait (halftone shows the dots), dim + travel in wireframe
        }
        LAYERS.push({ attr, base: Float32Array.from(c), portrait, wireTarget, travelK, ny, pos, sweepable, kind, nrm: nloc })
        return attr
      }
      const depthTest = o.depthTest !== false
      // depth-only occluder: the front surface writes depth so back-of-head wires can't bleed through (no x-ray look)
      if (o.occlude) {
        const go = new THREE.BufferGeometry(); go.setAttribute("position", posWireAttr); go.setIndex(index)
        const mo = new THREE.MeshBasicMaterial({ colorWrite: false, depthWrite: true, polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1, side: THREE.FrontSide })
        faceHitMesh = new THREE.Mesh(go, mo); o.parent.add(faceHitMesh)   // doubles as the raycast target for mobile face-region gating
      }
      if (o.halftone) {
        // dense screen-space halftone portrait, dot size driven by baked photo brightness
        const gf = new THREE.BufferGeometry(); gf.setAttribute("position", posAttr); gf.setIndex(index)
        gf.setAttribute("normal", na.clone())   // for directional lighting in the halftone shader
        gf.setAttribute("aBright", new THREE.BufferAttribute(Float32Array.from(bright), 1))
        o.parent.add(new THREE.Mesh(gf, makeHalftoneMaterial()))   // not CPU-animated; driven by uniforms
      } else if (o.fillK && o.fillK > 0) {
        const fillK = o.fillK
        const gf = new THREE.BufferGeometry(); gf.setAttribute("position", posAttr)
        gf.setAttribute("color", regCol(mkCol((b) => Math.pow(b, 1.3) * fillK), "fill")); gf.setIndex(index)
        const mf = new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, depthTest, side: THREE.FrontSide })
        o.parent.add(new THREE.Mesh(gf, mf)); allMats.push(mf)
      }
      const ia = index.array, seen = new Set<number>(), eIdx: number[] = []
      const addE = (a: number, b: number) => { const k = a < b ? a * 1e7 + b : b * 1e7 + a; if (seen.has(k)) return; seen.add(k); eIdx.push(a, b) }
      for (let i = 0; i < ia.length; i += 3) { addE(ia[i], ia[i + 1]); addE(ia[i + 1], ia[i + 2]); addE(ia[i + 2], ia[i]) }
      const gl = new THREE.BufferGeometry(); gl.setAttribute("position", posWireAttr)
      gl.setAttribute("color", regCol(mkCol((b) => 0.04 + Math.pow(b, 1.4) * o.lineK), "line")); gl.setIndex(eIdx)
      const ml = new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, depthTest })
      o.parent.add(new THREE.LineSegments(gl, ml)); allMats.push(ml)
      const gp = new THREE.BufferGeometry(); gp.setAttribute("position", posWireAttr)
      gp.setAttribute("color", regCol(mkCol((b) => Math.pow(b, 1.6) * o.ptK), "point"))
      const mp = new THREE.PointsMaterial({ size: o.ptSize, map: dotTexture(), vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, depthTest, sizeAttenuation: true })
      o.parent.add(new THREE.Points(gp, mp)); allMats.push(mp)
      return { n, edges: eIdx.length / 2 }
    }

    const headGeo = decimate(hgW, CONFIG.headDecimate)
    buildLayers(headGeo, {
      parent: head, fillK: CONFIG.fill, lineK: CONFIG.line, ptK: CONFIG.point, ptSize: CONFIG.pointSize,
      occlude: true, setBounds: true, halftone: true, captureVerts: true, slimCheek: 0.18, mouthNarrow: 0.12, earShrink: 0.32, earTuck: 0.14, jawRig: true, travelLine: CONFIG.travelLine, travelPoint: CONFIG.travelPoint,
      brightFn: (x, y, _z, nz) => contrast(lumaAt(mapX(x), mapY(y))) * Math.pow(nz, CONFIG.frontPow) * faceWeight(nxOf(x), nyOf(y)) * earCut(nxOf(x)),
    })



    // eyes: two states driven by the same sweep as the head.
    //  - halftone state: a cat-style dot cap, masked to the eye-opening (inside the lids)
    //  - wireframe state: the original dim eyeball lines (no halftone highlight)
    if (eyeMesh) {
      const eye0: THREE.Mesh = eyeMesh
      eye0.updateWorldMatrix(true, false)
      const egW = eye0.geometry.clone(); egW.applyMatrix4(eye0.matrixWorld)
      const eg = decimate(egW, CONFIG.eyeDecimate)
      const epa = eg.getAttribute("position"), ena = eg.getAttribute("normal"), en = epa.count, epos = new Float32Array(en * 3)
      for (let i = 0; i < en; i++) {
        epos[i * 3] = (epa.getX(i) - ctr.x) * fit; epos[i * 3 + 1] = (epa.getY(i) - ctr.y) * fit; epos[i * 3 + 2] = (epa.getZ(i) - ctr.z) * fit
      }
      const eposAttr = new THREE.BufferAttribute(epos, 3)

      // per-vertex offset from each eye centre (normalised to eye radius) — drives the lid-opening
      // aperture mask shared by both the halftone and the wireframe eye, so neither draws over the head.
      let mx = 0; for (let i = 0; i < en; i++) mx += epos[i * 3]; mx /= en   // split L/R at the mean x
      const cL = [0, 0, 0], cR = [0, 0, 0]; let nL = 0, nR = 0
      for (let i = 0; i < en; i++) { const x = epos[i * 3], y = epos[i * 3 + 1], z = epos[i * 3 + 2]; const c = x < mx ? cL : cR; c[0] += x; c[1] += y; c[2] += z; if (x < mx) nL++; else nR++ }
      for (let k = 0; k < 3; k++) { cL[k] /= Math.max(1, nL); cR[k] /= Math.max(1, nR) }
      const off = new Float32Array(en * 3); let R = 0
      for (let i = 0; i < en; i++) { const x = epos[i * 3], y = epos[i * 3 + 1], z = epos[i * 3 + 2], c = x < mx ? cL : cR; const dx = x - c[0], dy = y - c[1], dz = z - c[2]; off[i * 3] = dx; off[i * 3 + 1] = dy; off[i * 3 + 2] = dz; R += Math.hypot(dx, dy, dz) }
      R = (R / en) || 1
      for (let i = 0; i < off.length; i++) off[i] /= R   // eye-radius units
      const offAttr = new THREE.BufferAttribute(off, 3)

      // laser muzzles ride the eye centres (nudged forward to the eye surface), in head-local space
      eyeWorld.push(
        new THREE.Vector3(cL[0], cL[1], cL[2] + R * 0.9),
        new THREE.Vector3(cR[0], cR[1], cR[2] + R * 0.9),
      )
      for (let k = 0; k < 2; k++) {
        const bm = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), makeBeamMaterial())
        bm.visible = false; bm.frustumCulled = false; bm.matrixAutoUpdate = false; scene.add(bm); beams.push(bm)
        const mz = new THREE.Sprite(makeGlowSprite())
        mz.visible = false; mz.frustumCulled = false; scene.add(mz); muzzles.push(mz)
      }

      // wireframe-state eyes: front-surface lines, clipped to the lid opening (back hemisphere culled +
      // aperture mask) so no eyeball lines draw through the head. brought in by the sweep.
      const ia = eg.getIndex()!.array, seen = new Set<number>(), eIdx: number[] = []
      const addE = (a: number, b: number) => { const k = a < b ? a * 1e7 + b : b * 1e7 + a; if (seen.has(k)) return; seen.add(k); eIdx.push(a, b) }
      for (let i = 0; i < ia.length; i += 3) { addE(ia[i], ia[i + 1]); addE(ia[i + 1], ia[i + 2]); addE(ia[i + 2], ia[i]) }
      const gw = new THREE.BufferGeometry()
      gw.setAttribute("position", eposAttr); gw.setAttribute("normal", ena.clone()); gw.setAttribute("aEyeOff", offAttr); gw.setIndex(eIdx)
      head.add(new THREE.LineSegments(gw, makeEyeWireMaterial()))

      // halftone-state eyes: centred cap, masked to the lid opening, fades out on the wireframe side
      const ege = new THREE.BufferGeometry()
      ege.setAttribute("position", eposAttr)
      ege.setAttribute("normal", ena.clone())
      ege.setAttribute("aEyeOff", offAttr)
      ege.setIndex(eg.getIndex())
      head.add(new THREE.Mesh(ege, makeEyeMaterial()))
    }

    const bbox = new THREE.Box3().setFromObject(head)   // measure at scale 1 before the rig kicks in
    const ext = Math.max(bbox.max.x - bbox.min.x, bbox.max.z - bbox.min.z) || 1
    rigReady = true; applyHeadRig()           // bbox measured; apply the responsive scale/offset now
    head.updateWorldMatrix(true, false)       // so dust spawns on the scaled head surface, not the unscaled one
    setupDust(ext)                            // ext stays full size so the field drifts across the whole screen

    for (const L of LAYERS) { (L.attr.array as Float32Array).fill(0); L.attr.needsUpdate = true }
    assetsReady = true
    opts.onProgress?.(1)
    if (pendingStart) doStart(pendingSkip)
    opts.onReady?.()
  }

  // --- mouse ----------------------------------------------------------------
  const mouse = { x: 0, y: 0 }, ease = { x: 0, y: 0 }
  let cursorActive = 0   // 1 while a pointer is present; gates the cyan highlight so it never parks on the face when idle (touch has no hover)
  const setAim = (e: PointerEvent) => { mouse.x = (e.clientX / window.innerWidth) * 2 - 1; mouse.y = -((e.clientY / window.innerHeight) * 2 - 1) }
  // fire the death-laser. mouse/pen fire on press. touch must HOLD STILL briefly to fire, so a swipe scrolls
  // the page instead: touch-action pan-y lets the browser take a vertical drag as a scroll (it then sends us
  // pointercancel, which clears the pending hold), while a stationary press survives the hold timer and fires.
  let holdTimer = 0
  let touchOnFace = false   // mobile: a touch only fires / turns the head when it began on the face, never on the empty backdrop
  // desktop: the listeners live on window, so a click anywhere on the page would otherwise fire the laser. gate it to
  // the hero viewport. the canvas is absolute inset-0 of the h-screen hero box, so its rect tracks the hero as you scroll.
  const pointerInHero = (e: PointerEvent) => {
    const r = renderer.domElement.getBoundingClientRect()
    return e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom
  }
  const beginFire = () => { if (!introDone) return; cursorActive = 1; firing = true; startFireSfx() }   // no firing during the intro (so the first-interaction unlock-replay click is a no-op)
  const stopFiring = (e?: PointerEvent) => { clearTimeout(holdTimer); firing = false; stopFireSfx(); if (!e || e.pointerType === "touch") { cursorActive = 0; touchOnFace = false } }   // touch release clears the highlight; desktop keeps it for the hovering cursor
  const onPointerMove = (e: PointerEvent) => {
    if (e.pointerType === 'touch') { if (touchOnFace) setAim(e); return }   // touch turns the head only while the gesture owns the face
    setAim(e); cursorActive = 1
  }
  const onPointerDown = (e: PointerEvent) => {
    if (e.pointerType === 'touch') {
      touchOnFace = pointerOverFace(e)
      if (!touchOnFace) return            // touch on the backdrop: let the page scroll, no fire, no head turn
      setAim(e); clearTimeout(holdTimer); holdTimer = window.setTimeout(beginFire, 150)
    } else { if (!pointerInHero(e)) return; setAim(e); beginFire() }
  }
  const onPointerUp = (e: PointerEvent) => stopFiring(e)
  const onPointerCancel = (e: PointerEvent) => stopFiring(e)
  const onPointerLeave = () => stopFiring()
  // while actively firing, swallow the scroll so a held press on the face stays a press; when not
  // firing this is a no-op, so a normal swipe scrolls the page as usual (non-passive to allow preventDefault)
  const onTouchMove = (e: TouchEvent) => { if (firing) e.preventDefault() }
  window.addEventListener('pointermove', onPointerMove)
  window.addEventListener('pointerdown', onPointerDown)
  window.addEventListener('pointerup', onPointerUp)
  window.addEventListener('pointercancel', onPointerCancel)
  window.addEventListener('pointerleave', onPointerLeave)
  window.addEventListener('touchmove', onTouchMove, { passive: false })
  renderer.domElement.style.touchAction = "pan-y"   // vertical swipe scrolls the page; a still hold fires
  // keep the canvas locked to the current viewport. dragging the window between
  // monitors with different devicePixelRatio doesn't always fire `resize`, which
  // would leave the canvas at the old monitor's size — pinned top-left, that pushes
  // the centred head off to one side. so we re-sync every frame, not just on resize.
  let lastW = 0, lastH = 0, lastDpr = 0
  function syncSize() {
    const w = dispW(), h = dispH(), dpr = window.devicePixelRatio
    if ((w === lastW && h === lastH && dpr === lastDpr) || w === 0 || h === 0) return
    lastW = w; lastH = h; lastDpr = dpr
    renderer.setPixelRatio(Math.min(dpr, 2))
    renderer.setSize(w, h, false)   // false: keep the CSS size; only the drawing buffer tracks the canvas box
    composer.setSize(w, h)
    camera.aspect = w / h; camera.updateProjectionMatrix()
    applyHeadRig()   // re-evaluate the mobile/desktop avatar framing when the viewport crosses the breakpoint
  }
  window.addEventListener('resize', syncSize)

  // --- intro (cat opening): red curtain rises bottom->top while the two eyes ignite as red
  // coronas, brief hold, then a top->down sweep reveals the dot-matrix portrait as the red recedes.
  const INTRO = { red: 2.6, pause: 0.4, sweep: 1.5 }  // seconds per beat
  const RED = [1.0, 0.12, 0.06]             // curtain red
  const EDGE = [0.35, 0.9, 1.0]             // pale-cyan transform halo riding the sweep line
  const BAND = 0.06
  let introDone = false, introScanFired = false, introBaamFired = false   // one-shot guards so each intro SFX plays once
  function paint(fn: (a: Float32Array, o: number, L: Layer, ny: number) => void) {
    for (const L of LAYERS) {
      const a = L.attr.array as Float32Array, ny = L.ny, n = ny.length
      for (let i = 0; i < n; i++) fn(a, i * 3, L, ny[i])
      L.attr.needsUpdate = true
    }
  }
  // returns intro progress 0..1 (used to ease bloom down as the face settles)
  function updateIntro(t: number) {
    if (introDone) return 1
    const Tred = INTRO.red, Tpause = Tred + INTRO.pause, Tend = Tpause + INTRO.sweep
    // intro SFX: the riser kicks in as the scan begins; the braam lands as the eyes ignite (small pre-roll)
    if (!introScanFired) { introScanFired = true; setPlaybackSession(); introScanSfx.currentTime = 0; introScanSfx.play().catch(() => {}) }
    if (!introBaamFired && t >= Tred - BAAM_LEAD) { introBaamFired = true; playBaam(); introScanSfx.pause() }
    // eyes stay dark for the whole rising scan, then blaze once it reaches the top (t >= Tred)
    halftoneUniforms.uEyeIgnite.value = t < Tred ? 0 : Math.min(1, (t - Tred) / 0.45)
    if (t >= Tend) {
      for (const L of LAYERS) { (L.attr.array as Float32Array).set(L.portrait); L.attr.needsUpdate = true }
      halftoneUniforms.uIntroRed.value = -999
      introDone = true
      opts.onIntroComplete?.()
      sweepBase = t   // start the portrait<->wireframe sweep clock from a full-portrait (dot-matrix) state
      return 1
    }
    // beat 1: red curtain rises bottom -> top; eyes ignite as it passes them
    if (t < Tred) {
      const p = t / Tred, redLine = -0.15 + p * 1.35
      halftoneUniforms.uIntroRed.value = redLine
      paint((a, o, _L, ny) => {
        const f = ny < redLine ? 0.16 : 0.0   // red glow below the rising line, dark ahead of it
        a[o] = RED[0] * f; a[o + 1] = RED[1] * f; a[o + 2] = RED[2] * f
        const ad = Math.abs(ny - redLine)
        if (ad < BAND) { const e = (1 - ad / BAND) * 0.9; a[o] += RED[0] * e; a[o + 1] += RED[1] * e; a[o + 2] += RED[2] * e }
      })
      return p * 0.35
    }
    // beat 2: brief hold — whole figure red, eyes blazing
    if (t < Tpause) {
      halftoneUniforms.uIntroRed.value = 1.3
      return 0.35
    }
    // beat 3: sweep wipes top -> down, revealing the dot-matrix portrait as the red recedes
    const p = (t - Tpause) / INTRO.sweep, revY = 1.2 - p * 1.35
    halftoneUniforms.uIntroRed.value = 1.3   // keep intro active so the eyes cross-fade via uIntroFade
    paint((a, o, L, ny) => {
      const pr = L.portrait
      if (ny >= revY) { a[o] = pr[o]; a[o + 1] = pr[o + 1]; a[o + 2] = pr[o + 2] }   // revealed into the dot-matrix portrait
      else { const f = 0.12; a[o] = RED[0] * f; a[o + 1] = RED[1] * f; a[o + 2] = RED[2] * f }  // still red below the line
      const ad = Math.abs(ny - revY)
      if (ad < BAND) { const e = (1 - ad / BAND) * 0.8; a[o] += EDGE[0] * e; a[o + 1] += EDGE[1] * e; a[o + 2] += EDGE[2] * e }
    })
    return 0.35 + p * 0.65
  }

  // --- steady state: periodic portrait <-> wireframe sweep + travel light ------------
  // wireframe state drops the photo base colour, leaving dim structural wires + the
  // mars-orange travel bands. a sweep line travels the figure vertically to morph between.
  const MARS = [0.91, 0.45, 0.18]
  const WIRE_DIM_LINE = [0.075, 0.058, 0.042]   // dim structural wire colour in wireframe state
  const WIRE_DIM_POINT = [0.05, 0.038, 0.028]
  const PORTRAIT_FILL_MUL = 0.32   // soft surface underglow behind the halftone dots
  const PORTRAIT_LINE_MUL = 0.0    // dot-matrix portrait shows dots, not wireframe lines
  const frac = (x: number) => x - Math.floor(x)
  const band = (x: number) => { const v = 1 - Math.abs(x - 0.5) * 2; return v <= 0 ? 0 : Math.pow(v, 12) }
  const SWEEP = { down: 0.85, holdWire: 4.5, up: 0.85, holdPortrait: 6.0, introHold: 5.0 }  // down/up shortened so the scan snaps through like yutaabe; introHold lingers on the dot portrait first
  const SWEEP_FEATHER = 0.05   // tighter band = a crisper scan edge
  let sweepBase = 0  // seconds (t) at which the intro finished — the sweep clock origin
  // sweep-line height over the figure (ny units, 1.15 = above crown, -0.15 = below collar)
  function sweepLine(st: number) {
    const P = SWEEP.down + SWEEP.holdWire + SWEEP.up + SWEEP.holdPortrait
    let i = st % P; if (i < 0) i += P
    const TOP = 1.15, BOT = -0.15
    if (i < SWEEP.down) return TOP + (i / SWEEP.down) * (BOT - TOP)                 // portrait -> wireframe
    i -= SWEEP.down
    if (i < SWEEP.holdWire) return BOT                                              // hold wireframe
    i -= SWEEP.holdWire
    if (i < SWEEP.up) return BOT + (i / SWEEP.up) * (TOP - BOT)                     // wireframe -> portrait
    return TOP                                                                      // hold portrait
  }
  function applyState(st: number) {
    const ly = sweepLine(st), fw = SWEEP_FEATHER
    // cat wireframe lighting: lit white base + specular sheen. light is view-space (uLightDir);
    // we rotate each vertex's local normal by the head's current yaw/pitch into view space.
    const Lv = halftoneUniforms.uLightDir.value, Lx = Lv.x, Ly = Lv.y, Lz = Lv.z
    let Hx = Lx, Hy = Ly, Hz = Lz + 1.0; const Hl = Math.hypot(Hx, Hy, Hz) || 1; Hx /= Hl; Hy /= Hl; Hz /= Hl   // half vector with view dir (0,0,1)
    const cy = Math.cos(head.rotation.y), sy = Math.sin(head.rotation.y), cx = Math.cos(head.rotation.x), sx = Math.sin(head.rotation.x)
    for (const L of LAYERS) {
      if (!L.sweepable) continue   // static layer (eyes) — handled by their own shaders
      const a = L.attr.array as Float32Array, port = L.portrait, pos = L.pos, ny = L.ny, n = ny.length, K = L.travelK, nrm = L.nrm
      const isPoint = L.kind === "point"
      const nodeScale = isPoint ? 0.7 : 1.0   // keep wireframe nodes from over-glowing
      const twT = halftoneUniforms.uTime.value
      for (let i = 0; i < n; i++) {
        const o = i * 3
        let u = (ny[i] - (ly - fw)) / (2 * fw); u = u < 0 ? 0 : u > 1 ? 1 : u
        const w = u * u * (3 - 2 * u)   // 0 = portrait (dots), 1 = wireframe
        // cat wireBrightness = 0.15 + diffuse*0.5 + specular*2.0 (white lit lines + gloss)
        let wb = 0.15
        if (nrm) {
          const lnx = nrm[o], lny = nrm[o + 1], lnz = nrm[o + 2]
          const x1 = cy * lnx + sy * lnz, z1 = -sy * lnx + cy * lnz   // yaw
          const Nx = x1, Ny = cx * lny - sx * z1, Nz = sx * lny + cx * z1   // pitch
          const ndl = Math.max(0, Nx * Lx + Ny * Ly + Nz * Lz)
          const ndh = Math.max(0, Nx * Hx + Ny * Hy + Nz * Hz)
          wb = (0.15 + ndl * 0.5 + Math.pow(ndh, 30) * 2.0) * nodeScale
          if (isPoint) { const tw = 0.7 + 0.3 * Math.sin(twT * 3.0 + i * 1.7); wb *= CONSTELLATION_GAIN * tw }   // star nodes: brighter + gentle per-node twinkle
        }
        let r = port[o] * (1 - w) + wb * w, g = port[o + 1] * (1 - w) + wb * w, b = port[o + 2] * (1 - w) + wb * w
        if (K) {
          const px = pos[o], py = pos[o + 1]
          const tl = (band(frac(py * 4.0 - st * 0.6)) + band(frac(px * 3.0 + st * 0.5)) * 0.7 + band(frac((px + py) * 3.5 - st * 0.7)) * 0.5) * K * w * 0.5   // mars stays an accent, not the dominant tone
          r += MARS[0] * tl; g += MARS[1] * tl; b += MARS[2] * tl
        }
        const eg = 1 - Math.min(1, Math.abs(ny[i] - ly) / fw)
        if (eg > 0) { const ek = eg * eg * 1.1; r += EDGE[0] * ek; g += EDGE[1] * ek; b += EDGE[2] * ek }
        a[o] = r; a[o + 1] = g; a[o + 2] = b
      }
      L.attr.needsUpdate = true
    }
  }

  let startTime = 0, lastFrameT = 0
  let started = false
  let assetsReady = false
  let pendingStart = false
  let pendingSkip = false
  let rafId = 0
  let pausedAt = 0
  function frame(now: number) {
    rafId = window.requestAnimationFrame(frame)
    syncSize()
    if (!started) { composer.render(); return }
    const t = startTime ? (now - startTime) / 1000 : 0
    const dt = Math.min(0.05, Math.max(0, t - lastFrameT)); lastFrameT = t   // clamped frame delta (seconds)
    const introProg = updateIntro(t)

    const st = Math.max(0, (t - sweepBase) - SWEEP.introHold)   // hold the dot portrait for introHold seconds, then run the cyclic sweep
    const ly = introDone ? sweepLine(st) : 1.15
    halftoneUniforms.uTime.value = t
    halftoneUniforms.uSweepNy.value = ly
    halftoneUniforms.uIntroFade.value = Math.max(0, Math.min(1, (introProg - 0.4) / 0.6))
    const pr = renderer.getPixelRatio()
    halftoneUniforms.uResolution.value.set(dispW() * pr, dispH() * pr)   // device px, matches gl_FragCoord
    // light tracks the cursor (view space) with a slow auto-orbit — sculpts the halftone + drives gaze lighting
    halftoneUniforms.uLightDir.value.set(ease.x * 1.4 + Math.sin(t * 0.4) * 0.32, ease.y * 1.4 + Math.cos(t * 0.3) * 0.22, 1.5).normalize()

    if (introDone) {
      ease.x += (mouse.x - ease.x) * FOLLOW.gaze
      ease.y += (mouse.y - ease.y) * FOLLOW.gaze
      const idle = Math.sin(t * 0.5) * 0.04
      head.rotation.y += (ease.x * TURN.yaw + idle - head.rotation.y) * FOLLOW.head
      head.rotation.x += (-ease.y * TURN.pitch - head.rotation.x) * FOLLOW.head
      head.position.x += (ease.x * TURN.shiftX - head.position.x) * FOLLOW.head
      head.position.y += (ease.y * TURN.shiftY - head.position.y) * FOLLOW.head
      halftoneUniforms.uMouse.value.set(ease.x, ease.y)
      halftoneUniforms.uCursorActive.value += (cursorActive - halftoneUniforms.uCursorActive.value) * 0.15   // ease the highlight in/out so it never pops
      applyState(st)
      dustSys.update(dt)   // shed dust runs every frame in both states (persistent field)

      // death-laser: the eyes charge up red (Superman), then two beams shoot from the eyes
      // through the pointer and on to the screen edge.
      // time-based wind-up so the duration is exact: ~0.66s of eye charge before the beam,
      // ~1.2s to full power, then a snappy release.
      const CHARGE_UP = 1.2, CHARGE_DOWN = 0.16        // slow wind-up, snappy release (matches the audio stopping on release)
      charge += firing ? dt / CHARGE_UP : -dt / CHARGE_DOWN
      charge = Math.max(0, Math.min(1, charge))
      const bt = Math.max(0, Math.min(1, (charge - 0.55) / 0.45))   // beam emerges only once the eyes are well lit
      fireI = bt * bt * (3 - 2 * bt)                    // smoothstep(0.55, 1.0, charge)
      halftoneUniforms.uEyeCharge.value = charge
      beamUniforms.uTime.value = t
      beamUniforms.uIntensity.value = fireI
      // heat-vision scowl: firing curls the two mouth corners down into a frown. the weight is now peaked on
      // just the two corner tips, so dropping them reads as a clean downturn in both states (no broad block
      // dip). applied to both the halftone (dot) and wireframe (line) geometry. only y moves, mouth stays shut.
      scowl += ((firing ? 1 : 0) - scowl) * Math.min(1, dt * 18)   // ~0.12s to snap in / out
      if (jawRig && (scowl > 0.001 || jawRig.lastOpen > 0.001)) {
        const down = scowl * 0.065 * jawRig.span   // corner downturn (the frown)
        const cw = jawRig.corner, hb = jawRig.halfBase, wb = jawRig.wireBase, ha = jawRig.half.array as Float32Array, wa = jawRig.wire.array as Float32Array, m = cw.length
        for (let i = 0; i < m; i++) { const o = i * 3, dy = -cw[i] * down; ha[o] = hb[o]; ha[o + 1] = hb[o + 1] + dy; ha[o + 2] = hb[o + 2]; wa[o] = wb[o]; wa[o + 1] = wb[o + 1] + dy; wa[o + 2] = wb[o + 2] }
        jawRig.half.needsUpdate = true; jawRig.wire.needsUpdate = true; jawRig.lastOpen = scowl
      }
      if (charge > 0.01 && eyeWorld.length === 2) {
        raycaster.setFromCamera(new THREE.Vector2(mouse.x, mouse.y), camera)
        raycaster.ray.intersectPlane(aimPlane, aimTarget)          // pointer -> world point on the aim plane
        camera.getWorldPosition(tmpCam)
        // one shared aim direction (eyes' midpoint -> pointer) so the two beams fire parallel, never crossing
        tmpMid.set(0, 0, 0)
        for (let k = 0; k < 2; k++) { tmpEo.copy(eyeWorld[k]); head.localToWorld(tmpEo); tmpMid.add(tmpEo) }
        tmpMid.multiplyScalar(0.5)
        tmpDir.copy(aimTarget).sub(tmpMid).normalize()
        for (let k = 0; k < 2; k++) {
          tmpEo.copy(eyeWorld[k]); head.localToWorld(tmpEo)         // eye origin in world space
          const len = LASER.length                                  // overshoot to the screen edge
          tmpToCam.copy(tmpCam).sub(tmpEo).normalize()
          tmpWidth.crossVectors(tmpDir, tmpToCam).normalize()        // billboard width axis (across screen)
          tmpNormal.crossVectors(tmpWidth, tmpDir).normalize()       // faces the camera
          tmpBasis.makeBasis(tmpDir, tmpWidth, tmpNormal)
          tmpScale.set(len, LASER.width * (0.7 + fireI * 0.4), 1)
          tmpBasis.scale(tmpScale)
          tmpMid.copy(tmpEo).addScaledVector(tmpDir, len * 0.5)      // beam quad centre
          tmpBasis.setPosition(tmpMid)
          const bm = beams[k]; bm.visible = fireI > 0.01; bm.matrix.copy(tmpBasis)
          const mz = muzzles[k]; mz.visible = true; mz.position.copy(tmpEo); mz.scale.setScalar(0.13 * charge)
        }
      } else if (eyeWorld.length === 2) {
        beams[0].visible = beams[1].visible = false
        muzzles[0].visible = muzzles[1].visible = false
      }
    }

    for (const m of allMats) m.opacity = 1
    bloom.strength = 0.16 + Math.sin(t * 1.1) * 0.04 + (1 - introProg) * 2.4 + charge * 0.06 + fireI * 0.12   // heavy bloom during the red intro + a small kick as the eyes charge and fire

    composer.render()
  }
  rafId = window.requestAnimationFrame(frame)

  function doStart(skipIntro: boolean) {
    pendingStart = false
    if (skipIntro || opts.reducedMotion) {
      for (const L of LAYERS) { (L.attr.array as Float32Array).set(L.portrait); L.attr.needsUpdate = true }
      halftoneUniforms.uIntroRed.value = -999
      halftoneUniforms.uIntroFade.value = 1
      halftoneUniforms.uEyeIgnite.value = 1
      introDone = true
      started = true
      startTime = performance.now()
      sweepBase = 0
      opts.onIntroComplete?.()
      return
    }
    setPlaybackSession()
    introScanFired = true
    introScanSfx.currentTime = 0
    introScanSfx.play().catch(() => {})
    started = true
    startTime = performance.now()
    lastFrameT = 0
  }

  const handle: FaceHeroHandle = {
    startIntro: (skipIntro = false) => {
      if (started) return
      if (assetsReady) doStart(skipIntro)
      else { pendingStart = true; pendingSkip = skipIntro }
    },
    setActive: (active: boolean) => {
      if (active) {
        if (rafId) return
        if (pausedAt && startTime) startTime += performance.now() - pausedAt
        pausedAt = 0
        lastFrameT = 0
        rafId = window.requestAnimationFrame(frame)
      } else {
        if (rafId) { window.cancelAnimationFrame(rafId); rafId = 0 }
        pausedAt = performance.now()
        introScanSfx.pause(); introBaamSfx.pause(); laserAttack.pause(); loopRunning = false; loopEls.forEach((e) => e.pause())
      }
    },
    dispose: () => {
      if (rafId) { window.cancelAnimationFrame(rafId); rafId = 0 }
      window.removeEventListener('pointermove', onPointerMove)
      window.removeEventListener('pointerdown', onPointerDown)
      window.removeEventListener('pointerup', onPointerUp)
      window.removeEventListener('pointercancel', onPointerCancel)
      window.removeEventListener('pointerleave', onPointerLeave)
      window.removeEventListener('touchmove', onTouchMove)
      window.removeEventListener('resize', syncSize)
      clearTimeout(holdTimer); clearTimeout(loopTimer); clearTimeout(baamFadeTimer)
      cancelAnimationFrame(baamFadeRAF); cancelAnimationFrame(loopFadeRAF)
      for (const a of [introScanSfx, introBaamSfx, laserAttack, ...loopEls]) { a.pause(); a.src = '' }
      // free GPU resources: geometries, materials and any textures they hold (StrictMode/SPA remounts leak otherwise)
      scene.traverse((obj) => {
        const mesh = obj as THREE.Mesh
        mesh.geometry?.dispose?.()
        const material = mesh.material
        const materials = Array.isArray(material) ? material : material ? [material] : []
        for (const mat of materials) {
          const withMap = mat as THREE.Material & { map?: THREE.Texture | null }
          withMap.map?.dispose?.()
          mat.dispose()
        }
      })
      composer.dispose()
      bloom.dispose()
      renderer.dispose()
    },
  }
  return handle
}
