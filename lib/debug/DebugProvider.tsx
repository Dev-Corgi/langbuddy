'use client'

import { createContext, useContext, type ReactNode } from 'react'
import { DEBUG_BASE_PATH, prefixDebugHref } from '@/lib/debug/debug-base-path'

type DebugContextValue = {
  basePath: string
  href: (path: string) => string
}

const DebugContext = createContext<DebugContextValue | null>(null)

export function DebugProvider({ children }: { children: ReactNode }) {
  const value: DebugContextValue = {
    basePath: DEBUG_BASE_PATH,
    href: (path: string) => prefixDebugHref(path, DEBUG_BASE_PATH),
  }
  return <DebugContext.Provider value={value}>{children}</DebugContext.Provider>
}

export function useDebugContext(): DebugContextValue | null {
  return useContext(DebugContext)
}

export function useDebugHref() {
  const ctx = useDebugContext()
  return (path: string) => (ctx ? ctx.href(path) : path)
}
