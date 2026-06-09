# Hero 整合 — 設計 Spec

日期:2026-06-09
分支:`feat/hero-face-base`
狀態:設計階段,待實作計畫

## 1. 目標

把目前的 portfolio hero(Canvas2D 粒子系統 + 黑洞背景 + Konami 彩蛋)換成 `experiments/hero-clone/face-base.html` 裡那套 Three.js 臉部肖像。新 hero 是 Charles 的照片烤成 halftone 點陣肖像,會週期性在「點狀態」與「打光 wireframe 星座」之間 sweep 切換,前面再加一個 loading + Enter 前導頁,讓帶聲音的電影感 intro 能播放。

## 2. 範圍

- **完全取代**現有 hero 視覺引擎。舊的粒子/黑洞/Konami 程式碼是移除,不是擴充。
- 原始 hero 已保存在 `fallback/original-hero` 分支(已建立並推上去),隨時可還原。
- 臉的視覺本身(halftone bake、sweep、點塵剝落、星座頂點、俐落掃描、intro 紅幕 + 眼睛點亮 + braam、按住發射雷射)已經在 sandbox 做好並調過;這次的工作是把它搬進 React app、加上 loading/Enter 前導頁、並把 hero 文字排在它周圍。

**不在這次範圍**:hero 文案的 i18n(維持現有英文那句)、yutaabe 那個獨立的 SHIFT/warp 模式、音訊靜音開關。

## 3. 架構(方案 C — 抽出模組、bundle three、薄 React 殼)

把獨立的 Three.js 模組抽成一個自包含引擎、對外只開一個小 API,由一個薄 React 元件負責 DOM、版面、前導頁與生命週期。

```
src/components/hero/
  faceHero.ts     // 移植過來的 Three.js 引擎(scene、GLB 載入、halftone+wireframe、
                  // sweep + 點塵 + 星座、intro、雷射、音訊)。不含 React。
  FaceHero.tsx    // React 殼:<section>、<canvas>、loading + Enter 前導頁、hero 文字、
                  // SCROLL 提示。負責 mount/unmount、Enter → startIntro、reduced-motion、離屏暫停。
```

`three` 以 bundle 方式加進 npm 依賴,版本鎖 `0.183.0`(sandbox 用的版本)。import 從 CDN importmap 改成 bundle 寫法:`import * as THREE from 'three'`,addons 從 `three/examples/jsm/...` 引入(GLTFLoader、SimplifyModifier、BufferGeometryUtils、EffectComposer、RenderPass、UnrealBloomPass、OutputPass)。型別:優先用 three 自帶型別;若鎖定版本下無法解析,就加對應版本的 `@types/three`(實作時確認)。

抽出後,`faceHero.ts` 是引擎的正式來源。`experiments/hero-clone/face-base.html` 留作參考/開發 sandbox,但不再是部署的程式碼,兩者之後可能會分歧。

### 模組 API

```ts
type FaceHeroOptions = {
  assetBase: string                 // 例如 '/hero/'
  onProgress?: (p: number) => void  // 0..1 真實載入進度(GLB + 貼圖 + 音訊)
  onReady?: () => void              // 資產載完,Enter 可啟用
  onIntroComplete?: () => void      // intro 跑完,hero 文字可淡入
  reducedMotion?: boolean           // 略過動畫 intro
}
type FaceHeroHandle = {
  startIntro: () => void                // 由 Enter 點擊呼叫(真實 user gesture → 解鎖音訊)
  setActive: (active: boolean) => void  // 暫停/恢復 RAF render loop(離屏 / 分頁隱藏)
  dispose: () => void                   // 拆掉 renderer、listeners、RAF、音訊
}
function initFaceHero(canvas: HTMLCanvasElement, opts: FaceHeroOptions): FaceHeroHandle
```

