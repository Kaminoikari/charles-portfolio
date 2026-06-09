# Hero 整合 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把 `experiments/hero-clone/face-base.html` 的 Three.js 臉部肖像引擎搬進 React app,外面包一個 loading + Enter 前導頁,完全取代現有的 `ParticleHero`。

**Architecture:** 方案 C — 把引擎抽成自包含的 `src/components/hero/faceHero.ts`(對外只開 `initFaceHero(canvas, opts)` → `{ startIntro, setActive, dispose }`),由薄殼 `src/components/hero/FaceHero.tsx` 負責 DOM、版面、前導頁與生命週期。Enter 點擊是解鎖音訊的 user gesture,intro 從那一刻才開始跑。

**Tech Stack:** React 19、TypeScript(strict)、Vite 8、`three@0.183.0`(bundle)、Vitest + @testing-library/react(新增的殼層測試框架)。

設計 spec:`docs/superpowers/specs/2026-06-09-hero-integration-design.md`
引擎參考來源:`experiments/hero-clone/face-base.html`(移植後此檔留作 sandbox,不再是部署來源)

---

## 重要慣例(每個 commit 都要遵守)

- commit 訊息格式 `type: description`,description 寫「為什麼」,結尾加:
  `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`
- 禁止 AI 寫作慣性:不用 em-dash、不用「不是…而是」對比句、不用半形 CJK 標點。
- 對外 API 型別嚴格,不得用 `any`;引擎內部允許務實的型別推斷,但同樣避免 `any`。
- 分支固定 `feat/hero-face-base`(本任務沿用,不另開、不直推 main)。
- changelog:本次屬「重大功能(hero 整個換掉)」,需要在收尾任務(Task 8)補一筆 changelog 條目。

---

## File Structure

新增:

- `src/components/hero/faceHero.ts` — 移植的 Three.js 引擎,純 TS,不含 React。
- `src/components/hero/FaceHero.tsx` — React 殼:`<section>`、`<canvas>`、loading/Enter 前導頁、hero 文字、SCROLL 提示、生命週期。
- `src/components/hero/FaceHero.test.tsx` — 殼層單元測試(引擎被 mock)。
- `src/test/setup.ts` — Vitest 全域 setup(jest-dom matchers)。
- `public/hero/` — runtime 資產(6 個檔)。

修改:

- `package.json` — 加 `three`、`@types/three`、`vitest`、`@testing-library/react`、`@testing-library/jest-dom`、`@testing-library/user-event`、`jsdom`;加 `test` script。
- `vite.config.ts` — 加 Vitest 設定(jsdom、setupFiles、globals)。
- `tsconfig.app.json` — `types` 加 `vitest/globals`、`@testing-library/jest-dom`。
- `src/App.tsx` — `<ParticleHero />` 換成 `<FaceHero />`。

刪除:

- `src/components/ParticleHero.tsx`
- `src/components/BlackHoleBackdrop.tsx`
- `src/assets/charles-face.png`(若存在;確認只被 ParticleHero 引用後刪)

---

## Task 1: 依賴、資產、測試框架

**Files:**
- Modify: `package.json`
- Modify: `vite.config.ts`
- Modify: `tsconfig.app.json`
- Create: `src/test/setup.ts`
- Create: `public/hero/` 下 6 個資產

- [ ] **Step 1: 安裝 runtime 與測試依賴**

Run:
```bash
cd /Users/charles/portfolio
npm install three@0.183.0
npm install -D @types/three@0.183.0 vitest@^3 @testing-library/react@^16 @testing-library/jest-dom@^6 @testing-library/user-event@^14 jsdom@^25
```
Expected: `package.json` dependencies 出現 `three`,devDependencies 出現其餘五項;無 peer 衝突錯誤。

- [ ] **Step 2: 搬資產到 `public/hero/`**

Run:
```bash
cd /Users/charles/portfolio
mkdir -p public/hero
cp experiments/hero-clone/assets/male_base.glb public/hero/
cp experiments/hero-clone/assets/charles-face.png public/hero/
cp experiments/hero-clone/assets/intro_scan.mp3 public/hero/
cp experiments/hero-clone/assets/intro_baam2.mp3 public/hero/
cp experiments/hero-clone/assets/laser-attack.mp3 public/hero/
cp experiments/hero-clone/assets/laser-fire.wav public/hero/
ls -la public/hero/
```
Expected: `public/hero/` 列出 6 個檔(male_base.glb ~820KB、charles-face.png ~197KB、intro_scan.mp3 ~474KB、intro_baam2.mp3 ~419KB、laser-attack.mp3 ~38KB、laser-fire.wav ~1.5MB)。不搬 `cat.glb`、`dog*.glb`、`intro_baam.mp3`、`laser-fire.mp3`。

- [ ] **Step 3: 建立 Vitest setup 檔**

Create `src/test/setup.ts`:
```ts
import '@testing-library/jest-dom'
```

- [ ] **Step 4: 在 `vite.config.ts` 加 Vitest 設定**

把 `vite.config.ts` 整檔改成:
```ts
/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  assetsInclude: ['**/*.vert', '**/*.frag'],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    css: false,
  },
})
```

- [ ] **Step 5: 在 `tsconfig.app.json` 補測試型別**

把 `"types": ["vite/client"]` 改成:
```json
    "types": ["vite/client", "vitest/globals", "@testing-library/jest-dom"],
```

