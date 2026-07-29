'use client'

import { useState, useEffect, useMemo } from "react"
import { toast } from "sonner"
import { useParams, useRouter, usePathname } from "next/navigation"
import { createClient } from "@/lib/supabase"
import { MainNav } from "@/app/_components/main-nav"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select"
import { ChevronLeft, Loader2, X, MapPin, Wallet, Upload, Info } from "lucide-react"
import { useLocale } from "@/hooks/use-locale"
import { i18n } from "@/lib/i18n"
import { cn, extractParticipantInfoFromAnswers } from "@/lib/utils"
import {
  canonicalizeFormAnswers,
  canonicalizeLegacySelectedLanguage,
  remapAnswersBySystemKey,
  remapAnswersForLocale,
  type FormDisplayLocale,
} from '@/lib/form-answer-canonical'
import { PaymentReceiptUploader } from '@/components/PaymentReceiptUploader'
import { ApplyLoginModal } from '@/components/apply-login-modal'
import {
  formatSessionDateLabel,
  nextSessionIsoDateForKoreanWeekday,
  filterSelectableRecurringDaysSeoul,
  isoDateForKoreanWeekdayInSunWeekSeoul,
  buildAutoRecurringFormTitles,
} from '@/lib/session-event-date'
import { filterSupportedLanguages, SUPPORTED_LANGUAGES } from '@/lib/supported-languages'
import {
  paymentMethodFromApplyChoice,
  type ApplyPaymentChoice,
} from '@/lib/supported-payment-methods'

// Basic Radio Group Implementation
function RadioGroup({ value, onValueChange, children, className }: any) {
  return <div className={className}>{children}</div>
}

function RadioGroupItem({ value, id, className, checked, onChange }: any) {
  return (
    <input
      type="radio"
      id={id}
      value={value}
      checked={checked}
      onChange={onChange}
      className={cn("w-4 h-4 text-primary border-border focus:ring-primary", className)}
    />
  )
}

// Basic Checkbox Implementation
function Checkbox({ id, checked, onCheckedChange, className }: any) {
  return (
    <input
      type="checkbox"
      id={id}
      checked={checked}
      onChange={(e) => onCheckedChange(e.target.checked)}
      className={cn("w-4 h-4 rounded border-border text-primary focus:ring-primary", className)}
    />
  )
}

