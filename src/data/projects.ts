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
      '自製 TypeScript 視覺小說引擎，支援 KAG script、Canvas 渲染、分支劇情系統。',
    ctaText: 'PLAY NOW',
    ctaUrl: '#',
    tags: ['TypeScript', 'Canvas', 'Vite'],
  },
  {
    id: 'plutus-trade',
    title: 'Plutus Trade',
    description: '交易平台，整合即時行情、策略回測和自動化交易功能。',
    ctaText: 'BUILD NOW',
    ctaUrl: '#',
    tags: ['React', 'Node.js', 'WebSocket'],
  },
  {
    id: 'project-three',
    title: 'Project Three',
    description: '第三個 side project，展示技術能力和創造力。',
    ctaText: 'EXPLORE',
    ctaUrl: '#',
    tags: ['Python', 'AI/LLM'],
  },
]