- [ ] **Step 6: 加 `test` script**

在 `package.json` 的 `scripts` 內加一行(放在 `lint` 之後):
```json
    "test": "vitest run",
```

- [ ] **Step 7: 加一個煙霧測試確認框架能跑**

Create `src/test/smoke.test.ts`:
```ts
import { describe, it, expect } from 'vitest'

describe('test harness', () => {
  it('runs', () => {
    expect(1 + 1).toBe(2)
  })
})
```

Run: `npm test`
Expected: 1 個測試通過,Vitest 正常結束。

- [ ] **Step 8: 確認 build 不被破壞**

Run: `npm run build`
Expected: `tsc -b` 與 `vite build` 都成功(此時尚未動到 app 程式碼)。

- [ ] **Step 9: 刪掉煙霧測試並 commit**

Run:
```bash
cd /Users/charles/portfolio
rm src/test/smoke.test.ts
git add package.json package-lock.json vite.config.ts tsconfig.app.json src/test/setup.ts public/hero
git commit -m "chore: add three + vitest and stage hero runtime assets

為 hero 整合先備齊 three bundle 與殼層測試框架,並把引擎要用的 runtime 資產搬到 public/hero,讓引擎走 assetBase 取用而非相對路徑。

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 2: faceHero.ts 引擎骨架與型別

先建立對外 API 與型別,讓殼層測試可以對著穩定介面撰寫;引擎本體在 Task 3 移植。骨架要能 `tsc` 通過、能被 import、被呼叫時不爆掉(WebGL 不支援就回 no-op handle)。

**Files:**
- Create: `src/components/hero/faceHero.ts`

- [ ] **Step 1: 寫對外型別與骨架**

Create `src/components/hero/faceHero.ts`:
```ts
import * as THREE from 'three'

export type FaceHeroOptions = {
  /** 資產目錄,結尾帶斜線,例如 '/hero/' */
  assetBase: string
  /** 0..1 真實載入進度 */
  onProgress?: (p: number) => void
  /** 資產載完,Enter 可啟用 */
  onReady?: () => void
  /** intro 跑完,hero 文字可淡入 */
  onIntroComplete?: () => void
  /** 引擎邊界錯誤(WebGL 不支援、GLB 載入失敗) */
  onError?: (err: Error) => void
  /** 略過動畫 intro,直接定格在靜態肖像 */
  reducedMotion?: boolean
}

export type FaceHeroHandle = {
  /** 由 Enter 點擊呼叫(真實 user gesture → 解鎖音訊 → 跑 intro) */
  startIntro: () => void
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

  // 引擎本體在 Task 3 移植到這裡,並回傳真正的 handle。
  // 暫時用一個 renderer 探活,確認骨架可建立 context。
  void THREE
  void canvas
  return noop
}
```

- [ ] **Step 2: tsc 通過**

Run: `npx tsc -b`
Expected: 無錯誤。`noUnusedLocals`/`noUnusedParameters` 可能對 `void THREE` / `void canvas` 以外的未用項報錯,如有則修正(此骨架已用 `void` 消化)。

- [ ] **Step 3: commit**

```bash
git add src/components/hero/faceHero.ts
git commit -m "feat: scaffold faceHero engine module API

先定義 initFaceHero 的對外型別與 WebGL 探活骨架,讓 React 殼層能對著穩定介面開發與測試,引擎本體隨後移植。

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 3: 移植引擎本體到 faceHero.ts

把 `experiments/hero-clone/face-base.html` 的 `<script type="module">`(第 40 行 import 起,到第 1045 行 `requestAnimationFrame(frame)` 止)幾乎逐字搬進 `initFaceHero` 內,套用下面列出的精確轉換。這是機械式移植,正確性靠 `tsc -b` + `vite build` + 人工視覺驗證,不是邏輯 TDD。

**Files:**
- Modify: `src/components/hero/faceHero.ts`

- [ ] **Step 1: 加 import(改成 bundle 寫法)**

把 `faceHero.ts` 最上面的 import 換成:
```ts
import * as THREE from 'three'
import { GLTFLoader, type GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { SimplifyModifier } from 'three/examples/jsm/modifiers/SimplifyModifier.js'
import * as BufferGeometryUtils from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js'
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js'
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js'
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js'
```

- [ ] **Step 2: 在 `initFaceHero` 內貼上引擎內部型別定義**

在 `initFaceHero` 函式 body 開頭(WebGL 探活 return 之後)貼上:
```ts
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
    lower: Float32Array
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
```

- [ ] **Step 3: 貼上引擎本體(face-base.html 第 50–1045 行),套用以下逐項轉換**

把 sandbox `<script>` 內第 50 行(`const CONFIG = {`)到第 1045 行(`requestAnimationFrame(frame);`)整段貼進 `initFaceHero` body(接在 Step 2 的型別後面)。然後套用下面每一條轉換,缺一不可:

**3a. 資產路徑改走 assetBase。** CONFIG 內:
- `glbUrl: "./assets/male_base.glb"` → `glbUrl: assetBase + "male_base.glb"`
- `imgUrl: "./assets/charles-face.png"` → `imgUrl: assetBase + "charles-face.png"`

