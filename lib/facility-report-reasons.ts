export const FACILITY_REPORT_REASONS = [
  {
    value: '에어컨/난방 온도가 적절하지 않았어요',
    labelKo: '에어컨/난방 온도가 적절하지 않았어요',
    labelEn: 'AC/heating issue',
  },
  {
    value: '테이블이 불안정해요',
    labelKo: '테이블이 불안정해요',
    labelEn: 'Unstable table',
  },
  {
    value: '실내 공기가 답답하거나 환기가 부족했어요',
    labelKo: '실내 공기가 답답하거나 환기가 부족했어요',
    labelEn: 'Poor ventilation',
  },
  {
    value: '음식/담배 등 불쾌한 냄새가 났어요',
    labelKo: '음식/담배 등 불쾌한 냄새가 났어요',
    labelEn: 'Bad odors',
  },
  {
    value: '주변 소음이 너무 컸어요',
    labelKo: '주변 소음이 너무 컸어요',
    labelEn: 'Too noisy',
  },
  {
    value: '의자가 불편했어요',
    labelKo: '의자가 불편했어요',
    labelEn: 'Uncomfortable chairs',
  },
  {
    value: '공간이 너무 좁거나 혼잡했어요',
    labelKo: '공간이 너무 좁거나 혼잡했어요',
    labelEn: 'Too cramped',
  },
  {
    value: '화장실 이용이 불편했어요',
    labelKo: '화장실 이용이 불편했어요',
    labelEn: 'Restroom issue',
  },
  {
    value: '조명이나 실내 밝기가 불편했어요',
    labelKo: '조명이나 실내 밝기가 불편했어요',
    labelEn: 'Bad lighting',
  },
  {
    value: '시설이 청결하지 않았어요',
    labelKo: '시설이 청결하지 않았어요',
    labelEn: 'Not clean',
  },
  {
    value: '테이블/의자/공간 정리가 되어 있지 않았어요',
    labelKo: '테이블/의자/공간 정리가 되어 있지 않았어요',
    labelEn: 'Messy space',
  },
  {
    value: '음악 소리가 너무 크거나 작았어요',
    labelKo: '음악 소리가 너무 크거나 작았어요',
    labelEn: 'Music volume',
  },
  {
    value: '장소를 찾거나 입장하는 과정이 불편했어요',
    labelKo: '장소를 찾거나 입장하는 과정이 불편했어요',
    labelEn: 'Hard to find/enter',
  },
  {
    value: '기타',
    labelKo: '기타',
    labelEn: 'Other',
  },
] as const

export type FacilityReportReason = (typeof FACILITY_REPORT_REASONS)[number]['value']

export const VALID_FACILITY_REPORT_REASONS: FacilityReportReason[] =
  FACILITY_REPORT_REASONS.map((r) => r.value)
