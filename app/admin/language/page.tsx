'use client'

import { useEffect, useState, Suspense, useCallback, useRef } from 'react'
import { PageHeader } from '@/components/admin/page-header'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import { useLocale } from '@/hooks/use-locale'
import { buildAutoRecurringFormTitles } from '@/lib/session-event-date'
import { 
  Loader2,
  Save,
  ClipboardList,
  Users,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

import { cn } from '@/lib/utils'
import { BasicInfoFields } from '@/components/admin/basic-info-fields'
import { HostInfoCard } from '@/components/admin/host-info-card'
import { useFormManager } from '@/hooks/use-form-manager'
import { FormData as FormBuilderData } from '@/components/admin/form-builder'
import { ApplyMethodCard } from '@/components/admin/apply-method-card'
import { LanguageResponsesPanel } from '@/components/admin/language-responses-panel'
import { BankAccountCard } from '@/components/admin/bank-account-card'
import { fetchFormBuilderData, buildDefaultLanguageFormData } from '@/lib/load-form-data'
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Switch } from '@/components/ui/switch'
import { useAdminAuth } from '@/hooks/use-admin-auth'

const WEEK_DAYS = ["월", "화", "수", "목", "금", "토", "일"];


function LanguageManagementContent() {
  const locale = useLocale();
  const { ready: authReady } = useAdminAuth({ requireSuper: true });
  const supabase = createClient();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState(WEEK_DAYS[0]);
  const [masterPosting, setMasterPosting] = useState<any>(null);
  const [schedules, setSchedules] = useState<Record<string, any>>({});
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [activeInnerTab, setActiveInnerTab] = useState<"questions" | "responses">("questions");
  const [responses, setResponses] = useState<any[]>([]);
  const [loadingResponses, setLoadingResponses] = useState(false);
  const [formQuestions, setFormQuestions] = useState<any[]>([]);
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const [deletingResponseId, setDeletingResponseId] = useState<string | null>(null);

  const [formDetailsByDay, setFormDetailsByDay] = useState<Record<string, FormBuilderData>>({});
  const [formLoadingByDay, setFormLoadingByDay] = useState<Record<string, boolean>>({});
  const formHydratedKeyRef = useRef<Record<string, string>>({});
  const { saveForm } = useFormManager(null);

  const handleFormDataChangeForDay = useCallback((day: string, data: FormBuilderData) => {
    setFormDetailsByDay((prev) => ({ ...prev, [day]: data }));
  }, []);

  useEffect(() => {
    const fetchInitialData = async () => {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      let profile = null;
      if (user) {
        const { data: p } = await supabase.from("profiles").select("*").eq("id", user.id).single();
        profile = p;
        setCurrentUser(profile);
      }
      
      const { data: master } = await supabase
        .from("postings")
        .select("*")
        .eq("category", "언어교환")
        .is("day_of_week", null)
        .single();
      
      setMasterPosting(master || {
        category: "언어교환",
        title: "언어교환 모임",
        description_ko: "",
        description_en: "",
        status: "active"
      });
      
      const { data: scheduleData } = await supabase
        .from("language_exchange_schedules")
        .select("*")
        .eq("posting_id", master?.id);
      
      const scheduleMap: Record<string, any> = {};
      WEEK_DAYS.forEach((day) => {
        const existing = scheduleData?.find((s) => s.day_of_week === day);
        scheduleMap[day] = existing || {
          day_of_week: day,
          time: "19:00",
          location: "홍대입구역 인근",
          max_participants: 50,
          is_active: false,
          form_id: null
        };
      });
      setSchedules(scheduleMap);
      setLoading(false);
    };
    fetchInitialData();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- mount once
  }, []);

  useEffect(() => {
    if (loading) return
    let cancelled = false

    async function hydrateFormsForSchedules() {
      for (const day of WEEK_DAYS) {
        const schedule = schedules[day]
        if (!schedule) continue

        const formId = schedule.form_id as string | null
        const hydrateKey = formId ?? `__default__:${day}`

        if (formHydratedKeyRef.current[day] === hydrateKey) continue

        setFormLoadingByDay((prev) => ({ ...prev, [day]: true }))
        try {
          let data: FormBuilderData
          if (formId) {
            const loaded = await fetchFormBuilderData(formId)
            if (cancelled || !loaded) continue
            const auto = buildAutoRecurringFormTitles(day, 'language')
            data = { ...loaded, title: auto.title, title_en: auto.title_en }
          } else {
            data = buildDefaultLanguageFormData(day)
          }
          if (cancelled) continue
          formHydratedKeyRef.current[day] = hydrateKey
          setFormDetailsByDay((prev) => ({ ...prev, [day]: data }))
        } finally {
          if (!cancelled) {
            setFormLoadingByDay((prev) => ({ ...prev, [day]: false }))
          }
        }
      }
    }

    void hydrateFormsForSchedules()
    return () => {
      cancelled = true
    }
  }, [schedules, loading])

  const handleMasterFieldChange = (field: string, value: any) => {
    setMasterPosting((prev: any) => ({ ...prev, [field]: value }));
  };

  const handleScheduleFieldChange = (day: string, field: string, value: any) => {
    setSchedules((prev) => ({
      ...prev,
      [day]: { ...prev[day], [field]: value }
    }));
  };

  // Fetch responses when inner tab changes to "responses"
  useEffect(() => {
    if (activeInnerTab === "responses" && schedules[activeTab]?.form_id) {
      fetchResponses(schedules[activeTab].form_id);
    }
  }, [activeInnerTab, activeTab, schedules]);

  const fetchResponses = async (formId: string) => {
    if (!formId) {
      setResponses([]);
      setFormQuestions([]);
      return;
    }

    // 현재 주 범위 계산 (서울 UTC+9, 일요일 시작)
    const seoulNow = new Date(Date.now() + 9 * 60 * 60 * 1000);
    const dayOfWeekSeoul = seoulNow.getUTCDay(); // 0=일, 6=토
    const weekStartMs = seoulNow.getTime() - dayOfWeekSeoul * 86400000;
    const weekEndMs = weekStartMs + 6 * 86400000;
    const weekStartYmd = new Date(weekStartMs).toISOString().slice(0, 10);
    const weekEndYmd = new Date(weekEndMs).toISOString().slice(0, 10);

    setLoadingResponses(true);
    try {
      // Fetch questions first
      const { data: questions } = await supabase
        .from('form_questions')
        .select('*')
        .eq('form_id', formId)
        .order('display_order', { ascending: true });

      if (questions) {
        setFormQuestions(questions);
      }

      // 현재 주 세션(_event_date 기준)만 조회 — 지난 주 데이터와 혼용 방지
      const { data: responseData } = await supabase
        .from('form_responses')
        .select('*')
        .eq('form_id', formId)
        .gte('answers->>_event_date', weekStartYmd)
        .lte('answers->>_event_date', weekEndYmd)
        .order('created_at', { ascending: false });

      if (responseData) {
        setResponses(responseData);
      }
    } catch (error) {
      console.error('Error fetching responses:', error);
    } finally {
      setLoadingResponses(false);
    }
  };

  const handleConfirmPayment = async (response: any) => {
    setConfirmingId(response.id);

    try {
      const { error: updateError } = await supabase
        .from('form_responses')
        .update({ payment_status: 'confirmed' })
        .eq('id', response.id);

      if (updateError) {
        alert(locale === 'en' ? 'Failed to confirm payment' : '입금 확인에 실패했습니다');
        return;
      }

      alert(locale === 'en' ? 'Payment confirmed.' : '입금 확인 완료.');
      fetchResponses(schedules[activeTab].form_id);
    } catch (error) {
      console.error('Error confirming payment:', error);
      alert(locale === 'en' ? 'Failed to confirm payment' : '입금 확인에 실패했습니다');
    } finally {
      setConfirmingId(null);
    }
  };

  const handleCancelResponse = async (res: { id: string }) => {
    const msg =
      locale === 'en'
        ? 'Delete this application permanently? The participant will be notified (Kakao Talk or email). This cannot be undone.'
        : '이 신청을 삭제할까요? 참가자에게 카카오톡(나에게 보내기) 또는 이메일로 취소 안내가 발송되며, 되돌릴 수 없습니다.';
    if (!window.confirm(msg)) return;

    setDeletingResponseId(res.id);
    try {
      const r = await fetch('/api/admin/cancel-form-response', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ responseId: res.id }),
      });
      const data = await r.json().catch(() => ({}));
      if (!r.ok) {
        alert(
          (data as { error?: string }).error ||
            (locale === 'en' ? 'Delete failed' : '삭제에 실패했습니다')
        );
        return;
      }
      const notify = (data as {
        notify?: { kakao?: string; email?: string; detail?: string; skippedNoUser?: boolean }
      }).notify;
      if (notify?.skippedNoUser) {
        alert(
          locale === 'en'
            ? 'Application removed. No user account was linked, so no notification was sent.'
            : '신청이 삭제되었습니다. 연결된 계정이 없어 알림은 발송되지 않았습니다.'
        );
      } else if (notify?.kakao === 'failed' && notify?.email === 'failed') {
        alert(
          locale === 'en'
            ? 'Application removed, but both Kakao and email notifications failed. Please contact the participant manually.'
            : '신청은 삭제되었으나 카카오·이메일 알림이 모두 실패했을 수 있습니다. 필요 시 직접 연락해 주세요.'
        );
      } else if (notify?.kakao === 'failed' && notify?.email !== 'sent') {
        alert(
          locale === 'en'
            ? 'Application removed. Kakao notification failed (email not sent or unavailable).'
            : '신청은 삭제되었으나 카카오 알림에 실패했습니다. 이메일이 없거나 발송되지 않았을 수 있습니다.'
        );
      } else {
        alert(
          locale === 'en'
            ? 'Application cancelled and the participant was notified (if contact was available).'
            : '삭제되었으며, 가능한 경우 참가자에게 안내를 발송했습니다.'
        );
      }
      fetchResponses(schedules[activeTab].form_id);
    } catch (e) {
      console.error(e);
      alert(locale === 'en' ? 'Delete failed' : '삭제 중 오류가 발생했습니다');
    } finally {
      setDeletingResponseId(null);
    }
  };

  const handleSave = async () => {
    if (!masterPosting) return;
    setSaving(true);

    try {
      const { id: masterId, created_at, updated_at, ...masterData } = masterPosting;
      
      let savedMasterId = masterId;
      if (masterId) {
        await supabase.from("postings").update(masterData).eq("id", masterId);
      } else {
        const { data: newMaster } = await supabase.from("postings").insert({
          ...masterData,
          created_by: currentUser?.id
        }).select().single();
        savedMasterId = newMaster?.id;
        setMasterPosting((prev: any) => ({ ...prev, id: savedMasterId }));
      }

      const nextSchedules = { ...schedules };

      for (const day of WEEK_DAYS) {
        const currentSchedule = nextSchedules[day];
        if (!currentSchedule) continue;

        let formId = currentSchedule.form_id;
        const dayFormDetails = formDetailsByDay[day];

        if (dayFormDetails) {
          const auto = buildAutoRecurringFormTitles(day, 'language');
          const mergedForm = { ...dayFormDetails, title: auto.title, title_en: auto.title_en };
          const newFormId = await saveForm(mergedForm, currentSchedule.form_id);
          if (!newFormId) {
            alert(`${day}요일 폼 저장에 실패했습니다.`);
            setSaving(false);
            return;
          }
          formId = newFormId;
        }

        const { id: scheduleId, created_at: _ca, updated_at: _ua, ...scheduleData } = {
          ...currentSchedule,
          posting_id: savedMasterId,
          form_id: formId
        };

        if (scheduleId) {
          const { error } = await supabase
            .from("language_exchange_schedules")
            .update(scheduleData)
            .eq("id", scheduleId);
          if (error) throw error;
          nextSchedules[day] = { ...currentSchedule, ...scheduleData, id: scheduleId, form_id: formId };
        } else {
          const { data: newSchedule, error } = await supabase
            .from("language_exchange_schedules")
            .insert(scheduleData)
            .select()
            .single();
          if (error) throw error;
          nextSchedules[day] = { ...currentSchedule, ...newSchedule, form_id: formId };
        }
      }

      setSchedules(nextSchedules);
      for (const day of WEEK_DAYS) {
        const formId = nextSchedules[day]?.form_id as string | null
        formHydratedKeyRef.current[day] = formId ?? `__default__:${day}`
      }
      alert(locale === 'en' ? 'All weekday settings saved.' : '모든 요일 설정이 저장되었습니다.');
    } catch (error: any) {
      alert(error.message || "저장 중 오류가 발생했습니다.");
    }
    setSaving(false);
  };

  if (!authReady || loading) {
    return <div className="min-h-screen flex items-center justify-center bg-background">
      <Loader2 className="w-10 h-10 animate-spin text-primary" />
    </div>;
  }

  return <div className="min-h-screen bg-muted p-4 md:p-10 pb-32">
    <div className="max-w-5xl mx-auto space-y-8">
      <PageHeader title="언어교환 설정" titleEn="Language Exchange Settings" description="요일별로 반복되는 정기 언어교환 정보를 설정하세요." descriptionEn="Configure the recurring language exchange for each day of the week." />

      <BankAccountCard
        bankAccountName={masterPosting?.bank_account_name || ''}
        bankAccount={masterPosting?.bank_account || ''}
        onBankAccountNameChange={(val) => setMasterPosting((prev: any) => ({ ...prev, bank_account_name: val }))}
        onBankAccountChange={(val) => setMasterPosting((prev: any) => ({ ...prev, bank_account: val }))}
      />

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-7 h-14 p-2 rounded-[20px] bg-muted/80">
          {WEEK_DAYS.map((day) => {
            const isDayActive = schedules[day]?.is_active;
            return (
              <TabsTrigger 
                key={day} 
                value={day} 
                className={cn(
                  "h-full rounded-[14px] text-sm font-black transition-all relative", 
                  activeTab === day ? "bg-primary text-primary-foreground shadow-lg" : "text-muted-foreground",
                  !isDayActive && activeTab !== day && "text-muted-foreground/40"
                )}
              >
                {day}
                {isDayActive && <div className="w-2 h-2 rounded-full bg-green-400 absolute top-2 right-2 shadow-lg" />}
              </TabsTrigger>
            )
          })}
        </TabsList>

        {WEEK_DAYS.map((day) => {
          const currentData = schedules[day] || {};
          return <TabsContent key={day} value={day} className="mt-6">
            <div className="space-y-8">
              <Card className="border-none shadow-sm rounded-[32px] overflow-hidden bg-card">
                <CardHeader className="p-8 pb-0 flex flex-row items-center justify-between">
                  <CardTitle className="text-lg font-black flex items-center gap-2 text-foreground">
                    <div className="w-1.5 h-6 bg-primary rounded-full" />
                    {day}요일 기본 정보
                  </CardTitle>
                  <div className="flex items-center gap-3">
                    <Label htmlFor={`status-switch-${day}`} className={cn("font-bold", currentData.is_active ? 'text-primary' : 'text-muted-foreground')}>
                      {currentData.is_active ? '활성화됨' : '비활성화됨'}
                    </Label>
                    <Switch
                      id={`status-switch-${day}`}
                      checked={currentData.is_active || false}
                      onCheckedChange={(checked: boolean) => handleScheduleFieldChange(day, 'is_active', checked)}
                    />
                  </div>
                </CardHeader>
                <CardContent className="p-8 space-y-6">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label className="text-sm font-bold text-muted-foreground">시간</Label>
                      <Input 
                        type="time" 
                        value={currentData.time || "19:00"} 
                        onChange={(e) => handleScheduleFieldChange(day, "time", e.target.value)}
                        className="rounded-xl"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-sm font-bold text-muted-foreground">정원</Label>
                      <Input 
                        type="number" 
                        value={currentData.max_participants || 50} 
                        onChange={(e) => handleScheduleFieldChange(day, "max_participants", parseInt(e.target.value))}
                        className="rounded-xl"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-sm font-bold text-muted-foreground">장소</Label>
                    <Input 
                      value={currentData.location || ""} 
                      onChange={(e) => handleScheduleFieldChange(day, "location", e.target.value)}
                      placeholder="홍대입구역 인근"
                      className="rounded-xl"
                    />
                  </div>
                </CardContent>
              </Card>

              {/* 질문 / 응답 탭 */}
              <Card className="border-none shadow-sm rounded-[32px] overflow-hidden bg-card">
                <CardHeader className="p-8 pb-0">
                  <Tabs value={activeInnerTab} onValueChange={(v) => setActiveInnerTab(v as "questions" | "responses")} className="w-full">
                    <TabsList className="grid w-full grid-cols-2 h-12 p-1 rounded-xl bg-muted">
                      <TabsTrigger 
                        value="questions" 
                        className="rounded-lg text-sm font-black data-[state=active]:bg-card data-[state=active]:shadow-sm"
                      >
                        <ClipboardList className="w-4 h-4 mr-2" />
                        {locale === 'en' ? 'Questions' : '질문'}
                      </TabsTrigger>
                      <TabsTrigger 
                        value="responses" 
                        className="rounded-lg text-sm font-black data-[state=active]:bg-card data-[state=active]:shadow-sm"
                      >
                        <Users className="w-4 h-4 mr-2" />
                        {locale === 'en' ? 'Responses' : '응답'}
                        {responses.length > 0 && activeInnerTab !== "responses" && (
                          <span className="ml-2 px-2 py-0.5 bg-primary text-primary-foreground text-xs rounded-full">
                            {responses.length}
                          </span>
                        )}
                      </TabsTrigger>
                    </TabsList>

                    <TabsContent value="questions" className="mt-6">
                      {activeTab === day ? (
                        <ApplyMethodCard 
                          locale={locale}
                          loadingForm={Boolean(formLoadingByDay[day])}
                          currentFormDetails={formDetailsByDay[day]}
                          onFormDataChange={(data) => handleFormDataChangeForDay(day, data)}
                          mode="language"
                          recurringDayKo={day}
                          lockedSystemKeys={['name', 'gender', 'nationality', 'language', 'kakao_id', 'drink']}
                        />
                      ) : null}
                    </TabsContent>

                    <TabsContent value="responses" className="mt-6">
                      {loadingResponses ? (
                        <div className="py-20 text-center">
                          <Loader2 className="w-10 h-10 animate-spin text-primary mx-auto mb-4" />
                          <p className="font-bold text-muted-foreground">
                            {locale === 'en' ? 'Loading responses...' : '응답을 불러오는 중...'}
                          </p>
                        </div>
                      ) : !currentData.form_id ? (
                        <div className="py-20 text-center">
                          <ClipboardList className="w-12 h-12 text-muted-foreground/40 mx-auto mb-4" />
                          <p className="font-bold text-muted-foreground">
                            {locale === 'en' ? 'No form linked yet.' : '아직 폼이 연결되지 않았습니다.'}
                          </p>
                          <p className="text-sm text-muted-foreground mt-2">
                            {locale === 'en' ? 'Please create a form first in the Questions tab.' : '질문 탭에서 먼저 폼을 생성해주세요.'}
                          </p>
                        </div>
                      ) : responses.length === 0 ? (
                        <div className="py-20 text-center">
                          <Users className="w-12 h-12 text-muted-foreground/40 mx-auto mb-4" />
                          <p className="font-bold text-muted-foreground">
                            {locale === 'en' ? 'No responses yet.' : '아직 접수된 신청이 없습니다.'}
                          </p>
                        </div>
                      ) : (
                        <LanguageResponsesPanel
                          locale={locale === 'en' ? 'en' : 'ko'}
                          responses={responses}
                          formQuestions={formQuestions}
                          confirmingId={confirmingId}
                          deletingResponseId={deletingResponseId}
                          onRefresh={() => fetchResponses(currentData.form_id)}
                          onConfirmPayment={handleConfirmPayment}
                          onCancelResponse={handleCancelResponse}
                        />
                      )}
                    </TabsContent>
                  </Tabs>
                </CardHeader>
              </Card>
            </div>
          </TabsContent>;
        })}
      </Tabs>

      <div className="mt-12">
        <Button onClick={handleSave} disabled={saving} className="w-full h-16 rounded-2xl bg-primary hover:bg-primary/90 text-xl font-black shadow-xl transition-all active:scale-[0.98]">
          {saving ? <Loader2 className="w-6 h-6 animate-spin mr-3" /> : <><Save className="w-4 h-4 mr-2" /> {locale === 'en' ? 'Save all settings' : '전체 설정 저장'}</>}
        </Button>
      </div>
    </div>
  </div>;
}

export default function LanguageManagementPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center bg-background"><Loader2 className="w-10 h-10 animate-spin text-primary" /></div>}>
      <LanguageManagementContent />
    </Suspense>
  )
}