四個 Audio 建構子:
- `new Audio("./assets/laser-attack.mp3")` → `new Audio(assetBase + "laser-attack.mp3")`
- `new Audio("./assets/laser-fire.wav")` → `new Audio(assetBase + "laser-fire.wav")`
- `new Audio("./assets/intro_scan.mp3")` → `new Audio(assetBase + "intro_scan.mp3")`
- `new Audio("./assets/intro_baam2.mp3")` → `new Audio(assetBase + "intro_baam2.mp3")`

**3b. 移除 window 全域污染。** 刪掉這行:
```js
window.TURN = TURN; window.FOLLOW = FOLLOW; window.CONFIG = CONFIG;
```

**3c. renderer 用傳入的 canvas,不自己造 host。** 把:
```js
const host = document.getElementById("webgl");
const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
renderer.setClearColor(0x000000, 1);
host.appendChild(renderer.domElement);
```
換成:
```ts
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true })
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
renderer.setSize(window.innerWidth, window.innerHeight)
renderer.setClearColor(0x000000, 1)
```

**3d. 移除 `#dbg` 與 `#loading` DOM 依賴。**
- 刪 `const dbg = document.getElementById("dbg");`。
- 把 `Promise.all(...).catch((e) => { dbg.textContent = "ERR " + e.message; console.error(e); })` 換成:
  ```ts
  Promise.all([loadImg, loadGlb]).then(([im, gltf]) => build(im, gltf)).catch((e: unknown) => {
    const err = e instanceof Error ? e : new Error(String(e))
    console.error(err)
    opts.onError?.(err)
  })
  ```
- `build()` 內 `if (!headMesh) { dbg.textContent = "no head mesh"; return; }` → `if (!headMesh) { opts.onError?.(new Error('no head mesh')); return; }`
- `build()` 內 `dbg.textContent = \`head ${hStat.n}v ...\`;` 這行刪掉。
- `build()` 內 `document.getElementById("loading").classList.add("hidden");` → 改成在 build 收尾呼叫 ready(見 3f)。

**3e. GLB 載入進度接到 onProgress。** 把:
```js
const loadGlb = new Promise((res, rej) => new GLTFLoader().load(CONFIG.glbUrl, (g) => res(g), undefined, rej));
```
換成:
```ts
const loadGlb = new Promise<GLTF>((res, rej) =>
  new GLTFLoader().load(
    CONFIG.glbUrl,
    (g) => res(g),
    (ev) => { if (ev.total > 0) opts.onProgress?.(0.1 + 0.85 * (ev.loaded / ev.total)) },
    rej,
  ),
)
```
並把 `loadImg` 標註型別:
```ts
const loadImg = new Promise<HTMLImageElement>((res) => { const im = new Image(); im.crossOrigin = "anonymous"; im.onload = () => res(im); im.src = CONFIG.imgUrl })
```

**3f. 改成「載完 ready、Enter 才開跑」。** 把 `build()` 函式結尾這兩行:
```js
for (const L of LAYERS) { L.attr.array.fill(0); L.attr.needsUpdate = true; }  // start dark; the intro paints the reveal
startTime = performance.now();
```
換成:
```ts
for (const L of LAYERS) { (L.attr.array as Float32Array).fill(0); L.attr.needsUpdate = true }
assetsReady = true
opts.onProgress?.(1)
if (pendingStart) doStart()
opts.onReady?.()
```

**3g. 新增啟動狀態旗標。** 在 `let startTime = 0, lastFrameT = 0;` 改成:
```ts
let startTime = 0, lastFrameT = 0
let started = false
let assetsReady = false
let pendingStart = false
let rafId = 0
let pausedAt = 0
```

**3h. 移除 approach-A 暫代手法。** 整段刪除:`replayIntroWithSound()` 函式、`introUnlockOnce` 函式、以及這行:
```js
addEventListener("pointerdown", introUnlockOnce); addEventListener("touchstart", introUnlockOnce); addEventListener("keydown", introUnlockOnce);
```
同時 `beginFire` 內 `if (!introDone) return;` 保留(intro 沒跑完不開火)。

**3i. 事件監聽改具名,掛 window,供 dispose 移除。** 把這些匿名監聽:
```js
addEventListener("pointermove", (e) => { setAim(e); if (e.pointerType !== "touch") cursorActive = 1; });
addEventListener("pointerdown", (e) => { ... });
addEventListener("pointerup", stopFiring);
addEventListener("pointercancel", stopFiring);
addEventListener("pointerleave", () => stopFiring());
addEventListener("resize", syncSize);
```
改成具名函式並用 `window.addEventListener`:
```ts
const onPointerMove = (e: PointerEvent) => { setAim(e); if (e.pointerType !== 'touch') cursorActive = 1 }
const onPointerDown = (e: PointerEvent) => {
  setAim(e)
  if (e.pointerType === 'touch') { clearTimeout(holdTimer); holdTimer = window.setTimeout(beginFire, 150) }
  else beginFire()
}
const onPointerUp = (e: PointerEvent) => stopFiring(e)
const onPointerCancel = (e: PointerEvent) => stopFiring(e)
const onPointerLeave = () => stopFiring()
window.addEventListener('pointermove', onPointerMove)
window.addEventListener('pointerdown', onPointerDown)
window.addEventListener('pointerup', onPointerUp)
window.addEventListener('pointercancel', onPointerCancel)
window.addEventListener('pointerleave', onPointerLeave)
window.addEventListener('resize', syncSize)
```
其中 `stopFiring` 的簽名改成 `const stopFiring = (e?: PointerEvent) => { ... }`,`holdTimer` 宣告改 `let holdTimer = 0`(`window.setTimeout` 回傳 number)。`setAim` 簽名改 `(e: PointerEvent | { clientX: number; clientY: number })` 不需要,直接 `(e: PointerEvent)`。