export default function ApplicationFormPage() {
  const params = useParams()
  const router = useRouter()
  const pathname = usePathname()
  const id = params?.id as string
  const supabase = createClient()
  const locale = useLocale()
  const tDict = i18n[locale]

  const [posting, setPosting] = useState<any>(null)
  const [form, setForm] = useState<any>(null)
  const [questions, setQuestions] = useState<any[]>([])
  const [answers, setAnswers] = useState<Record<string, any>>({})
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [paymentMethod, setPaymentMethod] = useState<ApplyPaymentChoice>("")
  const [showPaymentModal, setShowPaymentModal] = useState(false)
  const [paymentReceiptFile, setPaymentReceiptFile] = useState<File | null>(null)
  
  const [selectedDay, setSelectedDay] = useState<string>("")
  const [availableLangs, setAvailableLangs] = useState<string[]>([])
  const [selectedLang, setSelectedLang] = useState<string>("")
  /** 서울 주차·21시 마감 반영을 위해 분 단위로 재계산 */
  const [availabilityClock, setAvailabilityClock] = useState(0)
  const [user, setUser] = useState<any>(null)
  const [userData, setUserData] = useState<any>(null)
  const [authChecked, setAuthChecked] = useState(false)
  const [authRefreshTick, setAuthRefreshTick] = useState(0)
  const [showApplyAuthGate, setShowApplyAuthGate] = useState(false)
  const [studyBundleFree, setStudyBundleFree] = useState(false)
  /** 반복 모임: 이번 회차(user+form+_event_date) 기존 신청 여부 */
  const [duplicateApplicationPending, setDuplicateApplicationPending] = useState(false)
  const [hasDuplicateApplication, setHasDuplicateApplication] = useState(false)
  /** 반복 모임: 선택 요일 form 로딩/준비 상태 (race 방지) */
  const [dayFormLoading, setDayFormLoading] = useState(false)
  const [dayFormReady, setDayFormReady] = useState(false)

  useEffect(() => {
    setAuthChecked(true)
  }, [])

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(() => {
      setAuthRefreshTick((t) => t + 1)
    })
    return () => subscription.unsubscribe()
  }, [supabase])

  useEffect(() => {
    if (posting?.category !== '스터디' && posting?.category !== '언어교환') return
    if (!posting?.is_recurring) return
    const t = setInterval(() => setAvailabilityClock((c) => c + 1), 60_000)
    return () => clearInterval(t)
  }, [posting?.category, posting?.is_recurring])

  const selectableMeetingDays = useMemo((): string[] | undefined => {
    if (posting?.category !== '스터디' && posting?.category !== '언어교환') return undefined
    if (!posting?.is_recurring) return undefined
    const raw = posting.recurring_days as string[] | undefined
    if (!raw?.length) return []
    return filterSelectableRecurringDaysSeoul(raw)
  }, [posting?.category, posting?.is_recurring, posting?.recurring_days, availabilityClock])

  useEffect(() => {
    if (selectableMeetingDays === undefined) return
    if (selectedDay && !selectableMeetingDays.includes(selectedDay)) {
      setSelectedDay('')
    }
  }, [selectableMeetingDays, selectedDay])

  const sessionEventDate = useMemo(() => {
    if (!selectedDay) return ''
    try {
      if ((posting?.category === '스터디' || posting?.category === '언어교환') && posting?.is_recurring) {
        return isoDateForKoreanWeekdayInSunWeekSeoul(selectedDay)
      }
      return nextSessionIsoDateForKoreanWeekday(selectedDay)
    } catch {
      return ''
    }
  }, [selectedDay, posting?.category, posting?.is_recurring])

  /** DB의 forms.title은 저장 시점에 고정될 수 있음 — 표시는 매주 서울 주차 기준으로 계산 */
  const recurringAutoFormTitles = useMemo(() => {
    if (!posting?.is_recurring) return null
    if (posting.category !== '스터디' && posting.category !== '언어교환') return null
    if (!selectedDay) return null
    const kind = posting.category === '언어교환' ? 'language' : 'study'
    return buildAutoRecurringFormTitles(selectedDay, kind)
  }, [posting?.is_recurring, posting?.category, selectedDay])

  useEffect(() => {
    let cancelled = false

    async function checkDuplicate() {
      if (
        !posting?.is_recurring ||
        (posting.category !== '스터디' && posting.category !== '언어교환')
      ) {
        setHasDuplicateApplication(false)
        setDuplicateApplicationPending(false)
        return
      }
      if (!user?.id || !form?.id || sessionEventDate.length < 10) {
        setHasDuplicateApplication(false)
        setDuplicateApplicationPending(false)
        return
      }

      setDuplicateApplicationPending(true)
      const { data, error } = await supabase
        .from('form_responses')
        .select('id')
        .eq('user_id', user.id)
        .eq('form_id', form.id)
        .eq('answers->_event_date', sessionEventDate)
        .limit(1)

      if (cancelled) return
      setDuplicateApplicationPending(false)
      if (error) {
        console.error('Duplicate application check:', error)
        setHasDuplicateApplication(false)
        return
      }
      setHasDuplicateApplication(!!data?.length)
    }

    checkDuplicate()
    return () => {
      cancelled = true
    }
  }, [
    posting?.is_recurring,
    posting?.category,
    user?.id,
    form?.id,
    sessionEventDate,
    supabase,
  ])

  useEffect(() => {
    async function checkBundle() {
      if (posting?.category !== '스터디' || !user?.id || !sessionEventDate) {
        setStudyBundleFree(false)
        return
      }
      const { data: langMasterRows } = await supabase
        .from('postings')
        .select('id')
        .eq('category', '언어교환')
        .is('day_of_week', null)
        .order('created_at', { ascending: false })
        .limit(1)
      const langMaster = langMasterRows?.[0]
      if (!langMaster?.id) {
        setStudyBundleFree(false)
        return
      }
      const { data: leSched } = await supabase
        .from('language_exchange_schedules')
        .select('form_id')
        .eq('posting_id', langMaster.id)
      const formIds = (leSched || []).map((s) => s.form_id).filter(Boolean) as string[]
      if (!formIds.length) {
        setStudyBundleFree(false)
        return
      }
      const { data: rows } = await supabase
        .from('form_responses')
        .select('id, answers')
        .in('form_id', formIds)
        .eq('user_id', user.id)
        .limit(50)
      const hit = rows?.some((r) => (r.answers as Record<string, unknown>)?._event_date === sessionEventDate)
      setStudyBundleFree(!!hit)
    }
    checkBundle()
  }, [posting?.category, posting?.id, user?.id, sessionEventDate, supabase])

  useEffect(() => {
    if (!authChecked) return

    let cancelled = false
    let currentUserInfo: any = null
    
    async function fetchData() {
      // 0. Check user authentication
      const { data: { user: authUser } } = await supabase.auth.getUser()
      if (cancelled) return
      setUser(authUser)

      if (authUser) {
        const { data: userInfo } = await supabase
          .from('users')
          .select('*')
          .eq('id', authUser.id)
          .single()
        if (cancelled) return
        setUserData(userInfo)
        currentUserInfo = userInfo
      }
      
      // 1. Fetch posting to get form_id
      let query = supabase.from('postings').select('*')
      
      if (id === 'study') {
        query = query.eq('category', '스터디').is('day_of_week', null).order('created_at', { ascending: false }).limit(1)
      } else if (id === 'language') {
        query = query.eq('category', '언어교환').is('day_of_week', null).order('created_at', { ascending: false }).limit(1)
      } else {
        query = query.eq('id', id)
      }

      const { data: postingDataList, error: pError } = await query
      const postingData = postingDataList && postingDataList.length > 0 ? postingDataList[0] : null
      
      if (pError) {
        console.error('Error fetching posting:', pError)
      }

      if (!postingData) {
        console.error('Invalid posting', { id, postingData })
        router.push(`/posting/${id}`)
        return
      }
      
      // 언어교환 또는 스터디의 경우 스케줄 가져오기
      if (postingData.category === '언어교환') {
        const { data: schedules } = await supabase
          .from('language_exchange_schedules')
          .select('*')
          .eq('posting_id', postingData.id)
          .eq('is_active', true)
          .order('day_of_week')
        
        if (schedules && schedules.length > 0) {
          postingData.recurring_days = schedules.map(s => s.day_of_week)
          postingData.is_recurring = true
          // 첫 번째 스케줄의 form_id 사용 (fetchScheduleForDay가 선택 요일 기준으로 덮어씀)
          postingData.form_id = schedules[0].form_id
        }
      } else if (postingData.category === '스터디') {
        const { data: schedules } = await supabase
          .from('study_schedules')
          .select('*')
          .eq('posting_id', postingData.id)
          .eq('is_active', true)
          .order('day_of_week')
        
        if (schedules && schedules.length > 0) {
          postingData.recurring_days = schedules.map(s => s.day_of_week)
          postingData.is_recurring = true
          // 첫 번째 스케줄의 form_id 사용 (fetchScheduleForDay가 선택 요일 기준으로 덮어씀)
          postingData.form_id = schedules[0].form_id
        }
      }
      
      if (!postingData.form_id) {
        console.error('Missing form_id', { id, postingData })
        router.push(`/posting/${id}`)
        return
      }

      if (cancelled) return

      if (
        (postingData.category === '언어교환' || postingData.category === '스터디') &&
        !authUser
      ) {
        setPosting(postingData)
        setShowApplyAuthGate(true)
        setForm(null)
        setQuestions([])
        setAnswers({})
        setLoading(false)
        return
      }
      setShowApplyAuthGate(false)
      setLoading(true)

      // Category check - Study and Language Exchange always allowed to use form
      const isCustomFormAllowed = postingData.apply_type === 'form' ||
                                 postingData.category === '스터디' ||
                                 postingData.category === '언어교환'

      if (!isCustomFormAllowed) {
        router.push(`/posting/${id}`)
        return
      }

      setPosting(postingData)

      // 반복 모임(언어교환/스터디)의 form은 fetchScheduleForDay가 단독으로 관리한다.
      // fetchData가 첫 번째 스케줄 form을 세팅하면 fetchScheduleForDay와 race가 생기므로
      // 여기서는 form을 건드리지 않는다. 사용자가 요일을 선택하면 fetchScheduleForDay가 로드한다.
      if (postingData.is_recurring &&
          (postingData.category === '언어교환' || postingData.category === '스터디')) {
        setForm(null)
        setQuestions([])
        setAnswers({})
        setDayFormLoading(false)
        setDayFormReady(false)
        setLoading(false)
        return
      }

      // 2. 일반 모임: form 및 질문 로드
      const { data: formData, error: fError } = await supabase
        .from('forms')
        .select('*')
        .eq('id', postingData.form_id)
        .maybeSingle()

      if (fError) {
        console.error('Error fetching form:', fError)
      }

      if (formData) {
        if (cancelled) return
        setForm(formData)
        const { data: questionData, error: qError } = await supabase
          .from('form_questions')
          .select('*')
          .eq('form_id', formData.id)
          .order('display_order', { ascending: true })

        if (qError) {
          console.error('Error fetching questions:', qError)
        }

        if (questionData) {
          if (cancelled) return
          setQuestions(questionData)
          const initialAnswers: Record<string, any> = {}
          questionData.forEach(q => {
            if (q.question_type === 'checkbox') initialAnswers[q.id] = []
            else initialAnswers[q.id] = ''

            if (currentUserInfo) {
              if (q.system_key === 'name') {
                initialAnswers[q.id] = currentUserInfo.name
              } else if (q.system_key === 'gender') {
                const genderOptions = locale === 'en' && q.options_en ? q.options_en : q.options
                const userGender = currentUserInfo.gender
                let normalized = ''
                if (userGender === '남' || userGender === '남자' || userGender === 'Male') normalized = 'male'
                else if (userGender === '여' || userGender === '여자' || userGender === 'Female') normalized = 'female'
                const matched = genderOptions?.find((opt: string) => {
                  if (normalized === 'male') return opt === '남자' || opt === 'Male' || opt === '남'
                  if (normalized === 'female') return opt === '여자' || opt === 'Female' || opt === '여'
                  return false
                })
                initialAnswers[q.id] = matched || userGender
              } else if (q.system_key === 'nationality') {
                const natOptions = locale === 'en' && q.options_en ? q.options_en : q.options
                const userNat = currentUserInfo.nationality
                let normalized = ''
                if (userNat === '한국인' || userNat === 'Korean') normalized = 'korean'
                else if (userNat === '외국인' || userNat === 'Foreigner') normalized = 'foreigner'
                const matched = natOptions?.find((opt: string) => {
                  if (normalized === 'korean') return opt === '한국인' || opt === 'Korean'
                  if (normalized === 'foreigner') return opt === '외국인' || opt === 'Foreigner'
                  return false
                })
                initialAnswers[q.id] = matched || userNat
              } else if (q.system_key === 'kakao_id' && currentUserInfo.kakao_id) {
                initialAnswers[q.id] = currentUserInfo.kakao_id
              }
            }
          })
          setAnswers(initialAnswers)
        }
      } else {
        console.error('Form not found for id:', postingData.form_id)
        router.push(`/posting/${id}`)
        return
      }
      if (cancelled) return
      setLoading(false)
    }
    fetchData()
    return () => { cancelled = true }
  }, [id, supabase, authChecked, authRefreshTick])

  // Update available languages when selected day changes
  useEffect(() => {
    let cancelled = false

    async function fetchScheduleForDay() {
      if (!selectedDay || !posting?.id) {
        setDayFormLoading(false)
        setDayFormReady(false)
        return
      }

      const isRecurringLeOrStudy =
        posting.category === '언어교환' || posting.category === '스터디'

      if (isRecurringLeOrStudy) {
        setDayFormLoading(true)
        setDayFormReady(false)
        setForm(null)
        setQuestions([])
        setAnswers({})

        const schedulesTable =
          posting.category === '언어교환'
            ? 'language_exchange_schedules'
            : 'study_schedules'

        const { data: schedule } = await supabase
          .from(schedulesTable)
          .select('*')
          .eq('posting_id', posting.id)
          .eq('day_of_week', selectedDay)
          .single()

        if (cancelled) return

        if (schedule?.form_id) {
          setPosting((prev: any) => ({ ...prev, form_id: schedule.form_id }))

          const { data: formData } = await supabase
            .from('forms')
            .select('*')
            .eq('id', schedule.form_id)
            .single()

          if (cancelled) return

          if (formData) {
            const { data: questionData } = await supabase
              .from('form_questions')
              .select('*')
              .eq('form_id', schedule.form_id)
              .order('display_order', { ascending: true })

            if (cancelled) return

            if (questionData) {
              setForm(formData)
              setQuestions(questionData)
              setAnswers(applyAutoFill(questionData, userData))
              setDayFormReady(true)
            } else {
              setDayFormReady(false)
            }
          } else {
            setDayFormReady(false)
          }

          setAvailableLangs([])
        } else {
          setDayFormReady(false)
        }

        if (!cancelled) setDayFormLoading(false)
        setSelectedLang('')
        return
      }

      if (selectedDay && posting?.recurring_settings?.[selectedDay]) {
        const langs = posting.recurring_settings[selectedDay].languages || []
        const filtered = filterSupportedLanguages(langs)
        setAvailableLangs(filtered.length > 0 ? filtered : [...SUPPORTED_LANGUAGES])
      } else {
        setAvailableLangs([])
      }
      setSelectedLang('')
    }

    fetchScheduleForDay()
    return () => {
      cancelled = true
    }
  }, [selectedDay, posting?.id, posting?.category, supabase, userData])

  // UI locale 전환 시 표시 라벨만 교체 (사용자가 고른 값은 유지)
  useEffect(() => {
    if (questions.length === 0) return
    const displayLocale: FormDisplayLocale = locale === 'en' ? 'en' : 'ko'
    setAnswers((prev) => remapAnswersForLocale(questions, prev, displayLocale))
  }, [locale, questions])

  const handleInputChange = (questionId: string, value: any) => {
    setAnswers(prev => ({ ...prev, [questionId]: value }))
  }

  const handleCheckboxChange = (questionId: string, option: string, checked: boolean) => {
    setAnswers(prev => {
      const current = prev[questionId] || []
      if (checked) return { ...prev, [questionId]: [...current, option] }
      else return { ...prev, [questionId]: current.filter((o: string) => o !== option) }
    })
  }

  // 자동 입력 헬퍼 함수
  const applyAutoFill = (questionData: any[], currentUserData: any) => {
    const initialAnswers: Record<string, any> = {}
    questionData.forEach(q => {
      if (q.question_type === 'checkbox') initialAnswers[q.id] = []
      else initialAnswers[q.id] = ''
      
      // 로그인 사용자의 시스템 질문 자동 입력
      if (currentUserData) {
        if (q.system_key === 'name') {
          initialAnswers[q.id] = currentUserData.name
        }
        else if (q.system_key === 'gender') {
          const genderOptions = locale === 'en' && q.options_en ? q.options_en : q.options
          const userGender = currentUserData.gender
          let normalized = ''
          if (userGender === '남' || userGender === '남자' || userGender === 'Male') normalized = 'male'
          else if (userGender === '여' || userGender === '여자' || userGender === 'Female') normalized = 'female'
          
          const matched = genderOptions?.find((opt: string) => {
            if (normalized === 'male') return opt === '남자' || opt === 'Male' || opt === '남'
            if (normalized === 'female') return opt === '여자' || opt === 'Female' || opt === '여'
            return false
          })
          initialAnswers[q.id] = matched || userGender
        }
        else if (q.system_key === 'nationality') {
          const natOptions = locale === 'en' && q.options_en ? q.options_en : q.options
          const userNat = currentUserData.nationality
          let normalized = ''
          if (userNat === '한국인' || userNat === 'Korean') normalized = 'korean'
          else if (userNat === '외국인' || userNat === 'Foreigner') normalized = 'foreigner'
          
          const matched = natOptions?.find((opt: string) => {
            if (normalized === 'korean') return opt === '한국인' || opt === 'Korean'
            if (normalized === 'foreigner') return opt === '외국인' || opt === 'Foreigner'
            return false
          })
          initialAnswers[q.id] = matched || userNat
        }
        else if (q.system_key === 'kakao_id' && currentUserData.kakao_id) {
          initialAnswers[q.id] = currentUserData.kakao_id
        }
      }
    })
    return initialAnswers
  }

  const loadAuthoritativeDayForm = async (
    day: string
  ): Promise<{ formId: string; questions: any[] } | null> => {
    if (!posting?.id) return null
    const schedulesTable =
      posting.category === '언어교환' ? 'language_exchange_schedules' : 'study_schedules'
    const { data: daySchedule, error: scheduleErr } = await supabase
      .from(schedulesTable)
      .select('form_id')
      .eq('posting_id', posting.id)
      .eq('day_of_week', day)
      .single()

    if (scheduleErr || !daySchedule?.form_id) {
      console.error('Authoritative form load (schedule):', scheduleErr)
      return null
    }

    const { data: questionData, error: questionErr } = await supabase
      .from('form_questions')
      .select('*')
      .eq('form_id', daySchedule.form_id)
      .order('display_order', { ascending: true })

    if (questionErr || !questionData?.length) {
      console.error('Authoritative form load (questions):', questionErr)
      return null
    }

    return { formId: daySchedule.form_id, questions: questionData }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)

    const isRecurringLeOrStudy =
      !!posting?.is_recurring &&
      (posting?.category === '스터디' || posting?.category === '언어교환')

    // Validate Meeting specific selections
    if (isRecurringLeOrStudy) {
      if (!selectedDay) {
        alert(locale === 'en' ? 'Please select a meeting day' : '참여 요일을 선택해주세요')
        setSubmitting(false)
        return
      }
      if (dayFormLoading || !dayFormReady) {
        alert(
          locale === 'en'
            ? 'The form is still loading. Please wait a moment.'
            : '폼을 불러오는 중입니다. 잠시 후 다시 시도해주세요.'
        )
        setSubmitting(false)
        return
      }
    }

    let submitFormId = form?.id || ''
    let submitQuestions = questions

    if (isRecurringLeOrStudy && selectedDay) {
      const authoritative = await loadAuthoritativeDayForm(selectedDay)
      if (!authoritative) {
        alert(
          locale === 'en'
            ? 'Could not load the form for the selected day.'
            : '선택한 요일의 폼을 불러오지 못했습니다.'
        )
        setSubmitting(false)
        return
      }
      submitFormId = authoritative.formId
      submitQuestions = authoritative.questions
    }

    const submitAnswers = remapAnswersBySystemKey(
      questions,
      submitQuestions,
      answers,
      userData
    )

    // Validate required questions (시스템 질문은 항상 필수)
    for (const q of submitQuestions) {
      const isRequired = q.is_required || q.system_key
      if (isRequired) {
        const answer = submitAnswers[q.id]
        if (!answer || (Array.isArray(answer) && answer.length === 0)) {
          const qText = locale === 'en' && q.question_text_en ? q.question_text_en : q.question_text
          alert(locale === 'en' ? `Please answer: ${qText}` : `필수 질문에 답변해주세요: ${qText}`)
          setSubmitting(false)
          return
        }
      }
    }

    const bundleWaived = posting?.category === '스터디' && studyBundleFree
    const feeWaived = bundleWaived

    let finalEventDate = sessionEventDate
    if (
      (posting?.category === '스터디' || posting?.category === '언어교환') &&
      posting?.is_recurring &&
      selectedDay
    ) {
      try {
        finalEventDate = isoDateForKoreanWeekdayInSunWeekSeoul(selectedDay, new Date())
      } catch {
        finalEventDate = sessionEventDate
      }
    }

    if (
      posting?.is_recurring &&
      (posting?.category === '스터디' || posting?.category === '언어교환') &&
      user?.id &&
      submitFormId &&
      finalEventDate.length >= 10
    ) {
      const { data: existingRows, error: dupErr } = await supabase
        .from('form_responses')
        .select('id')
        .eq('user_id', user.id)
        .eq('form_id', submitFormId)
        .eq('answers->_event_date', finalEventDate)
        .limit(1)
      if (dupErr) {
        console.error('Duplicate check before submit:', dupErr)
      } else if (existingRows?.length) {
        setHasDuplicateApplication(true)
        alert(
          locale === 'en'
            ? 'You already applied for this session.'
            : '이번 회차에 이미 신청하셨습니다.'
        )
        setSubmitting(false)
        return
      }
    }

    const needsReceipt = paymentMethod === 'bank' && !feeWaived

    // Validate payment receipt for bank transfer (스터디+당일 언어교환 번들이면 생략)
    if (needsReceipt && !paymentReceiptFile) {
      alert(locale === 'en' ? 'Please upload payment receipt' : '입금 영수증 사진을 업로드해주세요')
      setSubmitting(false)
      return
    }

    const qrCode = crypto.randomUUID()

    // Upload payment receipt if bank transfer
    let paymentReceiptUrl = null
    if (needsReceipt && paymentReceiptFile) {
      try {
        const fileExt = paymentReceiptFile.name.split('.').pop()
        const fileName = `${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`
        const filePath = `payment-receipts/temp/${fileName}`

        const { error: uploadError } = await supabase.storage
          .from('payment-receipts')
          .upload(filePath, paymentReceiptFile, {
            cacheControl: '3600',
            upsert: false
          })

        if (uploadError) {
          console.error('Receipt upload error:', uploadError)
          alert(locale === 'en' ? 'Failed to upload receipt' : '영수증 업로드에 실패했습니다')
          setSubmitting(false)
          return
        }

        const { data: { publicUrl } } = supabase.storage
          .from('payment-receipts')
          .getPublicUrl(filePath)

        paymentReceiptUrl = publicUrl
      } catch (err) {
        console.error('Receipt upload error:', err)
        alert(locale === 'en' ? 'Failed to upload receipt' : '영수증 업로드에 실패했습니다')
        setSubmitting(false)
        return
      }
    }

    const canonicalPaymentMethod = paymentMethodFromApplyChoice(paymentMethod)

    const canonicalAnswers = canonicalizeFormAnswers(submitQuestions, {
      ...submitAnswers,
      ...(selectedLang
        ? { _selected_language: canonicalizeLegacySelectedLanguage(selectedLang) }
        : {}),
    })
    const participantInfo = extractParticipantInfoFromAnswers(canonicalAnswers, submitQuestions)

    const insertPayload: Record<string, unknown> = {
      form_id: submitFormId,
      qr_code: qrCode,
      payment_receipt_url: paymentReceiptUrl,
      payment_status:
        feeWaived
          ? null
          : paymentMethod === 'bank'
            ? 'pending'
            : null,
      answers: {
        ...canonicalAnswers,
        ...(participantInfo.name ? { name: participantInfo.name, _participant_name: participantInfo.name } : {}),
        ...(participantInfo.gender ? { gender: participantInfo.gender } : {}),
        ...(participantInfo.nationality ? { nationality: participantInfo.nationality } : {}),
        ...(participantInfo.language ? { language: participantInfo.language } : {}),
        _selected_day: selectedDay,
        _event_date: finalEventDate,
        _study_bundle_free: bundleWaived,
        _payment_method: canonicalPaymentMethod,
      },
    }
    if (user?.id) {
      insertPayload.user_id = user.id
    }

    const { data: responseData, error } = await supabase
      .from('form_responses')
      .insert([insertPayload as any])
      .select()
      .single()

    if (error) {
      const dup =
        error.code === '23505' &&
        posting?.is_recurring &&
        (posting?.category === '스터디' || posting?.category === '언어교환')
      if (dup) {
        setHasDuplicateApplication(true)
        alert(
          locale === 'en'
            ? 'You already have an application for this session. If this is unexpected, please contact the organizer.'
            : '이번 회차에 이미 신청 내역이 있습니다. 문제가 있다면 운영진에게 문의해 주세요.'
        )
      } else {
        alert(error.message)
      }
    } else {
      // Move receipt to permanent location with response_id
      if (paymentMethod === 'bank' && paymentReceiptFile && paymentReceiptUrl) {
        try {
          const oldPath = paymentReceiptUrl.split('/payment-receipts/')[1]
          const fileExt = paymentReceiptFile.name.split('.').pop()
          const newPath = `payment-receipts/${responseData.id}/${Date.now()}.${fileExt}`

          // Copy to new location
          await supabase.storage
            .from('payment-receipts')
            .copy(oldPath, newPath)

          // Delete old file
          await supabase.storage
            .from('payment-receipts')
            .remove([oldPath])

          // Update URL in database
          const { data: { publicUrl } } = supabase.storage
            .from('payment-receipts')
            .getPublicUrl(newPath)

          await supabase
            .from('form_responses')
            .update({ payment_receipt_url: publicUrl })
            .eq('id', responseData.id)
        } catch (err) {
          console.error('Error moving receipt:', err)
        }
      }

      // QR is sent on the application complete page (Kakao/email), not on admin confirm.

      // 4. Trigger Webhook if exists
      if (form.webhook_url) {
        try {
          // Prepare data for webhook
          const webhookFormTitle =
            posting?.is_recurring &&
            (posting?.category === '언어교환' || posting?.category === '스터디') &&
            selectedDay
              ? buildAutoRecurringFormTitles(
                  selectedDay,
                  posting.category === '언어교환' ? 'language' : 'study'
                ).title
              : form.title

          const webhookData = {
            form_title: webhookFormTitle,
            submitted_at: new Date(responseData.created_at).toLocaleString(),
            qr_code: qrCode,
            payment_method: canonicalPaymentMethod,
            payment_status:
              feeWaived
                ? 'confirmed'
                : paymentMethod === 'bank'
                  ? 'pending'
                  : 'confirmed',
            responses: [
              ...questions.map(q => ({
                question: q.question_text,
                answer: Array.isArray(answers[q.id]) ? answers[q.id].join(', ') : answers[q.id]
              })),
              { question: "선택 요일", answer: selectedDay },
              { question: "선택 언어", answer: selectedLang },
              {
                question: "결제 방식",
                answer: canonicalPaymentMethod,
              },
            ]
          }

          // Send to webhook (non-blocking)
          fetch(form.webhook_url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(webhookData),
            mode: 'no-cors'
          }).catch(err => console.error('Webhook fetch error:', err))
        } catch (webhookErr) {
          console.error('Webhook trigger error:', webhookErr)
        }
      }
      router.push(`/apply/complete?id=${responseData.id}`)
    }
    setSubmitting(false)
  }

  const handlePreSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    
    const isRecurringLeOrStudy =
      !!posting?.is_recurring &&
      (posting?.category === '스터디' || posting?.category === '언어교환')

    // Validate Meeting specific selections
    if (isRecurringLeOrStudy) {
      if (!selectedDay) {
        alert(locale === 'en' ? 'Please select a meeting day' : '참여 요일을 선택해주세요')
        return
      }
      if (dayFormLoading || !dayFormReady) {
        alert(
          locale === 'en'
            ? 'The form is still loading. Please wait a moment.'
            : '폼을 불러오는 중입니다. 잠시 후 다시 시도해주세요.'
        )
        return
      }
      if (hasDuplicateApplication) {
        alert(
          locale === 'en'
            ? 'You already applied for this session.'
            : '이번 회차에 이미 신청하셨습니다.'
        )
        return
      }
      if (availableLangs.length > 0 && !selectedLang) {
        alert(locale === 'en' ? 'Please select a language' : '희망 언어를 선택해주세요')
        return
      }
    }

    // Validate required questions
    for (const q of questions) {
      if (q.is_required) {
        const answer = answers[q.id]
        if (!answer || (Array.isArray(answer) && answer.length === 0)) {
          const qText = locale === 'en' && q.question_text_en ? q.question_text_en : q.question_text
          alert(locale === 'en' ? `Please answer: ${qText}` : `필수 질문에 답변해주세요: ${qText}`)
          return
        }
      }
    }

    const hasBankAccount = !!posting?.bank_account;

    if (posting?.category === '스터디' || posting?.category === '언어교환' || hasBankAccount) {
      setShowPaymentModal(true)
    } else {
      handleSubmit(e)
    }
  }

  const copyToClipboard = (text: string) => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(text).then(() => {
        toast.success(locale === 'en' ? 'Account number copied!' : '계좌 번호가 복사되었습니다!')
      }).catch(() => {
        const el = document.createElement('textarea')
        el.value = text
        document.body.appendChild(el)
        el.select()
        document.execCommand('copy')
        document.body.removeChild(el)
        toast.success(locale === 'en' ? 'Account number copied!' : '계좌 번호가 복사되었습니다!')
      })
    } else {
      const el = document.createElement('textarea')
      el.value = text
      document.body.appendChild(el)
      el.select()
      document.execCommand('copy')
      document.body.removeChild(el)
      toast.success(locale === 'en' ? 'Account number copied!' : '계좌 번호가 복사되었습니다!')
    }
  }

  if (showApplyAuthGate && posting) {
    return (
      <div className="min-h-screen bg-muted overflow-x-hidden">
        <MainNav />
        <ApplyLoginModal
          locale={locale}
          returnPath={pathname || `/posting/${id}/apply`}
          onAuthed={() => {
            setShowApplyAuthGate(false)
            setLoading(true)
            setAuthRefreshTick((t) => t + 1)
          }}
        />
      </div>
    )
  }

  const isRecurringApplyAwaitingDay =
    !!posting?.is_recurring &&
    (posting?.category === '스터디' || posting?.category === '언어교환') &&
    !selectedDay

  const isRecurringApplyLoadingForm =
    !!posting?.is_recurring &&
    (posting?.category === '스터디' || posting?.category === '언어교환') &&
    !!selectedDay &&
    (dayFormLoading || !dayFormReady)

  // 반복 모임에서 요일 미선택 상태는 정상 — 요일 선택 UI를 보여줘야 한다.
  // selectedDay가 있는데 form이 아직 null이면 fetchScheduleForDay 로딩 중.
  if (!loading && posting && !form && !isRecurringApplyAwaitingDay) {
    return (
      <div className="min-h-screen bg-background overflow-x-hidden">
        <MainNav />
        <main className="mx-auto max-w-4xl w-full px-4 md:px-6 py-8 md:py-16">
          <div className="flex flex-col items-center justify-center gap-4 py-16 text-center">
            <Loader2 className="w-10 h-10 animate-spin text-primary" />
            <p className="text-muted-foreground font-bold">
              {locale === 'en' ? 'Loading form…' : '폼을 불러오는 중…'}
            </p>
          </div>
        </main>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-background overflow-x-hidden">
        <MainNav />
        <main className="mx-auto max-w-4xl w-full px-4 md:px-6 py-8 md:py-16">
          <div className="mb-8">
            <Skeleton className="h-10 w-10 rounded-full mb-4" />
            <Skeleton className="h-10 w-64 mb-2" />
            <Skeleton className="h-6 w-96" />
          </div>

          <div className="space-y-6">
            <Card className="rounded-[32px]">
              <CardHeader>
                <Skeleton className="h-8 w-48 mb-2" />
                <Skeleton className="h-4 w-full" />
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-2">
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-10 w-full rounded-lg" />
                </div>
                <div className="space-y-2">
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-10 w-full rounded-lg" />
                </div>
                <div className="space-y-2">
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-10 w-full rounded-lg" />
                </div>
              </CardContent>
            </Card>

            <Card className="rounded-[32px]">
              <CardHeader>
                <Skeleton className="h-8 w-48" />
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-2">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-24 w-full rounded-lg" />
                </div>
                <div className="space-y-2">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-24 w-full rounded-lg" />
                </div>
              </CardContent>
            </Card>

            <Skeleton className="h-14 w-full rounded-2xl" />
          </div>
        </main>
      </div>
    )
  }

  const displayTitle = locale === 'en' && posting?.title_en ? posting.title_en : posting?.title
  const isRecurringApply =
    !!posting?.is_recurring &&
    (posting?.category === '스터디' || posting?.category === '언어교환')
  const canSubmitApplication =
    !isRecurringApply ||
    (!!selectedDay && dayFormReady && !dayFormLoading && questions.length > 0)
  const displayCost = locale === 'en' && posting?.cost_en ? posting.cost_en : posting?.cost
  const studyReceiptWaived = posting?.category === '스터디' && studyBundleFree
  const sessionWaived = studyReceiptWaived

  return (
    <div className="min-h-screen bg-muted overflow-x-hidden">
      <MainNav />
      <main className="mx-auto max-w-3xl w-full px-4 md:px-6 py-12">
        <button 
          onClick={() => router.back()}
          className="flex items-center gap-2 text-muted-foreground hover:text-foreground font-bold transition-colors mb-8"
        >
          <ChevronLeft className="w-5 h-5" />
          {locale === 'en' ? 'Back' : '뒤로가기'}
        </button>

        <div className="space-y-8">
          <header className="space-y-4">
            <div className="inline-flex px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-black uppercase">
              {posting?.category}
            </div>
            <h1 className="text-3xl md:text-4xl font-black text-foreground tracking-tight leading-tight">
              {isRecurringApply
                ? displayTitle
                : locale === 'en' && form?.title_en
                  ? form.title_en
                  : form?.title}
            </h1>
            {!isRecurringApply &&
              (form?.description || form?.description_en) && (
                <p className="text-lg text-muted-foreground font-medium whitespace-pre-line">
                  {locale === 'en' && form?.description_en ? form.description_en : form?.description}
                </p>
              )}
          </header>

          <form onSubmit={handlePreSubmit} className="space-y-8">
            {/* 스터디 및 언어교환 요일/언어 선택 */}
            {(posting?.category === '스터디' || posting?.category === '언어교환') && posting?.is_recurring && (
              <Card className="border-primary/20 shadow-lg rounded-[32px] overflow-hidden bg-surface/10">
                <CardContent className="p-8 space-y-8">
                  <div className="space-y-4">
                    <Label className="text-lg font-black text-foreground flex items-center gap-2">
                      <span className="w-1.5 h-6 bg-primary rounded-full" />
                      {locale === 'en' ? 'Select Meeting Day' : '참여 요일 선택'} *
                    </Label>
                    {selectableMeetingDays !== undefined && selectableMeetingDays.length === 0 ? (
                      <p className="text-sm font-bold text-muted-foreground rounded-2xl bg-muted/60 px-4 py-3 border border-border/60">
                        {tDict.booking.noSelectableDaysThisWeek}
                      </p>
                    ) : (
                      <div className="flex flex-wrap gap-2">
                        {(() => {
                          const dayOrder = ['월', '화', '수', '목', '금', '토', '일']
                          const sortedDays = [...(selectableMeetingDays ?? [])].sort((a, b) => {
                            return dayOrder.indexOf(a) - dayOrder.indexOf(b)
                          })
                          return sortedDays.map((day: string) => (
                            <button
                              key={day}
                              type="button"
                              onClick={() => setSelectedDay(day)}
                              className={cn(
                                "px-6 py-3 rounded-2xl font-black transition-all border-2",
                                selectedDay === day
                                  ? "bg-primary text-white border-primary shadow-lg scale-105"
                                  : "bg-card text-muted-foreground border-border hover:border-primary/30"
                              )}
                            >
                              {day}{locale === 'en' ? '' : '요일'}
                            </button>
                          ))
                        })()}
                      </div>
                    )}
                    {selectedDay && sessionEventDate ? (
                      <p className="text-sm font-bold text-primary pt-1">
                        {locale === 'en'
                          ? `Session date: ${formatSessionDateLabel(sessionEventDate, 'en')}`
                          : `참석 예정일: ${formatSessionDateLabel(sessionEventDate, 'ko')}`}
                      </p>
                    ) : null}
                  </div>
                </CardContent>
              </Card>
            )}

            {isRecurringApply && selectedDay && user?.id && sessionEventDate.length >= 10 ? (
              duplicateApplicationPending ? (
                <div className="flex items-center gap-2 rounded-2xl border border-border bg-muted/40 px-4 py-3 text-sm font-bold text-muted-foreground">
                  <Loader2 className="w-4 h-4 animate-spin shrink-0" />
                  {locale === 'en' ? 'Checking existing applications…' : '기존 신청 여부 확인 중…'}
                </div>
              ) : hasDuplicateApplication ? (
                <div
                  role="alert"
                  className="flex gap-3 rounded-[24px] border-2 border-amber-500/50 bg-amber-500/10 px-5 py-4 text-foreground"
                >
                  <Info className="w-5 h-5 shrink-0 text-amber-700 mt-0.5" />
                  <div className="space-y-1 text-sm font-bold leading-relaxed">
                    <p>
                      {locale === 'en'
                        ? 'You already have an application for this session.'
                        : '이번 회차(선택한 요일·날짜)에 이미 신청하셨습니다.'}
                    </p>
                    <p className="text-muted-foreground font-medium text-xs md:text-sm">
                      {locale === 'en'
                        ? 'Duplicate applications for the same date are not allowed. If staff cancelled your previous application, you can apply again once it is removed.'
                        : '같은 회차로는 중복 신청할 수 없습니다. 운영자가 이전 신청을 삭제한 뒤에는 다시 신청하실 수 있습니다.'}
                    </p>
                  </div>
                </div>
              ) : null
            ) : null}

            {isRecurringApply && selectedDay && recurringAutoFormTitles && form ? (
              <section className="space-y-3 rounded-[28px] border border-primary/15 bg-card/80 px-6 py-6 md:px-8 md:py-7 shadow-sm">
                <h2 className="text-xl md:text-2xl font-black text-foreground tracking-tight leading-snug">
                  {locale === 'en'
                    ? recurringAutoFormTitles.title_en
                    : recurringAutoFormTitles.title}
                </h2>
                {(form?.description || form?.description_en) ? (
                  <p className="text-base text-muted-foreground font-medium whitespace-pre-line leading-relaxed">
                    {locale === 'en' && form?.description_en ? form.description_en : form?.description}
                  </p>
                ) : null}
              </section>
            ) : null}

            {isRecurringApply && selectedDay && isRecurringApplyLoadingForm ? (
              <div className="flex flex-col items-center justify-center gap-3 rounded-[28px] border border-border bg-muted/30 px-6 py-12 text-center">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
                <p className="text-sm font-bold text-muted-foreground">
                  {locale === 'en' ? 'Loading form for selected day…' : '선택한 요일의 폼을 불러오는 중…'}
                </p>
              </div>
            ) : null}

            {/* 요일 선택 후에만 질문 폼 표시 */}
            {(!posting?.is_recurring || selectedDay) && !isRecurringApplyLoadingForm && questions.map((q, idx) => {
              const qText = locale === 'en' && q.question_text_en ? q.question_text_en : q.question_text
              const qOptions = locale === 'en' && q.options_en ? q.options_en : q.options
              
              // 로그인 사용자의 온보딩 정보 질문만 읽기 전용 (drink 제외)
              const isOnboardingQuestion = user && userData && q.system_key && 
                ['name', 'gender', 'nationality', 'kakao_id'].includes(q.system_key)
              const isReadOnly = isOnboardingQuestion

              return (
                <Card key={q.id} className="border-none shadow-sm rounded-[32px] overflow-hidden bg-card">
                  <CardContent className="p-8 space-y-6">
                    <div className="space-y-2">
                      <Label className="text-lg font-black text-foreground flex items-start gap-2 whitespace-pre-line">
                        <span className="text-primary mt-0.5">{idx + 1}.</span>
                        <span className="flex-1">
                          {qText.replace(/\\n/g, '\n')}
                          {(q.is_required || q.system_key) && <span className="text-destructive ml-1">*</span>}
                        </span>
                      </Label>
                    </div>

                    <div className="mt-4">
                      {q.question_type === 'text' && (
                        <Input 
                          placeholder={locale === 'en' ? 'Short answer' : '답변을 입력하세요'}
                          value={answers[q.id] || ''}
                          onChange={(e) => handleInputChange(q.id, e.target.value)}
                          className={`h-12 rounded-xl border-border transition-all font-medium ${
                            isReadOnly 
                              ? 'bg-muted/30 text-foreground cursor-not-allowed' 
                              : 'bg-muted/50 focus:bg-card focus:ring-primary'
                          }`}
                          required={q.is_required}
                          disabled={isReadOnly}
                          readOnly={isReadOnly}
                        />
                      )}

                      {q.question_type === 'textarea' && (
                        <Textarea 
                          placeholder={locale === 'en' ? 'Long answer' : '상세한 답변을 입력하세요'}
                          value={answers[q.id] || ''}
                          onChange={(e) => handleInputChange(q.id, e.target.value)}
                          className={`min-h-[120px] rounded-2xl border-border transition-all font-medium resize-none ${
                            isReadOnly 
                              ? 'bg-muted/30 text-foreground cursor-not-allowed' 
                              : 'bg-muted/50 focus:bg-card focus:ring-primary'
                          }`}
                          required={q.is_required}
                          disabled={isReadOnly}
                          readOnly={isReadOnly}
                        />
                      )}

                      {q.question_type === 'radio' && (
                        <div className="space-y-3">
                          {qOptions?.map((opt: string, optIdx: number) => {
                            const isSelected = answers[q.id] === opt
                            return (
                              <div 
                                key={optIdx} 
                                onClick={() => !isReadOnly && handleInputChange(q.id, opt)}
                                className={`flex items-center space-x-3 p-4 rounded-2xl border transition-all ${
                                  isSelected
                                    ? 'border-primary bg-primary/10 shadow-sm'
                                    : 'border-border bg-muted/30'
                                } ${
                                  isReadOnly 
                                    ? 'cursor-not-allowed' 
                                    : 'hover:bg-muted hover:border-primary/30 cursor-pointer'
                                }`}
                              >
                                <input
                                  type="radio"
                                  name={q.id}
                                  value={opt}
                                  id={`${q.id}-${optIdx}`}
                                  checked={isSelected}
                                  onChange={(e) => handleInputChange(q.id, e.target.value)}
                                  className="w-4 h-4 text-primary border-border focus:ring-primary pointer-events-none"
                                  disabled={isReadOnly}
                                />
                                <Label htmlFor={`${q.id}-${optIdx}`} className={`flex-1 font-bold transition-colors ${
                                  isSelected ? 'text-primary' : 'text-foreground/70'
                                } ${
                                  isReadOnly ? 'cursor-not-allowed' : 'cursor-pointer'
                                }`}>
                                  {opt}
                                </Label>
                              </div>
                            )
                          })}
                        </div>
                      )}

                      {q.question_type === 'checkbox' && (
                        <div className="space-y-3">
                          {qOptions?.map((opt: string, optIdx: number) => {
                            const isChecked = (answers[q.id] || []).includes(opt)
                            return (
                              <div 
                                key={optIdx} 
                                onClick={() => !isReadOnly && handleCheckboxChange(q.id, opt, !isChecked)}
                                className={`flex items-center space-x-3 p-4 rounded-2xl border transition-all ${
                                  isChecked
                                    ? 'border-primary bg-primary/10 shadow-sm'
                                    : 'border-border bg-muted/30'
                                } ${
                                  isReadOnly 
                                    ? 'cursor-not-allowed' 
                                    : 'hover:bg-muted hover:border-primary/30 cursor-pointer'
                                }`}
                              >
                                <Checkbox 
                                  id={`${q.id}-${optIdx}`}
                                  checked={isChecked}
                                  onCheckedChange={(checked: boolean) => handleCheckboxChange(q.id, opt, !!checked)}
                                  className="border-border data-[state=checked]:bg-primary pointer-events-none"
                                  disabled={isReadOnly}
                                />
                                <Label htmlFor={`${q.id}-${optIdx}`} className={`flex-1 font-bold transition-colors ${
                                  isChecked ? 'text-primary' : 'text-foreground/70'
                                } ${
                                  isReadOnly ? 'cursor-not-allowed' : 'cursor-pointer'
                                }`}>
                                  {opt}
                                </Label>
                              </div>
                            )
                          })}
                        </div>
                      )}

                      {q.question_type === 'select' && (
                        <Select 
                          value={answers[q.id] || ''} 
                          onValueChange={(v) => handleInputChange(q.id, v)}
                          disabled={isReadOnly}
                        >
                          <SelectTrigger className={`h-12 rounded-xl border-border font-bold ${
                            isReadOnly 
                              ? 'bg-muted/30 text-foreground cursor-not-allowed' 
                              : 'bg-muted/50'
                          }`}>
                            <SelectValue placeholder={locale === 'en' ? 'Select an option' : '옵션을 선택하세요'} />
                          </SelectTrigger>
                          <SelectContent className="rounded-xl border-border">
                            {qOptions?.map((opt: string, optIdx: number) => (
                              <SelectItem key={optIdx} value={opt} className="font-bold">
                                {opt}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}
                    </div>
                  </CardContent>
                </Card>
              )
            })}

            <div className="pt-6">
              <Button 
                type="submit" 
                disabled={
                  submitting ||
                  !canSubmitApplication ||
                  (isRecurringApply &&
                    !!selectedDay &&
                    !!user?.id &&
                    (duplicateApplicationPending || hasDuplicateApplication))
                }
                className="w-full h-16 rounded-[24px] bg-primary hover:bg-secondary text-xl font-black shadow-2xl shadow-primary/30 transition-all active:scale-[0.98]"
              >
                {submitting ? (
                  <>
                    <Loader2 className="w-6 h-6 animate-spin mr-3" />
                    {locale === 'en' ? 'Submitting...' : '제출 중...'}
                  </>
                ) : (
                  locale === 'en' ? 'Submit Application' : '참여 신청하기'
                )}
              </Button>
            </div>
          </form>
        </div>
      </main>

      {/* Payment Selection & Info Modal */}
      {showPaymentModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-300 overflow-y-auto">
          <Card className="w-full max-w-md max-h-[min(90vh,720px)] flex flex-col border-none shadow-2xl rounded-[32px] overflow-hidden bg-card animate-in zoom-in-95 duration-300 my-auto">
            <CardHeader className="shrink-0 p-8 pb-4 text-center">
              <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
                <Wallet className="w-8 h-8 text-primary" />
              </div>
              <CardTitle className="text-2xl font-black text-foreground">
                {locale === 'en' ? 'Payment Method' : '결제 방식 선택'}
              </CardTitle>
              <div className="mt-2 space-y-1">
                {studyReceiptWaived ? (
                  <>
                    {displayCost ? (
                      <div className="text-base font-bold text-muted-foreground line-through">
                        {displayCost}
                      </div>
                    ) : null}
                    <div className="text-xl font-black text-emerald-600">
                      {locale === 'en'
                        ? 'Free (language exchange same date)'
                        : '무료 (같은 날짜 언어교환 신청 연동)'}
                    </div>
                  </>
                ) : (
                  <div className="text-xl font-black text-primary">
                    {displayCost || (locale === 'en' ? 'Free' : '무료')}
                  </div>
                )}
              </div>
              {studyReceiptWaived && (
                <p className="text-xs font-bold text-emerald-700 pt-1">
                  {locale === 'en'
                    ? 'No receipt required for this bundle. Confirm payment method below.'
                    : '번들 할인: 입금 영수증 없이 결제 수단만 확인하면 됩니다.'}
                </p>
              )}
              <CardDescription className="text-muted-foreground font-medium pt-2">
                {locale === 'en' 
                  ? 'Choose how you would like to pay for the session.' 
                  : '모임 참가를 위해 결제 방식을 선택해주세요.'}
              </CardDescription>
            </CardHeader>
            <CardContent className="flex-1 min-h-0 overflow-y-auto overscroll-contain p-8 pt-4 space-y-6 touch-pan-y">
              <div className="grid grid-cols-1 gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setPaymentMethod('bank')
                  }}
                  className={cn(
                    "flex flex-col items-center justify-center gap-2 p-6 rounded-2xl border-2 transition-all group",
                    paymentMethod === "bank"
                      ? "bg-primary border-primary text-white shadow-lg scale-[1.02]"
                      : "bg-card border-border text-muted-foreground hover:border-primary/30"
                  )}
                >
                  <span className="text-lg font-black">{locale === 'en' ? 'Bank Transfer' : '계좌이체'}</span>
                  <span className={cn("text-xs font-medium", paymentMethod === "bank" ? "text-white/80" : "text-muted-foreground")}>
                    {locale === 'en' ? 'Pay now via bank transfer' : '지금 바로 계좌로 이체'}
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setPaymentMethod('on_site')
                  }}
                  className={cn(
                    "flex flex-col items-center justify-center gap-2 p-6 rounded-2xl border-2 transition-all group",
                    paymentMethod === "on_site"
                      ? "bg-foreground border-foreground text-background shadow-lg scale-[1.02]"
                      : "bg-card border-border text-muted-foreground hover:border-border"
                  )}
                >
                  <span className="text-lg font-black">{locale === 'en' ? 'Pay on Site' : '현장현금'}</span>
                  <span className={cn("text-xs font-medium", paymentMethod === "on_site" ? "text-white/80" : "text-muted-foreground")}>
                    {locale === 'en' ? 'Pay at the venue' : '모임 장소에서 직접 결제'}
                  </span>
                </button>
              </div>

              {paymentMethod === "bank" && (
                <div className="p-5 rounded-2xl bg-muted border border-border space-y-4 animate-in slide-in-from-top-2 duration-300">
                  {posting?.bank_account ? (
                    <div className="space-y-2">
                      <span className="text-xs font-black text-muted-foreground uppercase tracking-wider">
                        {locale === 'en' ? 'Account Info' : '입금 계좌'}
                      </span>
                      {posting.bank_account_name && (
                        <p className="text-sm font-bold text-foreground">
                          {posting.bank_account_name}
                        </p>
                      )}
                      <button
                        type="button"
                        onClick={() => copyToClipboard(posting.bank_account)}
                        className="w-full flex items-center justify-between gap-3 rounded-2xl border-2 border-primary/30 bg-primary/5 hover:bg-primary/10 active:scale-[0.98] transition-all px-5 py-4 group"
                        title={locale === 'en' ? 'Tap to copy account number' : '눌러서 계좌 번호 복사'}
                      >
                        <span className="text-lg md:text-xl font-black text-foreground tracking-wider break-all text-left leading-snug">
                          {posting.bank_account}
                        </span>
                        <span className="shrink-0 flex items-center gap-1 text-xs font-black text-primary bg-primary/10 group-hover:bg-primary/20 rounded-lg px-3 py-1.5 transition-colors">
                          <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
                            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
                          </svg>
                          {locale === 'en' ? 'Copy' : '복사'}
                        </span>
                      </button>
                      <p className="text-[11px] text-muted-foreground font-medium text-center">
                        {locale === 'en' ? 'Tap the number above to copy' : '계좌 번호를 누르면 바로 복사됩니다'}
                      </p>
                    </div>
                  ) : (
                    <p className="text-sm text-amber-800 dark:text-amber-200 font-bold leading-relaxed rounded-xl bg-amber-500/10 border border-amber-500/20 p-3">
                      {locale === 'en'
                        ? 'No bank account is set for this listing. You can still attach your transfer receipt below if you were given account details elsewhere.'
                        : '등록된 입금 계좌가 없습니다. 별도로 안내받은 계좌로 송금하신 경우 아래에서 영수증을 첨부해 주세요.'}
                    </p>
                  )}

                  {!sessionWaived ? (
                    <div className="space-y-3 pt-3 border-t border-border/50">
                      <div className="flex items-center gap-2">
                        <Upload className="w-4 h-4 text-primary shrink-0" />
                        <span className="text-sm font-bold text-foreground">
                          {locale === 'en' ? 'Upload Payment Receipt' : '입금 영수증 업로드'}
                        </span>
                        <span className="text-xs text-destructive font-bold">*</span>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {locale === 'en' 
                          ? 'Please upload a photo of your bank transfer receipt.' 
                          : '입금 완료 후 영수증 사진을 업로드해주세요.'}
                      </p>
                      <PaymentReceiptUploader
                        locale={locale}
                        onFileSelect={(file) => {
                          setPaymentReceiptFile(file)
                        }}
                        onRemove={() => {
                          setPaymentReceiptFile(null)
                        }}
                      />
                    </div>
                  ) : (
                    <p className="text-sm font-bold text-emerald-700 pt-3 border-t border-border/50">
                      {locale === 'en'
                        ? 'Receipt upload is not required for this free bundle.'
                        : '번들 무료 신청 — 영수증 업로드는 필요하지 않습니다.'}
                    </p>
                  )}

                  <p className="text-[11px] text-muted-foreground font-medium leading-tight flex items-start gap-1">
                    <span className="text-amber-500 shrink-0">*</span>
                    <span>
                      {sessionWaived
                        ? locale === 'en'
                          ? 'Complete below to finish your application.'
                          : '아래에서 신청을 완료해 주세요.'
                        : locale === 'en' 
                          ? 'Your QR code will be sent via KakaoTalk or email right after you apply.' 
                          : '신청 직후 카카오톡 또는 이메일로 QR 코드가 발송됩니다.'}
                    </span>
                  </p>
                </div>
              )}

              {paymentMethod === "on_site" && (
                <div className="p-5 rounded-2xl bg-emerald-50 border border-emerald-100 animate-in slide-in-from-top-2 duration-300">
                  <p className="text-sm text-emerald-700 font-bold leading-relaxed">
                    {locale === 'en' 
                      ? 'Please prepare the exact amount for on-site payment. Thank you!' 
                      : '원활한 진행을 위해 현장 결제 금액을 미리 준비해 주시면 감사하겠습니다.'}
                  </p>
                </div>
              )}

              <div className="flex gap-3 pt-2">
                <Button 
                  variant="outline" 
                  onClick={() => {
                    setShowPaymentModal(false)
                    setPaymentMethod('')
                  }}
                  className="flex-1 h-14 rounded-2xl border-border text-muted-foreground font-bold hover:bg-muted"
                >
                  {locale === 'en' ? 'Cancel' : '취소'}
                </Button>
                <Button 
                  onClick={handleSubmit as any}
                  disabled={
                    submitting ||
                    !canSubmitApplication ||
                    (!sessionWaived &&
                      (!paymentMethod ||
                        (paymentMethod === 'bank' && !paymentReceiptFile)))
                  }
                  className="flex-2 h-14 rounded-2xl bg-primary hover:bg-secondary text-lg font-black shadow-lg shadow-primary/20 disabled:opacity-50"
                >
                  {submitting ? <Loader2 className="w-5 h-5 animate-spin" /> : (locale === 'en' ? 'Complete' : '신청 완료하기')}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}
