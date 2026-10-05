/** 언어교환 신청폼 음료 선택지 (system_key = drink) */
export const DRINK_OPTIONS_KO = [
  '아이스티',
  '초코라떼(아이스만)',
  '아아',
  '홍차',
  '캐모마일',
] as const

export const DRINK_OPTIONS_EN = [
  'Iced tea',
  'Chocolate latte (iced only)',
  'Iced Americano',
  'Black tea',
  'Chamomile',
] as const

export type DrinkOptionKo = (typeof DRINK_OPTIONS_KO)[number]
