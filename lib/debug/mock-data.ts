import type { ApplicationRow, SeatingSession } from '@/app/my/_lib/types'
import type { SessionRound } from '@/app/my/sessions/[posting_id]/[session_date]/page'

const FUTURE_DATE = '2026-09-15'
const SESSION_DATE = '2026-08-18'

export const MOCK_LANGUAGE_POSTING = {
  id: 'debug-language-master',
  title: '[DEBUG] 언어교환 세션',
  title_en: '[DEBUG] Language Exchange',
  subtitle: '목업 · UI 디버그',
  subtitle_en: 'Mock · UI debug',
  category: '언어교환',
  status: 'active',
  date: null as string | null,
  time: null as string | null,
  location: '서울 성수동',
  location_en: 'Seongsu, Seoul',
  cost: '유료 (계좌이체/현장)',
  cost_en: 'Paid (bank / on-site)',
  host: 'LangBuddy',
  host_en: 'LangBuddy',
  image_url: '/imagebuttons/meetup.jpg',
  max_participants: 40,
  is_recurring: true,
  recurring_days: ['월', '수', '금'],
  apply_type: 'form',
  form_id: 'debug-form-language',
  day_of_week: null as string | null,
  description: '디버그용 언어교환 목업 포스팅입니다. 실제 DB와 무관합니다.',
  description_en: 'Mock language-exchange posting for UI debug. Not connected to the real DB.',
  description_ko: '디버그용 언어교환 목업 포스팅입니다. 실제 DB와 무관합니다.',
  rich_content:
    '<p>이 화면은 <strong>/debug</strong> 목업 데이터입니다. 신청·결제는 저장되지 않습니다.</p>',
  rich_content_en:
    '<p>This screen uses <strong>/debug</strong> mock data. Apply/payment actions are not persisted.</p>',
  bank_account: '카카오뱅크 3333-00-0000000',
  bank_account_holder: '랭버디',
}

export const MOCK_MEETUP_POSTINGS = [
  {
    id: 'debug-meetup-1',
    title: '[DEBUG] 성수 번개 모임',
    title_en: '[DEBUG] Seongsu Meetup',
    subtitle: '금요일 저녁',
    subtitle_en: 'Friday evening',
    category: '번개',
    status: 'active',
    date: FUTURE_DATE,
    time: '19:00',
    location: '성수 카페',
    location_en: 'Seongsu Cafe',
    cost: '12,000원',
    cost_en: '₩12,000',
    host: 'LangBuddy',
    host_en: 'LangBuddy',
    image_url: '/imagebuttons/meetup.jpg',
    max_participants: 20,
    is_recurring: false,
    apply_type: 'form',
    form_id: 'debug-form-meetup-1',
    deadline: '2026-09-14T15:00:00+09:00',
    description: '디버그용 번개 목업입니다.',
    description_en: 'Mock meetup for UI debug.',
    rich_content: '<p>번개 상세 목업 본문입니다.</p>',
    rich_content_en: '<p>Mock meetup detail body.</p>',
  },
  {
    id: 'debug-meetup-2',
    title: '[DEBUG] 홍대 번개',
    title_en: '[DEBUG] Hongdae Meetup',
    subtitle: '주말 오후',
    subtitle_en: 'Weekend afternoon',
    category: '번개',
    status: 'active',
    date: '2026-09-20',
    time: '15:00',
    location: '홍대입구',
    location_en: 'Hongdae',
    cost: '무료',
    cost_en: 'Free',
    host: 'LangBuddy',
    host_en: 'LangBuddy',
    image_url: '/imagebuttons/meetup.jpg',
    max_participants: 15,
    is_recurring: false,
    apply_type: 'link',
    apply_link: 'https://example.com/apply',
    form_id: null as string | null,
    deadline: '2026-09-19T15:00:00+09:00',
    description: '외부 링크 신청 타입 목업.',
    description_en: 'External-link apply type mock.',
    rich_content: '<p>외부 신청 링크 타입 디버그용.</p>',
    rich_content_en: '<p>External apply-link type for debug.</p>',
  },
  {
    id: 'debug-meetup-3',
    title: '[DEBUG] 강남 네트워킹',
    title_en: '[DEBUG] Gangnam Networking',
    subtitle: '목업 카드',
    subtitle_en: 'Mock card',
    category: '번개',
    status: 'active',
    date: '2026-09-22',
    time: '20:00',
    location: '강남',
    location_en: 'Gangnam',
    cost: '15,000원',
    cost_en: '₩15,000',
    host: 'LangBuddy',
    host_en: 'LangBuddy',
    image_url: '/imagebuttons/meetup.jpg',
    max_participants: 30,
    is_recurring: false,
    apply_type: 'form',
    form_id: 'debug-form-meetup-3',
    deadline: null as string | null,
    description: '세 번째 번개 목업.',
    description_en: 'Third meetup mock.',
    rich_content: '<p>리스트·캐러셀용 추가 카드.</p>',
    rich_content_en: '<p>Extra card for list/carousel.</p>',
  },
] as const

export const MOCK_ALL_POSTINGS = [MOCK_LANGUAGE_POSTING, ...MOCK_MEETUP_POSTINGS]

