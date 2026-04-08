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
    ctaUrl: 'https://plutus-trade.fly.dev/',
    tags: ['Flutter', 'FastAPI', 'Gemini AI'],
  },
  {
    id: 'project-three',
    title: 'Project Three',
    description: 'Experimental side project showcasing technical skills and creative problem-solving.',
    ctaText: 'EXPLORE',
    ctaUrl: '#',
    tags: ['Python', 'AI/LLM'],
  },
]
