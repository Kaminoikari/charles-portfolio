import { lazy, Suspense } from 'react'

const ParticleHero = lazy(() => import('./components/ParticleHero'))
const AboutFirefly = lazy(() => import('./components/AboutFirefly'))
const UniverseSection = lazy(() => import('./components/UniverseSection'))
const ExperienceTimeline = lazy(() => import('./components/ExperienceTimeline'))
const ProjectCards = lazy(() => import('./components/ProjectCards'))
const BlogEntries = lazy(() => import('./components/BlogEntries'))
const ContactFooter = lazy(() => import('./components/ContactFooter'))

function Loading() {
  return <div className="flex h-screen items-center justify-center bg-bg-primary" />
}

export default function App() {
  return (
    <>
      <a href="#about" className="skip-link">Skip to content</a>
      <Suspense fallback={<Loading />}>
        <ParticleHero />
      </Suspense>
      <Suspense fallback={<Loading />}>
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
