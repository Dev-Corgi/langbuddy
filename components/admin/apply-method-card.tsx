'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Loader2 } from 'lucide-react'
import { FormBuilder, FormData as FormBuilderData } from '@/components/admin/form-builder'
import { buildAutoRecurringFormTitles } from '@/lib/session-event-date'

/** 스터디 신청 폼에만 쓰는 제2외국어 프로그램 안내 문항 (필수 아님). DB에 없을 때 기본/병합으로 채움. */
const STUDY_PROGRAM_QUESTIONS_MARKER =
  '제2외국어 스터디는 일반 언어교환 세션과 별개의 프로그램'

function createDefaultStudyProgramQuestions(): FormBuilderData['questions'] {
  return [
    {
      id: crypto.randomUUID(),
      question_text: `제2외국어 스터디는 일반 언어교환 세션과 별개의 프로그램으로 신청을 따로 받고있습니다.

📘 제2외국어 스터디 (17:45~18:45)
원어민 선생님과 소규모로 교재를 활용해 공부하는 시간

💬 언어교환 세션 (19:00~21:00)
외국인 친구들과 자유롭게 영어·한국어로 대화하는 시간

제2외국어 세션을 무료로 참여하기 위해서는 반드시 언어교환 세션을 먼저 신청한 다음 스터디 신청폼을 작성하셔야 합니다.

👉 위 내용을 확인하고 제2외국어 스터디에 신청하시겠습니까?`,
      question_text_en: '',
      question_type: 'checkbox',
      is_required: false,
      options: ['예'],
      options_en: ['Yes'],
      is_new: true,
    },
    {
      id: crypto.randomUUID(),
      question_text: `모든 참가자는 스터디, 언어교환 세션에 입장하기 전에 반드시 각각 줄을 서서 체크인을 완료해야 합니다. ✅

제2외국어 스터디를 들으신 후 언어교환 세션(19:00~21:00) 에도 참여하실 경우,
반드시 언어교환 세션 전용 체크인 줄에서 다시 체크인을 해주셔야 합니다.

👉 위 내용을 확인하고 제2외국어 스터디에 신청하시겠습니까?`,
      question_text_en: '',
      question_type: 'checkbox',
      is_required: false,
      options: ['예'],
      options_en: ['Yes'],
      is_new: true,
    },
    {
      id: crypto.randomUUID(),
      question_text: `제2외국어 스터디(Studying session for Korean students)
L=왕초보기초
H=초중급회화

없는 수업은 신청자가 하루 전날까지 없어서 폐강된 수업입니다!
*`,
      question_text_en: '',
      question_type: 'radio',
      is_required: false,
      options: ['영어', '일본어'],
      options_en: ['English', 'Japanese'],
      is_new: true,
    },
    {
      id: crypto.randomUUID(),
      question_text: `‼️ 꼭 지켜야 할 약속
외국인 티칭스태프가 친절하게 시간을 내서 와주었는데, 학생들이 오지 않아 시간을 낭비하는 일이 종종 있었습니다. 신청 후 무단 불참(노쇼)은 원어민 선생님과 운영진 모두에게 큰 부담이 됩니다.
당일 취소도 노쇼로 간주되며,
무단 노쇼가 3회 누적될 경우 2개월간 스터디 참여가 제한돼요.

제한 해제를 원하실 경우, 운영비 20,000원을 납부하시면 다시 참여 가능합니다.

👉 위 내용을 확인하셨나요?`,
      question_text_en: '',
      question_type: 'checkbox',
      is_required: false,
      options: ['예'],
      options_en: ['Yes'],
      is_new: true,
    },
    {
      id: crypto.randomUUID(),
      question_text: `지각 관련 안내
제2외국어 스터디는 정시(17:45)에 시작돼요.
15분 이상 지각(18시 이후 도착) 시에는 수업 흐름에 지장이 생기고,
선생님과 다른 참가자에게도 피해가 됩니다.

15분 이상 지각이 3회 누적될 경우,
1개월간 스터디 참여가 제한될 수 있습니다.

제한 해제를 원하실 경우, 운영비 10,000원을 납부하시면 다시 참여 가능합니다.

👉 위 내용을 확인하셨나요?`,
      question_text_en: '',
      question_type: 'checkbox',
      is_required: false,
      options: ['예'],
      options_en: ['Yes'],
      is_new: true,
    },
    {
      id: crypto.randomUUID(),
      question_text: `‼️ 필독 
언어교환 세션(19:00~21:00)에 함께 참여하시는 분들(참가비:10,000원)은 제2외국어 스터디(17:45~18:45)를 무료로 들을 수 있어요! ✨

스터디'만' 참여하실 경우에는 운영비 10,000원을 송금 부탁드리고 있습니다.

언어교환도 참여하셔서 무료로 스터디를 하시는 분들은 반드시 언어교환 구글폼을 먼저 신청완료하고 돌아와주세요!

👉 신청하신 스터디 당일, 언어교환 세션에도 함께 참여하시나요?`,
      question_text_en: '',
      question_type: 'radio',
      is_required: false,
      options: [
        '네! 이미 언어교환 신청을 완료해서 스터디는 무료로 참여하겠습니다!',
        '아니요, 저는 스터디만 참여해서 아래 항목에 송금내역을 적겠습니다.',
      ],
      options_en: [
        'Yes! I already registered for language exchange, so I will attend the study for free!',
        'No, I will only attend the study and will fill in the payment details below.',
      ],
      is_new: true,
    },
  ]
}

