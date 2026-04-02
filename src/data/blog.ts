export interface BlogPlatform {
  name: 'Medium' | 'Substack'
  url: string
  subtitle: string
}

export const blogPlatforms: BlogPlatform[] = [
  {
    name: 'Medium',
    url: 'https://medium.com/',
    subtitle: '技術文章和觀點分享',
  },
  {
    name: 'Substack',
    url: 'https://substack.com/',
    subtitle: '深度思考和長文',
  },
]
