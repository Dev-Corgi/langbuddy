export const DEBUG_BASE_PATH = '/debug'

export function isDebugPath(pathname: string | null | undefined): boolean {
  if (!pathname) return false
  return pathname === DEBUG_BASE_PATH || pathname.startsWith(`${DEBUG_BASE_PATH}/`)
}

/** Strip `/debug` prefix for matching nav active state against live hrefs. */
export function stripDebugPrefix(pathname: string): string {
  if (pathname === DEBUG_BASE_PATH) return '/'
  if (pathname.startsWith(`${DEBUG_BASE_PATH}/`)) {
    const rest = pathname.slice(DEBUG_BASE_PATH.length)
    return rest || '/'
  }
  return pathname
}

/** Prefix a site-relative href with `/debug` when inside the debug tree. */
export function prefixDebugHref(href: string, basePath: string = ''): string {
  if (!basePath) return href
  if (href.startsWith('http://') || href.startsWith('https://') || href.startsWith('mailto:')) {
    return href
  }
  if (href.startsWith(basePath)) return href
  if (href === '/') return basePath
  return `${basePath}${href.startsWith('/') ? href : `/${href}`}`
}