**3j. 全域名稱前綴 window。** 把引擎內所有裸寫的 `innerWidth` → `window.innerWidth`、`innerHeight` → `window.innerHeight`、`devicePixelRatio` → `window.devicePixelRatio`。(`requestAnimationFrame`/`cancelAnimationFrame`/`performance`/`navigator`/`document`/`Image`/`Audio` 維持原樣。)

**3k. rAF 改成可暫停,並只在 started 後跑 intro。** 把 `function frame(now) { requestAnimationFrame(frame); ... }` 與最後的 `requestAnimationFrame(frame);` 改成:
- `frame` 簽名 `function frame(now: number)`。
- 第一行 `requestAnimationFrame(frame)` 改 `rafId = window.requestAnimationFrame(frame)`。
- 在 `const t = startTime ? (now - startTime) / 1000 : 0` 之前插入早退:
  ```ts
  if (!started) { composer.render(); return }
  ```
- 檔尾 `requestAnimationFrame(frame);` 改成 `rafId = window.requestAnimationFrame(frame)`(render loop 一開始就跑,只是 started 前只 render 黑畫面)。

**3l. updateIntro 完成時通知 onIntroComplete。** 在 `updateIntro` 內 `t >= Tend` 區塊,`introDone = true;` 之後、`return 1;` 之前插入:
```ts
opts.onIntroComplete?.()
```

**3m. 在引擎本體最後、`return` handle 之前,加入啟動/控制函式並回傳 handle。** 把檔尾(`rafId = window.requestAnimationFrame(frame)` 之後)接上:
```ts
  function doStart() {
    pendingStart = false
    if (opts.reducedMotion) {
      for (const L of LAYERS) { L.attr.array.set(L.portrait); L.attr.needsUpdate = true }
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
    startIntro: () => {
      if (started) return
      if (assetsReady) doStart()
      else pendingStart = true
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
        introScanSfx.pause(); introBaamSfx.pause(); laserAttack.pause(); laserLoop.pause()
      }
    },
    dispose: () => {
      if (rafId) { window.cancelAnimationFrame(rafId); rafId = 0 }
      window.removeEventListener('pointermove', onPointerMove)
      window.removeEventListener('pointerdown', onPointerDown)
      window.removeEventListener('pointerup', onPointerUp)
      window.removeEventListener('pointercancel', onPointerCancel)
      window.removeEventListener('pointerleave', onPointerLeave)
      window.removeEventListener('resize', syncSize)
      clearTimeout(holdTimer); clearTimeout(loopTimer); clearTimeout(baamFadeTimer)
      cancelAnimationFrame(baamFadeRAF)
      for (const a of [introScanSfx, introBaamSfx, laserAttack, laserLoop]) { a.pause(); a.src = '' }
      renderer.dispose()
    },
  }
  return handle
```

**3n. 為主要函式補型別標註(消化 strict + noImplicitAny)。** 依序把這些函式參數標註型別:
- `function warm(b: number): [number, number, number]`
- `function setupDust(ext: number)`
- `function cropBelow(geo: THREE.BufferGeometry, cropY: number)`
- `function dotTexture()` / `function squareTexture()`(回傳推斷為 `THREE.CanvasTexture`,無參數)
- `function build(im: HTMLImageElement, gltf: GLTF)`
- build 內:`const lumaAt = (x: number, y: number)`、`function decimate(geoW: THREE.BufferGeometry, targetVerts: number)`、`function buildLayers(g: THREE.BufferGeometry, o: BuildOptions)`、其餘小箭頭函式(`nxOf`、`nyOf`、`mapX`、`mapY`、`faceWeight(nx: number, ny: number)`、`contrast(b: number)`、`sstep(e0: number, e1: number, v: number)`、`earCut(nx: number)`)逐一標註 `number`。
- buildLayers 內 `const mkCol = (fn: (b: number) => number)`、`const regCol = (c: Float32Array, kind: 'fill' | 'line' | 'point')`、`const addE = (a: number, b: number)`、`const pushV = (i: number)`。
- `function paint(fn: (a: Float32Array, o: number, L: Layer, ny: number) => void)`
- `function updateIntro(t: number)`、`function sweepLine(st: number)`、`function applyState(st: number)`
- `jawRig` 宣告改 `let jawRig: JawRig | null = null`;`LAYERS` 宣告改 `const LAYERS: Layer[] = []`;`eyeWorld`、`beams`、`muzzles`、`allMats` 視 tsc 報錯補 `THREE.Vector3[]` / `THREE.Mesh[]` / `THREE.Sprite[]` / `THREE.Material[]`。
- `const dustSys: { update: (dt: number, wireAmt: number) => void } = { update: () => {} }`
- `let headWireVerts: Float32Array | null = null`

凡 tsc 仍報 implicit any 之處,就近補對應型別;不得用 `any`,真的無法表達時用 `unknown` + 收斂。

- [ ] **Step 4: tsc 通過**

