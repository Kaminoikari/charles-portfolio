export interface SocialLink {
  platform: 'github' | 'linkedin' | 'twitter' | 'medium' | 'substack'
  url: string
  label: string
}

export const socialLinks: SocialLink[] = [
  { platform: 'github', url: 'https://github.com/', label: 'GH' },
  { platform: 'linkedin', url: 'https://linkedin.com/in/', label: 'LI' },
  { platform: 'twitter', url: 'https://x.com/', label: 'X' },
  { platform: 'medium', url: 'https://medium.com/', label: 'MD' },
]
