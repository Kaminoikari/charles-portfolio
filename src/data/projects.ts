export interface Project {
  id: string
  title: string
  description: string
  ctaText: string
  ctaUrl: string
  tags: string[]
}

export const projects: Project[] = [
  {
    id: 'path',
    title: 'Path',
    description:
      'Offline-first trip planning app with Google Maps integration, transit directions, cost tracking, and drag-and-drop itinerary management.',
    ctaText: 'TRY IT',
    ctaUrl: 'https://trip-path.vercel.app/',
    tags: ['React', 'TypeScript', 'Supabase'],
  },
  {
    id: 'plutus-trade',
    title: 'Plutus Trade',
    description: 'AI-powered Taiwan stock selection platform with real-time quotes, K-line charts, Gemini AI diagnostics, one-tap stock screening, and prediction tracking system.',
    ctaText: 'TRY IT',
    ctaUrl: 'https://plutustrade.vercel.app/',
    tags: ['Flutter', 'FastAPI', 'Gemini AI'],
  },
  {
    id: 'product-playbook',
    title: 'Product Playbook',
    description:
      'AI-powered product planning system with 22 frameworks, 6 execution modes, and automated dev handoff — from concept to spec in minutes.',
    ctaText: 'EXPLORE',
    ctaUrl: 'https://github.com/Kaminoikari/product-playbook',
    tags: ['Claude Code Skill', 'AI/LLM', 'Product'],
  },
]
