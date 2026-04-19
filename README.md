# charles-chen.com

Personal portfolio site for Charles Chen — product-minded engineer with a focus on interactive visualizations and thoughtful design.

**Live:** [charles-chen.com](https://charles-chen.com)

## Tech Stack

- **React 19** + **TypeScript** — UI framework
- **Vite** — build tooling with code-splitting via `React.lazy()`
- **Tailwind CSS 4** — styling with `@theme` design tokens
- **Canvas 2D** — interactive animations for hero, skills sphere, project cards
- **React Router** — SPA routing (`/`, `/changelog`)
- **Vercel Analytics** — web analytics
- **Vercel** — hosting with SPA fallback

## Sections

| Section | Description |
|---------|-------------|
| **ParticleHero** | Ring-based particle system with click ripple effects |
| **About** | Profile photo with achievement annotations, neural network background animation |
| **Universe** | 3D Fibonacci sphere with scroll-driven skill labels |
| **Experience** | Timeline with staggered reveal animations |
| **Project Cards** | Canvas-animated cards — Path (route tracer), Plutus Trade (K-line ticker), Product Playbook (spec assembly) |
| **Blog** | Platform links to external posts |
| **Contact** | Social links with gradient footer |
| **Changelog** | Linear-inspired changelog with tag filtering (`/changelog`) |

## Features

- Scroll-triggered animations via `IntersectionObserver`
- Mobile auto-play for canvas animations (`hover: none` detection)
- `prefers-reduced-motion` support — all animations disabled
- View Transitions API for smooth navigation
- Easter egg: rapid-click logo for particle photo reveal

## Development

```bash
npm install
npm run dev       # local dev server
npm run build     # type-check + production build
npm run preview   # preview production build
```

## Project Structure

```
src/
├── components/          # React components
│   └── animations/      # Canvas animation modules (path, plutus, playbook)
├── data/                # Static data (projects, experience, skills, changelog)
├── App.tsx              # Home page layout
├── main.tsx             # Router + analytics entry point
└── index.css            # Tailwind + design tokens
```

## Deployment

Deployed on Vercel. SPA fallback configured in `vercel.json` to handle client-side routing.
