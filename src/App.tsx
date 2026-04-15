import ParticleHero from './components/ParticleHero'
import AboutFirefly from './components/AboutFirefly'
import UniverseSection from './components/UniverseSection'
import ExperienceTimeline from './components/ExperienceTimeline'
import ProjectCards from './components/ProjectCards'
import BlogEntries from './components/BlogEntries'
import ContactFooter from './components/ContactFooter'

export default function App() {
  return (
    <>
      <a href="#about" className="skip-link">Skip to content</a>
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
