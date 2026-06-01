// Career photos are language-independent, so they live here keyed by the
// (English) organization name used across experience.{en,zh-TW,ja}.ts rather
// than being duplicated into each locale file.
//
// Each company maps to an ARRAY of photos:
//   - 0 photos  -> CareerGallery shows one on-brand placeholder frame
//   - 1 photo   -> a single cinematic frame
//   - 2+ photos -> a horizontal, drag/scroll film rail (snap + progress bar)
//
// Click any photo to open the full-screen lightbox.
//
// To add photos: drop landscape (≈4:3) images into public/assets/career/ and
// list them here. `pos` is an optional object-position (defaults to
// 'center 30%') to protect faces when a tall/portrait group photo is cropped
// into the 4:3 frame. Reorder simply by reordering the array.

export interface CareerPhoto {
  /** Path under /public, e.g. '/assets/career/uspace-1.jpg'. */
  src: string
  /** Short alt text / lightbox caption. */
  alt: string
  /** Optional object-position for the 4:3 crop, e.g. 'center 35%'. */
  pos?: string
}

export const careerPhotos: Record<string, CareerPhoto[]> = {
  'USPACE Tech Co., Ltd.': [
    { src: '/assets/career/uspace-1.jpg', alt: 'The team at the USPACE storefront', pos: 'center 30%' },
    { src: '/assets/career/uspace-5.jpg', alt: 'Company all-hands in Japan' },
    { src: '/assets/career/uspace-4.jpg', alt: 'At the office — WE ARE WHERE YOU GO' },
    { src: '/assets/career/uspace-3.jpg', alt: 'The team at the office', pos: 'center 32%' },
    { src: '/assets/career/uspace-6.jpg', alt: 'Company offsite in Japan' },
    { src: '/assets/career/uspace-2.jpg', alt: 'WE ARE WHERE YOU GO — at the office', pos: 'center 25%' },
  ],
  'XChange School': [],
  'NUEIP Technology Co., Ltd.': [],
  'PXPay Plus Co., Ltd.': [],
  'FLUX Technology Inc.': [],
}

export function careerPhotosFor(organization: string): CareerPhoto[] {
  return careerPhotos[organization] ?? []
}
