export const REPORT_REASONS = [
  {
    value: '존중하지 않는 태도',
    labelKo: '존중하지 않는 태도',
    labelEn: 'Disrespectful attitude',
  },
  {
    value: '불쾌한 언행 또는 조롱',
    labelKo: '불쾌한 언행 또는 조롱',
    labelEn: 'Offensive remarks or mockery',
  },
  {
    value: '차별적 발언 (국적, 성별, 나이, 외모, 인종 등)',
    labelKo: '차별적 발언 (국적, 성별, 나이, 외모, 인종 등)',
    labelEn: 'Discriminatory remarks (nationality, gender, age, appearance, race, etc.)',
  },
  {
    value: '부적절한 대화 주제 제시',
    labelKo: '부적절한 대화 주제 제시',
    labelEn: 'Inappropriate conversation topics',
  },
  {
    value: '타인의 발언 기회를 제한하는 행동',
    labelKo: '타인의 발언 기회를 제한하는 행동',
    labelEn: 'Preventing others from speaking',
  },
  {
    value: '무리한 행동 또는 강요',
    labelKo: '무리한 행동 또는 강요',
    labelEn: 'Pushy behavior or coercion',
  },
  {
    value: '일방적인 연락 또는 접촉 시도 (카톡, 디엠 등)',
    labelKo: '일방적인 연락 또는 접촉 시도 (카톡, 디엠 등)',
    labelEn: 'Unwanted contact attempts (KakaoTalk, DMs, etc.)',
  },
  {
    value: '불필요한 신체접촉',
    labelKo: '불필요한 신체접촉',
    labelEn: 'Unwanted physical contact',
  },
  {
    value: '과도한 음주 또는 음주강요',
    labelKo: '과도한 음주 또는 음주강요',
    labelEn: 'Excessive drinking or pressuring others to drink',
  },
  {
    value: '부적절한 음주 관련 행동',
    labelKo: '부적절한 음주 관련 행동',
    labelEn: 'Inappropriate behavior related to drinking',
  },
  {
    value: '모임 목적과 무관한 홍보, 영업, 판매',
    labelKo: '모임 목적과 무관한 홍보, 영업, 판매',
    labelEn: 'Unrelated promotion, sales, or marketing',
  },
  {
    value: '정치, 종교적 홍보 또는 포교',
    labelKo: '정치, 종교적 홍보 또는 포교',
    labelEn: 'Political or religious promotion or proselytizing',
  },
  {
    value: '기타',
    labelKo: '기타',
    labelEn: 'Other',
  },
] as const

export type ReportReason = (typeof REPORT_REASONS)[number]['value']

export const VALID_REPORT_REASONS: ReportReason[] = REPORT_REASONS.map((r) => r.value)

/** 이전 버전 사유 — DB에 남아 있는 기존 신고 레코드 호환용 */
export const LEGACY_REPORT_REASONS = [
  '폭언/욕설',
  '성희롱/부적절한 언행',
  '노쇼/자리이탈',
  '허위 정보',
] as const

export const ALL_DB_REPORT_REASONS = [
  ...VALID_REPORT_REASONS,
  ...LEGACY_REPORT_REASONS,
] as const
