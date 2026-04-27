import ParticleHero from './components/ParticleHero'
import AboutFirefly from './components/AboutFirefly'
import UniverseSection from './components/UniverseSection'
import ExperienceTimeline from './components/ExperienceTimeline'
import ProjectCards from './components/ProjectCards'
import BlogEntries from './components/BlogEntries'
import ContactFooter from './components/ContactFooter'
import { useDocumentMeta, useT } from './i18n'

export default function App() {
  const t = useT()
  useDocumentMeta({ path: '/' })
  return (
    <>
      <a href="#about" className="skip-link">{t('home.skipLink')}</a>
      <ParticleHero />
      <AboutFirefly />
      <UniverseSection />
      <ExperienceTimeline />
      <ProjectCards />
      <BlogEntries />
      <ContactFooter />
    </>
  )
}
