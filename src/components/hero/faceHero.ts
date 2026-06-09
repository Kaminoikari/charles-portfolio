import * as THREE from 'three'

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

  // 引擎本體在後續任務移植到這裡，並回傳真正的 handle。
  void THREE
  void canvas
  return noop
}
