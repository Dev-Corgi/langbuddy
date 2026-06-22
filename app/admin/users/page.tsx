'use client'

import { Suspense, useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useAdminAuth } from '@/hooks/use-admin-auth'
import type { AdminUserRow } from '@/lib/admin-user-types'
import { PageHeader } from '@/components/admin/page-header'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Loader2, Search, ChevronRight, User } from 'lucide-react'
import { useLocale } from '@/hooks/use-locale'
import { cn } from '@/lib/utils'

function UsersListContent() {
  const locale = useLocale()
  const isEn = locale === 'en'
  const { ready: authChecked } = useAdminAuth({ requireSuper: true })

  const [loading, setLoading] = useState(true)
  const [users, setUsers] = useState<AdminUserRow[]>([])
  const [search, setSearch] = useState('')
  const [query, setQuery] = useState('')

  const fetchUsers = useCallback(async (q: string) => {
    setLoading(true)
    try {
      const params = q ? `?q=${encodeURIComponent(q)}` : ''
      const res = await fetch(`/api/admin/users${params}`)
      if (!res.ok) throw new Error('fetch_failed')
      const body = await res.json()
      setUsers(body.users ?? [])
    } catch {
      setUsers([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (!authChecked) return
    void fetchUsers(query)
  }, [authChecked, query, fetchUsers])

  if (!authChecked) {
    return (
      <div className="p-6 flex items-center justify-center min-h-[50vh]">
        <Loader2 className="size-10 animate-spin text-primary" />
      </div>
    )
  }

  return (
    <div className="p-4 md:p-8 max-w-4xl mx-auto space-y-6">
      <PageHeader
        title="유저 관리"
        titleEn="User Management"
        description="가입 유저 목록과 프로필·스탬프 정보를 관리합니다."
        descriptionEn="Manage member profiles and stamp progress."
        backPath="/admin/dashboard"
      />

      <div className="relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') setQuery(search.trim())
          }}
          placeholder={isEn ? 'Search by name or KakaoTalk ID…' : '이름 또는 카카오톡 ID 검색…'}
          className="h-12 pl-11 rounded-2xl border-border font-medium"
        />
      </div>

      {loading ? (
        <div className="py-20 flex justify-center">
          <Loader2 className="size-10 animate-spin text-primary" />
        </div>
      ) : users.length === 0 ? (
        <Card className="rounded-[24px] border-none shadow-sm">
          <CardContent className="py-16 text-center text-muted-foreground font-bold">
            {isEn ? 'No users found.' : '유저가 없습니다.'}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {users.map((u) => (
            <Link key={u.id} href={`/admin/users/${u.id}`}>
              <Card className="rounded-[20px] border-none shadow-sm hover:shadow-md transition-shadow">
                <CardContent className="p-5 flex items-center gap-4">
                  <div className="size-12 rounded-2xl bg-primary/10 flex items-center justify-center shrink-0">
                    <User className="size-6 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-black text-foreground truncate">
                        {u.name || (isEn ? 'Unnamed' : '이름 없음')}
                      </p>
                      {u.is_superadmin ? (
                        <Badge className="rounded-lg font-bold bg-primary/15 text-primary border-0">
                          {isEn ? 'Super admin' : '슈퍼 관리자'}
                        </Badge>
                      ) : u.is_admin ? (
                        <Badge variant="secondary" className="rounded-lg font-bold">
                          {isEn ? 'Admin' : '관리자'}
                        </Badge>
                      ) : null}
                      {u.onboarding_completed ? (
                        <Badge className="rounded-lg font-bold">{isEn ? 'Onboarded' : '온보딩 완료'}</Badge>
                      ) : (
                        <Badge variant="secondary" className="rounded-lg font-bold">
                          {isEn ? 'Pending' : '온보딩 미완료'}
                        </Badge>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground font-medium mt-0.5 truncate">
                      {u.kakao_id ? `Kakao: ${u.kakao_id}` : (isEn ? 'No Kakao ID' : '카카오 ID 없음')}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {isEn ? 'Stamps' : '스탬프'}: {u.le_stamp_progress ?? 0}/10
                    </p>
                  </div>
                  <ChevronRight className="size-5 text-muted-foreground shrink-0" />
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}

export default function AdminUsersPage() {
  return (
    <Suspense
      fallback={
        <div className="p-6 flex items-center justify-center min-h-[50vh]">
          <Loader2 className="size-10 animate-spin text-primary" />
        </div>
      }
    >
      <UsersListContent />
    </Suspense>
  )
}
