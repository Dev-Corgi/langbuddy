'use client'

import { DebugProvider } from '@/lib/debug/DebugProvider'

export default function DebugLayout({ children }: { children: React.ReactNode }) {
  return (
    <DebugProvider>
      <div className="border-b border-amber-500/40 bg-amber-500 text-amber-950 px-4 py-2 text-center text-xs font-black tracking-wide uppercase">
        DEBUG · MOCK DATA — writes disabled · superadmin only
      </div>
      {children}
    </DebugProvider>
  )
}