export function mergeStudyProgramQuestionsIfMissing(
  questions: FormBuilderData['questions']
): FormBuilderData['questions'] {
  if (questions.some((q) => q.question_text?.includes(STUDY_PROGRAM_QUESTIONS_MARKER))) {
    return questions
  }
  return [...questions, ...createDefaultStudyProgramQuestions()]
}

export function buildDefaultStudyFormData(dayKo: string): FormBuilderData {
  const auto = buildAutoRecurringFormTitles(dayKo, 'study')
  const baseQuestions: FormBuilderData['questions'] = [
    {
      id: crypto.randomUUID(),
      question_text: '이름',
      question_text_en: 'Name',
      question_type: 'text',
      is_required: true,
      options: [''],
      options_en: [''],
      is_new: true,
      system_key: 'name',
    },
    {
      id: crypto.randomUUID(),
      question_text: '성별',
      question_text_en: 'Gender',
      question_type: 'radio',
      is_required: true,
      options: ['남', '여'],
      options_en: ['Male', 'Female'],
      is_new: true,
      system_key: 'gender',
    },
    {
      id: crypto.randomUUID(),
      question_text: '한국인 / 외국인 여부',
      question_text_en: 'Nationality',
      question_type: 'radio',
      is_required: true,
      options: ['한국인', '외국인'],
      options_en: ['Korean', 'Foreigner'],
      is_new: true,
      system_key: 'nationality',
    },
    {
      id: crypto.randomUUID(),
      question_text: '카카오톡 ID',
      question_text_en: 'KakaoTalk ID',
      question_type: 'text',
      is_required: true,
      options: [''],
      options_en: [''],
      is_new: true,
      system_key: 'kakao_id',
    },
  ]

  return {
    ...auto,
    description: '',
    description_en: '',
    webhook_url: '',
    questions: mergeStudyProgramQuestionsIfMissing(baseQuestions),
  }
}

interface ApplyMethodCardProps {
  locale: string
  currentFormDetails?: FormBuilderData
  onFormDataChange: (data: FormBuilderData) => void
  loadingForm?: boolean
  infoMessage?: string
  infoMessageEn?: string
  mode?: 'default' | 'language' | 'study'
  recurringDayKo?: string
  lockedSystemKeys?: string[]
}

/** DB 로드는 부모 페이지에서 1회만. 여기서는 편집 UI만 렌더. */
export function ApplyMethodCard({
  locale,
  currentFormDetails,
  onFormDataChange,
  loadingForm = false,
  mode = 'default',
  recurringDayKo,
  lockedSystemKeys,
}: ApplyMethodCardProps) {
  const autoTitlesForBuilder =
    (mode === 'language' || mode === 'study') && recurringDayKo
      ? buildAutoRecurringFormTitles(recurringDayKo, mode === 'language' ? 'language' : 'study')
      : undefined
  const titleMode: 'editable' | 'auto' =
    (mode === 'language' || mode === 'study') && recurringDayKo ? 'auto' : 'editable'

  return (
    <Card className="border-none shadow-sm rounded-[32px] overflow-hidden bg-card">
      <CardHeader className="p-8 pb-0">
        <CardTitle className="text-lg font-black flex items-center gap-2">
          <div className="w-1.5 h-6 bg-primary rounded-full" />
          {locale === 'en' ? 'Application Form Settings' : '신청 폼 설정'}
        </CardTitle>
      </CardHeader>
      <CardContent className="p-8">
        <div className="border-2 border-dashed border-primary/20 rounded-[40px] p-2 bg-primary/5 transition-all">
          <div className="p-4 md:p-8">
            {loadingForm || !currentFormDetails ? (
              <div className="py-16 flex justify-center">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
              </div>
            ) : (
              <FormBuilder
                value={currentFormDetails}
                onChange={onFormDataChange}
                lockedSystemKeys={lockedSystemKeys}
                titleMode={titleMode}
                autoTitles={autoTitlesForBuilder}
              />
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
