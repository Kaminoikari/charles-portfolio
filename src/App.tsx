import { lazy, Suspense } from 'react'

const ParticleHero = lazy(() => import('./components/ParticleHero'))
const AboutFirefly = lazy(() => import('./components/AboutFirefly'))
const UniverseSection = lazy(() => import('./components/UniverseSection'))
const ExperienceTimeline = lazy(() => import('./components/ExperienceTimeline'))
const ProjectCards = lazy(() => import('./components/ProjectCards'))
const BlogEntries = lazy(() => import('./components/BlogEntries'))
const ContactFooter = lazy(() => import('./components/ContactFooter'))

export default function App() {
  return (
    <>
      <a href="#about" className="skip-link">Skip to content</a>
      <Suspense fallback={<div className="min-h-screen bg-bg-primary" />}>
        <ParticleHero />
        <AboutFirefly />
        <UniverseSection />
        <ExperienceTimeline />
        <ProjectCards />
        <BlogEntries />
        <ContactFooter />
      </Suspense>
    </>
  )
}
