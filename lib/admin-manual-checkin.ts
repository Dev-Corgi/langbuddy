/** 운영자가 자리배치 화면에서 드래그로 체크인 처리한 경우 */
export const ADMIN_CHECKIN_SOURCE_DRAG = 'admin_drag' as const

export type AdminCheckinSource = typeof ADMIN_CHECKIN_SOURCE_DRAG

export function isAdminDragCheckin(answers: Record<string, unknown> | null | undefined): boolean {
  return answers?._checkin_source === ADMIN_CHECKIN_SOURCE_DRAG
}