Run: `npx tsc -b`
Expected: 無錯誤。逐一修掉 implicit any / 未用變數,直到全綠。

- [ ] **Step 5: eslint 通過**

Run: `npx eslint src/components/hero/faceHero.ts`
Expected: 無錯誤(必要時對單一無解的第三方型別行加註,但先嘗試正確型別)。

- [ ] **Step 6: build 通過**

Run: `npm run build`
Expected: `tsc -b` 與 `vite build` 都成功,three + addons 正確 bundle 進去,無未解析 import。

- [ ] **Step 7: commit**

```bash
git add src/components/hero/faceHero.ts
git commit -m "feat: port face-base Three.js engine into faceHero module

把 sandbox 的臉部肖像引擎搬成自包含 TS 模組,改走傳入 canvas + assetBase + callback 進度,拿掉 sandbox 的 DOM 依賴與 approach-A 音訊暫代,改由 Enter gesture 驅動 startIntro,讓 intro 永遠帶聲播放。

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 4: FaceHero.tsx 殼層 + loading/Enter 前導頁(TDD)

殼層負責 `<section>`、`<canvas>`、前導頁、hero 文字、SCROLL 提示與生命週期。測試把引擎模組整個 mock 掉,只驗殼層邏輯。

**Files:**
- Create: `src/components/hero/FaceHero.tsx`
- Test: `src/components/hero/FaceHero.test.tsx`

- [ ] **Step 1: 寫失敗測試(殼層基本行為)**

Create `src/components/hero/FaceHero.test.tsx`:
```tsx
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

const startIntro = vi.fn()
const setActive = vi.fn()
const dispose = vi.fn()
let lastOpts: import('./faceHero').FaceHeroOptions | null = null

vi.mock('./faceHero', () => ({
  initFaceHero: (_canvas: HTMLCanvasElement, opts: import('./faceHero').FaceHeroOptions) => {
    lastOpts = opts
    return { startIntro, setActive, dispose }
  },
}))

import FaceHero from './FaceHero'

beforeEach(() => {
  startIntro.mockClear(); setActive.mockClear(); dispose.mockClear(); lastOpts = null
})
afterEach(() => { vi.restoreAllMocks() })

describe('FaceHero shell', () => {
  it('always renders the hero heading in the DOM', () => {
    render(<FaceHero />)
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(/Senior Product Manager/)
  })

  it('shows loading first, then the enter control once onReady fires', () => {
    render(<FaceHero />)
    expect(screen.getByText(/loading/i)).toBeInTheDocument()
    act(() => { lastOpts?.onReady?.() })
    expect(screen.getByRole('button', { name: /enter/i })).toBeInTheDocument()
  })

  it('calls startIntro exactly once when enter is clicked', async () => {
    const user = userEvent.setup()
    render(<FaceHero />)
    act(() => { lastOpts?.onReady?.() })
    await user.click(screen.getByRole('button', { name: /enter/i }))
    expect(startIntro).toHaveBeenCalledTimes(1)
  })

  it('disposes the engine on unmount', () => {
    const { unmount } = render(<FaceHero />)
    unmount()
    expect(dispose).toHaveBeenCalledTimes(1)
  })
})
```

- [ ] **Step 2: 跑測試確認失敗**

Run: `npx vitest run src/components/hero/FaceHero.test.tsx`
Expected: FAIL(`Cannot find module './FaceHero'`)。

- [ ] **Step 3: 寫 FaceHero.tsx 最小實作**

Create `src/components/hero/FaceHero.tsx`:
```tsx
import { useEffect, useRef, useState } from 'react'
import { initFaceHero, type FaceHeroHandle } from './faceHero'

type Phase = 'loading' | 'ready' | 'running' | 'revealed'

function prefersReducedMotion(): boolean {
  return typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true
}

