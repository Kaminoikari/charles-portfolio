import { useEffect, lazy, Suspense } from 'react'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import Nav from './components/Nav'
import ScrollProgress from './components/ScrollProgress'

const ParticleHero = lazy(() => import('./components/ParticleHero'))
const AboutFirefly = lazy(() => import('./components/AboutFirefly'))
const UniverseSection = lazy(() => import('./components/UniverseSection'))
const ExperienceTimeline = lazy(() => import('./components/ExperienceTimeline'))
const ProjectCards = lazy(() => import('./components/ProjectCards'))
const BlogEntries = lazy(() => import('./components/BlogEntries'))
const ContactFooter = lazy(() => import('./components/ContactFooter'))

gsap.registerPlugin(ScrollTrigger)

function Loading() {
  return <div className="flex h-screen items-center justify-center bg-bg-primary" />
}

export default function App() {
  useEffect(() => {
    const id = setTimeout(() => ScrollTrigger.refresh(), 100)
    return () => clearTimeout(id)
  }, [])

  return (
    <>
      <Nav />
      <ScrollProgress />
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
