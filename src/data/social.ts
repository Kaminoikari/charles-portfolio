export interface SocialLink {
  platform: 'github' | 'linkedin' | 'medium' | 'substack' | 'threads'
  url: string
  label: string
}

export const socialLinks: SocialLink[] = [
  { platform: 'linkedin', url: 'https://www.linkedin.com/in/charles-chen-809a2043', label: 'LI' },
  { platform: 'github', url: 'https://github.com/Kaminoikari', label: 'GH' },
  { platform: 'threads', url: 'https://www.threads.com/@charles_tychen', label: 'TH' },
]