export default function FaceHero() {
  const sectionRef = useRef<HTMLElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const handleRef = useRef<FaceHeroHandle | null>(null)
  const [phase, setPhase] = useState<Phase>('loading')
  const [progress, setProgress] = useState(0)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const reduced = prefersReducedMotion()
    const handle = initFaceHero(canvas, {
      assetBase: '/hero/',
      reducedMotion: reduced,
      onProgress: (p) => setProgress(p),
      onReady: () => setPhase('ready'),
      onIntroComplete: () => setPhase('revealed'),
      onError: () => setFailed(true),
    })
    handleRef.current = handle
    return () => { handle.dispose(); handleRef.current = null }
  }, [])

  const onEnter = () => {
    handleRef.current?.startIntro()
    setPhase('running')
  }

  const gateVisible = phase === 'loading' || phase === 'ready'
  const heroTextVisible = phase === 'revealed' || failed

  return (
    <section
      ref={sectionRef}
      className="relative flex h-screen w-full items-center justify-center overflow-hidden supports-[height:100svh]:h-[100svh]"
      style={{ background: 'var(--color-bg-primary)' }}
    >
      <canvas ref={canvasRef} className="pointer-events-none absolute inset-0 h-full w-full" role="presentation" aria-hidden="true" />

      {failed && (
        <img
          src="/hero/charles-face.png"
          alt=""
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 m-auto h-auto max-h-[70vh] w-auto opacity-80"
        />
      )}

      <div
        className="pointer-events-none absolute inset-x-0 bottom-0 h-40"
        style={{ background: 'linear-gradient(to bottom, transparent 0%, var(--color-bg-primary) 100%)' }}
      />

      <div
        className="relative z-10 mx-auto w-full max-w-[1400px] px-6 transition-opacity duration-700 md:px-12"
        style={{ opacity: heroTextVisible ? 1 : 0 }}
      >
        <h1
          className="mx-auto max-w-[900px] text-center text-[24px] font-extralight leading-[1.4] tracking-wide sm:text-[32px] md:text-[40px] lg:text-[48px]"
          style={{ textShadow: '0 0 14px rgba(0,0,0,0.85), 0 0 28px rgba(0,0,0,0.6), 0 0 48px rgba(0,0,0,0.45)' }}
        >
          <span style={{ color: 'rgba(255,255,255,0.7)' }}>Hi, I'm </span>
          <span className="font-normal text-white">Charles.</span>
          <span style={{ color: 'rgba(255,255,255,0.7)' }}> I'm a </span>
          <span className="font-normal text-white">Senior Product Manager</span>
          <span style={{ color: 'rgba(255,255,255,0.7)' }}> building products at the speed of </span>
          <span className="font-normal text-white">AI.</span>
        </h1>
      </div>

      {phase === 'revealed' && (
        <div className="pointer-events-none absolute inset-x-0 bottom-8 flex justify-center">
          <span className="text-sm tracking-widest text-white/40" style={{ animation: 'pulse-fade 2s ease-in-out infinite' }}>SCROLL ↓</span>
        </div>
      )}

      {gateVisible && (
        <div
          className="absolute inset-0 z-20 grid place-items-center transition-opacity duration-500"
          style={{ background: 'var(--color-bg-primary)' }}
        >
          <div className="absolute left-8 top-7 text-xs tracking-[0.2em] text-white/55">CHARLES CHEN</div>
          <div className="absolute right-8 top-7 text-xs tracking-[0.2em] text-white/55">AI PRODUCT MANAGER</div>
          {phase === 'loading' ? (
            <div className="font-mono text-xs lowercase tracking-[0.3em] text-white/55">
              loading {Math.round(progress * 100)}%
            </div>
          ) : (
            <button
              type="button"
              onClick={onEnter}
              className="font-mono text-sm lowercase tracking-[0.3em] text-[var(--color-accent-cyan,#00D9FF)] transition-opacity hover:opacity-80"
            >
              [ enter ]
            </button>
          )}
        </div>
      )}
    </section>
  )
}
```

- [ ] **Step 4: 跑測試確認通過**

Run: `npx vitest run src/components/hero/FaceHero.test.tsx`
Expected: 4 個測試全綠。

- [ ] **Step 5: tsc + eslint 通過**

Run: `npx tsc -b && npx eslint src/components/hero/FaceHero.tsx`
Expected: 無錯誤。

- [ ] **Step 6: commit**

```bash
git add src/components/hero/FaceHero.tsx src/components/hero/FaceHero.test.tsx
git commit -m "feat: add FaceHero shell with loading and Enter gate

殼層先顯示 loading 真實進度,onReady 後切到 [ enter ],點擊才解鎖音訊並啟動 intro;hero 標題永遠存在 DOM(reveal 前淡出)以利 SEO 與螢幕閱讀器。

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 5: 效能暫停(離屏 + 分頁隱藏 → setActive)(TDD)

設計原則第 5 條的硬性要求:hero 離開視窗或分頁隱藏時,呼叫 `setActive(false)` 停掉 RAF 與音訊。

**Files:**
- Modify: `src/components/hero/FaceHero.tsx`
- Test: `src/components/hero/FaceHero.test.tsx`

- [ ] **Step 1: 寫失敗測試(離屏與分頁隱藏)**

在 `FaceHero.test.tsx` 末尾(最後一個 `})` 之前)的 `describe` 內補:
```tsx
  it('pauses the engine when the hero scrolls off-screen', () => {
    let ioCallback: ((entries: Array<{ isIntersecting: boolean }>) => void) | null = null
    const observe = vi.fn(); const disconnect = vi.fn()
    vi.stubGlobal('IntersectionObserver', class {
      constructor(cb: (entries: Array<{ isIntersecting: boolean }>) => void) { ioCallback = cb }
      observe = observe
      disconnect = disconnect
    })
    render(<FaceHero />)
    act(() => { ioCallback?.([{ isIntersecting: false }]) })
    expect(setActive).toHaveBeenLastCalledWith(false)
    act(() => { ioCallback?.([{ isIntersecting: true }]) })
    expect(setActive).toHaveBeenLastCalledWith(true)
  })

  it('pauses the engine when the tab is hidden', () => {
    render(<FaceHero />)
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => true })
    act(() => { document.dispatchEvent(new Event('visibilitychange')) })
    expect(setActive).toHaveBeenLastCalledWith(false)
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => false })
    act(() => { document.dispatchEvent(new Event('visibilitychange')) })
    expect(setActive).toHaveBeenLastCalledWith(true)
  })
```

- [ ] **Step 2: 跑測試確認失敗**

Run: `npx vitest run src/components/hero/FaceHero.test.tsx`
Expected: 新增兩個測試 FAIL(`setActive` 未被以預期參數呼叫)。

- [ ] **Step 3: 在 FaceHero.tsx 加離屏 + 分頁暫停**

