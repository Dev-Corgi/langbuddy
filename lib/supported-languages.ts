/** LangBuddy 언어교환·자리배치에서 지원하는 언어 (영어·일본어만) */
export const SUPPORTED_LANGUAGES = ['영어', '일본어'] as const

export type SupportedLanguage = (typeof SUPPORTED_LANGUAGES)[number]

export const SUPPORTED_LANGUAGE_LABELS_EN: Record<SupportedLanguage, string> = {
  영어: 'English',
  일본어: 'Japanese',
}

const SUPPORTED_SET = new Set<string>(SUPPORTED_LANGUAGES)

export function isSupportedLanguage(value: string | null | undefined): value is SupportedLanguage {
  if (!value) return false
  return SUPPORTED_SET.has(value.trim())
}

export function filterSupportedLanguages(languages: Iterable<string>): SupportedLanguage[] {
  const out = new Set<SupportedLanguage>()
  for (const lang of languages) {
    const trimmed = lang.trim()
    if (isSupportedLanguage(trimmed)) out.add(trimmed)
  }
  return SUPPORTED_LANGUAGES.filter((l) => out.has(l))
}
