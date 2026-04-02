export interface Skill {
  name: string
  color: 'white' | 'cyan' | 'gray'
}

export const skills: Skill[] = [
  { name: 'React', color: 'cyan' },
  { name: 'TypeScript', color: 'white' },
  { name: 'Three.js', color: 'cyan' },
  { name: 'Node.js', color: 'white' },
  { name: 'Python', color: 'gray' },
  { name: 'Canvas API', color: 'cyan' },
  { name: 'WebGL', color: 'white' },
  { name: 'GSAP', color: 'gray' },
  { name: 'AI/LLM', color: 'white' },
  { name: 'Vite', color: 'cyan' },
]