在既有的 `initFaceHero` useEffect 之後,新增一個 useEffect:
```tsx
  useEffect(() => {
    const section = sectionRef.current
    if (!section) return
    const io = new IntersectionObserver(
      (entries) => { handleRef.current?.setActive(entries[0]?.isIntersecting ?? true) },
      { threshold: 0 },
    )
    io.observe(section)
    const onVisibility = () => { if (!document.hidden) handleRef.current?.setActive(true); else handleRef.current?.setActive(false) }
    document.addEventListener('visibilitychange', onVisibility)
    return () => { io.disconnect(); document.removeEventListener('visibilitychange', onVisibility) }
  }, [])
```

- [ ] **Step 4: 跑測試確認通過**

Run: `npx vitest run src/components/hero/FaceHero.test.tsx`
Expected: 全部 6 個測試綠。

- [ ] **Step 5: tsc + eslint**

Run: `npx tsc -b && npx eslint src/components/hero/FaceHero.tsx`
Expected: 無錯誤。

- [ ] **Step 6: commit**

```bash
git add src/components/hero/FaceHero.tsx src/components/hero/FaceHero.test.tsx
git commit -m "feat: pause hero engine off-screen and on hidden tab

對齊舊 hero 的離屏暫停並補上分頁隱藏暫停,background 分頁完全不做 render 與音訊,符合 Performance is a feature 原則。

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 6: reduced-motion 與 WebGL fallback(TDD)

`prefers-reduced-motion` 略過動畫 intro(Task 3 的 `doStart` 已處理引擎側);WebGL/GLB 失敗時殼層顯示靜態臉(Task 4 已放 `failed` img)。這個任務補殼層的 reduced-motion 與 fallback 行為測試,把先前實作鎖住。

**Files:**
- Test: `src/components/hero/FaceHero.test.tsx`

- [ ] **Step 1: 寫 reduced-motion 與 fallback 測試**

在 `describe` 內補:
```tsx
  it('passes reducedMotion to the engine when the user prefers reduced motion', () => {
    vi.stubGlobal('matchMedia', (q: string) => ({
      matches: q.includes('reduce'),
      media: q, addEventListener: vi.fn(), removeEventListener: vi.fn(),
      addListener: vi.fn(), removeListener: vi.fn(), onchange: null, dispatchEvent: vi.fn(),
    }))
    render(<FaceHero />)
    expect(lastOpts?.reducedMotion).toBe(true)
  })

  it('shows the static fallback image when the engine reports an error', () => {
    render(<FaceHero />)
    act(() => { lastOpts?.onError?.(new Error('WebGL unavailable')) })
    const img = document.querySelector('img[src="/hero/charles-face.png"]')
    expect(img).toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 1 })).toBeVisible()
  })
```

- [ ] **Step 2: 跑測試**

Run: `npx vitest run src/components/hero/FaceHero.test.tsx`
Expected: 全綠(實作在 Task 3/4 已就位;若 reducedMotion 測試因前一測試殘留的 matchMedia stub 互相影響,確認 `afterEach(vi.restoreAllMocks)` 與 `vi.unstubAllGlobals()` 有清乾淨,必要時在 afterEach 加 `vi.unstubAllGlobals()`)。

- [ ] **Step 3: 全套測試 + build**

Run: `npm test && npm run build`
Expected: 所有測試綠,build 成功。

- [ ] **Step 4: commit**

```bash
git add src/components/hero/FaceHero.test.tsx
git commit -m "test: lock reduced-motion and WebGL fallback behaviour

把 reduced-motion 略過 intro 與引擎失敗時退回靜態臉的行為用測試固定下來,避免之後回歸。

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 7: 接上 App、移除舊 hero

**Files:**
- Modify: `src/App.tsx`
- Delete: `src/components/ParticleHero.tsx`
- Delete: `src/components/BlackHoleBackdrop.tsx`
- Delete: `src/assets/charles-face.png`(若存在且只被 ParticleHero 引用)

- [ ] **Step 1: 確認舊元件的引用範圍**

Run:
```bash
cd /Users/charles/portfolio
grep -rn "ParticleHero" src
grep -rn "BlackHoleBackdrop" src
grep -rn "assets/charles-face" src
```
Expected: `ParticleHero` 僅出現在 `App.tsx` 的 import 與使用、以及自身檔案;`BlackHoleBackdrop` 僅被 `ParticleHero` 引用;`charles-face` 在 `src` 內僅 ParticleHero 取樣用。若有其他引用,先在本步驟列出並一併處理(不要留懸空 import)。

- [ ] **Step 2: 在 App.tsx 換成 FaceHero**

把 `src/App.tsx` 第 1 行:
```ts
import ParticleHero from './components/ParticleHero'
```
改成:
```ts
import FaceHero from './components/hero/FaceHero'
```
把第 16 行 `<ParticleHero />` 改成 `<FaceHero />`。

- [ ] **Step 3: 刪除舊元件**

Run:
```bash
cd /Users/charles/portfolio
git rm src/components/ParticleHero.tsx src/components/BlackHoleBackdrop.tsx
git ls-files src/assets/charles-face.png && git rm src/assets/charles-face.png || echo "no src asset to remove"
```
Expected: ParticleHero 與 BlackHoleBackdrop 被移除;若 `src/assets/charles-face.png` 存在於 git 也一併移除,否則略過。

