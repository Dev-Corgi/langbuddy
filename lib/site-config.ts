const clean = (value: string | undefined) => value?.trim() || undefined

const name = clean(process.env.NEXT_PUBLIC_CLUB_NAME) ?? 'LangBuddy'
const nameKo = clean(process.env.NEXT_PUBLIC_CLUB_NAME_KO) ?? name
const slug = clean(process.env.NEXT_PUBLIC_CLUB_SLUG) ?? name.toLowerCase().replace(/[^a-z0-9]+/g, '-')
const siteUrl = clean(process.env.NEXT_PUBLIC_APP_URL)?.replace(/\/$/, '') ?? ''
const instagramHandle = clean(process.env.NEXT_PUBLIC_INSTAGRAM_HANDLE) ?? ''

export const siteConfig = {
  name,
  nameKo,
  slug,
  siteUrl,
  logoUrl: clean(process.env.NEXT_PUBLIC_CLUB_LOGO_URL) ?? '',
  primaryColor: clean(process.env.NEXT_PUBLIC_CLUB_PRIMARY_COLOR) ?? '',
  taglineKo: clean(process.env.NEXT_PUBLIC_CLUB_TAGLINE_KO) ?? '글로벌친목 & 언어교환동아리',
  taglineEn: clean(process.env.NEXT_PUBLIC_CLUB_TAGLINE_EN) ?? 'Making the World Your Neighborhood',
  descriptionKo:
    clean(process.env.NEXT_PUBLIC_CLUB_DESCRIPTION_KO) ??
    `외국인 친구들과 함께 즐기는 언어교환과 모임을 ${nameKo}에서 만나보세요.`,
  descriptionEn:
    clean(process.env.NEXT_PUBLIC_CLUB_DESCRIPTION_EN) ??
    `Join language exchanges and meetups with ${name}.`,
  instagramHandle,
  instagramUrl:
    clean(process.env.NEXT_PUBLIC_INSTAGRAM_URL) ??
    (instagramHandle ? `https://instagram.com/${instagramHandle.replace(/^@/, '')}` : ''),
} as const

export function absoluteSiteUrl(path = ''): string {
  if (!siteConfig.siteUrl) return path || '/'
  return `${siteConfig.siteUrl}${path.startsWith('/') ? path : `/${path}`}`
}
