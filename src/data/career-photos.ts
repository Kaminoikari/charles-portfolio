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
// To add photos: run scripts/optimize-career-photos.sh <prefix> <image...> to
// produce the two-tier WebP set, then paste the line it prints (src/full/w/h)
// here and fill in `alt`. The rail is a height-driven film strip, so photos of
// any orientation sit side by side at their natural aspect ratio (no cropping).
// Reorder simply by reordering the array.

export interface CareerPhoto {
  /** Lightweight rail thumbnail under /public, e.g. '/assets/career/uspace-1.webp'. */
  src: string
  /** High-resolution variant for the full-screen lightbox; falls back to `src`. */
  full?: string
  /** Natural pixel size of the rail thumbnail (`src`). The film-strip rail is
   *  height-driven, so this fixes each frame's width via its aspect ratio and
   *  prevents layout shift before the (lazy) image decodes. */
  w: number
  h: number
  /** Short alt text / lightbox caption. */
  alt: string
  /** Optional object-position to bias the slight hover/reveal overscan. */
  pos?: string
}

export const careerPhotos: Record<string, CareerPhoto[]> = {
  'USPACE Tech Co., Ltd.': [
    { src: '/assets/career/uspace-1.webp', full: '/assets/career/uspace-1-full.webp', w: 800, h: 1200, alt: 'The team at the USPACE storefront', pos: 'center 30%' },
    { src: '/assets/career/uspace-2.webp', full: '/assets/career/uspace-2-full.webp', w: 900, h: 1200, alt: 'WE ARE WHERE YOU GO, at the office', pos: 'center 25%' },
    { src: '/assets/career/uspace-3.webp', full: '/assets/career/uspace-3-full.webp', w: 800, h: 1200, alt: 'The team at the office', pos: 'center 32%' },
    { src: '/assets/career/uspace-4.webp', full: '/assets/career/uspace-4-full.webp', w: 1200, h: 900, alt: 'At the office: WE ARE WHERE YOU GO' },
    { src: '/assets/career/uspace-5.webp', full: '/assets/career/uspace-5-full.webp', w: 1200, h: 800, alt: 'Company all-hands in Japan' },
    { src: '/assets/career/uspace-6.webp', full: '/assets/career/uspace-6-full.webp', w: 1200, h: 900, alt: 'Company offsite in Japan' },
  ],
  'XChange School': [
    { src: '/assets/career/xchange-1.webp', full: '/assets/career/xchange-1-full.webp', w: 1200, h: 900, alt: 'Speaking at the 2024 PM World Cafe' },
    { src: '/assets/career/xchange-2.webp', full: '/assets/career/xchange-2-full.webp', w: 1200, h: 900, alt: 'Introducing the mentor track to aspiring PMs' },
    { src: '/assets/career/xchange-3.webp', full: '/assets/career/xchange-3-full.webp', w: 1200, h: 947, alt: 'Team dinner with the mentee cohort' },
    { src: '/assets/career/xchange-4.webp', full: '/assets/career/xchange-4-full.webp', w: 1200, h: 912, alt: 'Group photo with the PM cohort' },
    { src: '/assets/career/xchange-5.webp', full: '/assets/career/xchange-5-full.webp', w: 1200, h: 900, alt: 'The mentoring cohort after a session' },
  ],
  'NUEIP Technology Co., Ltd.': [
    { src: '/assets/career/nueip-1.webp', full: '/assets/career/nueip-1-full.webp', w: 1200, h: 675, alt: 'Product team welcome lunch at NUEIP' },
  ],
  'PXPay Plus Co., Ltd.': [
    { src: '/assets/career/pxpay-1.webp', full: '/assets/career/pxpay-1-full.webp', w: 691, h: 1200, alt: 'With the DAWHO mascot at an expo booth' },
    { src: '/assets/career/pxpay-2.webp', full: '/assets/career/pxpay-2-full.webp', w: 823, h: 1200, alt: 'PM team dinner' },
    { src: '/assets/career/pxpay-3.webp', full: '/assets/career/pxpay-3-full.webp', w: 1200, h: 1193, alt: 'Team night out at a yakiniku spot' },
    { src: '/assets/career/pxpay-4.webp', full: '/assets/career/pxpay-4-full.webp', w: 811, h: 1200, alt: 'Celebrating at the company year-end party' },
    { src: '/assets/career/pxpay-5.webp', full: '/assets/career/pxpay-5-full.webp', w: 1200, h: 1161, alt: 'Company-wide group photo at an offsite' },
  ],
  'FLUX Technology Inc.': [
    { src: '/assets/career/flux-1.webp', full: '/assets/career/flux-1-full.webp', w: 1080, h: 1080, alt: 'A toast at the company party' },
    { src: '/assets/career/flux-2.webp', full: '/assets/career/flux-2-full.webp', w: 1200, h: 899, alt: 'Team dinner' },
    { src: '/assets/career/flux-3.webp', full: '/assets/career/flux-3-full.webp', w: 1080, h: 810, alt: 'Team gathering at the office' },
    { src: '/assets/career/flux-4.webp', full: '/assets/career/flux-4-full.webp', w: 1026, h: 693, alt: 'Team night out' },
    { src: '/assets/career/flux-5.webp', full: '/assets/career/flux-5-full.webp', w: 1200, h: 900, alt: 'Team building outing in camo gear' },
  ],
}

export function careerPhotosFor(organization: string): CareerPhoto[] {
  return careerPhotos[organization] ?? []
}
