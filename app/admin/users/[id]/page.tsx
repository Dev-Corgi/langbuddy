'use client'

import { useCallback, useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import { isSuperAdminEmail } from '@/lib/super-admin'
import type { AdminUserRow } from '@/lib/admin-user-types'
import { PageHeader } from '@/components/admin/page-header'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Switch } from '@/components/ui/switch'
import { Loader2, Pencil, Save, X } from 'lucide-react'
import { useLocale } from '@/hooks/use-locale'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

type UserDetail = AdminUserRow & { email?: string | null }

export default function AdminUserDetailPage() {
  const { id } = useParams<{ id: string }>()
  const locale = useLocale()
  const isEn = locale === 'en'
  const router = useRouter()
  const supabase = createClient()

  const [authChecked, setAuthChecked] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [editing, setEditing] = useState(false)
  const [user, setUser] = useState<UserDetail | null>(null)

  const [name, setName] = useState('')
  const [gender, setGender] = useState<'남' | '여'>('남')
  const [nationality, setNationality] = useState<'한국인' | '외국인'>('한국인')
  const [kakaoId, setKakaoId] = useState('')
  const [stampProgress, setStampProgress] = useState(0)
  const [rewardCoupons, setRewardCoupons] = useState(0)
  const [onboardingCompleted, setOnboardingCompleted] = useState(false)

  useEffect(() => {
    const run = async () => {
      const { data: { user: authUser } } = await supabase.auth.getUser()
      if (!authUser) {
        router.push('/admin/login')
        return
      }
      const { data: profile } = await supabase
        .from('profiles')
        .select('is_superadmin')
        .eq('id', authUser.id)
        .single()
      if (!profile?.is_superadmin && !isSuperAdminEmail(authUser.email)) {
        router.push('/admin/dashboard')
        return
      }
      setAuthChecked(true)
    }
    void run()
  }, [router, supabase])

  const hydrateForm = useCallback((u: UserDetail) => {
    setName(u.name ?? '')
    setGender((u.gender === '여' ? '여' : '남') as '남' | '여')
    setNationality((u.nationality === '외국인' ? '외국인' : '한국인') as '한국인' | '외국인')
    setKakaoId(u.kakao_id ?? '')
    setStampProgress(Number(u.le_stamp_progress ?? 0))
    setRewardCoupons(Number(u.le_reward_coupons ?? 0))
    setOnboardingCompleted(!!u.onboarding_completed)
  }, [])

  const fetchUser = useCallback(async () => {
    if (!id) return
    setLoading(true)
    try {
      const res = await fetch(`/api/admin/users/${id}`)
      if (res.status === 404) {
        toast.error(isEn ? 'User not found.' : '유저를 찾을 수 없습니다.')
        router.push('/admin/users')
        return
      }
      if (!res.ok) throw new Error('fetch_failed')
      const body = await res.json()
      setUser(body.user)
      hydrateForm(body.user)
    } catch {
      toast.error(isEn ? 'Failed to load user.' : '유저 정보를 불러오지 못했습니다.')
    } finally {
      setLoading(false)
    }
  }, [id, hydrateForm, isEn, router])

  useEffect(() => {
    if (!authChecked || !id) return
    void fetchUser()
  }, [authChecked, id, fetchUser])

  const handleSave = async () => {
    if (!id) return
    setSaving(true)
    try {
      const res = await fetch(`/api/admin/users/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          gender,
          nationality,
          kakao_id: kakaoId.trim(),
          le_stamp_progress: stampProgress,
          le_reward_coupons: rewardCoupons,
          onboarding_completed: onboardingCompleted,
        }),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error || 'save_failed')
      }
      const body = await res.json()
      setUser(body.user)
      hydrateForm(body.user)
      setEditing(false)
      toast.success(isEn ? 'User updated.' : '유저 정보가 저장되었습니다.')
    } catch {
      toast.error(isEn ? 'Failed to save.' : '저장에 실패했습니다.')
    } finally {
      setSaving(false)
    }
  }

  const cancelEdit = () => {
    if (user) hydrateForm(user)
    setEditing(false)
  }

  if (!authChecked || loading) {
    return (
      <div className="p-6 flex items-center justify-center min-h-[50vh]">
        <Loader2 className="size-10 animate-spin text-primary" />
      </div>
    )
  }

  if (!user) return null

  const stampSlots = 10
  const stampFill = Math.min(stampSlots, Number(user.le_stamp_progress ?? 0))

  return (
    <div className="p-4 md:p-8 max-w-2xl mx-auto space-y-6 pb-24">
      <div className="flex items-start justify-between gap-4">
        <PageHeader
          title="유저 상세"
          titleEn="User Detail"
          description={user.name ?? (isEn ? 'Member profile' : '회원 프로필')}
          descriptionEn={user.name ?? 'Member profile'}
          backPath="/admin/users"
        />
        {!editing ? (
          <Button
            type="button"
            onClick={() => setEditing(true)}
            className="shrink-0 rounded-2xl font-black gap-2 mt-8"
          >
            <Pencil className="size-4" />
            {isEn ? 'Edit' : '편집'}
          </Button>
        ) : (
          <div className="flex gap-2 shrink-0 mt-8">
            <Button
              type="button"
              variant="outline"
              onClick={cancelEdit}
              disabled={saving}
              className="rounded-2xl font-bold gap-1"
            >
              <X className="size-4" />
              {isEn ? 'Cancel' : '취소'}
            </Button>
            <Button
              type="button"
              onClick={() => void handleSave()}
              disabled={saving}
              className="rounded-2xl font-black gap-1"
            >
              {saving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
              {isEn ? 'Save' : '저장'}
            </Button>
          </div>
        )}
      </div>

      <Card className="rounded-[24px] border-none shadow-sm">
        <CardHeader className="pb-2">
          <CardTitle className="text-lg font-black">
            {isEn ? 'Profile (Onboarding)' : '프로필 (온보딩 정보)'}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          <InfoRow label={isEn ? 'Email' : '이메일'} value={user.email ?? '—'} />
          <InfoRow
            label={isEn ? 'Joined' : '가입일'}
            value={user.created_at ? new Date(user.created_at).toLocaleString() : '—'}
          />

          {editing ? (
            <>
              <div className="space-y-2">
                <Label className="font-bold">{isEn ? 'Name' : '이름'}</Label>
                <Input value={name} onChange={(e) => setName(e.target.value)} className="h-12 rounded-xl" />
              </div>
              <div className="space-y-3">
                <Label className="font-bold">{isEn ? 'Gender' : '성별'}</Label>
                <RadioGroup value={gender} onValueChange={(v) => setGender(v as '남' | '여')}>
                  <div className="flex gap-3">
                    {(['남', '여'] as const).map((g) => (
                      <label key={g} className="flex items-center gap-2 font-bold cursor-pointer">
                        <RadioGroupItem value={g} />
                        {g === '남' ? (isEn ? 'Male' : '남') : (isEn ? 'Female' : '여')}
                      </label>
                    ))}
                  </div>
                </RadioGroup>
              </div>
              <div className="space-y-3">
                <Label className="font-bold">{isEn ? 'Nationality' : '국적'}</Label>
                <RadioGroup value={nationality} onValueChange={(v) => setNationality(v as '한국인' | '외국인')}>
                  <div className="flex gap-3">
                    {(['한국인', '외국인'] as const).map((n) => (
                      <label key={n} className="flex items-center gap-2 font-bold cursor-pointer">
                        <RadioGroupItem value={n} />
                        {n === '한국인' ? (isEn ? 'Korean' : '한국인') : (isEn ? 'Foreigner' : '외국인')}
                      </label>
                    ))}
                  </div>
                </RadioGroup>
              </div>
              <div className="space-y-2">
                <Label className="font-bold">{isEn ? 'KakaoTalk ID' : '카카오톡 ID'}</Label>
                <Input value={kakaoId} onChange={(e) => setKakaoId(e.target.value)} className="h-12 rounded-xl" />
              </div>
              <div className="flex items-center justify-between rounded-2xl border border-border p-4">
                <Label className="font-bold">{isEn ? 'Onboarding completed' : '온보딩 완료'}</Label>
                <Switch checked={onboardingCompleted} onCheckedChange={setOnboardingCompleted} />
              </div>
            </>
          ) : (
            <>
              <InfoRow label={isEn ? 'Name' : '이름'} value={user.name ?? '—'} />
              <InfoRow label={isEn ? 'Gender' : '성별'} value={user.gender ?? '—'} />
              <InfoRow label={isEn ? 'Nationality' : '국적'} value={user.nationality ?? '—'} />
              <InfoRow label={isEn ? 'KakaoTalk ID' : '카카오톡 ID'} value={user.kakao_id ?? '—'} />
              <InfoRow
                label={isEn ? 'Onboarding' : '온보딩'}
                value={user.onboarding_completed ? (isEn ? 'Completed' : '완료') : (isEn ? 'Pending' : '미완료')}
              />
              {user.privacy_accepted_at && (
                <InfoRow
                  label={isEn ? 'Privacy agreed' : '개인정보 동의'}
                  value={new Date(user.privacy_accepted_at).toLocaleString()}
                />
              )}
            </>
          )}
        </CardContent>
      </Card>

      <Card className="rounded-[24px] border-none shadow-sm">
        <CardHeader className="pb-2">
          <CardTitle className="text-lg font-black">
            {isEn ? 'Coupons & Stamps' : '쿠폰 · 스탬프 현황'}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          {editing ? (
            <>
              <div className="space-y-2">
                <Label className="font-bold">
                  {isEn ? 'Language exchange stamps (0–9)' : '언어교환 스탬프 (0–9)'}
                </Label>
                <Input
                  type="number"
                  min={0}
                  max={9}
                  value={stampProgress}
                  onChange={(e) => setStampProgress(Math.min(9, Math.max(0, Number(e.target.value) || 0)))}
                  className="h-12 rounded-xl"
                />
              </div>
              <div className="space-y-2">
                <Label className="font-bold">
                  {isEn ? 'Free coupons' : '무료 쿠폰 보유'}
                </Label>
                <Input
                  type="number"
                  min={0}
                  value={rewardCoupons}
                  onChange={(e) => setRewardCoupons(Math.max(0, Number(e.target.value) || 0))}
                  className="h-12 rounded-xl"
                />
              </div>
            </>
          ) : (
            <>
              <div>
                <p className="text-sm font-bold text-muted-foreground mb-3">
                  {isEn ? 'Stamp progress (10 = 1 coupon)' : '스탬프 진행 (10개 = 쿠폰 1장)'}
                </p>
                <div className="flex flex-wrap gap-2">
                  {Array.from({ length: stampSlots }).map((_, i) => (
                    <div
                      key={i}
                      className={cn(
                        'size-8 rounded-full border-2 flex items-center justify-center text-xs font-black',
                        i < stampFill
                          ? 'bg-primary border-primary text-primary-foreground'
                          : 'border-border text-muted-foreground'
                      )}
                    >
                      {i + 1}
                    </div>
                  ))}
                </div>
                <p className="text-sm font-bold mt-3 text-foreground">
                  {stampFill}/9 {isEn ? 'toward next coupon' : '다음 쿠폰까지'}
                </p>
              </div>
              <InfoRow
                label={isEn ? 'Available coupons' : '보유 무료 쿠폰'}
                value={`${user.le_reward_coupons ?? 0}${isEn ? '' : '장'}`}
                highlight
              />
            </>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

function InfoRow({
  label,
  value,
  highlight,
}: {
  label: string
  value: string
  highlight?: boolean
}) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-4 py-2 border-b border-border/60 last:border-0">
      <span className="text-sm font-bold text-muted-foreground sm:w-36 shrink-0">{label}</span>
      <span className={cn('text-sm font-black text-foreground', highlight && 'text-primary text-lg')}>
        {value}
      </span>
    </div>
  )
}
