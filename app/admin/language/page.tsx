'use client'

import { useEffect, useState, Suspense } from 'react'
import { PageHeader } from '@/components/admin/page-header'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import { useLocale } from '@/hooks/use-locale'
import { 
  ChevronLeft,
  Loader2,
  Save,
  Globe,
  Info,
  Clock,
  MapPin,
  User as UserIcon,
  Upload,
  ClipboardList,
  Plus,
  Minus
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

import { cn } from '@/lib/utils'
import { TiptapEditorCard } from '@/components/admin/tiptap-editor-card'
import { BasicInfoFields } from '@/components/admin/basic-info-fields'
import { HostInfoCard } from '@/components/admin/host-info-card'
import { useFormManager } from '@/hooks/use-form-manager'
import { FormBuilder, FormData as FormBuilderData } from '@/components/admin/form-builder'
import { ApplyMethodCard } from '@/components/admin/apply-method-card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Switch } from '@/components/ui/switch'

const WEEK_DAYS = ["월", "화", "수", "목", "금", "토", "일"];

const getDefaultDayData = (day: string, user: any) => ({
  id: null,
  day_of_week: day,
  category: "언어교환",
  title: `${day}요일 정기 언어교환`,
  title_en: `Regular Language Exchange - ${day}`,
  description: `매주 ${day}요일에 진행되는 언어교환 모임입니다.`,
  description_en: `Weekly language exchange on ${day}s.`,
  location: "홍대입구역 인근",
  location_en: "Near Hongdae Station",
  start_time: "19:00",
  end_time: "21:00",
  host: (user == null ? void 0 : user.name) || "운영진",
  host_en: (user == null ? void 0 : user.name_en) || "Staff",
  is_recurring: true,
  status: "inactive",
  image_url: "",
  apply_type: "form",
  form_id: null,
  rich_content: "",
  rich_content_en: "",
  created_by: user == null ? void 0 : user.id
});

function LanguageManagementContent() {
  const locale = useLocale();
  const supabase = createClient();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState(WEEK_DAYS[0]);
  const [daySettings, setDaySettings] = useState<Record<string, any>>({});
  const [currentUser, setCurrentUser] = useState<any>(null);

  const { formDetails, setFormDetails, saveForm, loadingForm } = useFormManager(daySettings[activeTab]?.form_id);

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
      const { data: postings } = await supabase.from("postings").select("*").eq("category", "언어교환");
      const settings: Record<string, any> = {};
      WEEK_DAYS.forEach((day) => {
        settings[day] = postings?.find((p) => p.day_of_week === day) || getDefaultDayData(day, profile);
      });
      setDaySettings(settings);
      setLoading(false);
    };
    fetchInitialData();
  }, [supabase]);

  const handleFieldChange = (day: string, field: string, value: any) => {
    setDaySettings((prev) => ({
      ...prev,
      [day]: { ...prev[day], [field]: value }
    }));
  };

  const handleSave = async () => {
    const currentSettings = daySettings[activeTab];
    if (!currentSettings) return;

    if (currentSettings.created_by && currentUser && currentSettings.created_by !== currentUser.id) {
      alert(locale === "en" ? "You can only edit your own postings." : "본인이 작성한 포스팅만 수정할 수 있습니다.");
      return;
    }

    setSaving(true);

    let formId = currentSettings.form_id;
    if (formDetails) {
      const newFormId = await saveForm(formDetails, currentSettings.form_id);
      if (newFormId) {
        formId = newFormId;
      } else {
        alert("폼 저장에 실패했습니다.");
        setSaving(false);
        return;
      }
    }

    // recurring_days와 recurring_settings 자동 생성
    const recurringDays = [activeTab];
    const recurringSettings = {
      [activeTab]: {
        languages: ["영어", "일본어"],
        location: currentSettings.location || "강남역 인근"
      }
    };

    const { id, created_at, updated_at, ...upsertData } = {
      ...currentSettings,
      form_id: formId,
      recurring_days: recurringDays,
      recurring_settings: recurringSettings,
    };

    const { error } = await supabase.from("postings").upsert(upsertData, {
      onConflict: "category,day_of_week"
    });

    if (error) {
      alert(error.message);
    } else {
      alert(`${activeTab}요일 설정이 저장되었습니다.`);
      // Refetch data for the current tab to get the updated id if it was a new insert
      const { data: newPosting } = await supabase.from('postings').select('*').eq('category', '언어교환').eq('day_of_week', activeTab).single();
      if (newPosting) {
        handleFieldChange(activeTab, 'id', newPosting.id);
        handleFieldChange(activeTab, 'form_id', newPosting.form_id);
      }
    }
    setSaving(false);
  };

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center bg-background">
      <Loader2 className="w-10 h-10 animate-spin text-primary" />
    </div>;
  }

  return <div className="min-h-screen bg-muted p-4 md:p-10 pb-32">
    <div className="max-w-5xl mx-auto space-y-8">
      <PageHeader title="언어교환 설정" titleEn="Language Exchange Settings" description="요일별로 반복되는 정기 언어교환 정보를 설정하세요." descriptionEn="Configure the recurring language exchange for each day of the week." />

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-7 h-14 p-2 rounded-[20px] bg-muted/80">
          {WEEK_DAYS.map((day) => {
            const isDayActive = daySettings[day]?.status === 'active';
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
          const currentData = daySettings[day] || {};
          return <TabsContent key={day} value={day} className="mt-6">
            <div className="space-y-8">
              <Card className="border-none shadow-sm rounded-[32px] overflow-hidden bg-card">
                <CardHeader className="p-8 pb-0 flex flex-row items-center justify-between">
                  <CardTitle className="text-lg font-black flex items-center gap-2 text-foreground">
                    <div className="w-1.5 h-6 bg-primary rounded-full" />
                    {day}요일 기본 정보
                  </CardTitle>
                  <div className="flex items-center gap-3">
                    <Label htmlFor={`status-switch-${day}`} className={cn("font-bold", currentData.status === 'active' ? 'text-primary' : 'text-muted-foreground')}>
                      {currentData.status === 'active' ? '활성화됨' : '비활성화됨'}
                    </Label>
                    <Switch
                      id={`status-switch-${day}`}
                      checked={currentData.status === 'active'}
                      onCheckedChange={(checked: boolean) => handleFieldChange(day, 'status', checked ? 'active' : 'inactive')}
                    />
                  </div>
                </CardHeader>
                <CardContent className="p-8 space-y-8">
                  <BasicInfoFields title={currentData.title} titleEn={currentData.title_en} date={currentData.date} startTime={currentData.start_time} endTime={currentData.end_time} location={currentData.location} imageUrl={currentData.image_url} isDateUndecided={true} isTimeUndecided={false} isLocationUndecided={false} hideDateField={true} onTitleChange={(val) => handleFieldChange(day, "title", val)} onTitleEnChange={(val) => handleFieldChange(day, "title_en", val)} onDateChange={(val) => handleFieldChange(day, "date", val)} onStartTimeChange={(val) => handleFieldChange(day, "start_time", val)} onEndTimeChange={(val) => handleFieldChange(day, "end_time", val)} onLocationChange={(val) => handleFieldChange(day, "location", val)} onImageUrlChange={(val) => handleFieldChange(day, "image_url", val)} onDateUndecidedChange={() => {
                  }} onTimeUndecidedChange={() => {
                  }} onLocationUndecidedChange={() => {
                  }} />
                </CardContent>
              </Card>

              <HostInfoCard host={currentData.host} hostEn={currentData.host_en} onHostChange={(val) => handleFieldChange(day, "host", val)} onHostEnChange={(val) => handleFieldChange(day, "host_en", val)} readOnly={true} />

              <ApplyMethodCard 
                locale={locale}
                currentFormDetails={formDetails || undefined}
                onFormDataChange={setFormDetails}
                formId={currentData.form_id}
              />

              <TiptapEditorCard title="상세 설명 (한국어)" value={currentData.rich_content || ""} onChange={(html) => handleFieldChange(day, "rich_content", html)} />
              <TiptapEditorCard title="Detailed Content (English)" value={currentData.rich_content_en || ""} onChange={(html) => handleFieldChange(day, "rich_content_en", html)} isEnglish />

              <div className="mt-12">
                <Button onClick={handleSave} disabled={saving} className="w-full h-16 rounded-2xl bg-primary hover:bg-primary/90 text-xl font-black shadow-xl transition-all active:scale-[0.98]">
                  {saving ? <Loader2 className="w-6 h-6 animate-spin mr-3" /> : <><Save className="w-4 h-4 mr-2" /> {day}요일 설정 저장</>}
                </Button>
              </div>
            </div>
          </TabsContent>;
        })}
      </Tabs>
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
