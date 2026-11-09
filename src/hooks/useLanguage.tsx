import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import type { Language } from '../types'
import { translate, type TranslateParams, type TranslationKey } from '../lib/i18n'
import { loadLanguage, saveLanguage } from '../lib/storage'

const LOCALES: Record<Language, string> = { en: 'en-US', vi: 'vi-VN' }

interface LanguageContextValue {
  language: Language
  setLanguage: (language: Language) => void
  t: (key: TranslationKey, params?: TranslateParams) => string
  formatDate: (iso: string) => string
}

const LanguageContext = createContext<LanguageContextValue | null>(null)

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguage] = useState<Language>(() =>
    typeof window === 'undefined' ? 'vi' : loadLanguage(),
  )

  useEffect(() => {
    document.documentElement.lang = language
    saveLanguage(language)
  }, [language])

  const t = useCallback(
    (key: TranslationKey, params?: TranslateParams) => translate(language, key, params),
    [language],
  )

  const formatDate = useCallback(
    (iso: string) => new Date(iso).toLocaleString(LOCALES[language]),
    [language],
  )

  const value = useMemo<LanguageContextValue>(
    () => ({ language, setLanguage, t, formatDate }),
    [language, t, formatDate],
  )

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>
}

export function useLanguage() {
  const context = useContext(LanguageContext)
  if (!context) throw new Error('useLanguage must be used inside a LanguageProvider')
  return context
}