引擎不再於載入時自動播 intro,也不再需要 sandbox 那套 approach-A「首次互動重播」的暫代手法——Enter 前導頁已保證 gesture。`startIntro()` 跑「紅幕 → 眼睛點亮 → braam → sweep reveal」序列,接著進入穩態 sweep 循環。

## 4. 資產

把引擎實際用到的六個 runtime 資產搬到 `public/hero/`(服務於 `/hero/...`):

- `male_base.glb`
- `charles-face.png`
- `intro_scan.mp3`、`intro_baam2.mp3`
- `laser-attack.mp3`、`laser-fire.wav`

引擎透過 `opts.assetBase` 組路徑。sandbox 沒用到的資產(`cat.glb`、`dog*.glb`、`intro_baam.mp3`、`laser-fire.mp3`)不搬。註記:`laser-fire.wav` 約 1.5MB,為了無縫 loop 維持 WAV,日後若在意 bundle 體積再處理。

## 5. Loading + Enter 前導頁

由 `FaceHero.tsx` 渲染的全屏暗色 overlay,用站本身的品牌語言(不是任何參考站的 clone):SF Mono、暗底、cyan 為主、mars-orange 點綴。

- **Loading**:小寫 `loading` 配一個由 `onProgress` 驅動的真實百分比計數(GLB + 貼圖 + 音訊)。canvas 在後面待命/黑屏。
- **Enter**:`onReady` 觸發(100%)後,標籤換成方括號小寫 `[ enter ]` 控制項;Charles 的名字/handle 放角落。
- **點擊 `[ enter ]`**(user gesture):解鎖音訊、呼叫 `handle.startIntro()`、前導頁淡出。

這是 sandbox approach-A 音訊暫代手法的正式取代方案。

### Session 行為(D1)

前導頁每個瀏覽器分頁 session 出現一次(`sessionStorage` 旗標)。首次進首頁 → 前導頁 + 完整帶聲 intro。同 session 內用站內導覽回到首頁 → 跳過前導頁,直接顯示已 reveal 的 hero(不強制靜音重播)。

### 不做靜音開關(D2)

v1 不附音訊靜音 toggle。按 Enter 即代表同意有聲。

## 6. 編排(data flow)

```
進入 / → FaceHero mount → initFaceHero(canvas) 開始載資產,前導頁顯示 "loading %"
onReady (100%)    → 前導頁顯示 "[ enter ]"
點擊 [ enter ]    → 解鎖音訊 + startIntro() + 前導頁淡出
  intro:scan riser + 紅幕上升 → 眼睛點亮 + braam → 點狀肖像 sweep reveal
onIntroComplete   → hero <h1> 從下方淡上 → SCROLL 提示出現
穩態              → 週期 sweep:點狀肖像 ↔ wireframe 星座(點塵場、頂點 twinkle),
                    游標按住發射眼睛雷射
```

## 7. 版面

- 滿幅臉部 canvas 填滿 hero `<section>`(`h-screen`,跟現有 hero 一樣)。
- hero 文字疊在下三分之一、上面加底部漸層 scrim 確保可讀;維持現有文案:「Hi, I'm Charles. I'm a Senior Product Manager building products at the speed of AI.」(保留在 React tree 裡,reveal 前淡出)。
- SCROLL 提示釘在底部置中,最後出現。
- 頭部可能要比正中央再高一點,讓眼睛不被文字蓋到;實作時微調。
- 手機:文字堆在臉下方;已做好的按住發射觸控行為延用,垂直滑動仍可捲動。

## 8. 清理

- 刪 `src/components/ParticleHero.tsx`(含粒子系統、照片取樣、Konami 彩蛋,以及內嵌的 `EasterEggHint`)。
- 刪 `src/components/BlackHoleBackdrop.tsx`(只被 `ParticleHero` 使用)。
- `src/App.tsx`:`<ParticleHero />` 換成 `<FaceHero />`。
- `src` 裡的 `charles-face.png` 只被 `ParticleHero` 用;移除後由 `public/hero/` 那份供引擎使用。
- changelog 資料檔裡有用名字提到這些,屬歷史文字紀錄,保留不動。