- [ ] **Step 4: tsc + eslint + build,確認沒有懸空引用**

Run: `npx tsc -b && npx eslint . && npm run build`
Expected: 全綠。`noUnusedLocals` 會抓到任何殘留的舊 import。

- [ ] **Step 5: commit**

```bash
git add src/App.tsx
git commit -m "feat: swap portfolio hero to FaceHero and remove particle hero

首頁 hero 換成 3D 臉部肖像 + Enter 前導頁,移除舊的 Canvas2D 粒子系統、黑洞背景與 Konami 彩蛋元件。

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 8: 收尾驗證、changelog、人工視覺確認

**Files:**
- Modify: changelog 資料檔(實作時先 `grep` 定位)

- [ ] **Step 1: 全套自動關卡**

Run: `npm run build && npm test && npx eslint .`
Expected: `tsc -b`、`vite build`、Vitest、ESLint 全綠。

- [ ] **Step 2: dev server 人工視覺驗證(多狀態、多角度)**

Run: `npm run dev`,開瀏覽器逐一確認:
- loading 百分比會跑,canvas 後面是黑屏。
- `[ enter ]` 出現後點擊:scan riser 有聲、紅幕由下而上、掃到頂兩眼點亮 + braam、接著點狀肖像 sweep reveal、hero 文字從下淡上、SCROLL 出現。
- 穩態:點狀肖像 ↔ wireframe 星座週期切換,點塵剝落、頂點 twinkle、品牌色(cyan 主、mars-orange 點綴)。
- 滑鼠移動頭會微轉、游標附近 dots 轉 cyan;按住放眼睛雷射。
- 把頭轉到多個角度(左、右、上、下、正面預設)都不破面、文字不被臉蓋住(`+10%` 頭型不裁切)。
- 捲到下一段再捲回:確認離屏有停、回來有恢復(可開 devtools Performance 或在引擎暫時 `console.log` 驗證,驗完移除)。
- 手機尺寸(devtools 切 mobile):文字在臉下方、垂直滑動可捲動、按住才開火。
- 同分頁站內導覽回首頁:前導頁照 sessionStorage 行為(D1)。註:若 sessionStorage 跳過邏輯尚未在殼層實作,於此步驟補上(`sessionStorage` 旗標控制 `gateVisible` 初始狀態),並補對應測試;若 spec 的 D1 留待後續,於此明確記錄為未完成項。

不可只挑一張好看的角度截圖就宣稱完成。

- [ ] **Step 3: 補 changelog 條目**

Run:
```bash
cd /Users/charles/portfolio
grep -rln "changelog" src public 2>/dev/null | head
```
找到 changelog 資料檔後,新增一筆條目描述「首頁 hero 改為 3D 臉部肖像 + Enter 前導頁」。條目文字同樣禁用 AI 寫作慣性。若無法判斷檔案格式,先停下來問使用者再寫(遵守專案 CLAUDE.md「不確定就先問」)。

- [ ] **Step 4: 最終 commit**

```bash
git add -A
git commit -m "docs: record hero redesign in changelog

把首頁 hero 改版(3D 臉部肖像 + Enter 前導頁)列入 changelog,屬重大功能變更。

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

- [ ] **Step 5: 推上分支**

Run: `git push origin feat/hero-face-base`
Expected: 分支更新成功(沿用既有分支,不直推 main)。

---

## 自我檢查(plan 對照 spec)

- spec §3 架構/模組 API:Task 2/3 建立 `initFaceHero` 與 `FaceHeroHandle`(`startIntro`/`setActive`/`dispose`),簽名一致。✓
- spec §4 資產:Task 1 Step 2 搬 6 個檔到 `public/hero/`,排除 sandbox 未用資產。✓
- spec §5 loading + Enter 前導頁:Task 4 殼層 loading 真實進度 → `[ enter ]` → 點擊 startIntro。✓(§5 D1 sessionStorage session 行為在 Task 8 Step 2 明列為需補/記錄項,避免靜默漏掉。)
- spec §6 編排:Task 3 doStart 串 scan→紅幕→braam→sweep;Task 4 onIntroComplete→文字淡入。✓
- spec §7 版面:Task 4 沿用 h-screen、底部 scrim、原文案、SCROLL。✓
- spec §8 清理:Task 7 刪 ParticleHero/BlackHoleBackdrop、換 App、移除 src 內 charles-face。✓
- spec §9 無障礙/fallback:h1 恆在 DOM;reduced-motion(Task 3 doStart + Task 6 測試);WebGL/GLB 失敗 fallback 靜態圖(Task 4 + Task 6)。✓
- spec §10 效能:DPR cap 與 decimation 隨引擎移植保留;Task 5 補離屏 + 分頁隱藏暫停。✓ mobile budget 的實機下修留待視覺驗證階段(Task 8)按實機調,符合 spec「實作時對著實機調」。
- spec §11 測試:Task 1 建 Vitest;Task 4/5/6 覆蓋殼層四類行為;`tsc -b`/`eslint`/`vite build` 為自動關卡。✓
- 型別一致性:`FaceHeroOptions`/`FaceHeroHandle`/`Layer`/`BuildOptions`/`JawRig` 全程同名;handle 方法名 `startIntro`/`setActive`/`dispose` 在引擎、殼層、測試三處一致。✓