export const MOCK_LE_SCHEDULES = [
  {
    day_of_week: '월',
    location: '성수 A',
    location_en: 'Seongsu A',
    time: '19:00–21:00',
    map_url: 'https://maps.google.com',
    location_map_url: 'https://maps.google.com',
    form_id: 'debug-form-language',
    posting_id: MOCK_LANGUAGE_POSTING.id,
    is_active: true,
  },
  {
    day_of_week: '수',
    location: '성수 B',
    location_en: 'Seongsu B',
    time: '19:00–21:00',
    map_url: 'https://maps.google.com',
    location_map_url: 'https://maps.google.com',
    form_id: 'debug-form-language',
    posting_id: MOCK_LANGUAGE_POSTING.id,
    is_active: true,
  },
  {
    day_of_week: '금',
    location: '성수 C',
    location_en: 'Seongsu C',
    time: '19:30–21:30',
    map_url: 'https://maps.google.com',
    location_map_url: 'https://maps.google.com',
    form_id: 'debug-form-language',
    posting_id: MOCK_LANGUAGE_POSTING.id,
    is_active: true,
  },
]

export const MOCK_FORM_QUESTIONS = [
  {
    id: 'q1',
    form_id: 'debug-form-language',
    question_text: '이름',
    question_text_en: 'Name',
    question_type: 'text',
    required: true,
    options: null,
    sort_order: 1,
  },
  {
    id: 'q2',
    form_id: 'debug-form-language',
    question_text: '국적',
    question_text_en: 'Nationality',
    question_type: 'text',
    required: true,
    options: null,
    sort_order: 2,
  },
  {
    id: 'q3',
    form_id: 'debug-form-language',
    question_text: '선호 요일',
    question_text_en: 'Preferred day',
    question_type: 'select',
    required: true,
    options: ['월', '수', '금'],
    options_en: ['Mon', 'Wed', 'Fri'],
    sort_order: 3,
  },
]

export const MOCK_USER = {
  id: 'debug-user-1',
  name: 'Debug Super',
  email: 'debug@langbuddy.local',
}

export function getMockPostingById(id: string) {
  if (id === 'language' || id === MOCK_LANGUAGE_POSTING.id) {
    return { ...MOCK_LANGUAGE_POSTING, recurring_days: [...MOCK_LANGUAGE_POSTING.recurring_days] }
  }
  return MOCK_MEETUP_POSTINGS.find((p) => p.id === id) ?? null
}

export function buildMockApplications(basePath: string): ApplicationRow[] {
  return [
    {
      id: 'debug-app-1',
      form_id: 'debug-form-language',
      created_at: '2026-08-10T10:00:00+09:00',
      answers: { _selected_day: '월', _event_date: SESSION_DATE },
      category: '언어교환',
      label: '[DEBUG] 언어교환 · 월요일 세션',
      eventDate: SESSION_DATE,
      applicationHref: `${basePath}/apply/complete?id=debug-app-1`,
      meetupHref: `${basePath}/posting/language`,
    },
    {
      id: 'debug-app-2',
      form_id: 'debug-form-meetup-1',
      created_at: '2026-08-12T10:00:00+09:00',
      answers: { _event_date: FUTURE_DATE },
      category: '번개',
      label: '[DEBUG] 성수 번개 모임',
      eventDate: FUTURE_DATE,
      applicationHref: `${basePath}/apply/complete?id=debug-app-2`,
      meetupHref: `${basePath}/posting/debug-meetup-1`,
    },
  ]
}

export function buildMockSeatingSessions(): SeatingSession[] {
  return [
    {
      posting_id: MOCK_LANGUAGE_POSTING.id,
      session_date: SESSION_DATE,
      dayLabel: '월',
      rounds: [1, 2, 3],
    },
  ]
}

export function buildMockSessionRounds(): SessionRound[] {
  return [
    {
      round: 1,
      tableLabel: 'A',
      mates: [
        {
          responseId: 'debug-res-1',
          userId: 'debug-mate-1',
          name: 'Alex Kim',
          nationality: 'KR',
          language: 'EN',
          gender: 'M',
        },
        {
          responseId: 'debug-res-2',
          userId: 'debug-mate-2',
          name: 'Jordan Lee',
          nationality: 'US',
          language: 'KO',
          gender: 'F',
        },
      ],
    },
    {
      round: 2,
      tableLabel: 'B',
      mates: [
        {
          responseId: 'debug-res-3',
          userId: 'debug-mate-3',
          name: 'Sam Park',
          nationality: 'JP',
          language: 'EN',
          gender: 'M',
        },
      ],
    },
    {
      round: 3,
      tableLabel: 'C',
      mates: [
        {
          responseId: 'debug-res-4',
          userId: 'debug-mate-4',
          name: 'Riley Chen',
          nationality: 'TW',
          language: 'KO',
          gender: 'F',
        },
        {
          responseId: 'debug-res-5',
          userId: null,
          name: '(이름 없음)',
          nationality: '-',
          language: '-',
          gender: '-',
        },
      ],
    },
  ]
}

export const MOCK_COMPLETE_RESPONSE = {
  id: 'debug-app-1',
  form_id: 'debug-form-language',
  user_id: MOCK_USER.id,
  answers: {
    q1: 'Debug Super',
    q2: 'Korea',
    q3: '월',
    _selected_day: '월',
    _event_date: SESSION_DATE,
    _payment_method: 'bank',
  },
  payment_status: 'pending',
  payment_method: 'bank',
  qr_code: 'DEBUG-QR-MOCK-001',
  forms: {
    title: '[DEBUG] 언어교환 신청',
    title_en: '[DEBUG] Language Exchange Apply',
  },
}

export const MOCK_MARKED_DATES = new Set<string>([SESSION_DATE, FUTURE_DATE])
