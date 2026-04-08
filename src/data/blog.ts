export interface BlogPlatform {
  name: 'Medium' | 'Substack'
  url: string
  subtitle: string
}

export const blogPlatforms: BlogPlatform[] = [
  {
    name: 'Medium',
    url: 'https://medium.com/@charleschen',
    subtitle: 'Technical articles and product insights',
  },
  {
    name: 'Substack',
    url: 'https://substack.com/@charlestychen',
    subtitle: 'Deep dives and long-form thinking',
  },
]
