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
    id: 'galgame-engine',
    title: 'Galgame Engine',
    description:
      'Custom TypeScript visual novel engine with KAG script support, Canvas rendering, and branching storyline system.',
    ctaText: 'PLAY NOW',
    ctaUrl: '#',
    tags: ['TypeScript', 'Canvas', 'Vite'],
  },
  {
    id: 'plutus-trade',
    title: 'Plutus Trade',
    description: 'Trading platform with real-time market data, strategy backtesting, and automated trading.',
    ctaText: 'BUILD NOW',
    ctaUrl: '#',
    tags: ['React', 'Node.js', 'WebSocket'],
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
