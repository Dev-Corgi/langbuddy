/** 운영자가 자리배치 화면에서 드래그로 체크인 처리한 경우 */
export const ADMIN_CHECKIN_SOURCE_DRAG = 'admin_drag' as const

/** 운영자가 참가자 편집 모달에서 체크인 처리한 경우 */
export const ADMIN_CHECKIN_SOURCE_MODAL = 'admin_modal' as const

export type AdminCheckinSource =
  | typeof ADMIN_CHECKIN_SOURCE_DRAG
  | typeof ADMIN_CHECKIN_SOURCE_MODAL

export function isAdminDragCheckin(answers: Record<string, unknown> | null | undefined): boolean {
  return answers?._checkin_source === ADMIN_CHECKIN_SOURCE_DRAG
}

export function isAdminModalCheckin(answers: Record<string, unknown> | null | undefined): boolean {
  return answers?._checkin_source === ADMIN_CHECKIN_SOURCE_MODAL
}
