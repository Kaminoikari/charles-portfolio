// Locale-aware data hooks. Components that need translatable content (project
// case studies, changelog entries, experience timeline, blog metadata, skill
// labels) call these hooks instead of importing data files directly. Each
// hook returns the dataset for the current locale, falling back to English
// if the locale-specific file is missing entries.
//
// Each per-locale data file declares its own (structurally identical) types,
// but only the EN file's types are re-exported here so the rest of the app
// has a single canonical reference.
import { useLocale } from '../i18n'
import type { Locale } from '../i18n'

import {
  projects as projectsEn,
  projectDetails as projectDetailsEn,
  type Project,
  type ProjectDetail,
} from './projects.en'
import { projects as projectsZhTW, projectDetails as projectDetailsZhTW } from './projects.zh-TW'
import { projects as projectsJa, projectDetails as projectDetailsJa } from './projects.ja'

import { changelog as changelogEn, type ChangelogEntry, type ChangelogTag } from './changelog.en'
import { changelog as changelogZhTW } from './changelog.zh-TW'
import { changelog as changelogJa } from './changelog.ja'

import { experience as experienceEn, type ExperienceItem } from './experience.en'
import { experience as experienceZhTW } from './experience.zh-TW'
import { experience as experienceJa } from './experience.ja'

import { blogArticles as blogEn, platformLinks as platformLinksEn, type BlogArticle } from './blog.en'
import { blogArticles as blogZhTW } from './blog.zh-TW'
import { blogArticles as blogJa } from './blog.ja'

// Locale-independent — these are external profile URLs.
export const platformLinks = platformLinksEn

import { skills as skillsEn, type Skill } from './skills.en'
import { skills as skillsZhTW } from './skills.zh-TW'
import { skills as skillsJa } from './skills.ja'

const PROJECTS: Record<Locale, Project[]> = {
  'en': projectsEn,
  'zh-TW': projectsZhTW,
  'ja': projectsJa,
}

const PROJECT_DETAILS: Record<Locale, ProjectDetail[]> = {
  'en': projectDetailsEn,
  'zh-TW': projectDetailsZhTW,
  'ja': projectDetailsJa,
}

const CHANGELOG: Record<Locale, ChangelogEntry[]> = {
  'en': changelogEn,
  'zh-TW': changelogZhTW,
  'ja': changelogJa,
}

const EXPERIENCE: Record<Locale, ExperienceItem[]> = {
  'en': experienceEn,
  'zh-TW': experienceZhTW,
  'ja': experienceJa,
}

const BLOG: Record<Locale, BlogArticle[]> = {
  'en': blogEn,
  'zh-TW': blogZhTW,
  'ja': blogJa,
}

const SKILLS: Record<Locale, Skill[]> = {
  'en': skillsEn,
  'zh-TW': skillsZhTW,
  'ja': skillsJa,
}

export function useProjects(): Project[] {
  const { locale } = useLocale()
  return PROJECTS[locale] ?? PROJECTS['en']
}

export function useProjectDetails(): ProjectDetail[] {
  const { locale } = useLocale()
  return PROJECT_DETAILS[locale] ?? PROJECT_DETAILS['en']
}

export function useChangelog(): ChangelogEntry[] {
  const { locale } = useLocale()
  return CHANGELOG[locale] ?? CHANGELOG['en']
}

export function useExperience(): ExperienceItem[] {
  const { locale } = useLocale()
  return EXPERIENCE[locale] ?? EXPERIENCE['en']
}

export function useBlogArticles(): BlogArticle[] {
  const { locale } = useLocale()
  return BLOG[locale] ?? BLOG['en']
}

export function useSkills(): Skill[] {
  const { locale } = useLocale()
  return SKILLS[locale] ?? SKILLS['en']
}

export type { Project, ProjectDetail, ChangelogEntry, ChangelogTag, ExperienceItem, BlogArticle, Skill }