## 9. 無障礙、錯誤處理、fallback

- hero `<h1>` 文字始終存在於 DOM(reveal 前視覺上淡出),讓爬蟲與螢幕閱讀器無論前導頁/intro 狀態都讀得到標題。
- `prefers-reduced-motion`(D3):完全略過動畫 intro——直接顯示靜態臉 + 文字。前導頁仍出現,但 Enter 立即解析到定格狀態。
- WebGL 不支援或 GLB 載入失敗:fallback 成靜態 `charles-face.png` + hero 文字,讓頁面永不整個掛掉。錯誤處理集中在引擎邊界(GLTFLoader reject 路徑與 WebGL context 檢查)。
- `dispose()` 在 unmount 時必須完整拆掉 renderer、RAF loop、event listeners 與音訊,避免 SPA 導覽時記憶體洩漏。

## 10. 效能

設計原則第 5 條(「Performance is a feature — Canvas pauses off-screen」)是硬性要求。舊的 `ParticleHero` 有做離屏暫停,新引擎也必須做。

引擎已有(延用):

- init 與 resize 都做 `renderer.setPixelRatio(Math.min(devicePixelRatio, 2))`——壓住片元成本(bloom 是全螢幕 pass,成本隨 DPR² 增長)。
- 幾何經 `SimplifyModifier` decimation(頭 ~2200 頂點、眼 ~360)。
- halftone 肖像走 GPU shader;frame delta 有 clamp。

這次要補的:

- **離屏暫停**:React 殼在 hero `<section>` 掛 `IntersectionObserver`,離開視窗時呼叫 `handle.setActive(false)`(取消 RAF loop + 暫停音訊),回到視窗時 `setActive(true)` 恢復。對齊舊 hero 的做法。
- **分頁隱藏暫停**:`visibilitychange` → `setActive(!document.hidden)`,讓背景分頁完全不做事。
- **mobile budget**:每幀 CPU 成本(`applyState` 逐頂點重算顏色 + ~560 顆點塵迴圈)是主要負載。在 coarse-pointer / 小螢幕裝置上往下降:減少點塵數、降低 bloom 強度(必要時降 DPR 上限)。確切門檻在實作時對著實機調。

已知成本、這次不優化:`applyState` 每幀在 CPU 重算所有頭部頂點顏色(sweep lerp)。目前 frame rate 可接受;把點狀↔wireframe 的 lerp 完全搬進 shader 是較大的重構,列為未來工作而非這次的阻礙。

## 11. 測試

專案目前沒有 React 測試框架(只有 RAG 用 `tsx --test`)。自動化關卡:

- `tsc -b` 型別檢查通過(strict;模組對外 API 不得用 `any`)。
- `eslint .` 通過。
- `vite build` 成功(確認 three + addons 正確 bundle)。

加一套最小的 `vitest` + `@testing-library/react`,把引擎模組 mock 掉來測殼層邏輯:

- FaceHero 有 render;前導頁前後 hero `<h1>` 文字都在 DOM。
- `onReady` 時 loading→enter 切換。
- 點擊 `[ enter ]` 恰好呼叫 `startIntro` 一次並解鎖音訊。
- `prefers-reduced-motion` 路徑略過 intro。

視覺驗證仍靠 dev server 人工確認(重 WebGL canvas 的 headless 截圖不可靠)。要驗多個狀態(loading、enter、intro、點狀肖像、wireframe)與真實預設,不能只挑一張好看的。

## 12. 風險 / 註記

- 對已調好的視覺,regression 風險低,因為引擎邏輯是近乎逐字移植到模組邊界後,而非重寫。
- React 下的 WebGL context 生命週期(dev 的 StrictMode 會 double-mount)必須由 `dispose()` + 有防護的 init 處理。
- `three` 會明顯增加 bundle 體積;對旗艦 hero 可接受,在 `vite build` 時監控。
