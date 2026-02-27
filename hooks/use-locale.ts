'use client'

import { useState, useEffect } from 'react'
import { type Locale, defaultLocale, locales } from '@/lib/i18n'
import { useSearchParams } from 'next/navigation'

export function useLocale() {
  const [locale, setLocale] = useState<Locale>(defaultLocale)
  const searchParams = useSearchParams()

  useEffect(() => {
    // 1. Priority: URL query parameter (?lang=en)
    const langParam = searchParams.get('lang') as Locale
    if (langParam && locales.includes(langParam)) {
      setLocale(langParam)
      localStorage.setItem('locale', langParam)
      return
    }

    // 2. Secondary: Saved locale in localStorage
    const savedLocale = localStorage.getItem('locale') as Locale
    if (savedLocale && locales.includes(savedLocale)) {
      setLocale(savedLocale)
    }

    const handleLocaleChange = () => {
      const newLocale = localStorage.getItem('locale') as Locale
      if (newLocale) setLocale(newLocale)
    }

    window.addEventListener('localeChange', handleLocaleChange)
    return () => window.removeEventListener('localeChange', handleLocaleChange)
  }, [searchParams])

  return locale
}
