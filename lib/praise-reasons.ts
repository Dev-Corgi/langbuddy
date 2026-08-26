export const PRAISE_REASONS = [
  {
    value: '분위기를 재미있게 이끌어줬어요',
    labelKo: '분위기를 재미있게 이끌어줬어요',
    labelEn: 'Fun, engaging vibe',
  },
  {
    value: '처음 온 사람도 편하게 참여할 수 있도록 챙겨줬어요',
    labelKo: '처음 온 사람도 편하게 참여할 수 있도록 챙겨줬어요',
    labelEn: 'Welcomed newcomers',
  },
  {
    value: '대화를 자연스럽게 이어줬어요',
    labelKo: '대화를 자연스럽게 이어줬어요',
    labelEn: 'Kept talk flowing',
  },
  {
    value: '외국인/한국인 멤버가 소외되지 않도록 챙겨줬어요',
    labelKo: '외국인/한국인 멤버가 소외되지 않도록 챙겨줬어요',
    labelEn: 'Included everyone',
  },
  {
    value: '언어교환을 적극적으로 도와줬어요',
    labelKo: '언어교환을 적극적으로 도와줬어요',
    labelEn: 'Helped with exchange',
  },
  {
    value: '친절하고 매너가 좋았어요',
    labelKo: '친절하고 매너가 좋았어요',
    labelEn: 'Kind and polite',
  },
  {
    value: '밝고 긍정적인 분위기를 만들어줬어요',
    labelKo: '밝고 긍정적인 분위기를 만들어줬어요',
    labelEn: 'Positive atmosphere',
  },
  {
    value: '새로운 멤버와 적극적으로 어울렸어요',
    labelKo: '새로운 멤버와 적극적으로 어울렸어요',
    labelEn: 'Engaged new members',
  },
  {
    value: '상대방의 말을 존중하며 들어줬어요',
    labelKo: '상대방의 말을 존중하며 들어줬어요',
    labelEn: 'Listened well',
  },
  {
    value: '다시 함께 참여하고 싶어요',
    labelKo: '다시 함께 참여하고 싶어요',
    labelEn: 'Want to meet again',
  },
  {
    value: '기타',
    labelKo: '기타',
    labelEn: 'Other',
  },
] as const

export type PraiseReason = (typeof PRAISE_REASONS)[number]['value']

export const VALID_PRAISE_REASONS: PraiseReason[] = PRAISE_REASONS.map((r) => r.value)
