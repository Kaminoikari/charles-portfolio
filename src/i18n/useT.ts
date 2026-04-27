import { useCallback } from 'react'
import { useLocale } from './LocaleContext'
import { STRINGS, type Strings } from './strings'

// All translation keys are derived from the English Strings shape so usage
// like `t('nav.about')` is statically checked.
type Leaves<T, Prefix extends string = ''> = {
  [K in keyof T & string]: T[K] extends string
    ? `${Prefix}${K}`
    : T[K] extends Record<string, unknown>
      ? Leaves<T[K], `${Prefix}${K}.`>
      : never
}[keyof T & string]

export type StringKey = Leaves<Strings>

function getNested(dict: Strings, key: string): string {
  const parts = key.split('.')
  let current: unknown = dict
  for (const part of parts) {
    if (current && typeof current === 'object' && part in current) {
      current = (current as Record<string, unknown>)[part]
    } else {
      return key
    }
  }
  return typeof current === 'string' ? current : key
}

function interpolate(template: string, vars?: Record<string, string | number>): string {
  if (!vars) return template
  return template.replace(/\{\{(\w+)\}\}/g, (_, name: string) => {
    const v = vars[name]
    return v === undefined ? `{{${name}}}` : String(v)
  })
}

export function useT() {
  const { locale } = useLocale()
  const dict = STRINGS[locale]
  return useCallback(
    (key: StringKey, vars?: Record<string, string | number>) => {
      return interpolate(getNested(dict, key), vars)
    },
    [dict],
  )
}
